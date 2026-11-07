BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '20s';
DO $fix$
DECLARE
  original text;
  declaration_before text := $a$target text; keys text[];$a$;
  declaration_after text := $a$target text; allowed_cols text[]; keys text[];$a$;
  start_batch_before text := $b$  keys:=CASE WHEN target='api_football_data' THEN ARRAY['kind','ref'] WHEN target IN ('clubs','competitions') THEN ARRAY['id'] WHEN target='players' THEN ARRAY['source','source_id'] ELSE ARRAY['source_id'] END;
  FOR rowdata IN$b$;
  start_batch_after text := $b$  keys:=CASE WHEN target='api_football_data' THEN ARRAY['kind','ref'] WHEN target IN ('clubs','competitions') THEN ARRAY['id'] WHEN target='players' THEN ARRAY['source','source_id'] ELSE ARRAY['source_id'] END;
  allowed_cols := NULL;
  FOR rowdata IN$b$;
  validation_before text := $v$   IF EXISTS(SELECT 1 FROM jsonb_object_keys(rowdata) k WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=format('public.%I',target)::regclass AND attname=k AND attnum>0 AND NOT attisdropped AND attgenerated='')) THEN RAISE EXCEPTION 'queue_column_denied'; END IF;$v$;
  validation_after text := $v$   IF allowed_cols IS NULL THEN
    SELECT array_agg(attname::text) INTO allowed_cols
    FROM pg_catalog.pg_attribute
    WHERE attrelid=format('public.%I',target)::regclass
      AND attnum>0 AND NOT attisdropped AND attgenerated='';
   END IF;
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(rowdata) k WHERE NOT (k = ANY(allowed_cols))) THEN RAISE EXCEPTION 'queue_column_denied'; END IF;$v$;
BEGIN
  SELECT pg_get_functiondef('public.football_queue_finish(text,uuid,jsonb,jsonb,integer,integer,integer)'::regprocedure) INTO original;
  IF md5(original) <> 'c1157c18c53d0a4c01b55dfbc7c615c4' THEN
    RAISE EXCEPTION 'Queue function changed since review; aborting';
  END IF;
  IF length(original)-length(replace(original,declaration_before,''))<>length(declaration_before)
    OR length(original)-length(replace(original,start_batch_before,''))<>length(start_batch_before)
    OR length(original)-length(replace(original,validation_before,''))<>length(validation_before)
  THEN
    RAISE EXCEPTION 'Unexpected queue function body; aborting';
  END IF;
  original := replace(original,declaration_before,declaration_after);
  original := replace(original,start_batch_before,start_batch_after);
  original := replace(original,validation_before,validation_after);
  EXECUTE original;
END
$fix$;
COMMIT;