import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { analyzePackText, inspectI18n, sourcePlaceholders } from "./i18n-parity.mjs";

const report = inspectI18n();

test("collects placeholders from every canonical message source", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "i18n-placeholder-"));
  const sources = [
    "src/i18n/bootstrap-messages.ts",
    "src/i18n/interface-bootstrap.ts",
    "src/i18n/interface-messages.ts",
    "src/i18n/expanded-messages.ts",
  ];
  try {
    for (const relativePath of sources) {
      const file = path.join(rootDir, relativePath);
      await mkdir(path.dirname(file), { recursive: true });
      const key = relativePath.endsWith("expanded-messages.ts")
        ? '"expanded.message": "Goals: {count}",'
        : '"source.message": "No placeholders",';
      await writeFile(file, `export const messages = {\n  ${key}\n};\n`);
    }
    const collected = sourcePlaceholders(rootDir);
    assert.deepEqual(collected.get("expanded.message"), ["{count}"]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("collects computed static message keys and placeholders from templates and concatenations", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "i18n-ast-fixture-"));
  try {
    for (const relativePath of [
      "src/i18n/bootstrap-messages.ts",
      "src/i18n/interface-bootstrap.ts",
      "src/i18n/interface-messages.ts",
      "src/i18n/expanded-messages.ts",
    ]) {
      const file = path.join(rootDir, relativePath);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, "export const messages = {};\n");
    }
    await writeFile(
      path.join(rootDir, "src/i18n/locale-identifiers.ts"),
      'export const BASE_LANGS = ["en"] as const;\nexport const ADDED_LANGS = [] as const;\nexport const RTL_LANGS = new Set([]);\n',
    );
    await writeFile(
      path.join(rootDir, "src/i18n/locale-runtime-manifest.ts"),
      "export const LEGACY_PUBLISHED_LOCALES = [] as const;\n",
    );
    await writeFile(
      path.join(rootDir, "src/i18n/bootstrap-messages.ts"),
      'export const messages = { ["hidden.key"]: `Hi {name}`, "concat.key": "Hello " + "{person}" };\n',
    );
    await writeFile(
      path.join(rootDir, "src/i18n/expanded-messages.ts"),
      'export const CORE_NAV_KEYS = ["nav.home"] as const;\n',
    );

    const collected = sourcePlaceholders(rootDir);
    const report = inspectI18n({ rootDir });
    assert.ok(report.canonicalKeys.includes("hidden.key"));
    assert.deepEqual(collected.get("hidden.key"), ["{name}"]);
    assert.deepEqual(collected.get("concat.key"), ["{person}"]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("emits one reviewable manifest entry for every catalog locale", () => {
  assert.equal(report.catalogLocales, 98);
  assert.equal(report.packs.length, 98);
  assert.equal(new Set(report.packs.map((pack) => pack.locale)).size, 98);
  assert.equal(report.sourceLocale, "en");
  assert.equal(report.auditKind, "structural-only");
  assert.equal(report.semanticReview, "not-assessed");
  assert.equal(report.draftPackDirectory, "src/i18n/drafts/locale-packs");
  assert.equal(report.draftPackCount, 98);
  assert.deepEqual(report.publicPackFiles, []);
  assert.equal(report.publicDraftLeak, false);
  assert.equal(report.runtimeApprovedLocales.length, 26);
  assert.ok(report.canonicalKeyCount > 200);
  assert.ok(report.packs.every((pack) => ["ltr", "rtl"].includes(pack.direction)));
  assert.ok(report.packs.every((pack) => ["draft", "reviewed", "approved"].includes(pack.status)));
  assert.ok(report.packs.every((pack) => pack.reviewRequired === true));
  assert.ok(report.packs.every((pack) => pack.runtimeEligible === false));
  assert.ok(report.packs.every((pack) => pack.auditKind === "structural-only"));
});

test("requires structural key and placeholder parity while keeping generated packs as drafts", () => {
  assert.equal(report.allPacksComplete, true);
  assert.deepEqual(report.incompletePacks, []);
  assert.deepEqual(report.unknownPacks, []);
  assert.ok(report.packs.every((pack) => pack.complete === true));
  assert.ok(report.packs.every((pack) => pack.missingKeys.length === 0));
  assert.ok(report.packs.every((pack) => pack.placeholderMismatches.length === 0));
  assert.ok(report.packs.every((pack) => pack.status === "draft" && pack.reviewRequired));
  assert.equal(report.hardcodedAudit, "separate-gate");
});

test("detects duplicate, unknown, empty, missing and placeholder errors in a pack", () => {
  const result = analyzePackText(
    "xx",
    '{"known":"Hello {name}","known":"","unknown":"{other}"}',
    ["known", "required"],
    new Map([["known", ["{name}"]]]),
  );
  assert.deepEqual(result.duplicateKeys, ["known"]);
  assert.deepEqual(result.unknownKeys, ["unknown"]);
  assert.deepEqual(result.emptyKeys, ["known"]);
  assert.deepEqual(result.missingKeys, ["required"]);
  assert.deepEqual(result.placeholderMismatches, [
    { key: "known", expected: ["{name}"], actual: [] },
    { key: "unknown", expected: [], actual: ["{other}"] },
  ]);
  assert.deepEqual(result.issues, [
    "duplicate-keys",
    "missing-keys",
    "unknown-keys",
    "empty-values",
    "placeholder-mismatch",
  ]);
  assert.equal(result.complete, false);
});

test("rejects malformed JSON as a structural pack error", () => {
  const result = analyzePackText("xx", '{"known":', ["known"]);
  assert.equal(result.incomplete, true);
  assert.ok(result.issues.includes("invalid-json"));
});

test("recognizes square-bracket placeholders in source messages and packs", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "i18n-bracket-placeholder-"));
  try {
    for (const relativePath of [
      "src/i18n/bootstrap-messages.ts",
      "src/i18n/interface-bootstrap.ts",
      "src/i18n/interface-messages.ts",
      "src/i18n/expanded-messages.ts",
    ]) {
      const file = path.join(rootDir, relativePath);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, 'export const messages = {\n  "source.message": "Hello [name]",\n};\n');
    }
    const collected = sourcePlaceholders(rootDir);
    assert.deepEqual(collected.get("source.message"), ["[name]"]);
    const result = analyzePackText(
      "xx",
      '{"source.message":"Hola [name]"}',
      ["source.message"],
      collected,
    );
    assert.equal(result.complete, true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
