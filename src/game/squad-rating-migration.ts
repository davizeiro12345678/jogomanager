import { buildLegacySquad, buildSquad } from "./squad";
import type { CareerState } from "./types";

const CORE = ["ovr", "pace", "shooting", "passing", "defending", "physical"] as const;

/** Only exact built-in fingerprints can be recalibrated. Transfers and edits survive. */
export function migrateSquadRatings(state: CareerState): CareerState {
  if (state.simulationRatingRevision === 1) return state;
  const old = new Map(buildLegacySquad(state.clubId).map((p) => [p.id, p]));
  const current = new Map(buildSquad(state.clubId).map((p) => [p.id, p]));
  let changed = 0;
  const players = { ...state.players };
  for (const p of Object.values(players)) {
    if (p.clubId !== state.clubId || p.rosterSource === "custom" || p.rosterSource === "imported")
      continue;
    const before = old.get(p.id),
      after = current.get(p.id);
    if (
      !before ||
      !after ||
      before.name !== p.name ||
      after.name !== p.name ||
      before.pos !== p.pos ||
      after.pos !== p.pos ||
      !CORE.every((key) => p[key] === before[key])
    )
      continue;
    if (CORE.every((key) => p[key] === after[key])) continue;
    const delta = after.ovr - p.ovr;
    players[p.id] = {
      ...p,
      ...Object.fromEntries(CORE.map((key) => [key, after[key]])),
      ...(p.potential === undefined
        ? {}
        : { potential: Math.max(after.ovr, Math.min(99, p.potential + delta)) }),
    };
    changed++;
  }
  return {
    ...state,
    players,
    simulationRatingRevision: 1,
    news: changed
      ? [
          {
            id: "squad-rating-calibration-v1",
            season: state.season,
            round: state.round,
            kind: "sistema",
            title: "Elenco reavaliado",
            body: `${changed} jogadores da base original receberam a nova avaliação de força. Histórico, contratos e jogadores editados ou importados foram preservados.`,
          },
          ...state.news,
        ]
      : state.news,
  };
}
