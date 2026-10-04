-- Safe report: no secrets, credential hashes, account data or private save data.
SELECT jsonb_build_object(
  'checked_at', now(),
  'control', (SELECT jsonb_build_object('enabled',enabled,'status',status,'last_error',last_error,
    'source_complete',source_complete,'updated_at',updated_at) FROM public.sportsdb_bridge_control),
  'database_bytes',pg_database_size(current_database()),
  'archive_ledger_bytes',pg_total_relation_size('public.sportsdb_archives'::regclass),
  'cloudflare_archive',(SELECT source_status->'archive' FROM public.sportsdb_bridge_control),
  'canonical',jsonb_build_object(
    'leagues',(SELECT count(*) FROM public.official_leagues),
    'teams',(SELECT count(*) FROM public.official_teams),
    'players',(SELECT count(*) FROM public.official_players),
    'seasons',(SELECT count(*) FROM public.official_seasons),
    'equipment',(SELECT count(*) FROM public.official_equipment),
    'venues',(SELECT count(*) FROM public.official_venues),
    'events',(SELECT count(*) FROM public.official_events),
    'details',(SELECT count(*) FROM public.official_event_details),
    'media',(SELECT count(*) FROM public.official_media)),
  'cursors',(SELECT jsonb_agg(to_jsonb(c)) FROM (
    SELECT entity_type,next_offset,source_total,status FROM public.sportsdb_import_cursors ORDER BY priority) c),
  'archives',(SELECT jsonb_agg(to_jsonb(a)) FROM (
    SELECT status,count(*) FROM public.sportsdb_archives GROUP BY status) a),
  'upstream_phases',(SELECT source_status->'phases' FROM public.sportsdb_bridge_control),
  'archive_errors',(SELECT jsonb_agg(to_jsonb(a)) FROM (
    SELECT archive_key,status,attempts,last_error FROM public.sportsdb_archives WHERE status IN ('retry','failed') LIMIT 10) a)
) AS report;
