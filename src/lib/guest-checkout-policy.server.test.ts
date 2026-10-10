import { describe, expect, it, vi } from "vitest";

import { persistGuestCheckoutIntentIfAllowed } from "./guest-checkout-policy.server";

describe("guest checkout anti-pay-to-win persistence gate", () => {
  it("does not persist an intent for blocked legacy competitive SKUs", async () => {
    const persistIntent = vi.fn().mockResolvedValue({ id: "intent_should_not_exist" });

    for (const product of [
      {
        key: "coins_small",
        kind: "coins",
        contents: { coins: 500, scoutReports: 0, trainingBoosts: 0, themes: [] },
      },
      {
        key: "scout_pack",
        kind: "scout",
        contents: { coins: 0, scoutReports: 10, trainingBoosts: 0, themes: [] },
      },
      {
        key: "training_pack",
        kind: "training",
        contents: { coins: 0, scoutReports: 0, trainingBoosts: 1, themes: [] },
      },
      {
        key: "season_pass",
        kind: "pass",
        contents: { coins: 0, scoutReports: 0, trainingBoosts: 0, themes: [] },
      },
    ]) {
      await expect(persistGuestCheckoutIntentIfAllowed(product, persistIntent)).rejects.toThrow(
        /anti-pay-to-win/i,
      );
    }

    expect(persistIntent).not.toHaveBeenCalled();
  });

  it("persists a zero-advantage cosmetic checkout intent normally", async () => {
    const persistIntent = vi.fn().mockResolvedValue({ id: "cosmetic_intent" });

    await expect(
      persistGuestCheckoutIntentIfAllowed(
        {
          key: "theme_pack",
          kind: "cosmetic",
          contents: { coins: 0, scoutReports: 0, trainingBoosts: 0, themes: ["premium_gold"] },
        },
        persistIntent,
      ),
    ).resolves.toEqual({ id: "cosmetic_intent" });
    expect(persistIntent).toHaveBeenCalledTimes(1);
  });
});
