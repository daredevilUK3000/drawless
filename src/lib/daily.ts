// Helpers for fetching the day's SET of puzzles.
import { userClient } from './supabase-server';

export const SET_SIZE = 5;

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// Today's set: up to SET_SIZE puzzles sharing today's play_date, ordered by
// set_position (the difficulty arc). Ghost solutions are stripped from each so
// the client payload never leaks answers.
export async function getTodaysSet() {
  const supa = userClient();
  const { data, error } = await supa
    .from('puzzles')
    .select('id,number,name,difficulty,definition,world_best,play_date,set_position')
    .eq('play_date', todayUTC())
    .order('set_position', { ascending: true });
  if (error || !data || !data.length) return null;
  return data.map((row: any) => {
    const def = { ...row.definition }; delete def.ghosts;
    return { id: row.id, number: row.number, name: row.name, difficulty: row.difficulty,
             world_best: row.world_best, set_position: row.set_position, definition: def };
  });
}

// The player's progress through today's set (solved_count, total_ink, completed).
export async function getTodaysProgress(userId: string | null) {
  if (!userId) return { solved_count: 0, total_ink: 0, completed: false, solvedInk: {} as Record<string, number> };
  const supa = userClient();
  const { data: prog } = await supa.from('daily_progress')
    .select('solved_count,total_ink,completed').eq('user_id', userId).eq('play_date', todayUTC()).maybeSingle();
  // which specific puzzles they've solved (for showing per-puzzle ink + the share card)
  const { data: today } = await supa.from('puzzles').select('id').eq('play_date', todayUTC());
  const ids = (today ?? []).map((r: any) => r.id);
  const solvedInk: Record<string, number> = {};
  if (ids.length) {
    const { data: mine } = await supa.from('solutions').select('puzzle_id,ink').eq('user_id', userId).in('puzzle_id', ids);
    for (const r of mine ?? []) solvedInk[(r as any).puzzle_id] = (r as any).ink;
  }
  return {
    solved_count: prog?.solved_count ?? 0,
    total_ink: prog?.total_ink ?? 0,
    completed: prog?.completed ?? false,
    solvedInk
  };
}
