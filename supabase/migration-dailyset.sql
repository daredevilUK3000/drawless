-- Migration: daily SET of puzzles (instead of one per day).
-- Run in the Supabase SQL editor AFTER the premium migration.
--
-- Model: many puzzles share the same play_date, distinguished by set_position (1..N).
-- The unique index on play_date is replaced by a unique (play_date, set_position).

-- 1) drop the old one-per-day uniqueness on play_date
drop index if exists puzzles_play_date_key;          -- the implicit unique from "play_date date unique"
alter table puzzles drop constraint if exists puzzles_play_date_key;

-- 2) add position within the day's set
alter table puzzles add column if not exists set_position int not null default 1;

-- 3) a given day can't have two puzzles in the same slot
create unique index if not exists puzzles_day_slot_unique on puzzles(play_date, set_position);
create index if not exists puzzles_play_date_idx2 on puzzles(play_date);

-- 4) track per-user progress through a day's set (which positions are solved, total ink)
create table if not exists daily_progress (
  user_id     uuid not null references auth.users(id) on delete cascade,
  play_date   date not null,
  solved_count int not null default 0,        -- how many of the set solved (also = next unlocked index - 1)
  total_ink   int not null default 0,         -- sum of verified ink across solved puzzles in the set
  completed   boolean not null default false, -- all puzzles in the set solved
  updated_at  timestamptz not null default now(),
  primary key (user_id, play_date)
);
alter table daily_progress enable row level security;
drop policy if exists daily_progress_self on daily_progress;
create policy daily_progress_self on daily_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5) daily-set leaderboard: total ink across the set, per user, only for COMPLETED sets
create or replace view daily_leaderboard as
  select dp.play_date, dp.total_ink, dp.solved_count, dp.completed,
         coalesce(p.display_name, 'anonymous') as display_name, p.country
  from daily_progress dp
  left join profiles p on p.user_id = dp.user_id;
