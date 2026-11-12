-- Run once in Supabase SQL Editor after reviewing your games table and RLS policies.
-- Must have games(id uuid, status text, current_period integer,
-- home_attacks_left_first_half boolean) and UPDATE permission under existing RLS.
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS home_attacks_left_first_half boolean NOT NULL DEFAULT true;
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS opening_tip_winner text;
ALTER TABLE public.games
  DROP CONSTRAINT IF EXISTS games_opening_tip_winner_check;
ALTER TABLE public.games
  ADD CONSTRAINT games_opening_tip_winner_check
  CHECK (opening_tip_winner IS NULL OR opening_tip_winner IN ('home','away'));

CREATE OR REPLACE FUNCTION public.confirm_game_tipoff(
  p_game_id uuid,
  p_winner text,
  p_home_attacks_left boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE saved public.games%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_winner NOT IN ('home','away') OR p_home_attacks_left IS NULL THEN
    RAISE EXCEPTION 'Invalid tip-off configuration';
  END IF;
  -- Atomic compare-and-swap: exactly one device may transition scheduled -> live.
  -- Existing RLS UPDATE policies still apply because this is SECURITY INVOKER.
  UPDATE public.games
  SET status='live',current_period=1,
      home_attacks_left_first_half=p_home_attacks_left,
      opening_tip_winner=p_winner
  WHERE id=p_game_id AND status='scheduled'
  RETURNING * INTO saved;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot start game; already started or update not permitted';
  END IF;
  RETURN jsonb_build_object(
    'id',saved.id,
    'status',saved.status,
    'current_period',saved.current_period,
    'home_attacks_left_first_half',saved.home_attacks_left_first_half,
    'opening_tip_winner',saved.opening_tip_winner
  );
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_game_tipoff(uuid,text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_game_tipoff(uuid,text,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_game_tipoff(uuid,text,boolean) TO authenticated;
-- Ensure public.games is included in the supabase_realtime publication for updates.
-- Verify UPDATE RLS policies restrict game-start permission to authorized team trackers.
