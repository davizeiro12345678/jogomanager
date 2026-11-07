import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validator = path.join(root, "scripts/validate-public-env.mjs");
const template = [
  "VITE_SUPABASE_PROJECT_ID=example-project",
  "VITE_SUPABASE_URL=https://example-project.supabase.co",
  "VITE_SUPABASE_PUBLISHABLE_KEY=",
  "VITE_AUTH_MODE=supabase",
  "VITE_PAYMENTS_CLIENT_TOKEN=",
  "PAYMENTS_ENVIRONMENT=live",
  "SUPABASE_URL=https://example-project.supabase.co",
  "SUPABASE_PUBLISHABLE_KEY=",
  "",
].join("\n");

function validate(contents) {
  const cwd = mkdtempSync(path.join(tmpdir(), "public-env-contract-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd });
    writeFileSync(path.join(cwd, ".env.example"), contents);
    copyFileSync(validator, path.join(cwd, "validate-public-env.mjs"));
    return spawnSync(process.execPath, ["validate-public-env.mjs"], {
      cwd,
      encoding: "utf8",
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("public template accepts distinct browser and server Supabase config names", () => {
  const result = validate(template);
  assert.equal(result.status, 0, result.stderr);
});

test("public template rejects a missing browser Supabase URL", () => {
  const result = validate(
    template.replace("VITE_SUPABASE_URL=https://example-project.supabase.co\n", ""),
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /VITE_SUPABASE_URL/);
});

test("public template rejects duplicate environment declarations", () => {
  const result = validate(template + "VITE_SUPABASE_PROJECT_ID=second-project\n");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /duplicate.*VITE_SUPABASE_PROJECT_ID/i);
});

test("public template requires server Supabase URL and publishable key declarations", () => {
  const missingServerConfig = template
    .replace("SUPABASE_URL=https://example-project.supabase.co\n", "")
    .replace("SUPABASE_PUBLISHABLE_KEY=\n", "");
  const result = validate(missingServerConfig);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY/);
});
