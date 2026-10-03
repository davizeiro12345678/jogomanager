-- Seeds stay private while a room is open so guests cannot precompute results
-- before choosing a club. Service handlers reveal the seed only at kickoff.
CREATE TABLE IF NOT EXISTS public.match_room_secrets (
  room_id uuid PRIMARY KEY REFERENCES public.match_rooms(id) ON DELETE CASCADE,
  seed text NOT NULL
);

ALTER TABLE public.match_room_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_room_secrets FROM anon, authenticated;
GRANT ALL ON public.match_room_secrets TO service_role;

CREATE POLICY "Backend service only" ON public.match_room_secrets
  FOR ALL TO service_role USING (true) WITH CHECK (true);
