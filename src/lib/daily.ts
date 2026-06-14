// Helpers for fetching the day's puzzle.
import { userClient } from './supabase-server';

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// The puzzle live today. Returns the definition WITHOUT its ghost solutions —
// ghosts are only revealed via /api/leaderboard AFTER the player solves, so the
// puzzle payload can't leak the answer.
export async function getTodaysPuzzle() {
  const supa = userClient();
  const { data, error } = await supa
    .from('puzzles')
    .select('id,number,name,difficulty,definition,world_best,play_date')
    .eq('play_date', todayUTC())
    .single();
  if (error || !data) return null;
  const def = { ...data.definition };
  delete def.ghosts;                 // never ship the answer to the client
  return { ...data, definition: def };
}
