-- STAGING / APEXVISION-TEST ONLY. Apply AFTER the existing Film Room migrations.
-- Persist manual presentation order independently from official games scores.
-- No changes to live-tracker ordering or official final results.
BEGIN;
CREATE TABLE IF NOT EXISTS public.apexvision_postgame_order (
  event_id uuid PRIMARY KEY REFERENCES public.game_events(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  sort_key numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS apex_pg_order_game ON public.apexvision_postgame_order(game_id,sort_key);
ALTER TABLE public.apexvision_postgame_order ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apex_pg_order_read ON public.apexvision_postgame_order;
CREATE POLICY apex_pg_order_read ON public.apexvision_postgame_order FOR SELECT TO authenticated
  USING (private.apexvision_can_postgame_track(game_id));
GRANT SELECT ON public.apexvision_postgame_order TO authenticated;

CREATE OR REPLACE FUNCTION public.apexvision_postgame_reorder_plays(
  p_game_id uuid,p_period integer,p_roots uuid[]
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_game public.games%ROWTYPE; v_count integer;v_id uuid;v_idx integer:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT private.apexvision_can_postgame_track(p_game_id) THEN
  RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO v_game FROM public.games WHERE id=p_game_id FOR UPDATE;
 IF NOT FOUND OR v_game.status<>'completed' THEN RAISE EXCEPTION 'Completed game required'; END IF;
 IF p_period<1 OR p_period>GREATEST(4,COALESCE(v_game.current_period,4)) THEN RAISE EXCEPTION 'Invalid quarter';END IF;
 IF p_roots IS NULL OR cardinality(p_roots)=0 THEN RAISE EXCEPTION 'No plays to reorder';END IF;
 IF (SELECT count(DISTINCT event_id) FROM unnest(p_roots) AS x(event_id)) <> cardinality(p_roots) THEN
  RAISE EXCEPTION 'Duplicate play in requested order';END IF;
 SELECT count(*) INTO v_count FROM public.game_events e
  JOIN public.apexvision_postgame_entries pg ON pg.event_id=e.id AND pg.game_id=p_game_id
  WHERE e.game_id=p_game_id AND e.period=p_period AND e.id=ANY(p_roots);
 IF v_count<>cardinality(p_roots) THEN RAISE EXCEPTION 'Cannot move protected, missing or cross-quarter plays';END IF;
 -- Seed historical Film Room events once; never rewrite existing manual positions.
 INSERT INTO public.apexvision_postgame_order(event_id,game_id,sort_key)
 SELECT e.id,p_game_id, (row_number() OVER(ORDER BY e.created_at,e.id))*1024
 FROM public.game_events e JOIN public.apexvision_postgame_entries pe ON pe.event_id=e.id AND pe.game_id=p_game_id
 WHERE e.game_id=p_game_id AND e.period=p_period
 ON CONFLICT(event_id) DO NOTHING;
 -- Assign explicitly ordered rows in one transaction. Root groups retain links;
 -- free throws can be moved separately only if exposed as separate rows.
 FOREACH v_id IN ARRAY p_roots LOOP
  v_idx:=v_idx+1;
  UPDATE public.apexvision_postgame_order SET sort_key=v_idx*1024,updated_at=now()
   WHERE event_id=v_id AND game_id=p_game_id;
 END LOOP;
 RETURN v_idx;
END;$$;

-- Insert a retrospective NON-FIELD-GOAL stat and optionally link it.
-- Recording and linking happen within one database transaction.
CREATE OR REPLACE FUNCTION public.apexvision_postgame_insert_review_event(
 p_game_id uuid,p_event_id uuid,p_type text,p_team text,p_period integer,
 p_player_id uuid DEFAULT NULL,p_made boolean DEFAULT NULL,
 p_linked_event_id uuid DEFAULT NULL,p_before_event_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_game public.games%ROWTYPE;v_before numeric;v_next numeric;v_key numeric;v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT private.apexvision_can_postgame_track(p_game_id) THEN
  RAISE EXCEPTION 'Not authorized';END IF;
 SELECT * INTO v_game FROM public.games WHERE id=p_game_id FOR UPDATE;
 IF NOT FOUND OR v_game.status<>'completed' THEN RAISE EXCEPTION 'Completed game required';END IF;
 IF p_type NOT IN ('free_throw','assist','offensive_rebound','defensive_rebound','steal','turnover','block','foul')
 THEN RAISE EXCEPTION 'Unsupported insertion: record shots on the court';END IF;
 IF p_type='free_throw' AND p_made IS NULL THEN RAISE EXCEPTION 'Free throw needs MADE/MISSED'; END IF;
 IF p_type<>'free_throw' AND p_made IS NOT NULL THEN RAISE EXCEPTION 'Only FTs have result'; END IF;
 -- Initialize positions for the target period, without overwriting edits.
 INSERT INTO public.apexvision_postgame_order(event_id,game_id,sort_key)
 SELECT e.id,p_game_id,(row_number() OVER(ORDER BY e.created_at,e.id))*1024
 FROM public.game_events e JOIN public.apexvision_postgame_entries pe ON pe.event_id=e.id AND pe.game_id=p_game_id
 WHERE e.game_id=p_game_id AND e.period=p_period
 ON CONFLICT(event_id) DO NOTHING;
 IF p_before_event_id IS NOT NULL THEN
  SELECT o.sort_key INTO v_before FROM public.apexvision_postgame_order o
   JOIN public.game_events e ON e.id=o.event_id
   WHERE o.event_id=p_before_event_id AND o.game_id=p_game_id AND e.period=p_period;
  IF v_before IS NULL THEN RAISE EXCEPTION 'Insertion anchor missing or in another quarter'; END IF;
  SELECT min(o.sort_key) INTO v_next FROM public.apexvision_postgame_order o
   JOIN public.game_events e ON e.id=o.event_id
   WHERE o.game_id=p_game_id AND e.period=p_period AND o.sort_key>v_before;
  v_key:=(v_before+COALESCE(v_next,v_before+1024))/2;
 ELSE
  SELECT COALESCE(max(o.sort_key),0)+1024 INTO v_key FROM public.apexvision_postgame_order o
   JOIN public.game_events e ON e.id=o.event_id WHERE o.game_id=p_game_id AND e.period=p_period;
 END IF;
 v_id:=public.apexvision_postgame_add_event(p_game_id,p_event_id,p_type,p_team,p_period,
  p_player_id,CASE WHEN p_type='free_throw' THEN 1 ELSE NULL END,p_made,NULL,NULL);
 IF p_linked_event_id IS NOT NULL THEN
  PERFORM public.apexvision_postgame_link_event(p_game_id,v_id,p_linked_event_id);
 END IF;
 INSERT INTO public.apexvision_postgame_order(event_id,game_id,sort_key)
  VALUES(v_id,p_game_id,v_key);
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.apexvision_postgame_reorder_plays(uuid,integer,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apexvision_postgame_reorder_plays(uuid,integer,uuid[]) TO authenticated;
REVOKE ALL ON FUNCTION public.apexvision_postgame_insert_review_event(uuid,uuid,text,text,integer,uuid,boolean,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apexvision_postgame_insert_review_event(uuid,uuid,text,text,integer,uuid,boolean,uuid,uuid) TO authenticated;
COMMIT;
