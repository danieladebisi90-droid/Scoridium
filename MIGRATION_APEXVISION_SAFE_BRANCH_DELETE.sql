-- ApexVision Film Room: safe recursive deletion of post-game event branches.
-- Run in staging AFTER MIGRATION_APEXVISION_FOUL_DETAILS.sql.
-- Does NOT modify live events or official final scores.
BEGIN;
CREATE OR REPLACE FUNCTION public.apexvision_postgame_delete_branch(
 p_game_id uuid, p_event_id uuid, p_expected_version integer
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_before public.games%ROWTYPE;
 v_after public.games%ROWTYPE;
 v_event public.game_events%ROWTYPE;
 v_branch uuid[];
 v_id uuid;
 v_count integer;
BEGIN
 IF auth.uid() IS NULL OR NOT private.apexvision_can_postgame_track(p_game_id)
 THEN RAISE EXCEPTION 'Not authorized for post-game tracking'; END IF;
 SELECT * INTO v_before FROM public.games WHERE id=p_game_id FOR UPDATE;
 IF NOT FOUND OR v_before.status <> 'completed'
 THEN RAISE EXCEPTION 'A completed game is required'; END IF;
 SELECT * INTO v_event FROM public.game_events
 WHERE game_id=p_game_id AND id=p_event_id FOR UPDATE;
 IF NOT FOUND OR v_event.version IS DISTINCT FROM p_expected_version
 THEN RAISE EXCEPTION 'Event changed; refresh and try again'; END IF;
 -- Recursively select the root and all children, including FT rebounds.
 -- The path guard prevents accidental cycles from spinning forever.
 WITH RECURSIVE tree AS (
   SELECT e.id, ARRAY[e.id] AS path, 0 AS depth
   FROM public.game_events e WHERE e.game_id=p_game_id AND e.id=p_event_id
   UNION ALL
   SELECT e.id, tree.path||e.id,tree.depth+1
   FROM public.game_events e JOIN tree ON (
      e.linked_event_id=tree.id
      -- Both directions of the shooting-foul association form one play.
      OR EXISTS(SELECT 1 FROM public.apexvision_postgame_foul_details d
        WHERE d.game_id=p_game_id AND
          ((d.event_id=e.id AND d.shot_event_id=tree.id) OR
           (d.event_id=tree.id AND d.shot_event_id=e.id)))
   )
   WHERE e.game_id=p_game_id AND NOT (e.id=ANY(tree.path))
 ) SELECT array_agg(id ORDER BY depth DESC) INTO v_branch FROM (
   SELECT id,max(depth) AS depth FROM tree GROUP BY id
 ) unique_events;
 IF v_branch IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;
 -- Never allow cascade into official live-tracker or unrelated protected entries.
 IF EXISTS (SELECT 1 FROM unnest(v_branch) AS b(id)
   WHERE NOT EXISTS (SELECT 1 FROM public.apexvision_postgame_entries pe
      WHERE pe.game_id=p_game_id AND pe.event_id=b.id))
 THEN RAISE EXCEPTION 'One or more linked events were recorded live; deletion blocked'; END IF;
 -- Serialize all affected rows before mutation.
 PERFORM 1 FROM public.game_events WHERE game_id=p_game_id AND id=ANY(v_branch) FOR UPDATE;
 v_count=cardinality(v_branch);
 -- Delete children before their parents to satisfy immediate FK constraints.
 FOREACH v_id IN ARRAY v_branch LOOP
   DELETE FROM public.apexvision_postgame_entries WHERE game_id=p_game_id AND event_id=v_id;
   DELETE FROM public.game_events WHERE game_id=p_game_id AND id=v_id;
 END LOOP;
 SELECT * INTO v_after FROM public.games WHERE id=p_game_id;
 IF v_after.status IS DISTINCT FROM v_before.status OR
    v_after.team_score IS DISTINCT FROM v_before.team_score OR
    v_after.opponent_score IS DISTINCT FROM v_before.opponent_score
 THEN RAISE EXCEPTION 'Official result changed; deletion rolled back'; END IF;
 RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.apexvision_postgame_delete_branch(uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apexvision_postgame_delete_branch(uuid,uuid,integer) TO authenticated;
COMMIT;
