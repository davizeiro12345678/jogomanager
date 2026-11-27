-- Read the existing public projections in one database round trip.
CREATE OR REPLACE FUNCTION public.read_official_asset_catalog()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH crest_rows AS (
    SELECT id, crest_url FROM public.clubs
    WHERE crest_url IS NOT NULL ORDER BY id LIMIT 100001
  ), kit_rows AS (
    SELECT id, club_id, image_url FROM public.kits
    WHERE kind = 'home' AND image_url IS NOT NULL ORDER BY id LIMIT 100001
  )
  SELECT CASE
    WHEN (SELECT count(*) FROM crest_rows) > 100000
      OR (SELECT count(*) FROM kit_rows) > 100000 THEN NULL
    ELSE jsonb_build_object(
      'crests', COALESCE((SELECT jsonb_object_agg(id, crest_url ORDER BY id) FROM crest_rows), '{}'::jsonb),
      'kits', COALESCE((SELECT jsonb_object_agg(club_id, image_url ORDER BY id) FROM kit_rows), '{}'::jsonb)
    )
  END;
$$;
REVOKE ALL ON FUNCTION public.read_official_asset_catalog() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_official_asset_catalog() TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
