-- Short-lived, authenticated sports-only transport. No account or payment data.
CREATE OR REPLACE FUNCTION backup_restore.ingest_football(
  p_run uuid,p_token_hash text,p_action text,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r backup_restore.runs%ROWTYPE; target text; cols text[]; colsql text;
  conflict_sql text; updates text; amount integer; page integer; result jsonb;
BEGIN
  SELECT * INTO r FROM backup_restore.runs WHERE id=p_run FOR UPDATE;
  IF NOT FOUND OR r.closed_at IS NOT NULL OR r.expires_at<now()
    OR r.token_hash IS DISTINCT FROM p_token_hash
    OR NOT ('public.api_football_data'=ANY(r.allowed_targets)) THEN
    RAISE EXCEPTION 'ingest_session_denied' USING ERRCODE='42501';
  END IF;
  IF p_action='reserve' THEN
    PERFORM public.reserve_api_football_quota(); RETURN '{"reserved":true}'::jsonb;
  ELSIF p_action='catalog' THEN
    page:=greatest(0,least(1000000,coalesce((p_payload->>'offset')::integer,0)));
    IF p_payload->>'kind'='teams' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO result FROM
        (SELECT source_id,local_club_id,league_source_id FROM public.official_teams
         WHERE source_id LIKE 'af:%' ORDER BY source_id OFFSET page LIMIT 1000) x;
    ELSE
      SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO result FROM
        (SELECT source_id,current_season FROM public.official_leagues
         WHERE source_id LIKE 'af:%' ORDER BY source_id OFFSET page LIMIT 1000) x;
    END IF;
    RETURN jsonb_build_object('rows',result);
  ELSIF p_action<>'upsert' THEN RAISE EXCEPTION 'ingest_action_denied'; END IF;
  target:=p_payload->>'target';
  cols:=ARRAY(SELECT jsonb_array_elements_text(p_payload->'columns'));
  IF target NOT IN ('api_football_data','competitions','clubs','official_leagues','official_teams','official_events','players')
    OR cardinality(cols) NOT BETWEEN 1 AND 60
    OR jsonb_typeof(p_payload->'rows')<>'array'
    OR jsonb_array_length(p_payload->'rows') NOT BETWEEN 1 AND 500
    OR pg_column_size(p_payload)>10000000 THEN RAISE EXCEPTION 'ingest_payload_denied'; END IF;
  IF cardinality(cols)<>(SELECT count(DISTINCT c) FROM unnest(cols)c)
    OR EXISTS(SELECT 1 FROM unnest(cols)c WHERE NOT EXISTS(
      SELECT 1 FROM pg_attribute a JOIN pg_class t ON t.oid=a.attrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname='public' AND t.relname=target AND a.attname=c AND a.attnum>0
        AND NOT a.attisdropped AND a.attgenerated='')) THEN RAISE EXCEPTION 'ingest_columns_denied'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'rows')x WHERE
    CASE WHEN target='api_football_data' THEN
      coalesce(x->>'kind','') NOT IN ('league','team','country','timezone','fixture_detail','player_stats','standings','coach','venue','team_stats','injury','squad','topscorers','topassists','topyellowcards','topredcards','transfer','trophy','sidelined','player_profile','odds','prediction')
      OR length(coalesce(x->>'ref','')) NOT BETWEEN 1 AND 240
    WHEN target IN ('clubs','competitions') THEN coalesce(x->>'id','') !~ '^af[0-9]+$'
    WHEN target='players' THEN coalesce(x->>'source','')<>'api-football' OR coalesce(x->>'source_id','') !~ '^[0-9]+$'
    ELSE coalesce(x->>'source_id','') !~ '^af:[0-9]+$' END) THEN RAISE EXCEPTION 'ingest_source_denied'; END IF;
  conflict_sql:=CASE WHEN target='api_football_data' THEN 'kind,ref'
    WHEN target IN ('clubs','competitions') THEN 'id'
    WHEN target='players' THEN 'source,source_id' ELSE 'source_id' END;
  SELECT string_agg(format('%I',c),','),string_agg(format('%I=EXCLUDED.%I',c,c),',')
    INTO colsql,updates FROM unnest(cols)c;
  -- Existing playable clubs retain their identity, balance and league assignment.
  IF target IN ('clubs','competitions') THEN updates:=NULL; END IF;
  EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.%I,$1) ON CONFLICT (%s) DO %s',
    target,colsql,colsql,target,conflict_sql,CASE WHEN updates IS NULL THEN 'NOTHING' ELSE 'UPDATE SET '||updates END)
    USING p_payload->'rows';
  GET DIAGNOSTICS amount=ROW_COUNT;
  RETURN jsonb_build_object('written',amount,'received',jsonb_array_length(p_payload->'rows'));
END;
$$;
REVOKE ALL ON FUNCTION backup_restore.ingest_football(uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION backup_restore.ingest_football(uuid,text,text,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.ingest_api_football(p_run uuid,p_token_hash text,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT backup_restore.ingest_football(p_run,p_token_hash,p_action,p_payload);
$$;
REVOKE ALL ON FUNCTION public.ingest_api_football(uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_api_football(uuid,text,text,jsonb) TO service_role;

