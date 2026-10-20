-- Client-side COPY decoding only. This code never reads server files or runs dump DDL.
CREATE SCHEMA IF NOT EXISTS backup_restore;
REVOKE ALL ON SCHEMA backup_restore FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA backup_restore TO service_role;
CREATE TABLE IF NOT EXISTS backup_restore.runs (
  id uuid PRIMARY KEY, token_hash text NOT NULL CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  archive_sha256 text NOT NULL CHECK (archive_sha256 ~ '^[a-f0-9]{64}$'),
  allowed_targets text[] NOT NULL, expires_at timestamptz NOT NULL,
  closed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS backup_restore.batches (
  run_id uuid NOT NULL REFERENCES backup_restore.runs(id), target text NOT NULL,
  batch_no integer NOT NULL CHECK(batch_no >= 0), body_hash text NOT NULL,
  received integer NOT NULL, inserted integer NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(run_id,target,batch_no)
);
ALTER TABLE backup_restore.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_restore.batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA backup_restore FROM PUBLIC, anon, authenticated;
GRANT SELECT ON backup_restore.runs,backup_restore.batches TO service_role;

CREATE OR REPLACE FUNCTION backup_restore.apply_batch(
  p_run uuid, p_token_hash text, p_target text, p_batch integer,
  p_hash text, p_columns text[], p_rows jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  run backup_restore.runs%ROWTYPE;
  prior backup_restore.batches%ROWTYPE;
  column_sql text;
  schema_name text;
  table_name text;
  added integer;
  received integer;
BEGIN
  SELECT * INTO run FROM backup_restore.runs WHERE id=p_run FOR UPDATE;
  IF NOT FOUND OR run.closed_at IS NOT NULL OR run.expires_at < now()
     OR p_token_hash IS DISTINCT FROM run.token_hash THEN
    RAISE EXCEPTION 'restore_session_denied' USING ERRCODE='42501';
  END IF;
  IF p_target <> ALL(run.allowed_targets) OR p_target !~ '^(public|auth)\.[a-z_][a-z0-9_]*$'
     OR p_batch < 0 OR p_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'restore_target_denied' USING ERRCODE='42501';
  END IF;
  SELECT * INTO prior FROM backup_restore.batches
    WHERE run_id=p_run AND target=p_target AND batch_no=p_batch;
  IF FOUND THEN
    IF prior.body_hash <> p_hash THEN RAISE EXCEPTION 'restore_batch_hash_mismatch'; END IF;
    RETURN jsonb_build_object('received',prior.received,'inserted',prior.inserted,'replayed',true);
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 1000
     OR pg_column_size(p_rows) > 12000000 OR cardinality(p_columns) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'restore_batch_invalid';
  END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(p_columns) x) <> cardinality(p_columns)
     OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE jsonb_typeof(r)<>'object') THEN
    RAISE EXCEPTION 'restore_columns_invalid';
  END IF;
  schema_name := split_part(p_target,'.',1);
  table_name := split_part(p_target,'.',2);
  IF EXISTS(SELECT 1 FROM unnest(p_columns) c WHERE NOT EXISTS(
    SELECT 1 FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class t ON t.oid=a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname=schema_name AND t.relname=table_name AND a.attname=c
      AND a.attnum>0 AND NOT a.attisdropped AND a.attgenerated=''
  )) THEN RAISE EXCEPTION 'restore_schema_drift'; END IF;
  SELECT string_agg(format('%I',c),',') INTO column_sql FROM unnest(p_columns) c;
  PERFORM set_config('statement_timeout','30000',true);
  PERFORM set_config('lock_timeout','5000',true);
  received := jsonb_array_length(p_rows);
  EXECUTE format('INSERT INTO %I.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::%I.%I,$1) ON CONFLICT DO NOTHING',
    schema_name,table_name,column_sql,column_sql,schema_name,table_name) USING p_rows;
  GET DIAGNOSTICS added=ROW_COUNT;
  INSERT INTO backup_restore.batches VALUES(p_run,p_target,p_batch,p_hash,received,added,now());
  RETURN jsonb_build_object('received',received,'inserted',added,'replayed',false);
END;
$$;
REVOKE ALL ON FUNCTION backup_restore.apply_batch(uuid,text,text,integer,text,text[],jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION backup_restore.apply_batch(uuid,text,text,integer,text,text[],jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.restore_lovable_batch(
  p_run uuid,p_token_hash text,p_target text,p_batch integer,p_hash text,p_columns text[],p_rows jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT backup_restore.apply_batch(p_run,p_token_hash,p_target,p_batch,p_hash,p_columns,p_rows);
$$;
REVOKE ALL ON FUNCTION public.restore_lovable_batch(uuid,text,text,integer,text,text[],jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.restore_lovable_batch(uuid,text,text,integer,text,text[],jsonb) TO service_role;
