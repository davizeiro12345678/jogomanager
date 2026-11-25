SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
DO $fix$
DECLARE old_function text; source_hash text;
BEGIN
 SELECT pg_get_functiondef('public.football_queue_finish(text,uuid,jsonb,jsonb,integer,integer,integer)'::regprocedure) INTO old_function;
 source_hash:=md5(old_function);
 IF source_hash NOT IN ('05d2204b7de035be1aba389136578504',
                        'c1157c18c53d0a4c01b55dfbc7c615c4')
 THEN RAISE EXCEPTION 'Unexpected function hash %',source_hash; END IF;
 IF length(old_function)-length(replace(old_function,$anchor$  FOR rowdata IN SELECT value FROM jsonb_array_elements(batch->'rows') LOOP$anchor$,''))<>length($anchor$  FOR rowdata IN SELECT value FROM jsonb_array_elements(batch->'rows') LOOP$anchor$)
 THEN RAISE EXCEPTION 'Missing exact anchor'; END IF;
 IF source_hash='c1157c18c53d0a4c01b55dfbc7c615c4' THEN
   old_function:=replace(old_function,
     'target text; keys text[];',
     'target text; bulk_counts integer[]; keys text[];');
 ELSE
   old_function:=replace(old_function,
     'target text; allowed_cols text[]; keys text[];',
     'target text; allowed_cols text[]; bulk_counts integer[]; keys text[];');
 END IF;
 old_function:=replace(old_function,$anchor$  FOR rowdata IN SELECT value FROM jsonb_array_elements(batch->'rows') LOOP$anchor$,$replacement$  IF target='api_football_data' THEN
    bulk_counts:=private_performance.bulk_upsert_football_rows(batch->'rows');
    IF bulk_counts IS NOT NULL THEN
      n_insert:=n_insert+bulk_counts[1];
      n_update:=n_update+bulk_counts[2];
      n_same:=n_same+bulk_counts[3];
      CONTINUE;
    END IF;
  END IF;
  FOR rowdata IN SELECT value FROM jsonb_array_elements(batch->'rows') LOOP$replacement$);
 EXECUTE old_function;
END $fix$;
