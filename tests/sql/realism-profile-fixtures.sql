-- DISPOSABLE DATABASE ONLY. Synthetic sports fixtures; the transaction rolls back.
BEGIN;
INSERT INTO public.competitions(id,name,country,tier,club_count)
VALUES ('realism-fixture-league','Realism fixture league','Fixture',1,2);
INSERT INTO public.clubs(id,competition_id,name,short_name,primary_color,secondary_color,strength,data_source,source_id)
VALUES
 ('realism-fixture-canonical','realism-fixture-league','Fixture FC','FIX','#111111','#ffffff',50,'bundled',NULL),
 ('realism-fixture-provider','realism-fixture-league','Fixture FC','FIX','#111111','#ffffff',50,'api-football','999999901');
INSERT INTO public.club_catalog_links(source_club_id,club_id,source,match_rule,metadata_before)
VALUES ('realism-fixture-provider','realism-fixture-canonical','api-football','synthetic-fixture','{}');
INSERT INTO public.players(id,club_id,name,position,source,source_id,source_kind,birth_date)
VALUES
 ('33333333-3333-4333-8333-333333333301','realism-fixture-canonical','Felipe Silva','MF','thesportsdb','999999901','player','1999-02-25'),
 ('33333333-3333-4333-8333-333333333302','realism-fixture-provider','F. Silva','MF','api-football','999999902','player',NULL),
 ('33333333-3333-4333-8333-333333333303','realism-fixture-provider','Fixture coach','MF','api-football','999999903','staff',NULL),
 ('33333333-3333-4333-8333-333333333304','realism-fixture-provider','Unmatched athlete','MF','api-football','999999904','player',NULL),
 ('33333333-3333-4333-8333-333333333305','realism-fixture-canonical','Mateus Almeida','FW','thesportsdb','999999905','player','1998-03-04'),
 ('33333333-3333-4333-8333-333333333306','realism-fixture-provider','Mateus','FW','api-football','999999906','player',NULL);
INSERT INTO public.api_football_data(kind,ref,payload)
VALUES ('player_profile','999999906','{"player":{"id":999999906,"firstname":"Mateus","lastname":"Almeida","birth":{"date":"1998-03-04"}}}');

SET LOCAL ROLE service_role;
DO $contract$
DECLARE changed integer; profiles jsonb;
BEGIN
  profiles := '[
    {"source_id":"999999902","birth_date":"1999-02-25","photo_url":"https://images.example/player.png","nationality":"Fixture"},
    {"source_id":"999999903","birth_date":"1999-02-25"},
    {"source_id":"999999904","birth_date":"2026-02-30","photo_url":"javascript:alert(1)"},
    {"source_id":"999999906","birth_date":"1998-03-04"},
    {"source_id":"999999999","birth_date":"2000-01-01"}
  ]';
  changed := public.enrich_existing_football_profiles(profiles);
  ASSERT changed=2, 'Only valid, existing player profiles may be enriched';
  ASSERT (SELECT canonical_player_id FROM public.players WHERE source_id='999999902' AND source='api-football')
    ='33333333-3333-4333-8333-333333333301'::uuid,
    'Reviewed club, birth and abbreviated name must reconcile atomically';
  ASSERT (SELECT canonical_player_id FROM public.players WHERE source_id='999999906' AND source='api-football')
    ='33333333-3333-4333-8333-333333333305'::uuid,
    'Verified provider full name must reconcile a mononym atomically';
  ASSERT (SELECT count(*) FROM public.player_identity_aliases WHERE player_id IN (
    '33333333-3333-4333-8333-333333333302','33333333-3333-4333-8333-333333333306'))=2,
    'Historical player references need both identity aliases';
  ASSERT NOT EXISTS (SELECT 1 FROM public.players WHERE source='api-football' AND source_id='999999999'),
    'Profile enrichment must not create unknown people';
  ASSERT (SELECT birth_date IS NULL FROM public.players WHERE source='api-football' AND source_id='999999903'),
    'Profile enrichment must never turn staff into athletes';
  ASSERT (SELECT birth_date IS NULL AND photo_url IS NULL FROM public.players WHERE source='api-football' AND source_id='999999904'),
    'Invalid dates and non-HTTPS media must not be materialized';
  ASSERT public.enrich_existing_football_profiles(profiles)=0, 'Retrying a profile page must be idempotent';
  PERFORM public.enrich_existing_football_profiles('[{"source_id":"999999902","birth_date":"2001-01-01"}]');
  ASSERT (SELECT birth_date FROM public.players WHERE source='api-football' AND source_id='999999902')='1999-02-25'::date,
    'Existing verified birth dates must survive later provider changes';
  BEGIN
    PERFORM public.enrich_existing_football_profiles(NULL);
    RAISE EXCEPTION 'Null profile batches must be rejected';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.enrich_existing_football_profiles(
      (SELECT jsonb_agg(jsonb_build_object('source_id',i::text)) FROM generate_series(1,251) i));
    RAISE EXCEPTION 'Unbounded profile batches must be rejected';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END $contract$;
RESET ROLE;
INSERT INTO public.official_teams(source_id,name,sport,local_club_id)
VALUES ('af:999999901','Fixture FC','Soccer','realism-fixture-canonical'),
 ('af:999999902','Fixture second team','Soccer','realism-fixture-provider');
SET LOCAL ROLE service_role;
DO $contract$
BEGIN
  ASSERT public.enrich_football_venues('[
    {"id":999999901,"team_id":999999901,"name":"Shared fixture ground","capacity":50000,"image":"https://images.example/ground.png"},
    {"id":999999901,"team_id":999999902,"name":"Shared fixture ground","capacity":50000,"image":"https://images.example/ground.png"}
  ]')=1, 'A shared stadium needs one provider venue and two team links';
  ASSERT (SELECT count(*) FROM public.official_teams WHERE source_id IN ('af:999999901','af:999999902')
    AND venue_source_id='af:999999901')=2, 'Both home teams must retain their shared venue';
END $contract$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $contract$
BEGIN
  ASSERT (SELECT count(*) FROM public.players_catalog WHERE club_id IN (
    'realism-fixture-canonical','realism-fixture-provider'))=3,
    'Public catalog must expose canonical athletes, excluding both staff and duplicates';
  BEGIN
    PERFORM public.enrich_existing_football_profiles('[]');
    RAISE EXCEPTION 'Anonymous caller executed profile enrichment';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $contract$;
RESET ROLE;
ROLLBACK;
