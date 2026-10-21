-- Keep multiplayer room writes and outcome seeds behind authenticated server functions.
ALTER TABLE public.match_rooms
  ADD COLUMN IF NOT EXISTS server_seeded boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.match_room_secrets (
  room_id uuid PRIMARY KEY REFERENCES public.match_rooms(id) ON DELETE CASCADE,
  seed text NOT NULL CHECK (length(seed) BETWEEN 1 AND 256)
);

ALTER TABLE public.match_room_secrets ENABLE ROW LEVEL SECURITY;

-- Retain active server seeds from installations that already stored them publicly.
INSERT INTO public.match_room_secrets (room_id, seed)
SELECT id, btrim(seed)
FROM public.match_rooms
WHERE server_seeded IS TRUE AND btrim(seed) <> '' AND status <> 'done'
ON CONFLICT (room_id) DO NOTHING;

UPDATE public.match_rooms
SET seed = ''
WHERE server_seeded IS TRUE AND seed <> '';

DELETE FROM public.match_room_secrets AS secrets
USING public.match_rooms AS rooms
WHERE secrets.room_id = rooms.id AND rooms.status = 'done';

-- Retire rooms created by the former client-managed flow and erase their public seeds.
UPDATE public.match_rooms
SET status = 'done', state = '{}'::jsonb, updated_at = now()
WHERE server_seeded IS FALSE AND status <> 'done';

UPDATE public.match_rooms
SET seed = ''
WHERE server_seeded IS FALSE AND seed <> '';

DELETE FROM public.match_room_secrets AS secrets
USING public.match_rooms AS rooms
WHERE secrets.room_id = rooms.id AND rooms.server_seeded IS FALSE;

-- The client may read rooms for discovery and realtime, but all state changes go through server functions.
DROP POLICY IF EXISTS "Host creates the room" ON public.match_rooms;
DROP POLICY IF EXISTS "Participants update the room" ON public.match_rooms;
DROP POLICY IF EXISTS "Host deletes the room" ON public.match_rooms;
REVOKE ALL ON TABLE public.match_rooms FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.match_rooms FROM authenticated;
GRANT SELECT ON TABLE public.match_rooms TO authenticated;
GRANT ALL ON TABLE public.match_rooms TO service_role;

-- No authenticated or anonymous policy can read or write private match seeds.
DO $$
DECLARE
  policy_name text;
BEGIN
  FOR policy_name IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'match_room_secrets'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.match_room_secrets', policy_name);
  END LOOP;
END
$$;

REVOKE ALL ON TABLE public.match_room_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.match_room_secrets TO service_role;
