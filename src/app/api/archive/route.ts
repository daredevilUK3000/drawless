// GET /api/archive  — premium only. Lists past daily puzzles (before today) so
// premium players can replay the back catalogue. Returns the player's recorded
// ink for each (if any) so the UI can show solved/unsolved.
import { NextResponse } from 'next/server';
import { userClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supa = userClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const { data: prof } = await supa.from('profiles').select('is_premium').eq('user_id', user.id).single();
  if (!prof?.is_premium) return NextResponse.json({ error: 'premium_required' }, { status: 403 });

  const today = new Date().toISOString().slice(0, 10);
  const { data: puzzles } = await supa
    .from('puzzles')
    .select('id,number,name,difficulty,play_date,world_best')
    .lt('play_date', today)
    .order('play_date', { ascending: false })
    .limit(400);

  const { data: mine } = await supa.from('solutions').select('puzzle_id,ink').eq('user_id', user.id);
  const inkByPuzzle = new Map((mine ?? []).map((r: any) => [r.puzzle_id, r.ink]));

  const list = (puzzles ?? []).map((p: any) => ({
    id: p.id, number: p.number, name: p.name, difficulty: p.difficulty,
    play_date: p.play_date, world_best: p.world_best,
    myInk: inkByPuzzle.get(p.id) ?? null
  }));
  return NextResponse.json({ count: list.length, puzzles: list });
}
