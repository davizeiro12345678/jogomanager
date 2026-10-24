import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { assessMatchSetup } from "./match-setup-budget.mjs";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("every mobile run must meet the existing critical performance budgets", () => {
  const { ci } = require("../.lighthouserc.mobile.cjs");
  assert.equal(ci.collect.numberOfRuns, 3);
  for (const [id, expected] of Object.entries({
    "categories:performance": { minScore: 0.98 },
    "largest-contentful-paint": { maxNumericValue: 2500 },
    "cumulative-layout-shift": { maxNumericValue: 0.1 },
    "total-blocking-time": { maxNumericValue: 200 },
  })) {
    const [level, options] = ci.assert.assertions[id];
    assert.equal(level, "error", `${id} must block release`);
    assert.equal(options.aggregationMethod, "pessimistic", `${id} must check the worst run`);
    for (const [key, value] of Object.entries(expected)) assert.equal(options[key], value);
  }
});

const surfaces = [
  { name: "index-home.js", surface: "home" },
  { name: "new-career.js", surface: "new" },
  { name: "partida-rapida-route.js" },
  { name: "match-route.js" },
  { name: "CinematicStage3D-stage.js" },
  { name: "editor-route.js" },
  { name: "match.worker-runtime.js" },
];
const fixture = () => ({
  label: "fixture",
  totalBytes: 300_000,
  totalGzipBytes: 100_000,
  totalBrotliBytes: 80_000,
  entries: surfaces.map((entry) => ({
    ...entry,
    startupGzipBytes: 10_000,
    startupBrotliBytes: 8_000,
  })),
});

function compare(mutate) {
  const cwd = mkdtempSync(path.join(tmpdir(), "bundle-gate-"));
  try {
    const candidate = fixture();
    mutate(candidate);
    writeFileSync(path.join(cwd, "base.json"), JSON.stringify(fixture()));
    writeFileSync(path.join(cwd, "head.json"), JSON.stringify(candidate));
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/compare-bundle-reports.mjs"), "base.json", "head.json", "--check"],
      { cwd, encoding: "utf8" },
    );
    const report = JSON.parse(readFileSync(path.join(cwd, "bundle-impact.json"), "utf8"));
    return { ...result, report };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("bundle gate permits equal or smaller transport budgets", () => {
  const result = compare((candidate) => {
    candidate.entries[0].startupBrotliBytes -= 100;
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.report.violations, []);
});

test("bundle gate rejects even a small Match 3D startup regression", () => {
  const result = compare((candidate) => {
    candidate.entries[3].startupBrotliBytes += 1;
  });
  assert.equal(result.status, 1);
  assert.match(result.report.violations.join("\n"), /Match 3D.*Brotli/);
});

test("bundle gate cannot pass by dropping a required route", () => {
  const result = compare((candidate) => {
    candidate.entries.splice(2, 1);
  });
  assert.equal(result.status, 1);
  assert.match(result.report.violations.join("\n"), /Partida rápida.*missing/i);
});

test("bundle gate rejects missing or invalid measurements", () => {
  const result = compare((candidate) => {
    candidate.totalBrotliBytes = null;
  });
  assert.equal(result.status, 1);
  assert.match(result.report.violations.join("\n"), /Brotli.*invalid/i);
});

test("constructor CPU gate accepts an unchanged or faster candidate", () => {
  const baseline = Array(62).fill(0.15);
  assert.equal(assessMatchSetup(baseline, baseline).failed, false);
  assert.equal(assessMatchSetup(baseline, Array(62).fill(0.14)).failed, false);
});

test("constructor CPU gate rejects the reproduced material regression", () => {
  const result = assessMatchSetup(Array(62).fill(0.153), Array(62).fill(0.222));
  assert.equal(result.failed, true);
  assert.ok(result.lowerRatio > 1.1);
});

test("constructor CPU gate tolerates isolated noisy samples without changing its margin", () => {
  const baseline = Array(62).fill(0.15);
  const candidate = [...Array(58).fill(0.15), ...Array(4).fill(1.5)];
  const result = assessMatchSetup(baseline, candidate);
  assert.equal(result.failed, false);
  assert.equal(result.materialRegressionPercent, 10);
  assert.equal(result.confidence, 0.99);
});

test("constructor CPU gate rejects insufficient or invalid observations", () => {
  assert.throws(() => assessMatchSetup(Array(61).fill(0.15), Array(62).fill(0.15)));
  assert.throws(() => assessMatchSetup(Array(62).fill(0.15), Array(62).fill(NaN)));
});

function verifyStress(mutate) {
  const cwd = mkdtempSync(path.join(tmpdir(), "stress-gate-"));
  try {
    const report = {
      success: true,
      testResults: [
        {
          name: "/repo/src/game/sim.stress.test.ts",
          status: "passed",
          assertionResults: [
            {
              fullName:
                "finishes 200 seeded matches and reproduces each result inside the worker guard",
              status: "passed",
            },
          ],
        },
      ],
    };
    mutate(report);
    const file = path.join(cwd, "stress-results.json");
    writeFileSync(file, JSON.stringify(report));
    return spawnSync(
      process.execPath,
      [path.join(root, "scripts/verify-stress-report.mjs"), file],
      { encoding: "utf8" },
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("stress gate accepts the executed 200-match suite", () => {
  const result = verifyStress(() => {});
  assert.equal(result.status, 0, result.stderr);
});

test("stress gate rejects skipped, missing and failed suites", () => {
  for (const mutate of [
    (report) => {
      report.testResults = [];
    },
    (report) => {
      report.testResults[0].assertionResults = [];
    },
    (report) => {
      report.testResults[0].assertionResults[0].status = "pending";
    },
    (report) => {
      report.success = false;
    },
  ]) {
    const result = verifyStress(mutate);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /complete 200-match stress suite must execute and pass/);
  }
});

test("bundle analyzer counts shared root-relative modules without following remote URLs", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "bundle-imports-"));
  try {
    writeFileSync(
      path.join(cwd, "match-route.js"),
      'import "/assets/shared.js"; import "https://example.invalid/remote.js"; export const route = 1;',
    );
    writeFileSync(path.join(cwd, "shared.js"), "export const shared = 123;");
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/bundle-report.mjs"), "fixture", cwd],
      { cwd, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(
      readFileSync(path.join(cwd, "verification/bundle-2026-10-01/fixture.json"), "utf8"),
    );
    const entry = report.entries.find((entry) => entry.name === "match-route.js");
    assert.deepEqual(entry.dependencies.sort(), ["match-route.js", "shared.js"]);
    assert.equal(entry.staticBytes, report.totalBytes);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("cinematic analysis follows lazy sets in the stage's shared static registry", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "cinematic-registry-"));
  try {
    writeFileSync(path.join(cwd, "CinematicStage3D-test.js"), 'import "./registry.js";');
    writeFileSync(
      path.join(cwd, "registry.js"),
      'export const load=()=>import("./LockerRoom-test.js");',
    );
    writeFileSync(path.join(cwd, "LockerRoom-test.js"), 'export const room="locker";');
    writeFileSync(
      path.join(cwd, "unrelated.js"),
      'export const load=()=>import("./Office-test.js");',
    );
    writeFileSync(path.join(cwd, "Office-test.js"), 'export const room="office";');
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/bundle-report.mjs"), "fixture", cwd],
      { cwd, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(
      readFileSync(path.join(cwd, "verification/bundle-2026-10-01/fixture.json"), "utf8"),
    );
    assert.deepEqual(report.cinematicStage.dynamicDependencies, ["LockerRoom-test.js"]);
    assert.ok(!report.cinematicStage.staticDependencies.includes("LockerRoom-test.js"));
    assert.ok(!report.cinematicStage.dynamicDependencies.includes("Office-test.js"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("startup measurement retains the deferred hydration runtime and its bootstrap", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "hydration-startup-"));
  try {
    const sources = {
      "index-bootstrap.js": 'export const start=()=>import("./hydrate-app-test.js");',
      "hydrate-app-test.js": 'import "./renderer.js"; import "./router.js";',
      "renderer.js": 'export const renderer="mandatory hydration runtime";',
      "router.js": 'export const dashboard=()=>import("./dashboard-lazy.js");',
      "dashboard-lazy.js": 'export const screen="unopened dashboard";',
      "match-route.js": 'export const route="match";',
      "match.worker-test.js": 'export const worker="sequential simulation";',
    };
    for (const [name, source] of Object.entries(sources))
      writeFileSync(path.join(cwd, name), source);
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/bundle-report.mjs"), "fixture", cwd],
      { cwd, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(
      readFileSync(path.join(cwd, "verification/bundle-2026-10-01/fixture.json"), "utf8"),
    );
    const entry = report.entries.find((entry) => entry.name === "match-route.js");
    assert.deepEqual(entry.startupDependencies.sort(), [
      "hydrate-app-test.js",
      "index-bootstrap.js",
      "match-route.js",
      "renderer.js",
      "router.js",
    ]);
    assert.equal(
      entry.startupBytes,
      report.totalBytes -
        Buffer.byteLength(sources["dashboard-lazy.js"]) -
        Buffer.byteLength(sources["match.worker-test.js"]),
    );
    assert.deepEqual(
      report.entries.find((entry) => entry.name === "match.worker-test.js").startupDependencies,
      ["match.worker-test.js"],
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
