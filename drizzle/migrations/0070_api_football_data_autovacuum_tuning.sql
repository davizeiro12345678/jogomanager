-- Keep the 10M+ row provider cache's visibility map and planner statistics fresh.
-- The prior 5% vacuum / 2% analyze thresholds delayed maintenance until hundreds
-- of thousands of changes, while the injury digest performed heap-backed index
-- scans over a 14 GB table.
ALTER TABLE public.api_football_data SET (
  autovacuum_vacuum_scale_factor = 0.005,
  autovacuum_vacuum_threshold = 20000,
  autovacuum_analyze_scale_factor = 0.005,
  autovacuum_analyze_threshold = 20000
);
