import type { CareerState, Player } from "./types";
import { playerSourceKeys, verifiedPersonKey } from "./player-identity";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function recordArray<T extends object>(value: unknown): T[] {
  return Array.isArray(value) ? (value.filter(isRecord) as T[]) : [];
}

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
  const list = (ids: unknown) => [
    ...new Set(
      (Array.isArray(ids) ? ids : []).filter((id): id is string => typeof id === "string").map(map),
    ),
  ];
  const remapRecord = <T extends object>(record: unknown): Record<string, T> => {
    const source = isRecord(record) ? record : {};
    const output: Record<string, T> = {};
    for (const [id, value] of Object.entries(source)) {
      if (!isRecord(value)) continue;
      if (!aliases.has(id)) output[id] = value as T;
      else output[map(id)] = { ...(output[map(id)] ?? ({} as T)), ...value } as T;
    }
    return output;
  };
  const offers = recordArray<CareerState["offers"][number]>(input.offers)
    .filter((offer) => typeof offer.playerId === "string")
    .map((offer) => ({ ...offer, playerId: map(offer.playerId) }));
  const scoutReports = recordArray<CareerState["scoutReports"][number]>(input.scoutReports)
    .filter((report) => typeof report.playerId === "string")
    .map((report) => ({ ...report, playerId: map(report.playerId) }));
  const promises = recordArray<NonNullable<CareerState["promises"]>[number]>(input.promises)
    .filter((promise) => typeof promise.pid === "string")
    .map((promise) => ({ ...promise, pid: map(promise.pid) }));
  const matchLog = recordArray<NonNullable<CareerState["matchLog"]>[number]>(
    input.matchLog,
  ).flatMap((match) => {
    const stats = new Map<
      string,
      NonNullable<CareerState["matchLog"]>[number]["players"][number]
    >();
    for (const stat of recordArray<NonNullable<CareerState["matchLog"]>[number]["players"][number]>(
      match.players,
    )) {
      if (typeof stat.pid !== "string") continue;
      const pid = map(stat.pid);
      const finite = (value: unknown) =>
        typeof value === "number" && Number.isFinite(value) ? value : 0;
      const normalized = {
        ...stat,
        pid,
        goals: finite(stat.goals),
        assists: finite(stat.assists),
        minutes: finite(stat.minutes),
        rating: finite(stat.rating),
      };
      const old = stats.get(pid);
      stats.set(
        pid,
        old
          ? {
              ...normalized,
              goals: Math.max(old.goals, normalized.goals),
              assists: Math.max(old.assists, normalized.assists),
              minutes: Math.max(old.minutes, normalized.minutes),
              rating: Math.max(old.rating, normalized.rating),
            }
          : normalized,
      );
    }
    return [{ ...match, players: [...stats.values()] }];
  });
  const world = isRecord(input.world)
    ? ({
        ...input.world,
        relationships: remapRecord(input.world.relationships),
        memories: recordArray<NonNullable<CareerState["world"]>["memories"][number]>(
          input.world.memories,
        ).map((memory) =>
          typeof memory.playerId === "string"
            ? { ...memory, playerId: map(memory.playerId) }
            : memory,
        ),
      } as CareerState["world"])
    : undefined;
  return {
    ...input,
    lineup: list(input.lineup),
    bench: list(input.bench),
    offers,
    scoutReports,
    ...(input.promises !== undefined ? { promises } : {}),
    ...(input.brokenPromises !== undefined ? { brokenPromises: list(input.brokenPromises) } : {}),
    ...(input.rejectedOffers !== undefined ? { rejectedOffers: list(input.rejectedOffers) } : {}),
    ...(input.attrDeltas !== undefined ? { attrDeltas: remapRecord(input.attrDeltas) } : {}),
    ...(input.matchLog !== undefined ? { matchLog } : {}),
    ...(world ? { world } : {}),
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
