// GET /api/stats  — premium only. Personal performance dashboard data.
import { NextResponse } from 'next/server';
import { userClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supa = userClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const { data: prof } = await supa.from('profiles')
    .select('is_premium,current_streak,longest_streak').eq('user_id', user.id).single();
  if (!prof?.is_premium) return NextResponse.json({ error: 'premium_required' }, { status: 403 });

  // All of the player's solves, joined to puzzle meta for context.
  const { data: solves } = await supa
    .from('solutions')
    .select('puzzle_id,ink,created_at,puzzles(number,name,difficulty,world_best)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  const rows = (solves ?? []).map((s: any) => ({
    number: s.puzzles?.number, name: s.puzzles?.name, difficulty: s.puzzles?.difficulty,
    ink: s.ink, worldBest: s.puzzles?.world_best, date: s.created_at?.slice(0, 10)
  }));

  const inks = rows.map(r => r.ink).filter((n: number) => typeof n === 'number');
  const avg = inks.length ? Math.round(inks.reduce((a: number, b: number) => a + b, 0) / inks.length) : null;
  const best = inks.length ? Math.min(...inks) : null;
  // how often the player matched the world best (within 2px)
  const recordTies = rows.filter(r => r.worldBest != null && r.ink <= r.worldBest + 2).length;

  return NextResponse.json({
    totalSolved: rows.length,
    avgInk: avg,
    bestInk: best,
    recordTies,
    currentStreak: prof.current_streak,
    longestStreak: prof.longest_streak,
    history: rows           // chronological, for a simple chart
  });
}
