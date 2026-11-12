-- Server-side human moderation. Report tickets are the sole intake source.
-- No automated permanent penalty is issued by these functions.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE SCHEMA IF NOT EXISTS moderation_private;
REVOKE ALL ON SCHEMA moderation_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA moderation_private TO service_role;

CREATE TABLE moderation_private.moderators (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE moderation_private.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL UNIQUE REFERENCES public.support_tickets(id) ON DELETE RESTRICT,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  room_id uuid NOT NULL REFERENCES public.match_rooms(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','resolved')),
  decision text CHECK (decision IN ('dismissed','warning','temporary_mute')),
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewer_note text CHECK (reviewer_note IS NULL OR length(reviewer_note) BETWEEN 10 AND 1000),
  revision integer NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 1000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (reporter_id<>subject_id),
  CHECK (
    (state='open' AND decision IS NULL AND reviewer_id IS NULL) OR
    (state='resolved' AND decision IS NOT NULL AND reviewer_id IS NOT NULL AND reviewer_note IS NOT NULL)
  )
);
CREATE INDEX moderation_cases_state_created_idx
  ON moderation_private.cases(state,created_at);
CREATE TABLE moderation_private.appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL UNIQUE REFERENCES moderation_private.cases(id) ON DELETE CASCADE,
  appellant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  message text NOT NULL CHECK (length(btrim(message)) BETWEEN 20 AND 2000),
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','upheld','overturned')),
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewer_note text CHECK (reviewer_note IS NULL OR length(reviewer_note) BETWEEN 10 AND 1000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reviewed_at timestamptz,
  UNIQUE (appellant_id,request_id),
  CHECK ((state='open' AND reviewer_id IS NULL AND reviewed_at IS NULL)
    OR (state<>'open' AND reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL
      AND reviewer_note IS NOT NULL))
);
CREATE TABLE moderation_private.audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES moderation_private.cases(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  event text NOT NULL CHECK (event IN ('opened','decided','appealed','appeal_upheld','appeal_overturned')),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX moderation_audit_case_time_idx ON moderation_private.audit(case_id,occurred_at,id);

ALTER TABLE moderation_private.moderators ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_private.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_private.appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_private.audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA moderation_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA moderation_private FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA moderation_private TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA moderation_private TO service_role;

CREATE FUNCTION public.open_private_moderation_case(
  p_ticket uuid,p_room uuid,p_subject uuid,p_reporter uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
  v_room public.match_rooms%ROWTYPE;
  v_existing moderation_private.cases%ROWTYPE;
  v_case uuid;
BEGIN
  IF current_user<>'service_role' THEN
    RAISE EXCEPTION 'moderation_service_only' USING ERRCODE='42501';
  END IF;
  IF p_ticket IS NULL OR p_room IS NULL OR p_subject IS NULL OR p_reporter IS NULL THEN
    RAISE EXCEPTION 'invalid_report' USING ERRCODE='22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('moderation_ticket:' || p_ticket::text, 0));
  SELECT * INTO v_ticket FROM public.support_tickets WHERE id=p_ticket;
  IF NOT FOUND OR v_ticket.category<>'report' OR v_ticket.user_id<>p_reporter THEN
    RAISE EXCEPTION 'report_ticket_missing' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_room FROM public.match_rooms WHERE id=p_room;
  IF NOT FOUND OR v_room.guest_id IS NULL OR
    v_ticket.user_id NOT IN (v_room.host_id,v_room.guest_id) OR
    p_subject NOT IN (v_room.host_id,v_room.guest_id) OR
    v_ticket.user_id=p_subject THEN
    RAISE EXCEPTION 'report_room_membership_invalid' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_existing FROM moderation_private.cases
    WHERE ticket_id=p_ticket FOR UPDATE;
  IF FOUND THEN
    IF v_existing.reporter_id=v_ticket.user_id AND
      v_existing.subject_id=p_subject AND v_existing.room_id=p_room THEN
      RETURN jsonb_build_object('status','already_open','caseId',v_existing.id);
    END IF;
    RAISE EXCEPTION 'report_ticket_conflict' USING ERRCODE='23505';
  END IF;
  INSERT INTO moderation_private.cases(ticket_id,reporter_id,subject_id,room_id)
    VALUES(p_ticket,v_ticket.user_id,p_subject,p_room) RETURNING id INTO v_case;
  INSERT INTO moderation_private.audit(case_id,actor_id,event)
    VALUES(v_case,v_ticket.user_id,'opened');
  RETURN jsonb_build_object('status','opened','caseId',v_case);
END;
$fn$;

CREATE FUNCTION public.resolve_private_moderation_case(
  p_case uuid,p_reviewer uuid,p_revision integer,p_decision text,p_note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE v_case moderation_private.cases%ROWTYPE;
BEGIN
  IF current_user<>'service_role' THEN
    RAISE EXCEPTION 'moderation_service_only' USING ERRCODE='42501';
  END IF;
  IF p_case IS NULL OR p_reviewer IS NULL OR p_revision IS NULL OR p_revision<0
    OR p_decision NOT IN ('dismissed','warning','temporary_mute')
    OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'invalid_moderator_decision' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM moderation_private.moderators
    WHERE user_id=p_reviewer AND active) THEN
    RAISE EXCEPTION 'reviewer_not_authorized' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_case FROM moderation_private.cases WHERE id=p_case FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'moderation_case_missing' USING ERRCODE='22023'; END IF;
  IF v_case.state='resolved' THEN
    IF v_case.revision=p_revision+1 AND v_case.decision=p_decision
      AND v_case.reviewer_id=p_reviewer AND v_case.reviewer_note=btrim(p_note) THEN
      RETURN jsonb_build_object('status','already_resolved','revision',v_case.revision);
    END IF;
    RAISE EXCEPTION 'moderation_already_resolved' USING ERRCODE='23514';
  END IF;
  IF v_case.revision<>p_revision THEN
    RAISE EXCEPTION 'moderation_revision_conflict' USING ERRCODE='40001';
  END IF;
  UPDATE moderation_private.cases SET state='resolved',
    decision=p_decision,reviewer_id=p_reviewer,reviewer_note=btrim(p_note),
    revision=revision+1,updated_at=clock_timestamp() WHERE id=p_case;
  INSERT INTO moderation_private.audit(case_id,actor_id,event)
    VALUES(p_case,p_reviewer,'decided');
  RETURN jsonb_build_object('status','resolved','revision',p_revision+1);
END;
$fn$;

CREATE FUNCTION public.appeal_private_moderation_case(
  p_case uuid,p_appellant uuid,p_request uuid,p_message text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE v_case moderation_private.cases%ROWTYPE;
DECLARE v_prior moderation_private.appeals%ROWTYPE;
DECLARE v_appeal uuid;
BEGIN
  IF current_user<>'service_role' THEN
    RAISE EXCEPTION 'moderation_service_only' USING ERRCODE='42501';
  END IF;
  IF p_case IS NULL OR p_appellant IS NULL OR p_request IS NULL OR
    p_message IS NULL OR length(btrim(p_message)) NOT BETWEEN 20 AND 2000 THEN
    RAISE EXCEPTION 'invalid_appeal' USING ERRCODE='22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('moderation_appeal:' || p_case::text, 0));
  SELECT * INTO v_case FROM moderation_private.cases WHERE id=p_case FOR SHARE;
  IF NOT FOUND OR v_case.subject_id<>p_appellant OR
    v_case.state<>'resolved' OR v_case.decision='dismissed' THEN
    RAISE EXCEPTION 'appeal_unavailable' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_prior FROM moderation_private.appeals WHERE case_id=p_case FOR UPDATE;
  IF FOUND THEN
    IF v_prior.appellant_id=p_appellant AND v_prior.request_id=p_request AND
      v_prior.message=btrim(p_message) THEN
      RETURN jsonb_build_object('status','already_open','appealId',v_prior.id);
    END IF;
    RAISE EXCEPTION 'appeal_already_submitted' USING ERRCODE='23505';
  END IF;
  INSERT INTO moderation_private.appeals(case_id,appellant_id,request_id,message)
    VALUES(p_case,p_appellant,p_request,btrim(p_message)) RETURNING id INTO v_appeal;
  INSERT INTO moderation_private.audit(case_id,actor_id,event)
    VALUES(p_case,p_appellant,'appealed');
  RETURN jsonb_build_object('status','opened','appealId',v_appeal);
END;
$fn$;

CREATE FUNCTION public.review_private_moderation_appeal(
  p_appeal uuid,p_reviewer uuid,p_decision text,p_note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE v_appeal moderation_private.appeals%ROWTYPE;
DECLARE v_case moderation_private.cases%ROWTYPE;
BEGIN
  IF current_user<>'service_role' THEN
    RAISE EXCEPTION 'moderation_service_only' USING ERRCODE='42501';
  END IF;
  IF p_appeal IS NULL OR p_reviewer IS NULL OR
    p_decision NOT IN ('upheld','overturned') OR p_note IS NULL OR
    length(btrim(p_note)) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'invalid_appeal_decision' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM moderation_private.moderators
    WHERE user_id=p_reviewer AND active) THEN
    RAISE EXCEPTION 'reviewer_not_authorized' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_appeal FROM moderation_private.appeals WHERE id=p_appeal FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'appeal_missing' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_case FROM moderation_private.cases WHERE id=v_appeal.case_id;
  IF v_case.reviewer_id=p_reviewer THEN
    RAISE EXCEPTION 'appeal_requires_independent_reviewer' USING ERRCODE='42501';
  END IF;
  IF v_appeal.state<>'open' THEN
    IF v_appeal.state=p_decision AND v_appeal.reviewer_id=p_reviewer AND
       v_appeal.reviewer_note=btrim(p_note) THEN
      RETURN jsonb_build_object('status','already_reviewed');
    END IF;
    RAISE EXCEPTION 'appeal_already_reviewed' USING ERRCODE='23514';
  END IF;
  UPDATE moderation_private.appeals SET state=p_decision,reviewer_id=p_reviewer,
    reviewer_note=btrim(p_note),reviewed_at=clock_timestamp() WHERE id=p_appeal;
  INSERT INTO moderation_private.audit(case_id,actor_id,event)
    VALUES(v_case.id,p_reviewer,
      CASE WHEN p_decision='upheld' THEN 'appeal_upheld' ELSE 'appeal_overturned' END);
  RETURN jsonb_build_object('status',p_decision);
END;
$fn$;

REVOKE ALL ON FUNCTION public.open_private_moderation_case(uuid,uuid,uuid,uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.resolve_private_moderation_case(uuid,uuid,integer,text,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.appeal_private_moderation_case(uuid,uuid,uuid,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_private_moderation_appeal(uuid,uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.open_private_moderation_case(uuid,uuid,uuid,uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_private_moderation_case(uuid,uuid,integer,text,text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.appeal_private_moderation_case(uuid,uuid,uuid,text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.review_private_moderation_appeal(uuid,uuid,text,text)
  TO service_role;
COMMIT;
