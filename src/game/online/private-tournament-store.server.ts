import { z } from "zod";
import {
  VerifiedTournamentBracket,
  type VerifiedTournamentCheckpointV1,
} from "./verified-tournament-bracket.server";
import type { MatchReceiptV1 } from "./match-protocol";

type Region = "sa" | "na" | "eu" | "apac";
type TournamentRpc = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const UUID = z.string().uuid();
const StoredTournament = z
  .object({
    id: UUID,
    organizerId: UUID,
    region: z.enum(["sa", "na", "eu", "apac"]),
    revision: z.number().int().nonnegative(),
    status: z.enum(["live", "completed"]),
    checkpoint: z.unknown(),
  })
  .strict();

const SavedVersion = z
  .object({
    status: z.enum(["created", "saved", "already_saved"]),
    revision: z.number().int().nonnegative(),
  })
  .strict();

/** Called only by authenticated server code holding a Supabase service client. */
export async function savePrivateTournament(
  db: TournamentRpc,
  data: {
    tournamentId: string;
    organizerId: string;
    region: Region;
    expectedRevision: number;
    bracket: VerifiedTournamentBracket;
  },
): Promise<{ revision: number; status: "created" | "saved" | "already_saved" }> {
  const tournamentId = UUID.parse(data.tournamentId);
  const organizerId = UUID.parse(data.organizerId);
  if (!Number.isSafeInteger(data.expectedRevision) || data.expectedRevision < -1)
    throw new Error("invalid tournament revision");
  const checkpoint: VerifiedTournamentCheckpointV1 = data.bracket.checkpoint();
  const completed = data.bracket.champion() !== null;
  const { data: result, error } = await db.rpc("save_private_tournament_checkpoint", {
    p_id: tournamentId,
    p_owner: organizerId,
    p_region: data.region,
    p_revision: data.expectedRevision,
    p_checkpoint: checkpoint,
    p_completed: completed,
  });
  if (error) throw new Error("private tournament persistence failed");
  return SavedVersion.parse(result);
}

/** Fail closed if a recovered bracket includes a forged or stale HMAC receipt. */
export async function loadPrivateTournament(
  db: TournamentRpc,
  tournamentId: string,
  verifySignedReceipt: (receipt: MatchReceiptV1) => Promise<boolean>,
): Promise<{
  organizerId: string;
  region: Region;
  revision: number;
  status: "live" | "completed";
  bracket: VerifiedTournamentBracket;
} | null> {
  const id = UUID.parse(tournamentId);
  const { data, error } = await db.rpc("get_private_tournament_checkpoint", {
    p_id: id,
  });
  if (error) throw new Error("private tournament load failed");
  if (data === null) return null;
  const row = StoredTournament.parse(data);
  if (row.id !== id) throw new Error("private tournament identity mismatch");
  const bracket = await VerifiedTournamentBracket.restoreCheckpoint(
    row.checkpoint,
    verifySignedReceipt,
  );
  if ((bracket.champion() !== null) !== (row.status === "completed"))
    throw new Error("private tournament completion mismatch");
  return {
    organizerId: row.organizerId,
    region: row.region,
    revision: row.revision,
    status: row.status,
    bracket,
  };
}
