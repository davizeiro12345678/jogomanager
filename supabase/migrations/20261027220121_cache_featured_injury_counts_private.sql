-- Applied to JogoManager Supabase production as migration 20261027220121.
-- Restrict cached injury counts to the 12 public featured leagues. No user data.
CREATE SCHEMA IF NOT EXISTS private_performance;
REVOKE ALL ON SCHEMA private_performance FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private_performance TO service_role;
CREATE MATERIALIZED VIEW private_performance.featured_injury_counts AS
SELECT (payload->'league'->>'id')::integer AS league_id, count(*)::bigint AS injury_count
FROM public.api_football_data
WHERE kind='injury'
  AND (payload->'league'->>'id') IN
      ('71','72','39','140','135','78','61','94','88','128','253','262')
GROUP BY (payload->'league'->>'id')::integer
WITH DATA;
CREATE UNIQUE INDEX featured_injury_counts_pk
ON private_performance.featured_injury_counts(league_id);
REVOKE ALL ON private_performance.featured_injury_counts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private_performance.featured_injury_counts TO service_role;
COMMENT ON MATERIALIZED VIEW private_performance.featured_injury_counts IS
 'Read-only summary of 12 public featured league injury counts; refreshed every 15 minutes. Raw injury rows remain private.';
