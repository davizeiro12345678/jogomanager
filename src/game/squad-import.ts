import type { RealPlayer } from "../lib/realSquads";
import type { Player, Position } from "./types";
import { buildSquad, completeSquad, SQUAD_SIZE } from "./squad";
import { importedRecordId, normalizeRealPlayers } from "../lib/real-player-records";

/** Consume each source record once, including records beyond the generated roster. */
export function applyImportedSquad(
  clubId: string,
  base: Player[],
  records: RealPlayer[],
): Player[] {
  const real = normalizeRealPlayers(records, clubId);
  if (!real.length) return base;
  const templates = base.length ? base : buildSquad(clubId);
  const available = [...templates];
  const takenNumbers = new Set<number>();
  const squad = real.map((r, index) => {
    const match = available.findIndex((p) => p.pos === r.position);
    const template =
      available.splice(match < 0 ? 0 : match, 1)[0] ??
      templates.find((p) => p.pos === r.position) ??
      templates[0]!;
    const wanted = r.shirt_number;
    const number =
      wanted && Number.isInteger(wanted) && wanted > 0 && wanted <= 99 && !takenNumbers.has(wanted)
        ? wanted
        : (Array.from({ length: 99 }, (_, i) => i + 1).find((n) => !takenNumbers.has(n)) ??
          index + 1);
    takenNumbers.add(number);
    return {
      ...template,
      id: `${clubId}-import-${importedRecordId(r)}`,
      clubId,
      name: r.name.trim(),
      pos: r.position as Position,
      age: Number.isFinite(r.age) && r.age >= 16 && r.age <= 45 ? r.age : template.age,
      number,
      rosterSource:
        r.data_source === "generated-fictional" ? ("generated" as const) : ("imported" as const),
      ...(r.id ? { sourcePlayerId: r.id } : {}),
      ...(r.data_source ? { sourceProvider: r.data_source } : {}),
      ...(r.source_id ? { sourceExternalId: r.source_id } : {}),
      ...(r.identity_aliases ? { sourceIdentityAliases: r.identity_aliases } : {}),
      ...(r.birth_date ? { birthDate: r.birth_date } : {}),
      ...(r.nationality ? { nationality: r.nationality } : {}),
      ...(r.photo_url ? { photo: r.photo_url } : {}),
    };
  });
  // Real registrations determine the size when available. Only missing depth is generated.
  return completeSquad(clubId, squad, Math.max(SQUAD_SIZE, real.length));
}
