import { migrateCareer } from "@/game/career";
import type { CareerState } from "@/game/types";
import { assertUntrustedJson } from "@/lib/untrusted-json";

export const CAREER_TRANSFER_VERSION = 1 as const;
export const CAREER_TRANSFER_KIND = "pro-football-manager-3d-career" as const;
// This is checked before JSON.parse so a manually supplied import cannot make
// the browser allocate an unbounded object graph. The structural guard below
// separately limits nesting, keys and string content.
export const MAX_CAREER_TRANSFER_BYTES = 8_000_000;

export interface CareerTransferFile {
  kind: typeof CAREER_TRANSFER_KIND;
  version: typeof CAREER_TRANSFER_VERSION;
  exportedAt: string;
  gameSaveVersion: number;
  checksum: string;
  career: CareerState;
}

function hash(text: string): string {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(16).padStart(8, "0");
}

/** Counts UTF-8 bytes without allocating a second full-size byte array. */
function exceedsCareerTransferByteLimit(text: string): boolean {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      index + 1 < text.length &&
      text.charCodeAt(index + 1) >= 0xdc00 &&
      text.charCodeAt(index + 1) <= 0xdfff
    ) {
      bytes += 4;
      index++;
    } else bytes += 3;
    if (bytes > MAX_CAREER_TRANSFER_BYTES) return true;
  }
  return false;
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function exportCareerFile(career: CareerState): string {
  const payload = JSON.stringify(career);
  const file: CareerTransferFile = {
    kind: CAREER_TRANSFER_KIND,
    version: CAREER_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    gameSaveVersion: career.version,
    checksum: hash(payload),
    career,
  };
  return JSON.stringify(file, null, 2);
}

export function importCareerFile(text: string): CareerState {
  if (typeof text !== "string" || exceedsCareerTransferByteLimit(text))
    throw new Error("O arquivo da carreira excede o limite permitido.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Arquivo inválido: não é um JSON válido.");
  }

  // Imports are personal, untrusted saves. Validate the whole object before
  // serializing its career payload or passing it to the migration path.
  assertUntrustedJson(parsed);
  if (
    !isJsonRecord(parsed) ||
    parsed["kind"] !== CAREER_TRANSFER_KIND ||
    parsed["version"] !== CAREER_TRANSFER_VERSION ||
    typeof parsed["checksum"] !== "string" ||
    !isJsonRecord(parsed["career"])
  )
    throw new Error("Este arquivo não é uma carreira compatível.");
  if (hash(JSON.stringify(parsed["career"])) !== parsed["checksum"])
    throw new Error("O arquivo da carreira está incompleto ou foi alterado.");
  return migrateCareer(parsed["career"] as unknown as CareerState);
}
