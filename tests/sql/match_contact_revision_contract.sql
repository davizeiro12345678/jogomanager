-- Execute only after migration 0072 on an isolated test database.
-- No production data mutations: metadata and invariant inspection only.
DO $contract$
DECLARE
  v_default text;
  v_trigger boolean;
  v_check boolean;
  v_invalid bigint;
BEGIN
  SELECT pg_catalog.pg_get_expr(d.adbin, d.adrelid)
    INTO v_default
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_attrdef AS d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = 'public.match_rooms'::regclass
      AND a.attname = 'contact_physics_revision';
  IF v_default IS NULL OR v_default NOT LIKE '%2%' THEN
    RAISE EXCEPTION 'new match rooms must default to contact physics revision 2';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.match_rooms'::regclass
      AND tgname = 'match_rooms_contact_revision_guard'
      AND NOT tgisinternal AND tgenabled <> 'D'
  ) INTO v_trigger;
  IF NOT v_trigger THEN
    RAISE EXCEPTION 'server-managed room revision must have a guard trigger';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.match_rooms'::regclass
      AND conname = 'match_rooms_contact_physics_revision_check'
      AND contype = 'c' AND convalidated
  ) INTO v_check;
  IF NOT v_check THEN
    RAISE EXCEPTION 'room revision must have a validated CHECK constraint';
  END IF;

  SELECT count(*) INTO v_invalid
    FROM public.match_rooms WHERE contact_physics_revision NOT IN (1,2);
  IF v_invalid <> 0 THEN
    RAISE EXCEPTION 'invalid room contact revisions: %', v_invalid;
  END IF;
END;
$contract$;

-- Privilege and trigger regression in an automatically rolled back fixture.
-- This deliberately widens permissions only *inside the transaction* so the
-- server-only trigger itself is exercised, not merely the surrounding RLS.
BEGIN;
  ALTER TABLE public.match_rooms DISABLE ROW LEVEL SECURITY;
  GRANT SELECT, UPDATE ON public.match_rooms TO authenticated;
  INSERT INTO public.match_rooms(id, code, host_id, host_club, seed, server_seeded, status)
    VALUES (
      'ec3c829e-81d4-4edc-a3dd-7a1baf4a5685',
      'QWERTY78',
      'dc690d8c-7726-4d45-b193-9bf10a23f4a1',
      'fla',
      '',
      true,
      'open'
    );
  SET LOCAL ROLE authenticated;
  DO $tamper$
  DECLARE denied boolean := false;
  BEGIN
    BEGIN
      UPDATE public.match_rooms SET contact_physics_revision = 1
        WHERE id = 'ec3c829e-81d4-4edc-a3dd-7a1baf4a5685';
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;
    IF NOT denied THEN
      RAISE EXCEPTION 'authenticated user modified server-owned match revision';
    END IF;
  END;
  $tamper$;
ROLLBACK;
