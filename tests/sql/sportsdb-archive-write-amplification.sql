-- Test idempotency without changing production state.
-- Run in SQL client with service privileges; rolls back every write.
BEGIN;
DO $test$
DECLARE
  row_key text := 'sportsdb/v2/perf-test-' || txid_current()::text;
  source_time timestamptz := '2026-10-01T00:00:00Z';
  saved integer;
  v_before text;
  v_after text;
BEGIN
  saved := public.sportsdb_save_records(
    jsonb_build_array(jsonb_build_object('source_updated_at',source_time,
      'payload',jsonb_build_object('archiveKey',row_key))));
  ASSERT saved = 1, 'Should preserve return value';
  SELECT xmin::text INTO v_before FROM public.sportsdb_archives WHERE archive_key=row_key;
  saved := public.sportsdb_save_records(
    jsonb_build_array(jsonb_build_object('source_updated_at',source_time,
      'payload',jsonb_build_object('archiveKey',row_key))));
  SELECT xmin::text INTO v_after FROM public.sportsdb_archives WHERE archive_key=row_key;
  ASSERT v_before=v_after, 'Identical archive must NOT be rewritten';
  saved := public.sportsdb_save_records(
    jsonb_build_array(jsonb_build_object('source_updated_at',source_time + interval '1 day',
      'payload',jsonb_build_object('archiveKey',row_key))));
  ASSERT EXISTS(SELECT 1 FROM public.sportsdb_archives
    WHERE archive_key=row_key AND status='pending' AND source_updated_at=source_time + interval '1 day'),
    'New source version must still trigger a fresh archive';
  ASSERT saved=1, 'Return contract changed';
END
$test$;
ROLLBACK;
