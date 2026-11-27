-- ApexVision score-submission read policy fix.
-- Tested in ApexVision-Test. Apply to production ONLY after score-submission
-- tables and functions are installed, and after cross-team access tests.
--
-- Fixes original policy's tautology: tm.team_id = tm.team_id
-- The member must belong to this submission's actual team.
--
-- Read-only authorization:
-- * Submitter can see their own submissions.
-- * A team member can see APPROVED submissions for their team.
-- * A team coach/manager can also see unapproved submissions for their team.
-- This migration does not grant INSERT, UPDATE, DELETE or EXECUTE.
BEGIN;

DROP POLICY IF EXISTS apexvision_scores_read ON public.apexvision_score_submissions;

CREATE POLICY apexvision_scores_read
ON public.apexvision_score_submissions
AS PERMISSIVE
FOR SELECT TO authenticated
USING (
  submitted_by = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id = apexvision_score_submissions.team_id
      AND tm.user_id = (SELECT auth.uid())
      AND (
        apexvision_score_submissions.status = 'approved'
        OR tm.role = ANY (ARRAY[
          'head_coach', 'coach', 'assistant_coach', 'manager'
        ])
      )
  )
);

COMMIT;

-- Verification notes:
-- On staging, pg_policies.qual verified exact team_id comparison.
-- At verification time, staging had one team and zero score submissions:
-- actual cross-team/score-access behavioral tests are NOT yet completed.
-- Do not claim deployment readiness based solely on policy inspection.
