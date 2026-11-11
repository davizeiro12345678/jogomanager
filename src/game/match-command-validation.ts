import type { LiveWorkerRequest } from "./live-match";
import type { LiveWorkerRequest } from "./live-match";
import { validMatchRulesRevision } from "./match-execution-contract";
import type { LiveWorkerRequest } from "./live-match";

export const MAX_MATCH_BENCH_PLAYERS = 64;
export const LIVE_CONTROL_RESPONSE_TIMEOUT_MS = 3_000;
const MAX_EVALUATION_TIME = 8_640_000_000_000_000;

/** JavaScript dates accept at most this many milliseconds from the epoch. */
export const validCareerEvaluationTime = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= MAX_EVALUATION_TIME;

/** Validate commands once at the worker boundary, never in the simulation tick. */
const FORMS = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1"];
const WEATHER = ["clear", "rain", "heat"];
const RESERVED = new Set(["__proto__", "constructor", "prototype"]);
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const text = (v: unknown, max: number): v is string => {
  if (typeof v !== "string" || v.length < 1 || v.length > max) return false;
  for (let index = 0; index < v.length; index++) if (v.charCodeAt(index) < 32) return false;
  return true;
};
const id = (v: unknown): v is string => text(v, 160) && !RESERVED.has(v);
const integer = (v: unknown, min: number, max: number) =>
  finite(v, min, max) && Number.isSafeInteger(v);
const side = (v: unknown) => v === "home" || v === "away";
const validControlExpiry = (value: unknown) =>
  validCareerEvaluationTime(value) && value <= Date.now() + LIVE_CONTROL_RESPONSE_TIMEOUT_MS;

export function validMatchTactics(v: unknown): boolean {
  return (
    object(v) &&
    FORMS.includes(v["formation"] as string) &&
    integer(v["mentality"], 0, 4) &&
    integer(v["pressing"], 0, 2) &&
    integer(v["width"], 0, 2) &&
    integer(v["tempo"], 0, 2)
  );
}

export function validMatchPlayer(v: unknown): boolean {
  return (
    object(v) &&
    id(v["id"]) &&
    id(v["clubId"]) &&
    text(v["name"], 240) &&
    ["GK", "DF", "MF", "FW"].includes(v["pos"] as string) &&
    ["ovr", "pace", "shooting", "passing", "defending", "physical", "condition", "morale"].every(
      (key) => finite(v[key], 0, 100),
    ) &&
    typeof v["suspended"] === "boolean" &&
    integer(v["injuryWeeks"], 0, 104)
  );
}

export function validMatchTeam(v: unknown): boolean {
  if (
    !object(v) ||
    !text(v["name"], 240) ||
    !validMatchTactics(v["tactics"]) ||
    !Array.isArray(v["players"]) ||
    v["players"].length !== 11 ||
    (v["bench"] !== undefined &&
      (!Array.isArray(v["bench"]) || v["bench"].length > MAX_MATCH_BENCH_PLAYERS)) ||
    (v["morale"] !== undefined && !finite(v["morale"], 0, 100)) ||
import type { LiveWorkerRequest } from "./live-match";

export const MAX_MATCH_BENCH_PLAYERS = 64;
export const LIVE_CONTROL_RESPONSE_TIMEOUT_MS = 3_000;
const MAX_EVALUATION_TIME = 8_640_000_000_000_000;

/** JavaScript dates accept at most this many milliseconds from the epoch. */
export const validCareerEvaluationTime = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= MAX_EVALUATION_TIME;

/** Validate commands once at the worker boundary, never in the simulation tick. */
const FORMS = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1"];
const WEATHER = ["clear", "rain", "heat"];
const RESERVED = new Set(["__proto__", "constructor", "prototype"]);
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const text = (v: unknown, max: number): v is string => {
  if (typeof v !== "string" || v.length < 1 || v.length > max) return false;
  for (let index = 0; index < v.length; index++) if (v.charCodeAt(index) < 32) return false;
  return true;
};
const id = (v: unknown): v is string => text(v, 160) && !RESERVED.has(v);
const integer = (v: unknown, min: number, max: number) =>
  finite(v, min, max) && Number.isSafeInteger(v);
const side = (v: unknown) => v === "home" || v === "away";
const validControlExpiry = (value: unknown) =>
  validCareerEvaluationTime(value) && value <= Date.now() + LIVE_CONTROL_RESPONSE_TIMEOUT_MS;

export function validMatchTactics(v: unknown): boolean {
  return (
    object(v) &&
    FORMS.includes(v["formation"] as string) &&
    integer(v["mentality"], 0, 4) &&
    integer(v["pressing"], 0, 2) &&
    integer(v["width"], 0, 2) &&
    integer(v["tempo"], 0, 2)
  );
}

export function validMatchPlayer(v: unknown): boolean {
  return (
    object(v) &&
    id(v["id"]) &&
    id(v["clubId"]) &&
    text(v["name"], 240) &&
    ["GK", "DF", "MF", "FW"].includes(v["pos"] as string) &&
    ["ovr", "pace", "shooting", "passing", "defending", "physical", "condition", "morale"].every(
      (key) => finite(v[key], 0, 100),
    ) &&
    typeof v["suspended"] === "boolean" &&
    integer(v["injuryWeeks"], 0, 104)
  );
}

export function validMatchTeam(v: unknown): boolean {
  if (
    !object(v) ||
    !text(v["name"], 240) ||
    !validMatchTactics(v["tactics"]) ||
    !Array.isArray(v["players"]) ||
    v["players"].length !== 11 ||
    (v["bench"] !== undefined &&
      (!Array.isArray(v["bench"]) || v["bench"].length > MAX_MATCH_BENCH_PLAYERS)) ||
    (v["morale"] !== undefined && !finite(v["morale"], 0, 100)) ||
    (v["cpu"] !== undefined && typeof v["cpu"] !== "boolean") ||
    (v["tacticalAiRevision"] !== undefined && v["tacticalAiRevision"] !== 2)
  )
    return false;
  const roster = [...v["players"], ...((v["bench"] ?? []) as unknown[])];
  const ids = new Set<string>();
  let goalkeeper = false;
  return (
    roster.every((player, index) => {
      if (!validMatchPlayer(player)) return false;
      const p = player as Record<string, unknown>;
      if (ids.has(p["id"] as string)) return false;
      ids.add(p["id"] as string);
      if (index < 11) {
        // validMatchPlayer already constrains both fields to their valid types and ranges.
        if (p["suspended"] || p["injuryWeeks"]) return false;
        goalkeeper ||= p["pos"] === "GK";
      }
      return p["clubId"] === v["clubId"];
    }) && goalkeeper
  );
}

type CareerEnvelope = {
  clubId: string;
  players: Record<string, unknown>;
};

function validCareerEnvelope(
  v: unknown,
  options: { allowUnavailableLineup?: boolean } = {},
): v is CareerEnvelope {
  if (!object(v)) return false;
  const clubId = v["clubId"];
  const players = v["players"];
  const fixtures = v["fixtures"];
  const lineup = v["lineup"];
  const finances = v["finances"];
  if (
    !id(clubId) ||
  )
    return false;
  const roster = [...v["players"], ...((v["bench"] ?? []) as unknown[])];
  const ids = new Set<string>();
  let goalkeeper = false;
  return (
    roster.every((player, index) => {
      if (!validMatchPlayer(player)) return false;
      const p = player as Record<string, unknown>;
      if (ids.has(p["id"] as string)) return false;
      ids.add(p["id"] as string);
      if (index < 11) {
        // validMatchPlayer already constrains both fields to their valid types and ranges.
        if (p["suspended"] || p["injuryWeeks"]) return false;
        goalkeeper ||= p["pos"] === "GK";
      }
      return p["clubId"] === v["clubId"];
    }) && goalkeeper
  );
}

type CareerEnvelope = {
  clubId: string;
  players: Record<string, unknown>;
};

function validCareerEnvelope(
  v: unknown,
  options: { allowUnavailableLineup?: boolean } = {},
): v is CareerEnvelope {
  if (!object(v)) return false;
  const clubId = v["clubId"];
  const players = v["players"];
  const fixtures = v["fixtures"];
  const lineup = v["lineup"];
  const finances = v["finances"];
  if (
    !id(clubId) ||
    (v["matchRulesRevision"] !== undefined && !validMatchRulesRevision(v["matchRulesRevision"])) ||
import type { LiveWorkerRequest } from "./live-match";

export const MAX_MATCH_BENCH_PLAYERS = 64;
export const LIVE_CONTROL_RESPONSE_TIMEOUT_MS = 3_000;
const MAX_EVALUATION_TIME = 8_640_000_000_000_000;

/** JavaScript dates accept at most this many milliseconds from the epoch. */
export const validCareerEvaluationTime = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= MAX_EVALUATION_TIME;

/** Validate commands once at the worker boundary, never in the simulation tick. */
const FORMS = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1"];
const WEATHER = ["clear", "rain", "heat"];
const RESERVED = new Set(["__proto__", "constructor", "prototype"]);
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const text = (v: unknown, max: number): v is string => {
  if (typeof v !== "string" || v.length < 1 || v.length > max) return false;
  for (let index = 0; index < v.length; index++) if (v.charCodeAt(index) < 32) return false;
  return true;
};
const id = (v: unknown): v is string => text(v, 160) && !RESERVED.has(v);
const integer = (v: unknown, min: number, max: number) =>
  finite(v, min, max) && Number.isSafeInteger(v);
const side = (v: unknown) => v === "home" || v === "away";
const validControlExpiry = (value: unknown) =>
  validCareerEvaluationTime(value) && value <= Date.now() + LIVE_CONTROL_RESPONSE_TIMEOUT_MS;

export function validMatchTactics(v: unknown): boolean {
  return (
    object(v) &&
    FORMS.includes(v["formation"] as string) &&
    integer(v["mentality"], 0, 4) &&
    integer(v["pressing"], 0, 2) &&
    integer(v["width"], 0, 2) &&
    integer(v["tempo"], 0, 2)
  );
}

export function validMatchPlayer(v: unknown): boolean {
  return (
    object(v) &&
    id(v["id"]) &&
    id(v["clubId"]) &&
    text(v["name"], 240) &&
    ["GK", "DF", "MF", "FW"].includes(v["pos"] as string) &&
    ["ovr", "pace", "shooting", "passing", "defending", "physical", "condition", "morale"].every(
      (key) => finite(v[key], 0, 100),
    ) &&
    typeof v["suspended"] === "boolean" &&
    integer(v["injuryWeeks"], 0, 104)
  );
}

export function validMatchTeam(v: unknown): boolean {
  if (
    !object(v) ||
    !text(v["name"], 240) ||
    !validMatchTactics(v["tactics"]) ||
    !Array.isArray(v["players"]) ||
    v["players"].length !== 11 ||
    (v["bench"] !== undefined &&
      (!Array.isArray(v["bench"]) || v["bench"].length > MAX_MATCH_BENCH_PLAYERS)) ||
    (v["morale"] !== undefined && !finite(v["morale"], 0, 100)) ||
    (v["cpu"] !== undefined && typeof v["cpu"] !== "boolean")
  )
    return false;
  const roster = [...v["players"], ...((v["bench"] ?? []) as unknown[])];
  const ids = new Set<string>();
  let goalkeeper = false;
  return (
    roster.every((player, index) => {
      if (!validMatchPlayer(player)) return false;
      const p = player as Record<string, unknown>;
      if (ids.has(p["id"] as string)) return false;
      ids.add(p["id"] as string);
      if (index < 11) {
        // validMatchPlayer already constrains both fields to their valid types and ranges.
        if (p["suspended"] || p["injuryWeeks"]) return false;
        goalkeeper ||= p["pos"] === "GK";
      }
      return p["clubId"] === v["clubId"];
    }) && goalkeeper
  );
}

type CareerEnvelope = {
  clubId: string;
  players: Record<string, unknown>;
};

function validCareerEnvelope(
  v: unknown,
  options: { allowUnavailableLineup?: boolean } = {},
): v is CareerEnvelope {
  if (!object(v)) return false;
  const clubId = v["clubId"];
  const players = v["players"];
  const fixtures = v["fixtures"];
  const lineup = v["lineup"];
  const finances = v["finances"];
  if (
    !id(clubId) ||
    !integer(v["round"], 1, 1000) ||
    !integer(v["season"], 1, 10000) ||
    !object(players) ||
    Object.keys(players).length > 30000 ||
    !Array.isArray(fixtures) ||
    fixtures.length > 30000 ||
    !Array.from(fixtures).every(object) ||
    !Array.isArray(lineup) ||
    lineup.length !== 11 ||
    !object(finances) ||
    !finite(finances["budget"], -1e9, 1e9) ||
    !finite(finances["spent"], 0, 1e9) ||
    !finite(finances["income"], 0, 1e9)
  )
    return false;

  const playerIds = new Set<string>();
  let goalkeeper = false;
  for (const lineupId of lineup) {
    if (!id(lineupId)) return false;
    if (!Object.hasOwn(players, lineupId)) return false;
    const player = players[lineupId];
    if (!object(player)) return false;
    const playerId = player["id"];
    if (
      !id(playerId) ||
      playerId !== lineupId ||
      playerIds.has(playerId) ||
      player["clubId"] !== clubId ||
      typeof player["suspended"] !== "boolean" ||
      !integer(player["injuryWeeks"], 0, 104) ||
      (!options.allowUnavailableLineup &&
        (player["suspended"] !== false || player["injuryWeeks"] !== 0))
    )
      return false;
    playerIds.add(playerId);
    if (player["pos"] === "GK") goalkeeper = true;
  }
  return goalkeeper;
}

function validCareerPerformance(
  v: unknown,
  career: CareerEnvelope,
  seenPids: Set<string>,
): boolean {
  if (!object(v) || !id(v["pid"]) || seenPids.has(v["pid"])) return false;
  const pid = v["pid"];
  if (!Object.hasOwn(career.players, pid)) return false;
  const player = career.players[pid];
  if (!object(player) || player["id"] !== pid || player["clubId"] !== career.clubId) return false;
  seenPids.add(pid);
  return (
    integer(v["goals"], 0, 50) &&
    integer(v["assists"], 0, 50) &&
    typeof v["played"] === "boolean" &&
    (v["minutes"] === undefined || finite(v["minutes"], 0, 150)) &&
    (v["rating"] === undefined || finite(v["rating"], 0, 10)) &&
    (v["yellow"] === undefined || integer(v["yellow"], 0, 2)) &&
    (v["red"] === undefined || typeof v["red"] === "boolean") &&
    (v["injuryWeeks"] === undefined || integer(v["injuryWeeks"], 0, 104))
  );
}

/** A structural guard, not a claim that a personal career is server-attested. */
export function validMatchCommand(v: unknown): v is LiveWorkerRequest {
  if (!object(v) || !integer(v["id"], 0, Number.MAX_SAFE_INTEGER)) return false;
  switch (v["type"]) {
    case "startLive":
    case "simulate":
      return (
        validMatchTeam(v["home"]) &&
        validMatchTeam(v["away"]) &&
        text(v["seed"], 4096) &&
import type { LiveWorkerRequest } from "./live-match";

export const MAX_MATCH_BENCH_PLAYERS = 64;
export const LIVE_CONTROL_RESPONSE_TIMEOUT_MS = 3_000;
const MAX_EVALUATION_TIME = 8_640_000_000_000_000;

/** JavaScript dates accept at most this many milliseconds from the epoch. */
export const validCareerEvaluationTime = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= MAX_EVALUATION_TIME;

/** Validate commands once at the worker boundary, never in the simulation tick. */
const FORMS = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1"];
const WEATHER = ["clear", "rain", "heat"];
const RESERVED = new Set(["__proto__", "constructor", "prototype"]);
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const text = (v: unknown, max: number): v is string => {
  if (typeof v !== "string" || v.length < 1 || v.length > max) return false;
  for (let index = 0; index < v.length; index++) if (v.charCodeAt(index) < 32) return false;
  return true;
};
const id = (v: unknown): v is string => text(v, 160) && !RESERVED.has(v);
const integer = (v: unknown, min: number, max: number) =>
  finite(v, min, max) && Number.isSafeInteger(v);
const side = (v: unknown) => v === "home" || v === "away";
const validControlExpiry = (value: unknown) =>
  validCareerEvaluationTime(value) && value <= Date.now() + LIVE_CONTROL_RESPONSE_TIMEOUT_MS;

export function validMatchTactics(v: unknown): boolean {
  return (
    object(v) &&
    FORMS.includes(v["formation"] as string) &&
    integer(v["mentality"], 0, 4) &&
    integer(v["pressing"], 0, 2) &&
    integer(v["width"], 0, 2) &&
    integer(v["tempo"], 0, 2)
  );
}

export function validMatchPlayer(v: unknown): boolean {
  return (
    object(v) &&
    id(v["id"]) &&
    id(v["clubId"]) &&
    text(v["name"], 240) &&
    ["GK", "DF", "MF", "FW"].includes(v["pos"] as string) &&
    ["ovr", "pace", "shooting", "passing", "defending", "physical", "condition", "morale"].every(
      (key) => finite(v[key], 0, 100),
    ) &&
    typeof v["suspended"] === "boolean" &&
    integer(v["injuryWeeks"], 0, 104)
  );
}

export function validMatchTeam(v: unknown): boolean {
  if (
    !object(v) ||
    !text(v["name"], 240) ||
    !validMatchTactics(v["tactics"]) ||
    !Array.isArray(v["players"]) ||
    v["players"].length !== 11 ||
    (v["bench"] !== undefined &&
      (!Array.isArray(v["bench"]) || v["bench"].length > MAX_MATCH_BENCH_PLAYERS)) ||
    (v["morale"] !== undefined && !finite(v["morale"], 0, 100)) ||
    (v["cpu"] !== undefined && typeof v["cpu"] !== "boolean")
  )
    return false;
  const roster = [...v["players"], ...((v["bench"] ?? []) as unknown[])];
  const ids = new Set<string>();
  let goalkeeper = false;
  return (
    roster.every((player, index) => {
      if (!validMatchPlayer(player)) return false;
      const p = player as Record<string, unknown>;
      if (ids.has(p["id"] as string)) return false;
      ids.add(p["id"] as string);
      if (index < 11) {
        // validMatchPlayer already constrains both fields to their valid types and ranges.
        if (p["suspended"] || p["injuryWeeks"]) return false;
        goalkeeper ||= p["pos"] === "GK";
      }
      return p["clubId"] === v["clubId"];
    }) && goalkeeper
  );
}

type CareerEnvelope = {
  clubId: string;
  players: Record<string, unknown>;
};

function validCareerEnvelope(
  v: unknown,
  options: { allowUnavailableLineup?: boolean } = {},
): v is CareerEnvelope {
  if (!object(v)) return false;
  const clubId = v["clubId"];
  const players = v["players"];
  const fixtures = v["fixtures"];
  const lineup = v["lineup"];
  const finances = v["finances"];
  if (
    !id(clubId) ||
    !integer(v["round"], 1, 1000) ||
    !integer(v["season"], 1, 10000) ||
    !object(players) ||
    Object.keys(players).length > 30000 ||
    !Array.isArray(fixtures) ||
    fixtures.length > 30000 ||
    !Array.from(fixtures).every(object) ||
    !Array.isArray(lineup) ||
    lineup.length !== 11 ||
    !object(finances) ||
    !finite(finances["budget"], -1e9, 1e9) ||
    !finite(finances["spent"], 0, 1e9) ||
    !finite(finances["income"], 0, 1e9)
  )
    return false;

  const playerIds = new Set<string>();
  let goalkeeper = false;
  for (const lineupId of lineup) {
    if (!id(lineupId)) return false;
    if (!Object.hasOwn(players, lineupId)) return false;
    const player = players[lineupId];
    if (!object(player)) return false;
    const playerId = player["id"];
    if (
      !id(playerId) ||
      playerId !== lineupId ||
      playerIds.has(playerId) ||
      player["clubId"] !== clubId ||
      typeof player["suspended"] !== "boolean" ||
      !integer(player["injuryWeeks"], 0, 104) ||
      (!options.allowUnavailableLineup &&
        (player["suspended"] !== false || player["injuryWeeks"] !== 0))
    )
      return false;
    playerIds.add(playerId);
    if (player["pos"] === "GK") goalkeeper = true;
  }
  return goalkeeper;
}

function validCareerPerformance(
  v: unknown,
  career: CareerEnvelope,
  seenPids: Set<string>,
): boolean {
  if (!object(v) || !id(v["pid"]) || seenPids.has(v["pid"])) return false;
  const pid = v["pid"];
  if (!Object.hasOwn(career.players, pid)) return false;
  const player = career.players[pid];
  if (!object(player) || player["id"] !== pid || player["clubId"] !== career.clubId) return false;
  seenPids.add(pid);
  return (
    integer(v["goals"], 0, 50) &&
    integer(v["assists"], 0, 50) &&
    typeof v["played"] === "boolean" &&
    (v["minutes"] === undefined || finite(v["minutes"], 0, 150)) &&
    (v["rating"] === undefined || finite(v["rating"], 0, 10)) &&
    (v["yellow"] === undefined || integer(v["yellow"], 0, 2)) &&
    (v["red"] === undefined || typeof v["red"] === "boolean") &&
    (v["injuryWeeks"] === undefined || integer(v["injuryWeeks"], 0, 104))
  );
}

/** A structural guard, not a claim that a personal career is server-attested. */
export function validMatchCommand(v: unknown): v is LiveWorkerRequest {
  if (!object(v) || !integer(v["id"], 0, Number.MAX_SAFE_INTEGER)) return false;
  switch (v["type"]) {
    case "startLive":
    case "simulate":
      return (
        validMatchTeam(v["home"]) &&
        validMatchTeam(v["away"]) &&
        text(v["seed"], 4096) &&
        (v["rulesRevision"] === undefined || validMatchRulesRevision(v["rulesRevision"])) &&
import type { LiveWorkerRequest } from "./live-match";

export const MAX_MATCH_BENCH_PLAYERS = 64;
export const LIVE_CONTROL_RESPONSE_TIMEOUT_MS = 3_000;
const MAX_EVALUATION_TIME = 8_640_000_000_000_000;

/** JavaScript dates accept at most this many milliseconds from the epoch. */
export const validCareerEvaluationTime = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= MAX_EVALUATION_TIME;

/** Validate commands once at the worker boundary, never in the simulation tick. */
const FORMS = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1"];
const WEATHER = ["clear", "rain", "heat"];
const RESERVED = new Set(["__proto__", "constructor", "prototype"]);
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const text = (v: unknown, max: number): v is string => {
  if (typeof v !== "string" || v.length < 1 || v.length > max) return false;
  for (let index = 0; index < v.length; index++) if (v.charCodeAt(index) < 32) return false;
  return true;
};
const id = (v: unknown): v is string => text(v, 160) && !RESERVED.has(v);
const integer = (v: unknown, min: number, max: number) =>
  finite(v, min, max) && Number.isSafeInteger(v);
const side = (v: unknown) => v === "home" || v === "away";
const validControlExpiry = (value: unknown) =>
  validCareerEvaluationTime(value) && value <= Date.now() + LIVE_CONTROL_RESPONSE_TIMEOUT_MS;

export function validMatchTactics(v: unknown): boolean {
  return (
    object(v) &&
    FORMS.includes(v["formation"] as string) &&
    integer(v["mentality"], 0, 4) &&
    integer(v["pressing"], 0, 2) &&
    integer(v["width"], 0, 2) &&
    integer(v["tempo"], 0, 2)
  );
}

export function validMatchPlayer(v: unknown): boolean {
  return (
    object(v) &&
    id(v["id"]) &&
    id(v["clubId"]) &&
    text(v["name"], 240) &&
    ["GK", "DF", "MF", "FW"].includes(v["pos"] as string) &&
    ["ovr", "pace", "shooting", "passing", "defending", "physical", "condition", "morale"].every(
      (key) => finite(v[key], 0, 100),
    ) &&
    typeof v["suspended"] === "boolean" &&
    integer(v["injuryWeeks"], 0, 104)
  );
}

export function validMatchTeam(v: unknown): boolean {
  if (
    !object(v) ||
    !text(v["name"], 240) ||
    !validMatchTactics(v["tactics"]) ||
    !Array.isArray(v["players"]) ||
    v["players"].length !== 11 ||
    (v["bench"] !== undefined &&
      (!Array.isArray(v["bench"]) || v["bench"].length > MAX_MATCH_BENCH_PLAYERS)) ||
    (v["morale"] !== undefined && !finite(v["morale"], 0, 100)) ||
    (v["cpu"] !== undefined && typeof v["cpu"] !== "boolean")
  )
    return false;
  const roster = [...v["players"], ...((v["bench"] ?? []) as unknown[])];
  const ids = new Set<string>();
  let goalkeeper = false;
  return (
    roster.every((player, index) => {
      if (!validMatchPlayer(player)) return false;
      const p = player as Record<string, unknown>;
      if (ids.has(p["id"] as string)) return false;
      ids.add(p["id"] as string);
      if (index < 11) {
        // validMatchPlayer already constrains both fields to their valid types and ranges.
        if (p["suspended"] || p["injuryWeeks"]) return false;
        goalkeeper ||= p["pos"] === "GK";
      }
      return p["clubId"] === v["clubId"];
    }) && goalkeeper
  );
}

type CareerEnvelope = {
  clubId: string;
  players: Record<string, unknown>;
};

function validCareerEnvelope(
  v: unknown,
  options: { allowUnavailableLineup?: boolean } = {},
): v is CareerEnvelope {
  if (!object(v)) return false;
  const clubId = v["clubId"];
  const players = v["players"];
  const fixtures = v["fixtures"];
  const lineup = v["lineup"];
  const finances = v["finances"];
  if (
    !id(clubId) ||
    !integer(v["round"], 1, 1000) ||
    !integer(v["season"], 1, 10000) ||
    !object(players) ||
    Object.keys(players).length > 30000 ||
    !Array.isArray(fixtures) ||
    fixtures.length > 30000 ||
    !Array.from(fixtures).every(object) ||
    !Array.isArray(lineup) ||
    lineup.length !== 11 ||
    !object(finances) ||
    !finite(finances["budget"], -1e9, 1e9) ||
    !finite(finances["spent"], 0, 1e9) ||
    !finite(finances["income"], 0, 1e9)
  )
    return false;

  const playerIds = new Set<string>();
  let goalkeeper = false;
  for (const lineupId of lineup) {
    if (!id(lineupId)) return false;
    if (!Object.hasOwn(players, lineupId)) return false;
    const player = players[lineupId];
    if (!object(player)) return false;
    const playerId = player["id"];
    if (
      !id(playerId) ||
      playerId !== lineupId ||
      playerIds.has(playerId) ||
      player["clubId"] !== clubId ||
      typeof player["suspended"] !== "boolean" ||
      !integer(player["injuryWeeks"], 0, 104) ||
      (!options.allowUnavailableLineup &&
        (player["suspended"] !== false || player["injuryWeeks"] !== 0))
    )
      return false;
    playerIds.add(playerId);
    if (player["pos"] === "GK") goalkeeper = true;
  }
  return goalkeeper;
}

function validCareerPerformance(
  v: unknown,
  career: CareerEnvelope,
  seenPids: Set<string>,
): boolean {
  if (!object(v) || !id(v["pid"]) || seenPids.has(v["pid"])) return false;
  const pid = v["pid"];
  if (!Object.hasOwn(career.players, pid)) return false;
  const player = career.players[pid];
  if (!object(player) || player["id"] !== pid || player["clubId"] !== career.clubId) return false;
  seenPids.add(pid);
  return (
    integer(v["goals"], 0, 50) &&
    integer(v["assists"], 0, 50) &&
    typeof v["played"] === "boolean" &&
    (v["minutes"] === undefined || finite(v["minutes"], 0, 150)) &&
    (v["rating"] === undefined || finite(v["rating"], 0, 10)) &&
    (v["yellow"] === undefined || integer(v["yellow"], 0, 2)) &&
    (v["red"] === undefined || typeof v["red"] === "boolean") &&
    (v["injuryWeeks"] === undefined || integer(v["injuryWeeks"], 0, 104))
  );
}

/** A structural guard, not a claim that a personal career is server-attested. */
export function validMatchCommand(v: unknown): v is LiveWorkerRequest {
  if (!object(v) || !integer(v["id"], 0, Number.MAX_SAFE_INTEGER)) return false;
  switch (v["type"]) {
    case "startLive":
    case "simulate":
      return (
        validMatchTeam(v["home"]) &&
        validMatchTeam(v["away"]) &&
        text(v["seed"], 4096) &&
        (v["knockout"] === undefined || typeof v["knockout"] === "boolean") &&
        (v["weather"] === undefined || WEATHER.includes(v["weather"] as string)) &&
        (v["compact"] === undefined || typeof v["compact"] === "boolean")
      );
    case "pauseLive":
      return typeof v["paused"] === "boolean";
    case "speedLive":
      return finite(v["speed"], 1, 8);
    case "tacticsLive":
      return (
        side(v["side"]) && validMatchTactics(v["tactics"]) && validControlExpiry(v["expiresAt"])
      );
    case "talkLive":
      return (
        side(v["side"]) &&
        ["motivar", "cobrar", "poupar"].includes(v["kind"] as string) &&
        validControlExpiry(v["expiresAt"])
      );
    case "substituteLive":
      return (
        side(v["side"]) &&
        id(v["outPid"]) &&
        validMatchPlayer(v["incoming"]) &&
        validControlExpiry(v["expiresAt"])
      );
    case "recycleLive":
      return (
        integer(v["session"], 0, Number.MAX_SAFE_INTEGER) &&
        integer(v["slot"], 0, 15) &&
        v["buffer"] instanceof ArrayBuffer
      );
    case "skipLive":
    case "stopLive":
    case "resyncLive":
      return true;
    case "autoSeason":
      return (
        validCareerEnvelope(v["career"], { allowUnavailableLineup: true }) &&
        integer(v["maxWeeks"], 1, 60) &&
        validCareerEvaluationTime(v["evaluatedAt"])
      );
    case "advance": {
      const career = v["career"];
      const performances = v["performances"];
      if (
        !validCareerEnvelope(career) ||
        !validCareerEvaluationTime(v["evaluatedAt"]) ||
        !object(v["result"]) ||
        !integer(v["result"]["hg"], 0, 50) ||
        !integer(v["result"]["ag"], 0, 50) ||
        !Array.isArray(performances) ||
        performances.length > 32
      )
        return false;
      const seenPids = new Set<string>();
      for (const performance of performances)
        if (!validCareerPerformance(performance, career, seenPids)) return false;
      return true;
    }
    default:
      return false;
  }
}
