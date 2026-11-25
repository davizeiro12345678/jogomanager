import { describe, expect, it } from "vitest";
import { classifyPreAuthAuthorityFrame } from "./preauth-frame-gate";

const message = (input: object) => JSON.stringify({ version: 1, ...input });

describe("authoritative pre-auth frame gate", () => {
  it("accepts only the expected seat's ready handshake", () => {
    expect(classifyPreAuthAuthorityFrame(message({ type: "ready", seat: "home" }), "home")).toBe(
      "accept",
    );
    expect(classifyPreAuthAuthorityFrame(message({ type: "ready", seat: "away" }), "home")).toBe(
      "reject_seat",
    );
    expect(classifyPreAuthAuthorityFrame(message({ type: "ready" }), "home")).toBe("reject_seat");
  });

  it("allows sequence negotiation to undergo full reducer validation", () => {
    expect(
      classifyPreAuthAuthorityFrame(
        message({ type: "sequence_resume", seat: "home", sequence: 12 }),
        "home",
      ),
    ).toBe("accept");
  });

  it("never accepts a provisional result, snapshot or command acknowledgement", () => {
    for (const type of ["snapshot", "final", "ack", "nack", "pong", "command"]) {
      expect(classifyPreAuthAuthorityFrame(message({ type }), "home")).toBe("ignore");
    }
  });

  it("rejects malformed, binary and oversized handshake frames", () => {
    for (const raw of [null, new Uint8Array(3), "{bad", "null", "[]", "0", "x".repeat(65_537)]) {
      expect(classifyPreAuthAuthorityFrame(raw, "home")).toBe("ignore");
    }
  });
});
