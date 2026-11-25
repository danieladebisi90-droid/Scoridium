-- Apply ONLY in ApexVision-Test after post-game tracking migrations.
-- Stores optional timestamps in the source video, independent of when an
-- event was entered. Does not affect game clock, scoring or official result.
BEGIN;
CREATE TABLE IF NOT EXISTS public.apexvision_postgame_timeline (
 event_id uuid PRIMARY KEY REFERENCES public.game_events(id) ON DELETE CASCADE,
 game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
 video_second integer NOT NULL CHECK (video_second>=0),
 updated_by uuid NOT NULL REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS apexvision_timeline_by_game_time
 ON public.apexvision_postgame_timeline(game_id,video_second);
ALTER TABLE public.apexvision_postgame_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apexvision_timeline_read ON public.apexvision_postgame_timeline;
CREATE POLICY apexvision_timeline_read ON public.apexvision_postgame_timeline FOR SELECT TO authenticated
 USING (EXISTS (
  SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
  WHERE g.id=game_id AND tm.user_id=auth.uid()
 ));
DROP POLICY IF EXISTS apexvision_timeline_insert ON public.apexvision_postgame_timeline;
CREATE POLICY apexvision_timeline_insert ON public.apexvision_postgame_timeline FOR INSERT TO authenticated
 WITH CHECK (updated_by=auth.uid() AND private.apexvision_can_postgame_track(game_id)
 AND EXISTS (SELECT 1 FROM public.game_events e WHERE e.id=event_id AND e.game_id=game_id));
DROP POLICY IF EXISTS apexvision_timeline_update ON public.apexvision_postgame_timeline;
CREATE POLICY apexvision_timeline_update ON public.apexvision_postgame_timeline FOR UPDATE TO authenticated
 USING (private.apexvision_can_postgame_track(game_id))
 WITH CHECK (updated_by=auth.uid() AND private.apexvision_can_postgame_track(game_id)
 AND EXISTS (SELECT 1 FROM public.game_events e WHERE e.id=event_id AND e.game_id=game_id));
GRANT SELECT,INSERT,UPDATE ON public.apexvision_postgame_timeline TO authenticated;
COMMIT;
