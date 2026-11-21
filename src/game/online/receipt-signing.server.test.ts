import { describe, expect, it } from "vitest";
import { createMatchReceiptSigner, verifySignedMatchReceipt } from "./receipt-signing.server";

const secret = "staging-receipt-hmac-secret-for-tests-only-2026";
const unsigned = {
  version: 1 as const,
  roomId: "45fd1d08-4f81-44bc-9072-1e35ce9d1d94",
  simulationVersion: "contact-2",
  commandHash: "a".repeat(64),
  idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
  issuedAt: 1_700_000_005_000,
  closureReason: "completed" as const,
  result: { homeGoals: 2, awayGoals: 1, winner: "home" as const },
};

describe("server-only match receipt HMAC", () => {
  it("signs a result and rejects forged fields with unchanged signatures", async () => {
    const signature = await createMatchReceiptSigner(secret).sign(unsigned);
    const verified = { ...unsigned, signature };
    expect(signature).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await verifySignedMatchReceipt(verified, secret)).toBe(true);
    expect(
      await verifySignedMatchReceipt(
        { ...verified, result: { homeGoals: 9, awayGoals: 0, winner: "home" } },
        secret,
      ),
    ).toBe(false);
    expect(
      await verifySignedMatchReceipt({ ...verified, commandHash: "b".repeat(64) }, secret),
    ).toBe(false);
    expect(
      await verifySignedMatchReceipt(
        { ...verified, idempotencyKey: "d3698e34-73c1-4fee-bdbd-cc917642e1ab" },
        secret,
      ),
    ).toBe(false);
    expect(
      await verifySignedMatchReceipt(verified, "different-hmac-receipt-secret-for-staging-2026"),
    ).toBe(false);
  });

  it("never signs with missing or unsafe deployment keys", () => {
    expect(() => createMatchReceiptSigner("")).toThrow(/secret/);
    expect(() => createMatchReceiptSigner("weak")).toThrow(/secret/);
  });
});
