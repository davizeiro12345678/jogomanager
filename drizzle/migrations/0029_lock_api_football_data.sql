DROP POLICY IF EXISTS "public read football data" ON public.api_football_data;
REVOKE ALL ON public.api_football_data FROM anon, authenticated;
GRANT ALL ON public.api_football_data TO service_role;