BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Realtime owns this schema. Only RLS policies are managed here; do not alter
-- its tables, functions, triggers, or schema objects.
--
-- Receivers may read only validated server-shaped room chat events. The
-- authenticated client has no INSERT policy for this event; server publishes
-- through the Realtime REST Broadcast API with its private key.
DROP POLICY IF EXISTS "Match room participants can receive private chat broadcasts"
  ON realtime.messages;
CREATE POLICY "Match room participants can receive private chat broadcasts"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    extension = 'broadcast' AND event = 'msg' AND private IS TRUE
    AND topic = (SELECT realtime.topic()) AND payload IS NOT NULL
    AND jsonb_typeof(payload) = 'object'
    AND (SELECT count(*) FROM jsonb_object_keys(payload)) = 4
    AND payload ?& ARRAY['id', 'text', 'senderId', 'createdAt']
    AND jsonb_typeof(payload -> 'id') = 'string'
    AND payload ->> 'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND jsonb_typeof(payload -> 'text') = 'string'
    AND btrim(payload ->> 'text') = payload ->> 'text'
    AND char_length(payload ->> 'text') BETWEEN 1 AND 200
    AND jsonb_typeof(payload -> 'senderId') = 'string'
    AND jsonb_typeof(payload -> 'createdAt') = 'string'
    AND EXISTS (
      SELECT 1 FROM public.match_rooms AS room
      WHERE (SELECT realtime.topic()) = 'room-chat-' || room.id::text
        AND (room.host_id = (SELECT auth.uid()) OR room.guest_id = (SELECT auth.uid()))
        AND room.status IN ('open', 'ready', 'live', 'settling')
        AND (room.host_id::text = payload ->> 'senderId' OR room.guest_id::text = payload ->> 'senderId')
    )
  );

DROP POLICY IF EXISTS "Match room participants can send private chat broadcasts"
  ON realtime.messages;

COMMIT;
