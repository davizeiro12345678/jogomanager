import { describe, expect, it } from "vitest";
import { AUTH_RECOVERY_MESSAGES, authRecoveryMessages } from "./auth-recovery-messages";
import { CREATOR_MESSAGES, creatorMessages } from "./creator-messages";
import { MULTIPLAYER_LIVE_MESSAGES, multiplayerLiveMessages } from "./multiplayer-live-messages";
import { SUPPORT_MESSAGES, supportMessages } from "./support-messages";

describe("feature-local quality update translations", () => {
  it.each([
    ["auth recovery", AUTH_RECOVERY_MESSAGES],
    ["creator", CREATOR_MESSAGES],
    ["live multiplayer", MULTIPLAYER_LIVE_MESSAGES],
    ["support", SUPPORT_MESSAGES],
  ] as const)(
    "keeps complete Portuguese, English and Spanish key parity for %s",
    (_name, messages) => {
      const keys = Object.keys(messages.pt).sort();
      expect(Object.keys(messages.en).sort()).toEqual(keys);
      expect(Object.keys(messages.es).sort()).toEqual(keys);
      const dictionaries: readonly Readonly<Record<string, string>>[] = [
        messages.pt,
        messages.en,
        messages.es,
      ];
      for (const dictionary of dictionaries)
        for (const value of Object.values(dictionary))
          expect(value.trim().length).toBeGreaterThan(0);
    },
  );

  it("uses the active provider locale with the existing English fallback", () => {
    expect(supportMessages("pt-BR").submit).toBe("Enviar pedido de suporte");
    expect(supportMessages("pt-PT").submit).toBe("Enviar pedido de suporte");
    expect(supportMessages("es").submit).toBe("Enviar solicitud de soporte");
    expect(supportMessages("de").submit).toBe(supportMessages("en").submit);
    expect(authRecoveryMessages("en").withProvider).toBe("Alternative sign-in with");
    expect(creatorMessages("es").origin).toBe("Lugar de creación");
    expect(multiplayerLiveMessages("en").reconnecting).toBe("Reconnecting");
  });
});
