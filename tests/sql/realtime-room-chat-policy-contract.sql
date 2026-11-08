\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Synthetic fixtures only; the entire contract test rolls back.
SET LOCAL ROLE service_role;
INSERT INTO public.match_rooms (id, code, host_id, guest_id, host_club, guest_club, seed, status, server_seeded) VALUES
 ('10000000-0000-4000-8000-000000000001','TESTCHAT01','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','ARS','CHE','','ready',true),
 ('10000000-0000-4000-8000-000000000002','TESTCHAT02','00000000-0000-4000-8000-000000000004',NULL,'LIV',NULL,'','open',true),
 ('10000000-0000-4000-8000-000000000003','TESTCHAT03','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','ARS','CHE','','done',true);
RESET ROLE;

-- Privileged fixtures represent server-originated REST broadcasts.
INSERT INTO realtime.messages (topic, extension, payload, event, private) VALUES
 ('room-chat-10000000-0000-4000-8000-000000000001','broadcast','{"id":"00000000-0000-4000-8000-000000000011","text":"from-host","senderId":"00000000-0000-4000-8000-000000000001","createdAt":"2026-11-08T00:00:00Z"}'::jsonb,'msg',true),
 ('room-chat-10000000-0000-4000-8000-000000000001','broadcast','{"id":"00000000-0000-4000-8000-000000000012","text":"spoofed sender","senderId":"00000000-0000-4000-8000-000000000099","createdAt":"2026-11-08T00:00:00Z"}'::jsonb,'msg',true),
 ('room-chat-10000000-0000-4000-8000-000000000002','broadcast','{"id":"00000000-0000-4000-8000-000000000013","text":"open but not member","senderId":"00000000-0000-4000-8000-000000000004","createdAt":"2026-11-08T00:00:00Z"}'::jsonb,'msg',true),
 ('room-chat-10000000-0000-4000-8000-000000000003','broadcast','{"id":"00000000-0000-4000-8000-000000000014","text":"closed room","senderId":"00000000-0000-4000-8000-000000000001","createdAt":"2026-11-08T00:00:00Z"}'::jsonb,'msg',true);

SET LOCAL ROLE authenticated;
SELECT set_config('realtime.topic','room-chat-10000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM realtime.messages WHERE payload ->> 'text'='from-host') THEN RAISE EXCEPTION 'member cannot receive valid server event'; END IF;
 IF EXISTS (SELECT 1 FROM realtime.messages WHERE payload ->> 'text'='spoofed sender') THEN RAISE EXCEPTION 'receiver accepted a spoofed sender'; END IF;
 BEGIN
  INSERT INTO realtime.messages(topic,extension,payload,event,private) VALUES ('room-chat-10000000-0000-4000-8000-000000000001','broadcast','{"id":"00000000-0000-4000-8000-000000000015","text":"client spoof","senderId":"00000000-0000-4000-8000-000000000001","createdAt":"2026-11-08T00:00:00Z"}'::jsonb,'msg',true);
  RAISE EXCEPTION 'authenticated client inserted direct broadcast';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- A second real participant can receive, but an unrelated identity cannot.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM realtime.messages WHERE payload ->> 'text'='from-host') THEN RAISE EXCEPTION 'guest cannot receive member event'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM realtime.messages WHERE payload ->> 'text'='from-host') THEN RAISE EXCEPTION 'non-member received room event'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
