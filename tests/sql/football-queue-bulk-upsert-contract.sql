-- Transactional production contract for the fast path. All test data is rolled back.
BEGIN;
DO $test$
DECLARE
 b text:='perf/queue-bulk-'||txid_current()::text;
 lease uuid:=gen_random_uuid(); input jsonb; receipt jsonb; i int;
BEGIN
 FOR i IN 1..3 LOOP
   INSERT INTO football_import_private.jobs(path,kind,status,lease_token,lease_until)
   VALUES(b||'/job/'||i,'perf_test','running',lease,now()+interval '5 minutes');
   input:=jsonb_build_array(jsonb_build_object('target','api_football_data',
     'rows',(SELECT jsonb_agg(jsonb_build_object('kind','perf_batched',
       'ref',b||'/'||n,'payload',jsonb_build_object('v',CASE WHEN i=3 THEN 2 ELSE 1 END),
       'updated_at',now()+make_interval(mins=>i)))
       FROM generate_series(1,20) g(n))));
   receipt:=public.football_queue_finish(b||'/job/'||i,lease,input,'[]'::jsonb,20,1,NULL);
   IF i=1 AND (receipt->>'inserted')::int<>20 THEN RAISE EXCEPTION 'wrong insert count'; END IF;
   IF i=2 AND (receipt->>'unchanged')::int<>20 THEN RAISE EXCEPTION 'wrong unchanged count'; END IF;
   IF i=3 AND (receipt->>'updated')::int<>20 THEN RAISE EXCEPTION 'wrong update count'; END IF;
 END LOOP;
 ASSERT (SELECT count(*) FROM public.api_football_data
   WHERE kind='perf_batched' AND ref LIKE b||'/%' AND payload->>'v'='2')=20, 'payload mismatch';
END $test$;
ROLLBACK;
