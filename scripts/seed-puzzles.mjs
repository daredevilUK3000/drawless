// node scripts/seed-puzzles.mjs
// Loads data/puzzles.json into the `puzzles` table and assigns each a sequential
// daily play_date starting tomorrow (UTC). Re-running updates definitions in place.
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the env.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const supa = createClient(url, key, { auth: { persistSession: false } });

const puzzles = JSON.parse(readFileSync(new URL('../data/puzzles.json', import.meta.url)));

// Order: keep the catalogue's order; you can curate this array to set the daily sequence.
function dateNDaysFromNow(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

let i = 0;
for (const p of puzzles) {
  const worldBest = Math.min(...p.ghosts.map(g => {
    let L = 0; for (let k = 1; k < g.pts.length; k++) L += Math.hypot(g.pts[k][0]-g.pts[k-1][0], g.pts[k][1]-g.pts[k-1][1]);
    return Math.round(L);
  }));
  const row = {
    id: p.id,
    number: p.number,
    name: p.name,
    difficulty: p.difficulty,
    definition: p,                      // store the whole puzzle object
    world_best: worldBest,
    play_date: dateNDaysFromNow(i + 1)  // first puzzle goes live tomorrow
  };
  const { error } = await supa.from('puzzles').upsert(row, { onConflict: 'id' });
  if (error) { console.error('Failed', p.id, error.message); }
  else { console.log('seeded', p.id, p.name, '->', row.play_date); }
  i++;
}
console.log(`\nDone. ${puzzles.length} puzzles seeded; daily rotation runs ${puzzles.length} days.`);
