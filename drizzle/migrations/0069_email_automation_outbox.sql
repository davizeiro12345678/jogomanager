-- Durable service notifications originate in committed Auth/commerce records.
-- No network request runs inside an Auth or payment transaction.
CREATE SCHEMA IF NOT EXISTS email_automation_private;
REVOKE ALL ON SCHEMA email_automation_private FROM PUBLIC, anon, authenticated;

CREATE TABLE email_automation_private.outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id uuid NOT NULL,
  event_name text NOT NULL CHECK (event_name IN (
    'user.created', 'onboarding.guides_requested', 'career.backup_alert',
    'purchase.fulfilled', 'account.security_alert'
  )),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 2048),
  recipient_email text CHECK (char_length(recipient_email) BETWEEN 3 AND 254),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','leased','sent','dead','uncertain')),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 6),
  lease_token uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  completed_at timestamptz,
  last_http_status integer CHECK (last_http_status BETWEEN 100 AND 599),
  last_error text CHECK (last_error IN ('expired','lease_expired','recipient_changed','rejected','uncertain','rate_limited')),
  UNIQUE (event_name, source_id)
);
ALTER TABLE email_automation_private.outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON email_automation_private.outbox FROM PUBLIC, anon, authenticated;
CREATE INDEX email_automation_outbox_due_idx ON email_automation_private.outbox(next_attempt_at, created_at)
  WHERE status = 'queued';
CREATE INDEX email_automation_outbox_leases_idx ON email_automation_private.outbox(lease_until)
  WHERE status = 'leased';
CREATE INDEX email_automation_outbox_user_idx ON email_automation_private.outbox(user_id);

CREATE TABLE email_automation_private.dispatch_budget (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  hour_started timestamptz NOT NULL DEFAULT now(),
  hour_reserved integer NOT NULL DEFAULT 0 CHECK (hour_reserved BETWEEN 0 AND 120),
  minute_started timestamptz NOT NULL DEFAULT now(),
  minute_reserved integer NOT NULL DEFAULT 0 CHECK (minute_reserved BETWEEN 0 AND 20),
  next_send_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE email_automation_private.dispatch_budget ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON email_automation_private.dispatch_budget FROM PUBLIC, anon, authenticated;
INSERT INTO email_automation_private.dispatch_budget(singleton) VALUES (true);

CREATE FUNCTION email_automation_private.enqueue_confirmed_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  -- Existing confirmed accounts have no historical outbox row. Updating their
  -- already-confirmed timestamp must not create an accidental welcome backfill.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.email_confirmed_at IS NOT NULL THEN RETURN NEW; END IF;
  END IF;
  IF NEW.email_confirmed_at IS NOT NULL AND NEW.email IS NOT NULL
    AND NOT COALESCE(NEW.is_anonymous, false) AND NEW.deleted_at IS NULL THEN
    INSERT INTO email_automation_private.outbox(user_id, source_id, event_name, payload)
    VALUES (NEW.id, NEW.id, 'user.created', jsonb_build_object('user_id', NEW.id::text, 'locale', 'pt-BR'))
    ON CONFLICT (event_name, source_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION email_automation_private.enqueue_confirmed_user() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enqueue_email_automation_confirmed_user
AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION email_automation_private.enqueue_confirmed_user();

CREATE FUNCTION email_automation_private.enqueue_fulfilled_purchase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS NOT DISTINCT FROM 'completed' THEN RETURN NEW; END IF;
  END IF;
  IF NEW.status = 'completed' THEN
    INSERT INTO email_automation_private.outbox(user_id, source_id, event_name, payload)
    VALUES (NEW.user_id, NEW.id, 'purchase.fulfilled',
      jsonb_build_object('user_id', NEW.user_id::text, 'order_id', NEW.id::text))
    ON CONFLICT (event_name, source_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION email_automation_private.enqueue_fulfilled_purchase() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enqueue_email_automation_fulfilled_purchase
AFTER INSERT OR UPDATE OF status ON public.user_purchases
FOR EACH ROW EXECUTE FUNCTION email_automation_private.enqueue_fulfilled_purchase();

CREATE FUNCTION public.claim_email_automation()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_budget email_automation_private.dispatch_budget%ROWTYPE;
  v_row email_automation_private.outbox%ROWTYPE;
  v_email text;
  v_token uuid;
BEGIN
  -- Serialize admission across all workers, not only this process.
  SELECT * INTO v_budget FROM email_automation_private.dispatch_budget WHERE singleton FOR UPDATE;
  -- /events/send has no documented exactly-once contract. Never automatically
  -- reclaim a lease that might already have fired the provider automation.
  UPDATE email_automation_private.outbox SET status = 'uncertain', last_error = 'lease_expired'
  WHERE id IN (SELECT id FROM email_automation_private.outbox
    WHERE status = 'leased' AND lease_until <= v_now ORDER BY lease_until LIMIT 100);
  UPDATE email_automation_private.outbox SET status = 'dead', last_error = 'expired',
    recipient_email = NULL, payload = '{}'::jsonb, completed_at = v_now
  WHERE id IN (SELECT id FROM email_automation_private.outbox
    WHERE status IN ('queued','uncertain') AND created_at < v_now - interval '7 days' ORDER BY created_at LIMIT 100);

  IF v_budget.hour_started <= v_now - interval '1 hour' THEN
    v_budget.hour_started := v_now; v_budget.hour_reserved := 0;
  END IF;
  IF v_budget.minute_started <= v_now - interval '1 minute' THEN
    v_budget.minute_started := v_now; v_budget.minute_reserved := 0;
  END IF;
  IF v_budget.hour_reserved >= 120 OR v_budget.minute_reserved >= 20 OR v_budget.next_send_at > v_now THEN
    RETURN NULL;
  END IF;

  SELECT event.* INTO v_row
  FROM email_automation_private.outbox event JOIN auth.users account ON account.id = event.user_id
  WHERE event.status = 'queued' AND event.attempts < 6 AND event.next_attempt_at <= v_now
    AND event.created_at >= v_now - interval '7 days'
    AND account.email_confirmed_at IS NOT NULL AND NOT COALESCE(account.is_anonymous, false)
    AND account.deleted_at IS NULL AND (account.banned_until IS NULL OR account.banned_until <= v_now)
    AND char_length(account.email) BETWEEN 3 AND 254
    AND account.email !~ '[[:cntrl:]]' AND account.email = btrim(account.email)
  ORDER BY event.next_attempt_at, event.created_at, event.id
  LIMIT 1 FOR UPDATE OF event SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT account.email INTO v_email FROM auth.users account WHERE account.id = v_row.user_id
    AND account.email_confirmed_at IS NOT NULL AND NOT COALESCE(account.is_anonymous, false)
    AND account.deleted_at IS NULL AND (account.banned_until IS NULL OR account.banned_until <= v_now)
    AND char_length(account.email) BETWEEN 3 AND 254
    AND account.email !~ '[[:cntrl:]]' AND account.email = btrim(account.email);
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_row.recipient_email IS NOT NULL AND v_row.recipient_email <> v_email THEN
    UPDATE email_automation_private.outbox SET status = 'dead', last_error = 'recipient_changed',
      recipient_email = NULL, payload = '{}'::jsonb, completed_at = v_now WHERE id = v_row.id;
    RETURN NULL;
  END IF;

  v_token := gen_random_uuid();
  UPDATE email_automation_private.outbox SET status = 'leased', lease_token = v_token,
    lease_until = v_now + interval '2 minutes', recipient_email = v_email,
    attempts = attempts + 1, last_attempt_at = v_now WHERE id = v_row.id;
  UPDATE email_automation_private.dispatch_budget SET
    hour_started = v_budget.hour_started, hour_reserved = v_budget.hour_reserved + 1,
    minute_started = v_budget.minute_started, minute_reserved = v_budget.minute_reserved + 1,
    next_send_at = v_now + interval '600 milliseconds' WHERE singleton;
  RETURN jsonb_build_object('id', v_row.id, 'lease_token', v_token, 'event_name', v_row.event_name,
    'user_id', v_row.user_id, 'source_id', v_row.source_id, 'recipient_email', v_email,
    'payload', v_row.payload, 'attempts', v_row.attempts + 1);
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_email_automation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_automation() TO service_role;

CREATE FUNCTION public.complete_email_automation(
  p_id uuid, p_lease_token uuid, p_outcome text, p_http_status integer DEFAULT NULL,
  p_retry_after_seconds integer DEFAULT 0
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_row email_automation_private.outbox%ROWTYPE;
  v_status text;
  v_delay integer := 0;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_id IS NULL OR p_lease_token IS NULL OR p_outcome IS NULL
    OR p_outcome NOT IN ('sent','retry','dead','uncertain')
    OR (p_http_status IS NOT NULL AND p_http_status NOT BETWEEN 100 AND 599)
    OR p_retry_after_seconds IS NULL OR p_retry_after_seconds NOT BETWEEN 0 AND 86400
    OR (p_outcome = 'retry' AND p_http_status IS DISTINCT FROM 429)
    OR (p_outcome = 'sent' AND p_http_status IS DISTINCT FROM 202)
  THEN RAISE EXCEPTION 'email_automation_completion_invalid' USING ERRCODE = '22023'; END IF;
  -- Same lock order as claim: global budget before an outbox row. Otherwise
  -- applying a provider cooldown can deadlock with expired-lease maintenance.
  IF p_outcome = 'retry' THEN
    PERFORM 1 FROM email_automation_private.dispatch_budget WHERE singleton FOR UPDATE;
  END IF;
  SELECT * INTO v_row FROM email_automation_private.outbox WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_row.lease_token IS DISTINCT FROM p_lease_token THEN RETURN false; END IF;
  v_status := CASE WHEN p_outcome = 'retry' THEN CASE WHEN v_row.attempts >= 6 THEN 'dead' ELSE 'queued' END ELSE p_outcome END;
  IF v_row.status NOT IN ('leased','uncertain') THEN RETURN v_row.status = v_status; END IF;
  v_now := clock_timestamp();
  IF p_outcome = 'retry' THEN
    v_delay := greatest(60 * power(2, greatest(0, v_row.attempts - 1))::integer, p_retry_after_seconds);
    -- A 429 limits this provider/key, not merely the current recipient. Keep
    -- every other event behind the cooldown, including after retry exhaustion.
    UPDATE email_automation_private.dispatch_budget
      SET next_send_at = greatest(next_send_at, v_now + make_interval(secs => v_delay))
      WHERE singleton;
  END IF;
  UPDATE email_automation_private.outbox SET
    status = v_status, lease_until = NULL, last_http_status = p_http_status,
    next_attempt_at = CASE WHEN v_status = 'queued' THEN v_now + make_interval(secs => v_delay) ELSE next_attempt_at END,
    last_error = CASE p_outcome WHEN 'sent' THEN NULL WHEN 'retry' THEN 'rate_limited'
      WHEN 'dead' THEN 'rejected' ELSE 'uncertain' END,
    completed_at = CASE WHEN v_status IN ('sent','dead') THEN v_now ELSE NULL END,
    recipient_email = CASE WHEN v_status IN ('sent','dead') THEN NULL ELSE recipient_email END,
    payload = CASE WHEN v_status IN ('sent','dead') THEN '{}'::jsonb ELSE payload END
  WHERE id = p_id;
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.complete_email_automation(uuid,uuid,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_email_automation(uuid,uuid,text,integer,integer) TO service_role;

NOTIFY pgrst, 'reload schema';
