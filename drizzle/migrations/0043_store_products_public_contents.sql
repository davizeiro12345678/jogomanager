-- Pack contents are shown to buyers before checkout; they hold no private data.
GRANT SELECT (contents) ON public.store_products TO anon, authenticated;