BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Realtime v2.148.3 inserts an empty broadcast row, checks its ID under the
-- subscriber's role, then rolls back. The probe takes the DB default private=false.
CREATE POLICY "Active match room members can read the Realtime join probe"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    extension = 'broadcast'
    AND private IS FALSE
    AND event IS NULL
    AND payload IS NULL
    -- Older Realtime schemas have no binary_payload column.
    AND (to_jsonb(messages) ->> 'binary_payload') IS NULL
    AND topic = (SELECT realtime.topic())
    AND EXISTS (
      SELECT 1 FROM public.match_rooms AS room
      WHERE topic = 'room-chat-' || room.id::text
        AND (room.host_id = (SELECT auth.uid()) OR room.guest_id = (SELECT auth.uid()))
        AND room.status IN ('open', 'ready', 'live', 'settling')
    )
  );

COMMIT;
