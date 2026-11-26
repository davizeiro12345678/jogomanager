-- Cut over the read-only digest only after the 64-shard counters reconcile.
-- Existing indexed standings range and function ACLs remain unchanged.
SET lock_timeout='2500ms';
SET statement_timeout='10000ms';
DO $validate$
BEGIN
 IF EXISTS (
    SELECT 1 FROM private_performance.featured_injury_counts_live a
    FULL JOIN private_performance.featured_injury_counts_sharded b USING(league_id)
    WHERE coalesce(a.injury_count,0)<>coalesce(b.injury_count,0)
 ) THEN RAISE EXCEPTION 'Cannot cut over mismatched injury counters'; END IF;
END
$validate$;
CREATE OR REPLACE FUNCTION public.get_public_league_digest_source(p_league_ids integer[])
RETURNS TABLE(league_id integer, payload jsonb, injury_count bigint)
LANGUAGE plpgsql
STABLE
ROWS 32
SET search_path TO ''
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
      -- Numeric season standings keys use '<league>:<season>'; explicit range
      -- bounds turn the large primary-key scan into an indexed lookup.
      AND a.ref >= r.id::text || ':'
      AND a.ref < r.id::text || ':z'
    ORDER BY a.ref DESC
    LIMIT 1
  ) standings ON true
  LEFT JOIN private_performance.featured_injury_counts_sharded c
    ON c.league_id = r.id
  ORDER BY r.ord;
END;
$function$;

ALTER FUNCTION public.get_public_league_digest_source(integer[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_public_league_digest_source(integer[])
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_league_digest_source(integer[]) TO service_role;
RESET statement_timeout;
RESET lock_timeout;
