-- Disposable database only. All fixtures and changes are rolled back.
BEGIN;
INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) VALUES
 ('44444444-4444-4444-8444-444444444441', 'room-host@example.invalid', '{}', now()),
 ('44444444-4444-4444-8444-444444444442', 'room-guest@example.invalid', '{}', now()),
 ('44444444-4444-4444-8444-444444444443', 'room-outsider@example.invalid', '{}', now());
INSERT INTO public.match_rooms (id, code, host_id, guest_id, host_club, guest_club, seed, status, server_seeded)
VALUES ('55555555-5555-4555-8555-555555555551', 'CHATTEST',
 '44444444-4444-4444-8444-444444444441', '44444444-4444-4444-8444-444444444442',
 'fla', 'pal', '', 'ready', true);

DO $contract$
BEGIN
 ASSERT NOT has_table_privilege('authenticated', 'public.match_room_messages', 'INSERT'),
   'Clients must not insert room messages directly';
 ASSERT NOT has_function_privilege('authenticated', 'public.send_match_room_message_for(uuid,uuid,text)', 'EXECUTE'),
   'Clients must not call the identity-bearing RPC';
 ASSERT NOT has_table_privilege('authenticated', 'public.match_room_chat_limits', 'SELECT'),
   'Rate limit metadata must remain server-only';
 ASSERT NOT has_function_privilege('authenticated', 'public.reserve_chat_moderation_for(uuid,uuid)', 'EXECUTE'),
   'Clients must not call the moderation admission RPC';
 ASSERT has_function_privilege('service_role', 'public.send_match_room_message_for(uuid,uuid,text)', 'EXECUTE'),
   'The application server must be able to send';
END;
$contract$;

SET LOCAL ROLE service_role;
DO $service$
BEGIN
 PERFORM public.send_match_room_message_for('55555555-5555-4555-8555-555555555551',
   '44444444-4444-4444-8444-444444444441', 'Olá');
 ASSERT public.reserve_chat_moderation_for('44444444-4444-4444-8444-444444444442',
   '55555555-5555-4555-8555-555555555551') = ARRAY['Olá'],
   'Moderation context must contain recent messages from the participant room';
 BEGIN
  PERFORM public.reserve_chat_moderation_for('44444444-4444-4444-8444-444444444443',
    '55555555-5555-4555-8555-555555555551');
  RAISE EXCEPTION 'Outsider requested room context';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'not_participant' THEN RAISE; END IF;
 END;
 FOR i IN 1..19 LOOP
  PERFORM public.reserve_chat_moderation_for('44444444-4444-4444-8444-444444444442');
 END LOOP;
 BEGIN
  PERFORM public.reserve_chat_moderation_for('44444444-4444-4444-8444-444444444442');
  RAISE EXCEPTION 'Moderation quota was bypassed';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'rate_limited' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.send_match_room_message_for('55555555-5555-4555-8555-555555555551',
    '44444444-4444-4444-8444-444444444443', 'Não participo');
  RAISE EXCEPTION 'Outsider sent room message';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'not_participant' THEN RAISE; END IF;
 END;
 FOR i IN 1..9 LOOP
  PERFORM public.send_match_room_message_for('55555555-5555-4555-8555-555555555551',
    '44444444-4444-4444-8444-444444444441', 'Mensagem');
 END LOOP;
 BEGIN
  PERFORM public.send_match_room_message_for('55555555-5555-4555-8555-555555555551',
    '44444444-4444-4444-8444-444444444441', 'Décima primeira');
  RAISE EXCEPTION 'Message quota was bypassed';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'rate_limited' THEN RAISE; END IF;
 END;
END;
$service$;
RESET ROLE;

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444441', true);
SET LOCAL ROLE authenticated;
DO $host$
BEGIN
 ASSERT (SELECT count(*) FROM public.match_room_messages) = 10, 'Host cannot read own room';
 BEGIN
  INSERT INTO public.match_room_messages (room_id, sender_id, body) VALUES
   ('55555555-5555-4555-8555-555555555551','44444444-4444-4444-8444-444444444441','Forjada');
  RAISE EXCEPTION 'Client inserted message directly';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END;
$host$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444442', true);
SET LOCAL ROLE authenticated;
DO $guest$
BEGIN
 ASSERT (SELECT count(*) FROM public.match_room_messages) = 10, 'Guest cannot read room';
END;
$guest$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444443', true);
SET LOCAL ROLE authenticated;
DO $outsider$
BEGIN
 ASSERT (SELECT count(*) FROM public.match_room_messages) = 0, 'Outsider read private room messages';
END;
$outsider$;
RESET ROLE;

SET LOCAL ROLE service_role;
UPDATE public.match_rooms SET status = 'done' WHERE id = '55555555-5555-4555-8555-555555555551';
DO $cleanup$
BEGIN
 ASSERT (SELECT count(*) FROM public.match_room_messages) = 0, 'Closing a room must clear its messages';
 ASSERT (SELECT message_count FROM public.match_room_chat_limits WHERE sender_id =
   '44444444-4444-4444-8444-444444444441') = 10, 'Closing the room must not reset the quota';
END;
$cleanup$;
RESET ROLE;
ROLLBACK;
