import { describe, expect, it, vi } from "vitest";

import { persistGuestCheckoutIntentIfAllowed } from "./guest-checkout-policy.server";

describe("guest checkout catalog validation gate", () => {
  it("persists verified catalog categories without bypassing payment", async () => {
    const persist = vi.fn().mockResolvedValue({ id: "pending_intent" });
    for (const product of [
      { key: "coins_small", kind: "coins", contents: { coins: 500, scoutReports: 0, trainingBoosts: 0, themes: [] } },
      { key: "scout_pack", kind: "scout", contents: { coins: 0, scoutReports: 10, trainingBoosts: 0, themes: [] } },
      { key: "training_pack", kind: "training", contents: { coins: 0, scoutReports: 0, trainingBoosts: 1, themes: [] } },
      { key: "season_pass", kind: "pass", contents: { coins: 0, scoutReports: 0, trainingBoosts: 0, themes: [] } },
      { key: "theme_pack", kind: "cosmetic", contents: { coins: 0, scoutReports: 0, trainingBoosts: 0, themes: ["premium_gold"] } },
    ]) {
      await expect(persistGuestCheckoutIntentIfAllowed(product, persist)).resolves.toEqual({ id: "pending_intent" });
    }
    expect(persist).toHaveBeenCalledTimes(5);
  });

  it("rejects malformed or unsupported SKUs before any persistence", async () => {
    const persist = vi.fn();
    await expect(persistGuestCheckoutIntentIfAllowed(
      { key: "invalid", kind: "unknown", contents: { coins: 100, scoutReports: 0, trainingBoosts: 0, themes: [] } },
      persist,
    )).rejects.toThrow(/contrato seguro/);
    expect(persist).not.toHaveBeenCalled();
  });
});
