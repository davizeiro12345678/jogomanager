DROP INDEX IF EXISTS public.user_purchases_reference_key;
DROP INDEX IF EXISTS public.user_purchases_reference_unique;
CREATE UNIQUE INDEX IF NOT EXISTS user_purchases_reference_uniq ON public.user_purchases (reference);