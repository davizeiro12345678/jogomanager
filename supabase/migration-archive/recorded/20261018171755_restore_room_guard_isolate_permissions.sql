CREATE OR REPLACE FUNCTION public.validate_match_room_client_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF current_user='postgres' THEN
    IF EXISTS (SELECT 1 FROM backup_restore.runs r
      WHERE r.id::text=current_setting('backup_restore.active_run',true)
      AND r.closed_at IS NULL AND r.expires_at>now()) THEN
      RETURN NEW;
    END IF;
  END IF;
  IF current_user <> 'service_role' AND
    (NEW.status <> 'open' OR NEW.guest_id IS NOT NULL OR NEW.guest_club IS NOT NULL
      OR NEW.minute <> 0 OR NEW.state <> '{}'::jsonb) THEN
    RAISE EXCEPTION 'invalid_room_initial_state';
  END IF;
  RETURN NEW;
END;
$$;