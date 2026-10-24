export function flagRegion(flag: string): string | null {
  if (/^[a-z]{2}$/i.test(flag)) return flag.toUpperCase();
  const letters = Array.from(flag);
  if (
    letters.length === 2 &&
    letters.every((c) => c.codePointAt(0)! >= 0x1f1e6 && c.codePointAt(0)! <= 0x1f1ff)
  )
    return letters.map((c) => String.fromCharCode(c.codePointAt(0)! - 0x1f1e6 + 65)).join("");
  const match = flag.match(/\/flags\/([a-z]{2})\.(?:svg|png)(?:\?|$)/i);
  return match?.[1]?.toUpperCase() ?? null;
}
const key = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(?:and|e)\b/g, "")
    .replace(/[^a-z]/g, "");
/** Translate imported labels while retaining the established country's name. */
export function catalogCountryNames(preferred: readonly { country: string; flag: string }[]) {
  const names = new Map<string, string>(),
    aliases = new Map<string, string>();
  const english = new Intl.DisplayNames(["en"], { type: "region" });
  const portuguese = new Intl.DisplayNames(["pt-BR"], { type: "region" });
  const regionAliases = new Map<string, string>();
  const knownRegions = new Set<string>();
  for (const row of preferred) {
    const code = flagRegion(row.flag);
    if (!code || knownRegions.has(code)) continue;
    knownRegions.add(code);
    for (const label of [english.of(code), portuguese.of(code)])
      if (label) regionAliases.set(key(label), code);
  }
  for (const row of preferred) {
    // Older bundled entries can have a generic flag. Resolve their names
    // using incoming ISO evidence, while preserving the first bundled label.
    const code = flagRegion(row.flag) ?? regionAliases.get(key(row.country));
    if (code && !names.has(code)) names.set(code, row.country);
  }
  for (const [code, name] of names) {
    for (const alias of [name, english.of(code), portuguese.of(code)])
      if (alias) aliases.set(key(alias), name);
  }
  for (const [en, pt] of [
    ["England", "Inglaterra"],
    ["Scotland", "Escócia"],
    ["Wales", "País de Gales"],
    ["Northern Ireland", "Irlanda do Norte"],
  ])
    aliases.set(key(en!), pt!);
  return (country: string, flag: string) => {
    const code = flagRegion(flag);
    return (
      aliases.get(key(country)) ??
      (code ? (names.get(code) ?? portuguese.of(code)) : undefined) ??
      country
    );
  };
}
