import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");
const SOURCE_FILES = [
  "src/i18n/bootstrap-messages.ts",
  "src/i18n/interface-bootstrap.ts",
  "src/i18n/interface-messages.ts",
  "src/i18n/expanded-messages.ts",
];
const LOCALE_IDENTIFIER_FILE = "src/i18n/locale-identifiers.ts";
const RUNTIME_MANIFEST_FILE = "src/i18n/locale-runtime-manifest.ts";
const DRAFT_PACK_DIRECTORY = "src/i18n/drafts/locale-packs";
const PUBLIC_PACK_DIRECTORY = "public/locale-packs";
const STATUS = "draft";

function read(rootDir, relativePath) {
  return readFileSync(path.join(rootDir, relativePath), "utf8");
}

function quotedValues(source) {
  return [...source.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
}

function readLocaleArray(source, name) {
  const match = source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\][^;]*;`));
  if (!match) throw new Error(`Cannot find locale array ${name}`);
  return quotedValues(match[1]);
}

function readRtlLocales(source) {
  const match = source.match(/export const RTL_LANGS[^=]*= new Set\(\[([\s\S]*?)\]\);/);
  if (!match) throw new Error("Cannot find RTL locale set");
  return new Set(quotedValues(match[1]));
}

function parseSource(source, fileName) {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function staticString(node) {
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    node.kind === ts.SyntaxKind.FirstTemplateToken
  )
    return node.text;
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticString(node.left);
    const right = staticString(node.right);
    if (left !== null && right !== null) return left + right;
  }
  return null;
}

function unwrapExpression(node) {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    node = node.expression;
  }
  return node;
}

function visit(node, callback) {
  callback(node);
  ts.forEachChild(node, (child) => {
    visit(child, callback);
  });
}

function readRuntimeApprovedLocales(rootDir) {
  const source = read(rootDir, RUNTIME_MANIFEST_FILE);
  return ["pt-BR", "en", ...readLocaleArray(source, "LEGACY_PUBLISHED_LOCALES")];
}

function readCanonicalKeys(rootDir) {
  const keys = new Set();
  for (const relativePath of SOURCE_FILES.slice(0, 3)) {
    const source = parseSource(read(rootDir, relativePath), relativePath);
    visit(source, (node) => {
      if (!ts.isPropertyAssignment(node)) return;
      const name = node.name;
      const key = ts.isStringLiteral(name)
        ? name.text
        : ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression)
          ? name.expression.text
          : null;
      if (key?.includes(".")) keys.add(key);
    });
  }
  const expanded = parseSource(read(rootDir, SOURCE_FILES[3]), SOURCE_FILES[3]);
  let coreKeys = null;
  visit(expanded, (node) => {
    if (
      !ts.isVariableDeclaration(node) ||
      !ts.isIdentifier(node.name) ||
      node.name.text !== "CORE_NAV_KEYS"
    )
      return;
    if (!node.initializer) return;
    const initializer = unwrapExpression(node.initializer);
    if (!ts.isArrayLiteralExpression(initializer)) return;
    coreKeys = initializer.elements.map(staticString).filter((key) => key !== null);
  });
  if (!coreKeys) throw new Error("Cannot find CORE_NAV_KEYS");
  for (const key of coreKeys) keys.add(key);
  return [...keys].sort();
}

export function sourcePlaceholders(rootDir) {
  const placeholders = new Map();
  const tokenPattern = /\{\{?[A-Za-z0-9_.-]+\}?\}|%\{[A-Za-z0-9_.-]+\}|%[sd]|\[[A-Za-z0-9_.-]+\]/g;
  for (const relativePath of SOURCE_FILES) {
    const source = parseSource(read(rootDir, relativePath), relativePath);
    visit(source, (node) => {
      if (!ts.isPropertyAssignment(node)) return;
      const name = node.name;
      const key = ts.isStringLiteral(name)
        ? name.text
        : ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression)
          ? name.expression.text
          : null;
      if (key === null) return;
      const value = staticString(node.initializer);
      if (value === null) return;
      const tokens = value.match(tokenPattern) ?? [];
      if (tokens.length > 0) placeholders.set(key, tokens.sort());
    });
  }
  return placeholders;
}

function parseJsonObjectKeys(text) {
  let index = 0;
  const duplicates = new Set();
  function skipWhitespace() {
    while (/\s/.test(text[index] ?? "")) index += 1;
  }
  function parseString() {
    const start = index;
    index += 1;
    while (index < text.length) {
      if (text[index] === "\\") {
        index += 2;
        continue;
      }
      if (text[index] === '"') {
        const raw = text.slice(start, index + 1);
        index += 1;
        return JSON.parse(raw);
      }
      index += 1;
    }
    throw new Error("Unterminated JSON string");
  }
  function parseValue() {
    skipWhitespace();
    if (text[index] === "{") return parseObject();
    if (text[index] === "[") return parseArray();
    if (text[index] === '"') {
      parseString();
      return;
    }
    const start = index;
    while (index < text.length && !",}]".includes(text[index])) index += 1;
    if (start === index) throw new Error(`Invalid JSON value at offset ${index}`);
  }
  function parseObject() {
    const keys = new Set();
    index += 1;
    skipWhitespace();
    if (text[index] === "}") {
      index += 1;
      return;
    }
    while (index < text.length) {
      skipWhitespace();
      if (text[index] !== '"') throw new Error(`Expected JSON object key at offset ${index}`);
      const key = parseString();
      if (keys.has(key)) duplicates.add(key);
      keys.add(key);
      skipWhitespace();
      if (text[index] !== ":") throw new Error(`Expected ':' after ${key}`);
      index += 1;
      parseValue();
      skipWhitespace();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      if (text[index] !== ",") throw new Error(`Expected ',' after ${key}`);
      index += 1;
    }
    throw new Error("Unterminated JSON object");
  }
  function parseArray() {
    index += 1;
    skipWhitespace();
    if (text[index] === "]") {
      index += 1;
      return;
    }
    while (index < text.length) {
      parseValue();
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      if (text[index] !== ",") throw new Error("Expected ',' in JSON array");
      index += 1;
    }
    throw new Error("Unterminated JSON array");
  }
  skipWhitespace();
  parseValue();
  skipWhitespace();
  if (index !== text.length) throw new Error(`Unexpected JSON content at offset ${index}`);
  return [...duplicates].sort();
}

export function placeholders(value) {
  return (
    value.match(/\{\{?[A-Za-z0-9_.-]+\}?\}|%\{[A-Za-z0-9_.-]+\}|%[sd]|\[[A-Za-z0-9_.-]+\]/g) ?? []
  ).sort();
}

export function analyzePackText(locale, text, canonicalKeys, expectedPlaceholders = new Map()) {
  const duplicateKeys = [];
  let values;
  let invalidJson = null;
  try {
    duplicateKeys.push(...parseJsonObjectKeys(text));
    values = JSON.parse(text);
  } catch (error) {
    invalidJson = error instanceof Error ? error.message : String(error);
  }
  const keys =
    values && typeof values === "object" && !Array.isArray(values) ? Object.keys(values) : [];
  const keySet = new Set(keys);
  const canonical = new Set(canonicalKeys);
  const missingKeys = canonicalKeys.filter((key) => !keySet.has(key));
  const unknownKeys = keys.filter((key) => !canonical.has(key)).sort();
  const emptyKeys = keys
    .filter((key) => typeof values[key] !== "string" || values[key].trim().length === 0)
    .sort();
  const placeholderMismatches = [];
  for (const key of keys) {
    const actual = placeholders(typeof values[key] === "string" ? values[key] : "");
    const expected = expectedPlaceholders.get(key) ?? [];
    if (actual.join("\u0000") !== expected.join("\u0000"))
      placeholderMismatches.push({ key, expected, actual });
  }
  const issues = [];
  if (invalidJson) issues.push("invalid-json");
  if (duplicateKeys.length > 0) issues.push("duplicate-keys");
  if (missingKeys.length > 0) issues.push("missing-keys");
  if (unknownKeys.length > 0) issues.push("unknown-keys");
  if (emptyKeys.length > 0) issues.push("empty-values");
  if (placeholderMismatches.length > 0) issues.push("placeholder-mismatch");
  return {
    locale,
    keyCount: keys.length,
    complete: issues.length === 0,
    incomplete: issues.length > 0,
    issues,
    missingKeys,
    unknownKeys,
    duplicateKeys,
    emptyKeys,
    placeholderMismatches,
  };
}

function packFiles(rootDir, relativeDirectory) {
  const directory = path.join(rootDir, relativeDirectory);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort();
}

function localeManifest(locale, direction, fallback, packRelativePath, report) {
  return {
    locale,
    pack: packRelativePath,
    direction,
    fallback,
    status: STATUS,
    reviewRequired: true,
    runtimeEligible: false,
    auditKind: "structural-only",
    ...report,
  };
}

export function inspectI18n({ rootDir = DEFAULT_ROOT } = {}) {
  const identifiers = read(rootDir, LOCALE_IDENTIFIER_FILE);
  const baseLocales = readLocaleArray(identifiers, "BASE_LANGS");
  const addedLocales = readLocaleArray(identifiers, "ADDED_LANGS");
  const locales = [...baseLocales, ...addedLocales];
  const rtlLocales = readRtlLocales(identifiers);
  const runtimeApprovedLocales = readRuntimeApprovedLocales(rootDir);
  const canonicalKeys = readCanonicalKeys(rootDir);
  const expectedPlaceholders = sourcePlaceholders(rootDir);
  const draftFiles = packFiles(rootDir, DRAFT_PACK_DIRECTORY);
  const publicFiles = packFiles(rootDir, PUBLIC_PACK_DIRECTORY);
  const packLocales = new Set(draftFiles.map((file) => file.slice(0, -5)));
  const publicPackLocales = new Set(publicFiles.map((file) => file.slice(0, -5)));
  const unknownPacks = [...packLocales].filter((locale) => !locales.includes(locale)).sort();
  const unknownPublicPacks = [...publicPackLocales]
    .filter((locale) => !locales.includes(locale))
    .sort();
  const manifests = locales.map((locale) => {
    const hasPack = packLocales.has(locale);
    const packRelativePath = hasPack
      ? path.posix.join(DRAFT_PACK_DIRECTORY, `${locale}.json`)
      : null;
    const report = hasPack
      ? analyzePackText(
          locale,
          read(rootDir, packRelativePath),
          canonicalKeys,
          expectedPlaceholders,
        )
      : {
          locale,
          keyCount: 0,
          complete: false,
          incomplete: true,
          issues: ["missing-pack"],
          missingKeys: [...canonicalKeys],
          unknownKeys: [],
          duplicateKeys: [],
          emptyKeys: [],
          placeholderMismatches: [],
        };
    return localeManifest(
      locale,
      rtlLocales.has(locale) ? "rtl" : "ltr",
      locale === "en" ? "pt-BR" : "en",
      packRelativePath,
      report,
    );
  });
  return {
    schemaVersion: 2,
    auditKind: "structural-only",
    semanticReview: "not-assessed",
    sourceLocale: "en",
    catalogLocales: locales.length,
    runtimeApprovedLocales,
    canonicalKeyCount: canonicalKeys.length,
    canonicalKeys,
    draftPackDirectory: DRAFT_PACK_DIRECTORY,
    publicPackDirectory: PUBLIC_PACK_DIRECTORY,
    draftPackCount: draftFiles.length,
    publicPackFiles: publicFiles,
    packs: manifests,
    incompletePacks: manifests.filter((pack) => pack.incomplete).map((pack) => pack.locale),
    unknownPacks,
    unknownPublicPacks,
    publicDraftLeak: publicFiles.length > 0,
    hardcodedAudit: "separate-gate",
    allPacksComplete:
      manifests.every((pack) => pack.complete) &&
      unknownPacks.length === 0 &&
      unknownPublicPacks.length === 0 &&
      publicFiles.length === 0,
  };
}

function main() {
  const check = process.argv.includes("--check");
  const report = inspectI18n({ rootDir: process.cwd() });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (check && (!report.allPacksComplete || report.unknownPacks.length > 0)) process.exitCode = 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
)
  main();
