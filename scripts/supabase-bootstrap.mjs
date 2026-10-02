import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, ".cloudflare/supabase-bootstrap.sql");
const duplicateMigrations = /^001[123]_/;
let sql = `-- Bootstrap for a NEW, EMPTY Supabase project only.
-- Original migrations are kept intact; payment migrations shared by both histories run once.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE')
    OR EXISTS (SELECT 1 FROM auth.users) OR EXISTS (SELECT 1 FROM storage.objects) THEN
    RAISE EXCEPTION 'Bootstrap requires an empty project. Use incremental migrations on existing projects.';
  END IF;
END $$;
`;
for (const directory of ["supabase/migrations", "drizzle/migrations"]) {
  for (const name of (await readdir(path.join(root, directory))).sort()) {
    if (
      !name.endsWith(".sql") ||
      (directory === "drizzle/migrations" && duplicateMigrations.test(name))
    )
      continue;
    sql += `\n-- Source: ${directory}/${name}\n${await readFile(path.join(root, directory, name), "utf8")}\n`;
  }
}
sql += `
-- Profile lifecycle for direct Supabase Auth, including confirmed email and OAuth accounts.
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE OR REPLACE FUNCTION public.initialize_trainer_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, left(coalesce(nullif(btrim(NEW.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''), 'Treinador'), 60))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.initialize_trainer_profile() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER initialize_trainer_profile AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.initialize_trainer_profile();
REVOKE ALL ON FUNCTION public.validate_competition_season() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_match_room_client_insert() FROM PUBLIC, anon, authenticated;
-- Constraint helper is immutable and may be used by service writes only.
REVOKE ALL ON FUNCTION public.store_product_contents_valid(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_product_contents_valid(jsonb) TO service_role;
`;
sql += await readFile(path.join(root, "supabase/backend-access.sql"), "utf8");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, sql);
console.log(`Empty-project bootstrap prepared: ${output}`);
