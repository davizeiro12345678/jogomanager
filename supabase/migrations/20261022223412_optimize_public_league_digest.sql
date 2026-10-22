-- Only standings belong in this index. Do not index the multi-GB payload or
-- add maintenance work to unrelated raw player/fixture records.
CREATE INDEX IF NOT EXISTS api_football_standings_league_latest_idx
ON public.api_football_data ((split_part(ref, ':', 1)), ref DESC)
WHERE kind = 'standings';

CREATE OR REPLACE FUNCTION public.get_public_league_digest_source(p_league_ids integer[])
RETURNS TABLE(league_id integer, payload jsonb, injury_count bigint)
LANGUAGE plpgsql STABLE ROWS 32
SET search_path = ''
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
  SELECT r.id AS league_id, standings.payload, injuries.injury_count
  FROM requested r
  LEFT JOIN LATERAL (
    SELECT a.payload
    FROM public.api_football_data a
    WHERE a.kind = 'standings'
      AND split_part(a.ref, ':', 1) = r.id::text
      AND a.ref LIKE r.id::text || ':%'
    ORDER BY a.ref DESC
    LIMIT 1
  ) standings ON true
  CROSS JOIN LATERAL (
    SELECT count(*) AS injury_count
    FROM public.api_football_data a
    WHERE a.kind = 'injury'
      AND a.payload->'league'->>'id' = r.id::text
  ) injuries
  ORDER BY r.ord;
END;
$function$;

-- Preserve the existing server-only privilege boundary, including on replay.
REVOKE ALL ON FUNCTION public.get_public_league_digest_source(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_league_digest_source(integer[]) TO service_role;
