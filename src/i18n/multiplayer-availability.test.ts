import { describe, expect, it } from "vitest";
import { multiplayerAvailabilityMessages } from "./multiplayer-availability-messages";

describe("multiplayer availability copy", () => {
  it("localizes the Portuguese available and unavailable modes", () => {
    const copy = multiplayerAvailabilityMessages("pt-BR");
    expect(copy.oneAvailable).toBe("1×1 disponível");
    expect(copy.twoPending).toBe("2×2 em validação");
    expect(copy.unavailable).toBe("Ainda indisponível.");
    expect(copy.signInAction).toBe("Entrar ou criar conta");
    expect(copy.backToDashboard).toBe("Voltar ao painel");
  });
  it("does not advertise the cooperative mode as playable in English", () => {
    const copy = multiplayerAvailabilityMessages("en");
    expect(copy.oneAvailable).toBe("1×1 available");
    expect(copy.twoPending).toBe("2×2 under validation");
    expect(copy.unavailable).toBe("Not available yet.");
    expect(copy.intro).toBe(
      "Create a room, share the code, and play the same match live on separate devices.",
    );
    expect(copy.signInAction).toBe("Sign in or create an account");
    expect(copy.backToDashboard).toBe("Back to dashboard");
  });
  it("renders consistent Spanish navigation and explanatory copy", () => {
    const copy = multiplayerAvailabilityMessages("es");
    expect(copy.intro).toContain("Crea una sala");
    expect(copy.signInAction).toBe("Iniciar sesión o crear cuenta");
    expect(copy.backToDashboard).toBe("Volver al panel");
  });
});
