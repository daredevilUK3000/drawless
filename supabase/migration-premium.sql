-- Migration: premium (lifetime) unlock + streak-freeze tokens.
-- Run in the Supabase SQL editor AFTER the username migration.

alter table profiles add column if not exists is_premium boolean not null default false;
alter table profiles add column if not exists premium_since timestamptz;
alter table profiles add column if not exists gumroad_license text;          -- the verified key (for support/audit)
alter table profiles add column if not exists streak_freezes int not null default 0;  -- unused tokens
alter table profiles add column if not exists last_freeze_grant date;          -- when we last topped up freezes

-- one licence key can only unlock one account
create unique index if not exists profiles_gumroad_license_unique
  on profiles (gumroad_license) where gumroad_license is not null;
