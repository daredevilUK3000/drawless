-- Migration: per-user theme preference.
-- Run in the Supabase SQL editor after the daily-set migration.
alter table profiles add column if not exists theme text default 'daylight';
