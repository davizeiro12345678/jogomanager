CREATE TABLE public.player_careers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 3),
  state jsonb NOT NULL,
  verified_progress boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slot)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_careers TO authenticated;
GRANT ALL ON public.player_careers TO service_role;
ALTER TABLE public.player_careers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own player careers select" ON public.player_careers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own player careers insert" ON public.player_careers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND verified_progress = false);
CREATE POLICY "own player careers update" ON public.player_careers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND verified_progress = false);
CREATE POLICY "own player careers delete" ON public.player_careers FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_player_careers_updated_at BEFORE UPDATE ON public.player_careers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();