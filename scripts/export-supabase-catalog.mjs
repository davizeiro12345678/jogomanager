import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const bundled = await build({
  entryPoints: [path.join(root, "src/game/data/leagues.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { LEAGUES } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);
const competitions = LEAGUES.map((league) => ({
  id: league.id,
  name: league.name,
  country: league.country,
  flag: league.flag,
  club_count: league.clubs.length,
  source_id: league.id,
  sync_status: "synced",
}));
// Match CLUBS' identity resolution when an id appears in more than one collection.
const clubs = [
  ...new Map(
    LEAGUES.flatMap((league) =>
      league.clubs.map((club) => [
        club.id,
        {
          id: club.id,
          competition_id: league.id,
          name: club.name,
          short_name: club.short,
          country: league.country,
          primary_color: club.primary,
          secondary_color: club.secondary,
          strength: club.strength,
          data_source: "bundled",
          source_id: club.id,
          sync_status: "synced",
        },
      ]),
    ),
  ).values(),
];
await mkdir(path.join(root, ".cloudflare/catalog-batches"), { recursive: true });
function insertSql(table, rows) {
  const columns = Object.keys(rows[0]);
  const shape = columns
    .map((name) => `${name} ${name === "strength" || name === "club_count" ? "smallint" : "text"}`)
    .join(", ");
  const literal = JSON.stringify(rows).replaceAll("'", "''");
  return `INSERT INTO public.${table} (${columns.join(", ")}) SELECT ${columns.join(", ")} FROM jsonb_to_recordset('${literal}'::jsonb) AS records(${shape}) ON CONFLICT (id) DO NOTHING;`;
}
await writeFile(
  path.join(root, ".cloudflare/catalog-batches/competitions.sql"),
  insertSql("competitions", competitions),
);
for (let offset = 0; offset < clubs.length; offset += 250) {
  await writeFile(
    path.join(root, `.cloudflare/catalog-batches/clubs-${String(offset).padStart(5, "0")}.sql`),
    insertSql("clubs", clubs.slice(offset, offset + 250)),
  );
}
console.log(
  JSON.stringify({ competitions: competitions.length, clubs: clubs.length, batchSize: 250 }),
);
