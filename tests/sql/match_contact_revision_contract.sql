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
