-- Apply MIGRATION_APEXVISION_POSTGAME_TRACKING.sql before this migration.
-- ApexVision Film Room activity status (staging first).
-- Requires public.games, public.team_members and private.can_track_game(uuid).
BEGIN;
CREATE TABLE IF NOT EXISTS public.apexvision_film_room_status (
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  activity text NOT NULL CHECK (activity IN ('stat','shot','film')),
  status text NOT NULL CHECK (status IN ('in_progress','completed')),
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(game_id,activity)
);
ALTER TABLE public.apexvision_film_room_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apex_room_read ON public.apexvision_film_room_status;
CREATE POLICY apex_room_read ON public.apexvision_film_room_status FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.games g JOIN public.team_members tm ON tm.team_id=g.team_id
  WHERE g.id=game_id AND tm.user_id=auth.uid()
));
DROP POLICY IF EXISTS apex_room_insert ON public.apexvision_film_room_status;
CREATE POLICY apex_room_insert ON public.apexvision_film_room_status FOR INSERT TO authenticated
WITH CHECK(updated_by=auth.uid() AND private.apexvision_can_postgame_track(game_id));
DROP POLICY IF EXISTS apex_room_update ON public.apexvision_film_room_status;
CREATE POLICY apex_room_update ON public.apexvision_film_room_status FOR UPDATE TO authenticated
USING(private.apexvision_can_postgame_track(game_id))
WITH CHECK(updated_by=auth.uid() AND private.apexvision_can_postgame_track(game_id));
GRANT SELECT,INSERT,UPDATE ON public.apexvision_film_room_status TO authenticated;
COMMIT;