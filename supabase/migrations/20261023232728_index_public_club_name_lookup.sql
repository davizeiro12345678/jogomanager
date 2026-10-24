-- getClubReal filters the imported team's exact name before fetching transfers.
-- The existing league/source indexes cannot serve this predicate directly.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
-- A full name prefix also works when PostgREST chooses a generic prepared plan.
CREATE INDEX official_teams_name_source_idx
  ON public.official_teams (name, source_id);
COMMIT;
