import { readFileSync, writeFileSync } from "node:fs";

const [, , baselinePath, candidatePath] = process.argv;
if (!baselinePath || !candidatePath) {
  throw new Error("Usage: node scripts/compare-bundle-reports.mjs BASELINE.json CANDIDATE.json");
}
const before = JSON.parse(readFileSync(baselinePath, "utf8"));
const after = JSON.parse(readFileSync(candidatePath, "utf8"));
const keys = [
  ["Página inicial", (entry) => entry.surface === "home"],
  ["Nova carreira", (entry) => entry.surface === "new"],
  ["Partida rápida", (entry) => entry.name.startsWith("partida-rapida-")],
  ["Match 3D", (entry) => entry.name.startsWith("match-")],
  ["Editor", (entry) => entry.name.startsWith("editor-")],
  ["Simulação Worker", (entry) => entry.name.startsWith("match.worker-")],
];
const format = (value) => (typeof value === "number" ? (value / 1024).toFixed(1) + " KiB" : "n/d");
const difference = (base, current) =>
  typeof base === "number" && base > 0 && typeof current === "number"
    ? ((1 - current / base) * 100).toFixed(2) + "%"
    : "n/d";
const rows = [];
function add(label, base, current) {
  rows.push({
    label,
    before: base,
    after: current,
    reductionPercent: difference(base, current),
  });
}
add("JS emitido total (inclui lazy)", before.totalBytes, after.totalBytes);
add("JS emitido total (gzip)", before.totalGzipBytes, after.totalGzipBytes);
add("JS emitido total (Brotli Q6)", before.totalBrotliBytes, after.totalBrotliBytes);
for (const [name, predicate] of keys) {
  const b = before.entries.find(predicate);
  const a = after.entries.find(predicate);
  if (!b || !a) continue;
  add(name + " startup (gzip)", b.startupGzipBytes, a.startupGzipBytes);
  add(name + " startup (Brotli Q6)", b.startupBrotliBytes, a.startupBrotliBytes);
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
].join("\n");
const result = {
  before: before.label,
  after: after.label,
  comparisonDate: new Date().toISOString(),
  rows,
};
writeFileSync("bundle-impact.md", md);
writeFileSync("bundle-impact.json", JSON.stringify(result, null, 2) + "\n");
console.log(md);
