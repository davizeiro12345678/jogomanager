ALTER TABLE public.user_purchases
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DELETE FROM public.user_purchases a
USING public.user_purchases b
WHERE a.reference IS NOT NULL
  AND a.reference = b.reference
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS user_purchases_reference_key
  ON public.user_purchases (reference)
  WHERE reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_purchases_user_created_idx
  ON public.user_purchases (user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_user_purchases_updated_at ON public.user_purchases;
CREATE TRIGGER update_user_purchases_updated_at
  BEFORE UPDATE ON public.user_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT ON public.user_purchases TO authenticated;
GRANT ALL ON public.user_purchases TO service_role;