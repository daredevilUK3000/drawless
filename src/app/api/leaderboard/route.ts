// GET /api/leaderboard?puzzle=<id>
// Returns ranked solutions for a puzzle (ink + display name + line for ghosts).
// On a fresh puzzle with few/no real solves, falls back to the puzzle's own
// verified seed ghosts so the player always has something to compare against.
import { NextRequest, NextResponse } from 'next/server';
import { userClient, adminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function inkOf(line: number[][]) {
  let L = 0; for (let i = 1; i < line.length; i++) L += Math.hypot(line[i][0]-line[i-1][0], line[i][1]-line[i-1][1]);
  return Math.round(L);
}

export async function GET(req: NextRequest) {
  const puzzleId = req.nextUrl.searchParams.get('puzzle');
  if (!puzzleId) return NextResponse.json({ error: 'missing_puzzle' }, { status: 400 });

  const supa = userClient();
  const { data, error } = await supa
    .from('leaderboard')
    .select('ink,line,display_name,country,created_at')
    .eq('puzzle_id', puzzleId)
    .order('ink', { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const real = data ?? [];
  const ghosts: any[] = [];

  // Always surface the real world best if we have one.
  if (real.length) {
    ghosts.push({ tag: 'world best', ...real[0] });
    if (real.length > 4) ghosts.push({ tag: 'mid pack', ...real[Math.floor(real.length / 2)] });
    if (real.length > 1) ghosts.push({ tag: 'clever', ...real[real.length - 1] });
  }

  // Top up with the puzzle's seeded verified ghosts so there's always a spread,
  // especially on day one before real players have solved it.
  if (ghosts.length < 2) {
    const admin = adminClient();
    const { data: puz } = await admin.from('puzzles').select('definition').eq('id', puzzleId).single();
    const seeds = puz?.definition?.ghosts ?? [];
    for (const g of seeds) {
      const line = g.pts;
      ghosts.push({ tag: 'seed', ink: inkOf(line), line, display_name: g.name });
      if (ghosts.length >= 3) break;
    }
    // sort the combined set shortest-first so index 0 is the best
    ghosts.sort((a, b) => a.ink - b.ink);
  }

  return NextResponse.json({ count: real.length, top: real.slice(0, 20), ghosts: ghosts.slice(0, 3) });
}
