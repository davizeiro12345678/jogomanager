import { migrateCareer } from "@/game/career";
import type { CareerState } from "@/game/types";

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

function hash(text: string): string {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(16).padStart(8, "0");
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
  const parsed = JSON.parse(text) as Partial<CareerTransferFile>;
  if (
    parsed.kind !== CAREER_TRANSFER_KIND ||
    parsed.version !== CAREER_TRANSFER_VERSION ||
    !parsed.career
  )
    throw new Error("Este arquivo não é uma carreira compatível.");
  if (hash(JSON.stringify(parsed.career)) !== parsed.checksum)
    throw new Error("O arquivo da carreira está incompleto ou foi alterado.");
  return migrateCareer(parsed.career);
}
