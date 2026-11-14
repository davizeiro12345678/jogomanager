import { describe, expect, it } from "vitest";
import { VerifiedTournamentBracket } from "./verified-tournament-bracket.server";
import type { MatchReceiptV1 } from "./match-protocol";

const entrants = [
  "01e56d96-8406-437d-918a-e2f3d1081bca",
  "8f97c20c-6828-42e1-bc2a-53984b88a276",
  "a0d861b7-b04e-4cb6-8437-9a9e43db188d",
  "7999d145-bd26-432e-8cea-004a49b23f11",
  "9bc87f53-be65-48cc-95ae-35d0d8d999a5",
];
const rooms = [
  "fb13a635-5b5b-4bd8-b650-3867b5aaab41",
  "23556651-4470-486c-8353-1f9e6e5ee438",
  "b06c63bb-9129-470f-94bb-92e6c73b18e9",
  "05ad14d3-e364-46ce-a695-a120f733b632",
];
const signed = (roomId: string, winner: "home" | "away" = "home"): MatchReceiptV1 => ({
  version: 1,
  roomId,
  simulationVersion: "contact-2",
  commandHash: "b".repeat(64),
  result:
    winner === "home"
      ? { homeGoals: 2, awayGoals: 1, winner }
      : { homeGoals: 1, awayGoals: 2, winner },
  closureReason: "completed",
  idempotencyKey: "cfc44841-72f2-41d6-9494-6d9dc424386a",
  issuedAt: 1_700_000_000_000,
  signature: "serververifieddummyhmacsignaturelong",
});
const verify = async (receipt: MatchReceiptV1) =>
  receipt.signature === "serververifieddummyhmacsignaturelong";

describe("server-verified knockout tournaments", () => {
  it("creates deterministic byes for the highest-ordered seeds", () => {
    const bracket = new VerifiedTournamentBracket(entrants);
    const first = bracket.bracket()[0]!;
    expect(first).toHaveLength(4);
    expect(first.slice(0, 3).map((game) => game.winnerId)).toEqual(entrants.slice(0, 3));
    expect(first[3]).toMatchObject({
      homeId: entrants[3],
      awayId: entrants[4],
      winnerId: null,
    });
    expect(bracket.bindRoom("r1m1", rooms[0]!)).toBe(false);
  });

  it("requires a real bound room and a verified receipt", async () => {
    const bracket = new VerifiedTournamentBracket(entrants);
    expect(await bracket.submitResult("r1m4", signed(rooms[0]!), verify)).toBe("wrong_room");
    expect(bracket.bindRoom("r1m4", rooms[0]!)).toBe(true);
    expect(bracket.bindRoom("r1m4", rooms[1]!)).toBe(false);
    expect(await bracket.submitResult("r1m4", signed(rooms[1]!), verify)).toBe("wrong_room");
    expect(await bracket.submitResult("r1m4", signed(rooms[0]!), async () => false)).toBe(
      "unverified",
    );
    expect(await bracket.submitResult("r1m4", { forged: true }, verify)).toBe("invalid_result");
    expect(bracket.champion()).toBeNull();
  });

  it("progresses through verified semifinals and final without accepting browser scores", async () => {
    const bracket = new VerifiedTournamentBracket(entrants);
    expect(bracket.bindRoom("r1m4", rooms[0]!)).toBe(true);
    expect(await bracket.submitResult("r1m4", signed(rooms[0]!), verify)).toBe("accepted");

    const semifinals = bracket.bracket()[1]!;
    expect(semifinals.map((game) => [game.homeId, game.awayId])).toEqual([
      [entrants[0], entrants[1]],
      [entrants[2], entrants[3]],
    ]);
    expect(bracket.bindRoom("r2m1", rooms[1]!)).toBe(true);
    expect(bracket.bindRoom("r2m2", rooms[2]!)).toBe(true);
    expect(await bracket.submitResult("r2m1", signed(rooms[1]!, "away"), verify)).toBe("accepted");
    expect(await bracket.submitResult("r2m2", signed(rooms[2]!), verify)).toBe("accepted");

    const final = bracket.bracket()[2]![0]!;
    expect([final.homeId, final.awayId]).toEqual([entrants[1], entrants[2]]);
    expect(bracket.bindRoom("r3m1", rooms[3]!)).toBe(true);
    expect(await bracket.submitResult("r3m1", signed(rooms[3]!), verify)).toBe("accepted");
    expect(bracket.champion()).toBe(entrants[1]);
  });

  it("handles concurrent conflicting settlements and exact idempotent retries", async () => {
    const bracket = new VerifiedTournamentBracket(entrants.slice(0, 2));
    expect(bracket.bindRoom("r1m1", rooms[0]!)).toBe(true);
    const original = signed(rooms[0]!);
    const altered = {
      ...signed(rooms[0]!, "away"),
      idempotencyKey: original.idempotencyKey,
    };
    const [one, two] = await Promise.all([
      bracket.submitResult("r1m1", original, verify),
      bracket.submitResult("r1m1", altered, verify),
    ]);
    expect([one, two]).toEqual(["accepted", "conflict"]);
    expect(await bracket.submitResult("r1m1", original, verify)).toBe("already_recorded");
    expect(bracket.champion()).toBe(entrants[0]);
  });

  it("rejects draws but accepts verified forfeit receipts", async () => {
    const bracket = new VerifiedTournamentBracket(entrants.slice(0, 2));
    bracket.bindRoom("r1m1", rooms[0]!);
    const draw = {
      ...signed(rooms[0]!),
      result: { homeGoals: 1, awayGoals: 1, winner: "draw" },
    };
    expect(await bracket.submitResult("r1m1", draw, verify)).toBe("invalid_result");
    expect(
      await bracket.submitResult(
        "r1m1",
        {
          ...signed(rooms[0]!),
          closureReason: "forfeit",
        },
        verify,
      ),
    ).toBe("accepted");
  });

  it("restores an in-flight tournament through signed receipts and pending rooms", async () => {
    const bracket = new VerifiedTournamentBracket(entrants);
    bracket.bindRoom("r1m4", rooms[0]!);
    const firstReceipt = signed(rooms[0]!);
    expect(await bracket.submitResult("r1m4", firstReceipt, verify)).toBe("accepted");
    bracket.bindRoom("r2m1", rooms[1]!);

    const checkpoint = bracket.checkpoint();
    const resumed = await VerifiedTournamentBracket.restoreCheckpoint(checkpoint, verify);
    expect(resumed.bracket()).toEqual(bracket.bracket());
    expect(resumed.checkpoint()).toEqual(checkpoint);
    expect(await resumed.submitResult("r1m4", firstReceipt, verify)).toBe("already_recorded");
    expect(resumed.bindRoom("r2m1", rooms[2]!)).toBe(false);
    expect(await resumed.submitResult("r2m1", signed(rooms[1]!), verify)).toBe("accepted");
    expect(bracket.bracket()[1]![0]!.winnerId).toBeNull();
  });

  it("refuses checkpoint corruption, forged result and replayed room binding", async () => {
    const bracket = new VerifiedTournamentBracket(entrants);
    bracket.bindRoom("r1m4", rooms[0]!);
    await bracket.submitResult("r1m4", signed(rooms[0]!), verify);
    const saved = bracket.checkpoint();
    const forged = structuredClone(saved);
    forged.results[0]!.receipt.signature = "tamperedhmacsignaturewithuntrustedbytes";
    await expect(VerifiedTournamentBracket.restoreCheckpoint(forged, verify)).rejects.toThrow();
    const duplicate = structuredClone(saved);
    duplicate.pendingRooms.push({ matchId: "r1m4", roomId: rooms[0]! });
    await expect(VerifiedTournamentBracket.restoreCheckpoint(duplicate, verify)).rejects.toThrow();
    const wrongRoom = structuredClone(saved);
    wrongRoom.results[0]!.roomId = rooms[2]!;
    await expect(VerifiedTournamentBracket.restoreCheckpoint(wrongRoom, verify)).rejects.toThrow();
    const extra = { ...saved, untrustedWinner: entrants[4] };
    await expect(VerifiedTournamentBracket.restoreCheckpoint(extra, verify)).rejects.toThrow();
  });

  it("does not accept duplicate entrants or tamper with the exported bracket", () => {
    expect(() => new VerifiedTournamentBracket([entrants[0]!, entrants[0]!])).toThrow();
    expect(() => new VerifiedTournamentBracket(["malformed", entrants[1]!])).toThrow();
    const bracket = new VerifiedTournamentBracket(entrants);
    bracket.bracket()[0]![0]!.winnerId = entrants[4]!;
    expect(bracket.bracket()[0]![0]!.winnerId).toBe(entrants[0]);
  });
});
