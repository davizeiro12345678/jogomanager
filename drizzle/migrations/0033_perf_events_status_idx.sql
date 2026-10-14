DROP INDEX IF EXISTS public.official_events_source_status_idx;
CREATE INDEX IF NOT EXISTS official_events_status_source_idx ON public.official_events (status, source_id text_pattern_ops);