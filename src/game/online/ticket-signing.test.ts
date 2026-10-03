import { describe, expect, it } from "vitest";

import { MATCH_PROTOCOL_VERSION, parseMatchTicketV1 } from "./match-protocol";
import { createMatchTicketNonce, signMatchTicketV1, verifyMatchTicketV1 } from "./ticket-signing";

const secret = "test-only-match-ticket-signing-secret-at-least-32-bytes";

const unsignedTicket = {
  version: MATCH_PROTOCOL_VERSION,
  roomId: "45fd1d08-4f81-44bc-9072-1e35ce9d1d94",
  userId: "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9",
  seat: "home" as const,
  issuedAt: 1_700_000_000_000,
  expiresAt: 1_700_000_060_000,
  nonce: "eW91LWNhbi10cnVzdC10aGUtY2xpZW50",
};

describe("Match ticket signing", () => {
  it("signs an explicit ticket and verifies it with the same server secret", async () => {
    const ticket = await signMatchTicketV1(unsignedTicket, secret);

    expect(ticket.signature).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    await expect(verifyMatchTicketV1(ticket, secret)).resolves.toBe(true);
  });

  it.each([
    ["user", { userId: "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef" }],
    ["seat", { seat: "away" as const }],
    ["expiry", { expiresAt: 1_700_000_120_000 }],
    ["nonce", { nonce: "YW5vdGhlci10aWNrZXQtbm9uY2UtdjE" }],
  ])("rejects a ticket tampered in its %s claim", async (_label, override) => {
    const signed = await signMatchTicketV1(unsignedTicket, secret);
    const tampered = parseMatchTicketV1({ ...signed, ...override });

    await expect(verifyMatchTicketV1(tampered, secret)).resolves.toBe(false);
  });

  it("does not accept a valid ticket when verified with a different server secret", async () => {
    const signed = await signMatchTicketV1(unsignedTicket, secret);

    await expect(verifyMatchTicketV1(signed, `${secret}-different`)).resolves.toBe(false);
  });

  it("creates a base64url nonce with enough entropy for a short-lived ticket", () => {
    const nonce = createMatchTicketNonce();

    expect(nonce).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });
});
