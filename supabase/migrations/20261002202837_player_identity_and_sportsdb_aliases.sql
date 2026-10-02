-- Keep every source record privately; present one canonical player per verified identity.
-- A full nullable unique index is discoverable by PostgREST's ON CONFLICT.
CREATE UNIQUE INDEX players_source_identity_conflict_idx ON public.players(source,source_id);
DROP INDEX public.players_source_uidx;
ALTER INDEX public.players_source_identity_conflict_idx RENAME TO players_source_uidx;

CREATE TABLE public.sportsdb_player_aliases (
  alias_source_id text PRIMARY KEY,
  canonical_source_id text NOT NULL REFERENCES public.official_players(source_id),
  original_record jsonb NOT NULL,
  reason text NOT NULL DEFAULT 'same_full_name_birth_date_and_team',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (alias_source_id <> canonical_source_id)
);
ALTER TABLE public.sportsdb_player_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sportsdb_player_aliases FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.sportsdb_player_aliases TO service_role;
CREATE POLICY "Import service only" ON public.sportsdb_player_aliases FOR ALL TO service_role USING (true) WITH CHECK (true);

-- No generated identifiers or hardcoded player IDs. Birth date + full name + same team
-- are required; missing dates, one-word names, and players in different clubs stay separate.
LOCK TABLE public.official_players IN SHARE ROW EXCLUSIVE MODE;
CREATE INDEX official_players_registration_identity_idx ON public.official_players(
  lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g')),birth_date,team_source_id);
WITH ranked AS (
  SELECT p.*,first_value(source_id) OVER (
    PARTITION BY lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g')),birth_date,team_source_id
    ORDER BY (photo_url IS NOT NULL) DESC,
      (position NOT IN ('Attacker','Midfielder','Defender') AND position IS NOT NULL) DESC,source_id
  ) AS canonical
  FROM public.official_players p
  WHERE birth_date ~ '^\d{4}-\d{2}-\d{2}$'
    AND public.sportsdb_bridge_timestamp(birth_date || 'T00:00:00Z') IS NOT NULL
    AND btrim(name) ~ '[[:space:]]' AND nullif(team_source_id,'') IS NOT NULL
)
INSERT INTO public.sportsdb_player_aliases(alias_source_id,canonical_source_id,original_record)
SELECT source_id,canonical,to_jsonb(ranked)-'canonical' FROM ranked WHERE source_id<>canonical;

DELETE FROM public.official_players p USING public.sportsdb_player_aliases a WHERE p.source_id=a.alias_source_id;

CREATE FUNCTION public.sportsdb_canonical_player_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE canonical text; BEGIN
  SELECT canonical_source_id INTO canonical FROM public.sportsdb_player_aliases WHERE alias_source_id=NEW.source_id;
  IF canonical IS NULL AND NOT EXISTS(SELECT 1 FROM public.official_players WHERE source_id=NEW.source_id)
    AND NEW.birth_date ~ '^\d{4}-\d{2}-\d{2}$'
    AND public.sportsdb_bridge_timestamp(NEW.birth_date || 'T00:00:00Z') IS NOT NULL
    AND btrim(NEW.name) ~ '[[:space:]]' AND nullif(NEW.team_source_id,'') IS NOT NULL THEN
    -- Serialize identical registration identities from bounded parallel archive batches.
    PERFORM pg_advisory_xact_lock(hashtextextended('sportsdb-player:' ||
      lower(regexp_replace(btrim(NEW.name),'[[:space:]]+',' ','g')) || ':' || NEW.birth_date || ':' || NEW.team_source_id,0));
    SELECT source_id INTO canonical FROM public.official_players
    WHERE lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g')) = lower(regexp_replace(btrim(NEW.name),'[[:space:]]+',' ','g'))
      AND birth_date=NEW.birth_date AND team_source_id=NEW.team_source_id AND source_id<>NEW.source_id
    ORDER BY source_id LIMIT 1;
    IF canonical IS NOT NULL THEN
      INSERT INTO public.sportsdb_player_aliases(alias_source_id,canonical_source_id,original_record)
        VALUES(NEW.source_id,canonical,to_jsonb(NEW)) ON CONFLICT(alias_source_id) DO NOTHING;
    END IF;
  END IF;
  IF canonical IS NOT NULL THEN
    UPDATE public.official_players SET photo_url=coalesce(photo_url,NEW.photo_url),
      nationality=coalesce(nationality,NEW.nationality),birth_date=coalesce(birth_date,NEW.birth_date)
    WHERE source_id=canonical;
    -- Never redirect multiple input rows to one ON CONFLICT target in the same statement.
    RETURN NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sportsdb_canonical_player_identity() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sportsdb_canonical_player_identity() TO service_role;
CREATE TRIGGER sportsdb_canonical_player_identity BEFORE INSERT ON public.official_players
FOR EACH ROW EXECUTE FUNCTION public.sportsdb_canonical_player_identity();
