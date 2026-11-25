-- Applied to JogoManager Supabase production as migration 20261027220234.
-- Avoid scanning tens of thousands of injury rows per digest request.
-- Important: en_US.UTF-8 collation makes ASCII ':'..';' prefix range unsafe.
CREATE OR REPLACE FUNCTION public.get_public_league_digest_source(p_league_ids integer[])
RETURNS TABLE (league_id integer, payload jsonb, injury_count bigint)
LANGUAGE plpgsql
STABLE SECURITY INVOKER
SET search_path TO ''
ROWS 32
AS $function$
BEGIN
  IF p_league_ids IS NULL
     OR array_ndims(p_league_ids) IS DISTINCT FROM 1
     OR cardinality(p_league_ids) NOT BETWEEN 1 AND 32
     OR EXISTS (
       SELECT 1 FROM unnest(p_league_ids) AS ids(id)
       WHERE ids.id IS NULL OR ids.id <= 0
     ) THEN
    RAISE EXCEPTION 'Expected between 1 and 32 positive league IDs'
      USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH requested AS MATERIALIZED (
    SELECT u.id, min(u.ordinality) AS ord
    FROM unnest(p_league_ids) WITH ORDINALITY AS u(id, ordinality)
    GROUP BY u.id
  )
  SELECT r.id AS league_id, standings.payload,
    CASE
      WHEN r.id = ANY(ARRAY[71,72,39,140,135,78,61,94,88,128,253,262]::integer[])
      THEN coalesce(c.injury_count, 0::bigint)
      ELSE (
        SELECT count(*) FROM public.api_football_data injuries
        WHERE injuries.kind = 'injury'
          AND injuries.payload->'league'->>'id' = r.id::text
      )
    END AS injury_count
  FROM requested r
  LEFT JOIN LATERAL (
    SELECT a.payload
    FROM public.api_football_data a
    WHERE a.kind = 'standings'
      AND a.ref LIKE r.id::text || ':%'
    ORDER BY a.ref DESC
    LIMIT 1
  ) standings ON true
  LEFT JOIN private_performance.featured_injury_counts c
    ON c.league_id = r.id
  ORDER BY r.ord;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_public_league_digest_source(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_league_digest_source(integer[]) TO service_role;
COMMENT ON FUNCTION public.get_public_league_digest_source(integer[]) IS
 'Server-only league digest; featured league injury totals from 15-minute private MV. Other league IDs use live count. No client access to raw records.';
SELECT cron.schedule(
 'jm_refresh_featured_injury_counts_15m',
 '*/15 * * * *',
 'REFRESH MATERIALIZED VIEW CONCURRENTLY private_performance.featured_injury_counts'
);
