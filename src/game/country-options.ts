import { searchKey } from "./club-discovery";
import type { League } from "./types";

function normalizeCountry(value: string): string {
  return searchKey(value).replace(/[-_]/g, " ").replace(/\s+/g, " ");
}

// A competition catalog mixes localized names and provider names. Build a
// conservative name index: ambiguous names are never assigned to a region.
const identities = new Map<string, string | null>();
const aliases = new Map<string, Set<string>>();
function addAlias(identity: string, name: string): void {
  const key = normalizeCountry(name);
  if (!key) return;
  const current = identities.get(key);
  if (current !== undefined && current !== identity) {
    identities.set(key, null);
    return;
  }
  identities.set(key, identity);
  const names = aliases.get(identity) ?? new Set<string>();
  names.add(key);
  aliases.set(identity, names);
}

if (typeof Intl.DisplayNames === "function") {
  const display = [
    new Intl.DisplayNames(["pt-BR"], { type: "region" }),
    new Intl.DisplayNames(["en"], { type: "region" }),
  ];
  for (let first = 65; first <= 90; first += 1) {
    for (let second = 65; second <= 90; second += 1) {
      const code = String.fromCharCode(first, second);
      // ICU recognizes historical aliases such as DD (East Germany) and FX
      // (Metropolitan France). Canonicalize before checking for collisions.
      const canonicalCode =
        typeof Intl.Locale === "function" ? (new Intl.Locale(`und-${code}`).region ?? code) : code;
      for (const names of display) {
        const name = names.of(code);
        if (name && name !== code) addAlias(`region:${canonicalCode}`, name);
      }
    }
  }
}

// Common provider spellings and football nations absent from ISO region names.
for (const [identity, names] of [
  ["nation:england", ["England", "Inglaterra"]],
  ["nation:scotland", ["Scotland", "Escócia"]],
  ["nation:wales", ["Wales", "País de Gales"]],
  ["nation:northern-ireland", ["Northern Ireland", "Irlanda do Norte"]],
  ["region:BR", ["Brazil", "Brasil"]],
  ["region:US", ["USA", "United States", "Estados Unidos"]],
  ["region:GB", ["Great Britain", "United Kingdom", "Reino Unido"]],
  ["region:NL", ["The Netherlands", "Netherlands", "Holanda"]],
  ["region:CZ", ["Czech Republic", "Czechia", "República Tcheca", "Tchéquia"]],
  ["region:BA", ["Bosnia", "Bosnia and Herzegovina", "Bósnia e Herzegovina"]],
  ["region:MK", ["Macedonia", "North Macedonia", "Macedônia do Norte"]],
  ["region:TR", ["Turkey", "Türkiye", "Turquia"]],
  ["region:CI", ["Ivory Coast", "Costa do Marfim"]],
  ["region:AE", ["Emirados Árabes", "United Arab Emirates"]],
  ["region:CD", ["DR Congo", "RD Congo"]],
] as const) {
  for (const name of names) addAlias(identity, name);
}

const NON_COUNTRIES = new Set(
  [
    "World",
    "Worldwide",
    "Mundo",
    "International",
    "Internacional",
    "Europe",
    "Europa",
    "Africa",
    "Asia",
    "Oceania",
    "North America",
    "South America",
  ].map(normalizeCountry),
);

/** Distinguish known football nations and otherwise retain the original name. */
export function countryIdentity(country: string): string {
  const key = normalizeCountry(country);
  return identities.get(key) ?? `name:${key}`;
}

export interface CountryOption {
  key: string;
  league: League;
}

/** Preserve league IDs used in saves; only collapse the display choices. */
export function countryOptions(leagues: readonly League[], query: string): CountryOption[] {
  const groups = new Map<string, { league: League; search: Set<string> }>();
  for (const league of leagues) {
    const name = normalizeCountry(league.country);
    if (!name || NON_COUNTRIES.has(name)) continue;
    const key = countryIdentity(league.country);
    let group = groups.get(key);
    if (!group) {
      group = { league, search: new Set(aliases.get(key)) };
      groups.set(key, group);
    }
    group.search.add(name);
  }
  const term = normalizeCountry(query);
  return [...groups.entries()]
    .filter(([, group]) => !term || [...group.search].some((name) => name.includes(term)))
    .map(([key, { league }]) => ({ key, league }))
    .sort(
      (a, b) =>
        Number(b.key === "region:BR") - Number(a.key === "region:BR") ||
        a.league.country.localeCompare(b.league.country, "pt-BR"),
    );
}
