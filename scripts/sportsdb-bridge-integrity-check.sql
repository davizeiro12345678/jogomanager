-- Verify existing source records under the actual importer role, then roll back.
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE before_raw bigint; before_leagues bigint; rows jsonb;
BEGIN
  SELECT count(*) INTO before_raw FROM public.sportsdb_records WHERE entity_type='league_index';
  SELECT count(*) INTO before_leagues FROM public.official_leagues;
  SELECT jsonb_agg(jsonb_build_object('entity_type',entity_type,'source_id',source_id,
    'parent_id',parent_id,'season',season,'payload',payload,'source_updated_at',source_updated_at))
  INTO rows FROM (SELECT * FROM public.sportsdb_records WHERE entity_type='league_index' ORDER BY source_id LIMIT 5) r;
  IF rows IS NULL THEN RAISE EXCEPTION 'Import real league records before running this check'; END IF;
  PERFORM public.sportsdb_save_records(rows);
  PERFORM public.sportsdb_save_records(rows);
  IF before_raw<>(SELECT count(*) FROM public.sportsdb_records WHERE entity_type='league_index')
    OR before_leagues<>(SELECT count(*) FROM public.official_leagues) THEN
    RAISE EXCEPTION 'Repeated import duplicated source records';
  END IF;
  IF public.sportsdb_bridge_timestamp('0000-00-00') IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid provider date was accepted';
  END IF;
  BEGIN
    PERFORM public.sportsdb_bridge_page('00000000-0000-0000-0000-000000000000','league_index',0,0,0,'[]');
    RAISE EXCEPTION 'Stale lease was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Import lease expired' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;
SELECT 'idempotence, invalid dates and stale leases verified' AS result;
