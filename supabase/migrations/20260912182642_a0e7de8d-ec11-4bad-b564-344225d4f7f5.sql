CREATE TABLE IF NOT EXISTS public.player_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text,
  birth_year integer CHECK (birth_year IS NULL OR (birth_year > 1900 AND birth_year < 2100)),
  supervised boolean NOT NULL DEFAULT false,
  guardian_email text,
  guardian_approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.player_profiles TO authenticated;
GRANT ALL ON public.player_profiles TO service_role;
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile read" ON public.player_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own profile insert" ON public.player_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile update" ON public.player_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.wallet_item_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_item_log_user_idx ON public.wallet_item_log (user_id, created_at DESC);
GRANT SELECT ON public.wallet_item_log TO authenticated;
GRANT ALL ON public.wallet_item_log TO service_role;
ALTER TABLE public.wallet_item_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own item log read" ON public.wallet_item_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.consume_wallet_item(_user_id uuid, _item text, _detail text DEFAULT NULL)
 RETURNS TABLE(scout_reports integer, training_boosts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  left_over integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _item NOT IN ('scout_report', 'training_boost') THEN
    RAISE EXCEPTION 'invalid_item';
  END IF;

  INSERT INTO public.user_wallet (user_id) VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  IF _item = 'scout_report' THEN
    SELECT w.scout_reports INTO left_over FROM public.user_wallet w
      WHERE w.user_id = _user_id FOR UPDATE;
    IF left_over IS NULL OR left_over < 1 THEN RETURN; END IF;
    UPDATE public.user_wallet w SET scout_reports = w.scout_reports - 1, updated_at = now()
      WHERE w.user_id = _user_id;
  ELSE
    SELECT w.training_boosts INTO left_over FROM public.user_wallet w
      WHERE w.user_id = _user_id FOR UPDATE;
    IF left_over IS NULL OR left_over < 1 THEN RETURN; END IF;
    UPDATE public.user_wallet w SET training_boosts = w.training_boosts - 1, updated_at = now()
      WHERE w.user_id = _user_id;
  END IF;

  INSERT INTO public.wallet_item_log (user_id, item, detail) VALUES (_user_id, _item, _detail);

  RETURN QUERY SELECT w.scout_reports, w.training_boosts
    FROM public.user_wallet w WHERE w.user_id = _user_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.consume_wallet_item(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_wallet_item(uuid, text, text) TO service_role;