import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");
const BASELINE_PATH = "scripts/i18n-hardcoded-baseline.json";
const ATTRIBUTE_NAMES = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "label",
  "placeholder",
  "title",
]);

function sourceFiles(rootDir, directory = "src") {
  const absoluteDirectory = path.join(rootDir, directory);
  if (!existsSync(absoluteDirectory)) return [];
  const files = [];
  for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(rootDir, relative));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
    if (relative.includes("/i18n/") || relative.endsWith(".test.tsx")) continue;
    files.push(relative);
  }
  return files.sort();
}

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function isCandidateText(value) {
  return /\p{L}/u.test(value);
}

function scanFile(rootDir, relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  const source = readFileSync(absolutePath, "utf8");
  const sourceFile = ts.createSourceFile(
    absolutePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const candidates = [];
  const add = (node, kind, raw) => {
    const text = normalizeText(raw);
    if (!text || !isCandidateText(text)) return;
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    candidates.push({ file: relativePath, line: position.line + 1, kind, text });
  };
  const visit = (node) => {
    if (ts.isJsxText(node)) add(node, "jsx-text", node.getText(sourceFile));
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (ATTRIBUTE_NAMES.has(name) && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) {
          add(node.initializer, `jsx-attribute:${name}`, node.initializer.text);
        } else if (ts.isJsxExpression(node.initializer)) {
          const expression = node.initializer.expression;
          if (
            expression &&
            (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
          ) {
            add(expression, `jsx-attribute:${name}`, expression.text);
          }
        }
      }
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const expression = node.parent;
      const container = expression?.parent;
      if (
        ts.isJsxExpression(expression) &&
        (ts.isJsxElement(container) || ts.isJsxFragment(container))
      ) {
        add(node, "jsx-expression", node.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return candidates;
}

export function scanHardcoded({ rootDir = DEFAULT_ROOT } = {}) {
  const candidates = sourceFiles(rootDir).flatMap((file) => scanFile(rootDir, file));
  candidates.sort((left, right) =>
    `${left.file}\0${left.line}\0${left.kind}\0${left.text}`.localeCompare(
      `${right.file}\0${right.line}\0${right.kind}\0${right.text}`,
    ),
  );
  return {
    schemaVersion: 1,
    auditKind: "hardcoded-candidate",
    scope: {
      source: "src/**/*.tsx",
      excluded: ["src/i18n/**", "**/*.test.tsx"],
      detector: "TypeScript JSX literal heuristic",
    },
    candidateCount: candidates.length,
    fileCount: new Set(candidates.map((candidate) => candidate.file)).size,
    candidates,
  };
}

function candidateKey(candidate) {
  return `${candidate.file}\0${candidate.kind}\0${candidate.text}`;
}
export function compareHardcodedBaseline(report, baseline) {
  const counts = (candidates) => {
    const result = new Map();
    for (const candidate of candidates) {
      const key = candidateKey(candidate);
      const entry = result.get(key) ?? { count: 0, candidates: [] };
      entry.count += 1;
      entry.candidates.push(candidate);
      result.set(key, entry);
    }
    return result;
  };
  const current = counts(report.candidates);
  const previous = counts(baseline.candidates);
  const addedCandidates = [];
  const removedCandidates = [];
  for (const [key, entry] of current) {
    const excess = entry.count - (previous.get(key)?.count ?? 0);
    if (excess > 0) addedCandidates.push(...entry.candidates.slice(-excess));
  }
  for (const [key, entry] of previous) {
    const excess = entry.count - (current.get(key)?.count ?? 0);
    if (excess > 0) removedCandidates.push(...entry.candidates.slice(-excess));
  }
  return {
    baselineCandidateCount: baseline.candidateCount,
    currentCandidateCount: report.candidateCount,
    baselineFileCount: baseline.fileCount,
    currentFileCount: report.fileCount,
    addedCandidates,
    removedCandidates,
    passed: addedCandidates.length === 0,
  };
}
function readBaseline(rootDir) {
  const file = path.join(rootDir, BASELINE_PATH);
  if (!existsSync(file)) throw new Error(`Missing hardcoded baseline: ${BASELINE_PATH}`);
  return JSON.parse(readFileSync(file, "utf8"));
}

function main() {
  const rootDir = process.cwd();
  const report = scanHardcoded({ rootDir });
  if (process.argv.includes("--write-baseline")) {
    writeFileSync(
      path.join(rootDir, BASELINE_PATH),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
  }
  const comparison = process.argv.includes("--check")
    ? compareHardcodedBaseline(report, readBaseline(rootDir))
    : null;
  process.stdout.write(`${JSON.stringify({ report, comparison }, null, 2)}\n`);
  if (comparison && !comparison.passed) process.exitCode = 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
)
  main();
