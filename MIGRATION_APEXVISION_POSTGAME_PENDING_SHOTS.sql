-- ApexVision-Test ONLY: post-game shot observations awaiting manual reconciliation.
-- These rows NEVER count as a shot, points or changes to the official final score.
-- Run after MIGRATION_APEXVISION_POSTGAME_TRACKING.sql in ApexVision-Test only.
BEGIN;
CREATE TABLE IF NOT EXISTS public.apexvision_postgame_pending_shots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
 period integer NOT NULL CHECK (period BETWEEN 1 AND 20),
 team text NOT NULL CHECK(team IN ('us','opponent')),
 points integer NOT NULL CHECK(points IN (2,3)),
 made boolean NOT NULL,
 x numeric NOT NULL CHECK(x BETWEEN 10 AND 850),
 y numeric NOT NULL CHECK(y BETWEEN 10 AND 460),
 player_id uuid NULL REFERENCES public.players(id),
 category text NULL,
 opponent_jersey integer NULL CHECK(opponent_jersey BETWEEN 0 AND 99),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 resolved_event_id uuid NULL REFERENCES public.game_events(id),
 resolved_at timestamptz NULL,
 CONSTRAINT apex_pending_category_check CHECK(category IS NULL OR category IN
   ('catch_shoot','pull_up','drive','post','putback','other'))
);
CREATE INDEX IF NOT EXISTS apex_pending_game_period ON public.apexvision_postgame_pending_shots(game_id,period,created_at);
ALTER TABLE public.apexvision_postgame_pending_shots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apex_pending_read ON public.apexvision_postgame_pending_shots;
CREATE POLICY apex_pending_read ON public.apexvision_postgame_pending_shots
 FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
  WHERE g.id=public.apexvision_postgame_pending_shots.game_id AND tm.user_id=auth.uid()));
DROP POLICY IF EXISTS apex_pending_insert ON public.apexvision_postgame_pending_shots;
CREATE POLICY apex_pending_insert ON public.apexvision_postgame_pending_shots
 FOR INSERT TO authenticated
 WITH CHECK(created_by=auth.uid() AND private.apexvision_can_postgame_track(public.apexvision_postgame_pending_shots.game_id)
 AND EXISTS(SELECT 1 FROM public.games g WHERE g.id=public.apexvision_postgame_pending_shots.game_id AND g.status='completed')
 AND (player_id IS NULL OR (team='us' AND EXISTS(
 SELECT 1 FROM public.players p JOIN public.games g ON g.team_id=p.team_id
 WHERE g.id=public.apexvision_postgame_pending_shots.game_id AND p.id=public.apexvision_postgame_pending_shots.player_id))));
DROP POLICY IF EXISTS apex_pending_update ON public.apexvision_postgame_pending_shots;
CREATE POLICY apex_pending_update ON public.apexvision_postgame_pending_shots
 FOR UPDATE TO authenticated USING(private.apexvision_can_postgame_track(public.apexvision_postgame_pending_shots.game_id))
 WITH CHECK(private.apexvision_can_postgame_track(public.apexvision_postgame_pending_shots.game_id) AND
 (resolved_event_id IS NULL OR EXISTS(
 SELECT 1 FROM public.game_events e WHERE e.id=public.apexvision_postgame_pending_shots.resolved_event_id AND e.game_id=public.apexvision_postgame_pending_shots.game_id
 AND e.period=public.apexvision_postgame_pending_shots.period AND e.team=public.apexvision_postgame_pending_shots.team AND e.type='shot' AND e.points=public.apexvision_postgame_pending_shots.points AND e.made=public.apexvision_postgame_pending_shots.made)));
DROP POLICY IF EXISTS apex_pending_delete ON public.apexvision_postgame_pending_shots;
CREATE POLICY apex_pending_delete ON public.apexvision_postgame_pending_shots
 FOR DELETE TO authenticated USING(private.apexvision_can_postgame_track(public.apexvision_postgame_pending_shots.game_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.apexvision_postgame_pending_shots TO authenticated;
COMMIT;
