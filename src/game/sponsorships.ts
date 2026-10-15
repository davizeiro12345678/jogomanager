import { CLUBS } from "./data/leagues";
import type { CareerState, SponsorContract } from "./types";
import {
  finiteAmount,
  financeLedgerFor,
  financialChange,
  safeMoney,
  validFinancialState,
} from "./financial-inputs";

const money = safeMoney;
const finite = (n: number) => Number.isFinite(n) && n >= 0;

/** Invalid personal save data cannot manufacture a commercial payout. */
export function sponsorContractFor(state: CareerState): SponsorContract | null {
  const c = state.sponsorContract;
  if (
    !c ||
    typeof c !== "object" ||
    typeof c.id !== "string" ||
    typeof c.name !== "string" ||
    !c.id.startsWith(`sponsor-${state.clubId}-`) ||
    !c.name.trim() ||
    ![c.weeklyBase, c.winBonus, c.signingBonus].every(finite)
  )
    return null;
  if (c.weeklyBase > 10 || c.winBonus > 5 || c.signingBonus > 20) return null;
  if (
    ![c.startsSeason, c.startsRound, c.endsSeason, c.endsRound, c.objectiveTop].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    )
  )
    return null;
  if (
    c.endsSeason < c.startsSeason ||
    (c.endsSeason === c.startsSeason && c.endsRound < c.startsRound)
  )
    return null;
  if (state.season < c.startsSeason || state.season > c.endsSeason) return null;
  if (state.season === c.startsSeason && state.round < c.startsRound) return null;
  if (state.season === c.endsSeason && state.round > c.endsRound) return null;
  return c;
}

export function sponsorBaseFor(state: CareerState): number {
  if (state.sponsorContract) return sponsorContractFor(state)?.weeklyBase ?? 0;
  return finite(state.sponsor) ? state.sponsor : 0;
}

export function sponsorIncomeFor(
  state: CareerState,
  result: { won: boolean; played?: boolean; position: number },
): number {
  const c = sponsorContractFor(state);
  return money(
    sponsorBaseFor(state) +
      (c && result.played !== false && result.won && result.position <= c.objectiveTop
        ? c.winBonus
        : 0),
  );
}

/** Offers are deterministic and bounded by club strength and current confidence. */
export function sponsorshipOffers(state: CareerState): SponsorContract[] {
  if (
    !Number.isSafeInteger(state.season) ||
    state.season < 1 ||
    !Number.isSafeInteger(state.round) ||
    state.round < 1
  )
    return [];
  const strength = CLUBS[state.clubId]?.strength ?? 60;
  const base = Math.min(
    4,
    Math.max(
      0.12,
      (strength / 70) *
        (0.55 +
          Math.max(0, Math.min(100, Number.isFinite(state.approval) ? state.approval : 50)) / 200),
    ),
  );
  const endsRound = (Array.isArray(state.fixtures) ? state.fixtures : []).reduce(
    (latest, f) =>
      f && Number.isSafeInteger(f.round) && f.round > 0 ? Math.max(latest, f.round) : latest,
    state.round,
  );
  return [
    { key: "local", name: "Horizonte Regional", factor: 1, bonus: 0, upfront: 0.35, top: 99 },
    {
      key: "performance",
      name: "Atlas Sports",
      factor: 0.78,
      bonus: 0.32,
      upfront: 0.6,
      top: Number.isFinite(state.objective)
        ? Math.max(1, Math.min(99, Math.round(state.objective)))
        : 10,
    },
    { key: "growth", name: "Nova Energia", factor: 1.1, bonus: 0.08, upfront: 0.1, top: 6 },
  ].map((o) => ({
    id: `sponsor-${state.clubId}-${state.season}-${o.key}`,
    name: o.name,
    startsSeason: state.season,
    startsRound: state.round,
    endsSeason: state.season,
    endsRound,
    weeklyBase: money(base * o.factor),
    winBonus: money(base * o.bonus),
    signingBonus: money(base * o.upfront),
    objectiveTop: o.top,
  }));
}

/** The signing bonus is posted once; scene replay never executes this function. */
export function signSponsorship(state: CareerState, offerId: string): CareerState {
  if (!validFinancialState(state) || sponsorContractFor(state)) return state;
  const offer = sponsorshipOffers(state).find((o) => o.id === offerId);
  if (
    !offer ||
    state.sponsorContract?.id === offer.id ||
    financeLedgerFor(state).some((e) => e.id === offer.id) ||
    !finiteAmount(state.finances.budget + offer.signingBonus, true) ||
    !finiteAmount(state.finances.income + offer.signingBonus)
  )
    return state;
  const finances = financialChange(state, offer.signingBonus, 0);
  if (!finances) return state;
  return {
    ...state,
    sponsorContract: offer,
    finances,
    financeLedger: [
      {
        id: offer.id,
        season: state.season,
        round: state.round,
        kind: "operacao" as const,
        label: `Assinatura · ${offer.name}`,
        income: offer.signingBonus,
        expense: 0,
      },
      ...financeLedgerFor(state),
    ].slice(0, 96),
  };
}
