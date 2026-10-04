-- Verify canonical-only imports under the actual importer role, then roll back.
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE before_leagues bigint; rows jsonb;
BEGIN
  SELECT count(*) INTO before_leagues FROM public.official_leagues;
  SELECT jsonb_agg(jsonb_build_object(
    'entity_type','league_index','source_id',source_id,'parent_id','','season','',
    'payload',jsonb_build_object('strLeague',name,'strCountry',country,'strCurrentSeason',current_season),
    'source_updated_at',now()))
  INTO rows FROM (
    SELECT source_id,name,country,current_season
    FROM public.official_leagues ORDER BY source_id LIMIT 5
  ) r;
  IF rows IS NULL THEN RAISE EXCEPTION 'Import real league records before running this check'; END IF;
  PERFORM public.sportsdb_save_records(rows);
  PERFORM public.sportsdb_save_records(rows);
  IF before_leagues<>(SELECT count(*) FROM public.official_leagues) THEN
    RAISE EXCEPTION 'Repeated import duplicated canonical league records';
  END IF;
  IF to_regclass('public.sportsdb_records') IS NOT NULL
    OR EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='sportsdb_archives' AND column_name='payload') THEN
    RAISE EXCEPTION 'Raw payload storage is still present in Postgres';
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
SELECT 'canonical import idempotence, Cloudflare-only raw archive, invalid dates and stale leases verified' AS result;
