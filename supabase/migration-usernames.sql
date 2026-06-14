-- Migration: unique usernames.
-- Run this in the Supabase SQL editor AFTER the main schema.
-- Adds a case-insensitive unique constraint on profiles.display_name so two
-- players can never hold the same username (even racing at the same instant).

-- case-insensitive uniqueness: unique index on lower(display_name), ignoring nulls
create unique index if not exists profiles_username_unique
  on profiles (lower(display_name))
  where display_name is not null;

-- (RLS already lets a user update their own profile row, so claiming a name
--  is just an UPDATE on their own row — enforced by the existing profiles_self policy.)
