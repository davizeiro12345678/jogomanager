-- In production, create this same partial index concurrently in a separate
-- maintenance session before running the transactional migration.
CREATE INDEX IF NOT EXISTS api_football_standings_league_ref_idx
  ON public.api_football_data ((split_part(ref, ':', 1)), ref DESC)
  WHERE kind = 'standings';
--> statement-breakpoint
DO $migration$
DECLARE
  definition text;
  prefix_filter constant text := $filter$AND a.ref LIKE r.id::text || ':%'$filter$;
  league_filter constant text := $filter$split_part(a.ref, ':', 1) = r.id::text$filter$;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_index
    WHERE indexrelid = 'public.api_football_standings_league_ref_idx'::regclass
      AND indisvalid
  ) THEN
    RAISE EXCEPTION 'The standings lookup index is invalid';
  END IF;

  -- Production also uses a private injury rollup. Keep its query, permissions
  -- and return shape while adding the same indexed predicate as canonical replay.
  definition := pg_catalog.pg_get_functiondef(
    'public.get_public_league_digest_source(integer[])'::regprocedure
  );
  IF position(league_filter IN definition) = 0 THEN
    IF position(prefix_filter IN definition) = 0 OR
       length(definition) - length(replace(definition, prefix_filter, '')) <> length(prefix_filter)
    THEN
      RAISE EXCEPTION 'Unexpected standings lookup definition';
    END IF;
    EXECUTE replace(definition, prefix_filter, 'AND ' || league_filter || ' ' || prefix_filter);
  END IF;
END
$migration$;
