CREATE TABLE public.api_football_data (
  kind text NOT NULL,
  ref text NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, ref)
);
GRANT SELECT ON public.api_football_data TO anon, authenticated;
GRANT ALL ON public.api_football_data TO service_role;
ALTER TABLE public.api_football_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read football data" ON public.api_football_data FOR SELECT TO anon, authenticated USING (true);