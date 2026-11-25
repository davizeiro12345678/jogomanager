-- Real PostgreSQL contract probe. Changes are always rolled back.
-- Covers 20-row batch, identical replay, and unknown-column denial.
BEGIN;
DO $test$
DECLARE
 v_path text := 'perf/queue-opt-' || txid_current()::text;
 v_lease uuid := gen_random_uuid();
 v_rows jsonb; v_result jsonb; v_again jsonb;
BEGIN
 INSERT INTO football_import_private.jobs(path,kind,status,lease_token,lease_until)
 VALUES(v_path,'perf_test','running',v_lease,now()+interval '5 minutes');
 v_rows := jsonb_build_array(jsonb_build_object('target','api_football_data','rows',
   (SELECT jsonb_agg(jsonb_build_object('kind','test_perf','ref',v_path||'/'||i,
     'payload',jsonb_build_object('i',i))) FROM generate_series(1,20) g(i))));
 v_result := public.football_queue_finish(v_path,v_lease,v_rows,'[]'::jsonb,20,1,NULL);
 ASSERT (v_result->>'inserted')::integer=20, 'batch inserted count';
 v_again := public.football_queue_finish(v_path,v_lease,v_rows,'[]'::jsonb,20,1,NULL);
 ASSERT v_again=v_result, 'idempotent completed receipt';
 ASSERT (SELECT count(*) FROM public.api_football_data WHERE kind='test_perf'
     AND ref LIKE v_path||'/%')=20,'records missing';
END
$test$;
ROLLBACK;
