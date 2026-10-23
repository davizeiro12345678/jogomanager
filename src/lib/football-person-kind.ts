/** Provider roles must be checked before an unknown position falls back to midfield. */
const STAFF_ROLE =
  /(?:^|[^\p{L}])(?:coach|coaches|manager|staff|trainer|physio|physiotherapist|director|treinador|tecnico|auxiliar|preparador|massagista)(?:$|[^\p{L}])/u;

export function isNonPlayerRole(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const role = value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();
  return STAFF_ROLE.test(role);
}

/** Missing kind remains readable for historical player-only feeds; explicit staff never does. */
export function isPlayerRecord(row: {
  canonical_player_id?: unknown;
  source_kind?: unknown;
  sourceKind?: unknown;
  entity_kind?: unknown;
  raw_position?: unknown;
  rawPosition?: unknown;
  position?: unknown;
}): boolean {
  // Keep audit identities in storage while admitting only their canonical playable record.
  if (row.canonical_player_id != null) return false;
  for (const kind of [row.source_kind, row.sourceKind, row.entity_kind]) {
    if (
      kind != null &&
      (typeof kind !== "string" || !["player", "athlete"].includes(kind.trim().toLowerCase()))
    )
      return false;
  }
  return ![row.raw_position, row.rawPosition, row.position].some(isNonPlayerRole);
}
