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