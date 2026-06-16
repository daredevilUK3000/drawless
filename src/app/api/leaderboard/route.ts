// GET /api/leaderboard?puzzle=<id>         -> ghosts + top for a single puzzle
// GET /api/leaderboard?daily=1             -> daily-SET leaderboard (total ink, completed sets)
import { NextRequest, NextResponse } from 'next/server';
import { userClient, adminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
function inkOf(line: number[][]) { let L=0; for(let i=1;i<line.length;i++)L+=Math.hypot(line[i][0]-line[i-1][0],line[i][1]-line[i-1][1]); return Math.round(L); }
function todayUTC(){ return new Date().toISOString().slice(0,10); }

export async function GET(req: NextRequest) {
  const supa = userClient();
  const daily = req.nextUrl.searchParams.get('daily');

  // --- daily-set leaderboard: total ink across today's completed sets ---
  if (daily) {
    const { data, error } = await supa.from('daily_leaderboard')
      .select('total_ink,solved_count,completed,display_name,country')
      .eq('play_date', todayUTC())
      .eq('completed', true)
      .order('total_ink', { ascending: true })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ top: data ?? [], count: (data ?? []).length });
  }

  // --- single-puzzle ghosts (for the ghost overlay after solving each puzzle) ---
  const puzzleId = req.nextUrl.searchParams.get('puzzle');
  if (!puzzleId) return NextResponse.json({ error: 'missing_puzzle' }, { status: 400 });

  const { data, error } = await supa.from('leaderboard')
    .select('ink,line,display_name,country,created_at').eq('puzzle_id', puzzleId)
    .order('ink', { ascending: true }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const real = data ?? []; const ghosts: any[] = [];
  if (real.length) {
    ghosts.push({ tag: 'world best', ...real[0] });
    if (real.length > 4) ghosts.push({ tag: 'mid pack', ...real[Math.floor(real.length/2)] });
    if (real.length > 1) ghosts.push({ tag: 'clever', ...real[real.length-1] });
  }
  if (ghosts.length < 2) {
    const admin = adminClient();
    const { data: puz } = await admin.from('puzzles').select('definition').eq('id', puzzleId).single();
    const seeds = puz?.definition?.ghosts ?? [];
    for (const g of seeds) { ghosts.push({ tag:'seed', ink: inkOf(g.pts), line: g.pts, display_name: g.name }); if (ghosts.length>=3) break; }
    ghosts.sort((a,b)=>a.ink-b.ink);
  }
  return NextResponse.json({ count: real.length, top: real.slice(0,20), ghosts: ghosts.slice(0,3) });
}
