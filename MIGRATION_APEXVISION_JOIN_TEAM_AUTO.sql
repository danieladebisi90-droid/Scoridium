-- Run ONLY on ApexVision-Test. Do not run the obsolete approval migration.
-- Secure token-enrollment, read-only coach/parent/player roles.
BEGIN;
CREATE TABLE IF NOT EXISTS public.apex_auto_team_invites (
  team_id uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE CHECK(token ~ '^[0-9A-F]{32}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  enabled boolean NOT NULL DEFAULT true
);
ALTER TABLE public.apex_auto_team_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apex_auto_team_invites FROM PUBLIC,anon,authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS apex_team_members_unique_member ON public.team_members(team_id,user_id);

CREATE OR REPLACE FUNCTION public.apex_auto_get_invite(p_team_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_token text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.team_members WHERE team_id=p_team_id AND user_id=auth.uid() AND role='head_coach')
 THEN RAISE EXCEPTION 'Admin permission required'; END IF;
 SELECT token INTO v_token FROM public.apex_auto_team_invites WHERE team_id=p_team_id AND enabled;
 RETURN v_token;
END $$;

CREATE OR REPLACE FUNCTION public.apex_auto_rotate_invite(p_team_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_token text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.team_members WHERE team_id=p_team_id AND user_id=auth.uid() AND role='head_coach')
 THEN RAISE EXCEPTION 'Admin permission required'; END IF;
 PERFORM 1 FROM public.teams WHERE id=p_team_id FOR UPDATE;
 v_token:=upper(encode(extensions.gen_random_bytes(16),'hex'));
 INSERT INTO public.apex_auto_team_invites(team_id,token,created_by,enabled,created_at)
 VALUES(p_team_id,v_token,auth.uid(),true,now())
 ON CONFLICT(team_id) DO UPDATE SET token=excluded.token,created_by=excluded.created_by,enabled=true,created_at=now();
 RETURN v_token;
END $$;

CREATE OR REPLACE FUNCTION public.apex_auto_disable_invite(p_team_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.team_members WHERE team_id=p_team_id AND user_id=auth.uid() AND role='head_coach')
 THEN RAISE EXCEPTION 'Admin permission required'; END IF;
 UPDATE public.apex_auto_team_invites SET enabled=false WHERE team_id=p_team_id;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.apex_auto_join_team(p_code text,p_kind text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_team uuid;v_role text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL)
 THEN RAISE EXCEPTION 'Verify your email first'; END IF;
 IF p_kind NOT IN ('viewer','parent','player','coach') OR p_kind IS NULL THEN RAISE EXCEPTION 'Choose a valid viewing role'; END IF;
 IF upper(trim(coalesce(p_code,''))) !~ '^[0-9A-F]{32}$' THEN RAISE EXCEPTION 'Invalid invitation code'; END IF;
 SELECT team_id INTO v_team FROM public.apex_auto_team_invites
 WHERE token=upper(trim(p_code)) AND enabled=true FOR SHARE;
 IF v_team IS NULL THEN RAISE EXCEPTION 'Invitation is invalid or disabled'; END IF;
 v_role:=CASE WHEN p_kind='coach' THEN 'coach_viewer' ELSE p_kind END;
 INSERT INTO public.team_members(team_id,user_id,role) VALUES(v_team,auth.uid(),v_role)
 ON CONFLICT(team_id,user_id) DO NOTHING;
 RETURN 'Team joined successfully';
END $$;

CREATE OR REPLACE FUNCTION public.apex_auto_list_members(p_team_id uuid)
RETURNS TABLE(user_id uuid,role text,email text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.team_members tm WHERE tm.team_id=p_team_id AND tm.user_id=auth.uid() AND tm.role='head_coach')
 THEN RAISE EXCEPTION 'Admin permission required'; END IF;
 RETURN QUERY SELECT tm.user_id,tm.role,u.email::text FROM public.team_members tm JOIN auth.users u ON u.id=tm.user_id
 WHERE tm.team_id=p_team_id ORDER BY tm.created_at;
END $$;

CREATE OR REPLACE FUNCTION public.apex_auto_remove_member(p_team_id uuid,p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.team_members tm WHERE tm.team_id=p_team_id AND tm.user_id=auth.uid() AND tm.role='head_coach')
 THEN RAISE EXCEPTION 'Admin permission required'; END IF;
 IF EXISTS(SELECT 1 FROM public.team_members WHERE team_id=p_team_id AND user_id=p_user_id AND role='head_coach')
 THEN RAISE EXCEPTION 'Cannot remove the team admin'; END IF;
 DELETE FROM public.team_members WHERE team_id=p_team_id AND user_id=p_user_id;
 RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.apex_auto_get_invite(uuid),public.apex_auto_rotate_invite(uuid),public.apex_auto_disable_invite(uuid),public.apex_auto_join_team(text,text),public.apex_auto_list_members(uuid),public.apex_auto_remove_member(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apex_auto_get_invite(uuid),public.apex_auto_rotate_invite(uuid),public.apex_auto_disable_invite(uuid),public.apex_auto_join_team(text,text),public.apex_auto_list_members(uuid),public.apex_auto_remove_member(uuid,uuid) TO authenticated;
-- Correct existing score submission policy: read-only members must not add score snapshots.
DROP POLICY IF EXISTS apex_score_snapshot_insert ON public.apexvision_score_snapshots;
CREATE POLICY apex_score_snapshot_insert ON public.apexvision_score_snapshots
 FOR INSERT TO authenticated WITH CHECK (
   submitted_by=auth.uid() AND private.can_track_game(game_id)
 );
COMMIT;
