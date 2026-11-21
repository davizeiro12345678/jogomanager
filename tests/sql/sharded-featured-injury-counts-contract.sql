-- Execute against an isolated replay database; no persistent fixture changes.
BEGIN;
DO $assert$
DECLARE v_ref text := '__jgm_sharded_injury_contract__';
  before71 bigint; before72 bigint; after71 bigint; after72 bigint;
BEGIN
  ASSERT NOT has_table_privilege('anon','private_performance.featured_injury_count_shards','SELECT');
  ASSERT NOT has_table_privilege('authenticated','private_performance.featured_injury_count_shards','SELECT');
  ASSERT NOT has_table_privilege('service_role','private_performance.featured_injury_count_shards','SELECT');
  ASSERT has_table_privilege('service_role','private_performance.featured_injury_counts_sharded','SELECT');
  ASSERT NOT has_function_privilege('anon','private_performance.featured_injury_shard_delta(integer,smallint,integer)','EXECUTE');

  ASSERT NOT EXISTS (
   SELECT 1 FROM private_performance.featured_injury_counts_live a
   FULL JOIN private_performance.featured_injury_counts_sharded b USING(league_id)
   WHERE coalesce(a.injury_count,0)<>coalesce(b.injury_count,0)
  ), 'seed counter shards must match source';
  ASSERT position('featured_injury_counts_sharded' IN
    pg_get_functiondef('public.get_public_league_digest_source(integer[])'::regprocedure))>0,
    'public digest must read shard counts';

  SELECT coalesce((SELECT injury_count FROM private_performance.featured_injury_counts_sharded WHERE league_id=71),0)
  INTO before71;
  SELECT coalesce((SELECT injury_count FROM private_performance.featured_injury_counts_sharded WHERE league_id=72),0)
  INTO before72;
  INSERT INTO public.api_football_data(kind,ref,payload,updated_at)
  VALUES('injury',v_ref,'{"league":{"id":"71"}}'::jsonb,now());

  SELECT coalesce((SELECT injury_count FROM private_performance.featured_injury_counts_sharded WHERE league_id=71),0) INTO after71;
  ASSERT after71=before71+1,'shard counter insert must count';
  ASSERT after71=(SELECT injury_count FROM public.get_public_league_digest_source(ARRAY[71]::integer[]) WHERE league_id=71),
     'digest must read shard insert';

  UPDATE public.api_football_data SET payload='{"league":{"id":"72"}}'::jsonb WHERE kind='injury' AND ref=v_ref;
  SELECT coalesce((SELECT injury_count FROM private_performance.featured_injury_counts_sharded WHERE league_id=71),0) INTO after71;
  SELECT coalesce((SELECT injury_count FROM private_performance.featured_injury_counts_sharded WHERE league_id=72),0) INTO after72;
  ASSERT after71=before71,'shard move decrements previous league';
  ASSERT after72=before72+1,'shard move increments next league';
  DELETE FROM public.api_football_data WHERE kind='injury' AND ref=v_ref;
  SELECT coalesce((SELECT injury_count FROM private_performance.featured_injury_counts_sharded WHERE league_id=72),0) INTO after72;
  ASSERT after72=before72,'shard delete restores previous count';
END;
$assert$;
ROLLBACK;
