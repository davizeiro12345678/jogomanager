-- The reservation foreign key must have a covering index so deleting or
-- reconciling a pair cannot scan the entire waiting queue under load.
-- This is a metadata-only change for an empty queue and no table rewrite.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE INDEX IF NOT EXISTS matchmaking_queue_reservation_fk_idx
  ON matchmaking_private.queue (reservation_id);

DO $contract$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class c ON c.oid=i.indexrelid
    WHERE i.indrelid='matchmaking_private.queue'::regclass
      AND c.relname='matchmaking_queue_reservation_fk_idx'
      AND i.indisvalid AND i.indisready
  ) THEN
    RAISE EXCEPTION 'matchmaking reservation FK index not ready';
  END IF;
END;
$contract$;

COMMIT;
