-- Batch-only helper; returns NULL for any non-uniform batch.
CREATE OR REPLACE FUNCTION private_performance.bulk_upsert_football_rows(p_rows jsonb)
RETURNS integer[] LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $func$
DECLARE
  r record;
  total integer;
  inserted integer;
  changed integer;
  same integer;
BEGIN
  IF pg_catalog.jsonb_typeof(p_rows) IS DISTINCT FROM 'array'
  THEN RETURN NULL; END IF;
  total:=pg_catalog.jsonb_array_length(p_rows);
  IF total<8 OR total>300 THEN RETURN NULL; END IF;
  IF EXISTS(
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_rows) z(v)
    WHERE pg_catalog.jsonb_typeof(z.v) IS DISTINCT FROM 'object'
      OR z.v->>'kind' IS NULL OR z.v->>'ref' IS NULL
      OR NOT (z.v ? 'payload') OR NOT (z.v ? 'updated_at')
      OR pg_catalog.jsonb_typeof(z.v->'payload')='null'
      OR (z.v - 'kind' - 'ref' - 'payload' - 'updated_at') <> '{}'::jsonb
  ) THEN RETURN NULL; END IF;
  IF (
    SELECT count(*) FROM (
      SELECT z.v->>'kind',z.v->>'ref'
      FROM pg_catalog.jsonb_array_elements(p_rows) z(v) GROUP BY 1,2
    ) unique_ids
  ) <> total THEN RETURN NULL; END IF;

  FOR r IN
    SELECT x.kind,x.ref FROM pg_catalog.jsonb_to_recordset(p_rows)
      x(kind text,ref text) ORDER BY x.kind,x.ref
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('api_football_data' ||
        pg_catalog.format('kind IS NOT DISTINCT FROM %L AND ref IS NOT DISTINCT FROM %L',
          r.kind,r.ref),0));
  END LOOP;
  PERFORM t.ref FROM public.api_football_data t
    JOIN pg_catalog.jsonb_to_recordset(p_rows) x(kind text,ref text)
      ON t.kind=x.kind AND t.ref=x.ref
    ORDER BY t.kind,t.ref FOR UPDATE OF t;
  SELECT
    count(*) FILTER (WHERE t.ref IS NULL),
    count(*) FILTER (WHERE t.ref IS NOT NULL AND NOT (t.payload @> x.payload)),
    count(*) FILTER (WHERE t.ref IS NOT NULL AND (t.payload @> x.payload))
  INTO inserted,changed,same
  FROM pg_catalog.jsonb_to_recordset(p_rows)
    x(kind text,ref text,payload jsonb)
  LEFT JOIN public.api_football_data t ON t.kind=x.kind AND t.ref=x.ref;

  INSERT INTO public.api_football_data(kind,ref,payload,updated_at)
    SELECT x.kind,x.ref,x.payload,x.updated_at
    FROM pg_catalog.jsonb_to_recordset(p_rows)
      x(kind text,ref text,payload jsonb,updated_at timestamptz)
    ORDER BY x.kind,x.ref
    ON CONFLICT (kind,ref) DO UPDATE
      SET payload=excluded.payload,updated_at=excluded.updated_at
    WHERE NOT (public.api_football_data.payload @> excluded.payload);

  RETURN ARRAY[inserted,changed,same];
END
$func$;
REVOKE ALL ON FUNCTION private_performance.bulk_upsert_football_rows(jsonb) FROM PUBLIC, anon, authenticated;

