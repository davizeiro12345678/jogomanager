-- Complete one leased batch only when the original lease token still owns the phase.
CREATE OR REPLACE FUNCTION public.complete_api_football_import_phase(
  p_phase text, p_token uuid, p_processed integer, p_next_offset integer,
  p_error text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE public.api_football_import_progress AS job
  SET
    status=CASE
      WHEN p_error IS NOT NULL AND p_error LIKE '%quota%' THEN 'paused'
      WHEN p_error IS NOT NULL THEN 'failed'
      WHEN p_next_offset IS NULL THEN 'completed'
      ELSE 'queued'
    END,
    next_offset=CASE
      WHEN p_error IS NULL AND p_next_offset IS NOT NULL
        THEN p_next_offset
      ELSE job.next_offset
    END,
    total_processed=job.total_processed+CASE
      WHEN p_error IS NULL THEN GREATEST(0,p_processed) ELSE 0
    END,
    error_message=LEFT(p_error,1000),
    lease_token=NULL,
    lease_until=NULL,
    updated_at=now()
  WHERE job.phase=p_phase
    AND job.status='running'
    AND job.lease_token=p_token;
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows=1;
END;
$function$;
REVOKE ALL ON FUNCTION public.complete_api_football_import_phase(text,uuid,integer,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_api_football_import_phase(text,uuid,integer,integer,text) TO service_role;
