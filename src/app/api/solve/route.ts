// POST /api/solve { puzzleId, line } — server-authoritative solve for ONE puzzle
// within today's set. Enforces in-order progression, verifies physics, records the
// first solve, and updates the player's daily-set progress (solved_count, total_ink).

import { NextRequest, NextResponse } from 'next/server';
import { userClient, adminClient } from '@/lib/supabase-server';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const validator = require('@/lib/validator.js');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function todayUTC(): string { return new Date().toISOString().slice(0, 10); }

export async function POST(req: NextRequest) {
  const supa = userClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const points = body?.line;
  const puzzleId = body?.puzzleId;
  if (!puzzleId) return NextResponse.json({ error: 'missing_puzzle' }, { status: 400 });
  if (!Array.isArray(points) || points.length < 2) return NextResponse.json({ error: 'invalid_line' }, { status: 400 });
  if (points.length > 2000) return NextResponse.json({ error: 'too_many_points' }, { status: 400 });
  for (const p of points) {
    if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'number' || typeof p[1] !== 'number'
        || p[0] < -50 || p[0] > 850 || p[1] < -50 || p[1] > 650) {
      return NextResponse.json({ error: 'point_out_of_range' }, { status: 400 });
    }
  }

  const admin = adminClient();
  // The puzzle being solved must be in TODAY's set.
  const { data: puzzle } = await admin.from('puzzles')
    .select('*').eq('id', puzzleId).eq('play_date', todayUTC()).single();
  if (!puzzle) return NextResponse.json({ error: 'not_in_todays_set' }, { status: 404 });

  // In-order gate: you may only solve the next unsolved position.
  const { data: progRow } = await admin.from('daily_progress')
    .select('solved_count,total_ink,completed').eq('user_id', user.id).eq('play_date', todayUTC()).maybeSingle();
  const solvedCount = progRow?.solved_count ?? 0;
  if (puzzle.set_position > solvedCount + 1) {
    return NextResponse.json({ error: 'locked', message: 'Solve the earlier puzzles first.' }, { status: 403 });
  }

  // Verify (server-authoritative).
  const line = validator.simplify(points);
  const result = validator.simulate(puzzle.definition, line);
  if (!result.solved) return NextResponse.json({ solved: false }, { status: 200 });
  const ink = validator.polyLen(line);

  // Record first solve (unique constraint => first is final).
  const { error: insErr } = await admin.from('solutions').insert({ puzzle_id: puzzle.id, user_id: user.id, ink, line });
  let official = ink, alreadySolved = false;
  if (insErr) {
    alreadySolved = true;
    const { data: existing } = await admin.from('solutions').select('ink').eq('puzzle_id', puzzle.id).eq('user_id', user.id).single();
    if (existing) official = existing.ink;
  } else if (puzzle.world_best == null || ink < puzzle.world_best) {
    await admin.from('puzzles').update({ world_best: ink }).eq('id', puzzle.id);
  }

  // Update daily-set progress (only count NEW solves toward solved_count/total_ink).
  let newSolvedCount = solvedCount, newTotalInk = progRow?.total_ink ?? 0, completed = progRow?.completed ?? false;
  if (!alreadySolved && puzzle.set_position === solvedCount + 1) {
    newSolvedCount = solvedCount + 1;
    newTotalInk = (progRow?.total_ink ?? 0) + official;
    // how many puzzles in today's set total?
    const { count: setCount } = await admin.from('puzzles').select('*', { count: 'exact', head: true }).eq('play_date', todayUTC());
    completed = newSolvedCount >= (setCount ?? newSolvedCount);
    await admin.from('daily_progress').upsert({
      user_id: user.id, play_date: todayUTC(),
      solved_count: newSolvedCount, total_ink: newTotalInk, completed, updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,play_date' });
    if (completed) await updateStreak(admin, user.id, todayUTC());
  }

  return NextResponse.json({
    solved: true, ink: official, puzzlePosition: puzzle.set_position,
    solvedCount: newSolvedCount, totalInk: newTotalInk, completed,
    worldBest: puzzle.world_best ?? official, worldAvg: puzzle.definition?.stats?.worldAvg ?? null
  });
}

async function updateStreak(admin: any, userId: string, playDate: string) {
  const { data: prof } = await admin.from('profiles')
    .select('current_streak,longest_streak,last_play_date,is_premium,streak_freezes,last_freeze_grant')
    .eq('user_id', userId).single();
  if (!prof) return;
  let freezes = prof.streak_freezes ?? 0;
  let lastGrant = prof.last_freeze_grant as string | null;
  const month = playDate.slice(0, 7);
  if (prof.is_premium && (!lastGrant || lastGrant.slice(0, 7) !== month)) { freezes = Math.min(3, freezes + 1); lastGrant = playDate; }
  const prev = prof.last_play_date ? new Date(prof.last_play_date) : null;
  const today = new Date(playDate);
  let streak = 1;
  if (prev) {
    const diffDays = Math.round((today.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 0) { await admin.from('profiles').update({ streak_freezes: freezes, last_freeze_grant: lastGrant }).eq('user_id', userId); return; }
    if (diffDays === 1) streak = prof.current_streak + 1;
    else if (diffDays === 2 && prof.is_premium && freezes > 0) { streak = prof.current_streak + 1; freezes -= 1; }
    else streak = 1;
  }
  await admin.from('profiles').update({
    current_streak: streak, longest_streak: Math.max(streak, prof.longest_streak || 0),
    last_play_date: playDate, streak_freezes: freezes, last_freeze_grant: lastGrant
  }).eq('user_id', userId);
}
