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
const id = (v: unknown) => text(v, 160) && !RESERVED.has(v);
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
    )
  );
}

export function validMatchTeam(v: unknown): boolean {
  if (
    !object(v) ||
    !id(v["clubId"]) ||
    !text(v["name"], 240) ||
    !validMatchTactics(v["tactics"]) ||
    !Array.isArray(v["players"]) ||
    v["players"].length < 1 ||
    v["players"].length > 11 ||
    !Array.from(v["players"]).every(validMatchPlayer) ||
    (v["bench"] !== undefined &&
      (!Array.isArray(v["bench"]) ||
        v["bench"].length > MAX_MATCH_BENCH_PLAYERS ||
        !Array.from(v["bench"]).every(validMatchPlayer))) ||
    (v["morale"] !== undefined && !finite(v["morale"], 0, 100)) ||
    (v["cpu"] !== undefined && typeof v["cpu"] !== "boolean")
  )
    return false;
  const roster = [...v["players"], ...((v["bench"] ?? []) as unknown[])];
  const ids = new Set<string>();
  return roster.every((player) => {
    const p = player as Record<string, unknown>;
    if (ids.has(p["id"] as string)) return false;
    ids.add(p["id"] as string);
    return p["clubId"] === v["clubId"];
  });
}

function validCareerEnvelope(v: unknown): boolean {
  return (
    object(v) &&
    id(v["clubId"]) &&
    integer(v["round"], 1, 1000) &&
    integer(v["season"], 1, 10000) &&
    object(v["players"]) &&
    Object.keys(v["players"]).length <= 30000 &&
    Array.isArray(v["fixtures"]) &&
    v["fixtures"].length <= 30000 &&
    Array.from(v["fixtures"]).every(object) &&
    Array.isArray(v["lineup"]) &&
    v["lineup"].length <= 11 &&
    Array.from(v["lineup"]).every(id) &&
    object(v["finances"]) &&
    finite(v["finances"]["budget"], -1e9, 1e9) &&
    finite(v["finances"]["spent"], 0, 1e9) &&
    finite(v["finances"]["income"], 0, 1e9)
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
        validCareerEnvelope(v["career"]) &&
        integer(v["maxWeeks"], 1, 60) &&
        validCareerEvaluationTime(v["evaluatedAt"])
      );
    case "advance":
      return (
        validCareerEnvelope(v["career"]) &&
        validCareerEvaluationTime(v["evaluatedAt"]) &&
        object(v["result"]) &&
        integer(v["result"]["hg"], 0, 50) &&
        integer(v["result"]["ag"], 0, 50) &&
        Array.isArray(v["performances"]) &&
        v["performances"].length <= 32 &&
        Array.from(v["performances"]).every(
          (p) =>
            object(p) &&
            id(p["pid"]) &&
            integer(p["goals"], 0, 50) &&
            integer(p["assists"], 0, 50) &&
            typeof p["played"] === "boolean" &&
            (p["minutes"] === undefined || finite(p["minutes"], 0, 150)) &&
            (p["rating"] === undefined || finite(p["rating"], 0, 10)) &&
            (p["yellow"] === undefined || integer(p["yellow"], 0, 2)) &&
            (p["red"] === undefined || typeof p["red"] === "boolean") &&
            (p["injuryWeeks"] === undefined || integer(p["injuryWeeks"], 0, 104)),
        )
      );
    default:
      return false;
  }
}
