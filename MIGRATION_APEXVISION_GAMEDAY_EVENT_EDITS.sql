-- TEST PROJECT ONLY. Apply after POSTGAME_TRACKING and COMBINED_SHOT_EDIT.
-- Edit or delete post-game recorded non-shot events; never alter official live scores.
BEGIN;
CREATE OR REPLACE FUNCTION public.apexvision_postgame_edit_event(
 p_game_id uuid, p_event_id uuid, p_expected_version integer,
 p_type text, p_team text, p_period integer, p_player_id uuid,
 p_made boolean, p_linked_event_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE original public.game_events%ROWTYPE;
 game_before public.games%ROWTYPE;game_after public.games%ROWTYPE;
 parent public.game_events%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT private.apexvision_can_postgame_track(p_game_id) THEN
   RAISE EXCEPTION 'Not authorized to edit game'; END IF;
 SELECT * INTO game_before FROM public.games WHERE id=p_game_id FOR UPDATE;
 IF NOT FOUND OR game_before.status<>'completed' THEN RAISE EXCEPTION 'Completed game required'; END IF;
 SELECT * INTO original FROM public.game_events WHERE id=p_event_id AND game_id=p_game_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.apexvision_postgame_entries
  WHERE game_id=p_game_id AND event_id=p_event_id) THEN
  RAISE EXCEPTION 'Only Film Room recorded events may be edited'; END IF;
 IF original.type='shot' THEN RAISE EXCEPTION 'Use Edit Shot for field goals'; END IF;
 IF original.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Event changed; refresh and retry'; END IF;
 IF p_team NOT IN ('us','opponent') OR p_period IS NULL OR p_period<1 OR
  p_period>GREATEST(4,COALESCE(game_before.current_period,4)) THEN
  RAISE EXCEPTION 'Invalid team or quarter'; END IF;
 IF p_player_id IS NOT NULL AND (p_team<>'us' OR NOT EXISTS(
  SELECT 1 FROM public.players WHERE id=p_player_id AND team_id=game_before.team_id)) THEN
  RAISE EXCEPTION 'Player must be on the tracked team'; END IF;
 IF p_type NOT IN ('free_throw','assist','offensive_rebound','defensive_rebound',
  'team_offensive_rebound','team_defensive_rebound','steal','turnover','block','foul') THEN
  RAISE EXCEPTION 'Unsupported event type'; END IF;
 IF p_type IN ('team_offensive_rebound','team_defensive_rebound')
  AND p_player_id IS NOT NULL THEN
  RAISE EXCEPTION 'A team rebound cannot be assigned to a player'; END IF;
 IF p_type='free_throw' THEN
  IF p_made IS NULL THEN RAISE EXCEPTION 'Free throw needs MADE/MISSED result'; END IF;
 ELSIF p_made IS NOT NULL THEN RAISE EXCEPTION 'Only free throws have a MADE/MISSED result'; END IF;
 IF EXISTS(SELECT 1 FROM public.game_events e WHERE e.game_id=p_game_id AND
  e.linked_event_id=p_event_id) AND (original.type IS DISTINCT FROM p_type OR
  original.team IS DISTINCT FROM p_team OR original.period IS DISTINCT FROM p_period OR
  (original.type='free_throw' AND original.made IS DISTINCT FROM p_made)) THEN
  RAISE EXCEPTION 'This event has dependents. Edit linked records first'; END IF;
 IF p_linked_event_id IS NOT NULL THEN
  IF p_linked_event_id=p_event_id THEN RAISE EXCEPTION 'Event cannot link to itself'; END IF;
  SELECT * INTO parent FROM public.game_events WHERE id=p_linked_event_id
   AND game_id=p_game_id FOR SHARE;
  IF NOT FOUND OR parent.period<>p_period THEN RAISE EXCEPTION 'Linked event missing or in another quarter'; END IF;
  IF parent.linked_event_id=p_event_id THEN RAISE EXCEPTION 'Circular event link'; END IF;
  IF NOT (
    (parent.type='shot' AND p_type IN ('assist','offensive_rebound','defensive_rebound',
       'team_offensive_rebound','team_defensive_rebound','block')) OR
    (parent.type='free_throw' AND p_type IN ('offensive_rebound','defensive_rebound',
       'team_offensive_rebound','team_defensive_rebound','block')) OR
    (parent.type='foul' AND p_type IN ('free_throw','turnover')) OR
    (parent.type='steal' AND p_type='turnover') OR
    (parent.type='turnover' AND p_type='steal')
  ) THEN RAISE EXCEPTION 'Invalid linked event relationship'; END IF;
  IF p_type='assist' AND (parent.type<>'shot' OR parent.made IS DISTINCT FROM true OR parent.team<>p_team)
   THEN RAISE EXCEPTION 'Assists require a made shot for the same team'; END IF;
  IF p_type='block' AND (parent.type<>'shot' OR parent.made IS DISTINCT FROM false OR parent.team=p_team)
   THEN RAISE EXCEPTION 'Blocks require a missed opponent shot'; END IF;
  IF p_type IN ('offensive_rebound','defensive_rebound','team_offensive_rebound','team_defensive_rebound') AND
    (parent.type NOT IN ('shot','free_throw') OR parent.made IS DISTINCT FROM false OR
    (p_type IN ('offensive_rebound','team_offensive_rebound') AND parent.team<>p_team) OR
    (p_type IN ('defensive_rebound','team_defensive_rebound') AND parent.team=p_team)) THEN
   RAISE EXCEPTION 'Rebound team/type incompatible with missed shot or FT'; END IF;
 END IF;
 UPDATE public.game_events SET type=p_type,team=p_team,period=p_period,player_id=p_player_id,
  points=CASE WHEN p_type='free_throw' THEN 1 ELSE NULL END,
  made=CASE WHEN p_type='free_throw' THEN p_made ELSE NULL END,
  x=NULL,y=NULL,distance_meters=NULL,distance_feet=NULL,
  linked_event_id=p_linked_event_id, version=version+1
 WHERE id=p_event_id AND game_id=p_game_id;
 SELECT * INTO game_after FROM public.games WHERE id=p_game_id;
 IF game_after.status IS DISTINCT FROM game_before.status OR
  game_after.team_score IS DISTINCT FROM game_before.team_score OR
  game_after.opponent_score IS DISTINCT FROM game_before.opponent_score THEN
  RAISE EXCEPTION 'Official live result changed; edit rolled back'; END IF;
 RETURN p_event_id;
END;$$;
CREATE OR REPLACE FUNCTION public.apexvision_postgame_delete_event(
 p_game_id uuid,p_event_id uuid,p_expected_version integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE original public.game_events%ROWTYPE; game_before public.games%ROWTYPE;
 game_after public.games%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT private.apexvision_can_postgame_track(p_game_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO game_before FROM public.games WHERE id=p_game_id FOR UPDATE;
 IF NOT FOUND OR game_before.status<>'completed' THEN RAISE EXCEPTION 'Completed game required'; END IF;
 SELECT * INTO original FROM public.game_events WHERE id=p_event_id AND game_id=p_game_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.apexvision_postgame_entries
  WHERE game_id=p_game_id AND event_id=p_event_id) THEN
  RAISE EXCEPTION 'Only Film Room events may be deleted'; END IF;
 IF original.type='shot' THEN RAISE EXCEPTION 'Use Delete Shot for field goals'; END IF;
 IF original.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Event changed; refresh'; END IF;
 IF EXISTS(SELECT 1 FROM public.game_events WHERE game_id=p_game_id AND linked_event_id=p_event_id) THEN
  RAISE EXCEPTION 'Event has dependents; resolve them first'; END IF;
 DELETE FROM public.apexvision_postgame_entries WHERE game_id=p_game_id AND event_id=p_event_id;
 DELETE FROM public.game_events WHERE id=p_event_id AND game_id=p_game_id;
 SELECT * INTO game_after FROM public.games WHERE id=p_game_id;
 IF game_after.team_score IS DISTINCT FROM game_before.team_score OR
  game_after.opponent_score IS DISTINCT FROM game_before.opponent_score OR
  game_after.status IS DISTINCT FROM game_before.status THEN
  RAISE EXCEPTION 'Official game result changed; delete rolled back'; END IF;
 RETURN p_event_id;
END;$$;
-- Confirmed invalid links are removed in the same database transaction as the shot edit.
CREATE OR REPLACE FUNCTION public.apexvision_postgame_edit_shot_with_links(
 p_game_id uuid,p_event_id uuid,p_expected_version integer,
 p_team text,p_player_id uuid,p_made boolean,p_x numeric,p_y numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE original public.game_events%ROWTYPE;child public.game_events%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT private.apexvision_can_postgame_track(p_game_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO original FROM public.game_events WHERE id=p_event_id AND game_id=p_game_id FOR UPDATE;
 IF NOT FOUND OR original.type<>'shot' OR original.version IS DISTINCT FROM p_expected_version THEN
  RAISE EXCEPTION 'Shot changed or missing; refresh'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.apexvision_postgame_entries WHERE game_id=p_game_id AND event_id=p_event_id) THEN
  RAISE EXCEPTION 'Only Film Room shots may be edited'; END IF;
 FOR child IN SELECT * FROM public.game_events WHERE game_id=p_game_id
  AND linked_event_id=p_event_id FOR UPDATE LOOP
  IF (child.type='assist' AND (NOT p_made OR child.team<>p_team)) OR
     (child.type='block' AND (p_made OR child.team=p_team)) OR
     (child.type IN ('offensive_rebound','defensive_rebound','team_offensive_rebound','team_defensive_rebound') AND p_made) THEN
    IF NOT EXISTS(SELECT 1 FROM public.apexvision_postgame_entries
      WHERE game_id=p_game_id AND event_id=child.id) OR EXISTS(
       SELECT 1 FROM public.game_events WHERE game_id=p_game_id AND linked_event_id=child.id) THEN
      RAISE EXCEPTION 'Incompatible link has protected or dependent events; cannot clean up automatically'; END IF;
    DELETE FROM public.apexvision_postgame_entries WHERE game_id=p_game_id AND event_id=child.id;
    DELETE FROM public.game_events WHERE game_id=p_game_id AND id=child.id;
  END IF;
 END LOOP;
 RETURN public.apexvision_postgame_edit_shot(p_game_id,p_event_id,p_expected_version,
  p_team,p_player_id,p_made,p_x,p_y);
END;$$;
REVOKE ALL ON FUNCTION public.apexvision_postgame_edit_event(uuid,uuid,integer,text,text,integer,uuid,boolean,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.apexvision_postgame_delete_event(uuid,uuid,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.apexvision_postgame_edit_shot_with_links(uuid,uuid,integer,text,uuid,boolean,numeric,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apexvision_postgame_edit_event(uuid,uuid,integer,text,text,integer,uuid,boolean,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apexvision_postgame_delete_event(uuid,uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apexvision_postgame_edit_shot_with_links(uuid,uuid,integer,text,uuid,boolean,numeric,numeric) TO authenticated;
COMMIT;

-- Non-counting field-goal observations: a missed attempt on a shooting foul
-- is visible on the court but must not count toward FGA / 3PA.
BEGIN;
CREATE TABLE IF NOT EXISTS public.apexvision_postgame_foul_shots (
 event_id uuid PRIMARY KEY REFERENCES public.game_events(id) ON DELETE CASCADE,
 game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS apexvision_postgame_foul_shots_game_idx
 ON public.apexvision_postgame_foul_shots(game_id);
ALTER TABLE public.apexvision_postgame_foul_shots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apexvision_foul_shots_read ON public.apexvision_postgame_foul_shots;
CREATE POLICY apexvision_foul_shots_read ON public.apexvision_postgame_foul_shots
 FOR SELECT TO authenticated USING (private.apexvision_can_postgame_track(game_id));
GRANT SELECT ON public.apexvision_postgame_foul_shots TO authenticated;
CREATE OR REPLACE FUNCTION public.apexvision_postgame_mark_foul_shot(
 p_game_id uuid,p_event_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE shot public.game_events%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT private.apexvision_can_postgame_track(p_game_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO shot FROM public.game_events WHERE id=p_event_id AND game_id=p_game_id FOR UPDATE;
 IF NOT FOUND OR shot.type<>'shot' OR shot.made IS DISTINCT FROM false OR NOT EXISTS(
  SELECT 1 FROM public.apexvision_postgame_entries WHERE game_id=p_game_id AND event_id=p_event_id
 ) THEN RAISE EXCEPTION 'Only a missed Film Room shot can be marked non-counting'; END IF;
 INSERT INTO public.apexvision_postgame_foul_shots(event_id,game_id)
 VALUES(p_event_id,p_game_id) ON CONFLICT(event_id) DO NOTHING;
 RETURN p_event_id;
END;$$;
REVOKE ALL ON FUNCTION public.apexvision_postgame_mark_foul_shot(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apexvision_postgame_mark_foul_shot(uuid,uuid) TO authenticated;
COMMIT;

-- Unified shot correction: result, team, shooter, location, quarter,
-- and linked children. All operations are in one transaction.
BEGIN;
CREATE OR REPLACE FUNCTION public.apexvision_postgame_edit_shot_gameday(
 p_game_id uuid,p_event_id uuid,p_expected_version integer,p_team text,
 p_player_id uuid,p_made boolean,p_x numeric,p_y numeric,p_period integer,
 p_confirm_cleanup boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE original public.game_events%ROWTYPE; child public.game_events%ROWTYPE;
 v_game public.games%ROWTYPE; will_remove boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT private.apexvision_can_postgame_track(p_game_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO v_game FROM public.games WHERE id=p_game_id FOR UPDATE;
 IF NOT FOUND OR v_game.status<>'completed' THEN RAISE EXCEPTION 'Completed game required'; END IF;
 IF p_period IS NULL OR p_period<1 OR p_period>GREATEST(4,COALESCE(v_game.current_period,4)) THEN
  RAISE EXCEPTION 'Invalid quarter'; END IF;
 SELECT * INTO original FROM public.game_events WHERE id=p_event_id AND game_id=p_game_id FOR UPDATE;
 IF NOT FOUND OR original.type<>'shot' OR original.version IS DISTINCT FROM p_expected_version OR
  NOT EXISTS(SELECT 1 FROM public.apexvision_postgame_entries WHERE game_id=p_game_id AND event_id=p_event_id) THEN
  RAISE EXCEPTION 'Shot missing, protected or changed; refresh'; END IF;
 IF original.linked_event_id IS NOT NULL AND p_period<>original.period THEN
  RAISE EXCEPTION 'This shot has a parent link. Edit the related play before changing quarter'; END IF;
 -- Read and lock all direct child events before changing the parent.
 FOR child IN SELECT * FROM public.game_events WHERE game_id=p_game_id
  AND linked_event_id=p_event_id FOR UPDATE LOOP
  will_remove :=
    (child.type='assist' AND (NOT p_made OR child.team<>p_team)) OR
    (child.type='block' AND (p_made OR child.team=p_team)) OR
    (child.type IN ('offensive_rebound','defensive_rebound',
     'team_offensive_rebound','team_defensive_rebound') AND
       (p_made OR (child.type IN ('offensive_rebound','team_offensive_rebound') AND child.team<>p_team)
        OR (child.type IN ('defensive_rebound','team_defensive_rebound') AND child.team=p_team)));
  IF will_remove AND NOT p_confirm_cleanup THEN
   RAISE EXCEPTION 'Linked stats would become invalid. Confirm removal before saving'; END IF;
  IF will_remove OR p_period<>original.period THEN
   IF NOT EXISTS(SELECT 1 FROM public.apexvision_postgame_entries
       WHERE game_id=p_game_id AND event_id=child.id) THEN
    RAISE EXCEPTION 'Linked event is not a Film Room entry and cannot be changed'; END IF;
  END IF;
  IF will_remove THEN
   IF EXISTS(SELECT 1 FROM public.game_events WHERE game_id=p_game_id AND linked_event_id=child.id)
   THEN RAISE EXCEPTION 'Linked event has dependents; resolve them first'; END IF;
   DELETE FROM public.apexvision_postgame_entries WHERE game_id=p_game_id AND event_id=child.id;
   DELETE FROM public.game_events WHERE game_id=p_game_id AND id=child.id;
  ELSIF p_period<>original.period THEN
   UPDATE public.game_events SET period=p_period,version=version+1
     WHERE game_id=p_game_id AND id=child.id;
  END IF;
 END LOOP;
 PERFORM public.apexvision_postgame_edit_shot(p_game_id,p_event_id,p_expected_version,
   p_team,p_player_id,p_made,p_x,p_y);
 UPDATE public.game_events SET period=p_period WHERE game_id=p_game_id AND id=p_event_id;
 IF p_made THEN
  DELETE FROM public.apexvision_postgame_foul_shots
   WHERE game_id=p_game_id AND event_id=p_event_id;
 END IF;
 RETURN p_event_id;
END;$$;
REVOKE ALL ON FUNCTION public.apexvision_postgame_edit_shot_gameday(uuid,uuid,integer,text,uuid,boolean,numeric,numeric,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apexvision_postgame_edit_shot_gameday(uuid,uuid,integer,text,uuid,boolean,numeric,numeric,integer,boolean) TO authenticated;
COMMIT;
