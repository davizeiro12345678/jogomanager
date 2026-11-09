import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { normalizeBaselineEntitiesAlias } from "./normalize-baseline-entities-alias.mjs";

// Resolver shape at baseline c20036f: bare entities already resolves per importer.
const aliases = `
  "entities/lib/decode.js": path.resolve(
    import.meta.dirname,
    "node_modules/entities/lib/decode.js",
  ),
  "entities/lib/encode.js": path.resolve(
    import.meta.dirname,
    "node_modules/entities/lib/encode.js",
  ),`;
const config = (entries = aliases) => `export default defineConfig({
  vite: { resolve: { alias: { ${entries}\n  } } },
});\n`;

test("already-compatible baseline stays byte-for-byte unchanged", () => {
  const source = config();
  assert.deepEqual(normalizeBaselineEntitiesAlias(source), {
    source,
    changed: false,
    status: "already-compatible",
  });
});

test("current repository resolver is accepted without a bare alias", () => {
  const source = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
  assert.equal(normalizeBaselineEntitiesAlias(source).source, source);
});

test("only the exact known legacy bare alias is removed across formatting styles", () => {
  for (const legacy of [
    'entities: path.resolve(import.meta.dirname, "node_modules/entities"),',
    "'entities' : path.resolve(\n import.meta.dirname,\n 'node_modules/entities',\n),",
  ]) {
    const result = normalizeBaselineEntitiesAlias(config(`${legacy}${aliases}`));
    assert.equal(result.changed, true);
    assert.equal(result.status, "legacy-bare-alias-removed");
    assert.ok(result.source.includes(aliases));
    assert.equal(normalizeBaselineEntitiesAlias(result.source).changed, false);
  }
});

test("a changed legacy bare target cannot be normalized", () => {
  assert.throws(
    () =>
      normalizeBaselineEntitiesAlias(
        config(
          `entities: path.resolve(import.meta.dirname, "node_modules/entities-next"),${aliases}`,
        ),
      ),
    /contract changed/i,
  );
});

test("a missing or changed required subpath fails closed", () => {
  for (const source of [
    config(""),
    config(aliases.replace('"entities/lib/decode.js"', '"entities/decode"')),
    config(aliases.replace('"node_modules/entities/lib/encode.js"', '"node_modules/other"')),
  ])
    assert.throws(() => normalizeBaselineEntitiesAlias(source), /contract changed/i);
});

test("duplicate bare and subpath aliases fail even when their values agree", () => {
  for (const extra of [
    'entities: path.resolve(import.meta.dirname, "node_modules/entities"),\n'.repeat(2),
    '"entities/lib/decode.js": path.resolve(import.meta.dirname, "node_modules/entities/lib/decode.js"),',
  ])
    assert.throws(
      () => normalizeBaselineEntitiesAlias(config(`${aliases}${extra}`)),
      /contract changed/i,
    );
});

test("spreads, computed aliases and multiple resolver objects cannot hide a mismatch", () => {
  for (const source of [
    config(`${aliases} ...extraAliases,`),
    config(`${aliases} [getAlias()]: "elsewhere",`),
    config().replace("vite: {", "resolve: { alias: {} }, vite: {"),
  ])
    assert.throws(() => normalizeBaselineEntitiesAlias(source), /contract changed/i);
});

test("workflow retains the helper outside the checkout and executes it before the baseline build", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/bundle-impact.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /cp scripts\/normalize-baseline-entities-alias\.mjs "\$RUNNER_TEMP\//);
  const invoke = workflow.indexOf('node "$RUNNER_TEMP/normalize-baseline-entities-alias.mjs"');
  assert.ok(invoke > workflow.indexOf('git checkout --detach "$BASE_SHA"'));
  assert.ok(invoke < workflow.indexOf("PFM_LOCAL_VERIFY=1 npm run build"));
});

test("the preserved helper resolves TypeScript from the shared dependency graph", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "baseline-alias-"));
  try {
    const script = path.join(directory, "normalize.mjs");
    const file = path.join(directory, "vite.config.ts");
    writeFileSync(
      script,
      readFileSync(new URL("./normalize-baseline-entities-alias.mjs", import.meta.url)),
    );
    writeFileSync(file, config());
    const result = spawnSync(process.execPath, [script, file], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, "already-compatible");
    assert.equal(readFileSync(file, "utf8"), config());
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
