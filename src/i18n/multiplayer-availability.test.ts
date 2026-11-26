import { describe, expect, it } from "vitest";
import { multiplayerAvailabilityMessages } from "./multiplayer-availability-messages";

describe("multiplayer availability copy", () => {
  it("localizes the Portuguese available and unavailable modes", () => {
    const copy = multiplayerAvailabilityMessages("pt-BR");
    expect(copy.oneAvailable).toBe("1×1 disponível");
    expect(copy.twoPending).toBe("2×2 em validação");
    expect(copy.unavailable).toBe("Ainda indisponível.");
  });
  it("does not advertise the cooperative mode as playable in English", () => {
    const copy = multiplayerAvailabilityMessages("en");
    expect(copy.oneAvailable).toBe("1×1 available");
    expect(copy.twoPending).toBe("2×2 under validation");
    expect(copy.unavailable).toBe("Not available yet.");
  });
});
