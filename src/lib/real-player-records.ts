import type { RealPlayer } from "./realSquads";
import {
  identityText,
  providerName,
  realPlayerKeys,
  validBirthDate,
  verifiedPersonKey,
} from "../game/player-identity";

/** Stable local identity when the provider omitted an ID; never claims to be a provider ID. */
export function importedRecordId(row: RealPlayer): string {
  if (row.id) return row.id;
  const key =
    row.source_id && row.data_source
      ? `${row.data_source}:${row.source_id}`
      : JSON.stringify([row.name, row.birth_date || row.age, row.position, row.nationality]);
  let hash = 14695981039346656037n;
  for (const byte of new TextEncoder().encode(key))
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 1099511628211n);
  return `local-${hash.toString(16)}`;
}

/** Local caches and API payloads are untrusted. Preserve homonyms without a verified identity. */
export function normalizeRealPlayers(input: unknown, clubId: string): RealPlayer[] {
  if (!Array.isArray(input)) return [];
  const output: (RealPlayer | null)[] = [];
  const seen = new Map<string, number>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const name = identityText(raw.name);
    if (!name || name.length > 120 || !["GK", "DF", "MF", "FW"].includes(raw.position)) continue;
    const id = identityText(raw.id);
    if (raw.id != null && !id) continue;
    const source = providerName(raw.data_source);
    const external = identityText(raw.source_id);
    const birth = validBirthDate(raw.birth_date);
    const photo = identityText(raw.photo_url);
    const aliases = Array.isArray(raw.identity_aliases)
      ? raw.identity_aliases
          .filter(
            (k: unknown): k is string =>
              typeof k === "string" && k.length <= 512 && /^(record|provider):/.test(k),
          )
          .slice(0, 200)
      : [];
    const row: RealPlayer = {
      ...(id ? { id } : {}),
      ...(source ? { data_source: source } : {}),
      ...(external ? { source_id: external } : {}),
      ...(birth ? { birth_date: birth } : {}),
      name,
      position: raw.position,
      age: raw.age,
      shirt_number:
        Number.isInteger(raw.shirt_number) && raw.shirt_number > 0 && raw.shirt_number <= 99
          ? raw.shirt_number
          : null,
      nationality: identityText(raw.nationality) || null,
      overall: raw.overall,
      photo_url: /^https:\/\//.test(photo) ? photo : null,
      ...(aliases.length ? { identity_aliases: aliases } : {}),
    };
    const keys = id
      ? realPlayerKeys({ id, source, source_id: external, clubId, name, identity_aliases: aliases })
      : [];
    const person = source !== "generated-fictional" ? verifiedPersonKey(name, birth, clubId) : "";
    if (person) keys.push(person);
    // Exact transport duplicates without IDs are safe to collapse; name/age alone is not an ID.
    if (!keys.length) keys.push(`payload:${JSON.stringify(row)}`);
    const duplicates = [...new Set(keys.flatMap((key) => (seen.has(key) ? [seen.get(key)!] : [])))];
    const index = duplicates.length ? Math.min(...duplicates) : undefined;
    if (index === undefined) {
      const next = output.length;
      output.push(row);
      for (const key of keys) seen.set(key, next);
    } else {
      const first = output[index]!;
      const otherRows = duplicates.filter((i) => i !== index).map((i) => output[i]!);
      const mergedKeys = [...seen].filter(([, i]) => duplicates.includes(i)).map(([key]) => key);
      // Keep the first stable row identity, while retaining richer metadata and all source aliases.
      output[index] = {
        ...row,
        ...first,
        birth_date: first.birth_date || row.birth_date || null,
        nationality: first.nationality || row.nationality,
        photo_url: first.photo_url || row.photo_url,
        identity_aliases: [
          ...new Set([
            ...(first.identity_aliases ?? []),
            ...otherRows.flatMap((r) => r.identity_aliases ?? []),
            ...[...mergedKeys, ...keys].filter(
              (k) => !k.startsWith("person:") && !k.startsWith("payload:"),
            ),
          ]),
        ],
      };
      for (const [key, i] of seen) if (duplicates.includes(i)) seen.set(key, index);
      for (const i of duplicates) if (i !== index) output[i] = null;
      for (const key of keys) seen.set(key, index);
    }
  }
  return output.filter((row): row is RealPlayer => row !== null);
}
