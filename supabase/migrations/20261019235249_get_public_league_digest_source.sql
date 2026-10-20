-- Additive, read-only source for the trusted server-side league digest.
-- Uses the existing (kind, ref) and injury league expression indexes.
CREATE FUNCTION public.get_public_league_digest_source(p_league_ids integer[])
RETURNS TABLE (league_id integer, payload jsonb, injury_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
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
  ), latest_standings AS (
    SELECT DISTINCT ON (r.id) r.id, a.payload
    FROM requested r
    JOIN public.api_football_data a
      ON a.kind = 'standings'
     AND split_part(a.ref, ':', 1) = r.id::text
     AND a.ref LIKE r.id::text || ':%'
    ORDER BY r.id, a.ref DESC
  )
  SELECT r.id AS league_id, standings.payload, injuries.injury_count
  FROM requested r
  LEFT JOIN latest_standings standings ON standings.id = r.id
  CROSS JOIN LATERAL (
    SELECT count(*) AS injury_count
    FROM public.api_football_data a
    WHERE a.kind = 'injury'
      AND a.payload->'league'->>'id' = r.id::text
  ) injuries
  ORDER BY r.ord;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_public_league_digest_source(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_league_digest_source(integer[]) TO service_role;

COMMENT ON FUNCTION public.get_public_league_digest_source(integer[]) IS
  'Bounded read-only inputs for the trusted server league digest. At most 32 positive IDs; duplicate IDs are collapsed. Raw standings remain server-side; only sanitized digest fields are returned by the application.';
