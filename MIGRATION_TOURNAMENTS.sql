-- Scoridium tournament schedule / results (review on a staging Supabase project first).
-- Uses authenticated team membership for reads; writes require authorized staff or a
-- narrowly scoped tournament helper. No public/anonymous write policies.
create table if not exists public.scoridium_tournaments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  name text not null default 'Tournament' check (char_length(name) between 1 and 120),
  starts_on date not null,
  ends_on date not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 30)
);
create index if not exists scoridium_tournament_dates on public.scoridium_tournaments(team_id,season_id,starts_on,ends_on);

create table if not exists public.scoridium_tournament_helpers (
  tournament_id uuid not null references public.scoridium_tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  can_edit_results boolean not null default true,
  granted_by uuid not null references auth.users(id),
  primary key(tournament_id,user_id)
);

create table if not exists public.scoridium_tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.scoridium_tournaments(id) on delete cascade,
  round_name text,
  team_a text not null default 'TBD',
  team_b text not null default 'TBD',
  scheduled_at timestamptz,
  score_a integer check (score_a between 0 and 400),
  score_b integer check (score_b between 0 and 400),
  result_status text not null default 'unconfirmed' check (result_status in ('unconfirmed','confirmed')),
  source_note text,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((score_a is null and score_b is null) or (score_a is not null and score_b is not null))
);
create index if not exists scoridium_tournament_matches_by_tournament on public.scoridium_tournament_matches(tournament_id);

-- SECURITY DEFINER checks avoid recursive RLS when evaluating helper permissions.
create or replace function public.scoridium_can_view_tournament(p_tournament uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.scoridium_tournaments t
    where t.id=p_tournament and (
      exists (select 1 from public.team_members tm where tm.team_id=t.team_id and tm.user_id=(select auth.uid()))
      or exists (select 1 from public.scoridium_tournament_helpers h where h.tournament_id=t.id and h.user_id=(select auth.uid()))
    )
  );
$$;
create or replace function public.scoridium_can_edit_tournament(p_tournament uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.scoridium_tournaments t where t.id=p_tournament and (
      exists (select 1 from public.team_members tm where tm.team_id=t.team_id and tm.user_id=(select auth.uid()) and tm.role in ('head_coach','coach','assistant_coach','manager'))
      or exists (select 1 from public.scoridium_tournament_helpers h where h.tournament_id=t.id and h.user_id=(select auth.uid()) and h.can_edit_results)
    )
  );
$$;
revoke all on function public.scoridium_can_view_tournament(uuid) from public;
revoke all on function public.scoridium_can_edit_tournament(uuid) from public;
grant execute on function public.scoridium_can_view_tournament(uuid) to authenticated;
grant execute on function public.scoridium_can_edit_tournament(uuid) to authenticated;

alter table public.scoridium_tournaments enable row level security;
alter table public.scoridium_tournament_matches enable row level security;
alter table public.scoridium_tournament_helpers enable row level security;

create policy "Members view tournaments" on public.scoridium_tournaments for select to authenticated
  using (public.scoridium_can_view_tournament(id));
create policy "Staff create tournaments" on public.scoridium_tournaments for insert to authenticated
  with check (created_by=(select auth.uid()) and exists (
    select 1 from public.team_members tm where tm.team_id=team_id and tm.user_id=(select auth.uid())
      and tm.role in ('head_coach','coach','assistant_coach','manager')
  ));
create policy "Staff modify tournaments" on public.scoridium_tournaments for update to authenticated
  using (public.scoridium_can_edit_tournament(id)) with check (public.scoridium_can_edit_tournament(id));
create policy "Staff delete tournaments" on public.scoridium_tournaments for delete to authenticated
  using (exists (select 1 from public.team_members tm where tm.team_id=team_id and tm.user_id=(select auth.uid()) and tm.role in ('head_coach','coach','assistant_coach','manager')));

create policy "View tournament games" on public.scoridium_tournament_matches for select to authenticated
  using (public.scoridium_can_view_tournament(tournament_id));
create policy "Add tournament games" on public.scoridium_tournament_matches for insert to authenticated
  with check (updated_by=(select auth.uid()) and public.scoridium_can_edit_tournament(tournament_id));
create policy "Edit tournament games" on public.scoridium_tournament_matches for update to authenticated
  using (public.scoridium_can_edit_tournament(tournament_id)) with check (updated_by=(select auth.uid()) and public.scoridium_can_edit_tournament(tournament_id));
create policy "Delete tournament games" on public.scoridium_tournament_matches for delete to authenticated
  using (public.scoridium_can_edit_tournament(tournament_id));

create policy "View tournament helper grants" on public.scoridium_tournament_helpers for select to authenticated
  using (user_id=(select auth.uid()) or public.scoridium_can_edit_tournament(tournament_id));
create policy "Staff grant tournament helpers" on public.scoridium_tournament_helpers for insert to authenticated
  with check (granted_by=(select auth.uid()) and exists (
    select 1 from public.scoridium_tournaments t join public.team_members tm on tm.team_id=t.team_id
    where t.id=tournament_id and tm.user_id=(select auth.uid()) and tm.role in ('head_coach','coach','assistant_coach','manager')
  ));
create policy "Staff revoke tournament helpers" on public.scoridium_tournament_helpers for delete to authenticated
  using (exists (
    select 1 from public.scoridium_tournaments t join public.team_members tm on tm.team_id=t.team_id
    where t.id=tournament_id and tm.user_id=(select auth.uid()) and tm.role in ('head_coach','coach','assistant_coach','manager')
  ));
