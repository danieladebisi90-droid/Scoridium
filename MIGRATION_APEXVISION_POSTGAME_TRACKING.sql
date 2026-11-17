-- Post-game entry API for ApexVision Film Room. Staging only until security/trigger tests pass.
-- Prerequisites: games, game_events, players, private.can_track_game(uuid), version column on game_events.
BEGIN;
CREATE TABLE IF NOT EXISTS public.apexvision_postgame_entries (
  event_id uuid PRIMARY KEY REFERENCES public.game_events(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.apexvision_postgame_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apex_postgame_entries_read ON public.apexvision_postgame_entries;
CREATE POLICY apex_postgame_entries_read ON public.apexvision_postgame_entries FOR SELECT TO authenticated
USING (EXISTS(
 SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
 WHERE g.id=game_id AND tm.user_id=auth.uid()
));
GRANT SELECT ON public.apexvision_postgame_entries TO authenticated;

-- The same 3PT rule as script.js detectShot(): 202.5 SVG-unit FIBA arc,
-- straight corner boundary at y=37 / y=433, and baskets at 57.25/802.75.
CREATE OR REPLACE FUNCTION public.apexvision_postgame_points(p_x numeric,p_y numeric)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v_left boolean;v_hx numeric;v_radius numeric:=202.5;
        v_arc numeric;v_dist numeric;
BEGIN
 IF p_x IS NULL OR p_y IS NULL OR p_x<10 OR p_x>850 OR p_y<10 OR p_y>460
 THEN RAISE EXCEPTION 'Shot location is outside FIBA court bounds'; END IF;
 v_left:=p_x<430;
 v_hx:=CASE WHEN v_left THEN 57.25 ELSE 802.75 END;
 v_arc:=sqrt(v_radius*v_radius-(235-37)*(235-37));
 v_dist:=sqrt((p_x-v_hx)*(p_x-v_hx)+(p_y-235)*(p_y-235));
 IF (v_left AND p_x<=v_hx+v_arc) OR (NOT v_left AND p_x>=v_hx-v_arc) THEN
   RETURN CASE WHEN p_y<37 OR p_y>433 THEN 3 ELSE 2 END;
 END IF;
 RETURN CASE WHEN v_dist>v_radius THEN 3 ELSE 2 END;
END;$$;

-- UUID is generated in the browser and reused on network retries.
-- A matching previously confirmed UUID succeeds idempotently;
-- it cannot overwrite existing live events or insert a second FGA.
CREATE OR REPLACE FUNCTION public.apexvision_postgame_add_event(
  p_game_id uuid,p_event_id uuid,p_type text,p_team text,p_period integer,
  p_player_id uuid DEFAULT NULL,p_points integer DEFAULT NULL,p_made boolean DEFAULT NULL,
  p_x numeric DEFAULT NULL,p_y numeric DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_game public.games%ROWTYPE;v_saved uuid;v_actual integer;v_hx numeric;
        v_dist numeric;v_owner uuid;v_after public.games%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_track_game(p_game_id)
 THEN RAISE EXCEPTION 'Not authorized to track this game'; END IF;
 SELECT * INTO v_game FROM public.games WHERE id=p_game_id FOR UPDATE;
 IF NOT FOUND OR v_game.status<>'completed' THEN
   RAISE EXCEPTION 'Post-game entry requires a completed game'; END IF;
 SELECT e.created_by INTO v_owner FROM public.apexvision_postgame_entries e
 WHERE e.event_id=p_event_id AND e.game_id=p_game_id;
 IF FOUND AND v_owner=auth.uid() THEN RETURN p_event_id; END IF;
 IF p_event_id IS NULL THEN RAISE EXCEPTION 'Event ID required'; END IF;
 IF p_team NOT IN ('us','opponent') OR p_period IS NULL OR p_period<1 OR
    p_period>GREATEST(4,COALESCE(v_game.current_period,4))
 THEN RAISE EXCEPTION 'Invalid team or period'; END IF;
 IF p_type NOT IN ('shot','free_throw','assist','offensive_rebound','defensive_rebound',
    'team_offensive_rebound','team_defensive_rebound','steal','turnover','block','foul')
 THEN RAISE EXCEPTION 'Unsupported stat type'; END IF;
 IF p_player_id IS NOT NULL AND (
   p_team<>'us' OR NOT EXISTS(
     SELECT 1 FROM public.players pl WHERE pl.id=p_player_id AND pl.team_id=v_game.team_id
   )) THEN RAISE EXCEPTION 'Player must belong to the tracked team'; END IF;
 IF p_type='shot' THEN
   IF p_points NOT IN (2,3) OR p_made IS NULL THEN RAISE EXCEPTION 'Shot type and result required'; END IF;
   IF (p_x IS NULL) <> (p_y IS NULL) THEN RAISE EXCEPTION 'Both coordinates required'; END IF;
   IF p_x IS NOT NULL AND public.apexvision_postgame_points(p_x,p_y)<>p_points THEN
     RAISE EXCEPTION 'Shot value does not match FIBA court geometry'; END IF;
 ELSIF p_type='free_throw' THEN
   IF p_points IS DISTINCT FROM 1 OR p_made IS NULL OR p_x IS NOT NULL OR p_y IS NOT NULL
   THEN RAISE EXCEPTION 'Invalid free throw'; END IF;
 ELSE
   IF p_points IS NOT NULL OR p_made IS NOT NULL OR p_x IS NOT NULL OR p_y IS NOT NULL
   THEN RAISE EXCEPTION 'Non-scoring event has scoring fields'; END IF;
 END IF;
 v_hx:=CASE WHEN p_x<430 THEN 57.25 ELSE 802.75 END;
 v_dist:=CASE WHEN p_x IS NOT NULL
   THEN round((sqrt((p_x-v_hx)^2+(p_y-235)^2)/30)::numeric,2)
   ELSE NULL END;
 INSERT INTO public.game_events(
   id,game_id,player_id,team,type,period,x,y,points,made,distance_meters,distance_feet
 ) VALUES (
   p_event_id,p_game_id,p_player_id,p_team,p_type,p_period,p_x,p_y,p_points,p_made,
   v_dist,CASE WHEN v_dist IS NULL THEN NULL ELSE round((v_dist*3.28084)::numeric,2) END
 ) ON CONFLICT(id) DO NOTHING RETURNING id INTO v_saved;
 IF v_saved IS NULL THEN RAISE EXCEPTION 'Event ID already exists; no duplicate created'; END IF;
 INSERT INTO public.apexvision_postgame_entries(event_id,game_id,created_by)
 VALUES(v_saved,p_game_id,auth.uid());
 SELECT * INTO v_after FROM public.games WHERE id=p_game_id;
 IF v_after.status IS DISTINCT FROM v_game.status OR
    v_after.team_score IS DISTINCT FROM v_game.team_score OR
    v_after.opponent_score IS DISTINCT FROM v_game.opponent_score THEN
   RAISE EXCEPTION 'Post-game entry affected official result; transaction rolled back';
 END IF;
 RETURN v_saved;
END;$$;

-- Assign one missing shot location to an existing FGA without changing its
-- make/miss, 2/3 designation, shooter, period, score or identity.
CREATE OR REPLACE FUNCTION public.apexvision_postgame_assign_shot(
 p_game_id uuid,p_event_id uuid,p_expected_version integer,p_x numeric,p_y numeric
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_game public.games%ROWTYPE;v_shot public.game_events%ROWTYPE;
        v_hx numeric;v_dist numeric;v_version integer;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_track_game(p_game_id)
 THEN RAISE EXCEPTION 'Not authorized to assign shots'; END IF;
 SELECT * INTO v_game FROM public.games WHERE id=p_game_id FOR UPDATE;
 IF NOT FOUND OR v_game.status<>'completed' THEN RAISE EXCEPTION 'Game must be completed'; END IF;
 SELECT * INTO v_shot FROM public.game_events
 WHERE id=p_event_id AND game_id=p_game_id AND type='shot' FOR UPDATE;
 IF NOT FOUND OR v_shot.x IS NOT NULL OR v_shot.y IS NOT NULL
 THEN RAISE EXCEPTION 'Shot missing or already located'; END IF;
 IF v_shot.version IS DISTINCT FROM p_expected_version THEN
   RAISE EXCEPTION 'Shot edited by someone else. Refresh and retry'; END IF;
 IF public.apexvision_postgame_points(p_x,p_y)<>v_shot.points THEN
   RAISE EXCEPTION 'Shot location conflicts with recorded 2/3-point value'; END IF;
 v_hx:=CASE WHEN p_x<430 THEN 57.25 ELSE 802.75 END;
 v_dist:=round((sqrt((p_x-v_hx)^2+(p_y-235)^2)/30)::numeric,2);
 UPDATE public.game_events
 SET x=p_x,y=p_y,distance_meters=v_dist,distance_feet=round((v_dist*3.28084)::numeric,2),
 version=version+1
 WHERE id=p_event_id AND game_id=p_game_id AND x IS NULL AND y IS NULL
 AND version=p_expected_version
 RETURNING version INTO v_version;
 IF v_version IS NULL THEN RAISE EXCEPTION 'Shot assignment conflict'; END IF;
 RETURN v_version;
END;$$;

REVOKE ALL ON FUNCTION public.apexvision_postgame_points(numeric,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apexvision_postgame_points(numeric,numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.apexvision_postgame_add_event(uuid,uuid,text,text,integer,uuid,integer,boolean,numeric,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apexvision_postgame_add_event(uuid,uuid,text,text,integer,uuid,integer,boolean,numeric,numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.apexvision_postgame_assign_shot(uuid,uuid,integer,numeric,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apexvision_postgame_assign_shot(uuid,uuid,integer,numeric,numeric) TO authenticated;
COMMIT;
