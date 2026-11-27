-- ApexVision: allow authenticated members to read their team's recorded statistics.
-- Apply to staging first. This does NOT grant event write permissions.
-- Required by stats.js, which reads public.game_events for completed team games.
-- The existing "Authorized trackers can read events" SELECT policy remains in place.
--
-- Prerequisites: public.game_events(game_id), public.games(id,team_id),
-- public.team_members(team_id,user_id), and RLS enabled on public.game_events.
--
-- This policy is intentionally PERMISSIVE: membership OR existing tracker access
-- can authorize a SELECT. Any RESTRICTIVE policies still apply.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'game_events'
      AND policyname = 'Team members can view game statistics'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Team members can view game statistics"
      ON public.game_events
      AS PERMISSIVE
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.games g
          JOIN public.team_members tm ON tm.team_id = g.team_id
          WHERE g.id = game_events.game_id
            AND tm.user_id = (SELECT auth.uid())
        )
      )
    $policy$;
  END IF;
END
$$;

-- SELECT privilege may already exist; this guarantees the authenticated role
-- can read only rows allowed by RLS.
GRANT SELECT ON public.game_events TO authenticated;

COMMIT;

-- Staging verification:
-- 1. A 'member' of Team A can read Team A's completed game events/stats.
-- 2. That member cannot read Team B's events (unless separately a member).
-- 3. That member cannot INSERT / UPDATE / DELETE events through the app/API.
-- 4. Authorized trackers retain existing functionality.
-- 5. 'anon' cannot access protected event rows.
-- Do not apply to production before these tests pass.
