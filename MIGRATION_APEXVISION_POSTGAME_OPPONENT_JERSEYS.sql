-- ApexVision-Test ONLY. Apply after the previously installed Film Room migrations.
-- Opponent jersey numbers cannot use tracked-team players foreign keys.
-- This table stores the explicitly selected opposing jersey for a shot.
BEGIN;
CREATE TABLE IF NOT EXISTS public.apexvision_postgame_opponent_jerseys (
 event_id uuid PRIMARY KEY REFERENCES public.game_events(id) ON DELETE CASCADE,
 game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
 jersey_number integer NOT NULL CHECK(jersey_number BETWEEN 0 AND 99),
 updated_by uuid NOT NULL REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS apex_postgame_opponent_jerseys_game_idx
 ON public.apexvision_postgame_opponent_jerseys(game_id);
ALTER TABLE public.apexvision_postgame_opponent_jerseys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apex_postgame_opponent_jerseys_read ON public.apexvision_postgame_opponent_jerseys;
CREATE POLICY apex_postgame_opponent_jerseys_read ON public.apexvision_postgame_opponent_jerseys
 FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
   WHERE g.id=game_id AND tm.user_id=auth.uid()));
DROP POLICY IF EXISTS apex_postgame_opponent_jerseys_insert ON public.apexvision_postgame_opponent_jerseys;
CREATE POLICY apex_postgame_opponent_jerseys_insert ON public.apexvision_postgame_opponent_jerseys
 FOR INSERT TO authenticated WITH CHECK(
 updated_by=auth.uid() AND private.apexvision_can_postgame_track(game_id)
 AND EXISTS(SELECT 1 FROM public.game_events e WHERE e.id=event_id AND e.game_id=game_id
  AND e.team='opponent' AND e.type='shot'));
DROP POLICY IF EXISTS apex_postgame_opponent_jerseys_update ON public.apexvision_postgame_opponent_jerseys;
CREATE POLICY apex_postgame_opponent_jerseys_update ON public.apexvision_postgame_opponent_jerseys
 FOR UPDATE TO authenticated
 USING(private.apexvision_can_postgame_track(game_id))
 WITH CHECK(updated_by=auth.uid() AND private.apexvision_can_postgame_track(game_id)
 AND EXISTS(SELECT 1 FROM public.game_events e WHERE e.id=event_id AND e.game_id=game_id
  AND e.team='opponent' AND e.type='shot'));
GRANT SELECT,INSERT,UPDATE ON public.apexvision_postgame_opponent_jerseys TO authenticated;
COMMIT;
