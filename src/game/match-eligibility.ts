import type { Player } from "./types";

export type MatchEligibilityCode =
  | "lineup-count"
  | "invalid-player"
  | "club-mismatch"
  | "duplicate-id"
  | "goalkeeper"
  | "injury"
  | "suspension";

export interface MatchEligibilityFailure {
  code: MatchEligibilityCode;
  message: string;
}

export interface MatchEligibilityInput {
  clubId: unknown;
  players: unknown;
  bench?: unknown;
}

type MatchEligibilityReason =
  | "club-missing"
  | "lineup-count"
  | "bench-invalid"
  | "player-missing"
  | "player-id-invalid"
  | "duplicate-id"
  | "club-mismatch"
  | "availability-missing"
  | "availability-corrupt"
  | "injury"
  | "suspension"
  | "goalkeeper";

interface MatchEligibilityIssue {
  reason: MatchEligibilityReason;
  playerNumber?: number;
}

const FAILURE_DETAILS: Readonly<Record<MatchEligibilityReason, MatchEligibilityFailure>> = {
  "club-missing": {
    code: "club-mismatch",
    message: "Escalação inválida: o clube da partida não foi identificado.",
  },
  "lineup-count": {
    code: "lineup-count",
    message: "Escalação inválida: selecione exatamente 11 titulares antes de iniciar a partida.",
  },
  "bench-invalid": {
    code: "invalid-player",
    message:
      "Escalação inválida: o banco de reservas não está disponível. Abra o elenco e tente novamente.",
  },
  "player-missing": {
    code: "invalid-player",
    message:
      "Escalação inválida: o jogador {playerNumber} não existe mais no elenco. Abra o elenco e escolha novamente.",
  },
  "player-id-invalid": {
    code: "invalid-player",
    message:
      "Escalação inválida: o jogador {playerNumber} não tem um ID válido. Abra o elenco e escolha novamente.",
  },
  "duplicate-id": {
    code: "duplicate-id",
    message: "Escalação inválida: não repita jogadores entre titulares e banco de reservas.",
  },
  "club-mismatch": {
    code: "club-mismatch",
    message: "Escalação inválida: todos os jogadores devem pertencer ao clube da partida.",
  },
  "availability-missing": {
    code: "invalid-player",
    message:
      "Escalação inválida: faltam dados de disponibilidade de um jogador. Recarregue o elenco e tente novamente.",
  },
  "availability-corrupt": {
    code: "invalid-player",
    message:
      "Escalação inválida: a disponibilidade de um jogador está corrompida. Recarregue o elenco e tente novamente.",
  },
  injury: {
    code: "injury",
    message:
      "Escalação inválida: remova jogadores lesionados dos titulares antes de iniciar a partida.",
  },
  suspension: {
    code: "suspension",
    message:
      "Escalação inválida: remova jogadores suspensos dos titulares antes de iniciar a partida.",
  },
  goalkeeper: {
    code: "goalkeeper",
    message:
      "Escalação inválida: escale um goleiro entre os 11 titulares antes de iniciar a partida.",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function issue(reason: MatchEligibilityReason, playerNumber?: number): MatchEligibilityIssue {
  return playerNumber === undefined ? { reason } : { reason, playerNumber };
}

/** Lean admission core; it does not materialize user-facing message strings. */
function matchEligibilityIssue(input: unknown): MatchEligibilityIssue | null {
  if (!isRecord(input)) return issue("club-missing");

  const clubId = input["clubId"];
  if (typeof clubId !== "string" || !clubId.trim()) return issue("club-missing");

  const playersValue = input["players"];
  if (!Array.isArray(playersValue) || playersValue.length !== 11) return issue("lineup-count");
  const players: unknown[] = playersValue;

  const benchValue = input["bench"];
  if (benchValue !== undefined && !Array.isArray(benchValue)) return issue("bench-invalid");
  const bench: unknown[] = Array.isArray(benchValue) ? benchValue : [];
  const roster = [...players, ...bench];
  const ids = new Set<string>();
  let goalkeeper = false;

  for (const [index, raw] of roster.entries()) {
    if (!isRecord(raw)) return issue("player-missing", index + 1);

    const id = raw["id"];
    const playerClubId = raw["clubId"];
    if (typeof id !== "string" || !id.trim()) return issue("player-id-invalid", index + 1);
    if (ids.has(id)) return issue("duplicate-id");
    ids.add(id);
    if (playerClubId !== clubId) return issue("club-mismatch");

    const suspended = raw["suspended"];
    const injuryWeeks = raw["injuryWeeks"];
    if (
      typeof suspended !== "boolean" ||
      typeof injuryWeeks !== "number" ||
      !Number.isInteger(injuryWeeks)
    )
      return issue("availability-missing");
    if (injuryWeeks < 0) return issue("availability-corrupt");

    // Availability is a starter rule. A reserve can be carried in a save and
    // still be unavailable, but it can never be admitted through substitution
    // because the worker command validator checks the same player fields.
    if (index < players.length) {
      if (injuryWeeks !== 0) return issue("injury");
      if (suspended) return issue("suspension");
      if (raw["pos"] === "GK") goalkeeper = true;
    }
  }

  return goalkeeper ? null : issue("goalkeeper");
}

/**
 * Returns the first actionable reason a team cannot be admitted to a match.
 * This function never mutates or repairs the supplied roster.
 */
export function getMatchEligibilityFailure(
  input: MatchEligibilityInput | unknown,
): MatchEligibilityFailure | null {
  const failure = matchEligibilityIssue(input);
  if (!failure) return null;
  const details = FAILURE_DETAILS[failure.reason];
  return {
    code: details.code,
    message:
      failure.playerNumber === undefined
        ? details.message
        : details.message.replace("{playerNumber}", String(failure.playerNumber)),
  };
}

/** Pure boolean admission gate shared by all match setup boundaries. */
export function isMatchEligible(input: MatchEligibilityInput | unknown): boolean {
  return matchEligibilityIssue(input) === null;
}

export class MatchEligibilityError extends Error {
  readonly code: MatchEligibilityCode;

  constructor(failure: MatchEligibilityFailure) {
    super(failure.message);
    this.name = "MatchEligibilityError";
    this.code = failure.code;
  }
}

export function assertMatchEligible(
  input: MatchEligibilityInput | unknown,
): asserts input is MatchEligibilityInput {
  const invalid = getMatchEligibilityFailure(input);
  if (invalid) throw new MatchEligibilityError(invalid);
}

/** Convenience adapter for a career save without changing the save shape. */
export function careerMatchEligibilityInput(career: {
  clubId: unknown;
  lineup: unknown;
  bench?: unknown;
  players: unknown;
}): MatchEligibilityInput {
  const players = isRecord(career.players) ? career.players : {};
  const ids = Array.isArray(career.lineup) ? career.lineup : [];
  const benchIds = Array.isArray(career.bench) ? career.bench : [];
  return {
    clubId: career.clubId,
    players: ids.map((id) => (typeof id === "string" ? players[id] : undefined)),
    bench: benchIds.map((id) => (typeof id === "string" ? players[id] : undefined)),
  };
}

// Keep the imported Player type in this module's public surface useful to
// consumers without weakening the runtime gate to casts at call sites.
export type MatchPlayer = Player;
