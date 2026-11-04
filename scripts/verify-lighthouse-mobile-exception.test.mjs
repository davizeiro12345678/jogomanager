import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const checker = resolve("scripts/verify-lighthouse-mobile-exception.cjs");
const routes = ["/", "/guias", "/guia-de-scouting", "/melhores-formacoes", "/partida-rapida"];
function scenario({
  omit,
  accessibility = 0.95,
  cls = 0.02,
  runtimeError = false,
  duplicate = false,
  conflictingMirror = false,
  origin = "http://127.0.0.1:4173",
} = {}) {
  const folder = mkdtempSync(join(tmpdir(), "jm-lighthouse-"));
  const sub = join(folder, ".lighthouseci");
  mkdirSync(sub);
  for (let i = 0; i < routes.length * 3; i++) {
    if (i === omit) continue;
    const route = routes[Math.floor(i / 3)];
    const report = {
      requestedUrl: origin + route,
      fetchTime: new Date(Date.UTC(2026, 10, 4, 16, 0, i)).toISOString(),
      runtimeError: runtimeError ? { code: "NO_FCP" } : undefined,
      categories: {
        performance: { score: 0.8 },
        accessibility: { score: accessibility },
      },
      audits: {
        "largest-contentful-paint": { numericValue: 3100 },
        "cumulative-layout-shift": { numericValue: cls },
        "total-blocking-time": { numericValue: 600 },
      },
    };
    writeFileSync(join(sub, "lhr-" + i + ".json"), JSON.stringify(report));
    if (duplicate) {
      const mirror = JSON.parse(JSON.stringify(report));
      if (conflictingMirror && i === 0) mirror.audits["total-blocking-time"].numericValue = 601;
      writeFileSync(join(sub, i + ".report.json"), JSON.stringify(mirror));
    }
  }
  const run = spawnSync(process.execPath, [checker], {
    encoding: "utf8",
    env: { ...process.env, JM_LH_REPORT_ROOT: folder },
  });
  rmSync(folder, { recursive: true, force: true });
  return run;
}
test("allows only complete performance breaches on integration PR", () => {
  const r = scenario();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Complete runs: 15 \/ 15/);
  assert.match(r.stdout, /Performance-only breaches/);
});
test("deduplicates identical LHCI report mirrors without hiding failed audits", () => {
  const r = scenario({ duplicate: true });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Complete runs: 15 \/ 15/);
});
test("rejects mismatched duplicate Lighthouse reports", () => {
  const r = scenario({ duplicate: true, conflictingMirror: true });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /Conflicting Lighthouse copies/);
});
test("rejects fake reports from a different web origin", () => {
  const r = scenario({ origin: "https://example.invalid" });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /Unexpected Lighthouse origin/);
});
test("blocks missing Lighthouse evidence", () => {
  const r = scenario({ omit: 3 });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /expected 3 completed/);
});
test("blocks accessibility regressions", () => {
  const r = scenario({ accessibility: 0.7 });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /accessibility/);
});
test("blocks layout regressions", () => {
  const r = scenario({ cls: 0.12 });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /CLS/);
});
test("blocks incomplete Lighthouse runs", () => {
  const r = scenario({ runtimeError: true });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /Incomplete Lighthouse run/);
});
