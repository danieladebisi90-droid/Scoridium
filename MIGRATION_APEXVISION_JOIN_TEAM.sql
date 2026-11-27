-- APEXVISION JOIN TEAM: staging migration; DO NOT apply to production without QA.
-- Run once on ApexVision-Test. Existing tracking tables are not changed.
CREATE TABLE IF NOT EXISTS public.apex_team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now()+ interval '30 days'),
  revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.apex_team_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_role text NOT NULL CHECK (requested_role IN ('coach','parent','player')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id),
  UNIQUE(team_id,user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS apex_team_members_unique_member ON public.team_members(team_id,user_id);
CREATE INDEX IF NOT EXISTS apex_team_invites_team_idx ON public.apex_team_invites(team_id);
CREATE INDEX IF NOT EXISTS apex_team_join_requests_team_idx ON public.apex_team_join_requests(team_id,status);
ALTER TABLE public.apex_team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apex_team_join_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apex_team_invites,public.apex_team_join_requests FROM PUBLIC,anon,authenticated;

-- Keep invitation hashes hidden. Only controlled RPCs can read/write private invite tables.
CREATE OR REPLACE FUNCTION public.apex_create_team_invite(p_team_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_code text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.team_members WHERE team_id=p_team_id AND user_id=auth.uid() AND role='head_coach'
 ) THEN RAISE EXCEPTION 'Only the team admin can create invitation codes.'; END IF;
 v_code := upper(encode(extensions.gen_random_bytes(6),'hex'));
 INSERT INTO public.apex_team_invites(team_id,code_hash,created_by)
 VALUES(p_team_id,encode(extensions.digest(v_code,'sha256'),'hex'),auth.uid());
 RETURN v_code;
END $$;

CREATE OR REPLACE FUNCTION public.apex_request_team_join(p_code text,p_role text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_team uuid;v_existing text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to join a team.'; END IF;
 IF p_role NOT IN ('coach','parent','player') OR p_role IS NULL THEN RAISE EXCEPTION 'Select a valid role.'; END IF;
 IF upper(btrim(coalesce(p_code,''))) !~ '^[0-9A-F]{12}$' THEN RAISE EXCEPTION 'Invalid invitation code.'; END IF;
 SELECT team_id INTO v_team FROM public.apex_team_invites
 WHERE code_hash=encode(extensions.digest(upper(btrim(p_code)),'sha256'),'hex')
   AND revoked_at IS NULL AND expires_at>now() LIMIT 1;
 IF v_team IS NULL THEN RAISE EXCEPTION 'Invalid or expired invitation code.'; END IF;
 IF EXISTS(SELECT 1 FROM public.team_members WHERE team_id=v_team AND user_id=auth.uid())
 THEN RETURN 'You are already a member of this team.'; END IF;
 INSERT INTO public.apex_team_join_requests(team_id,user_id,requested_role,status,created_at,decided_at,decided_by)
 VALUES(v_team,auth.uid(),p_role,'pending',now(),NULL,NULL)
 ON CONFLICT(team_id,user_id) DO UPDATE
 SET requested_role=excluded.requested_role,status='pending',created_at=now(),decided_at=NULL,decided_by=NULL;
 RETURN 'Request submitted. The team admin must approve it.';
END $$;

CREATE OR REPLACE FUNCTION public.apex_list_join_requests(p_team_id uuid)
RETURNS TABLE(request_id uuid,request_user_id uuid,requested_role text,requested_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.team_members WHERE team_id=p_team_id AND user_id=auth.uid() AND role='head_coach'
 ) THEN RAISE EXCEPTION 'Admin access required.'; END IF;
 RETURN QUERY SELECT r.id,r.user_id,r.requested_role,r.created_at
 FROM public.apex_team_join_requests r
 WHERE r.team_id=p_team_id AND r.status='pending' ORDER BY r.created_at;
END $$;

CREATE OR REPLACE FUNCTION public.apex_decide_join_request(p_request_id uuid,p_approve boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.apex_team_join_requests%ROWTYPE;v_role text;
BEGIN
 SELECT * INTO r FROM public.apex_team_join_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'pending' THEN RAISE EXCEPTION 'Request no longer pending.'; END IF;
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.team_members WHERE team_id=r.team_id AND user_id=auth.uid() AND role='head_coach'
 ) THEN RAISE EXCEPTION 'Admin access required.'; END IF;
 IF p_approve THEN
   -- Never assign powerful existing coach/tracker roles from a Join Team request.
   v_role := CASE r.requested_role WHEN 'coach' THEN 'coach_viewer' ELSE r.requested_role END;
   INSERT INTO public.team_members(team_id,user_id,role) VALUES(r.team_id,r.user_id,v_role)
   ON CONFLICT (team_id,user_id) DO NOTHING;
 END IF;
 UPDATE public.apex_team_join_requests SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
 decided_at=now(),decided_by=auth.uid() WHERE id=r.id;
 RETURN CASE WHEN p_approve THEN 'Membership approved.' ELSE 'Request rejected.' END;
END $$;

CREATE OR REPLACE FUNCTION public.apex_list_my_join_requests()
RETURNS TABLE(team_name text,requested_role text,status text,requested_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(nullif(t.club_name,''),nullif(t.school_name,''),t.mascot,'Team')::text,
 r.requested_role,r.status,r.created_at FROM public.apex_team_join_requests r
 JOIN public.teams t ON t.id=r.team_id WHERE r.user_id=auth.uid() ORDER BY r.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.apex_revoke_team_invites(p_team_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.team_members WHERE team_id=p_team_id AND user_id=auth.uid() AND role='head_coach'
 ) THEN RAISE EXCEPTION 'Admin access required.'; END IF;
 UPDATE public.apex_team_invites SET revoked_at=now()
 WHERE team_id=p_team_id AND revoked_at IS NULL AND expires_at>now();
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.apex_create_team_invite(uuid),public.apex_request_team_join(text,text),
 public.apex_list_join_requests(uuid),public.apex_decide_join_request(uuid,boolean),
 public.apex_list_my_join_requests(),public.apex_revoke_team_invites(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apex_create_team_invite(uuid),public.apex_request_team_join(text,text),
 public.apex_list_join_requests(uuid),public.apex_decide_join_request(uuid,boolean),
 public.apex_list_my_join_requests(),public.apex_revoke_team_invites(uuid) TO authenticated;
