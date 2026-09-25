REVOKE UPDATE ON public.match_rooms FROM authenticated;
GRANT UPDATE (guest_id, guest_club, status, updated_at) ON public.match_rooms TO authenticated;
CREATE OR REPLACE FUNCTION public.validate_match_room_client_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user <> 'service_role' AND (
    NEW.status <> 'open' OR NEW.guest_id IS NOT NULL OR NEW.guest_club IS NOT NULL
    OR NEW.minute <> 0 OR NEW.state <> '{}'::jsonb
  ) THEN
    RAISE EXCEPTION 'invalid_room_initial_state';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER match_room_client_insert BEFORE INSERT ON public.match_rooms
FOR EACH ROW EXECUTE FUNCTION public.validate_match_room_client_insert();