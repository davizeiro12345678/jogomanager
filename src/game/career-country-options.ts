interface CountryIdentity {
  country: string;
  flag?: string | null;
}

const normalizeName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function regionForFlag(flag: string | null | undefined): string | undefined {
  if (typeof flag !== "string") return undefined;
  if (/^[a-z]{2}$/i.test(flag)) return flag.toLowerCase();
  const codepoints = [...flag].map((character) => character.codePointAt(0)!);
  if (
    codepoints.length === 2 &&
    codepoints.every((codepoint) => codepoint >= 0x1f1e6 && codepoint <= 0x1f1ff)
  )
    return String.fromCharCode(...codepoints.map((codepoint) => codepoint - 0x1f1e6 + 97));

  // API-Football stores the same region identity as a flag URL rather than
  // Unicode. Arbitrary image URLs and placeholder flags are not identities.
  const source =
    /^https:\/\/media\.api-sports\.io\/flags\/([a-z]{2}(?:-(?:eng|sct|wls|nir))?)\.svg$/i.exec(
      flag,
    );
  if (source) return source[1]!.toLowerCase();

  // England, Scotland and Wales use emoji tag sequences, not the GB flag.
  if (codepoints[0] === 0x1f3f4 && codepoints.at(-1) === 0xe007f) {
    const tag = String.fromCharCode(
      ...codepoints.slice(1, -1).map((codepoint) => codepoint - 0xe0000),
    );
    if (tag === "gbeng" || tag === "gbsct" || tag === "gbwls") return `gb-${tag.slice(2)}`;
  }
  return undefined;
}

function regionsByName(catalog: readonly CountryIdentity[]): Map<string, string | null> {
  const regions = new Map<string, string | null>();
  for (const league of catalog) {
    const region = regionForFlag(league.flag);
    if (!region) continue;
    const name = normalizeName(league.country);
    if (!regions.has(name)) regions.set(name, region);
    else if (regions.get(name) !== region) regions.set(name, null);
  }
  return regions;
}

function identityFor(
  league: CountryIdentity,
  regions?: ReadonlyMap<string, string | null>,
): string {
  const region = regionForFlag(league.flag) ?? regions?.get(normalizeName(league.country));
  return region ? `region:${region}` : `name:${normalizeName(league.country)}`;
}

/** Presentation identity only: persisted manager.country remains a league ID. */
export function careerCountryIdentity(
  league: CountryIdentity,
  catalog: readonly CountryIdentity[] = [],
): string {
  // Known flags are O(1). Only a missing flag needs the same-name catalog lookup.
  return identityFor(league, regionForFlag(league.flag) ? undefined : regionsByName(catalog));
}

/** Bundled entries arrive first and keep their IDs, labels and league objects. */
export function careerCountryOptions<T extends CountryIdentity>(
  catalog: readonly T[],
  query = "",
): T[] {
  const groups = new Map<string, { key: string; league: T; aliases: Set<string> }>();
  const regions = regionsByName(catalog);
  for (const league of catalog) {
    const key = identityFor(league, regions);
    const group = groups.get(key);
    if (group) group.aliases.add(normalizeName(league.country));
    else groups.set(key, { key, league, aliases: new Set([normalizeName(league.country)]) });
  }
  const search = normalizeName(query);
  const collator = new Intl.Collator("pt-BR");
  return [...groups.values()]
    .filter((group) => [...group.aliases].some((alias) => alias.includes(search)))
    .sort((a, b) => {
      const aBrazil = a.key === "region:br";
      const bBrazil = b.key === "region:br";
      return aBrazil !== bBrazil
        ? aBrazil
          ? -1
          : 1
        : collator.compare(a.league.country, b.league.country);
    })
    .map((group) => group.league);
}
