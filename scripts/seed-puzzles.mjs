// node --env-file=.env.local scripts/seed-puzzles.mjs
// Loads data/puzzles.json and schedules them as DAILY SETS of SET_SIZE puzzles,
// each day ordered as a difficulty arc (easy -> harder by set_position).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const SET_SIZE = 5;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const supa = createClient(url, key, { auth: { persistSession: false } });

const all = JSON.parse(readFileSync(new URL('../data/puzzles.json', import.meta.url)));

// difficulty rank for ordering within a day's arc
const RANK = { 'easy':0,'easy-medium':1,'medium':2,'medium-hard':3,'hard':4,'grand-master':5 };
function inkOf(g){ let L=0; for(let i=1;i<g.pts.length;i++) L+=Math.hypot(g.pts[i][0]-g.pts[i-1][0], g.pts[i][1]-g.pts[i-1][1]); return Math.round(L); }
function dateNDaysFromNow(n){ const d=new Date(); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }

// Build balanced days: try to give each day an easy->hard spread rather than
// dumping all easies in week one. Simple approach: bucket by difficulty, then
// round-robin draw one from increasing difficulty tiers into each day's 5 slots.
const byTier = {};
for (const p of all) { (byTier[p.difficulty] ??= []).push(p); }
const tierOrder = Object.keys(RANK).sort((a,b)=>RANK[a]-RANK[b]).filter(t=>byTier[t]?.length);

// flatten into a sequence that cycles tiers so days get a mix
const sequence = [];
let remaining = all.length;
const cursors = Object.fromEntries(tierOrder.map(t=>[t,0]));
while (remaining > 0) {
  for (const t of tierOrder) {
    if (cursors[t] < byTier[t].length) { sequence.push(byTier[t][cursors[t]++]); remaining--; }
  }
}

let day = 0, slot = 0;
for (let i = 0; i < sequence.length; i++) {
  const p = sequence[i];
  // within each day, order by difficulty so set_position is an arc
  // (we assign sequentially here, then fix order per-day below)
  const playDate = dateNDaysFromNow(day + 1);
  const worldBest = Math.min(...p.ghosts.map(inkOf));
  // temp set_position; corrected in the per-day reorder pass after upload
  const row = { id:p.id, number:p.number, name:p.name, difficulty:p.difficulty, definition:p, world_best:worldBest, play_date:playDate, set_position: slot+1 };
  const { error } = await supa.from('puzzles').upsert(row, { onConflict:'id' });
  if (error) console.error('Failed', p.id, error.message);
  slot++;
  if (slot >= SET_SIZE) { slot = 0; day++; }
}

// Per-day reorder: set_position should follow difficulty (easy first).
const days = [...new Set(sequence.map((_,i)=>dateNDaysFromNow(Math.floor(i/SET_SIZE)+1)))];
for (const d of days) {
  const { data: dayPuzzles } = await supa.from('puzzles').select('id,difficulty').eq('play_date', d);
  if (!dayPuzzles) continue;
  dayPuzzles.sort((a,b)=> (RANK[a.difficulty]??9)-(RANK[b.difficulty]??9));
  for (let k=0;k<dayPuzzles.length;k++) {
    await supa.from('puzzles').update({ set_position: k+1 }).eq('id', dayPuzzles[k].id);
  }
}

const totalDays = Math.ceil(sequence.length / SET_SIZE);
console.log(`\nDone. ${sequence.length} puzzles -> ${totalDays} daily sets of up to ${SET_SIZE}.`);
console.log(`First set goes live ${dateNDaysFromNow(1)} (UTC).`);
