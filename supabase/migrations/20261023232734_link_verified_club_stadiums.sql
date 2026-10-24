-- Repair only independently matching SportsDB venue identifiers and names.
-- Never infer a stadium from a club name or overwrite an existing association.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

CREATE SCHEMA IF NOT EXISTS backup_restore;
CREATE TABLE backup_restore.club_stadium_links_oct23 (
  club_id text PRIMARY KEY,
  previous_stadium_id uuid,
  stadium_id uuid NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE backup_restore.club_stadium_links_oct23 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON backup_restore.club_stadium_links_oct23 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON backup_restore.club_stadium_links_oct23 TO service_role;

WITH candidates AS MATERIALIZED (
  SELECT c.id, min(s.id::text)::uuid AS stadium_id
  FROM public.clubs c
  JOIN public.official_teams t ON t.local_club_id = c.id
  JOIN public.official_venues v ON v.source_id = t.venue_source_id
  JOIN public.stadiums s ON s.source_id = v.source_id AND s.name = v.name
  WHERE c.stadium_id IS NULL
    AND t.source_id ~ '^[0-9]+$'
    AND t.sport = 'Soccer'
  GROUP BY c.id
  HAVING count(DISTINCT s.id) = 1
), linked AS (
  UPDATE public.clubs c
  SET stadium_id = candidate.stadium_id
  FROM candidates candidate
  WHERE c.id = candidate.id AND c.stadium_id IS NULL
  RETURNING c.id, c.stadium_id
)
INSERT INTO backup_restore.club_stadium_links_oct23 (club_id, previous_stadium_id, stadium_id)
SELECT id, NULL::uuid, stadium_id FROM linked;

COMMIT;
