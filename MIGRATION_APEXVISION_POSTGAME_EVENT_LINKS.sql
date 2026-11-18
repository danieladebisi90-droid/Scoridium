-- Apply ONLY to ApexVision-Test after the original post-game migrations.
-- Links a newly entered post-game event to its source shot, foul or turnover.
-- Requires the existing public.game_events.linked_event_id column.
BEGIN;
CREATE OR REPLACE FUNCTION public.apexvision_postgame_link_event(
 p_game_id uuid,p_event_id uuid,p_source_event_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_child public.game_events%ROWTYPE;v_source public.game_events%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT private.apexvision_can_postgame_track(p_game_id)
 THEN RAISE EXCEPTION 'Not authorized to link events for this game'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.games WHERE id=p_game_id AND status='completed')
 THEN RAISE EXCEPTION 'Game must be completed'; END IF;
 SELECT * INTO v_child FROM public.game_events
 WHERE id=p_event_id AND game_id=p_game_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Related event was not found'; END IF;
 SELECT * INTO v_source FROM public.game_events
 WHERE id=p_source_event_id AND game_id=p_game_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Source event was not found'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.apexvision_postgame_entries
   WHERE game_id=p_game_id AND event_id=p_event_id AND created_by=auth.uid())
 THEN RAISE EXCEPTION 'Only events created in this post-game session may be linked here'; END IF;
 IF NOT (
   (v_source.type='shot' AND v_child.type IN ('assist','offensive_rebound',
      'defensive_rebound','team_offensive_rebound','team_defensive_rebound','block'))
   OR (v_source.type='free_throw' AND v_child.type IN ('offensive_rebound','defensive_rebound',
      'team_offensive_rebound','team_defensive_rebound','block'))
   OR (v_source.type='turnover' AND v_child.type='steal')
   OR (v_source.type='steal' AND v_child.type='turnover')
   OR (v_source.type='foul' AND v_child.type IN ('free_throw','turnover'))
 ) THEN RAISE EXCEPTION 'Unsupported event link relationship'; END IF;
 IF v_child.linked_event_id IS NOT NULL AND v_child.linked_event_id<>p_source_event_id
 THEN RAISE EXCEPTION 'Existing event link cannot be overwritten'; END IF;
 IF v_child.linked_event_id IS NULL THEN
  UPDATE public.game_events SET linked_event_id=p_source_event_id
  WHERE id=p_event_id AND game_id=p_game_id;
 END IF;
 RETURN p_event_id;
END;$$;
REVOKE ALL ON FUNCTION public.apexvision_postgame_link_event(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apexvision_postgame_link_event(uuid,uuid,uuid) TO authenticated;
COMMIT;
