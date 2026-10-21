-- Bootstrap for a NEW, EMPTY Supabase project only.
-- Original migrations are kept intact; payment migrations shared by both histories run once.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE')
    OR EXISTS (SELECT 1 FROM auth.users) OR EXISTS (SELECT 1 FROM storage.objects) THEN
    RAISE EXCEPTION 'Bootstrap requires an empty project. Use incremental migrations on existing projects.';
  END IF;
END $$;

-- Source: supabase/migrations/20260823132245_5748b682-fb4e-4c2b-9eff-e52d874e399a.sql
CREATE TABLE public.careers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.careers TO authenticated;
GRANT ALL ON public.careers TO service_role;

ALTER TABLE public.careers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own career" ON public.careers
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_careers_updated_at BEFORE UPDATE ON public.careers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source: supabase/migrations/20260905002255_d880bbb9-4d48-4caf-8a87-89ee93a0618d.sql
-- ============ competitions ============
CREATE TABLE public.competitions (
  id text PRIMARY KEY,
  name text NOT NULL,
  country text NOT NULL,
  flag text,
  tier smallint NOT NULL DEFAULT 1,
  club_count smallint NOT NULL DEFAULT 20,
  logo_url text,
  external_source text,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.competitions TO anon, authenticated;
GRANT ALL ON public.competitions TO service_role;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Competitions are public" ON public.competitions FOR SELECT USING (true);

-- ============ stadiums ============
CREATE TABLE public.stadiums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  country text,
  capacity integer,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stadiums TO anon, authenticated;
GRANT ALL ON public.stadiums TO service_role;
ALTER TABLE public.stadiums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stadiums are public" ON public.stadiums FOR SELECT USING (true);

-- ============ clubs ============
CREATE TABLE public.clubs (
  id text PRIMARY KEY,
  competition_id text REFERENCES public.competitions(id) ON DELETE SET NULL,
  name text NOT NULL,
  short_name text NOT NULL,
  full_name text,
  city text,
  country text,
  founded smallint,
  primary_color text NOT NULL DEFAULT '#0a8f3c',
  secondary_color text NOT NULL DEFAULT '#ffffff',
  strength smallint NOT NULL DEFAULT 70,
  crest_url text,
  stadium_id uuid REFERENCES public.stadiums(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clubs_competition_idx ON public.clubs(competition_id);
GRANT SELECT ON public.clubs TO anon, authenticated;
GRANT ALL ON public.clubs TO service_role;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clubs are public" ON public.clubs FOR SELECT USING (true);

-- ============ kits ============
CREATE TABLE public.kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id text NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  season text NOT NULL DEFAULT '2025-2026',
  kind text NOT NULL DEFAULT 'home',
  pattern text NOT NULL DEFAULT 'solid',
  base_color text NOT NULL DEFAULT '#ffffff',
  detail_color text NOT NULL DEFAULT '#111111',
  shorts_color text NOT NULL DEFAULT '#ffffff',
  socks_color text NOT NULL DEFAULT '#ffffff',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, season, kind)
);
CREATE INDEX kits_club_idx ON public.kits(club_id);
GRANT SELECT ON public.kits TO anon, authenticated;
GRANT ALL ON public.kits TO service_role;
ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kits are public" ON public.kits FOR SELECT USING (true);

-- ============ players ============
CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id text NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  position text NOT NULL,
  age smallint NOT NULL DEFAULT 24,
  shirt_number smallint,
  nationality text,
  overall smallint NOT NULL DEFAULT 70,
  potential smallint,
  photo_url text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX players_club_idx ON public.players(club_id);
GRANT SELECT ON public.players TO anon, authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players are public" ON public.players FOR SELECT USING (true);

-- ============ club_external_ids ============
CREATE TABLE public.club_external_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id text NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  source text NOT NULL,
  external_id text NOT NULL,
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id),
  UNIQUE (club_id, source)
);
GRANT SELECT ON public.club_external_ids TO anon, authenticated;
GRANT ALL ON public.club_external_ids TO service_role;
ALTER TABLE public.club_external_ids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club external ids are public" ON public.club_external_ids FOR SELECT USING (true);

-- ============ import_runs ============
CREATE TABLE public.import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  scope text,
  status text NOT NULL DEFAULT 'running',
  items_imported integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.import_runs TO anon, authenticated;
GRANT ALL ON public.import_runs TO service_role;
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Import runs are public" ON public.import_runs FOR SELECT USING (true);

-- ============ updated_at triggers ============
CREATE TRIGGER update_competitions_updated_at BEFORE UPDATE ON public.competitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stadiums_updated_at BEFORE UPDATE ON public.stadiums
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clubs_updated_at BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_kits_updated_at BEFORE UPDATE ON public.kits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_club_external_ids_updated_at BEFORE UPDATE ON public.club_external_ids
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_import_runs_updated_at BEFORE UPDATE ON public.import_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source: supabase/migrations/20260905004918_a8f54095-bf98-4e79-a0ce-85794c9309c6.sql
DELETE FROM public.stadiums a USING public.stadiums b
WHERE a.name = b.name AND a.created_at > b.created_at;

ALTER TABLE public.stadiums ADD CONSTRAINT stadiums_name_key UNIQUE (name);

-- Source: supabase/migrations/20260906001027_8cab4422-d574-43e7-8946-21b0e035bf96.sql
CREATE TABLE public.match_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  host_id uuid NOT NULL,
  guest_id uuid,
  host_club text NOT NULL,
  guest_club text,
  seed text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  minute integer NOT NULL DEFAULT 0,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_rooms TO authenticated;
GRANT ALL ON public.match_rooms TO service_role;

ALTER TABLE public.match_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants and open rooms are visible"
ON public.match_rooms FOR SELECT TO authenticated
USING (status = 'open' OR auth.uid() = host_id OR auth.uid() = guest_id);

CREATE POLICY "Host creates the room"
ON public.match_rooms FOR INSERT TO authenticated
WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Participants update the room"
ON public.match_rooms FOR UPDATE TO authenticated
USING (auth.uid() = host_id OR auth.uid() = guest_id OR (status = 'open' AND guest_id IS NULL))
WITH CHECK (auth.uid() = host_id OR auth.uid() = guest_id);

CREATE POLICY "Host deletes the room"
ON public.match_rooms FOR DELETE TO authenticated
USING (auth.uid() = host_id);

CREATE TRIGGER update_match_rooms_updated_at
BEFORE UPDATE ON public.match_rooms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.match_rooms;

-- Source: supabase/migrations/20260906225842_3231ac82-b926-422d-b0b6-8a79ed7a0b9d.sql
CREATE TABLE public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  body text not null check (char_length(body) between 1 and 500),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users read chat" ON public.chat_messages FOR SELECT TO authenticated USING (hidden = false);
CREATE POLICY "Users send own messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own messages" ON public.chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

CREATE TABLE public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, achievement_key)
);
GRANT SELECT, INSERT, DELETE ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own achievements" ON public.user_achievements FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.store_products (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null default '',
  price_cents integer not null default 0,
  currency text not null default 'BRL',
  coins integer not null default 0,
  kind text not null default 'coins',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.store_products TO anon;
GRANT SELECT ON public.store_products TO authenticated;
GRANT ALL ON public.store_products TO service_role;
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are public" ON public.store_products FOR SELECT USING (active = true);

CREATE TABLE public.user_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_key text not null,
  amount_cents integer not null default 0,
  status text not null default 'pending',
  reference text,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT ON public.user_purchases TO authenticated;
GRANT ALL ON public.user_purchases TO service_role;
ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own purchases" ON public.user_purchases FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own purchases" ON public.user_purchases FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_wallet (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins integer not null default 0,
  season_pass boolean not null default false,
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_wallet TO authenticated;
GRANT ALL ON public.user_wallet TO service_role;
ALTER TABLE public.user_wallet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own wallet" ON public.user_wallet FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_user_wallet_updated_at BEFORE UPDATE ON public.user_wallet FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.store_products (key, name, description, price_cents, coins, kind) VALUES
  ('coins_small', 'Bolsa de moedas', '500 moedas do jogo', 490, 500, 'coins'),
  ('coins_medium', 'Cofre de moedas', '1.500 moedas do jogo', 1290, 1500, 'coins'),
  ('scout_pack', 'Pacote de olheiro', 'Relatórios completos de 10 alvos', 990, 0, 'scout'),
  ('training_pack', 'Treino intensivo', 'Uma temporada de treinos extras', 990, 0, 'training'),
  ('theme_pack', 'Temas e escudos', 'Coleção de temas visuais e escudos exclusivos', 1490, 0, 'cosmetic'),
  ('season_pass', 'Passe de temporada', 'Recompensas semanais durante uma temporada', 2490, 0, 'pass');

-- Source: supabase/migrations/20260906231838_39cc4133-2ef3-4e11-9dc4-343c5bad3e12.sql
ALTER TABLE public.user_wallet
  ADD COLUMN IF NOT EXISTS scout_reports integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS training_boosts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unlocked_themes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS season_pass_until timestamptz;

GRANT SELECT, INSERT, UPDATE ON public.user_wallet TO authenticated;
GRANT ALL ON public.user_wallet TO service_role;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);

GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
  ON public.subscriptions FOR ALL TO service_role
  USING (true);

CREATE OR REPLACE FUNCTION public.has_active_subscription(
  user_uuid uuid,
  check_env text default 'live'
)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = user_uuid
      AND environment = check_env
      AND (
        (status IN ('active', 'trialing') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  );
$$;

-- Source: supabase/migrations/20260906231905_39755965-1e4e-4fae-ad8a-dd99f62eb59b.sql
CREATE OR REPLACE FUNCTION public.has_active_subscription(
  user_uuid uuid,
  check_env text default 'live'
)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = user_uuid
      AND environment = check_env
      AND (
        (status IN ('active', 'trialing') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO service_role;

-- Source: supabase/migrations/20260907001101_0352c2df-2db9-401d-bb68-fed4051b076b.sql

-- ============ 1. Carteira: somente leitura para o usuário ============
DROP POLICY IF EXISTS "Users manage own wallet" ON public.user_wallet;
REVOKE INSERT, UPDATE, DELETE ON public.user_wallet FROM authenticated;
REVOKE ALL ON public.user_wallet FROM anon;
GRANT SELECT ON public.user_wallet TO authenticated;

CREATE POLICY "Users read own wallet" ON public.user_wallet
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Débito seguro de moedas, feito no servidor com verificação de saldo.
CREATE OR REPLACE FUNCTION public.spend_coins(amount integer)
RETURNS TABLE(coins integer, season_pass boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_coins integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF amount IS NULL OR amount <= 0 OR amount > 1000000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  INSERT INTO public.user_wallet (user_id)
  VALUES (auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT w.coins INTO current_coins
  FROM public.user_wallet w
  WHERE w.user_id = auth.uid()
  FOR UPDATE;

  IF current_coins < amount THEN
    RETURN; -- saldo insuficiente: retorna vazio
  END IF;

  UPDATE public.user_wallet w
  SET coins = w.coins - amount, updated_at = now()
  WHERE w.user_id = auth.uid();

  RETURN QUERY
  SELECT w.coins, w.season_pass FROM public.user_wallet w WHERE w.user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.spend_coins(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.spend_coins(integer) TO authenticated;

-- ============ 2. Chat: envio seguro, nome da conta, limites ============
ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_body_len;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_body_len CHECK (char_length(body) BETWEEN 1 AND 500);

DROP POLICY IF EXISTS "Users send own messages" ON public.chat_messages;
REVOKE INSERT ON public.chat_messages FROM authenticated;

CREATE OR REPLACE FUNCTION public.send_chat_message(message_body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_body text;
  sender_name text;
  new_id uuid;
  recent_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  clean_body := btrim(COALESCE(message_body, ''));
  IF char_length(clean_body) < 1 OR char_length(clean_body) > 500 THEN
    RAISE EXCEPTION 'invalid_length';
  END IF;

  -- limite de rajada: no máximo 10 mensagens por minuto por usuário
  SELECT count(*) INTO recent_count
  FROM public.chat_messages m
  WHERE m.user_id = auth.uid()
    AND m.created_at > now() - interval '1 minute';
  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  SELECT COALESCE(
      NULLIF(btrim(u.raw_user_meta_data->>'display_name'), ''),
      NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
      'Técnico'
    )
  INTO sender_name
  FROM auth.users u
  WHERE u.id = auth.uid();

  INSERT INTO public.chat_messages (user_id, display_name, body)
  VALUES (auth.uid(), left(sender_name, 40), clean_body)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_chat_message(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.send_chat_message(text) TO authenticated;

-- ============ 3. Tabelas internas de importação: só o servidor ============
DROP POLICY IF EXISTS "Club external ids are public" ON public.club_external_ids;
DROP POLICY IF EXISTS "Import runs are public" ON public.import_runs;
REVOKE ALL ON public.club_external_ids FROM anon, authenticated;
REVOKE ALL ON public.import_runs FROM anon, authenticated;
GRANT ALL ON public.club_external_ids TO service_role;
GRANT ALL ON public.import_runs TO service_role;


-- Source: supabase/migrations/20260910220720_ff9958ae-fc7f-4d03-abe8-60a608c4b98c.sql
-- Internal-only tables: no client access at all
REVOKE ALL ON public.club_external_ids FROM anon, authenticated;
REVOKE ALL ON public.import_runs FROM anon, authenticated;
GRANT ALL ON public.club_external_ids TO service_role;
GRANT ALL ON public.import_runs TO service_role;

-- Chat: anon has no policies, remove leftover grants
REVOKE ALL ON public.chat_messages FROM anon;
GRANT SELECT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

-- Wallet: read-only for the owner, nothing for anon
REVOKE ALL ON public.user_wallet FROM anon, authenticated;
GRANT SELECT ON public.user_wallet TO authenticated;
GRANT ALL ON public.user_wallet TO service_role;

-- SECURITY DEFINER functions: not callable by anonymous visitors
REVOKE EXECUTE ON FUNCTION public.send_chat_message(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.spend_coins(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_chat_message(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_coins(integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Chat display name must never leak the e-mail address
CREATE OR REPLACE FUNCTION public.send_chat_message(message_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  clean_body text;
  sender_name text;
  new_id uuid;
  recent_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  clean_body := btrim(COALESCE(message_body, ''));
  IF char_length(clean_body) < 1 OR char_length(clean_body) > 500 THEN
    RAISE EXCEPTION 'invalid_length';
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.chat_messages m
  WHERE m.user_id = auth.uid()
    AND m.created_at > now() - interval '1 minute';
  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  -- Nunca usar o e-mail: apenas apelido escolhido pelo usuário ou nome genérico.
  SELECT COALESCE(
      NULLIF(btrim(u.raw_user_meta_data->>'display_name'), ''),
      'Técnico ' || substr(replace(u.id::text, '-', ''), 1, 5)
    )
  INTO sender_name
  FROM auth.users u
  WHERE u.id = auth.uid();

  INSERT INTO public.chat_messages (user_id, display_name, body)
  VALUES (auth.uid(), left(COALESCE(sender_name, 'Técnico'), 40), clean_body)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.send_chat_message(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_chat_message(text) TO authenticated;

-- Source: supabase/migrations/20260910220802_b9bc97d2-0717-41c6-806b-978785a68f6e.sql
DROP FUNCTION IF EXISTS public.send_chat_message(text);
DROP FUNCTION IF EXISTS public.spend_coins(integer);

CREATE OR REPLACE FUNCTION public.send_chat_message_for(_user_id uuid, message_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  clean_body text;
  sender_name text;
  new_id uuid;
  recent_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  clean_body := btrim(COALESCE(message_body, ''));
  IF char_length(clean_body) < 1 OR char_length(clean_body) > 500 THEN
    RAISE EXCEPTION 'invalid_length';
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.chat_messages m
  WHERE m.user_id = _user_id
    AND m.created_at > now() - interval '1 minute';
  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  SELECT COALESCE(
      NULLIF(btrim(u.raw_user_meta_data->>'display_name'), ''),
      'Técnico ' || substr(replace(u.id::text, '-', ''), 1, 5)
    )
  INTO sender_name
  FROM auth.users u
  WHERE u.id = _user_id;

  IF sender_name IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  INSERT INTO public.chat_messages (user_id, display_name, body)
  VALUES (_user_id, left(sender_name, 40), clean_body)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.spend_coins_for(_user_id uuid, amount integer)
 RETURNS TABLE(coins integer, season_pass boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_coins integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF amount IS NULL OR amount <= 0 OR amount > 1000000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  INSERT INTO public.user_wallet (user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT w.coins INTO current_coins
  FROM public.user_wallet w
  WHERE w.user_id = _user_id
  FOR UPDATE;

  IF current_coins < amount THEN
    RETURN;
  END IF;

  UPDATE public.user_wallet w
  SET coins = w.coins - amount, updated_at = now()
  WHERE w.user_id = _user_id;

  RETURN QUERY
  SELECT w.coins, w.season_pass FROM public.user_wallet w WHERE w.user_id = _user_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.send_chat_message_for(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.spend_coins_for(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_message_for(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.spend_coins_for(uuid, integer) TO service_role;

-- Source: supabase/migrations/20260910221846_41fbb298-1603-44ca-84e0-037602eb1d28.sql
ALTER TABLE public.user_purchases
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DELETE FROM public.user_purchases a
USING public.user_purchases b
WHERE a.reference IS NOT NULL
  AND a.reference = b.reference
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS user_purchases_reference_key
  ON public.user_purchases (reference)
  WHERE reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_purchases_user_created_idx
  ON public.user_purchases (user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_user_purchases_updated_at ON public.user_purchases;
CREATE TRIGGER update_user_purchases_updated_at
  BEFORE UPDATE ON public.user_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT ON public.user_purchases TO authenticated;
GRANT ALL ON public.user_purchases TO service_role;

-- Source: supabase/migrations/20260910225515_00089286-e3d2-4116-867f-578d0589f42f.sql
DROP INDEX IF EXISTS public.user_purchases_reference_key;
DROP INDEX IF EXISTS public.user_purchases_reference_unique;
CREATE UNIQUE INDEX IF NOT EXISTS user_purchases_reference_uniq ON public.user_purchases (reference);

-- Source: supabase/migrations/20260912182642_a0e7de8d-ec11-4bad-b564-344225d4f7f5.sql
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

-- Source: supabase/migrations/20260912183649_cf1db069-7885-4864-89aa-36cb5c3c830d.sql
-- ============ Orçamento de IA e voz ============
CREATE TABLE public.ai_budget_usage (
  month text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('text','voice')),
  spent_cents integer NOT NULL DEFAULT 0,
  requests integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (month, kind)
);
GRANT ALL ON public.ai_budget_usage TO service_role;
ALTER TABLE public.ai_budget_usage ENABLE ROW LEVEL SECURITY;

-- Reserva antes do pedido: devolve false quando o teto do mês foi atingido.
CREATE OR REPLACE FUNCTION public.reserve_ai_budget(_kind text, _cents integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cap integer;
  used integer;
  m text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
BEGIN
  IF _kind NOT IN ('text','voice') THEN RAISE EXCEPTION 'invalid_kind'; END IF;
  IF _cents IS NULL OR _cents < 0 OR _cents > 100000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  cap := CASE WHEN _kind = 'text' THEN 35000 ELSE 15000 END;

  INSERT INTO public.ai_budget_usage (month, kind) VALUES (m, _kind)
  ON CONFLICT (month, kind) DO NOTHING;

  SELECT u.spent_cents INTO used FROM public.ai_budget_usage u
    WHERE u.month = m AND u.kind = _kind FOR UPDATE;

  IF used + _cents > cap THEN RETURN false; END IF;

  UPDATE public.ai_budget_usage u
    SET spent_cents = u.spent_cents + _cents, requests = u.requests + 1, updated_at = now()
    WHERE u.month = m AND u.kind = _kind;
  RETURN true;
END;
$$;

-- ============ Comunidade: bloqueio e denúncia ============
CREATE TABLE public.user_blocks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own blocks read" ON public.user_blocks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own blocks insert" ON public.user_blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND blocked_id <> auth.uid());
CREATE POLICY "own blocks delete" ON public.user_blocks FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.chat_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, reporter_id)
);
GRANT SELECT, INSERT ON public.chat_reports TO authenticated;
GRANT ALL ON public.chat_reports TO service_role;
ALTER TABLE public.chat_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reports read" ON public.chat_reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "own reports insert" ON public.chat_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- Mensagens de quem eu bloqueei somem da minha lista.
DROP POLICY IF EXISTS "Signed in users read chat" ON public.chat_messages;
CREATE POLICY "Signed in users read chat" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    hidden = false
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE b.user_id = auth.uid() AND b.blocked_id = chat_messages.user_id
    )
  );

-- ============ Impulso de treino semanal ============
CREATE TABLE public.user_boosts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  training_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_boosts TO authenticated;
GRANT ALL ON public.user_boosts TO service_role;
ALTER TABLE public.user_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own boost read" ON public.user_boosts FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Consome um impulso da carteira e vale por 7 dias. Não acumula: ativar de
-- novo enquanto está ativo apenas recomeça a semana.
CREATE OR REPLACE FUNCTION public.activate_training_boost(_user_id uuid)
RETURNS TABLE(training_until timestamptz, training_boosts integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  left_over integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  INSERT INTO public.user_wallet (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_boosts (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;

  SELECT w.training_boosts INTO left_over FROM public.user_wallet w
    WHERE w.user_id = _user_id FOR UPDATE;
  IF left_over IS NULL OR left_over < 1 THEN RETURN; END IF;

  UPDATE public.user_wallet w SET training_boosts = w.training_boosts - 1, updated_at = now()
    WHERE w.user_id = _user_id;
  UPDATE public.user_boosts b SET training_until = now() + interval '7 days', updated_at = now()
    WHERE b.user_id = _user_id;
  INSERT INTO public.wallet_item_log (user_id, item, detail)
    VALUES (_user_id, 'training_boost', 'impulso semanal ativado');

  RETURN QUERY
    SELECT b.training_until, w.training_boosts
    FROM public.user_boosts b JOIN public.user_wallet w ON w.user_id = b.user_id
    WHERE b.user_id = _user_id;
END;
$$;

-- Source: supabase/migrations/20260912183709_a8d65e82-ee8d-44e2-ad5c-d12eec36f544.sql
REVOKE EXECUTE ON FUNCTION public.reserve_ai_budget(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_training_boost(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_budget(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_training_boost(uuid) TO service_role;

CREATE POLICY "service role manages ai budget" ON public.ai_budget_usage
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Source: supabase/migrations/20260922153000_guest_checkout_intents.sql
-- Guest checkout owns an intent before a player has an authenticated account.
-- Catalog fields are defined by the following server-catalog migration. Each
-- intent takes its own private benefit snapshot so a later catalog edit cannot
-- change what a completed payment receives.
CREATE TABLE IF NOT EXISTS public.guest_checkout_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_key text NOT NULL REFERENCES public.store_products(key),
  -- A deployment-secret hash only. The raw visitor email stays with Stripe and
  -- Supabase Auth and is never persisted in this table.
  email_hash text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'live')),
  state text NOT NULL DEFAULT 'created'
    CHECK (state IN ('created', 'checkout_open', 'paid', 'claiming', 'claimed', 'expired', 'failed')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  contents_snapshot jsonb NOT NULL CHECK (
    jsonb_typeof(contents_snapshot) = 'object'
    AND jsonb_typeof(contents_snapshot -> 'coins') = 'number'
    AND COALESCE((contents_snapshot ->> 'coins') ~ '^[0-9]+$', false)
    AND jsonb_typeof(contents_snapshot -> 'scoutReports') = 'number'
    AND COALESCE((contents_snapshot ->> 'scoutReports') ~ '^[0-9]+$', false)
    AND jsonb_typeof(contents_snapshot -> 'trainingBoosts') = 'number'
    AND COALESCE((contents_snapshot ->> 'trainingBoosts') ~ '^[0-9]+$', false)
    AND jsonb_typeof(contents_snapshot -> 'themes') = 'array'
  ),
  stripe_price_id text,
  stripe_customer_id text,
  stripe_session_id text UNIQUE,
  open_key text UNIQUE,
  consent_version text NOT NULL,
  claimed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  expires_at timestamptz NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_checkout_intents_email_state_idx
  ON public.guest_checkout_intents(email_hash, state, expires_at DESC);
CREATE INDEX IF NOT EXISTS guest_checkout_intents_session_idx
  ON public.guest_checkout_intents(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

ALTER TABLE public.guest_checkout_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_checkout_intents FROM anon, authenticated;
GRANT ALL ON public.guest_checkout_intents TO service_role;

DROP TRIGGER IF EXISTS update_guest_checkout_intents_updated_at ON public.guest_checkout_intents;
CREATE TRIGGER update_guest_checkout_intents_updated_at
  BEFORE UPDATE ON public.guest_checkout_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- This service-only window prevents a repeated visitor click from opening an
-- unbounded number of Stripe sessions for the same email address.
CREATE TABLE IF NOT EXISTS public.guest_checkout_rate_limits (
  email_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.guest_checkout_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_checkout_rate_limits FROM anon, authenticated;
GRANT ALL ON public.guest_checkout_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_guest_checkout_attempt(_email_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed boolean;
BEGIN
  IF char_length(_email_hash) <> 64 THEN
    RAISE EXCEPTION 'Invalid checkout rate key';
  END IF;

  INSERT INTO public.guest_checkout_rate_limits AS limits (email_hash, window_started_at, attempts, updated_at)
  VALUES (_email_hash, now(), 1, now())
  ON CONFLICT (email_hash) DO UPDATE
  SET
    attempts = CASE
      WHEN limits.window_started_at < now() - interval '15 minutes' THEN 1
      ELSE limits.attempts + 1
    END,
    window_started_at = CASE
      WHEN limits.window_started_at < now() - interval '15 minutes' THEN now()
      ELSE limits.window_started_at
    END,
    updated_at = now()
  WHERE limits.window_started_at < now() - interval '15 minutes'
     OR limits.attempts < 5
  RETURNING true INTO allowed;

  RETURN COALESCE(allowed, false);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_guest_checkout_attempt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_guest_checkout_attempt(text) TO service_role;

-- Claim ownership is a locked, service-only transition. Concurrent browser
-- tabs or two accounts cannot both attach a paid intent to their wallets.
CREATE OR REPLACE FUNCTION public.reserve_guest_checkout_claim(
  _intent_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_owner uuid;
  current_state text;
BEGIN
  SELECT claimed_by_user_id, state INTO current_owner, current_state
  FROM public.guest_checkout_intents
  WHERE id = _intent_id
  FOR UPDATE;

  IF NOT FOUND OR (current_owner IS NOT NULL AND current_owner <> _user_id) THEN
    RETURN false;
  END IF;

  IF current_state = 'claimed' THEN
    RETURN current_owner = _user_id;
  END IF;

  UPDATE public.guest_checkout_intents
  SET state = 'claiming', claimed_by_user_id = _user_id, error = NULL, updated_at = now()
  WHERE id = _intent_id
    AND state IN ('created', 'checkout_open', 'paid', 'claiming');

  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_guest_checkout_claim(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_guest_checkout_claim(uuid, uuid) TO service_role;


-- Source: supabase/migrations/20260922163000_store_catalog_checkout.sql
-- Keep the browser limited to the public product card fields. Stripe lookup
-- keys and fulfillment contents are read only by the payment service role.
ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS stripe_lookup_key text,
  ADD COLUMN IF NOT EXISTS contents jsonb;

UPDATE public.store_products
SET stripe_lookup_key = CASE key
  WHEN 'season_pass' THEN 'season_pass_monthly'
  ELSE key
END
WHERE stripe_lookup_key IS NULL;

UPDATE public.store_products
SET contents = CASE key
  WHEN 'coins_starter' THEN '{"coins":200,"scoutReports":0,"trainingBoosts":0,"themes":[]}'::jsonb
  WHEN 'coins_small' THEN '{"coins":500,"scoutReports":0,"trainingBoosts":0,"themes":[]}'::jsonb
  WHEN 'coins_medium' THEN '{"coins":1500,"scoutReports":0,"trainingBoosts":0,"themes":[]}'::jsonb
  WHEN 'coins_large' THEN '{"coins":4000,"scoutReports":0,"trainingBoosts":0,"themes":[]}'::jsonb
  WHEN 'scout_pack' THEN '{"coins":0,"scoutReports":10,"trainingBoosts":0,"themes":[]}'::jsonb
  WHEN 'training_pack' THEN '{"coins":0,"scoutReports":0,"trainingBoosts":1,"themes":[]}'::jsonb
  WHEN 'theme_pack' THEN '{"coins":0,"scoutReports":0,"trainingBoosts":0,"themes":["premium_gold","premium_carbon","neon_stadium"]}'::jsonb
  WHEN 'celebration_pack' THEN '{"coins":0,"scoutReports":0,"trainingBoosts":0,"themes":["celebration_extra"]}'::jsonb
  WHEN 'stadium_pack' THEN '{"coins":0,"scoutReports":0,"trainingBoosts":0,"themes":["stadium_mow","stadium_tifo"]}'::jsonb
  WHEN 'season_pass' THEN '{"coins":0,"scoutReports":0,"trainingBoosts":0,"themes":[]}'::jsonb
  ELSE contents
END
WHERE key IN (
  'coins_starter', 'coins_small', 'coins_medium', 'coins_large',
  'scout_pack', 'training_pack', 'theme_pack', 'celebration_pack',
  'stadium_pack', 'season_pass'
);

ALTER TABLE public.store_products
  ALTER COLUMN stripe_lookup_key SET NOT NULL;

-- This function mirrors the server parser: all numeric benefits are whole,
-- non-negative values and each theme is a bounded JSON string. Keeping it in
-- the database prevents a malformed catalog row from becoming a paid offer.
CREATE OR REPLACE FUNCTION public.store_product_contents_valid(_contents jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT
    jsonb_typeof(_contents) = 'object'
    AND jsonb_typeof(_contents -> 'coins') = 'number'
    AND COALESCE((_contents ->> 'coins') ~ '^[0-9]+$', false)
    AND jsonb_typeof(_contents -> 'scoutReports') = 'number'
    AND COALESCE((_contents ->> 'scoutReports') ~ '^[0-9]+$', false)
    AND jsonb_typeof(_contents -> 'trainingBoosts') = 'number'
    AND COALESCE((_contents ->> 'trainingBoosts') ~ '^[0-9]+$', false)
    AND jsonb_typeof(_contents -> 'themes') = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(_contents -> 'themes') = 'array' THEN _contents -> 'themes'
          ELSE '[]'::jsonb
        END
      ) AS theme(value)
      WHERE jsonb_typeof(theme.value) <> 'string'
         OR char_length(theme.value #>> '{}') > 80
    );
$$;

ALTER TABLE public.store_products
  ADD CONSTRAINT store_products_contents_contract
  CHECK (
    contents IS NULL OR public.store_product_contents_valid(contents)
  ) NOT VALID;
ALTER TABLE public.store_products
  VALIDATE CONSTRAINT store_products_contents_contract;

ALTER TABLE public.store_products
  ADD CONSTRAINT store_products_currency_code
  CHECK (currency ~ '^[A-Za-z]{3}$') NOT VALID;
ALTER TABLE public.store_products
  VALIDATE CONSTRAINT store_products_currency_code;

ALTER TABLE public.guest_checkout_intents
  ADD CONSTRAINT guest_checkout_intents_contents_snapshot_contract
  CHECK (public.store_product_contents_valid(contents_snapshot)) NOT VALID;
ALTER TABLE public.guest_checkout_intents
  VALIDATE CONSTRAINT guest_checkout_intents_contents_snapshot_contract;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.store_products
    WHERE active = true
      AND (
        contents IS NULL
        OR NOT public.store_product_contents_valid(contents)
      )
  ) THEN
    RAISE EXCEPTION 'Every active store product must define a complete contents object before checkout is enabled.';
  END IF;
END;
$$;

-- Table-level SELECT would expose the new private columns to anon users.
REVOKE SELECT ON public.store_products FROM anon, authenticated;
GRANT SELECT (key, name, description, price_cents, currency, coins, kind, active)
  ON public.store_products TO anon, authenticated;
GRANT ALL ON public.store_products TO service_role;

-- The verified Stripe webhook and authenticated return handler call this RPC.
-- Purchase-state transition and wallet credit commit as one idempotent change.
CREATE OR REPLACE FUNCTION public.fulfill_store_purchase(
  _user_id uuid,
  _product_key text,
  _reference text,
  _amount_cents integer,
  _coins integer,
  _scout_reports integer,
  _training_boosts integer,
  _themes text[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed boolean := false;
BEGIN
  IF _reference IS NULL OR char_length(_reference) = 0
    OR _amount_cents < 0 OR _coins < 0 OR _scout_reports < 0 OR _training_boosts < 0 THEN
    RAISE EXCEPTION 'Invalid fulfillment values';
  END IF;

  UPDATE public.user_purchases
  SET
    product_key = _product_key,
    amount_cents = _amount_cents,
    status = 'completed',
    error = NULL,
    updated_at = now()
  WHERE reference = _reference
    AND user_id = _user_id
    AND status <> 'completed';
  changed := FOUND;

  IF NOT changed THEN
    INSERT INTO public.user_purchases (
      user_id, product_key, amount_cents, status, error, reference
    ) VALUES (
      _user_id, _product_key, _amount_cents, 'completed', NULL, _reference
    )
    ON CONFLICT (reference) DO NOTHING;
    changed := FOUND;
  END IF;

  IF NOT changed THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_wallet (user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_wallet AS wallet
  SET
    coins = wallet.coins + _coins,
    scout_reports = wallet.scout_reports + _scout_reports,
    training_boosts = wallet.training_boosts + _training_boosts,
    unlocked_themes = ARRAY(
      SELECT DISTINCT theme
      FROM unnest(COALESCE(wallet.unlocked_themes, ARRAY[]::text[]) || COALESCE(_themes, ARRAY[]::text[])) AS theme
      WHERE char_length(theme) > 0
    ),
    updated_at = now()
  WHERE wallet.user_id = _user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_store_purchase(uuid, text, text, integer, integer, integer, integer, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfill_store_purchase(uuid, text, text, integer, integer, integer, integer, text[]) TO service_role;


-- Source: supabase/migrations/20260922180000_guest_checkout_delayed_payment_claim.sql
-- A Checkout Session can be complete while an asynchronous method is still
-- settling. If it succeeds after the original 31-minute window, the signed
-- Stripe event still proves payment and the original intent must remain
-- claimable rather than silently losing the visitor's purchase.
CREATE OR REPLACE FUNCTION public.reserve_guest_checkout_claim(
  _intent_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_owner uuid;
  current_state text;
BEGIN
  SELECT claimed_by_user_id, state INTO current_owner, current_state
  FROM public.guest_checkout_intents
  WHERE id = _intent_id
  FOR UPDATE;

  IF NOT FOUND OR (current_owner IS NOT NULL AND current_owner <> _user_id) THEN
    RETURN false;
  END IF;

  IF current_state = 'claimed' THEN
    RETURN current_owner = _user_id;
  END IF;

  UPDATE public.guest_checkout_intents
  SET state = 'claiming', claimed_by_user_id = _user_id, error = NULL, updated_at = now()
  WHERE id = _intent_id
    AND state IN ('created', 'checkout_open', 'paid', 'claiming', 'expired');

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_guest_checkout_claim(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_guest_checkout_claim(uuid, uuid) TO service_role;


-- Source: drizzle/migrations/0000_storage_objects_owner_policies.sql
-- Restrict all storage access to the file's own uploader; the export bucket
-- is internal, so no anonymous access is granted.
DROP POLICY IF EXISTS "Owners can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete their own files" ON storage.objects;

CREATE POLICY "Owners can read their own files"
ON storage.objects FOR SELECT TO authenticated
USING (owner = auth.uid());

CREATE POLICY "Owners can upload their own files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (owner = auth.uid());

CREATE POLICY "Owners can update their own files"
ON storage.objects FOR UPDATE TO authenticated
USING (owner = auth.uid())
WITH CHECK (owner = auth.uid());

CREATE POLICY "Owners can delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (owner = auth.uid());

-- Source: drizzle/migrations/0001_clubs_website.sql
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS website TEXT;

-- Source: drizzle/migrations/0002_create_user_profiles.sql
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY,
  display_name text,
  avatar_url text,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX profiles_updated_at_idx ON public.profiles (updated_at DESC);

-- Source: drizzle/migrations/0003_add_club_history_and_honours.sql
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS data_source TEXT,
  ADD COLUMN IF NOT EXISTS data_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.club_honours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id TEXT NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  competition TEXT NOT NULL,
  title_count INTEGER NOT NULL DEFAULT 1 CHECK (title_count > 0),
  seasons TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (club_id, competition, source)
);

GRANT SELECT ON public.club_honours TO anon, authenticated;
GRANT ALL ON public.club_honours TO service_role;

ALTER TABLE public.club_honours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club honours are publicly readable"
ON public.club_honours
FOR SELECT
TO anon, authenticated
USING (true);

CREATE INDEX IF NOT EXISTS club_honours_club_id_idx ON public.club_honours (club_id);
CREATE INDEX IF NOT EXISTS club_honours_source_idx ON public.club_honours (source);

-- Source: drizzle/migrations/0004_secure_user_purchase_writes.sql
REVOKE INSERT, UPDATE, DELETE ON public.user_purchases FROM authenticated;
DROP POLICY IF EXISTS "Users create own purchases" ON public.user_purchases;

-- Defense in depth: only the privileged payment fulfillment path may write purchases.
GRANT SELECT ON public.user_purchases TO authenticated;
GRANT ALL ON public.user_purchases TO service_role;

-- Source: drizzle/migrations/0005_create_opt_in_activity_rankings.sql
CREATE TABLE public.activity_rankings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  public_name text NOT NULL DEFAULT 'Treinador',
  club_id text,
  opted_in boolean NOT NULL DEFAULT false,
  active_seconds bigint NOT NULL DEFAULT 0 CHECK (active_seconds >= 0),
  weekly_active_seconds bigint NOT NULL DEFAULT 0 CHECK (weekly_active_seconds >= 0),
  matches_started integer NOT NULL DEFAULT 0 CHECK (matches_started >= 0),
  matches_completed integer NOT NULL DEFAULT 0 CHECK (matches_completed >= 0),
  wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  seasons integer NOT NULL DEFAULT 0 CHECK (seasons >= 0),
  active_streak integer NOT NULL DEFAULT 0 CHECK (active_streak >= 0),
  week_key date NOT NULL DEFAULT date_trunc('week', timezone('utc', now()))::date,
  last_active_date date,
  last_heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(public_name) BETWEEN 2 AND 28)
);

GRANT SELECT ON public.activity_rankings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.activity_rankings TO authenticated;
GRANT ALL ON public.activity_rankings TO service_role;

ALTER TABLE public.activity_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read opted in rankings"
ON public.activity_rankings FOR SELECT
TO anon, authenticated
USING (opted_in OR auth.uid() = user_id);

CREATE POLICY "Users can create own activity row"
ON public.activity_rankings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activity row"
ON public.activity_rankings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX activity_rankings_weekly_idx
ON public.activity_rankings (weekly_active_seconds DESC)
WHERE opted_in;

CREATE INDEX activity_rankings_total_idx
ON public.activity_rankings (active_seconds DESC)
WHERE opted_in;

CREATE OR REPLACE FUNCTION public.record_active_time(
  p_public_name text,
  p_club_id text,
  p_matches_started integer DEFAULT 0,
  p_matches_completed integer DEFAULT 0,
  p_wins integer DEFAULT 0,
  p_seasons integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_today date := timezone('utc', now())::date;
  v_week date := date_trunc('week', timezone('utc', now()))::date;
  v_previous public.activity_rankings%ROWTYPE;
  v_delta integer := 0;
  v_streak integer := 1;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_previous
  FROM public.activity_rankings
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_previous.last_heartbeat_at IS NOT NULL THEN
      v_delta := LEAST(90, GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_previous.last_heartbeat_at))::integer));
    END IF;
    IF v_previous.last_active_date = v_today THEN
      v_streak := v_previous.active_streak;
    ELSIF v_previous.last_active_date = v_today - 1 THEN
      v_streak := v_previous.active_streak + 1;
    END IF;
  END IF;

  INSERT INTO public.activity_rankings (
    user_id, public_name, club_id, active_seconds, weekly_active_seconds,
    matches_started, matches_completed, wins, seasons, active_streak,
    week_key, last_active_date, last_heartbeat_at, updated_at
  ) VALUES (
    v_user_id, LEFT(TRIM(COALESCE(NULLIF(p_public_name, ''), 'Treinador')), 28), p_club_id,
    0, 0, GREATEST(0, p_matches_started), GREATEST(0, p_matches_completed),
    GREATEST(0, p_wins), GREATEST(0, p_seasons), 1,
    v_week, v_today, v_now, v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    public_name = LEFT(TRIM(COALESCE(NULLIF(EXCLUDED.public_name, ''), activity_rankings.public_name)), 28),
    club_id = EXCLUDED.club_id,
    active_seconds = activity_rankings.active_seconds + v_delta,
    weekly_active_seconds = CASE
      WHEN activity_rankings.week_key = v_week THEN activity_rankings.weekly_active_seconds + v_delta
      ELSE v_delta
    END,
    matches_started = GREATEST(activity_rankings.matches_started, EXCLUDED.matches_started),
    matches_completed = GREATEST(activity_rankings.matches_completed, EXCLUDED.matches_completed),
    wins = GREATEST(activity_rankings.wins, EXCLUDED.wins),
    seasons = GREATEST(activity_rankings.seasons, EXCLUDED.seasons),
    active_streak = v_streak,
    week_key = v_week,
    last_active_date = v_today,
    last_heartbeat_at = v_now,
    updated_at = v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.record_active_time(text, text, integer, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_active_time(text, text, integer, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_active_time(text, text, integer, integer, integer, integer) TO service_role;

-- Source: drizzle/migrations/0006_secure_activity_ranking_updates.sql
REVOKE INSERT, UPDATE ON public.activity_rankings FROM authenticated;

DROP POLICY IF EXISTS "Users can create own activity row" ON public.activity_rankings;
DROP POLICY IF EXISTS "Users can update own activity row" ON public.activity_rankings;

CREATE OR REPLACE FUNCTION public.set_activity_ranking_preferences(
  p_opted_in boolean,
  p_public_name text,
  p_club_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_name text := LEFT(TRIM(COALESCE(NULLIF(p_public_name, ''), 'Treinador')), 28);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF char_length(v_name) < 2 THEN
    RAISE EXCEPTION 'Public name is too short';
  END IF;
  INSERT INTO public.activity_rankings (user_id, public_name, club_id, opted_in)
  VALUES (v_user_id, v_name, LEFT(p_club_id, 80), p_opted_in)
  ON CONFLICT (user_id) DO UPDATE SET
    public_name = EXCLUDED.public_name,
    club_id = EXCLUDED.club_id,
    opted_in = EXCLUDED.opted_in,
    updated_at = timezone('utc', now());
END;
$$;

REVOKE ALL ON FUNCTION public.set_activity_ranking_preferences(boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_activity_ranking_preferences(boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_activity_ranking_preferences(boolean, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.record_active_time(
  p_public_name text,
  p_club_id text,
  p_matches_started integer DEFAULT 0,
  p_matches_completed integer DEFAULT 0,
  p_wins integer DEFAULT 0,
  p_seasons integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_today date := timezone('utc', now())::date;
  v_week date := date_trunc('week', timezone('utc', now()))::date;
  v_previous public.activity_rankings%ROWTYPE;
  v_delta integer := 0;
  v_streak integer := 1;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_previous FROM public.activity_rankings WHERE user_id = v_user_id FOR UPDATE;
  IF FOUND THEN
    IF v_previous.last_heartbeat_at IS NOT NULL THEN
      v_delta := LEAST(75, GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_previous.last_heartbeat_at))::integer));
    END IF;
    IF v_previous.last_active_date = v_today THEN
      v_streak := v_previous.active_streak;
    ELSIF v_previous.last_active_date = v_today - 1 THEN
      v_streak := v_previous.active_streak + 1;
    END IF;
  END IF;

  INSERT INTO public.activity_rankings (
    user_id, public_name, club_id, active_seconds, weekly_active_seconds,
    matches_started, matches_completed, wins, seasons, active_streak,
    week_key, last_active_date, last_heartbeat_at, updated_at
  ) VALUES (
    v_user_id, LEFT(TRIM(COALESCE(NULLIF(p_public_name, ''), 'Treinador')), 28), LEFT(p_club_id, 80),
    0, 0, LEAST(100000, GREATEST(0, p_matches_started)),
    LEAST(100000, GREATEST(0, p_matches_completed)), LEAST(100000, GREATEST(0, p_wins)),
    LEAST(1000, GREATEST(0, p_seasons)), 1, v_week, v_today, v_now, v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    public_name = LEFT(TRIM(COALESCE(NULLIF(EXCLUDED.public_name, ''), activity_rankings.public_name)), 28),
    club_id = EXCLUDED.club_id,
    active_seconds = activity_rankings.active_seconds + v_delta,
    weekly_active_seconds = CASE WHEN activity_rankings.week_key = v_week THEN activity_rankings.weekly_active_seconds + v_delta ELSE v_delta END,
    matches_started = GREATEST(activity_rankings.matches_started, EXCLUDED.matches_started),
    matches_completed = GREATEST(activity_rankings.matches_completed, EXCLUDED.matches_completed),
    wins = GREATEST(activity_rankings.wins, EXCLUDED.wins),
    seasons = GREATEST(activity_rankings.seasons, EXCLUDED.seasons),
    active_streak = v_streak,
    week_key = v_week,
    last_active_date = v_today,
    last_heartbeat_at = v_now,
    updated_at = v_now;
END;
$$;

-- Source: drizzle/migrations/0007_private_activity_ranking_api.sql
CREATE OR REPLACE FUNCTION public.get_public_activity_rankings(p_limit integer DEFAULT 20)
RETURNS TABLE (rank bigint, public_name text, club_id text, weekly_active_seconds bigint, matches_completed integer, wins integer, active_streak integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT row_number() OVER (ORDER BY weekly_active_seconds DESC, wins DESC, updated_at ASC), public_name, club_id,
    weekly_active_seconds, matches_completed, wins, active_streak
  FROM public.activity_rankings WHERE opted_in = true
  ORDER BY weekly_active_seconds DESC, wins DESC, updated_at ASC
  LIMIT LEAST(100, GREATEST(1, p_limit));
$$;
CREATE OR REPLACE FUNCTION public.get_own_activity_ranking()
RETURNS TABLE (public_name text, club_id text, active_seconds bigint, weekly_active_seconds bigint, matches_completed integer, wins integer, active_streak integer, opted_in boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public_name, club_id, active_seconds, weekly_active_seconds, matches_completed, wins, active_streak, opted_in
  FROM public.activity_rankings WHERE user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_public_activity_rankings(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_own_activity_ranking() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_activity_rankings(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_own_activity_ranking() TO authenticated;

-- Source: drizzle/migrations/0008_restrict_activity_ranking_table_reads.sql
REVOKE SELECT ON public.activity_rankings FROM anon, authenticated;

-- Source: drizzle/migrations/0009_server_owned_results_and_achievements.sql
DROP POLICY IF EXISTS "Users manage own achievements" ON public.user_achievements;

CREATE POLICY "Users read own achievements"
  ON public.user_achievements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.user_achievements FROM authenticated;
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;

DROP POLICY IF EXISTS "Participants update the room" ON public.match_rooms;

CREATE POLICY "Participants update the room"
  ON public.match_rooms
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = host_id)
    OR (auth.uid() = guest_id)
    OR ((status = 'open'::text) AND (guest_id IS NULL))
  )
  WITH CHECK (
    ((auth.uid() = host_id) OR (auth.uid() = guest_id))
    AND (status <> 'done'::text OR state = '{}'::jsonb)
  );

GRANT ALL ON public.match_rooms TO service_role;

-- Source: drizzle/migrations/0010_etapa1_sync_metadata_seasons_stats_telemetry.sql
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clubs','players','competitions','stadiums','club_honours','kits'] LOOP
    EXECUTE format('ALTER TABLE public.%I
      ADD COLUMN IF NOT EXISTS source_id text,
      ADD COLUMN IF NOT EXISTS source_updated_at timestamptz,
      ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
      ADD COLUMN IF NOT EXISTS data_version integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT ''pending''', t);
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_sync_status_chk');
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (sync_status IN (''pending'',''synced'',''stale'',''failed'',''manual''))', t, t || '_sync_status_chk');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (sync_status, last_synced_at)', t || '_sync_idx', t);
  END LOOP;
END $$;

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'league',
  ADD COLUMN IF NOT EXISTS confederation text,
  ADD COLUMN IF NOT EXISTS format text;
ALTER TABLE public.competitions DROP CONSTRAINT IF EXISTS competitions_kind_chk;
ALTER TABLE public.competitions ADD CONSTRAINT competitions_kind_chk
  CHECK (kind IN ('league','national_cup','super_cup','state','continental','intercontinental','club_world_cup'));

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS height_cm smallint,
  ADD COLUMN IF NOT EXISTS preferred_foot text,
  ADD COLUMN IF NOT EXISTS overall_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS players_source_uidx ON public.players (source, source_id) WHERE source_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clubs_source_uidx ON public.clubs (data_source, source_id) WHERE source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.competition_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id text NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  season text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','finished','cancelled')),
  champion_club_id text REFERENCES public.clubs(id) ON DELETE SET NULL,
  runner_up_club_id text REFERENCES public.clubs(id) ON DELETE SET NULL,
  starts_on date,
  ends_on date,
  source_id text,
  source_updated_at timestamptz,
  last_synced_at timestamptz,
  data_version integer NOT NULL DEFAULT 1,
  sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','stale','failed','manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, season)
);
GRANT SELECT ON public.competition_seasons TO anon, authenticated;
GRANT ALL ON public.competition_seasons TO service_role;
ALTER TABLE public.competition_seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Catalogo publico de temporadas" ON public.competition_seasons FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.validate_competition_season()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'finished' AND NEW.champion_club_id IS NULL THEN
    RAISE EXCEPTION 'Temporada encerrada sem campeão (%/%)', NEW.competition_id, NEW.season;
  END IF;
  IF NEW.status IN ('scheduled','cancelled') AND NEW.champion_club_id IS NOT NULL THEN
    RAISE EXCEPTION 'Temporada não disputada não pode ter campeão';
  END IF;
  IF NEW.champion_club_id IS NOT NULL AND NEW.champion_club_id = NEW.runner_up_club_id THEN
    RAISE EXCEPTION 'Campeão e vice não podem ser o mesmo clube';
  END IF;
  IF NEW.starts_on IS NOT NULL AND NEW.ends_on IS NOT NULL AND NEW.ends_on < NEW.starts_on THEN
    RAISE EXCEPTION 'Data final anterior à inicial';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER competition_seasons_validate BEFORE INSERT OR UPDATE ON public.competition_seasons
  FOR EACH ROW EXECUTE FUNCTION public.validate_competition_season();

CREATE TABLE IF NOT EXISTS public.player_season_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  club_id text REFERENCES public.clubs(id) ON DELETE SET NULL,
  competition_id text REFERENCES public.competitions(id) ON DELETE SET NULL,
  season text NOT NULL,
  appearances smallint NOT NULL DEFAULT 0 CHECK (appearances >= 0),
  starts smallint NOT NULL DEFAULT 0 CHECK (starts >= 0),
  minutes integer NOT NULL DEFAULT 0 CHECK (minutes >= 0),
  goals smallint NOT NULL DEFAULT 0 CHECK (goals >= 0),
  assists smallint NOT NULL DEFAULT 0 CHECK (assists >= 0),
  yellow_cards smallint NOT NULL DEFAULT 0 CHECK (yellow_cards >= 0),
  red_cards smallint NOT NULL DEFAULT 0 CHECK (red_cards >= 0),
  clean_sheets smallint NOT NULL DEFAULT 0 CHECK (clean_sheets >= 0),
  rating numeric(4,2) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
  source text,
  source_id text,
  source_updated_at timestamptz,
  last_synced_at timestamptz,
  data_version integer NOT NULL DEFAULT 1,
  sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','stale','failed','manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts <= appearances)
);
CREATE UNIQUE INDEX IF NOT EXISTS player_season_stats_uidx
  ON public.player_season_stats (player_id, season, coalesce(competition_id, ''));
GRANT SELECT ON public.player_season_stats TO anon, authenticated;
GRANT ALL ON public.player_season_stats TO service_role;
ALTER TABLE public.player_season_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Catalogo publico de estatisticas" ON public.player_season_stats FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER player_season_stats_updated BEFORE UPDATE ON public.player_season_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.tech_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fps_avg numeric(5,1) CHECK (fps_avg IS NULL OR (fps_avg >= 0 AND fps_avg <= 1000)),
  frame_time_p95_ms numeric(7,2) CHECK (frame_time_p95_ms IS NULL OR (frame_time_p95_ms >= 0 AND frame_time_p95_ms <= 10000)),
  browser text CHECK (browser IS NULL OR length(browser) <= 32),
  gpu_tier smallint CHECK (gpu_tier IS NULL OR gpu_tier BETWEEN 0 AND 3),
  graphics_preset text CHECK (graphics_preset IS NULL OR graphics_preset IN ('baixa','media','alta','auto')),
  load_time_ms integer CHECK (load_time_ms IS NULL OR (load_time_ms >= 0 AND load_time_ms <= 600000)),
  error_code text CHECK (error_code IS NULL OR length(error_code) <= 64),
  app_version text CHECK (app_version IS NULL OR length(app_version) <= 32),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tech_telemetry TO service_role;
ALTER TABLE public.tech_telemetry ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS tech_telemetry_created_idx ON public.tech_telemetry (created_at);

-- Source: drizzle/migrations/0014_game_coupons_and_sales.sql
CREATE TABLE public.game_coupons (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9]{3,24}$'),
  description text NOT NULL,
  coins integer NOT NULL DEFAULT 0 CHECK (coins BETWEEN 0 AND 5000),
  scout_reports integer NOT NULL DEFAULT 0 CHECK (scout_reports BETWEEN 0 AND 20),
  training_boosts integer NOT NULL DEFAULT 0 CHECK (training_boosts BETWEEN 0 AND 20),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redemption_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.game_coupons TO service_role;
ALTER TABLE public.game_coupons ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL REFERENCES public.game_coupons(code),
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own redemptions" ON public.coupon_redemptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.redeem_game_coupon(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _c public.game_coupons%ROWTYPE;
  _norm text := upper(regexp_replace(coalesce(_code, ''), '\s', '', 'g'));
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'login'); END IF;
  SELECT * INTO _c FROM public.game_coupons WHERE code = _norm FOR UPDATE;
  IF NOT FOUND OR NOT _c.active THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid'); END IF;
  IF (_c.starts_at IS NOT NULL AND now() < _c.starts_at) OR (_c.ends_at IS NOT NULL AND now() > _c.ends_at) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF _c.max_redemptions IS NOT NULL AND _c.redemption_count >= _c.max_redemptions THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sold_out');
  END IF;
  INSERT INTO public.coupon_redemptions (user_id, code) VALUES (_uid, _norm) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'used'); END IF;
  UPDATE public.game_coupons SET redemption_count = redemption_count + 1 WHERE code = _norm;
  INSERT INTO public.user_wallet (user_id, coins, scout_reports, training_boosts)
    VALUES (_uid, _c.coins, _c.scout_reports, _c.training_boosts)
  ON CONFLICT (user_id) DO UPDATE SET
    coins = user_wallet.coins + EXCLUDED.coins,
    scout_reports = user_wallet.scout_reports + EXCLUDED.scout_reports,
    training_boosts = user_wallet.training_boosts + EXCLUDED.training_boosts;
  RETURN jsonb_build_object('ok', true, 'description', _c.description, 'coins', _c.coins,
    'scoutReports', _c.scout_reports, 'trainingBoosts', _c.training_boosts);
END $$;
REVOKE ALL ON FUNCTION public.redeem_game_coupon(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_game_coupon(text) TO authenticated;

INSERT INTO public.game_coupons (code, description, coins, scout_reports, training_boosts) VALUES
  ('BEMVINDO', 'Presente de boas-vindas', 500, 2, 2),
  ('VOLTEI', 'De volta ao jogo', 300, 0, 3),
  ('JOGOMANAGER', 'Cupom oficial do JogoManager', 250, 1, 1),
  ('OLHEIRO', 'Pacote de olheiros', 0, 5, 0),
  ('TREINADOR', 'Sessões extras de treino', 0, 0, 5),
  ('CRIADOR', 'Cupom de criador de conteúdo', 400, 3, 0),
  ('VARZEA', 'Raiz do futebol brasileiro', 150, 1, 1),
  ('CLASSICO', 'Dia de clássico', 200, 0, 2);

ALTER TABLE public.store_products
  ADD COLUMN sale_percent_off integer CHECK (sale_percent_off IS NULL OR sale_percent_off BETWEEN 1 AND 90),
  ADD COLUMN sale_starts_at timestamptz,
  ADD COLUMN sale_ends_at timestamptz;
GRANT SELECT (sale_percent_off, sale_starts_at, sale_ends_at) ON public.store_products TO anon, authenticated;

UPDATE public.store_products SET sale_percent_off = 20, sale_starts_at = now(), sale_ends_at = now() + interval '30 days'
  WHERE key IN ('coins_medium', 'coins_large');
UPDATE public.store_products SET sale_percent_off = 15, sale_starts_at = now(), sale_ends_at = now() + interval '30 days'
  WHERE key = 'season_pass';

-- Source: drizzle/migrations/0015_player_honours_and_career.sql
CREATE TABLE public.player_honours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'thesportsdb',
  source_id text NOT NULL UNIQUE,
  honour text NOT NULL,
  team_name text,
  season text,
  trophy_url text,
  last_synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX player_honours_player_idx ON public.player_honours(player_id);
GRANT SELECT ON public.player_honours TO anon, authenticated;
GRANT ALL ON public.player_honours TO service_role;
ALTER TABLE public.player_honours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read player honours" ON public.player_honours FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.player_career_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'thesportsdb',
  source_id text NOT NULL UNIQUE,
  team_name text NOT NULL,
  move_type text,
  joined text,
  departed text,
  appearances integer CHECK (appearances IS NULL OR appearances >= 0),
  goals integer CHECK (goals IS NULL OR goals >= 0),
  badge_url text,
  last_synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX player_career_clubs_player_idx ON public.player_career_clubs(player_id);
GRANT SELECT ON public.player_career_clubs TO anon, authenticated;
GRANT ALL ON public.player_career_clubs TO service_role;
ALTER TABLE public.player_career_clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read player career clubs" ON public.player_career_clubs FOR SELECT TO anon, authenticated USING (true);

-- Source: drizzle/migrations/0016_protect_official_career_progress.sql
ALTER TABLE public.careers ADD COLUMN verified_progress boolean NOT NULL DEFAULT false;
DROP POLICY IF EXISTS "Users manage their own career" ON public.careers;
CREATE POLICY "Users read their own career" ON public.careers FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.careers FROM authenticated;
GRANT SELECT ON public.careers TO authenticated;
GRANT ALL ON public.careers TO service_role;

-- Source: drizzle/migrations/0017_protect_multiplayer_final_scores.sql
REVOKE UPDATE ON public.match_rooms FROM authenticated;
GRANT UPDATE (guest_id, guest_club, status, updated_at) ON public.match_rooms TO authenticated;
CREATE OR REPLACE FUNCTION public.validate_match_room_client_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user <> 'service_role' AND (
    NEW.status <> 'open' OR NEW.guest_id IS NOT NULL OR NEW.guest_club IS NOT NULL
    OR NEW.minute <> 0 OR NEW.state <> '{}'::jsonb
  ) THEN
    RAISE EXCEPTION 'invalid_room_initial_state';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER match_room_client_insert BEFORE INSERT ON public.match_rooms
FOR EACH ROW EXECUTE FUNCTION public.validate_match_room_client_insert();

-- Source: drizzle/migrations/0018_unique_source_player_season_statistics.sql
CREATE UNIQUE INDEX IF NOT EXISTS player_season_stats_source_id_unique ON public.player_season_stats (source_id) WHERE source_id IS NOT NULL;

-- Source: drizzle/migrations/0019_player_stats_source_id_conflict_target.sql
CREATE UNIQUE INDEX IF NOT EXISTS player_season_stats_source_id_conflict_target ON public.player_season_stats (source_id);

-- Source: drizzle/migrations/0020_premium_football_media_and_match_records.sql
CREATE TABLE public.official_media (
  source text NOT NULL DEFAULT 'thesportsdb',
  entity_type text NOT NULL,
  source_id text NOT NULL,
  kind text NOT NULL,
  url text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, entity_type, source_id, kind)
);
GRANT SELECT ON public.official_media TO anon, authenticated;
GRANT ALL ON public.official_media TO service_role;
ALTER TABLE public.official_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Official media is public" ON public.official_media FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.official_events (
  source_id text PRIMARY KEY,
  league_source_id text NOT NULL,
  season text NOT NULL,
  home_team_source_id text,
  away_team_source_id text,
  home_team_name text,
  away_team_name text,
  starts_at timestamptz,
  home_score integer,
  away_score integer,
  status text,
  venue_source_id text,
  venue_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.official_events TO anon, authenticated;
GRANT ALL ON public.official_events TO service_role;
ALTER TABLE public.official_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Official events are public" ON public.official_events FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX official_events_league_season_idx ON public.official_events(league_source_id, season);

CREATE TABLE public.official_event_details (
  event_source_id text NOT NULL REFERENCES public.official_events(source_id) ON DELETE CASCADE,
  detail_type text NOT NULL,
  source_id text NOT NULL,
  team_source_id text,
  player_source_id text,
  minute integer,
  label text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_source_id, detail_type, source_id)
);
GRANT SELECT ON public.official_event_details TO anon, authenticated;
GRANT ALL ON public.official_event_details TO service_role;
ALTER TABLE public.official_event_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Official event details are public" ON public.official_event_details FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX official_event_details_event_idx ON public.official_event_details(event_source_id);

CREATE UNIQUE INDEX stadiums_thesportsdb_source_id_idx ON public.stadiums(source_id) WHERE source_id IS NOT NULL;


-- Source: drizzle/migrations/0021_premium_official_league_catalog.sql
CREATE TABLE public.official_leagues (
  source_id text PRIMARY KEY,
  name text NOT NULL,
  sport text NOT NULL,
  country text,
  current_season text,
  local_competition_id text REFERENCES public.competitions(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.official_leagues TO anon, authenticated;
GRANT ALL ON public.official_leagues TO service_role;
ALTER TABLE public.official_leagues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Official leagues are public" ON public.official_leagues FOR SELECT TO anon, authenticated USING (true);


-- Source: drizzle/migrations/0022_premium_official_team_catalog.sql
CREATE TABLE public.official_teams (
  source_id text PRIMARY KEY,
  league_source_id text,
  name text NOT NULL,
  venue_source_id text,
  local_club_id text REFERENCES public.clubs(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.official_teams TO anon, authenticated;
GRANT ALL ON public.official_teams TO service_role;
ALTER TABLE public.official_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Official teams are public" ON public.official_teams FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX official_teams_league_idx ON public.official_teams(league_source_id);


-- Profile lifecycle for direct Supabase Auth, including confirmed email and OAuth accounts.
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE OR REPLACE FUNCTION public.initialize_trainer_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, left(coalesce(nullif(btrim(NEW.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''), 'Treinador'), 60))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.initialize_trainer_profile() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER initialize_trainer_profile AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.initialize_trainer_profile();
REVOKE ALL ON FUNCTION public.validate_competition_season() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_match_room_client_insert() FROM PUBLIC, anon, authenticated;
-- Constraint helper is immutable and may be used by service writes only.
REVOKE ALL ON FUNCTION public.store_product_contents_valid(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_product_contents_valid(jsonb) TO service_role;

