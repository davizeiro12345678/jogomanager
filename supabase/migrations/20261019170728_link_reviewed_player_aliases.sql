-- Explicit transaction for Supabase CLI replay.
-- Recorded SQL: supabase/migration-archive/recorded/20261019170728_link_reviewed_player_aliases.sql
BEGIN;

-- Hide only aliases with an existing, reviewed provider link and matching registration.
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public.players ADD COLUMN canonical_player_id uuid REFERENCES public.players(id);
ALTER TABLE public.players ADD CONSTRAINT players_canonical_not_self_check
CHECK(canonical_player_id IS NULL OR canonical_player_id<>id);
CREATE TABLE IF NOT EXISTS data_quality.player_identity_corrections(
 correction_key text NOT NULL,player_id uuid NOT NULL,canonical_player_id uuid NOT NULL,
 before_row jsonb NOT NULL,corrected_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(correction_key,player_id)
);
ALTER TABLE data_quality.player_identity_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON data_quality.player_identity_corrections FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON data_quality.player_identity_corrections TO service_role;
INSERT INTO data_quality.player_identity_corrections(correction_key,player_id,canonical_player_id,before_row)
SELECT 'reviewed-provider-alias-v1',p.id,c.id,to_jsonb(p)
FROM public.sportsdb_player_aliases a
JOIN public.players p ON p.source='thesportsdb' AND p.source_id=a.alias_source_id
JOIN public.players c ON c.source='thesportsdb' AND c.source_id=a.canonical_source_id
WHERE p.id<>c.id AND p.source_kind='player' AND c.source_kind='player'
AND p.club_id=c.club_id AND p.birth_date IS NOT NULL AND p.birth_date=c.birth_date
AND lower(btrim(p.name))=lower(btrim(c.name)) AND c.canonical_player_id IS NULL
AND a.reason='same_full_name_birth_date_and_team'
ON CONFLICT(correction_key,player_id) DO NOTHING;
UPDATE public.players p SET canonical_player_id=a.canonical_player_id
FROM data_quality.player_identity_corrections a
WHERE a.correction_key='reviewed-provider-alias-v1' AND a.player_id=p.id
AND p.canonical_player_id IS NULL;
CREATE INDEX players_canonical_alias_idx ON public.players(canonical_player_id)
WHERE canonical_player_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.link_reviewed_player_alias()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
DECLARE v_canonical uuid;
BEGIN
 IF NEW.source='thesportsdb' AND NEW.canonical_player_id IS NULL THEN
  SELECT c.id INTO v_canonical FROM public.sportsdb_player_aliases a
  JOIN public.players c ON c.source='thesportsdb' AND c.source_id=a.canonical_source_id
  WHERE a.alias_source_id=NEW.source_id AND a.reason='same_full_name_birth_date_and_team'
  AND c.id IS DISTINCT FROM NEW.id AND c.canonical_player_id IS NULL
  AND c.source_kind='player' AND c.club_id=NEW.club_id
  AND NEW.birth_date IS NOT NULL AND c.birth_date=NEW.birth_date
  AND lower(btrim(c.name))=lower(btrim(NEW.name));
  IF v_canonical IS NOT NULL THEN NEW.canonical_player_id:=v_canonical; END IF;
 END IF;
 RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.link_reviewed_player_alias() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.link_reviewed_player_alias() TO service_role;
CREATE TRIGGER link_reviewed_player_alias BEFORE INSERT OR UPDATE OF source,source_id,club_id,birth_date,name,canonical_player_id
ON public.players FOR EACH ROW EXECUTE FUNCTION public.link_reviewed_player_alias();
ALTER POLICY "Only athlete records are playable" ON public.players
USING(source_kind='player' AND canonical_player_id IS NULL);
COMMENT ON COLUMN public.players.canonical_player_id IS 'Reviewed provider alias. Original id retained; playable reads return canonical record only.';
NOTIFY pgrst,'reload schema';

COMMIT;
