SET LOCAL lock_timeout='3s';
-- Keep autovacuum enabled; tune only the three frequently refreshed football tables.
-- Previous reloptions were NULL for all three (2026-10-19 read-only evidence).
ALTER TABLE public.players SET (
  autovacuum_vacuum_scale_factor=0.05,
  autovacuum_vacuum_threshold=200,
  autovacuum_analyze_scale_factor=0.02,
  autovacuum_analyze_threshold=200
);
ALTER TABLE public.official_events SET (
  autovacuum_vacuum_scale_factor=0.03,
  autovacuum_vacuum_threshold=500,
  autovacuum_analyze_scale_factor=0.02,
  autovacuum_analyze_threshold=500
);
ALTER TABLE public.api_football_data SET (
  autovacuum_vacuum_scale_factor=0.05,
  autovacuum_vacuum_threshold=500,
  autovacuum_analyze_scale_factor=0.02,
  autovacuum_analyze_threshold=500
);
-- Rollback, if the ingestion workload changes: ALTER TABLE <table> RESET
-- (autovacuum_vacuum_scale_factor,autovacuum_vacuum_threshold,
--  autovacuum_analyze_scale_factor,autovacuum_analyze_threshold);
