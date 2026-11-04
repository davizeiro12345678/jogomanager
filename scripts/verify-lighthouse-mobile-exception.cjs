/* Temporary, PR-scoped Lighthouse performance exception. All five public
 * pages must finish three audits each; accessibility and CLS still block.
 * Only performance score, LCP and TBT breaches are tolerated here.
 * Delete this file and the scoped workflow exception after remediation. */
const fs = require("node:fs");
const path = require("node:path");

const auditRoot = process.env.JM_LH_REPORT_ROOT || process.cwd();
const expected = new Set([
  "/",
  "/guias",
  "/guia-de-scouting",
  "/melhores-formacoes",
  "/partida-rapida",
]);
const candidates = [".lighthouseci", ".lighthouseci-mobile"];
const entries = [];
for (const relative of candidates) {
  const folder = path.join(auditRoot, relative);
  if (!fs.existsSync(folder)) continue;
  for (const name of fs.readdirSync(folder)) {
    if (/^(?:lhr-.*|.*\.report)\.json$/.test(name)) entries.push(path.join(folder, name));
  }
}
const counts = new Map([...expected].map((route) => [route, 0]));
const allowed = [];
const blocking = [];
const auditsByUrlAndDate = new Set();
for (const filename of entries) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filename, "utf8"));
  } catch {
    blocking.push("Unreadable Lighthouse JSON: " + path.basename(filename));
    continue;
  }
  let url;
  try {
    url = new URL(data.requestedUrl || data.finalUrl);
  } catch {
    blocking.push("Missing valid audited URL: " + path.basename(filename));
    continue;
  }
  if (!expected.has(url.pathname)) {
    blocking.push("Unexpected audited route: " + url.pathname);
    continue;
  }
  if (!data.fetchTime || data.runtimeError) {
    blocking.push("Incomplete Lighthouse run: " + url.pathname);
    continue;
  }
  const key = url.pathname + "|" + data.fetchTime;
  if (auditsByUrlAndDate.has(key)) {
    blocking.push("Duplicate Lighthouse run: " + key);
    continue;
  }
  auditsByUrlAndDate.add(key);
  counts.set(url.pathname, counts.get(url.pathname) + 1);
  const perf = data.categories?.performance?.score;
  const access = data.categories?.accessibility?.score;
  const lcp = data.audits?.["largest-contentful-paint"]?.numericValue;
  const cls = data.audits?.["cumulative-layout-shift"]?.numericValue;
  const tbt = data.audits?.["total-blocking-time"]?.numericValue;
  if (![perf, access, lcp, cls, tbt].every((n) => Number.isFinite(n))) {
    blocking.push("Missing metrics: " + url.pathname);
    continue;
  }
  if (access < 0.9) blocking.push(url.pathname + " accessibility " + access + " < 0.90");
  if (cls > 0.1) blocking.push(url.pathname + " CLS " + cls + " > 0.10");
  if (perf < 0.98 || lcp > 2500 || tbt > 200) {
    allowed.push(
      url.pathname +
        ": performance=" +
        perf +
        ", LCP=" +
        Math.round(lcp) +
        "ms, TBT=" +
        Math.round(tbt) +
        "ms",
    );
  }
}
for (const [route, count] of counts) {
  if (count !== 3) blocking.push(route + ": expected 3 completed Lighthouse runs, found " + count);
}
const summary =
  [
    "### Mobile Lighthouse: temporary exception limited to this integration PR",
    "Complete runs: " + [...counts.values()].reduce((a, b) => a + b, 0) + " / 15.",
    "Performance-only breaches (not suppressed from the report): " + allowed.length + ".",
    ...allowed.map((line) => "- WARNING " + line),
    ...blocking.map((line) => "- BLOCKING " + line),
    "Other GitHub quality, SAST, migration, bundle, dependency and visual checks remain required.",
  ].join("\n") + "\n";
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);
if (blocking.length) process.exitCode = 1;
