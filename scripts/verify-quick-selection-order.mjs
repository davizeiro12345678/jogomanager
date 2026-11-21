import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tsImport } from "tsx/esm/api";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const loadSource = (relative) =>
  tsImport(pathToFileURL(path.join(root, relative)).href, import.meta.url);
const { QUICK_MATCH_LEAGUE_DIRECTORY, QUICK_MATCH_COUNTRY_ORDER_VARIANTS } = await loadSource(
  "src/game/data/quick-match-catalog.ts",
);
const { quickMatchLeagueGroups } = await loadSource("src/game/quick-match-catalog.ts");
const { RUNTIME_APPROVED_LOCALES } = await loadSource("src/i18n/locale-runtime-manifest.ts");
const expectedByLocale = RUNTIME_APPROVED_LOCALES.map((lang) => ({
  lang,
  groups: quickMatchLeagueGroups(lang),
}));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  });
  const page = await browser.newPage();
  const locales = await page.evaluate(
    ({ directory, expected }) =>
      expected.map(({ lang, groups }) => {
        const grouped = directory.reduce((result, entry) => {
          (result[entry.country] ??= []).push(entry);
          return result;
        }, {});
        const collator = new Intl.Collator(lang);
        const original = Object.entries(grouped)
          .sort(([a], [b]) => (a === "Brasil" ? -1 : b === "Brasil" ? 1 : collator.compare(a, b)))
          .map(([country, leagues]) => ({ country, leagues }));
        return {
          lang,
          browserResolvedLocale: collator.resolvedOptions().locale,
          identical: JSON.stringify(original) === JSON.stringify(groups),
          countryCount: original.length,
          optionCount: original.reduce((sum, group) => sum + group.leagues.length, 0),
        };
      }),
    { directory: QUICK_MATCH_LEAGUE_DIRECTORY, expected: expectedByLocale },
  );
  const report = {
    passed: locales.every(({ identical }) => identical),
    recordedAt: new Date().toISOString(),
    browser: await browser.version(),
    node: process.version,
    sourceSha256: createHash("sha256")
      .update(JSON.stringify({ directory: QUICK_MATCH_LEAGUE_DIRECTORY, expectedByLocale }))
      .digest("hex"),
    distinctGeneratedOrderVariants: QUICK_MATCH_COUNTRY_ORDER_VARIANTS.length,
    scope: "Exact native-option grouping and ordering parity; not a Lighthouse or FPS measurement.",
    locales,
  };
  const output = path.resolve(
    process.argv[2] ||
      path.join(root, "verification/quality-update-20261108/quick-selection-browser-order.json"),
  );
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
  if (!report.passed) process.exitCode = 1;
} finally {
  await browser?.close();
}
