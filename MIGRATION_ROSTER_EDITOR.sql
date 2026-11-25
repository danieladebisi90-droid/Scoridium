-- STAGING FIRST. Create safe role-checked roster writes, preserving old game events.
-- Adds `active` if not already present. Does not delete player records.
alter table public.players add column if not exists active boolean not null default true;
create or replace function public.scoridium_manage_player(
 p_team_id uuid,p_player_id uuid,p_action text,p_first_name text,p_last_name text,p_number integer
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_id uuid;
begin
 if v_uid is null or not exists(select 1 from public.team_members tm where tm.team_id=p_team_id and tm.user_id=v_uid and tm.role in ('head_coach','coach','assistant_coach','manager')) then
  raise exception 'Not authorized to edit this roster';
 end if;
 if p_action not in ('save','archive') then raise exception 'Unknown roster action';end if;
 if p_action='archive' then
  if p_player_id is null then raise exception 'Select a player';end if;
  update public.players set active=false where id=p_player_id and team_id=p_team_id returning id into v_id;
  if v_id is null then raise exception 'Player not found';end if;
  return v_id;
 end if;
 if length(trim(coalesce(p_first_name,''))) not between 1 and 100 or length(trim(coalesce(p_last_name,''))) not between 1 and 100 or p_number not between 0 and 999 then raise exception 'Valid name and jersey number required';end if;
 if p_player_id is null then
  insert into public.players(team_id,first_name,last_name,number,active)
  values(p_team_id,trim(p_first_name),trim(p_last_name),p_number,true) returning id into v_id;
 else
  update public.players set first_name=trim(p_first_name),last_name=trim(p_last_name),number=p_number
  where id=p_player_id and team_id=p_team_id returning id into v_id;
  if v_id is null then raise exception 'Player not found';end if;
 end if;
 return v_id;
end;$$;
revoke all on function public.scoridium_manage_player(uuid,uuid,text,text,text,integer) from public,anon;
grant execute on function public.scoridium_manage_player(uuid,uuid,text,text,text,integer) to authenticated;
