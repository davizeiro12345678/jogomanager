-- Atomic lease acquisition for one safe API-Football batch. Only service_role can run this RPC.
CREATE OR REPLACE FUNCTION public.claim_api_football_import_phase()
RETURNS TABLE(out_phase text, out_offset integer, out_limit integer, out_token uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH next_job AS (
    SELECT candidate.phase
    FROM public.api_football_import_progress AS candidate
    WHERE candidate.status = 'queued'
       OR (candidate.status = 'running' AND candidate.lease_until < now())
    ORDER BY candidate.updated_at, candidate.phase
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.api_football_import_progress AS job
  SET status='running',lease_token=gen_random_uuid(),
      lease_until=now()+interval '100 seconds',updated_at=now(),error_message=NULL
  FROM next_job
  WHERE job.phase=next_job.phase
  RETURNING job.phase,job.next_offset,job.batch_size,job.lease_token;
$function$;
REVOKE ALL ON FUNCTION public.claim_api_football_import_phase() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_api_football_import_phase() TO service_role;
