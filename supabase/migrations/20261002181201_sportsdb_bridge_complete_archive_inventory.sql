-- Walk the full R2 archive inventory as well as indexes. Historical event indexes
-- can exceed the source endpoint's 100,000-row offset ceiling; their full JSON
-- remains importable through the independently paginated archive inventory.
CREATE OR REPLACE FUNCTION public.sportsdb_bridge_manifest(p_owner uuid,p_manifest jsonb,
  p_source_status jsonb,p_source_complete boolean) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.sportsdb_bridge_control WHERE lease_owner=p_owner AND lease_until>now()) THEN
    RAISE EXCEPTION 'Import lease expired';
  END IF;
  UPDATE public.sportsdb_bridge_control SET source_status=p_source_status,
    source_complete=p_source_complete,updated_at=now() WHERE lease_owner=p_owner;
  INSERT INTO public.sportsdb_import_cursors(entity_type,source_total,fingerprint,priority)
  SELECT entity_type,source_total,fingerprint,priority FROM jsonb_to_recordset(p_manifest)
    AS x(entity_type text,source_total bigint,fingerprint text,priority integer)
  ON CONFLICT (entity_type) DO UPDATE SET
    next_offset=CASE WHEN sportsdb_import_cursors.status='caught_up'
      AND sportsdb_import_cursors.fingerprint<>excluded.fingerprint THEN 0 ELSE sportsdb_import_cursors.next_offset END,
    status=CASE WHEN sportsdb_import_cursors.fingerprint<>excluded.fingerprint THEN 'copying' ELSE sportsdb_import_cursors.status END,
    fingerprint=CASE WHEN sportsdb_import_cursors.status='caught_up' THEN excluded.fingerprint
      ELSE sportsdb_import_cursors.fingerprint END,
    source_total=excluded.source_total,updated_at=now();
  UPDATE public.sportsdb_import_cursors SET status='archive_backed'
    WHERE entity_type<>'archive_catalog' AND source_total>100000;
END $$;

CREATE FUNCTION public.sportsdb_bridge_archive_catalog(p_owner uuid,p_offset bigint,
  p_consumed integer,p_total bigint,p_archives jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.sportsdb_bridge_control WHERE lease_owner=p_owner AND lease_until>now()) THEN
    RAISE EXCEPTION 'Import lease expired';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.sportsdb_import_cursors WHERE entity_type='archive_catalog' AND next_offset=p_offset) THEN
    RAISE EXCEPTION 'Stale import cursor';
  END IF;
  INSERT INTO public.sportsdb_archives(archive_key,source_updated_at)
  SELECT archive_key,updated_at FROM jsonb_to_recordset(p_archives) AS x(archive_key text,updated_at timestamptz)
  ON CONFLICT (archive_key) DO UPDATE SET
    status=CASE WHEN excluded.source_updated_at>sportsdb_archives.source_updated_at THEN 'pending' ELSE sportsdb_archives.status END,
    source_updated_at=greatest(excluded.source_updated_at,sportsdb_archives.source_updated_at);
  UPDATE public.sportsdb_import_cursors SET next_offset=p_offset+p_consumed,source_total=p_total,
    status=CASE WHEN p_offset+p_consumed>=p_total THEN 'caught_up' ELSE 'copying' END,
    last_serviced_at=now(),updated_at=now() WHERE entity_type='archive_catalog';
END $$;

CREATE OR REPLACE FUNCTION public.sportsdb_bridge_release(p_owner uuid,p_error text) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  UPDATE public.sportsdb_bridge_control SET lease_owner=NULL,lease_until=NULL,last_error=p_error,
    enabled=CASE WHEN p_error LIKE '%Source pagination capacity reached%' THEN false ELSE enabled END,
    status=CASE WHEN p_error LIKE '%Source pagination capacity reached%' THEN 'needs_attention'
      WHEN NOT enabled THEN status WHEN p_error IS NOT NULL THEN 'retry'
      WHEN EXISTS(SELECT 1 FROM public.sportsdb_archives WHERE status='failed') THEN 'needs_attention'
      WHEN source_complete AND NOT EXISTS(SELECT 1 FROM public.sportsdb_import_cursors WHERE status NOT IN ('caught_up','archive_backed'))
        AND NOT EXISTS(SELECT 1 FROM public.sportsdb_archives WHERE status<>'done') THEN 'complete'
      ELSE 'waiting_for_source_or_copying' END,updated_at=now()
  WHERE lease_owner=p_owner;
$$;
REVOKE ALL ON FUNCTION public.sportsdb_bridge_archive_catalog(uuid,bigint,integer,bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sportsdb_bridge_archive_catalog(uuid,bigint,integer,bigint,jsonb) TO service_role;
