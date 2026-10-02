-- Preserve past errors in execution logs, but clear a recovered error from current status.
CREATE OR REPLACE FUNCTION public.sportsdb_bridge_release(p_owner uuid,p_error text) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  UPDATE public.sportsdb_bridge_control SET lease_owner=NULL,lease_until=NULL,last_error=p_error,
    status=CASE WHEN NOT enabled THEN status WHEN p_error IS NOT NULL THEN 'retry'
      WHEN EXISTS(SELECT 1 FROM public.sportsdb_archives WHERE status='failed') THEN 'needs_attention'
      WHEN source_complete AND NOT EXISTS(SELECT 1 FROM public.sportsdb_import_cursors WHERE status<>'caught_up')
        AND NOT EXISTS(SELECT 1 FROM public.sportsdb_archives WHERE status<>'done') THEN 'complete'
      ELSE 'waiting_for_source_or_copying' END,updated_at=now()
  WHERE lease_owner=p_owner;
$$;
REVOKE ALL ON FUNCTION public.sportsdb_bridge_release(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sportsdb_bridge_release(uuid,text) TO service_role;

-- Explicit service-only policies document the default-deny access model.
CREATE POLICY "Import service only" ON public.sportsdb_bridge_control FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Import service only" ON public.sportsdb_import_cursors FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Import service only" ON public.sportsdb_records FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Import service only" ON public.sportsdb_archives FOR ALL TO service_role USING (true) WITH CHECK (true);
