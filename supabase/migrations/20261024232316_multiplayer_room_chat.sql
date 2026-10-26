BEGIN;
SET LOCAL lock_timeout = '5s';
-- Deploy before the room-chat client. No legacy messages or rooms are changed.
CREATE TABLE public.match_room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.match_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX match_room_messages_room_created ON public.match_room_messages(room_id, created_at DESC, id);
CREATE INDEX match_room_messages_user_created ON public.match_room_messages(user_id, created_at DESC);
ALTER TABLE public.match_room_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_room_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.match_room_messages TO authenticated;
-- Sender, ID and timestamp are server defaults, never writable by a browser.
GRANT INSERT(room_id, body) ON public.match_room_messages TO authenticated;
GRANT ALL ON public.match_room_messages TO service_role;
CREATE POLICY "Participants read room chat" ON public.match_room_messages
FOR SELECT TO authenticated USING (
  app_private.mfa_session_allowed() AND EXISTS (
    SELECT 1 FROM public.match_rooms r
    WHERE r.id = room_id AND (r.host_id = (SELECT auth.uid()) OR r.guest_id = (SELECT auth.uid()))
  )
);
CREATE POLICY "Participants send room chat" ON public.match_room_messages
FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT auth.uid()) AND app_private.mfa_session_allowed() AND EXISTS (
    SELECT 1 FROM public.match_rooms r
    WHERE r.id = room_id AND r.status IN ('open', 'ready', 'live')
      AND (r.host_id = (SELECT auth.uid()) OR r.guest_id = (SELECT auth.uid()))
  )
);
CREATE FUNCTION app_private.limit_room_chat() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'room_chat_not_authenticated' USING ERRCODE = '42501';
  END IF;
  -- All writers acquire locks in this order; concurrent requests cannot bypass
  -- either the per-user rate limit or the bounded per-room history.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 731));
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.room_id::text, 732));
  IF (SELECT count(*) FROM public.match_room_messages
      WHERE user_id = NEW.user_id AND created_at > now() - interval '1 minute') >= 10 THEN
    RAISE EXCEPTION 'room_chat_rate_limited' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.match_room_messages WHERE room_id = NEW.room_id) >= 200 THEN
    RAISE EXCEPTION 'room_chat_history_full' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app_private.limit_room_chat() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enforce_room_chat_limit BEFORE INSERT ON public.match_room_messages
FOR EACH ROW EXECUTE FUNCTION app_private.limit_room_chat();
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_room_messages;
  END IF;
END $$;

COMMIT;
