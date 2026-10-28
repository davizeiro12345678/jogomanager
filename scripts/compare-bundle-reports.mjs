import { readFileSync, writeFileSync } from "node:fs";
import { isMatchRouteEntry } from "./bundle-report-comparison.mjs";

const [, , baselinePath, candidatePath] = process.argv;
if (!baselinePath || !candidatePath) {
  throw new Error(
    "Usage: node scripts/compare-bundle-reports.mjs BASELINE.json CANDIDATE.json [--check]",
  );
}
const before = JSON.parse(readFileSync(baselinePath, "utf8"));
const after = JSON.parse(readFileSync(candidatePath, "utf8"));
const keys = [
  ["Página inicial", (entry) => entry.surface === "home"],
  ["Nova carreira", (entry) => entry.surface === "new"],
  ["Partida rápida", (entry) => entry.name.startsWith("partida-rapida-")],
  ["Match 3D", isMatchRouteEntry],
  ["Palco cinematográfico", (entry) => entry.name.startsWith("CinematicStage3D-")],
  ["Editor", (entry) => entry.name.startsWith("editor-")],
  ["Simulação Worker", (entry) => entry.name.startsWith("match.worker-")],
];
const format = (value) => (typeof value === "number" ? (value / 1024).toFixed(1) + " KiB" : "n/d");
const difference = (base, current) =>
  typeof base === "number" && base > 0 && typeof current === "number"
    ? ((1 - current / base) * 100).toFixed(2) + "%"
    : "n/d";
const rows = [];
const violations = [];
function add(label, base, current, critical = false) {
  rows.push({
    label,
    before: base,
    after: current,
    reductionPercent: difference(base, current),
  });
  if (!critical) return;
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(current) || current <= 0) {
    violations.push(`${label}: invalid or missing measurement`);
  } else if (current > base) {
    violations.push(`${label}: ${current} exceeds baseline ${base} by ${current - base} bytes`);
  }
}
add("JS emitido total (inclui lazy)", before.totalBytes, after.totalBytes);
add("JS emitido total (gzip)", before.totalGzipBytes, after.totalGzipBytes, true);
add("JS emitido total (Brotli Q6)", before.totalBrotliBytes, after.totalBrotliBytes, true);
for (const [name, predicate] of keys) {
  const baselineMatches = before.entries?.filter(predicate) ?? [];
  const candidateMatches = after.entries?.filter(predicate) ?? [];
  const b = baselineMatches[0];
  const a = candidateMatches[0];
  if (!b || !a) {
    violations.push(`${name}: missing required route in ${!b ? "baseline" : "candidate"}`);
    continue;
  }
  if (name === "Match 3D" && (baselineMatches.length !== 1 || candidateMatches.length !== 1)) {
    violations.push(`${name}: ambiguous route measurement in baseline or candidate`);
    continue;
  }
  add(name + " startup (gzip)", b.startupGzipBytes, a.startupGzipBytes, true);
  add(name + " startup (Brotli Q6)", b.startupBrotliBytes, a.startupBrotliBytes, true);
}
const md = [
  "# Bundle impact: baseline vs candidate",
  "",
  "Comparação de builds com a mesma máquina e configurações. **Números de código transferido estimado**, não LCP, INP, FPS ou tempo real de carregamento. Total inclui chunks lazy e não representa o download inicial.",
  "",
  "| Métrica | Antes | Depois | Redução |",
  "|---|---:|---:|---:|",
  ...rows.map(
    ({ label, before: b, after: a, reductionPercent: pct }) =>
      `| ${label} | ${format(b)} | ${format(a)} | ${pct} |`,
  ),
  "",
  "Brotli Q6 é estimativa offline; o navegador só recebe essa compressão se o CDN responder com Content-Encoding: br.",
  "",
  "Gate: nenhum aumento de gzip/Brotli no total ou nos caminhos de startup acima. Medidas e rotas ausentes falham; o orçamento absoluto é verificado por bundle:check.",
  "",
  ...(violations.length
    ? ["## Gate failures", "", ...violations.map((item) => `- ${item}`), ""]
    : ["Gate: passed.", ""]),
].join("\n");
const result = {
  before: before.label,
  after: after.label,
  comparisonDate: new Date().toISOString(),
  rows,
  violations,
};
writeFileSync("bundle-impact.md", md);
writeFileSync("bundle-impact.json", JSON.stringify(result, null, 2) + "\n");
console.log(md);
if (process.argv.includes("--check") && violations.length) process.exitCode = 1;
