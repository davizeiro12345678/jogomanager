import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
const source = path.resolve(import.meta.dirname, "..");

test("fresh replay accepts the recorded extension prerequisite but rejects historical tampering", () => {
  const temporaryRoot = path.resolve(tmpdir());
  const fixture = mkdtempSync(path.join(temporaryRoot, "migration-provenance-"));
  assert.ok(fixture.startsWith(temporaryRoot + path.sep));
  try {
    mkdirSync(path.join(fixture, "scripts"));
    mkdirSync(path.join(fixture, "supabase"));
    cpSync(
      path.join(source, "scripts/verify-migration-history.mjs"),
      path.join(fixture, "scripts/verify-migration-history.mjs"),
    );
    for (const directory of ["migrations", "migration-archive"])
      cpSync(path.join(source, "supabase", directory), path.join(fixture, "supabase", directory), {
        recursive: true,
      });
    cpSync(
      path.join(source, "supabase/migration-history.json"),
      path.join(fixture, "supabase/migration-history.json"),
    );
    const run = () =>
      spawnSync(process.execPath, ["scripts/verify-migration-history.mjs"], {
        cwd: fixture,
        encoding: "utf8",
      });
    assert.equal(run().status, 0, "The complete preserved history must remain replayable");
    const file = "20261023001209_link_public_club_catalog_identities.sql";
    const replayPath = path.join(fixture, "supabase/migrations", file);
    const replay = readFileSync(replayPath, "utf8");
    writeFileSync(
      replayPath,
      replay.replace(
        "CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;",
        "SELECT 1;",
      ),
    );
    const missing = run();
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /Recorded prerequisite migration or replay prelude changed/);
    writeFileSync(replayPath, replay);
    const archive = path.join(fixture, "supabase/migration-archive/recorded", file);
    writeFileSync(archive, readFileSync(archive, "utf8") + "\n");
    const tampered = run();
    assert.notEqual(tampered.status, 0);
    assert.match(tampered.stderr, /Recorded prerequisite migration or replay prelude changed/);
  } finally {
    assert.ok(path.resolve(fixture).startsWith(temporaryRoot + path.sep));
    rmSync(fixture, { recursive: true, force: true });
  }
});
