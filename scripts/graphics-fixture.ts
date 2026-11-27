import { CLUBS } from "../src/game/data/leagues";
import { buildSquad } from "../src/game/squad";
import type { TeamSetup } from "../src/game/sim";
import {
  validMatchRulesRevision,
  type MatchRulesRevision,
} from "../src/game/match-execution-contract";

export interface GraphicsFixtureInit {
  type: "init";
  seed: string;
  manual: boolean;
  rulesRevision?: MatchRulesRevision;
}

export function graphicsFixtureRulesRevision(value: unknown = 1): MatchRulesRevision {
  if (!validMatchRulesRevision(value)) throw new RangeError("Unknown graphics rules revision");
  return value;
}

export function benchmarkTeam(clubId: string): TeamSetup {
  const club = CLUBS[clubId]!;
  return {
    clubId,
    name: club.name,
    short: club.short,
    primary: club.primary,
    secondary: club.secondary,
    players: buildSquad(clubId).slice(0, 11),
    tactics: { formation: "4-3-3", mentality: 2, pressing: 1, width: 1, tempo: 1 },
  };
}
