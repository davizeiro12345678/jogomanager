-- Room identity, state transitions and final scores are server managed.
-- Historical rooms remain readable but cannot submit results with client seeds.
ALTER TABLE public.match_rooms
  ADD COLUMN IF NOT EXISTS server_seeded boolean NOT NULL DEFAULT false;

REVOKE INSERT, UPDATE, DELETE ON public.match_rooms FROM anon, authenticated;
GRANT SELECT ON public.match_rooms TO authenticated;
