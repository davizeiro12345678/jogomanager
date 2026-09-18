-- Restrict all storage access to the file's own uploader; the export bucket
-- is internal, so no anonymous access is granted.
DROP POLICY IF EXISTS "Owners can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete their own files" ON storage.objects;

CREATE POLICY "Owners can read their own files"
ON storage.objects FOR SELECT TO authenticated
USING (owner = auth.uid());

CREATE POLICY "Owners can upload their own files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (owner = auth.uid());

CREATE POLICY "Owners can update their own files"
ON storage.objects FOR UPDATE TO authenticated
USING (owner = auth.uid())
WITH CHECK (owner = auth.uid());

CREATE POLICY "Owners can delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (owner = auth.uid());