import { describe, expect, it } from "vitest";

import {
  LOCAL_VIP_OFFERS,
  applyEntitlementEvent,
  assertCheckoutProductNonPayToWin,
  assertLocalVipCatalogPolicy,
  assertNonPayToWin,
  effectiveEntitlementState,
  emptyEntitlementState,
  migrateLegacyWalletEntitlement,
  type EntitlementState,
} from "./entitlement-contract";

const JANUARY = Date.parse("2026-01-15T00:00:00.000Z");
const FEBRUARY = Date.parse("2026-02-15T00:00:00.000Z");

describe("VIP entitlement contract", () => {
  it("migrates a legacy active pass and keeps legacy themes as permanent cosmetics", () => {
    const state = migrateLegacyWalletEntitlement(
      {
        season_pass: true,
        season_pass_until: "2026-02-01T00:00:00.000Z",
        unlocked_themes: ["premium_gold", "premium_gold", "stadium_tifo"],
        equipped_theme: "premium_gold",
      },
      JANUARY,
    );

    expect(state.tier).toBe("vip");
    expect(state.validUntil).toBe("2026-02-01T00:00:00.000Z");
    expect(state.grants).toEqual([
      expect.objectContaining({ cosmeticKey: "premium_gold", family: "theme", permanent: true }),
      expect.objectContaining({ cosmeticKey: "stadium_tifo", family: "theme", permanent: true }),
    ]);
    expect(state.equipped).toEqual([{ family: "theme", cosmeticKey: "premium_gold" }]);
  });

  it("does not convert an expired legacy boolean into perpetual VIP", () => {
    const state = migrateLegacyWalletEntitlement(
      { season_pass: true, season_pass_until: "2026-01-01T00:00:00.000Z" },
      JANUARY,
    );
    expect(state).toMatchObject({ tier: "none", validUntil: null });
  });

  it("is idempotent for duplicated provider events", () => {
    const event = {
      kind: "cosmetic_granted" as const,
      idempotencyKey: "stripe-event:evt_cosmetic_0001",
      occurredAt: "2026-01-10T00:00:00.000Z",
      grant: {
        cosmeticKey: "celebration_extra",
        family: "celebration" as const,
        permanent: true,
        validUntil: null,
        sourceReference: "stripe-event:evt_cosmetic_0001",
      },
    };
    const first = applyEntitlementEvent(emptyEntitlementState(), event);
    const duplicate = applyEntitlementEvent(first.state, event);

    expect(first.applied).toBe(true);
    expect(duplicate).toMatchObject({ applied: false, reason: "duplicate" });
    expect(duplicate.state.grants).toHaveLength(1);
    expect(duplicate.state.ledger).toHaveLength(1);
  });

  it("applies an upgrade and later downgrade as ordered server events", () => {
    const vip = applyEntitlementEvent(emptyEntitlementState(), {
      kind: "subscription_set",
      idempotencyKey: "stripe-event:evt_vip_started",
      occurredAt: "2026-01-01T00:00:00.000Z",
      tier: "vip",
      validUntil: "2026-02-01T00:00:00.000Z",
    });
    const upgraded = applyEntitlementEvent(vip.state, {
      kind: "subscription_set",
      idempotencyKey: "stripe-event:evt_vip_max_started",
      occurredAt: "2026-01-10T00:00:00.000Z",
      tier: "vip_max",
      validUntil: "2026-02-10T00:00:00.000Z",
    });
    const downgraded = applyEntitlementEvent(upgraded.state, {
      kind: "subscription_set",
      idempotencyKey: "stripe-event:evt_vip_downgraded",
      occurredAt: "2026-01-20T00:00:00.000Z",
      tier: "vip",
      validUntil: "2026-02-20T00:00:00.000Z",
    });

    expect(upgraded.state).toMatchObject({
      tier: "vip_max",
      validUntil: "2026-02-10T00:00:00.000Z",
    });
    expect(downgraded.state).toMatchObject({ tier: "vip", validUntil: "2026-02-20T00:00:00.000Z" });
    const stale = applyEntitlementEvent(downgraded.state, {
      kind: "subscription_set",
      idempotencyKey: "stripe-event:evt_late_retry",
      occurredAt: "2026-01-05T00:00:00.000Z",
      tier: "vip_max",
      validUntil: "2026-02-05T00:00:00.000Z",
    });
    expect(stale).toMatchObject({ applied: false, reason: "stale" });
  });

  it("removes expired temporary access without deleting permanent cosmetics", () => {
    const state: EntitlementState = {
      tier: "vip_max",
      validUntil: "2026-02-01T00:00:00.000Z",
      grants: [
        {
          cosmeticKey: "premium_gold",
          family: "theme",
          permanent: true,
          validUntil: null,
          sourceReference: "purchase:permanent-theme",
        },
        {
          cosmeticKey: "vip_stadium_night",
          family: "stadium",
          permanent: false,
          validUntil: "2026-02-01T00:00:00.000Z",
          sourceReference: "subscription:vip-max-february",
        },
      ],
      equipped: [
        { family: "theme", cosmeticKey: "premium_gold" },
        { family: "stadium", cosmeticKey: "vip_stadium_night" },
      ],
      ledger: [],
    };

    const effective = effectiveEntitlementState(state, FEBRUARY);

    expect(effective.tier).toBe("none");
    expect(effective.validUntil).toBeNull();
    expect(effective.grants).toEqual([
      expect.objectContaining({ cosmeticKey: "premium_gold", permanent: true }),
    ]);
    expect(effective.equipped).toEqual([{ family: "theme", cosmeticKey: "premium_gold" }]);
    expect(state.grants).toHaveLength(2);
  });

  it("only equips a cosmetic the player currently owns", () => {
    expect(() =>
      applyEntitlementEvent(emptyEntitlementState(), {
        kind: "cosmetic_equipped",
        idempotencyKey: "server-event:equip-unowned",
        occurredAt: "2026-01-10T00:00:00.000Z",
        family: "kit",
        cosmeticKey: "kit_unowned",
      }),
    ).toThrow(/não concedido/i);
  });

  it("keeps the local VIP catalog inactive, without provider price IDs, and rejects pay-to-win benefits", () => {
    expect(() => assertLocalVipCatalogPolicy()).not.toThrow();
    expect(LOCAL_VIP_OFFERS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "vip", displayPriceCents: 1990, checkoutEligible: false }),
        expect.objectContaining({
          key: "vip_max",
          displayPriceCents: 3990,
          checkoutEligible: false,
        }),
      ]),
    );
    for (const offer of LOCAL_VIP_OFFERS) expect("priceId" in offer).toBe(false);
    expect(() =>
      assertNonPayToWin([{ kind: "training_competitive", id: "training_boost" }]),
    ).toThrow(/anti-pay-to-win/i);
    expect(() => assertNonPayToWin([{ kind: "player_attribute", id: "attribute_boost" }])).toThrow(
      /anti-pay-to-win/i,
    );
    expect(() => assertNonPayToWin([{ kind: "score", id: "goal_bonus" }])).toThrow(
      /anti-pay-to-win/i,
    );
  });

  it("allows cosmetic checkout products while denying every competitive legacy product shape", () => {
    expect(() =>
      assertCheckoutProductNonPayToWin({
        key: "theme_pack",
        kind: "cosmetic",
        contents: { coins: 0, scoutReports: 0, trainingBoosts: 0, themes: ["premium_gold"] },
      }),
    ).not.toThrow();

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
      expect(() => assertCheckoutProductNonPayToWin(product)).toThrow(/anti-pay-to-win/i);
    }
  });
});
