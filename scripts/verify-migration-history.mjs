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
const wrappedVersions = [];
let newMigrations = 0;
let transactionEnvelopes = 0;

const normalizeSql = (sql) => `${sql.replace(/\r\n/g, "\n").trimEnd()}\n`;
const sha256 = (body) => createHash("sha256").update(body).digest("hex");

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
    const archivePath = `supabase/migration-archive/recorded/${file}`;
    if (expected.recordedArchive?.path !== archivePath) {
      throw new Error(`Missing original recorded SQL provenance: ${file}`);
    }
    const original = await readFile(path.join(root, archivePath));
    const recordedSql = normalizeSql(original.toString("utf8"));
    if (
      sha256(original) !== expected.recordedArchive.sha256 ||
      sha256(recordedSql) !== expected.normalizedSha256
    ) {
      throw new Error(`Original recorded SQL was modified: ${file}`);
    }
    let replaySql = recordedSql;
    if (expected.replayMode === "explicit-transaction") {
      replaySql =
        `-- Explicit transaction for Supabase CLI replay.\n-- Recorded SQL: ${archivePath}\nBEGIN;\n\n` +
        `${recordedSql}\nCOMMIT;\n`;
      transactionEnvelopes += 1;
      wrappedVersions.push(version);
    } else if (expected.replayMode !== "as-recorded") {
      throw new Error(`Unsupported historical replay transformation: ${file}`);
    }
    if (
      expected.file !== file ||
      normalizeSql(sql) !== replaySql ||
      sha256(replaySql) !== expected.replayNormalizedSha256
    ) {
      throw new Error(
        `Recorded migration body or approved replay envelope changed: ${file}. Add a new incremental migration instead.`,
      );
    }
  } else {
    if (version <= recordedMaximum) {
      throw new Error(`Unrecorded migration precedes the production baseline: ${file}`);
    }
    newMigrations += 1;
  }
}

if (
  JSON.stringify(wrappedVersions) !== JSON.stringify(manifest.replayCompatibility?.wrappedVersions)
) {
  throw new Error("Historical transaction envelopes do not match the provenance manifest.");
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
  `PASS migration history: ${recorded.size} recorded originals, ${transactionEnvelopes} explicit transaction envelopes, ${newMigrations} incremental, ${manifest.archivedRepositoryFiles.length} preserved repository files.`,
);
