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