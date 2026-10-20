import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const migrationDirectory = path.join(root, "supabase/migrations");
const manifest = JSON.parse(
  await readFile(path.join(root, "supabase/migration-history.json"), "utf8"),
);
const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();
const recorded = new Map(manifest.recordedMigrations.map((entry) => [entry.version, entry]));
const recordedMaximum = [...recorded.keys()].sort().at(-1);
const seen = new Set();
let newMigrations = 0;

for (const file of files) {
  const match = /^(\d{14})_.+\.sql$/.exec(file);
  if (!match) throw new Error(`Invalid migration filename: ${file}`);
  const version = match[1];
  if (seen.has(version)) throw new Error(`Duplicate migration version: ${version}`);
  seen.add(version);
  const sql = await readFile(path.join(migrationDirectory, file), "utf8");
  if (!sql.trim()) throw new Error(`Empty migration: ${file}`);
  const expected = recorded.get(version);
  if (expected) {
    const sha = createHash("sha256")
      .update(`${sql.replace(/\r\n/g, "\n").trimEnd()}\n`)
      .digest("hex");
    if (expected.file !== file || expected.normalizedSha256 !== sha) {
      throw new Error(
        `Recorded migration changed: ${file}. Add a new incremental migration instead.`,
      );
    }
  } else {
    if (version <= recordedMaximum) {
      throw new Error(`Unrecorded migration precedes the production baseline: ${file}`);
    }
    newMigrations += 1;
  }
}

for (const { version, file } of recorded.values()) {
  if (!seen.has(version)) throw new Error(`Missing production migration: ${file}`);
}
for (const archived of manifest.archivedRepositoryFiles) {
  const body = await readFile(path.join(root, archived.path));
  if (createHash("sha256").update(body).digest("hex") !== archived.sha256) {
    throw new Error(`Archived migration was modified: ${archived.path}`);
  }
}
console.log(
  `PASS migration history: ${recorded.size} recorded, ${newMigrations} incremental, ${manifest.archivedRepositoryFiles.length} preserved archive files.`,
);
