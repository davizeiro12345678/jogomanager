import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const checker = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));

function repository(t, files) {
  const root = mkdtempSync(path.join(tmpdir(), "jogomanager-secret-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "--quiet", root]);
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(path.join(root, name), contents);
    execFileSync("git", ["-C", root, "add", "-f", "--", name]);
  }
  return root;
}

function check(root) {
  return spawnSync(process.execPath, [checker, root], { encoding: "utf8" });
}

test("tracked environment files fail even when they contain no detected secret", (t) => {
  const root = repository(t, { ".env.local": "A=public\n" });
  const result = check(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\.env\.local/);
});

test("checked-in secret patterns fail without printing the secret", (t) => {
  const secret = ["sk", "-proj-", "a".repeat(48)].join("");
  const root = repository(t, { "example.txt": `credential=${secret}\n` });
  const result = check(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /example\.txt/);
  assert.equal((result.stdout + result.stderr).includes(secret), false);
});

test("placeholder env examples can be versioned", (t) => {
  const root = repository(t, { ".env.example": "OPENAI_API_KEY=\n" });
  const result = check(root);
  assert.equal(result.status, 0);
});
