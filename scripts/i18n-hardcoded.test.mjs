import assert from "node:assert/strict";
import { test } from "node:test";
import { compareHardcodedBaseline, scanHardcoded } from "./i18n-hardcoded.mjs";

const report = scanHardcoded();

test("reports hardcoded candidates as a separate heuristic audit", () => {
  assert.equal(report.auditKind, "hardcoded-candidate");
  assert.equal(report.scope.detector, "TypeScript JSX literal heuristic");
  assert.ok(report.candidateCount > 0);
  assert.ok(report.fileCount > 0);
  assert.equal(report.candidates.length, report.candidateCount);
});

test("passes the current baseline without claiming full localization", () => {
  const baseline = {
    ...report,
    candidates: [...report.candidates],
  };
  const comparison = compareHardcodedBaseline(report, baseline);
  assert.equal(comparison.passed, true);
  assert.deepEqual(comparison.addedCandidates, []);
});

test("detects a newly introduced hardcoded candidate", () => {
  const baseline = {
    ...report,
    candidates: report.candidates.slice(1),
  };
  const comparison = compareHardcodedBaseline(report, baseline);
  assert.equal(comparison.passed, false);
  assert.deepEqual(comparison.addedCandidates, [report.candidates[0]]);
});

test("detects added duplicate occurrences of an existing candidate", () => {
  const candidate = { file: "src/example.tsx", line: 1, kind: "jsx-text", text: "Hello" };
  const baseline = { candidateCount: 1, fileCount: 1, candidates: [candidate] };
  const current = {
    candidateCount: 2,
    fileCount: 1,
    candidates: [candidate, { ...candidate, line: 2 }],
  };
  const comparison = compareHardcodedBaseline(current, baseline);
  assert.equal(comparison.passed, false);
  assert.equal(comparison.addedCandidates.length, 1);
  assert.deepEqual(comparison.addedCandidates[0], { ...candidate, line: 2 });
});
