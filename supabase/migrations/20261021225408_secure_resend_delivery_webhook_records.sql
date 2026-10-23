-- Applied to production via Supabase migration API on 2026-10-21.
-- No public data exposure: event IDs only, never email addresses or raw payloads.
CREATE SCHEMA IF NOT EXISTS auth_safety;
REVOKE ALL ON SCHEMA auth_safety FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA auth_safety TO service_role;
CREATE TABLE IF NOT EXISTS auth_safety.resend_delivery_events (
  event_id text PRIMARY KEY CHECK (length(event_id) BETWEEN 3 AND 200),
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY[
    'email.sent','email.delivered','email.delivery_delayed',
    'email.failed','email.bounced','email.complained','email.suppressed'
  ])),
  email_id text CHECK (email_id IS NULL OR length(email_id)<=200),
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE auth_safety.resend_delivery_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON auth_safety.resend_delivery_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON auth_safety.resend_delivery_events TO service_role;

CREATE OR REPLACE FUNCTION public.jm_resend_webhook_signing_key()
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE key_value text;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE EXCEPTION 'Vault not installed';
  END IF;
  EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name=$1 ORDER BY created_at DESC LIMIT 1'
    INTO key_value USING 'jgm_resend_webhook_signing';
  RETURN key_value;
END; $$;
REVOKE ALL ON FUNCTION public.jm_resend_webhook_signing_key() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jm_resend_webhook_signing_key() TO service_role;

CREATE OR REPLACE FUNCTION public.jm_store_resend_delivery_event(
  p_event_id text,p_event_type text,p_email_id text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE was_inserted boolean;
BEGIN
  IF p_event_id IS NULL OR length(p_event_id) NOT BETWEEN 3 AND 200
    OR p_event_type IS NULL OR p_event_type <> ALL(ARRAY[
      'email.sent','email.delivered','email.delivery_delayed','email.failed',
      'email.bounced','email.complained','email.suppressed'
    ]) OR (p_email_id IS NOT NULL AND length(p_email_id)>200) THEN
    RAISE EXCEPTION 'Invalid event';
  END IF;
  INSERT INTO auth_safety.resend_delivery_events(event_id,event_type,email_id)
  VALUES(p_event_id,p_event_type,p_email_id)
  ON CONFLICT(event_id) DO NOTHING;
  GET DIAGNOSTICS was_inserted=ROW_COUNT;
  RETURN was_inserted;
END; $$;
REVOKE ALL ON FUNCTION public.jm_store_resend_delivery_event(text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jm_store_resend_delivery_event(text,text,text) TO service_role;
