-- Target: lguqnwvsfeefxamzeyos. Public football records only.
-- Every statement is read-only; no saves, auth, purchases, triggers or row changes.
BEGIN TRANSACTION READ ONLY;

-- Run with an authorized SQL inspector: player RLS intentionally hides retained rows from visitors.
SELECT 'retained-vs-playable' AS check_id, count(*) AS retained_total,
       count(*) FILTER (WHERE source_kind = 'player' AND canonical_player_id IS NULL) AS playable,
       count(*) FILTER (WHERE source_kind <> 'player') AS retained_staff,
       count(*) FILTER (WHERE canonical_player_id IS NOT NULL) AS retained_aliases
FROM public.players;

SELECT 'blank-club-label' AS check_id, id, competition_id
FROM public.clubs
WHERE name IS NULL OR btrim(name) = '' OR lower(btrim(name)) IN ('null','undefined','[object object]');

SELECT 'blank-competition-label' AS check_id, id
FROM public.competitions
WHERE name IS NULL OR btrim(name) = '';

SELECT 'duplicate-provider-identity' AS check_id, source, source_id,
       count(*) AS copies, array_agg(id ORDER BY id) AS record_ids
FROM public.players
WHERE nullif(btrim(source),'') IS NOT NULL AND nullif(btrim(source_id),'') IS NOT NULL
GROUP BY source, source_id HAVING count(*) > 1;

-- Role evidence is joined by provider ID, never by a person's name or estimated age.
SELECT 'staff-in-player-roster' AS check_id, p.id, p.club_id, p.source, p.source_id,
       o.position AS canonical_role, p.source_kind,
       (p.source_kind = 'player' AND p.canonical_player_id IS NULL) AS incorrectly_playable
FROM public.players p JOIN public.official_players o ON
 (lower(p.source) = 'thesportsdb' AND o.source_id = p.source_id)
 OR (lower(p.source) = 'api-football' AND o.source_id = 'af:' || p.source_id)
WHERE lower(coalesce(o.position,'')) ~ '(coach|manager|staff|trainer|physio|director|treinador|técnico|auxiliar)';

SELECT 'retained-canonical-links' AS check_id, p.id AS retained_id, p.canonical_player_id,
       p.source, p.source_id, c.source_id AS canonical_source_id,
       a.reason AS alias_evidence,
       (c.id IS NOT NULL AND c.source_kind = 'player' AND c.canonical_player_id IS NULL
        AND a.canonical_source_id = c.source_id) AS canonical_link_valid
FROM public.players p
LEFT JOIN public.players c ON c.id = p.canonical_player_id
LEFT JOIN public.sportsdb_player_aliases a ON lower(p.source) = 'thesportsdb' AND a.alias_source_id = p.source_id
WHERE p.canonical_player_id IS NOT NULL;

SELECT 'confirmed-alias-still-playable' AS check_id, p.id, p.source_id, a.canonical_source_id, a.reason
FROM public.players p JOIN public.sportsdb_player_aliases a ON
 lower(p.source) = 'thesportsdb' AND a.alias_source_id = p.source_id
WHERE p.source_kind = 'player' AND p.canonical_player_id IS NULL;

-- Candidates for human/source review only: these are not proven duplicate identities.
SELECT 'same-registration-candidate' AS check_id, club_id, lower(btrim(name)) AS name,
       birth_date, count(*) AS copies, array_agg(id ORDER BY id) AS record_ids
FROM public.players WHERE source_kind = 'player' AND canonical_player_id IS NULL
AND birth_date IS NOT NULL AND nullif(btrim(name),'') IS NOT NULL
GROUP BY club_id, lower(btrim(name)), birth_date HAVING count(*) > 1;

SELECT 'orphan-player-club' AS check_id, p.id, p.club_id
FROM public.players p LEFT JOIN public.clubs c ON c.id = p.club_id WHERE c.id IS NULL;

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('players','clubs','competitions','official_players')
AND column_name IN ('id','source','source_id','source_kind','canonical_player_id','name','position','birth_date','club_id','competition_id')
ORDER BY table_name, ordinal_position;
COMMIT;
