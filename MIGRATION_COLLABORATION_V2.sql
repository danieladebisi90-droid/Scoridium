-- Scoridium Collaborative Court v2. Run AFTER MIGRATION_COLLABORATION.sql.
-- Requires the existing private.can_track_game(uuid) authorization function used
-- by game_events RLS. This function covers coach membership OR explicitly granted
-- game/season tracker permissions; do not make game events public.
BEGIN;
ALTER TABLE public.tracker_observations
  ADD COLUMN IF NOT EXISTS retracted_at timestamptz;
CREATE INDEX IF NOT EXISTS tracker_observations_active_game_idx
  ON public.tracker_observations(game_id,period,observed_at) WHERE retracted_at IS NULL;

DROP POLICY IF EXISTS tracker_observations_team_read ON public.tracker_observations;
CREATE POLICY tracker_observations_team_read ON public.tracker_observations
  FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL AND private.can_track_game(game_id));
DROP POLICY IF EXISTS tracker_observations_self_insert ON public.tracker_observations;
CREATE POLICY tracker_observations_self_insert ON public.tracker_observations
  FOR INSERT TO authenticated
  WITH CHECK (tracker_id=(select auth.uid()) AND private.can_track_game(game_id));

DROP POLICY IF EXISTS tracker_checkpoints_team_read ON public.tracker_checkpoints;
CREATE POLICY tracker_checkpoints_team_read ON public.tracker_checkpoints
  FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL AND private.can_track_game(game_id));
DROP POLICY IF EXISTS tracker_checkpoints_self_insert ON public.tracker_checkpoints;
CREATE POLICY tracker_checkpoints_self_insert ON public.tracker_checkpoints
  FOR INSERT TO authenticated
  WITH CHECK (tracker_id=(select auth.uid()) AND private.can_track_game(game_id));

DROP POLICY IF EXISTS tracker_event_observations_member_read ON public.tracker_event_observations;
CREATE POLICY tracker_event_observations_member_read ON public.tracker_event_observations
  FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL AND private.can_track_game(game_id));
DROP POLICY IF EXISTS tracker_event_observations_member_insert ON public.tracker_event_observations;
CREATE POLICY tracker_event_observations_member_insert ON public.tracker_event_observations
  FOR INSERT TO authenticated WITH CHECK (tracker_id=(select auth.uid()) AND private.can_track_game(game_id));

DROP POLICY IF EXISTS game_direction_changes_team_read ON public.game_direction_changes;
CREATE POLICY game_direction_changes_team_read ON public.game_direction_changes
 FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL AND private.can_track_game(game_id));

CREATE OR REPLACE FUNCTION public.scoridium_switch_basket_directions(p_game_id uuid)
RETURNS TABLE(home_attacks_left_first_half boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_direction boolean;period_no integer;new_direction boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_track_game(p_game_id) THEN
   RAISE EXCEPTION 'Not authorized for this game'; END IF;
 SELECT g.home_attacks_left_first_half,g.current_period
 INTO old_direction,period_no FROM public.games g WHERE g.id=p_game_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
 new_direction:=NOT old_direction;
 UPDATE public.games SET home_attacks_left_first_half=new_direction WHERE id=p_game_id;
 INSERT INTO public.game_direction_changes(game_id,tracker_id,period,
   previous_home_attacks_left_first_half,new_home_attacks_left_first_half)
 VALUES(p_game_id,auth.uid(),coalesce(period_no,1),old_direction,new_direction);
 RETURN QUERY SELECT new_direction;
END;$$;
REVOKE ALL ON FUNCTION public.scoridium_switch_basket_directions(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.scoridium_switch_basket_directions(uuid) TO authenticated;

-- Retract an *unmatched* observation created by the signed-in tracker.
-- Keep audit history and never touch canonical points/events.
CREATE OR REPLACE FUNCTION public.scoridium_retract_own_observation(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE row public.tracker_observations%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO row FROM public.tracker_observations
   WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Observation does not exist'; END IF;
 IF row.tracker_id<>auth.uid() OR NOT private.can_track_game(row.game_id) THEN
   RAISE EXCEPTION 'Not authorized'; END IF;
 IF row.matched_event_id IS NOT NULL THEN
   RAISE EXCEPTION 'Matched observations require review before correction'; END IF;
 UPDATE public.tracker_observations SET retracted_at=now()
   WHERE id=p_id AND retracted_at IS NULL;
 RETURN true;
END;$$;
REVOKE ALL ON FUNCTION public.scoridium_retract_own_observation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.scoridium_retract_own_observation(uuid) TO authenticated;

-- Re-define atomic linking to recognize authorized game-level tracking grants,
-- reject retracted observations and prevent one shot receiving two linked locations.
CREATE OR REPLACE FUNCTION public.scoridium_link_shot_observation(
 p_game_id uuid,p_observation_id uuid,p_event_id uuid,p_expected_version integer
) RETURNS TABLE(new_version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE obs public.tracker_observations%ROWTYPE;shot public.game_events%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_track_game(p_game_id) THEN
   RAISE EXCEPTION 'Not authorized for this game'; END IF;
 SELECT * INTO obs FROM public.tracker_observations
   WHERE id=p_observation_id AND game_id=p_game_id FOR UPDATE;
 IF NOT FOUND OR obs.kind<>'shot' OR obs.retracted_at IS NOT NULL THEN
   RAISE EXCEPTION 'Active shot observation missing'; END IF;
 IF obs.matched_event_id IS NOT NULL THEN RAISE EXCEPTION 'Already linked'; END IF;
 SELECT * INTO shot FROM public.game_events
   WHERE id=p_event_id AND game_id=p_game_id AND type='shot' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Official shot missing'; END IF;
 IF shot.team<>obs.team OR shot.period<>obs.period OR shot.points<>obs.points OR
   shot.made IS DISTINCT FROM obs.made THEN
   RAISE EXCEPTION 'Shot observation conflicts with official shot'; END IF;
 IF shot.version<>p_expected_version THEN
   RAISE EXCEPTION 'Shot changed on another device'; END IF;
 IF shot.x IS NOT NULL OR shot.y IS NOT NULL THEN
   RAISE EXCEPTION 'Shot already has an assigned location'; END IF;
 IF EXISTS (SELECT 1 FROM public.tracker_observations other
   WHERE other.matched_event_id=p_event_id AND other.retracted_at IS NULL) THEN
   RAISE EXCEPTION 'Shot already linked to another observation'; END IF;
 UPDATE public.game_events SET x=obs.x,y=obs.y,
   distance_meters=obs.distance_meters,distance_feet=obs.distance_feet,
   version=version+1 WHERE id=p_event_id RETURNING version INTO shot.version;
 UPDATE public.tracker_observations SET matched_event_id=p_event_id
   WHERE id=p_observation_id;
 RETURN QUERY SELECT shot.version::integer;
END;$$;
REVOKE ALL ON FUNCTION public.scoridium_link_shot_observation(uuid,uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.scoridium_link_shot_observation(uuid,uuid,uuid,integer) TO authenticated;
COMMIT;
