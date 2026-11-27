-- Film Room foul classification and shooting-foul shot association.
-- Staging: apply after the existing post-game migrations.
BEGIN;
CREATE TABLE IF NOT EXISTS public.apexvision_postgame_foul_details (
 event_id uuid PRIMARY KEY REFERENCES public.game_events(id) ON DELETE CASCADE,
 game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
 foul_class text NOT NULL CHECK(foul_class IN ('shooting','nonshooting','offensive','technical')),
 shot_event_id uuid NULL REFERENCES public.game_events(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS apex_pg_foul_details_game ON public.apexvision_postgame_foul_details(game_id);
ALTER TABLE public.apexvision_postgame_foul_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apex_pg_foul_details_read ON public.apexvision_postgame_foul_details;
CREATE POLICY apex_pg_foul_details_read ON public.apexvision_postgame_foul_details
 FOR SELECT TO authenticated USING(private.apexvision_can_postgame_track(game_id));
GRANT SELECT ON public.apexvision_postgame_foul_details TO authenticated;
CREATE OR REPLACE FUNCTION public.apexvision_postgame_set_foul_details(
 p_game_id uuid,p_foul_id uuid,p_foul_class text,p_shot_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_game public.games%ROWTYPE;v_foul public.game_events%ROWTYPE;
        v_shot public.game_events%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT private.apexvision_can_postgame_track(p_game_id)
 THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO v_game FROM public.games WHERE id=p_game_id FOR UPDATE;
 IF NOT FOUND OR v_game.status<>'completed' THEN RAISE EXCEPTION 'Completed game required'; END IF;
 IF p_foul_class NOT IN ('shooting','nonshooting','offensive','technical')
 THEN RAISE EXCEPTION 'Invalid foul classification'; END IF;
 SELECT * INTO v_foul FROM public.game_events WHERE id=p_foul_id AND game_id=p_game_id;
 IF NOT FOUND OR v_foul.type<>'foul' OR NOT EXISTS(
  SELECT 1 FROM public.apexvision_postgame_entries WHERE event_id=p_foul_id AND game_id=p_game_id
 ) THEN RAISE EXCEPTION 'Foul was not recorded in Film Room'; END IF;
 IF p_shot_id IS NOT NULL THEN
  IF p_foul_class<>'shooting' THEN RAISE EXCEPTION 'Only shooting fouls can reference a shot'; END IF;
  SELECT * INTO v_shot FROM public.game_events WHERE id=p_shot_id AND game_id=p_game_id;
  IF NOT FOUND OR v_shot.type<>'shot' OR v_shot.period<>v_foul.period OR v_shot.team=v_foul.team
  THEN RAISE EXCEPTION 'Invalid shooting-foul shot'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.apexvision_postgame_entries
    WHERE event_id=p_shot_id AND game_id=p_game_id)
  THEN RAISE EXCEPTION 'Cannot attach a live-tracker shot to a Film Room foul'; END IF;
 END IF;
 INSERT INTO public.apexvision_postgame_foul_details(event_id,game_id,foul_class,shot_event_id)
 VALUES(p_foul_id,p_game_id,p_foul_class,p_shot_id)
 ON CONFLICT(event_id) DO UPDATE SET foul_class=EXCLUDED.foul_class,
   shot_event_id=EXCLUDED.shot_event_id;
 RETURN p_foul_id;
END; $$;
REVOKE ALL ON FUNCTION public.apexvision_postgame_set_foul_details(uuid,uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apexvision_postgame_set_foul_details(uuid,uuid,text,uuid) TO authenticated;
-- OOB classification is metadata on the existing linked team rebound.
-- Do not fabricate a second rebound event merely for Play-by-Play.
CREATE TABLE IF NOT EXISTS public.apexvision_postgame_out_of_bounds (
 event_id uuid PRIMARY KEY REFERENCES public.game_events(id) ON DELETE CASCADE,
 game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE
);
ALTER TABLE public.apexvision_postgame_out_of_bounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apex_pg_oob_read ON public.apexvision_postgame_out_of_bounds;
CREATE POLICY apex_pg_oob_read ON public.apexvision_postgame_out_of_bounds
 FOR SELECT TO authenticated USING(private.apexvision_can_postgame_track(game_id));
GRANT SELECT ON public.apexvision_postgame_out_of_bounds TO authenticated;
CREATE OR REPLACE FUNCTION public.apexvision_postgame_mark_oob(
 p_game_id uuid,p_event_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT private.apexvision_can_postgame_track(p_game_id)
 THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.games WHERE id=p_game_id AND status='completed')
 THEN RAISE EXCEPTION 'Completed game required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.game_events e
   JOIN public.apexvision_postgame_entries pe ON pe.event_id=e.id AND pe.game_id=p_game_id
   WHERE e.game_id=p_game_id AND e.id=p_event_id
     AND e.type IN ('team_offensive_rebound','team_defensive_rebound'))
 THEN RAISE EXCEPTION 'Out-of-bounds classification requires a Film Room team rebound'; END IF;
 INSERT INTO public.apexvision_postgame_out_of_bounds(event_id,game_id)
 VALUES(p_event_id,p_game_id) ON CONFLICT(event_id) DO NOTHING;
 RETURN p_event_id;
END; $$;
REVOKE ALL ON FUNCTION public.apexvision_postgame_mark_oob(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apexvision_postgame_mark_oob(uuid,uuid) TO authenticated;
COMMIT;
