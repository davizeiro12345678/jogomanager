import { migrateCareer } from "@/game/career/migration";
import { CLUBS } from "@/game/data/leagues";
import { calendarYear } from "@/game/competition-regulations";
import type { CareerState } from "@/game/types";
import { parseImportJson, record } from "@/lib/import-validation";

export const CAREER_TRANSFER_VERSION = 1 as const;
export const CAREER_TRANSFER_KIND = "pro-football-manager-3d-career" as const;

export interface CareerTransferFile {
  kind: typeof CAREER_TRANSFER_KIND;
  version: typeof CAREER_TRANSFER_VERSION;
  exportedAt: string;
  gameSaveVersion: number;
  checksum: string;
  career: CareerState;
}

export interface CareerTransferPreview {
  managerName: string;
  clubId: string;
  clubName: string;
  season: number;
  round: number;
  calendarYear: number;
  gameSaveVersion: number;
  exportedAt: string;
  checksum: string;
  playerCount: number;
  fixtureCount: number;
  historyCount: number;
}

const nonempty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 120;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const positiveInteger = (value: unknown): value is number =>
  finite(value) && Number.isInteger(value) && value >= 1;

/** Reject missing progress before migration can manufacture defaults for it. */
function assertCareerContents(value: unknown): asserts value is CareerState {
  if (
    !record(value) ||
    ![1, 2, 3].includes(Number(value["version"])) ||
    !nonempty(value["managerName"]) ||
    !nonempty(value["clubId"]) ||
    !nonempty(value["leagueId"]) ||
    !positiveInteger(value["round"]) ||
    (value["season"] !== undefined && !positiveInteger(value["season"])) ||
    !record(value["players"]) ||
    !Object.keys(value["players"]).length ||
    !Array.isArray(value["fixtures"]) ||
    !value["fixtures"].length ||
    !Array.isArray(value["lineup"]) ||
    !value["lineup"].every(nonempty) ||
    !Array.isArray(value["bench"]) ||
    !value["bench"].every(nonempty) ||
    !record(value["tactics"]) ||
    !nonempty(value["tactics"]["formation"])
  )
    throw new Error("A carreira está incompleta: confira clube, elenco, escalação e calendário.");
  for (const [id, player] of Object.entries(value["players"])) {
    if (
      !record(player) ||
      player["id"] !== id ||
      !nonempty(player["name"]) ||
      !nonempty(player["clubId"]) ||
      !["GK", "DF", "MF", "FW"].includes(String(player["pos"]))
    )
      throw new Error("A carreira contém um elenco incompleto ou inválido.");
  }
  for (const fixture of value["fixtures"]) {
    if (
      !record(fixture) ||
      !positiveInteger(fixture["round"]) ||
      !nonempty(fixture["home"]) ||
      !nonempty(fixture["away"]) ||
      ![fixture["homeGoals"], fixture["awayGoals"]].every(
        (goal) => goal === null || (finite(goal) && Number.isInteger(goal) && goal >= 0),
      )
    )
      throw new Error("A carreira contém um calendário incompleto ou inválido.");
  }
  const current = value["version"] === 3;
  const finances = value["finances"];
  if (
    (current || finances !== undefined) &&
    (!record(finances) || !["budget", "spent", "income"].every((key) => finite(finances[key])))
  )
    throw new Error("A carreira contém finanças incompletas ou um valor inválido.");
  if (
    (current && !positiveInteger(value["season"])) ||
    !Array.isArray(value["results"]) ||
    ((current || value["history"] !== undefined) && !Array.isArray(value["history"]))
  )
    throw new Error("A carreira contém progresso ou histórico incompleto.");
}

function hash(text: string): string {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(16).padStart(8, "0");
}

export function exportCareerFile(career: CareerState): string {
  assertCareerContents(career);
  const payload = JSON.stringify(career, (_key, value: unknown) => {
    if (typeof value === "number" && !Number.isFinite(value))
      throw new Error("A carreira contém um valor inválido. O arquivo não foi exportado.");
    return value;
  });
  const file: CareerTransferFile = {
    kind: CAREER_TRANSFER_KIND,
    version: CAREER_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    gameSaveVersion: career.version,
    checksum: hash(payload),
    career: JSON.parse(payload) as CareerState,
  };
  const serialized = JSON.stringify(file, null, 2);
  // Validate the bytes destined for the download, including size and checksum.
  readCareerFile(serialized);
  return serialized;
}

function readCareerFile(text: string): CareerTransferFile {
  const value = parseImportJson(text);
  if (!record(value)) throw new Error("Este arquivo nao e uma carreira compativel.");
  const parsed = value as Partial<CareerTransferFile>;
  if (
    parsed.kind !== CAREER_TRANSFER_KIND ||
    parsed.version !== CAREER_TRANSFER_VERSION ||
    !parsed.career ||
    typeof parsed.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(parsed.exportedAt)) ||
    ![1, 2, 3].includes(parsed.gameSaveVersion ?? 0) ||
    parsed.gameSaveVersion !== parsed.career.version
  )
    throw new Error("Este arquivo não é uma carreira compatível.");
  if (hash(JSON.stringify(parsed.career)) !== parsed.checksum)
    throw new Error("O arquivo da carreira está incompleto ou foi alterado.");
  assertCareerContents(parsed.career);
  return parsed as CareerTransferFile;
}

/** Metadata comes from the validated serialized save, never a separate UI label. */
export function previewCareerFile(text: string): CareerTransferPreview {
  const file = readCareerFile(text);
  const career = file.career;
  return {
    managerName: career.managerName,
    clubId: career.clubId,
    clubName: CLUBS[career.clubId]?.name ?? career.clubId,
    season: career.season ?? 1,
    round: career.round,
    calendarYear: calendarYear({ ...career, season: career.season ?? 1 }),
    gameSaveVersion: file.gameSaveVersion,
    exportedAt: file.exportedAt,
    checksum: file.checksum,
    playerCount: Object.keys(career.players).length,
    fixtureCount: career.fixtures.length,
    historyCount: career.history?.length ?? 0,
  };
}

export function importCareerFile(text: string): CareerState {
  return migrateCareer(readCareerFile(text).career);
}

/** Compatibility name retained for existing callers. */
export { MAX_IMPORT_BYTES as MAX_CAREER_TRANSFER_BYTES } from "@/lib/import-validation";
