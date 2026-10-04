-- Purchase history is written only by the trusted payment service and the
-- atomic fulfillment RPC. Authenticated clients may read their own rows, but
-- cannot fabricate completed purchases or alter payment records.
DROP POLICY IF EXISTS "Users create own purchases" ON public.user_purchases;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_purchases FROM anon, authenticated;
GRANT SELECT ON TABLE public.user_purchases TO authenticated;
GRANT ALL ON TABLE public.user_purchases TO service_role;
