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