/**
 * Boundary validation for third-party football providers.
 *
 * The API adapters intentionally deal with permissive, changing JSON. This
 * module is the one narrow gate before rows reach the database import.
 */
import { z } from "zod";

import type { RemotePlayer } from "./football-api.server";

const trimmed = (maximum: number) => z.string().trim().min(1).max(maximum);
const httpsUrl = z
  .string()
  .url()
  .max(2048)
  .refine((value) => new URL(value).protocol === "https:", "A URL de imagem precisa usar HTTPS");

const remotePlayerSchema = z.object({
  source: trimmed(64),
  externalId: trimmed(160),
  name: trimmed(120),
  position: z.enum(["GK", "DF", "MF", "FW"]),
  age: z.number().int().min(15).max(55).optional(),
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
    const parsed = remotePlayerSchema.safeParse(row);
    if (!parsed.success) {
      rejected.push({ index, reason: "schema" });
      return;
    }

    const player: RemotePlayer = parsed.data;
    const providerId = `${player.source}:${player.externalId}`;
    if (providerIds.has(providerId)) {
      rejected.push({ index, reason: "duplicate-provider-id" });
      return;
    }
    providerIds.add(providerId);
    accepted.push(player);
  });

  return { accepted, rejected };
}
