-- The source uses 1970-01-01 as a missing-date sentinel for these current
-- soccer records. Preserve the originals and lock the cleaned null value.
INSERT INTO public.sportsdb_data_corrections(correction_key,table_name,source_id,reason,before_row)
SELECT 'placeholder-birth-date-v1','official_players',p.source_id,
  '1970-01-01 is a source placeholder, not a verified footballer birth date',to_jsonb(p)
FROM public.official_players p
WHERE p.sport='Soccer' AND p.birth_date='1970-01-01'
ON CONFLICT (correction_key,table_name,source_id) DO NOTHING;

INSERT INTO public.sportsdb_player_overrides(source_id,birth_date_override,birth_date_locked,reason)
SELECT p.source_id,NULL,true,'1970-01-01 is a source placeholder, not a verified footballer birth date'
FROM public.official_players p
WHERE p.sport='Soccer' AND p.birth_date='1970-01-01'
ON CONFLICT (source_id) DO UPDATE
SET birth_date_override=NULL,birth_date_locked=true,
    reason='1970-01-01 is a source placeholder, not a verified footballer birth date',updated_at=now();

UPDATE public.official_players p SET birth_date=NULL,updated_at=now()
WHERE p.sport='Soccer' AND p.birth_date='1970-01-01';

CREATE OR REPLACE FUNCTION public.sportsdb_safe_birth_date(p_value text,p_sport text)
RETURNS text
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE parsed date;
BEGIN
  IF p_value IS NULL THEN RETURN NULL; END IF;
  IF coalesce(p_sport,'Unknown') <> 'Soccer' THEN RETURN p_value; END IF;
  IF p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR p_value='1970-01-01' THEN RETURN NULL; END IF;
  BEGIN
    parsed := p_value::date;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  IF parsed < DATE '1900-01-01' OR parsed > current_date THEN RETURN NULL; END IF;
  RETURN to_char(parsed,'YYYY-MM-DD');
END $$;
