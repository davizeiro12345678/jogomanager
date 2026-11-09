-- Align the durable API-Football worker queue with the 48-lane Edge Function.
-- The quota remains enforced independently by reserve_provider_call() at
-- <=20 requests/second, <=1200 requests/minute and <=450000 requests/UTC day.
-- Re-running this migration is safe: it replaces the function without
-- resetting leases, queue progress, receipts or configured quotas.
CREATE OR REPLACE FUNCTION public.football_queue_claim()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE j football_import_private.jobs%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(724019101);
  UPDATE football_import_private.jobs
    SET status='pending', lease_token=NULL, lease_until=NULL
    WHERE status='running' AND lease_until < now();
  IF (SELECT count(*) FROM football_import_private.jobs WHERE status='running') >= 48 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO j FROM football_import_private.jobs
    WHERE status IN ('pending','failed') AND retry_at <= now() AND attempts < 8
    ORDER BY priority, path FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE football_import_private.jobs
    SET status='running', attempts=attempts+1,
        lease_token=gen_random_uuid(), lease_until=now()+interval '120 seconds'
    WHERE path=j.path RETURNING * INTO j;
  RETURN to_jsonb(j);
END $function$;

REVOKE ALL ON FUNCTION public.football_queue_claim() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.football_queue_claim() TO service_role;
