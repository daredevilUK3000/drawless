-- DrawLess database schema (Supabase / Postgres)
-- Run this in the Supabase SQL editor, or via the Supabase CLI.
-- Design notes:
--   * The SERVER is authoritative: scores are only written by /api/solve after
--     it re-simulates the submitted line. The browser never writes its own score.
--   * Row-Level Security (RLS) is ON everywhere. The service-role key (server only)
--     bypasses RLS to write verified results; the anon key can only read.

-- ---------- PUZZLES ----------
-- One row per daily puzzle. `play_date` is the UTC date it's the active daily.
-- `definition` is the exact puzzle JSON your validator/game consume.
create table if not exists puzzles (
  id            text primary key,                 -- e.g. 'f-024'
  number        int  not null,                    -- DrawLess #N (display)
  play_date     date unique,                      -- the day it's live (UTC). null = in the bank, not yet scheduled
  name          text not null,
  difficulty    text not null,
  definition    jsonb not null,                   -- {world, ball, bodies, goal, hint, stats, ghosts}
  world_best    int,                              -- shortest verified ink (seeded, updated as players beat it)
  created_at    timestamptz not null default now()
);
create index if not exists puzzles_play_date_idx on puzzles(play_date);

-- ---------- SOLUTIONS ----------
-- One row per player per puzzle = their FIRST verified solve (official score).
-- The raw line points are stored so we can render ghost replays.
create table if not exists solutions (
  id            uuid primary key default gen_random_uuid(),
  puzzle_id     text not null references puzzles(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  ink           int  not null,                    -- server-verified pixel length
  line          jsonb not null,                   -- array of [x,y] points (for ghost replay)
  created_at    timestamptz not null default now(),
  unique (puzzle_id, user_id)                      -- first solve is final; enforced here
);
create index if not exists solutions_puzzle_ink_idx on solutions(puzzle_id, ink);

-- ---------- PROFILES ----------
-- Per-user streak + display data. Mirrors auth.users 1:1.
create table if not exists profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  display_name   text,
  country        text,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_play_date date,
  created_at     timestamptz not null default now()
);

-- ---------- ROW LEVEL SECURITY ----------
alter table puzzles   enable row level security;
alter table solutions enable row level security;
alter table profiles  enable row level security;

-- Puzzles: anyone may read the puzzle that is live today or earlier (no future spoilers).
drop policy if exists puzzles_read on puzzles;
create policy puzzles_read on puzzles
  for select using (play_date is not null and play_date <= (now() at time zone 'utc')::date);

-- Solutions: a user may read all solutions (for the leaderboard + ghosts),
-- but may only INSERT their own — and the server enforces verification anyway.
drop policy if exists solutions_read on solutions;
create policy solutions_read on solutions for select using (true);
drop policy if exists solutions_insert_self on solutions;
create policy solutions_insert_self on solutions
  for insert with check (auth.uid() = user_id);

-- Profiles: a user reads/updates only their own; everyone can read display_name+streak
-- for the leaderboard via a view (below) rather than the raw table.
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- LEADERBOARD VIEW ----------
-- Public, read-only ranking for a puzzle: ink + display name, no private fields.
create or replace view leaderboard as
  select s.puzzle_id, s.ink, s.line, s.created_at,
         coalesce(p.display_name, 'anonymous') as display_name,
         p.country
  from solutions s
  left join profiles p on p.user_id = s.user_id;

-- ---------- AUTO-CREATE PROFILE ON SIGNUP ----------
create or replace function handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();
