DO $$
DECLARE
  options text[];
BEGIN
  SELECT reloptions INTO options
  FROM pg_class
  WHERE oid = 'public.api_football_data'::regclass;

  ASSERT options @> ARRAY[
    'autovacuum_vacuum_scale_factor=0.005',
    'autovacuum_vacuum_threshold=20000',
    'autovacuum_analyze_scale_factor=0.005',
    'autovacuum_analyze_threshold=20000'
  ], 'API-Football cache autovacuum thresholds must remain bounded for the 10M+ row table';
END $$;
