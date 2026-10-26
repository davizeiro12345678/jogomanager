/**
 * Boundary validation for third-party football providers.
 *
 * The API adapters intentionally deal with permissive, changing JSON. This
 * module is the one narrow gate before rows reach the database import.
 */
import { z } from "zod";

import type { RemotePlayer } from "./football-api.server";
import { validBirthDate } from "../game/player-identity";
import { isPlayerRecord } from "./football-person-kind";

const trimmed = (maximum: number) => z.string().trim().min(1).max(maximum);
const httpsUrl = z
  .string()
  .url()
  .max(2048)
  .refine((value) => new URL(value).protocol === "https:", "A URL de imagem precisa usar HTTPS");

const remotePlayerSchema = z.object({
  source: trimmed(64),
  sourceKind: z.literal("player").optional(),
  rawPosition: z.string().max(120).optional(),
  externalId: trimmed(160),
  name: trimmed(120),
  position: z.enum(["GK", "DF", "MF", "FW"]),
  age: z.number().int().min(15).max(55).optional(),
  birthDate: z
    .string()
    .refine((value) => validBirthDate(value) === value && !!value)
    .optional(),
  shirtNumber: z.number().int().min(1).max(99).optional(),
  nationality: trimmed(80).optional(),
  photoUrl: httpsUrl.optional(),
});

export interface RejectedIngestionRow {
  index: number;
  reason: "schema" | "duplicate-provider-id";
}

export interface RemotePlayersValidation {
  accepted: RemotePlayer[];
  rejected: RejectedIngestionRow[];
}

/**
 * Normalizes strings, enforces a bounded data envelope and removes duplicate
 * provider ids. Rejections are intentionally reported without returning raw
 * external data, which keeps logs and telemetry free of provider payloads.
 */
export function validateRemotePlayers(rows: readonly unknown[]): RemotePlayersValidation {
  const accepted: RemotePlayer[] = [];
  const rejected: RejectedIngestionRow[] = [];
  const providerIds = new Set<string>();

  rows.forEach((row, index) => {
    if (!row || typeof row !== "object" || !isPlayerRecord(row)) {
      rejected.push({ index, reason: "schema" });
      return;
    }
    const parsed = remotePlayerSchema.safeParse(row);
    if (!parsed.success) {
      rejected.push({ index, reason: "schema" });
      return;
    }

    const { sourceKind, ...fields } = parsed.data;
    const player: RemotePlayer = {
      ...fields,
      source: fields.source.toLowerCase(),
      ...(sourceKind ? { sourceKind } : {}),
    };
    const providerId = JSON.stringify([player.source, player.externalId]);
    if (providerIds.has(providerId)) {
      rejected.push({ index, reason: "duplicate-provider-id" });
      return;
    }
    providerIds.add(providerId);
    accepted.push(player);
  });

  return { accepted, rejected };
}
