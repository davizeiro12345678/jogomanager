import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const workflow = readFileSync(".github/workflows/bundle-impact.yml", "utf8");
const block = workflow.match(/python3 - <<'PY'\n([\s\S]*?)\n {10}PY/);
assert.ok(block, "baseline resolver script must be present");
const script = block[1].replace(/^ {10}/gm, "");
const alias = '        entities: path.resolve(import.meta.dirname, "node_modules/entities"),\n';

function normalize(source) {
  const directory = mkdtempSync(join(tmpdir(), "bundle-baseline-"));
  try {
    writeFileSync(join(directory, "vite.config.ts"), source);
    const result = spawnSync("python3", ["-c", script], { cwd: directory, encoding: "utf8" });
    return { ...result, source: readFileSync(join(directory, "vite.config.ts"), "utf8") };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("bundle comparison supports a baseline without the historical alias", () => {
  const source = "export default {};\n";
  const result = normalize(source);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.source, source);
});

test("bundle comparison removes only the recognized historical alias", () => {
  const source = `const aliases = {\n${alias}};\n`;
  const result = normalize(source);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.source, "const aliases = {\n};\n");
});

test("bundle comparison rejects duplicated or unrecognized entities aliases", () => {
  for (const source of [alias + alias, '  entities: "different-resolver",\n']) {
    const result = normalize(source);
    assert.notEqual(result.status, 0);
    assert.equal(result.source, source);
  }
});
