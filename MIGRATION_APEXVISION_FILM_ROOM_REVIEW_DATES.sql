-- Run ONLY in ApexVision-Test first, AFTER the existing three Film Room migrations.
-- Adds per-mode review dates without changing the existing 'film' activity key,
-- which now maps to the combined Stat & Shot Tracking user interface.
BEGIN;
ALTER TABLE public.apexvision_film_room_status
 ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
 ADD COLUMN IF NOT EXISTS last_reviewed_by uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS apexvision_film_room_review_dates_idx
 ON public.apexvision_film_room_status(game_id,last_reviewed_at DESC);
COMMIT;
