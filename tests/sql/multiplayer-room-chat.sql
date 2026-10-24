-- Disposable replay database only. No fixture survives this transaction.
BEGIN;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
('33333333-3333-4333-8333-333333333331','chat-host@example.invalid',now()),
('33333333-3333-4333-8333-333333333332','chat-guest@example.invalid',now()),
('33333333-3333-4333-8333-333333333333','chat-outsider@example.invalid',now());
SET LOCAL ROLE service_role;
INSERT INTO public.match_rooms(id,code,host_id,guest_id,host_club,guest_club,seed,server_seeded,status)
VALUES ('33333333-3333-4333-8333-333333333334','CHATTEST','33333333-3333-4333-8333-333333333331','33333333-3333-4333-8333-333333333332','fla','pal','',true,'ready');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333331',true);
SELECT set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333331","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.match_room_messages(room_id,body) VALUES ('33333333-3333-4333-8333-333333333334','Olá');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.match_room_messages WHERE room_id='33333333-3333-4333-8333-333333333334' AND user_id=auth.uid())=1,'Wrong sender';
  ASSERT NOT has_column_privilege('authenticated','public.match_room_messages','user_id','INSERT'),'Sender is writable';
  ASSERT NOT has_column_privilege('authenticated','public.match_room_messages','created_at','INSERT'),'Timestamp is writable';
  ASSERT NOT has_table_privilege('authenticated','public.match_room_messages','UPDATE'),'Messages can be rewritten';
  ASSERT NOT has_table_privilege('authenticated','public.match_room_messages','DELETE'),'Messages can be deleted';
  BEGIN
    INSERT INTO public.match_room_messages(room_id,user_id,body) VALUES ('33333333-3333-4333-8333-333333333334','33333333-3333-4333-8333-333333333332','spoof');
    RAISE EXCEPTION 'Spoofed sender accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  FOR i IN 1..9 LOOP
    INSERT INTO public.match_room_messages(room_id,body) VALUES ('33333333-3333-4333-8333-333333333334','message '||i);
  END LOOP;
  BEGIN
    INSERT INTO public.match_room_messages(room_id,body) VALUES ('33333333-3333-4333-8333-333333333334','spam');
    RAISE EXCEPTION 'Rate limit bypassed';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'room_chat_rate_limited' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333332',true);
SELECT set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333332","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.match_room_messages WHERE room_id='33333333-3333-4333-8333-333333333334')=10,'Guest cannot read';
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM public.match_room_messages;
    RAISE EXCEPTION 'Anonymous read allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
SELECT set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.match_room_messages WHERE room_id='33333333-3333-4333-8333-333333333334')=0,'Outsider can read';
  BEGIN
    INSERT INTO public.match_room_messages(room_id,body) VALUES ('33333333-3333-4333-8333-333333333334','intruder');
    RAISE EXCEPTION 'Outsider can write';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- Service-role fixture maintenance moves timestamps into the past to fill a
-- room without bypassing its INSERT trigger. Only this test transaction sees it.
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333331',true);
SET LOCAL ROLE service_role;
UPDATE public.match_room_messages SET created_at=now()-interval '2 minutes'
WHERE room_id='33333333-3333-4333-8333-333333333334';
DO $$ BEGIN
  FOR i IN 1..190 LOOP
    INSERT INTO public.match_room_messages(room_id,body) VALUES ('33333333-3333-4333-8333-333333333334','history '||i);
    UPDATE public.match_room_messages SET created_at=now()-interval '2 minutes'
    WHERE room_id='33333333-3333-4333-8333-333333333334' AND created_at>now()-interval '1 minute';
  END LOOP;
  BEGIN
    INSERT INTO public.match_room_messages(room_id,body) VALUES ('33333333-3333-4333-8333-333333333334','overflow');
    RAISE EXCEPTION 'Room history cap bypassed';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'room_chat_history_full' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
ROLLBACK;
