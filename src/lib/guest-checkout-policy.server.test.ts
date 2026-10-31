import { describe, expect, it, vi } from "vitest";

import { persistGuestCheckoutIntentIfAllowed } from "./guest-checkout-policy.server";

describe("guest checkout package policy gate", () => {
  it("does not persist an intent for an unreviewed package kind", async () => {
    const persistIntent = vi.fn().mockResolvedValue({ id: "intent_should_not_exist" });

    await expect(
      persistGuestCheckoutIntentIfAllowed(
        {
          key: "mystery_box",
          kind: "lootbox",
          contents: { coins: 10, scoutReports: 0, trainingBoosts: 0, themes: [] },
        },
        persistIntent,
      ),
    ).rejects.toThrow(/não está liberado/);

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
