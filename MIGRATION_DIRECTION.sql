-- Run once in Supabase SQL Editor, then verify existing RLS protects games UPDATE.
-- Do not weaken or disable Row Level Security.
alter table public.games add column if not exists home_attacks_left_first_half boolean not null default true;
-- If your project already has a realtime publication for games, ensure games updates are enabled there.
