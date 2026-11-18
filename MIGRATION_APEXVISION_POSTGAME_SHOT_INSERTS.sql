-- Apply to ApexVision-Test only after the original Film Room migrations.
-- Places a newly recorded missing shot before an existing guided shot.
-- Does not modify game_events or the official final score.
BEGIN;
CREATE TABLE IF NOT EXISTS public.apexvision_postgame_shot_inserts (
 event_id uuid PRIMARY KEY REFERENCES public.game_events(id) ON DELETE CASCADE,
 game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
 before_event_id uuid NOT NULL REFERENCES public.game_events(id) ON DELETE CASCADE,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(event_id<>before_event_id)
);
CREATE INDEX IF NOT EXISTS apex_postgame_shot_inserts_by_game ON public.apexvision_postgame_shot_inserts(game_id,before_event_id,created_at);
ALTER TABLE public.apexvision_postgame_shot_inserts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apex_shot_inserts_read ON public.apexvision_postgame_shot_inserts;
CREATE POLICY apex_shot_inserts_read ON public.apexvision_postgame_shot_inserts
 FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
 WHERE g.id=game_id AND tm.user_id=auth.uid()));
DROP POLICY IF EXISTS apex_shot_inserts_insert ON public.apexvision_postgame_shot_inserts;
CREATE POLICY apex_shot_inserts_insert ON public.apexvision_postgame_shot_inserts
 FOR INSERT TO authenticated WITH CHECK(
 created_by=auth.uid() AND private.apexvision_can_postgame_track(game_id)
 AND EXISTS(SELECT 1 FROM public.games g WHERE g.id=game_id AND g.status='completed')
 AND EXISTS(
 SELECT 1 FROM public.game_events e JOIN public.game_events b ON b.id=before_event_id
 WHERE e.id=event_id AND e.game_id=game_id AND e.type='shot'
 AND b.game_id=game_id AND b.type='shot' AND b.period=e.period)
 );
GRANT SELECT,INSERT ON public.apexvision_postgame_shot_inserts TO authenticated;
COMMIT;
