-- Index the new identity-link foreign keys so referential updates and joins
-- stay efficient as the source catalog grows.
CREATE INDEX IF NOT EXISTS official_leagues_local_competition_id_idx
  ON public.official_leagues(local_competition_id)
  WHERE local_competition_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS official_teams_local_club_id_idx
  ON public.official_teams(local_club_id)
  WHERE local_club_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sportsdb_competition_identity_aliases_canonical_id_idx
  ON public.sportsdb_competition_identity_aliases(canonical_id);
CREATE INDEX IF NOT EXISTS sportsdb_club_identity_aliases_canonical_id_idx
  ON public.sportsdb_club_identity_aliases(canonical_id);
