-- Scoridium multi-tracker collaboration. Review and run ONCE in the Supabase SQL Editor.
-- Existing public.games(id,team_id,home_attacks_left_first_half),
-- public.game_events(id,game_id,type,x,y,distance_meters,distance_feet,version)
-- and public.team_members(team_id,user_id) are required.
-- No public/anon read or write policies are added.

CREATE TABLE IF NOT EXISTS public.tracker_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  tracker_id uuid NOT NULL REFERENCES auth.users(id),
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  period integer NOT NULL CHECK (period BETWEEN 1 AND 20),
  kind text NOT NULL CHECK (kind IN ('shot','free_throw')),
  team text NOT NULL CHECK (team IN ('us','opponent')),
  points smallint CHECK (points IN (1,2,3)),
  made boolean,
  x numeric, y numeric,
  distance_meters numeric, distance_feet numeric,
  matched_event_id uuid REFERENCES public.game_events(id) ON DELETE SET NULL,
  CONSTRAINT tracker_observation_type CHECK (
    (kind='shot' AND points IN (2,3) AND made IS NOT NULL AND x IS NOT NULL AND y IS NOT NULL) OR
    (kind='free_throw' AND points=1 AND made IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS tracker_observations_game_time_idx ON public.tracker_observations(game_id,period,observed_at);
CREATE INDEX IF NOT EXISTS tracker_observations_match_idx ON public.tracker_observations(matched_event_id);
ALTER TABLE public.tracker_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tracker_observations_team_read ON public.tracker_observations;
CREATE POLICY tracker_observations_team_read ON public.tracker_observations FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
  WHERE g.id=game_id AND tm.user_id=(SELECT auth.uid())
));
DROP POLICY IF EXISTS tracker_observations_self_insert ON public.tracker_observations;
CREATE POLICY tracker_observations_self_insert ON public.tracker_observations FOR INSERT TO authenticated
WITH CHECK (tracker_id=(SELECT auth.uid()) AND EXISTS (
  SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
  WHERE g.id=game_id AND tm.user_id=(SELECT auth.uid())
));
-- Observations are immutable. Corrections should create new observations or use
-- an explicit vetted reviewer workflow; no broad UPDATE/DELETE policy is granted.
GRANT SELECT, INSERT ON public.tracker_observations TO authenticated;

CREATE TABLE IF NOT EXISTS public.tracker_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  tracker_id uuid NOT NULL REFERENCES auth.users(id),
  period integer NOT NULL CHECK (period BETWEEN 1 AND 20),
  checkpoint_type text NOT NULL CHECK (checkpoint_type IN ('quarter','timeout','manual')),
  observed_home_score integer NOT NULL CHECK (observed_home_score>=0),
  observed_away_score integer NOT NULL CHECK (observed_away_score>=0),
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tracker_checkpoints_game_idx ON public.tracker_checkpoints(game_id,period,observed_at);
ALTER TABLE public.tracker_checkpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tracker_checkpoints_team_read ON public.tracker_checkpoints;
CREATE POLICY tracker_checkpoints_team_read ON public.tracker_checkpoints FOR SELECT TO authenticated
USING (EXISTS (
 SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
 WHERE g.id=game_id AND tm.user_id=(SELECT auth.uid())
));
DROP POLICY IF EXISTS tracker_checkpoints_self_insert ON public.tracker_checkpoints;
CREATE POLICY tracker_checkpoints_self_insert ON public.tracker_checkpoints FOR INSERT TO authenticated
WITH CHECK (tracker_id=(SELECT auth.uid()) AND EXISTS (
 SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
 WHERE g.id=game_id AND tm.user_id=(SELECT auth.uid())
));
GRANT SELECT, INSERT ON public.tracker_checkpoints TO authenticated;

-- Version-checked update of an EXISTING shot. No new FGA, basket, or points.
-- SECURITY DEFINER with explicit game-team membership validation, so clients
-- cannot bypass restrictions or mutate scoring columns through this RPC.
CREATE OR REPLACE FUNCTION public.scoridium_assign_shot_location(
  p_game_id uuid,p_event_id uuid,p_expected_version integer,
  p_x numeric,p_y numeric,p_distance_meters numeric,p_distance_feet numeric
) RETURNS TABLE(new_version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_team text;v_points integer;v_period integer;v_home_left boolean;v_expected_side text;v_side text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_x NOT BETWEEN 10 AND 850 OR p_y NOT BETWEEN 10 AND 460 OR
     p_distance_meters IS NULL OR p_distance_meters < 0 OR
     p_distance_feet IS NULL OR p_distance_feet < 0 THEN
    RAISE EXCEPTION 'Invalid shot coordinates/distance';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
    WHERE g.id=p_game_id AND tm.user_id=auth.uid()
  ) THEN RAISE EXCEPTION 'Not an authorized game tracker'; END IF;
  -- Serializes competing assignments and protects shot ownership.
  SELECT e.team,e.points,e.period,g.home_attacks_left_first_half
  INTO v_team,v_points,v_period,v_home_left
  FROM public.game_events e JOIN public.games g ON g.id=e.game_id
  WHERE e.id=p_event_id AND e.game_id=p_game_id AND e.type='shot' FOR UPDATE OF e;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shot not found'; END IF;
  -- Actual FIBA 2/3 point validation remains in shared JS court geometry.
  -- Event ID, period and team remain immutable in this RPC.
  RETURN QUERY UPDATE public.game_events e
    SET x=p_x,y=p_y,distance_meters=p_distance_meters,distance_feet=p_distance_feet,
        version=e.version+1
    WHERE e.id=p_event_id AND e.game_id=p_game_id AND e.version=p_expected_version
      AND e.type='shot'
    RETURNING e.version::integer;
END;
$$;
REVOKE ALL ON FUNCTION public.scoridium_assign_shot_location(uuid,uuid,integer,numeric,numeric,numeric,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.scoridium_assign_shot_location(uuid,uuid,integer,numeric,numeric,numeric,numeric) TO authenticated;

-- Supabase Realtime publication: run only if not already included.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables
   WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='tracker_observations') THEN
   ALTER PUBLICATION supabase_realtime ADD TABLE public.tracker_observations;
 END IF;
END $$;

-- Atomic, membership-checked operation that LINKS an independent Court
-- observation to exactly one existing shot. Never adds points or new attempts.
CREATE OR REPLACE FUNCTION public.scoridium_link_shot_observation(
  p_game_id uuid,p_observation_id uuid,p_event_id uuid,p_expected_version integer
) RETURNS TABLE(new_version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE obs public.tracker_observations%ROWTYPE;shot public.game_events%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
   WHERE g.id=p_game_id AND tm.user_id=auth.uid()
 ) THEN RAISE EXCEPTION 'Not authorized for this game'; END IF;
 SELECT * INTO obs FROM public.tracker_observations
   WHERE id=p_observation_id AND game_id=p_game_id FOR UPDATE;
 IF NOT FOUND OR obs.kind<>'shot' THEN RAISE EXCEPTION 'Shot observation missing'; END IF;
 IF obs.matched_event_id IS NOT NULL AND obs.matched_event_id<>p_event_id THEN
   RAISE EXCEPTION 'Observation already linked to another event'; END IF;
 SELECT * INTO shot FROM public.game_events
   WHERE id=p_event_id AND game_id=p_game_id AND type='shot' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Official shot missing'; END IF;
 IF shot.team<>obs.team OR shot.period<>obs.period OR shot.points<>obs.points OR
   shot.made IS DISTINCT FROM obs.made THEN
   RAISE EXCEPTION 'Team, period, shot type or result mismatch'; END IF;
 IF shot.version<>p_expected_version THEN
   RAISE EXCEPTION 'Shot was edited by another tracker. Refresh.'; END IF;
 IF shot.x IS NULL AND shot.y IS NULL THEN
   UPDATE public.game_events SET x=obs.x,y=obs.y,
     distance_meters=obs.distance_meters,distance_feet=obs.distance_feet,
     version=version+1 WHERE id=p_event_id RETURNING version INTO shot.version;
 END IF;
 UPDATE public.tracker_observations SET matched_event_id=p_event_id
   WHERE id=p_observation_id;
 RETURN QUERY SELECT shot.version::integer;
END;$$;
REVOKE ALL ON FUNCTION public.scoridium_link_shot_observation(uuid,uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.scoridium_link_shot_observation(uuid,uuid,uuid,integer) TO authenticated;

-- Record manual direction changes to preserve an audit trail for earlier shots.
CREATE TABLE IF NOT EXISTS public.game_direction_changes(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  tracker_id uuid NOT NULL REFERENCES auth.users(id),
  period integer NOT NULL,
  previous_home_attacks_left_first_half boolean NOT NULL,
  new_home_attacks_left_first_half boolean NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.game_direction_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS game_direction_changes_team_read ON public.game_direction_changes;
CREATE POLICY game_direction_changes_team_read ON public.game_direction_changes FOR SELECT TO authenticated
USING (EXISTS (
 SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
 WHERE g.id=game_id AND tm.user_id=(SELECT auth.uid())
));
GRANT SELECT ON public.game_direction_changes TO authenticated;
CREATE OR REPLACE FUNCTION public.scoridium_switch_basket_directions(p_game_id uuid)
RETURNS TABLE(home_attacks_left_first_half boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_direction boolean;period_no integer;new_direction boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
   WHERE g.id=p_game_id AND tm.user_id=auth.uid()
 ) THEN RAISE EXCEPTION 'Not authorized for this game'; END IF;
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

-- Independent Quick Trackers submit observations, NOT canonical game_events.
-- They cannot independently increment the official scoreboard.
CREATE TABLE IF NOT EXISTS public.tracker_event_observations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  tracker_id uuid NOT NULL REFERENCES auth.users(id),
  observed_at timestamptz NOT NULL DEFAULT now(),
  period integer NOT NULL CHECK (period BETWEEN 1 AND 20),
  source_event_id uuid,
  linked_source_event_id uuid,
  team text NOT NULL CHECK (team IN ('us','opponent')),
  type text NOT NULL,
  player_id uuid,
  points integer,
  made boolean,
  canonical_event_id uuid REFERENCES public.game_events(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS tracker_event_observations_game_idx
 ON public.tracker_event_observations(game_id,period,observed_at);
ALTER TABLE public.tracker_event_observations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tracker_event_observations_member_read ON public.tracker_event_observations;
CREATE POLICY tracker_event_observations_member_read ON public.tracker_event_observations FOR SELECT TO authenticated
USING (EXISTS (
 SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
 WHERE g.id=game_id AND tm.user_id=(SELECT auth.uid())
));
DROP POLICY IF EXISTS tracker_event_observations_member_insert ON public.tracker_event_observations;
CREATE POLICY tracker_event_observations_member_insert ON public.tracker_event_observations FOR INSERT TO authenticated
WITH CHECK (tracker_id=(SELECT auth.uid()) AND EXISTS (
 SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
 WHERE g.id=game_id AND tm.user_id=(SELECT auth.uid())
));
GRANT SELECT,INSERT ON public.tracker_event_observations TO authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables
 WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='tracker_event_observations') THEN
   ALTER PUBLICATION supabase_realtime ADD TABLE public.tracker_event_observations;
 END IF;
END $$;

-- Exactly one PRIMARY device may own official Quick Track for a game.
-- Independent Quick Trackers continue recording separate observations.
CREATE TABLE IF NOT EXISTS public.game_primary_trackers(
  game_id uuid PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE,
  tracker_id uuid NOT NULL REFERENCES auth.users(id),
  device_id uuid NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.game_primary_trackers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS game_primary_trackers_team_read ON public.game_primary_trackers;
CREATE POLICY game_primary_trackers_team_read ON public.game_primary_trackers FOR SELECT TO authenticated
USING (EXISTS (
 SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
 WHERE g.id=game_id AND tm.user_id=(SELECT auth.uid())
));
GRANT SELECT ON public.game_primary_trackers TO authenticated;

CREATE OR REPLACE FUNCTION public.scoridium_claim_primary_tracker(p_game_id uuid,p_device_id uuid)
RETURNS TABLE(is_owner boolean, owner_tracker uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner public.game_primary_trackers%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR p_device_id IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
   WHERE g.id=p_game_id AND tm.user_id=auth.uid()
 ) THEN RAISE EXCEPTION 'Not authorized for this game'; END IF;
 INSERT INTO public.game_primary_trackers(game_id,tracker_id,device_id)
 VALUES(p_game_id,auth.uid(),p_device_id) ON CONFLICT(game_id) DO NOTHING;
 SELECT * INTO owner FROM public.game_primary_trackers WHERE game_id=p_game_id;
 IF owner.tracker_id=auth.uid() AND owner.device_id=p_device_id THEN
   UPDATE public.game_primary_trackers SET last_seen=now() WHERE game_id=p_game_id;
   RETURN QUERY SELECT true,owner.tracker_id;
 ELSE
   RETURN QUERY SELECT false,owner.tracker_id;
 END IF;
END;$$;
REVOKE ALL ON FUNCTION public.scoridium_claim_primary_tracker(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.scoridium_claim_primary_tracker(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.scoridium_release_primary_tracker(p_game_id uuid,p_device_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM public.game_primary_trackers WHERE game_id=p_game_id
   AND tracker_id=auth.uid() AND device_id=p_device_id;
 RETURN FOUND;
END;$$;
REVOKE ALL ON FUNCTION public.scoridium_release_primary_tracker(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.scoridium_release_primary_tracker(uuid,uuid) TO authenticated;

-- Head coach may explicitly recover primary control after device loss.
CREATE OR REPLACE FUNCTION public.scoridium_takeover_primary_tracker(p_game_id uuid,p_device_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR p_device_id IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
   WHERE g.id=p_game_id AND tm.user_id=auth.uid() AND tm.role='head_coach'
 ) THEN RAISE EXCEPTION 'Only the head coach can take over primary tracking'; END IF;
 INSERT INTO public.game_primary_trackers(game_id,tracker_id,device_id,claimed_at,last_seen)
 VALUES(p_game_id,auth.uid(),p_device_id,now(),now())
 ON CONFLICT(game_id) DO UPDATE SET tracker_id=excluded.tracker_id,
   device_id=excluded.device_id,claimed_at=now(),last_seen=now();
 RETURN true;
END;$$;
REVOKE ALL ON FUNCTION public.scoridium_takeover_primary_tracker(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.scoridium_takeover_primary_tracker(uuid,uuid) TO authenticated;
