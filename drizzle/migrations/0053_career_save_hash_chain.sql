ALTER TABLE public.careers ADD COLUMN IF NOT EXISTS chain_hash text;
ALTER TABLE public.careers ADD COLUMN IF NOT EXISTS chain_length bigint NOT NULL DEFAULT 0;

CREATE TABLE public.career_save_chain (
  user_id uuid NOT NULL,
  link bigint NOT NULL,
  prev_hash text,
  chain_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, link)
);
GRANT SELECT ON public.career_save_chain TO authenticated;
GRANT ALL ON public.career_save_chain TO service_role;
ALTER TABLE public.career_save_chain ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their save chain" ON public.career_save_chain FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.link_career_save()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE prev text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.state IS NOT DISTINCT FROM OLD.state THEN RETURN NEW; END IF;
    prev := OLD.chain_hash;
    NEW.chain_length := OLD.chain_length + 1;
  ELSE
    prev := NULL;
    NEW.chain_length := 1;
  END IF;
  NEW.chain_hash := encode(extensions.digest(coalesce(prev, '') || NEW.state::text, 'sha256'), 'hex');
  INSERT INTO public.career_save_chain (user_id, link, prev_hash, chain_hash)
  VALUES (NEW.user_id, NEW.chain_length, prev, NEW.chain_hash)
  ON CONFLICT (user_id, link) DO UPDATE SET prev_hash = EXCLUDED.prev_hash, chain_hash = EXCLUDED.chain_hash, created_at = now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.link_career_save() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER careers_link_save BEFORE INSERT OR UPDATE ON public.careers
FOR EACH ROW EXECUTE FUNCTION public.link_career_save();

COMMENT ON TABLE public.career_save_chain IS 'Append-only server ledger: each accepted save hash includes the previous save hash.';