import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Refuse to generate a bootstrap from mixed or edited migration histories.
await import("./verify-migration-history.mjs");

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, ".cloudflare/supabase-bootstrap.sql");
// The canonical history already contains the original Supabase + Drizzle
// baseline, profile lifecycle, and explicit grants. Appending Drizzle again
// would recreate tables and run prerequisites after their consumers.
let sql = "-- Canonical Supabase history. NEW, EMPTY projects only.\n";
sql +=
  "-- Required runner: psql -X --set=ON_ERROR_STOP=1 --dbname=<empty-project-connection> --file=<this-file>\n";
sql +=
  "-- Stop on the first error; default psql error handling can continue after the empty-project guard.\n";
for (const name of (await readdir(path.join(root, "supabase/migrations"))).sort()) {
  if (!/^\d{14}_.+\.sql$/.test(name)) continue;
  sql += `\n-- Source: supabase/migrations/${name}\n${await readFile(path.join(root, "supabase/migrations", name), "utf8")}\n`;
}
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, sql);
console.log(`Empty-project bootstrap prepared: ${output}`);
