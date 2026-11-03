CREATE OR REPLACE FUNCTION public.public_name_is_clean(_name text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  spaced text;
  squashed text;
  term text;
  long_terms text[] := ARRAY['arrombado','babaca','buceta','caralho','cuzao','desgraca','filhodaputa','fodase','imbecil','merda','otario','paunocu','porra','retardado','vadia','viado','macaco','pendejo','cabron','hijodeputa','mierda','maricon','asshole','bastard','bitch','bullshit','nigger','nigga','retard','whore'];
  short_terms text[] := ARRAY['fdp','vsf','puta','corno','bosta','cunt','dick','fuck','shit','slut'];
BEGIN
  IF _name IS NULL THEN RETURN true; END IF;
  spaced := translate(lower(_name),
    'áàâãäéèêëíìîïóòôõöúùûüçñ013457@$8',
    'aaaaaeeeeiiiiooooouuuucnoieastasb');
  spaced := regexp_replace(spaced, '[^a-z]+', ' ', 'g');
  spaced := regexp_replace(spaced, '(.)\1{2,}', '\1', 'g');
  squashed := replace(spaced, ' ', '');
  FOREACH term IN ARRAY long_terms LOOP
    IF position(term IN squashed) > 0 THEN RETURN false; END IF;
  END LOOP;
  FOREACH term IN ARRAY short_terms LOOP
    IF (' ' || spaced || ' ') LIKE ('% ' || term || ' %') THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_activity_public_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Ranking names are public: offensive names fall back to a neutral label.
  IF NOT public.public_name_is_clean(NEW.public_name) THEN
    NEW.public_name := 'Treinador';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activity_rankings_sanitize_public_name ON public.activity_rankings;
CREATE TRIGGER activity_rankings_sanitize_public_name
BEFORE INSERT OR UPDATE OF public_name ON public.activity_rankings
FOR EACH ROW EXECUTE FUNCTION public.sanitize_activity_public_name();

UPDATE public.activity_rankings SET public_name = 'Treinador' WHERE NOT public.public_name_is_clean(public_name);