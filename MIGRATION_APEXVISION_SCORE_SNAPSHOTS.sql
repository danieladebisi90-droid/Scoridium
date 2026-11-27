-- Game score snapshots: no official game status or player stats are modified here.
-- Run in staging and verify membership checks before production.
BEGIN;
CREATE TABLE IF NOT EXISTS public.apexvision_score_snapshots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
 team_score integer NOT NULL CHECK(team_score BETWEEN 0 AND 500),
 opponent_score integer NOT NULL CHECK(opponent_score BETWEEN 0 AND 500),
 score_point text NOT NULL CHECK(score_point IN ('quarter','final','random')),
 period integer CHECK(period BETWEEN 1 AND 20),
 submitted_by uuid NOT NULL REFERENCES auth.users(id),
 submitted_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT score_snapshot_period CHECK((score_point='final' AND period IS NULL) OR (score_point<>'final' AND period IS NOT NULL)),
 CONSTRAINT score_snapshot_final_winner CHECK(score_point<>'final' OR team_score<>opponent_score)
);
CREATE INDEX IF NOT EXISTS apex_score_snapshot_recent ON public.apexvision_score_snapshots(game_id,submitted_at DESC);
ALTER TABLE public.apexvision_score_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apex_score_snapshot_read ON public.apexvision_score_snapshots;
CREATE POLICY apex_score_snapshot_read ON public.apexvision_score_snapshots FOR SELECT TO authenticated
USING (EXISTS(SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id WHERE g.id=game_id AND tm.user_id=auth.uid()));
DROP POLICY IF EXISTS apex_score_snapshot_insert ON public.apexvision_score_snapshots;
CREATE POLICY apex_score_snapshot_insert ON public.apexvision_score_snapshots FOR INSERT TO authenticated
WITH CHECK(submitted_by=auth.uid() AND EXISTS(SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id WHERE g.id=game_id AND tm.user_id=auth.uid()));
GRANT SELECT,INSERT ON public.apexvision_score_snapshots TO authenticated;
COMMIT;