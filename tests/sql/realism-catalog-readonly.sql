-- Read-only checks: safe for production or a fully migrated disposable database.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
DO $contract$
DECLARE function_name text; relation_name text;
BEGIN
  ASSERT (SELECT count(*) FROM public.api_football_import_progress) = 28,
    'All 28 supported categories must exist';
  ASSERT NOT EXISTS (SELECT 1 FROM public.api_football_import_progress WHERE phase NOT IN (
    'leagues','teams','squads','fixtures','standings','predictions','odds','stats',
    'countries','timezones','venues','coaches','injuries','teamstats','details',
    'playerprofiles','playerseasons','transfers','trophies','sidelined','topscorers',
    'topassists','topyellowcards','topredcards','fixtureevents','fixturelineups',
    'fixturestatistics','fixtureplayers')), 'Unexpected import category';
  ASSERT NOT EXISTS (SELECT 1 FROM public.players_catalog
    WHERE source_kind <> 'player' OR canonical_player_id IS NOT NULL),
    'The public athlete catalog must exclude staff and aliases';
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.players p LEFT JOIN public.players c ON c.id=p.canonical_player_id
    WHERE p.canonical_player_id IS NOT NULL AND
      (c.id IS NULL OR c.canonical_player_id IS NOT NULL OR c.source_kind <> 'player')),
    'Identity aliases must have a live canonical athlete and no chains or cycles';
  FOREACH relation_name IN ARRAY ARRAY[
    'club_catalog_links','player_identity_aliases','official_event_aliases']
  LOOP
    ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid=('public.'||relation_name)::regclass),
      'Public identity links must retain RLS';
    ASSERT has_table_privilege('anon','public.'||relation_name,'SELECT'),
      'Public identity links must remain readable';
    ASSERT NOT has_table_privilege('authenticated','public.'||relation_name,'INSERT,UPDATE,DELETE'),
      'Browser callers must not rewrite identities';
  END LOOP;
  FOREACH relation_name IN ARRAY ARRAY['players_catalog','official_events_catalog']
  LOOP
    ASSERT (SELECT 'security_invoker=true'=ANY(reloptions)
      FROM pg_class WHERE oid=('public.'||relation_name)::regclass),
      'Catalog views must preserve caller RLS';
  END LOOP;
  FOREACH function_name IN ARRAY ARRAY[
    'enrich_existing_football_profiles(jsonb)',
    'backfill_football_birth_dates(uuid,integer)',
    'reconcile_football_player_aliases(text[],integer)',
    'reconcile_football_profile_names(text[],integer)',
    'enrich_football_venues(jsonb)',
    'backfill_existing_football_venues(text,integer)']
  LOOP
    ASSERT NOT has_function_privilege('anon','public.'||function_name,'EXECUTE')
      AND NOT has_function_privilege('authenticated','public.'||function_name,'EXECUTE'),
      'Profile enrichment and reconciliation must be server-only';
    ASSERT has_function_privilege('service_role','public.'||function_name,'EXECUTE'),
      'Server ingestion must retain enrichment access';
    ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid=('public.'||function_name)::regprocedure),
      'Enrichment must not introduce a SECURITY DEFINER path';
  END LOOP;
  ASSERT NOT has_table_privilege('anon','public.api_football_data','SELECT')
    AND NOT has_table_privilege('authenticated','public.api_football_data','SELECT'),
    'Raw provider payloads must remain private';
  ASSERT EXISTS (SELECT 1 FROM pg_index
    WHERE indexrelid='public.official_events_league_time_cursor_idx'::regclass
      AND indisready AND indisvalid), 'Fixture cursor index must be usable';
END $contract$;
ROLLBACK;
