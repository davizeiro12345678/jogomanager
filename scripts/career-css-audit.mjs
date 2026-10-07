import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourcePath = resolve(process.argv[2] ?? "src/components/game/career-interface.css");
const outputPath = process.argv[3] ? resolve(process.argv[3]) : null;
const source = await readFile(sourcePath, "utf8");

const selectorMatches = [...source.matchAll(/(^|\})\s*([^@{}][^{}]*)\s*\{/gm)];
const selectors = selectorMatches.flatMap((match) =>
  match[2]
    .split(",")
    .map((selector) => selector.trim())
    .filter(Boolean),
);
const selectorCounts = new Map();
for (const selector of selectors)
  selectorCounts.set(selector, (selectorCounts.get(selector) ?? 0) + 1);

const report = {
  source: sourcePath,
  bytes: Buffer.byteLength(source),
  lines: source.split(/\r?\n/).length,
  selectors: selectors.length,
  repeatedSelectors: [...selectorCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 40)
    .map(([selector, count]) => ({ selector, count })),
  mediaQueries: [...source.matchAll(/@media\s*\(([^)]+)\)/g)].map((match) => match[1]),
  mediaQueryCount: (source.match(/@media\b/g) ?? []).length,
  primaryResponsiveBreakpoints: [1180, 768, 480],
  contextualMediaQueries: [
    "prefers-reduced-motion",
    "prefers-contrast",
    "forced-colors",
    "hover/pointer",
    "viewport-height",
  ],
  containerQueryCount: (source.match(/@container\b/g) ?? []).length,
  layers: [...source.matchAll(/@layer\s+([^;{]+)/g)].map((match) => match[1].trim()),
  literalHexColors: [...new Set(source.match(/#[0-9a-f]{3,8}\b/gi) ?? [])].sort(),
  zIndexValues: [
    ...new Set(source.match(/z-index\s*:\s*([^;]+);/g)?.map((value) => value.trim()) ?? []),
  ],
};

console.log(JSON.stringify(report, null, 2));
if (outputPath) await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
