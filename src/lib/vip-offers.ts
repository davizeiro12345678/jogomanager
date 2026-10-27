/** Non-checkout VIP tier previews. Stripe products and Prices remain inactive. */
import type { LocalVipOffer } from "./entitlement-contract";

export const LOCAL_VIP_OFFERS: readonly LocalVipOffer[] = [
  {
    key: "vip",
    tier: "vip",
    displayPriceCents: 1990,
    currency: "BRL",
    interval: "month",
    checkoutEligible: false,
    benefits: [
      { kind: "profile_badge", id: "vip_badge" },
      { kind: "profile_personalization", id: "vip_profile_personalization" },
      { kind: "cosmetic_library", id: "vip_basic_cosmetic_library" },
      { kind: "replay_slot", id: "vip_replay_slots" },
      { kind: "club_draft_slot", id: "vip_club_draft_slots" },
      { kind: "ad_removal", id: "vip_first_party_ads_removed" },
    ],
  },
  {
    key: "vip_max",
    tier: "vip_max",
    displayPriceCents: 3990,
    currency: "BRL",
    interval: "month",
    checkoutEligible: false,
    benefits: [
      { kind: "profile_badge", id: "vip_max_badge" },
      { kind: "profile_personalization", id: "vip_max_profile_personalization" },
      { kind: "cosmetic_library", id: "vip_max_complete_cosmetic_library" },
      { kind: "replay_slot", id: "vip_max_replay_slots" },
      { kind: "club_draft_slot", id: "vip_max_club_draft_slots" },
      { kind: "ad_removal", id: "vip_max_first_party_ads_removed" },
    ],
  },
];
