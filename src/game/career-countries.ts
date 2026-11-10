import { searchKey } from "./club-discovery";
import type { League } from "./types";

type CountryLeague = Pick<League, "id" | "country" | "flag">;
type CountryOption = { id: string; country: string; search: string[] };

const labels = new Intl.DisplayNames("pt-BR", { type: "region", fallback: "none" });
const englishLabels = new Intl.DisplayNames("en", { type: "region", fallback: "none" });
const footballNations = {
  "gb-eng": "Inglaterra",
  "gb-sct": "Escócia",
  "gb-wls": "País de Gales",
  "gb-nir": "Irlanda do Norte",
} as const;
const countryAliases = new Map([
  ["england", "gb-eng"],
  ["inglaterra", "gb-eng"],
  ["scotland", "gb-sct"],
  ["escocia", "gb-sct"],
  ["wales", "gb-wls"],
  ["pais de gales", "gb-wls"],
  ["northern ireland", "gb-nir"],
  ["irlanda do norte", "gb-nir"],
  ["congo", "CG"],
  ["congo dr", "CD"],
  ["dr congo", "CD"],
  ["rd congo", "CD"],
]);
const international = new Set([
  "world",
  "europe",
  "international",
  "mundo",
  "europa",
  "internacional",
]);

export function countrySearchKey(value: string) {
  return searchKey(value)
    .replace(/[-\s]+/g, " ")
    .trim();
}

function flagRegion(flag: string) {
  const apiRegion = /^https:\/\/media\.api-sports\.io\/flags\/([a-z]{2})\.svg$/i.exec(flag)?.[1];
  if (apiRegion) return apiRegion.toUpperCase();
  if (!/^\p{Regional_Indicator}{2}$/u.test(flag)) return undefined;
  return String.fromCharCode(...[...flag].map((letter) => letter.codePointAt(0)! - 0x1f1e6 + 65));
}

function regionLabel(region: string, displayNames: Intl.DisplayNames) {
  if (Object.hasOwn(footballNations, region)) {
    return footballNations[region as keyof typeof footballNations];
  }
  return displayNames.of(region);
}

/** Project the catalog into selectable nationalities while keeping league IDs in saves. */
export function careerCountries(catalog: readonly CountryLeague[]): CountryOption[] {
  const names = new Map(countryAliases);
  const entries = catalog.map((league) => {
    const name = countrySearchKey(league.country);
    const region = countryAliases.get(name) ?? flagRegion(league.flag);
    if (region) {
      names.set(name, region);
      for (const displayNames of [labels, englishLabels]) {
        const label = regionLabel(region, displayNames);
        if (label) names.set(countrySearchKey(label), region);
      }
    }
    return { league, name, region };
  });
  const options = new Map<string, CountryOption>();
  for (const { league, name, region } of entries) {
    if (!name || international.has(name)) continue;
    const code = region ?? names.get(name);
    const key = code ?? name;
    let option = options.get(key);
    if (!option) {
      const country = (code && regionLabel(code, labels)) || league.country.trim();
      option = { id: league.id, country, search: [countrySearchKey(country)] };
      options.set(key, option);
    }
    if (!option.search.includes(name)) option.search.push(name);
  }
  return [...options.values()].sort(
    (a, b) =>
      Number(b.country === "Brasil") - Number(a.country === "Brasil") ||
      a.country.localeCompare(b.country, "pt-BR"),
  );
}
