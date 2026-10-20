-- Authoritative provider-role classification; retain every player id and audit the change.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '45s';
CREATE SCHEMA IF NOT EXISTS data_quality;
REVOKE ALL ON SCHEMA data_quality FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA data_quality TO service_role;
CREATE TABLE IF NOT EXISTS data_quality.player_role_corrections (
  correction_key text NOT NULL,
  player_id uuid NOT NULL,
  source text NOT NULL,
  source_id text NOT NULL,
  canonical_role text NOT NULL,
  before_row jsonb NOT NULL,
  corrected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(correction_key, player_id)
);
ALTER TABLE data_quality.player_role_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON data_quality.player_role_corrections FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON data_quality.player_role_corrections TO service_role;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'player';
ALTER TABLE public.players ADD CONSTRAINT players_source_kind_check CHECK(source_kind IN ('player','staff'));
INSERT INTO data_quality.player_role_corrections(correction_key,player_id,source,source_id,canonical_role,before_row)
SELECT 'provider-staff-v1',p.id,p.source,p.source_id,o.position,to_jsonb(p)
FROM public.players p JOIN public.official_players o
  ON o.source_id=CASE lower(p.source) WHEN 'thesportsdb' THEN p.source_id WHEN 'api-football' THEN 'af:'||p.source_id END
WHERE lower(coalesce(o.position,'')) ~ '(^|[^[:alpha:]])(coach|manager|staff|trainer|physio|physiotherapist|director|treinador|técnico|auxiliar|preparador|massagista)([^[:alpha:]]|$)'
AND p.source_kind='player'
ON CONFLICT(correction_key,player_id) DO NOTHING;
UPDATE public.players p SET source_kind='staff'
FROM data_quality.player_role_corrections a
WHERE a.correction_key='provider-staff-v1' AND a.player_id=p.id AND p.source_kind='player';
CREATE OR REPLACE FUNCTION public.classify_player_source_kind()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
DECLARE v_role text; v_source_id text;
BEGIN
  v_source_id := CASE lower(NEW.source)
    WHEN 'thesportsdb' THEN NEW.source_id WHEN 'api-football' THEN 'af:'||NEW.source_id ELSE NULL END;
  IF v_source_id IS NOT NULL THEN
    SELECT p.position INTO v_role FROM public.official_players p WHERE p.source_id=v_source_id;
    IF lower(coalesce(v_role,'')) ~ '(^|[^[:alpha:]])(coach|manager|staff|trainer|physio|physiotherapist|director|treinador|técnico|auxiliar|preparador|massagista)([^[:alpha:]]|$)' THEN
      NEW.source_kind := 'staff';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.classify_player_source_kind() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.classify_player_source_kind() TO service_role;
CREATE TRIGGER classify_player_source_kind BEFORE INSERT OR UPDATE OF source,source_id,source_kind
ON public.players FOR EACH ROW EXECUTE FUNCTION public.classify_player_source_kind();
CREATE POLICY "Only athlete records are playable" ON public.players AS RESTRICTIVE
FOR SELECT TO anon,authenticated USING(source_kind='player');
ALTER TABLE public.clubs ADD CONSTRAINT clubs_valid_name_check
CHECK(name IS NOT NULL AND btrim(name)<>'' AND lower(btrim(name)) NOT IN('null','undefined','[object object]')) NOT VALID;
ALTER TABLE public.clubs VALIDATE CONSTRAINT clubs_valid_name_check;
ALTER TABLE public.competitions ADD CONSTRAINT competitions_valid_name_check
CHECK(name IS NOT NULL AND btrim(name)<>'' AND lower(btrim(name)) NOT IN('null','undefined','[object object]')) NOT VALID;
ALTER TABLE public.competitions VALIDATE CONSTRAINT competitions_valid_name_check;
COMMENT ON COLUMN public.players.source_kind IS 'Provider role classification. Staff retains its id for save/reference compatibility and is excluded from playable catalog.';
NOTIFY pgrst,'reload schema';
