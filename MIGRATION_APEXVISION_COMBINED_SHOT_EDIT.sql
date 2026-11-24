-- Staging-only migration. Run after MIGRATION_APEXVISION_POSTGAME_TRACKING.sql
-- and MIGRATION_APEXVISION_POSTGAME_EVENT_LINKS.sql.
-- Edits only shots created via authorized post-game entries for completed games.
-- Existing live-game shots remain immutable through these RPCs.
BEGIN;
CREATE OR REPLACE FUNCTION public.apexvision_postgame_edit_shot(
 p_game_id uuid,p_event_id uuid,p_expected_version integer,
 p_team text,p_player_id uuid,p_made boolean,p_x numeric,p_y numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_event public.game_events%ROWTYPE; before_game public.games%ROWTYPE;
        after_game public.games%ROWTYPE; points_value integer;
BEGIN
 IF auth.uid() IS NULL OR NOT private.apexvision_can_postgame_track(p_game_id) THEN
   RAISE EXCEPTION 'Not authorized to edit game statistics'; END IF;
 SELECT * INTO before_game FROM public.games WHERE id=p_game_id FOR UPDATE;
 IF NOT FOUND OR before_game.status<>'completed' THEN RAISE EXCEPTION 'Completed game required'; END IF;
 SELECT * INTO old_event FROM public.game_events WHERE id=p_event_id AND game_id=p_game_id FOR UPDATE;
 IF NOT FOUND OR old_event.type<>'shot' OR NOT EXISTS (
   SELECT 1 FROM public.apexvision_postgame_entries
   WHERE event_id=p_event_id AND game_id=p_game_id
 ) THEN RAISE EXCEPTION 'Only post-game recorded shots may be edited'; END IF;
 IF old_event.version<>p_expected_version THEN RAISE EXCEPTION 'Shot changed; refresh and retry'; END IF;
 IF p_team NOT IN ('us','opponent') OR p_made IS NULL OR p_x IS NULL OR p_y IS NULL OR
    p_x<10 OR p_x>850 OR p_y<10 OR p_y>460 THEN RAISE EXCEPTION 'Invalid shot correction'; END IF;
 IF p_player_id IS NOT NULL AND (p_team<>'us' OR NOT EXISTS (
   SELECT 1 FROM public.players WHERE id=p_player_id AND team_id=before_game.team_id
 )) THEN RAISE EXCEPTION 'Shooter must belong to the tracked team'; END IF;
 points_value:=public.apexvision_postgame_points(p_x,p_y);
 -- Never leave linked assists/rebounds/blocks attributed to an incompatible shot.
 IF (old_event.made IS DISTINCT FROM p_made OR old_event.team IS DISTINCT FROM p_team) AND EXISTS (
   SELECT 1 FROM public.game_events child WHERE child.game_id=p_game_id
     AND child.linked_event_id=p_event_id AND (
       (child.type='assist' AND (NOT p_made OR child.team<>p_team)) OR
       (child.type='block' AND (p_made OR child.team=p_team)) OR
       (child.type IN ('offensive_rebound','defensive_rebound','team_offensive_rebound','team_defensive_rebound') AND p_made)
     )
 ) THEN RAISE EXCEPTION 'Shot has incompatible linked stats; resolve those links before changing its team/result'; END IF;
 UPDATE public.game_events SET team=p_team,player_id=p_player_id,made=p_made,
    points=points_value,x=p_x,y=p_y,
    distance_meters=round((sqrt((p_x-(CASE WHEN p_x<430 THEN 57.25 ELSE 802.75 END))^2+(p_y-235)^2)/30)::numeric,2),
    distance_feet=round((sqrt((p_x-(CASE WHEN p_x<430 THEN 57.25 ELSE 802.75 END))^2+(p_y-235)^2)/30*3.28084)::numeric,2),
    version=version+1
 WHERE id=p_event_id AND game_id=p_game_id;
 SELECT * INTO after_game FROM public.games WHERE id=p_game_id;
 IF after_game.status IS DISTINCT FROM before_game.status OR
    after_game.team_score IS DISTINCT FROM before_game.team_score OR
    after_game.opponent_score IS DISTINCT FROM before_game.opponent_score THEN
   RAISE EXCEPTION 'Edit changed official game result; rolled back'; END IF;
 RETURN p_event_id;
END;$$;
CREATE OR REPLACE FUNCTION public.apexvision_postgame_delete_shot(
 p_game_id uuid,p_event_id uuid,p_expected_version integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_event public.game_events%ROWTYPE; before_game public.games%ROWTYPE;
        after_game public.games%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT private.apexvision_can_postgame_track(p_game_id) THEN
   RAISE EXCEPTION 'Not authorized to delete game statistics'; END IF;
 SELECT * INTO before_game FROM public.games WHERE id=p_game_id FOR UPDATE;
 IF NOT FOUND OR before_game.status<>'completed' THEN RAISE EXCEPTION 'Completed game required'; END IF;
 SELECT * INTO old_event FROM public.game_events WHERE id=p_event_id AND game_id=p_game_id FOR UPDATE;
 IF NOT FOUND OR old_event.type<>'shot' OR NOT EXISTS (
   SELECT 1 FROM public.apexvision_postgame_entries WHERE event_id=p_event_id AND game_id=p_game_id
 ) THEN RAISE EXCEPTION 'Only post-game recorded shots may be deleted'; END IF;
 IF old_event.version<>p_expected_version THEN RAISE EXCEPTION 'Shot changed; refresh and retry'; END IF;
 -- Never cascade into historic/live events or delete unrelated records.
 IF EXISTS (SELECT 1 FROM public.game_events child
   WHERE child.game_id=p_game_id AND child.linked_event_id=p_event_id
   AND NOT EXISTS (SELECT 1 FROM public.apexvision_postgame_entries entry
     WHERE entry.game_id=p_game_id AND entry.event_id=child.id))
 THEN RAISE EXCEPTION 'This shot has linked live events and cannot be deleted safely'; END IF;
 DELETE FROM public.apexvision_postgame_entries entry WHERE entry.game_id=p_game_id AND
   entry.event_id IN (SELECT id FROM public.game_events WHERE game_id=p_game_id AND linked_event_id=p_event_id);
 DELETE FROM public.game_events WHERE game_id=p_game_id AND linked_event_id=p_event_id;
 DELETE FROM public.apexvision_postgame_entries WHERE event_id=p_event_id AND game_id=p_game_id;
 DELETE FROM public.game_events WHERE id=p_event_id AND game_id=p_game_id;
 SELECT * INTO after_game FROM public.games WHERE id=p_game_id;
 IF after_game.status IS DISTINCT FROM before_game.status OR
    after_game.team_score IS DISTINCT FROM before_game.team_score OR
    after_game.opponent_score IS DISTINCT FROM before_game.opponent_score THEN
   RAISE EXCEPTION 'Delete changed official game result; rolled back'; END IF;
 RETURN p_event_id;
END;$$;
REVOKE ALL ON FUNCTION public.apexvision_postgame_edit_shot(uuid,uuid,integer,text,uuid,boolean,numeric,numeric) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.apexvision_postgame_delete_shot(uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apexvision_postgame_edit_shot(uuid,uuid,integer,text,uuid,boolean,numeric,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apexvision_postgame_delete_shot(uuid,uuid,integer) TO authenticated;
COMMIT;
