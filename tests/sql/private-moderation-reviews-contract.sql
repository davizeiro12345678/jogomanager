-- Human moderation and appeal contracts. Disposable CI DB only.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
('90000000-0000-4000-8000-000000000001','case-reporter@example.test',now()),
('90000000-0000-4000-8000-000000000002','case-subject@example.test',now()),
('90000000-0000-4000-8000-000000000003','moderator-a@example.test',now()),
('90000000-0000-4000-8000-000000000004','moderator-b@example.test',now()),
('90000000-0000-4000-8000-000000000005','untrusted@example.test',now());

INSERT INTO public.match_rooms(id,code,host_id,host_club,seed,status,server_seeded)
VALUES ('90000000-0000-4000-8000-000000000006','MODR0001',
'90000000-0000-4000-8000-000000000001','ARS','','open',true);
UPDATE public.match_rooms
SET guest_id='90000000-0000-4000-8000-000000000002',
    guest_club='CHE',status='ready'
WHERE id='90000000-0000-4000-8000-000000000006';

INSERT INTO public.support_tickets(
  id,user_id,request_id,email,category,subject,message
) VALUES (
 '90000000-0000-4000-8000-000000000007',
 '90000000-0000-4000-8000-000000000001',
 '90000000-0000-4000-8000-000000000008',
 'case-reporter@example.test','report','Conduta na partida online',
 'Relato documentado de conduta em partida online para revisao humana'
);

DO $acl$
BEGIN
 IF has_schema_privilege('anon','moderation_private','USAGE')
 OR has_schema_privilege('authenticated','moderation_private','USAGE')
 OR has_table_privilege('anon','moderation_private.cases','SELECT')
 OR has_table_privilege('authenticated','moderation_private.appeals','SELECT')
 OR has_function_privilege('anon',
   'public.open_private_moderation_case(uuid,uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
   'public.resolve_private_moderation_case(uuid,uuid,integer,text,text)','EXECUTE')
 OR has_function_privilege('authenticated',
   'public.appeal_private_moderation_case(uuid,uuid,uuid,text)','EXECUTE')
 OR NOT has_function_privilege('service_role',
   'public.review_private_moderation_appeal(uuid,uuid,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'moderation case/appeal privilege violation'; END IF;
END;
$acl$;

SET LOCAL ROLE service_role;
DO $cases$
DECLARE
 v_case uuid;
 v_appeal uuid;
 v_result jsonb;
 v_rejected boolean;
BEGIN
 INSERT INTO moderation_private.moderators(user_id) VALUES
 ('90000000-0000-4000-8000-000000000003'),
 ('90000000-0000-4000-8000-000000000004');

 v_result:=public.open_private_moderation_case(
  '90000000-0000-4000-8000-000000000007',
  '90000000-0000-4000-8000-000000000006',
  '90000000-0000-4000-8000-000000000002',
  '90000000-0000-4000-8000-000000000001');
 IF v_result->>'status'<>'opened' THEN RAISE EXCEPTION 'failed to open report'; END IF;
 v_case:=(v_result->>'caseId')::uuid;
 v_result:=public.open_private_moderation_case(
  '90000000-0000-4000-8000-000000000007',
  '90000000-0000-4000-8000-000000000006',
  '90000000-0000-4000-8000-000000000002',
  '90000000-0000-4000-8000-000000000001');
 IF v_result->>'status'<>'already_open' OR (v_result->>'caseId')::uuid<>v_case
 THEN RAISE EXCEPTION 'moderation report was not idempotent'; END IF;

 v_rejected:=false;
 BEGIN
   PERFORM public.open_private_moderation_case(
   '90000000-0000-4000-8000-000000000007',
   '90000000-0000-4000-8000-000000000006',
   '90000000-0000-4000-8000-000000000005',
   '90000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true; END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'reported subject outside room accepted'; END IF;

 v_rejected:=false;
 BEGIN
   PERFORM public.open_private_moderation_case(
     '90000000-0000-4000-8000-000000000007',
     '90000000-0000-4000-8000-000000000006',
     '90000000-0000-4000-8000-000000000002',
     '90000000-0000-4000-8000-000000000005');
 EXCEPTION WHEN invalid_parameter_value THEN v_rejected:=true; END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'unrelated account took over a real report'; END IF;

 v_rejected:=false;
 BEGIN
   PERFORM public.resolve_private_moderation_case(
    v_case,'90000000-0000-4000-8000-000000000005',0,'warning',
    'Case reviewed with available evidence.');
 EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true; END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'unknown reviewer approved'; END IF;

 v_result:=public.resolve_private_moderation_case(
  v_case,'90000000-0000-4000-8000-000000000003',0,
  'warning','Case reviewed with available evidence.');
 IF v_result->>'status'<>'resolved' OR (v_result->>'revision')::int<>1
 THEN RAISE EXCEPTION 'moderation case did not resolve once'; END IF;
 v_result:=public.resolve_private_moderation_case(
  v_case,'90000000-0000-4000-8000-000000000003',0,
  'warning','Case reviewed with available evidence.');
 IF v_result->>'status'<>'already_resolved'
 THEN RAISE EXCEPTION 'moderation retry was not idempotent'; END IF;

 v_rejected:=false;
 BEGIN
   PERFORM public.appeal_private_moderation_case(
    v_case,'90000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000009',
    'The result should be reviewed with context.');
 EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true; END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'reporter impersonated accused appellant'; END IF;

 v_result:=public.appeal_private_moderation_case(
  v_case,'90000000-0000-4000-8000-000000000002',
  '90000000-0000-4000-8000-000000000010',
  'Please review this decision and the match context.');
 IF v_result->>'status'<>'opened' THEN RAISE EXCEPTION 'appeal was not opened'; END IF;
 v_appeal:=(v_result->>'appealId')::uuid;
 v_result:=public.appeal_private_moderation_case(
  v_case,'90000000-0000-4000-8000-000000000002',
  '90000000-0000-4000-8000-000000000010',
  'Please review this decision and the match context.');
 IF v_result->>'status'<>'already_open'
 THEN RAISE EXCEPTION 'appeal retry created duplicate'; END IF;

 v_rejected:=false;
 BEGIN
   PERFORM public.review_private_moderation_appeal(v_appeal,
    '90000000-0000-4000-8000-000000000003','overturned',
    'Independent analysis supports overturn.');
 EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true; END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'original reviewer judged appeal'; END IF;

 v_result:=public.review_private_moderation_appeal(v_appeal,
  '90000000-0000-4000-8000-000000000004','overturned',
  'Independent analysis supports overturn.');
 IF v_result->>'status'<>'overturned' THEN RAISE EXCEPTION 'appeal was not reviewed'; END IF;
 IF (SELECT count(*) FROM moderation_private.audit WHERE case_id=v_case)<>4
 THEN RAISE EXCEPTION 'missing or duplicated case audit events'; END IF;
 IF (SELECT count(*) FROM moderation_private.cases WHERE id=v_case)<>1
 OR (SELECT count(*) FROM moderation_private.appeals WHERE case_id=v_case)<>1
 THEN RAISE EXCEPTION 'case or appeal duplicates'; END IF;
END;
$cases$;
RESET ROLE;
ROLLBACK;
