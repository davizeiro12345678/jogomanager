-- Replace the 30-second hourly refresh of a 14 GB provider cache with an
-- incrementally maintained, small projection of the 12 featured injury leagues.
-- The legacy materialized view is retained temporarily for rollback, but its
-- cron refresh is unscheduled after the live projection is backfilled.

CREATE TABLE private_performance.featured_injury_rows (
  ref text PRIMARY KEY CHECK (char_length(ref) BETWEEN 1 AND 256),
  league_id integer NOT NULL CHECK (
    league_id = ANY (ARRAY[71,72,39,140,135,78,61,94,88,128,253,262]::integer[])
  )
);
ALTER TABLE private_performance.featured_injury_rows OWNER TO postgres;
ALTER TABLE private_performance.featured_injury_rows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private_performance.featured_injury_rows FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX featured_injury_rows_league_idx
  ON private_performance.featured_injury_rows (league_id);

CREATE OR REPLACE FUNCTION private_performance.sync_featured_injury_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_league_id integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM private_performance.featured_injury_rows WHERE ref = OLD.ref;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.kind = 'injury'
     AND (NEW.kind IS DISTINCT FROM 'injury' OR OLD.ref IS DISTINCT FROM NEW.ref)
  THEN
    DELETE FROM private_performance.featured_injury_rows WHERE ref = OLD.ref;
  END IF;

  IF NEW.kind IS DISTINCT FROM 'injury' THEN
    RETURN NEW;
  END IF;

  IF (NEW.payload -> 'league' ->> 'id') ~ '^[0-9]{1,9}$' THEN
    v_league_id := (NEW.payload -> 'league' ->> 'id')::integer;
  END IF;

  IF v_league_id = ANY (ARRAY[71,72,39,140,135,78,61,94,88,128,253,262]::integer[]) THEN
    INSERT INTO private_performance.featured_injury_rows AS current_row(ref, league_id)
    VALUES (NEW.ref, v_league_id)
    ON CONFLICT (ref) DO UPDATE
      SET league_id = EXCLUDED.league_id
      WHERE current_row.league_id IS DISTINCT FROM EXCLUDED.league_id;
  ELSE
    DELETE FROM private_performance.featured_injury_rows WHERE ref = NEW.ref;
  END IF;

  RETURN NEW;
END;
$function$;
ALTER FUNCTION private_performance.sync_featured_injury_row() OWNER TO postgres;
REVOKE ALL ON FUNCTION private_performance.sync_featured_injury_row() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS api_football_featured_injury_insert ON public.api_football_data;
CREATE TRIGGER api_football_featured_injury_insert
AFTER INSERT ON public.api_football_data
FOR EACH ROW
WHEN (NEW.kind = 'injury')
EXECUTE FUNCTION private_performance.sync_featured_injury_row();

DROP TRIGGER IF EXISTS api_football_featured_injury_update ON public.api_football_data;
CREATE TRIGGER api_football_featured_injury_update
AFTER UPDATE OF kind, ref, payload ON public.api_football_data
FOR EACH ROW
WHEN (OLD.kind = 'injury' OR NEW.kind = 'injury')
EXECUTE FUNCTION private_performance.sync_featured_injury_row();

DROP TRIGGER IF EXISTS api_football_featured_injury_delete ON public.api_football_data;
CREATE TRIGGER api_football_featured_injury_delete
AFTER DELETE ON public.api_football_data
FOR EACH ROW
WHEN (OLD.kind = 'injury')
EXECUTE FUNCTION private_performance.sync_featured_injury_row();

-- Apply this file as one transactional migration. CREATE TRIGGER obtains a
-- SHARE ROW EXCLUSIVE lock on the source table and retains it until commit, so
-- concurrent importer writes wait until the projection backfill is complete
-- and the triggers become visible atomically. Do not execute statements from
-- this file separately in autocommit mode.
--
-- ON CONFLICT DO NOTHING also makes the backfill safe if a projection row was
-- populated by a prior controlled retry; trigger updates remain authoritative.
INSERT INTO private_performance.featured_injury_rows(ref, league_id)
SELECT
  ref,
  (payload -> 'league' ->> 'id')::integer
FROM public.api_football_data
WHERE kind = 'injury'
  AND payload -> 'league' ->> 'id' = ANY (
    ARRAY['71','72','39','140','135','78','61','94','88','128','253','262']::text[]
  )
ON CONFLICT (ref) DO NOTHING;

-- Reconcile rows that were deleted or moved out of the featured set while the
-- snapshot backfill was scanning. The source triggers cover changes committed
-- after this cleanup statement's snapshot; this pass removes any stale row
-- inserted by the earlier backfill after a concurrent delete trigger ran.
DELETE FROM private_performance.featured_injury_rows AS summary
WHERE NOT EXISTS (
  SELECT 1
  FROM public.api_football_data AS source
  WHERE source.kind = 'injury'
    AND source.ref = summary.ref
    AND source.payload -> 'league' ->> 'id' = summary.league_id::text
);

ANALYZE private_performance.featured_injury_rows;

CREATE OR REPLACE VIEW private_performance.featured_injury_counts_live AS
SELECT league_id, count(*)::bigint AS injury_count
FROM private_performance.featured_injury_rows
GROUP BY league_id;
ALTER VIEW private_performance.featured_injury_counts_live OWNER TO postgres;
REVOKE ALL ON TABLE private_performance.featured_injury_counts_live FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private_performance TO service_role;
GRANT SELECT ON TABLE private_performance.featured_injury_counts_live TO service_role;

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
    ORDER BY a.ref DESC
    LIMIT 1
  ) standings ON true
  LEFT JOIN private_performance.featured_injury_counts_live c
    ON c.league_id = r.id
  ORDER BY r.ord;
END;
$function$;
ALTER FUNCTION public.get_public_league_digest_source(integer[]) OWNER TO postgres;

-- Keep the old materialized view for rollback, but stop the 30-second refresh.
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    FOR v_job_id IN EXECUTE
      'SELECT jobid FROM cron.job WHERE jobname = $1'
      USING 'jm_refresh_featured_injury_counts_15m'
    LOOP
      PERFORM cron.unschedule(v_job_id);
    END LOOP;
  END IF;
END;
$$;
