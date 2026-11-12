import { describe, expect, it, vi } from "vitest";
import {
  loadPrivateTournament,
  savePrivateTournament,
} from "./private-tournament-store.server";
import { VerifiedTournamentBracket } from "./verified-tournament-bracket.server";
import type { MatchReceiptV1 } from "./match-protocol";

const organizerId = "1fb83f11-5e55-4500-8e1e-f14cc26ed445";
const awayId = "3ae70a52-d6bb-468e-915a-311889f6dbd0";
const tournamentId = "cc0b6e22-e57b-4784-b978-ff72d8cb2e41";
const roomId = "0afe01b1-0a38-45c1-ad41-a5b26d2fc270";

function mockStorage() {
  let row: {
    id: string;
    organizerId: string;
    region: "sa";
    revision: number;
    status: "live" | "completed";
    checkpoint: unknown;
  } | null = null;
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === "save_private_tournament_checkpoint") {
      if (args["p_revision"] === -1) {
        row = {
          id: args["p_id"] as string,
          organizerId: args["p_owner"] as string,
          region: "sa",
          revision: 0,
          status: "live",
          checkpoint: structuredClone(args["p_checkpoint"]),
        };
        return { data: { status: "created", revision: 0 }, error: null };
      }
      if (!row) throw new Error("missing tournament");
      row.checkpoint = structuredClone(args["p_checkpoint"]);
      row.revision += 1;
      row.status = args["p_completed"] ? "completed" : "live";
      return { data: { status: "saved", revision: row.revision }, error: null };
    }
    if (name === "get_private_tournament_checkpoint")
      return {
        data: row && row.id === args["p_id"] ? structuredClone(row) : null,
        error: null,
      };
    return { data: null, error: { message: "unknown RPC" } };
  });
  return {
    rpc,
    mutate: (edit: (value: Record<string, unknown>) => void) => {
      if (!row) throw new Error("tournament not yet created");
      const checkpoint = structuredClone(row.checkpoint) as Record<string, unknown>;
      edit(checkpoint);
      row.checkpoint = checkpoint;
    },
  };
}

const official = (id: string): MatchReceiptV1 => ({
  version: 1,
  roomId: id,
  simulationVersion: "contact-2",
  commandHash: "f".repeat(64),
  result: { homeGoals: 2, awayGoals: 1, winner: "home" },
  closureReason: "completed",
  idempotencyKey: "d7ae11c3-8c10-43ba-b957-45c5096ca9a8",
  issuedAt: 1_700_000_000_000,
  signature: "trustedtestsignaturesafetokenbytes",
});
const verify = async (receipt: MatchReceiptV1) =>
  receipt.signature === "trustedtestsignaturesafetokenbytes";

describe("private tournament repository", () => {
  it("stores a new bracket and recovers a signed completed tournament", async () => {
    const storage = mockStorage();
    const bracket = new VerifiedTournamentBracket([organizerId, awayId]);
    const create = await savePrivateTournament(storage, {
      tournamentId,
      organizerId,
      region: "sa",
      expectedRevision: -1,
      bracket,
    });
    expect(create).toEqual({ status: "created", revision: 0 });
    expect(bracket.bindRoom("r1m1", roomId)).toBe(true);
    expect(await bracket.submitResult("r1m1", official(roomId), verify)).toBe("accepted");
    const saved = await savePrivateTournament(storage, {
      tournamentId,
      organizerId,
      region: "sa",
      expectedRevision: 0,
      bracket,
    });
    expect(saved).toEqual({ status: "saved", revision: 1 });
    const loaded = await loadPrivateTournament(storage, tournamentId, verify);
    expect(loaded?.bracket.champion()).toBe(organizerId);
    expect(loaded?.status).toBe("completed");
    expect(loaded?.revision).toBe(1);
    expect(storage.rpc).toHaveBeenCalledWith(
      "save_private_tournament_checkpoint",
      expect.objectContaining({ p_completed: true, p_owner: organizerId }),
    );
  });

  it("fails closed on tampered receipt or mismatched completion", async () => {
    const storage = mockStorage();
    const bracket = new VerifiedTournamentBracket([organizerId, awayId]);
    await savePrivateTournament(storage, {
      tournamentId,
      organizerId,
      region: "sa",
      expectedRevision: -1,
      bracket,
    });
    bracket.bindRoom("r1m1", roomId);
    await bracket.submitResult("r1m1", official(roomId), verify);
    await savePrivateTournament(storage, {
      tournamentId,
      organizerId,
      region: "sa",
      expectedRevision: 0,
      bracket,
    });
    storage.mutate((checkpoint) => {
      const entries = checkpoint["results"] as { receipt: MatchReceiptV1 }[];
      entries[0]!.receipt.signature = "forgedsignaturewithoutmatchinghmac";
    });
    await expect(loadPrivateTournament(storage, tournamentId, verify)).rejects.toThrow();
    expect(await loadPrivateTournament(storage, "26bfc4ad-dd2d-47cc-9806-f5f01d83d661", verify)).toBeNull();
  });

  it("rejects impossible CAS revisions before contacting the server", async () => {
    const storage = mockStorage();
    const bracket = new VerifiedTournamentBracket([organizerId, awayId]);
    await expect(savePrivateTournament(storage, {
      tournamentId,
      organizerId,
      region: "sa",
      expectedRevision: -2,
      bracket,
    })).rejects.toThrow();
    expect(storage.rpc).not.toHaveBeenCalled();
  });
});
