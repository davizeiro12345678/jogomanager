REVOKE INSERT, UPDATE, DELETE ON public.user_purchases FROM authenticated;
DROP POLICY IF EXISTS "Users create own purchases" ON public.user_purchases;

-- Defense in depth: only the privileged payment fulfillment path may write purchases.
GRANT SELECT ON public.user_purchases TO authenticated;
GRANT ALL ON public.user_purchases TO service_role;