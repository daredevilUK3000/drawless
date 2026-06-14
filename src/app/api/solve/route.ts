// POST /api/solve  — the anti-cheat heart of DrawLess.
// The client submits ONLY the raw line points. The server:
//   1. confirms the user is logged in,
//   2. loads today's puzzle from the DB,
//   3. re-simulates the line through the SAME physics (validator.js),
//   4. measures ink itself,
//   5. records the FIRST verified solve as the official score,
//   6. updates the streak.
// The browser's claimed score is never trusted.

import { NextRequest, NextResponse } from 'next/server';
import { userClient, adminClient } from '@/lib/supabase-server';
// validator.js is CommonJS; import via require-style interop
// eslint-disable-next-line @typescript-eslint/no-var-requires
const validator = require('@/lib/validator.js');

export const runtime = 'nodejs';        // matter-js needs Node, not edge
export const dynamic = 'force-dynamic';

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  // --- auth ---
  const supa = userClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  // --- input ---
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const points = body?.line;
  if (!Array.isArray(points) || points.length < 2) {
    return NextResponse.json({ error: 'invalid_line' }, { status: 400 });
  }
  // basic sanity: cap point count and coordinate range to stop abuse
  if (points.length > 2000) return NextResponse.json({ error: 'too_many_points' }, { status: 400 });
  for (const p of points) {
    if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'number' || typeof p[1] !== 'number'
        || p[0] < -50 || p[0] > 850 || p[1] < -50 || p[1] > 650) {
      return NextResponse.json({ error: 'point_out_of_range' }, { status: 400 });
    }
  }

  // --- load today's puzzle (admin client: read the live row regardless of RLS timing) ---
  const admin = adminClient();
  const { data: puzzle, error: pErr } = await admin
    .from('puzzles').select('*').eq('play_date', todayUTC()).single();
  if (pErr || !puzzle) return NextResponse.json({ error: 'no_puzzle_today' }, { status: 404 });

  // --- simplify + simulate (server-authoritative) ---
  const line = validator.simplify(points);
  const def = puzzle.definition;
  const result = validator.simulate(def, line);
  if (!result.solved) {
    return NextResponse.json({ solved: false }, { status: 200 });
  }
  const ink = validator.polyLen(line);

  // --- record FIRST solve only (unique constraint enforces "first is final") ---
  const { error: insErr } = await admin.from('solutions').insert({
    puzzle_id: puzzle.id, user_id: user.id, ink, line
  });
  // unique violation => already solved; that's fine, return their existing score
  let official = ink;
  if (insErr) {
    const { data: existing } = await admin.from('solutions')
      .select('ink').eq('puzzle_id', puzzle.id).eq('user_id', user.id).single();
    if (existing) official = existing.ink;
  } else {
    // first solve: update streak + world_best
    await updateStreak(admin, user.id, puzzle.play_date);
    if (puzzle.world_best == null || ink < puzzle.world_best) {
      await admin.from('puzzles').update({ world_best: ink }).eq('id', puzzle.id);
    }
  }

  // --- compute rank/percentile for the response ---
  const { count: total } = await admin.from('solutions')
    .select('*', { count: 'exact', head: true }).eq('puzzle_id', puzzle.id);
  const { count: better } = await admin.from('solutions')
    .select('*', { count: 'exact', head: true }).eq('puzzle_id', puzzle.id).lt('ink', official);
  const percentile = total ? Math.max(1, Math.round(((better || 0) + 1) / total * 100)) : 1;

  return NextResponse.json({
    solved: true, ink: official, worldBest: puzzle.world_best ?? official,
    worldAvg: def?.stats?.worldAvg ?? null, percentile, total
  });
}

async function updateStreak(admin: any, userId: string, playDate: string) {
  const { data: prof } = await admin.from('profiles')
    .select('current_streak,longest_streak,last_play_date').eq('user_id', userId).single();
  if (!prof) return;
  const prev = prof.last_play_date ? new Date(prof.last_play_date) : null;
  const today = new Date(playDate);
  let streak = 1;
  if (prev) {
    const diffDays = Math.round((today.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 0) return;                 // already counted today
    streak = diffDays === 1 ? prof.current_streak + 1 : 1;  // consecutive or reset
  }
  await admin.from('profiles').update({
    current_streak: streak,
    longest_streak: Math.max(streak, prof.longest_streak || 0),
    last_play_date: playDate
  }).eq('user_id', userId);
}
