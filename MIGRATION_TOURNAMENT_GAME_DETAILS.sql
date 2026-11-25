-- Run after MIGRATION_TOURNAMENTS.sql.
alter table public.scoridium_tournament_matches add column if not exists scheduled_on date;
alter table public.scoridium_tournament_matches add column if not exists venue text;
