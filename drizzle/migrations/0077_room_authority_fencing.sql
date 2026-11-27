-- Match a room to exactly one settlement protocol. Existing and manual rooms
-- stay legacy; automatically allocated two-seat live rooms use signed WS.
-- A service-role caller cannot accidentally overwrite a ranked result by
-- invoking the old finishMatchRoom or leaveMatchRoom RPC path.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

ALTER TABLE public.match_rooms
  ADD COLUMN IF NOT EXISTS settlement_authority text NOT NULL DEFAULT 'legacy';
DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='public.match_rooms'::regclass
      AND conname='match_rooms_settlement_authority_check') THEN
    ALTER TABLE public.match_rooms
      ADD CONSTRAINT match_rooms_settlement_authority_check
      CHECK (settlement_authority IN ('legacy','websocket'));
  END IF;
END;
$constraints$;

CREATE OR REPLACE FUNCTION public.guard_match_room_settlement_authority()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $function$
BEGIN
  IF TG_OP='INSERT' THEN
    -- The transactional ranked allocator creates both seats as live in one
    -- INSERT. Manual rooms are first created empty/open and remain legacy.
    IF NEW.server_seeded IS TRUE AND NEW.status='live' AND
      NEW.guest_id IS NOT NULL THEN
      NEW.settlement_authority := 'websocket';
    END IF;
  ELSIF TG_OP='UPDATE' THEN
    IF NEW.settlement_authority IS DISTINCT FROM OLD.settlement_authority
      AND current_user NOT IN ('service_role','postgres') THEN
      RAISE EXCEPTION 'match settlement authority is server-managed'
        USING ERRCODE='42501';
    END IF;
    IF OLD.settlement_authority='websocket' AND OLD.status<>'done' AND
      NEW.status='done' AND (
        current_user NOT IN ('service_role','postgres') OR
        current_setting('matchmaking_private.settling_room',true)
          IS DISTINCT FROM OLD.id::text
      ) THEN
      RAISE EXCEPTION 'websocket result requires the signed settlement RPC'
        USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.guard_match_room_settlement_authority()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS match_rooms_settlement_authority_guard ON public.match_rooms;
CREATE TRIGGER match_rooms_settlement_authority_guard
  BEFORE INSERT OR UPDATE ON public.match_rooms
  FOR EACH ROW EXECUTE FUNCTION public.guard_match_room_settlement_authority();

-- Preserve any queue rooms allocated between 0075 and this migration.
UPDATE public.match_rooms room SET settlement_authority='websocket'
FROM matchmaking_private.pairs pair
WHERE pair.room_id=room.id
  AND pair.status='committed'
  AND room.status IN ('ready','live','settling')
  AND room.settlement_authority<>'websocket';

-- The receipt validation, atomic score+Elo+seed cleanup from 0076 remains
-- immutable. Move its implementation outside PostgREST public schema, then
-- install the public service-only authority gate.
ALTER FUNCTION public.settle_authoritative_match(
  uuid,uuid,text,text,text,text,integer,integer,integer
) SET SCHEMA matchmaking_private;

CREATE OR REPLACE FUNCTION public.settle_authoritative_match(
  p_room uuid,p_receipt_id uuid,p_hash text,p_signature text,
  p_simulation_version text,p_closure_reason text,
  p_home_goals integer,p_away_goals integer,p_minute integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_room public.match_rooms%ROWTYPE;
BEGIN
  IF p_room IS NULL THEN
    RAISE EXCEPTION 'match_room_id_required' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_room FROM public.match_rooms WHERE id=p_room FOR UPDATE;
  IF NOT FOUND OR v_room.settlement_authority<>'websocket' THEN
    RAISE EXCEPTION 'only websocket-owned rooms may use signed settlement'
      USING ERRCODE='42501';
  END IF;
  PERFORM pg_catalog.set_config('matchmaking_private.settling_room',p_room::text,true);
  RETURN matchmaking_private.settle_authoritative_match(
    p_room,p_receipt_id,p_hash,p_signature,p_simulation_version,p_closure_reason,
    p_home_goals,p_away_goals,p_minute
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.settle_authoritative_match(
  uuid,uuid,text,text,text,text,integer,integer,integer
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_authoritative_match(
  uuid,uuid,text,text,text,text,integer,integer,integer
) TO service_role;
REVOKE ALL ON FUNCTION matchmaking_private.settle_authoritative_match(
  uuid,uuid,text,text,text,text,integer,integer,integer
) FROM PUBLIC,anon,authenticated,service_role;

COMMENT ON COLUMN public.match_rooms.settlement_authority IS
  'Legacy host-replayed or signed-websocket settlement. Never browser writable.';
NOTIFY pgrst,'reload schema';
COMMIT;
