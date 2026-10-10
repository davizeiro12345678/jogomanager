/**
 * Provider-agnostic commerce rules for VIP access and cosmetic ownership.
 *
 * This module is deliberately pure: Stripe/webhooks/database code can project
 * its rows into this shape, but neither provider IDs nor secrets are allowed
 * into saves or browser-controlled entitlement decisions.
 */

export const ENTITLEMENT_TIERS = ["none", "vip", "vip_max"] as const;
export type EntitlementTier = (typeof ENTITLEMENT_TIERS)[number];

export const COSMETIC_FAMILIES = [
  "theme",
  "crest",
  "kit",
  "celebration",
  "stadium",
  "crowd",
  "tunnel",
  "trophy",
  "hud",
  "replay",
  "profile",
] as const;
export type CosmeticFamily = (typeof COSMETIC_FAMILIES)[number];

export interface CosmeticGrant {
  cosmeticKey: string;
  family: CosmeticFamily;
  /** Permanent grants survive an expired subscription. */
  permanent: boolean;
  /** A non-permanent grant must have a bounded, server-attested expiry. */
  validUntil: string | null;
  sourceReference: string;
}

export interface EquippedCosmetic {
  family: CosmeticFamily;
  cosmeticKey: string;
}

export type EntitlementLedgerAction = "subscription_set" | "cosmetic_granted" | "cosmetic_equipped";

export interface EntitlementLedgerEntry {
  idempotencyKey: string;
  action: EntitlementLedgerAction;
  occurredAt: string;
  tier?: EntitlementTier;
  cosmeticKey?: string;
  family?: CosmeticFamily;
}

export interface EntitlementState {
  /** Persisted subscription tier. Use effectiveEntitlementState before granting access. */
  tier: EntitlementTier;
  validUntil: string | null;
  grants: readonly CosmeticGrant[];
  equipped: readonly EquippedCosmetic[];
  /** Projection of the server ledger; its idempotency key is never browser-generated. */
  ledger: readonly EntitlementLedgerEntry[];
}

export interface LegacyWalletEntitlementInput {
  season_pass?: boolean | null;
  season_pass_until?: string | null;
  unlocked_themes?: readonly string[] | null;
  equipped_theme?: string | null;
}

export type EntitlementEvent =
  | {
      kind: "subscription_set";
      idempotencyKey: string;
      occurredAt: string;
      tier: EntitlementTier;
      validUntil: string | null;
    }
  | {
      kind: "cosmetic_granted";
      idempotencyKey: string;
      occurredAt: string;
      grant: CosmeticGrant;
    }
  | {
      kind: "cosmetic_equipped";
      idempotencyKey: string;
      occurredAt: string;
      family: CosmeticFamily;
      cosmeticKey: string;
    };

export interface EntitlementTransition {
  state: EntitlementState;
  applied: boolean;
  reason?: "duplicate" | "stale";
}

/** Intentionally closed vocabulary: a new commercial benefit needs an explicit policy review. */
export type CommercialBenefitKind =
  | "cosmetic"
  | "cosmetic_library"
  | "profile_badge"
  | "profile_personalization"
  | "replay_slot"
  | "club_draft_slot"
  | "ad_removal"
  | "score"
  | "match_result"
  | "team_strength"
  | "player_attribute"
  | "training_competitive"
  | "recovery_competitive"
  | "scouting_competitive"
  | "matchmaking"
  | "competitive_currency"
  | "competitive_subscription"
  | "unclassified_commercial_product";

export interface CommercialBenefit {
  kind: CommercialBenefitKind;
  id: string;
}

export interface LocalVipOffer {
  key: "vip" | "vip_max";
  tier: Exclude<EntitlementTier, "none">;
  displayPriceCents: number;
  currency: "BRL";
  interval: "month";
  /** Prevents this local product definition from opening checkout before a real provider price is approved. */
  checkoutEligible: false;
  benefits: readonly CommercialBenefit[];
}

/**
 * The payment catalog's server-only shape. It deliberately omits provider
 * identifiers: the policy decides whether a product may reach price lookup,
 * not which Stripe Price it would use.
 */
export interface CheckoutProductPolicyInput {
  key: string;
  kind: string;
  contents: {
    coins: number;
    scoutReports: number;
    trainingBoosts: number;
    themes: readonly string[];
  };
}

const COSMETIC_KEY = /^[a-z0-9][a-z0-9_-]{1,95}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9:._-]{7,191}$/;

const ALLOWED_BENEFITS: ReadonlySet<CommercialBenefitKind> = new Set([
  "cosmetic",
  "cosmetic_library",
  "profile_badge",
  "profile_personalization",
  "replay_slot",
  "club_draft_slot",
  "ad_removal",
]);

/**
 * Draft-only local catalog. There are deliberately no Stripe Price IDs here,
 * and no code in this module can start a checkout.
 */
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

export function emptyEntitlementState(): EntitlementState {
  return { tier: "none", validUntil: null, grants: [], equipped: [], ledger: [] };
}

export function isEntitlementTier(value: unknown): value is EntitlementTier {
  return typeof value === "string" && (ENTITLEMENT_TIERS as readonly string[]).includes(value);
}

export function isCosmeticFamily(value: unknown): value is CosmeticFamily {
  return typeof value === "string" && (COSMETIC_FAMILIES as readonly string[]).includes(value);
}

function normalizedTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function isStillValid(value: string | null, now: number): boolean {
  return value !== null && Date.parse(value) > now;
}

function validCosmeticKey(value: unknown): value is string {
  return typeof value === "string" && COSMETIC_KEY.test(value);
}

function assertIdempotencyKey(value: string): void {
  if (!IDEMPOTENCY_KEY.test(value)) {
    throw new Error("A referência idempotente de entitlement é inválida.");
  }
}

function assertGrant(grant: CosmeticGrant): CosmeticGrant {
  if (!validCosmeticKey(grant.cosmeticKey) || !isCosmeticFamily(grant.family)) {
    throw new Error("O cosmético concedido é inválido.");
  }
  if (typeof grant.sourceReference !== "string" || grant.sourceReference.trim().length < 1) {
    throw new Error("A concessão de cosmético precisa de uma referência auditável.");
  }
  const validUntil = normalizedTimestamp(grant.validUntil);
  if (grant.permanent && grant.validUntil !== null) {
    throw new Error("Um cosmético permanente não pode expirar.");
  }
  if (!grant.permanent && !validUntil) {
    throw new Error("Um cosmético temporário precisa de validade.");
  }
  return { ...grant, validUntil: grant.permanent ? null : validUntil };
}

function record(state: EntitlementState, entry: EntitlementLedgerEntry): EntitlementState {
  return { ...state, ledger: [...state.ledger, entry] };
}

function latestSubscriptionEvent(state: EntitlementState): EntitlementLedgerEntry | undefined {
  return [...state.ledger].reverse().find((entry) => entry.action === "subscription_set");
}

function mergeGrant(existing: CosmeticGrant | undefined, incoming: CosmeticGrant): CosmeticGrant {
  if (!existing) return incoming;
  if (existing.permanent) return existing;
  if (incoming.permanent) return incoming;
  const existingEndsAt = Date.parse(existing.validUntil!);
  const incomingEndsAt = Date.parse(incoming.validUntil!);
  return incomingEndsAt >= existingEndsAt ? incoming : existing;
}

/**
 * Migrates the legacy wallet without treating an old boolean as perpetual VIP.
 * Legacy unlocked themes become permanent grants; an expired pass grants no
 * active subscription access.
 */
export function migrateLegacyWalletEntitlement(
  legacy: LegacyWalletEntitlementInput,
  now = Date.now(),
): EntitlementState {
  const validUntil = normalizedTimestamp(legacy.season_pass_until);
  const hasActivePass = legacy.season_pass === true && isStillValid(validUntil, now);
  const themes = Array.from(
    new Set(
      (Array.isArray(legacy.unlocked_themes) ? legacy.unlocked_themes : []).filter(
        validCosmeticKey,
      ),
    ),
  );
  const grants: CosmeticGrant[] = themes.map((cosmeticKey) => ({
    cosmeticKey,
    family: "theme",
    permanent: true,
    validUntil: null,
    sourceReference: `legacy-wallet:${cosmeticKey}`,
  }));
  const equippedTheme = validCosmeticKey(legacy.equipped_theme) ? legacy.equipped_theme : null;
  const equipped =
    equippedTheme && themes.includes(equippedTheme)
      ? [{ family: "theme" as const, cosmeticKey: equippedTheme }]
      : [];
  return {
    tier: hasActivePass ? "vip" : "none",
    validUntil: hasActivePass ? validUntil : null,
    grants,
    equipped,
    ledger: [],
  };
}

/**
 * Projects access at a point in time. It never deletes stored permanent
 * grants, so a subscription expiry cannot erase a paid cosmetic.
 */
export function effectiveEntitlementState(
  state: EntitlementState,
  now = Date.now(),
): EntitlementState {
  const activeTier =
    state.tier !== "none" && isStillValid(state.validUntil, now) ? state.tier : "none";
  const grants = state.grants.filter(
    (grant) => grant.permanent || isStillValid(normalizedTimestamp(grant.validUntil), now),
  );
  const equipped = state.equipped.filter((item) =>
    grants.some((grant) => grant.family === item.family && grant.cosmeticKey === item.cosmeticKey),
  );
  return {
    ...state,
    tier: activeTier,
    validUntil: activeTier === "none" ? null : normalizedTimestamp(state.validUntil),
    grants,
    equipped,
  };
}

/** Applies one server-attested action exactly once in the aggregate projection. */
export function applyEntitlementEvent(
  state: EntitlementState,
  event: EntitlementEvent,
): EntitlementTransition {
  assertIdempotencyKey(event.idempotencyKey);
  const occurredAt = normalizedTimestamp(event.occurredAt);
  if (!occurredAt) throw new Error("A data do evento de entitlement é inválida.");
  if (state.ledger.some((entry) => entry.idempotencyKey === event.idempotencyKey)) {
    return { state, applied: false, reason: "duplicate" };
  }

  if (event.kind === "subscription_set") {
    const validUntil = normalizedTimestamp(event.validUntil);
    if (
      !isEntitlementTier(event.tier) ||
      (event.tier === "none" ? event.validUntil !== null : !validUntil)
    ) {
      throw new Error("A alteração de assinatura é inválida.");
    }
    const previous = latestSubscriptionEvent(state);
    if (previous && Date.parse(occurredAt) < Date.parse(previous.occurredAt)) {
      return { state, applied: false, reason: "stale" };
    }
    const next = record(
      { ...state, tier: event.tier, validUntil: event.tier === "none" ? null : validUntil },
      { idempotencyKey: event.idempotencyKey, action: event.kind, occurredAt, tier: event.tier },
    );
    return { state: next, applied: true };
  }

  if (event.kind === "cosmetic_granted") {
    const grant = assertGrant(event.grant);
    const existing = state.grants.find(
      (candidate) =>
        candidate.family === grant.family && candidate.cosmeticKey === grant.cosmeticKey,
    );
    const merged = mergeGrant(existing, grant);
    const nextGrants = existing
      ? state.grants.map((candidate) =>
          candidate.family === grant.family && candidate.cosmeticKey === grant.cosmeticKey
            ? merged
            : candidate,
        )
      : [...state.grants, merged];
    const next = record(
      { ...state, grants: nextGrants },
      {
        idempotencyKey: event.idempotencyKey,
        action: event.kind,
        occurredAt,
        family: grant.family,
        cosmeticKey: grant.cosmeticKey,
      },
    );
    return { state: next, applied: true };
  }

  if (!validCosmeticKey(event.cosmeticKey) || !isCosmeticFamily(event.family)) {
    throw new Error("O cosmético equipado é inválido.");
  }
  const effective = effectiveEntitlementState(state, Date.parse(occurredAt));
  if (
    !effective.grants.some(
      (grant) => grant.family === event.family && grant.cosmeticKey === event.cosmeticKey,
    )
  ) {
    throw new Error("Não é possível equipar um cosmético não concedido ou expirado.");
  }
  const nextEquipped = [
    ...state.equipped.filter((item) => item.family !== event.family),
    { family: event.family, cosmeticKey: event.cosmeticKey },
  ];
  const next = record(
    { ...state, equipped: nextEquipped },
    {
      idempotencyKey: event.idempotencyKey,
      action: event.kind,
      occurredAt,
      family: event.family,
      cosmeticKey: event.cosmeticKey,
    },
  );
  return { state: next, applied: true };
}

export function isCommercialBenefitAllowed(benefit: CommercialBenefit): boolean {
  return validCosmeticKey(benefit.id) && ALLOWED_BENEFITS.has(benefit.kind);
}

/** Rejects score, attribute, recovery, training, scouting and matchmaking advantages. */
export function assertNonPayToWin(benefits: readonly CommercialBenefit[]): void {
  const denied = benefits.find((benefit) => !isCommercialBenefitAllowed(benefit));
  if (denied) {
    throw new Error(`Benefício comercial proibido pela política anti-pay-to-win: ${denied.kind}.`);
  }
}

/**
 * Deny competitive legacy catalog rows before a payment provider is queried.
 * Only a zero-advantage cosmetic product may proceed; all new commercial
 * kinds are denied until they receive a deliberate policy review.
 */
export function assertCheckoutProductNonPayToWin(product: CheckoutProductPolicyInput): void {
  const { coins, scoutReports, trainingBoosts, themes } = product.contents;
  if (
    !validCosmeticKey(product.key) ||
    typeof product.kind !== "string" ||
    product.kind.length === 0 ||
    !Number.isSafeInteger(coins) ||
    coins < 0 ||
    !Number.isSafeInteger(scoutReports) ||
    scoutReports < 0 ||
    !Number.isSafeInteger(trainingBoosts) ||
    trainingBoosts < 0 ||
    !Array.isArray(themes) ||
    themes.some((theme) => !validCosmeticKey(theme))
  ) {
    throw new Error("O produto comercial não atende ao contrato seguro de checkout.");
  }

  const benefits: CommercialBenefit[] = [];
  // The legacy pass gives monthly competitive resources even though its old
  // contents snapshot contains zeros, so it must be denied by identity too.
  if (product.key === "season_pass" || product.kind === "pass") {
    benefits.push({ kind: "competitive_subscription", id: "legacy_season_pass" });
  }
  if (coins > 0) benefits.push({ kind: "competitive_currency", id: "competitive_currency" });
  if (scoutReports > 0) benefits.push({ kind: "scouting_competitive", id: "scouting_reports" });
  if (trainingBoosts > 0) benefits.push({ kind: "training_competitive", id: "training_boosts" });
  // The active safe surface is intentionally narrow. An unrecognized catalog
  // kind cannot become purchasable merely because its current counters are 0.
  if (product.kind !== "cosmetic") {
    benefits.push({ kind: "unclassified_commercial_product", id: "unclassified_product" });
  }
  assertNonPayToWin(benefits);
}

/** Ensures the draft catalog remains non-competitive and inactive until explicitly activated elsewhere. */
export function assertLocalVipCatalogPolicy(
  catalog: readonly LocalVipOffer[] = LOCAL_VIP_OFFERS,
): void {
  for (const offer of catalog) {
    if (
      offer.checkoutEligible !== false ||
      offer.displayPriceCents < 0 ||
      offer.currency !== "BRL"
    ) {
      throw new Error("A oferta VIP local não está em estado seguro para ativação.");
    }
    assertNonPayToWin(offer.benefits);
  }
}
