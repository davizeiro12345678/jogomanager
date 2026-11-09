import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";

import { LEAGUES } from "../src/game/data/leagues";
import { RUNTIME_APPROVED_LOCALES } from "../src/i18n/locale-runtime-manifest";

const defaultLeague = LEAGUES[0];
if (!defaultLeague || defaultLeague.clubs.length < 2) {
  throw new Error("The quick-match default league must contain at least two clubs.");
}

const directory = LEAGUES.map(({ id, name, country }) => ({ id, name, country }));
const countries = new Map<string, number[]>();
directory.forEach(({ country }, index) => {
  const indices = countries.get(country);
  if (indices) indices.push(index);
  else countries.set(country, [index]);
});
const countryNames = [...countries.keys()];
const countryOrders: number[][] = [];
const orderIndices = new Map<string, number>();
const localeOrders = Object.fromEntries(
  RUNTIME_APPROVED_LOCALES.map((lang) => {
    const compare = new Intl.Collator(lang).compare;
    const order = countryNames
      .map((_, index) => index)
      .sort((a, b) => {
        const first = countryNames[a]!;
        const second = countryNames[b]!;
        return first === "Brasil" ? -1 : second === "Brasil" ? 1 : compare(first, second);
      });
    const key = order.join(",");
    let variant = orderIndices.get(key);
    if (variant === undefined) {
      variant = countryOrders.length;
      countryOrders.push(order);
      orderIndices.set(key, variant);
    }
    return [lang, variant];
  }),
);
const catalog = {
  directory,
  defaultLeague,
  countryGroups: [...countries.values()],
  countryOrders,
  localeOrders,
};
const contents = `import type { League } from "../types";
import type { RuntimeApprovedLang } from "../../i18n/locale-runtime-manifest";

export type QuickMatchLeagueSummary = Pick<League, "id" | "name" | "country">;

const catalog = ${JSON.stringify(catalog, null, 2)} satisfies {
  directory: QuickMatchLeagueSummary[];
  defaultLeague: League;
  countryGroups: number[][];
  countryOrders: number[][];
  localeOrders: Record<RuntimeApprovedLang, number>;
};

export const QUICK_MATCH_LEAGUE_DIRECTORY = catalog.directory;
export const DEFAULT_QUICK_MATCH_LEAGUE = catalog.defaultLeague;
export const QUICK_MATCH_COUNTRY_GROUPS = catalog.countryGroups;
export const QUICK_MATCH_COUNTRY_ORDER_VARIANTS = catalog.countryOrders;
export const QUICK_MATCH_LOCALE_ORDER_VARIANT = catalog.localeOrders;
`;
const output = new URL("../src/game/data/quick-match-catalog.ts", import.meta.url);
const outputPath = fileURLToPath(output);
const options = await prettier.resolveConfig(outputPath);
const formatted = await prettier.format(contents, { ...(options ?? {}), filepath: outputPath });
writeFileSync(outputPath, formatted);
console.log(
  `Wrote ${directory.length} league summaries and ${countryOrders.length} country-order variants for ${RUNTIME_APPROVED_LOCALES.length} locales to ${outputPath}`,
);
