-- Preserve old multiplayer replays and pin each new room to its contact model.
-- Existing rooms inherit v1. The default changes only for future room creation.
ALTER TABLE public.match_rooms
  ADD COLUMN IF NOT EXISTS contact_physics_revision smallint NOT NULL DEFAULT 1;
DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.match_rooms'::regclass
      AND conname = 'match_rooms_contact_physics_revision_check'
  ) THEN
    ALTER TABLE public.match_rooms ADD CONSTRAINT match_rooms_contact_physics_revision_check
      CHECK (contact_physics_revision IN (1, 2));
  END IF;
END;
$guard$;
ALTER TABLE public.match_rooms ALTER COLUMN contact_physics_revision SET DEFAULT 2;
COMMENT ON COLUMN public.match_rooms.contact_physics_revision IS
  'Per-room simulation contact model. Existing matches retain 1; new rooms use 2. Not browser-writable.';
-- The clients must still ignore this setting if their binary cannot execute the
-- recorded revision. RLS must not allow arbitrary user changes to this column.
NOTIFY pgrst, 'reload schema';
