import { describe, expect, it } from "vitest";
import { AuthoritativeMatchSession } from "./authoritative-match-session";
import { MatchSimAuthority } from "./match-sim-authority.server";
import { MATCH_PROTOCOL_VERSION, parseMatchCommandV1, type MatchSeat } from "./match-protocol";
import { signMatchTicketV1, verifyMatchTicketV1 } from "./ticket-signing";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const secret = "local-test-only-signing-secret-123456789";
const now = 1_700_000_000_000;

async function ticket(seat: MatchSeat) {
  return signMatchTicketV1(
    {
      version: MATCH_PROTOCOL_VERSION,
      roomId,
      userId:
        seat === "home"
          ? "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9"
          : "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef",
      seat,
      issuedAt: now,
      expiresAt: now + 120_000,
      nonce: `local-test-nonce-for-${seat}-seat`,
    },
    secret,
  );
}
function ready(sequence: number) {
  return parseMatchCommandV1({
    version: MATCH_PROTOCOL_VERSION,
    roomId,
    sequence,
    kind: "ready",
    payload: { ready: true },
  });
}

describe.each([false, true])("real simulation with away AI = %s", (awayIsAi) => {
  it("uses signed local test identities to drive one server-owned simulation", async () => {
    const home = await ticket("home");
    const away = await ticket("away");
    expect(await verifyMatchTicketV1(home, secret)).toBe(true);
    expect(await verifyMatchTicketV1(away, secret)).toBe(true);
    const engine = new MatchSimAuthority("fla", "pal", "local-private-seed-123456", awayIsAi);
    const session = new AuthoritativeMatchSession({
      roomId,
      homeTicket: home,
      awayTicket: away,
      engine,
      signer: { sign: async () => "local-receipt-signature-12345" },
      simulationVersion: "match-sim/1",
      idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    });
    await session.receive(home, ready(1), now + 1);
    await session.receive(away, ready(1), now + 1);
    expect(session.phase).toBe("live");
    for (let i = 0; i < 120; i++) session.advanceFixedTick();
    const shared = session.snapshot();
    expect(shared.tick).toBe(120);
    expect(shared.publicState).toEqual(engine.publicState());
    expect(engine.visualSnapshot().players).toHaveLength(22);
    expect(JSON.stringify(shared)).not.toContain("local-private-seed-123456");
    const forged = { ...home, userId: away.userId };
    await expect(session.receive(forged, ready(2), now + 2)).rejects.toThrow();
  });
});
