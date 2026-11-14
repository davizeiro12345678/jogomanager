import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  "VITE_PAYMENTS_CLIENT_TOKEN=",
  "PAYMENTS_ENVIRONMENT=live",
  "SUPABASE_URL=https://example-project.supabase.co",
  "SUPABASE_PUBLISHABLE_KEY=",
  "",
].join("\n");

function validate(contents, bundleFiles = {}) {
  const cwd = mkdtempSync(path.join(tmpdir(), "public-env-contract-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd });
    writeFileSync(path.join(cwd, ".env.example"), contents);
    copyFileSync(validator, path.join(cwd, "validate-public-env.mjs"));
    const args = ["validate-public-env.mjs"];
    if (Object.keys(bundleFiles).length > 0) {
      const bundleDirectory = path.join(cwd, "public-bundle");
      for (const [relativeFile, source] of Object.entries(bundleFiles)) {
        const target = path.join(bundleDirectory, relativeFile);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, source);
      }
      args.push("--bundle-dir", bundleDirectory);
    }
    return spawnSync(process.execPath, args, {
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

test("public template rejects a missing browser Supabase publishable key", () => {
  const result = validate(template.replace("VITE_SUPABASE_PUBLISHABLE_KEY=\n", ""));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /VITE_SUPABASE_PUBLISHABLE_KEY/);
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

test("public template rejects service-role names without printing the credential value", () => {
  const secret = "sb_secret_template_fixture_do_not_print";
  const result = validate(`${template}VITE_SUPABASE_SERVICE_ROLE_KEY=${secret}\n`);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /server secret/i);
  assert.doesNotMatch(result.stderr, new RegExp(secret));
});

test("clean public bundle passes the server-secret scan", () => {
  const result = validate(template, {
    "assets/index.js": "const url = import.meta.env.VITE_SUPABASE_URL;",
  });
  assert.equal(result.status, 0, result.stderr);
});

test("public bundle allows client-side secret and private-request identifiers", () => {
  const result = validate(template, {
    "assets/checkout.js":
      "async function fetchClientSecret() { const clientSecret = await load(); return clientSecret; }",
    "assets/rotation.js": "function regenerateClientSecret() { return regenerate_secret; }",
    "sw.js": 'const isPrivateRequest = () => false; const tokenPrefix = "sb_secret_";',
  });
  assert.equal(result.status, 0, result.stderr);
});

test("public bundle rejects uppercase server-only variable names", () => {
  const result = validate(template, {
    "assets/index.js": 'const keyName = "STRIPE_SECRET_KEY";',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /server-only secret identifier/i);
});

test("public bundle rejects service-role credentials without printing values", () => {
  const secret = "sb_secret_bundle_fixture_do_not_print";
  const result = validate(template, {
    "assets/index.js": `const key = "${secret}"; const role = "service_role";`,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Public bundle contains/i);
  assert.doesNotMatch(result.stderr, new RegExp(secret));
});
