-- Only one unreleased starter checkout can become accessible to an account.
ALTER TABLE public.checkout_session_owners
 ADD COLUMN IF NOT EXISTS starter_slot_released_at timestamptz;
ALTER TABLE public.checkout_session_owners
 ADD CONSTRAINT checkout_starter_slot_release_only CHECK (starter_slot_released_at IS NULL OR (product_key IS NOT NULL AND product_key='starter_bundle'));
CREATE UNIQUE INDEX checkout_starter_single_active_slot
 ON public.checkout_session_owners(user_id,environment)
 WHERE product_key='starter_bundle' AND starter_slot_released_at IS NULL;
CREATE OR REPLACE FUNCTION public.protect_starter_slot_release()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF OLD.starter_slot_released_at IS NOT NULL AND NEW.starter_slot_released_at IS DISTINCT FROM OLD.starter_slot_released_at THEN
  RAISE EXCEPTION 'Released checkout slot is immutable';
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.protect_starter_slot_release() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_starter_slot_release BEFORE UPDATE ON public.checkout_session_owners
 FOR EACH ROW EXECUTE FUNCTION public.protect_starter_slot_release();
NOTIFY pgrst, 'reload schema';
