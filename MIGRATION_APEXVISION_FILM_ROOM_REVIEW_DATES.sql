-- Run ONLY in ApexVision-Test first, AFTER the existing three Film Room migrations.
-- Adds per-mode review dates and a separate 'combined' activity key.
-- Preserves any historical 'film' activity records instead of reusing their status.
BEGIN;
ALTER TABLE public.apexvision_film_room_status
 DROP CONSTRAINT IF EXISTS apexvision_film_room_status_activity_check;
ALTER TABLE public.apexvision_film_room_status
 ADD CONSTRAINT apexvision_film_room_status_activity_check
 CHECK (activity IN ('stat','shot','film','combined'));
ALTER TABLE public.apexvision_film_room_status
 ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
 ADD COLUMN IF NOT EXISTS last_reviewed_by uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS apexvision_film_room_review_dates_idx
 ON public.apexvision_film_room_status(game_id,last_reviewed_at DESC);
COMMIT;
