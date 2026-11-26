import type { Side, SimPlayer } from "./sim-contracts";
import { defensiveLineX, FIELD_X, isOffside } from "./sim-rules";

export interface OffsidePhase {
  side: Side;
  kickerId: string;
  kickedAt: number;
  ballX: number;
  offsideIds: string[];
}

export interface OffsideRestart {
  kind: "throwIn" | "goalKick" | "corner";
  side: Side;
  takerId: string;
}

export interface IndirectKick {
  side: Side;
  takerId: string;
  awardedAt: number;
  kickedAt: number | null;
}

/** Internal recovery data, never proof of a match result or career progress. */
export interface MatchRulesStateV2 {
  version: 2;
  phase: OffsidePhase | null;
  restart: OffsideRestart | null;
  indirect: IndirectKick | null;
}

export function emptyMatchRulesState(): MatchRulesStateV2 {
  return { version: 2, phase: null, restart: null, indirect: null };
}

/** Capture the touch, not where a runner/defender will be at receipt. */
export function captureOffsidePhase(
  players: readonly SimPlayer[],
  kicker: SimPlayer,
  kickedAt: number,
  ballX: number,
): OffsidePhase {
  const dir = kicker.side === "home" ? 1 : -1;
  const defenderLine = defensiveLineX(players, kicker.side, 2);
  const line = dir === 1 ? Math.max(defenderLine, ballX) : Math.min(defenderLine, ballX);
  const offsideIds: string[] = [];
  for (const player of players) {
    if (
      player.side === kicker.side &&
      player.id !== kicker.id &&
      !player.sentOff &&
      isOffside(player.x, line, dir)
    ) {
      // A match has at most eleven athletes per side. Keep recovery bounded
      // even if an internal caller violates the roster contract.
      if (offsideIds.length === 11) throw new RangeError("Invalid match rules state roster");
      offsideIds.push(player.id);
    }
  }
  return { side: kicker.side, kickerId: kicker.id, kickedAt, ballX, offsideIds };
}

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
};
const side = (value: unknown): value is Side => value === "home" || value === "away";

/** Validate before committing a checkpoint, including its historical roster IDs.
 * Membership/shape checks do not authenticate a client-authored checkpoint. */
export function restoreMatchRulesState(
  value: unknown,
  players: readonly SimPlayer[],
  substitutes: unknown,
  time: number,
  holder: unknown,
): MatchRulesStateV2 {
  const fail = (): never => {
    throw new Error("Invalid match rules state");
  };
  if (
    !object(value) ||
    !exact(value, ["version", "phase", "restart", "indirect"]) ||
    value["version"] !== 2 ||
    !Array.isArray(substitutes) ||
    substitutes.length > 10
  )
    return fail();
  const roster = new Map<string, Side>();
  for (const player of [...players, ...substitutes]) {
    if (
      !object(player) ||
      typeof player["id"] !== "string" ||
      player["id"].length > 240 ||
      !side(player["side"]) ||
      typeof player["sentOff"] !== "boolean" ||
      !player["id"].startsWith(`${player["side"]}-`) ||
      roster.has(player["id"])
    )
      return fail();
    roster.set(player["id"], player["side"]);
  }
  const activeIds = new Set(players.filter((player) => !player.sentOff).map((player) => player.id));
  const rawPhase = value["phase"];
  let phase: OffsidePhase | null = null;
  if (rawPhase !== null) {
    if (
      !object(rawPhase) ||
      !exact(rawPhase, ["side", "kickerId", "kickedAt", "ballX", "offsideIds"]) ||
      !side(rawPhase["side"]) ||
      typeof rawPhase["kickerId"] !== "string" ||
      roster.get(rawPhase["kickerId"]) !== rawPhase["side"] ||
      typeof rawPhase["kickedAt"] !== "number" ||
      !Number.isFinite(rawPhase["kickedAt"]) ||
      rawPhase["kickedAt"] < 0 ||
      rawPhase["kickedAt"] > time ||
      typeof rawPhase["ballX"] !== "number" ||
      !Number.isFinite(rawPhase["ballX"]) ||
      Math.abs(rawPhase["ballX"]) > FIELD_X + 2 ||
      !Array.isArray(rawPhase["offsideIds"]) ||
      rawPhase["offsideIds"].length > 11
    )
      return fail();
    const ids = new Set<string>();
    for (const id of rawPhase["offsideIds"]) {
      if (
        typeof id !== "string" ||
        id === rawPhase["kickerId"] ||
        roster.get(id) !== rawPhase["side"] ||
        ids.has(id)
      )
        return fail();
      ids.add(id);
    }
    phase = {
      side: rawPhase["side"],
      kickerId: rawPhase["kickerId"],
      kickedAt: rawPhase["kickedAt"],
      ballX: rawPhase["ballX"],
      offsideIds: [...ids],
    };
  }
  const rawRestart = value["restart"];
  let restart: OffsideRestart | null = null;
  if (rawRestart !== null) {
    if (
      !object(rawRestart) ||
      !exact(rawRestart, ["side", "kind", "takerId"]) ||
      !side(rawRestart["side"]) ||
      !["throwIn", "goalKick", "corner"].includes(rawRestart["kind"] as string) ||
      typeof rawRestart["takerId"] !== "string" ||
      rawRestart["takerId"] !== holder ||
      !activeIds.has(rawRestart["takerId"]) ||
      roster.get(rawRestart["takerId"]) !== rawRestart["side"] ||
      phase !== null
    )
      return fail();
    restart = {
      side: rawRestart["side"],
      kind: rawRestart["kind"] as OffsideRestart["kind"],
      takerId: rawRestart["takerId"],
    };
  }
  const rawIndirect = value["indirect"];
  let indirect: IndirectKick | null = null;
  if (rawIndirect !== null) {
    if (
      !object(rawIndirect) ||
      !exact(rawIndirect, ["side", "takerId", "awardedAt", "kickedAt"]) ||
      !side(rawIndirect["side"]) ||
      typeof rawIndirect["takerId"] !== "string" ||
      roster.get(rawIndirect["takerId"]) !== rawIndirect["side"] ||
      typeof rawIndirect["awardedAt"] !== "number" ||
      !Number.isFinite(rawIndirect["awardedAt"]) ||
      rawIndirect["awardedAt"] < 0 ||
      rawIndirect["awardedAt"] > time ||
      restart !== null ||
      (rawIndirect["kickedAt"] === null
        ? holder !== rawIndirect["takerId"] ||
          !activeIds.has(rawIndirect["takerId"]) ||
          phase !== null
        : typeof rawIndirect["kickedAt"] !== "number" ||
          !Number.isFinite(rawIndirect["kickedAt"]) ||
          rawIndirect["kickedAt"] < rawIndirect["awardedAt"] ||
          rawIndirect["kickedAt"] > time) ||
      (phase !== null && phase.kickerId !== rawIndirect["takerId"])
    )
      return fail();
    indirect = {
      side: rawIndirect["side"],
      takerId: rawIndirect["takerId"],
      awardedAt: rawIndirect["awardedAt"],
      kickedAt: rawIndirect["kickedAt"] as number | null,
    };
  }
  return { version: 2, phase, restart, indirect };
}
