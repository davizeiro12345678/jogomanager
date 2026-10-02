import type { CareerState, Player } from "./types";
import { playerSourceKeys, verifiedPersonKey } from "./player-identity";

/** Merge only proven identity collisions; ordinary homonyms and custom athletes remain separate. */
export function repairPlayerIdentities(
  input: Record<string, Player>,
  lineup: string[],
  declaredIds = new Map<string, string>(),
) {
  const ids = Object.keys(input).sort();
  const parent = new Map(ids.map((id) => [id, id]));
  const root = (id: string): string => {
    const next = parent.get(id)!;
    if (next === id) return id;
    const found = root(next);
    parent.set(id, found);
    return found;
  };
  const seen = new Map<string, string>();
  for (const id of ids) {
    const p = input[id]!;
    const keys = playerSourceKeys(p).map((key) => `${p.clubId}:${key}`);
    const declared = declaredIds.get(id);
    if (declared) keys.push(`save:${p.clubId}:${declared}`);
    if (p.rosterSource === "imported") {
      const person = verifiedPersonKey(p.name, p.birthDate, p.clubId);
      if (person) keys.push(person);
    }
    for (const key of keys) {
      const previous = seen.get(key);
      if (previous) parent.set(root(id), root(previous));
      else seen.set(key, id);
    }
  }
  const groups = new Map<string, Player[]>();
  for (const id of ids) {
    const key = root(id);
    groups.set(key, [...(groups.get(key) ?? []), input[id]!]);
  }
  const players = { ...input };
  const aliases = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort(
      (a, b) =>
        Number(b.rosterSource === "custom") - Number(a.rosterSource === "custom") ||
        b.apps - a.apps ||
        b.goals + b.assists - (a.goals + a.assists) ||
        Number(lineup.includes(b.id)) - Number(lineup.includes(a.id)) ||
        a.id.localeCompare(b.id),
    );
    const keep = group[0]!;
    const metadata = group.find((p) => p.birthDate || p.photo || p.sourcePlayerId);
    players[keep.id] = {
      ...keep,
      ...(keep.sourcePlayerId || !metadata?.sourcePlayerId
        ? {}
        : { sourcePlayerId: metadata.sourcePlayerId }),
      ...(keep.sourceProvider || !metadata?.sourceProvider
        ? {}
        : { sourceProvider: metadata.sourceProvider }),
      ...(keep.sourceExternalId || !metadata?.sourceExternalId
        ? {}
        : { sourceExternalId: metadata.sourceExternalId }),
      ...(keep.birthDate || !metadata?.birthDate ? {} : { birthDate: metadata.birthDate }),
      ...(keep.photo || !group.some((p) => p.photo)
        ? {}
        : { photo: group.find((p) => p.photo)!.photo! }),
      sourceIdentityAliases: [...new Set(group.flatMap(playerSourceKeys))],
      // Two copies never double the career totals or clear an injury/suspension.
      apps: Math.max(...group.map((p) => p.apps)),
      goals: Math.max(...group.map((p) => p.goals)),
      assists: Math.max(...group.map((p) => p.assists)),
      yellows: Math.max(...group.map((p) => p.yellows)),
      injuryWeeks: Math.max(...group.map((p) => p.injuryWeeks)),
      suspended: group.some((p) => p.suspended),
    };
    for (const duplicate of group.slice(1)) {
      delete players[duplicate.id];
      aliases.set(duplicate.id, keep.id);
    }
  }
  return { players, aliases };
}

export function remapPlayerReferences(
  input: CareerState,
  aliases: Map<string, string>,
): CareerState {
  if (!aliases.size) return input;
  const map = (id: string) => aliases.get(id) ?? id;
  const list = (ids: string[]) => [...new Set(ids.map(map))];
  const remapRecord = <T extends object>(record: Record<string, T>): Record<string, T> => {
    const output = Object.fromEntries(Object.entries(record).filter(([id]) => !aliases.has(id)));
    for (const [id, value] of Object.entries(record)) {
      if (aliases.has(id)) output[map(id)] = { ...value, ...(output[map(id)] ?? {}) };
    }
    return output;
  };
  return {
    ...input,
    lineup: list(input.lineup ?? []),
    bench: list(input.bench ?? []),
    offers: (input.offers ?? []).map((o) => ({ ...o, playerId: map(o.playerId) })),
    scoutReports: (input.scoutReports ?? []).map((r) => ({ ...r, playerId: map(r.playerId) })),
    ...(input.promises ? { promises: input.promises.map((p) => ({ ...p, pid: map(p.pid) })) } : {}),
    ...(input.brokenPromises ? { brokenPromises: list(input.brokenPromises) } : {}),
    ...(input.rejectedOffers ? { rejectedOffers: list(input.rejectedOffers) } : {}),
    ...(input.attrDeltas ? { attrDeltas: remapRecord(input.attrDeltas) } : {}),
    ...(input.matchLog
      ? {
          matchLog: input.matchLog.map((match) => {
            const stats = new Map<string, (typeof match.players)[number]>();
            for (const stat of match.players) {
              const pid = map(stat.pid);
              const old = stats.get(pid);
              stats.set(
                pid,
                old
                  ? {
                      pid,
                      goals: Math.max(old.goals, stat.goals),
                      assists: Math.max(old.assists, stat.assists),
                      minutes: Math.max(old.minutes, stat.minutes),
                      rating: Math.max(old.rating, stat.rating),
                    }
                  : { ...stat, pid },
              );
            }
            return { ...match, players: [...stats.values()] };
          }),
        }
      : {}),
    ...(input.world
      ? {
          world: {
            ...input.world,
            relationships: remapRecord(input.world.relationships),
            memories: input.world.memories.map((m) =>
              m.playerId ? { ...m, playerId: map(m.playerId) } : m,
            ),
          },
        }
      : {}),
  };
}

/** Keep valid existing assignments; repair only repeated or invalid numbers within each club. */
export function repairShirtNumbers(input: Record<string, Player>): {
  players: Record<string, Player>;
  changed: number;
} {
  const reserved = new Map<string, Set<number>>();
  for (const p of Object.values(input)) {
    const set = reserved.get(p.clubId) ?? new Set<number>();
    if (Number.isInteger(p.number) && p.number >= 1 && p.number <= 99) set.add(p.number);
    reserved.set(p.clubId, set);
  }
  const assigned = new Map<string, Set<number>>();
  const players = { ...input };
  let changed = 0;
  for (const p of Object.values(input)) {
    const used = assigned.get(p.clubId) ?? new Set<number>();
    if (!Number.isInteger(p.number) || p.number < 1 || p.number > 99 || used.has(p.number)) {
      const available = Array.from({ length: 99 }, (_, i) => i + 1).find(
        (n) => !reserved.get(p.clubId)!.has(n),
      );
      if (available !== undefined) {
        players[p.id] = { ...p, number: available };
        reserved.get(p.clubId)!.add(available);
        changed++;
      }
    }
    used.add(players[p.id]!.number);
    assigned.set(p.clubId, used);
  }
  return { players, changed };
}
