import { describe, expect, it } from "vitest";
import { initCareer, migrateCareer } from "./career";
import { valueFor } from "./economy";
import { addMoney, eurosToMoney, financialChange, moneyToEuros } from "./financial-inputs";
import {
  projectFinanceHorizon,
  projectWeeklyFinance,
  settleWeeklyFinance,
} from "./finance-forecast";
import { quoteContract } from "./economy-contracts";
import { sellToClub } from "./realMarket";
import { CLUBS } from "./data/leagues";
import { signSponsorship, sponsorshipOffers } from "./sponsorships";

describe("integer euro financial transactions", () => {
  it("preserves every new amount from one through 9999 euros in income and expense", () => {
    const state = initCareer("bra", "fla", "Euro fixture");
    state.finances = { budget: 12.345678, income: 0.123456, spent: 0.654321 };
    for (let euros = 1; euros <= 9999; euros++) {
      const amount = eurosToMoney(euros);
      const credit = financialChange(state, amount, 0)!;
      const debit = financialChange(state, 0, amount)!;
      expect(moneyToEuros(credit.budget) - moneyToEuros(state.finances.budget)).toBe(euros);
      expect(moneyToEuros(credit.income) - moneyToEuros(state.finances.income)).toBe(euros);
      expect(moneyToEuros(state.finances.budget) - moneyToEuros(debit.budget)).toBe(euros);
      expect(moneyToEuros(debit.spent) - moneyToEuros(state.finances.spent)).toBe(euros);
    }
    expect(addMoney(0.1, 0.2)).toBe(0.3);
  });
  it("retains historical balances, wages and contracts on loading an unversioned save", () => {
    const current = initCareer("bra", "fla", "Legacy");
    const legacy = {
      ...current,
      economyRulesVersion: undefined,
      developmentRulesVersion: undefined,
      finances: { budget: 12.345678, income: 3.123456, spent: 7.456789 },
      financeLedger: [
        {
          id: "old",
          season: 1,
          round: 1,
          kind: "mercado" as const,
          label: "Old",
          income: 0.000001,
          expense: 0.123456,
        },
      ],
      players: Object.fromEntries(
        Object.entries(current.players).map(([id, p]) => [
          id,
          { ...p, developmentBase: undefined, wage: 12.345, contractYears: 4 },
        ]),
      ),
    };
    const restored = migrateCareer(JSON.parse(JSON.stringify(legacy)));
    expect(restored.economyRulesVersion).toBeUndefined();
    expect(restored.developmentRulesVersion).toBeUndefined();
    expect(restored.finances).toEqual(legacy.finances);
    expect(restored.financeLedger).toEqual(legacy.financeLedger);
    for (const p of Object.values(restored.players)) {
      expect(p.wage).toBe(12.345);
      expect(p.contractYears).toBe(4);
    }
  });
  it("retains idempotency after ledger truncation and rejects malformed money", () => {
    const state = initCareer("bra", "fla", "Cursor");
    const result = { position: 3, won: false, homeGame: false };
    const first = settleWeeklyFinance(state, result);
    const truncated = { ...first.state, financeLedger: [] };
    expect(settleWeeklyFinance(truncated, result).settled).toBe(false);
    expect(settleWeeklyFinance({ ...truncated, round: 2 }, result).settled).toBe(true);
    expect(financialChange(state, Number.NaN, 0)).toBeNull();
    expect(financialChange(state, 0, -1)).toBeNull();
    expect(settleWeeklyFinance({ ...state, sponsor: Number.NaN }, result).settled).toBe(false);
  });
  it("posts a sponsorship signing bonus once even if the visible ledger is truncated", () => {
    const state = initCareer("bra", "fla", "Sponsors");
    const offer = sponsorshipOffers(state)[0]!;
    const signed = signSponsorship(state, offer.id);
    expect(moneyToEuros(signed.finances.budget) - moneyToEuros(state.finances.budget)).toBe(
      moneyToEuros(offer.signingBonus),
    );
    const truncated = { ...signed, financeLedger: [] };
    expect(signSponsorship(truncated, offer.id)).toBe(truncated);
  });
  it("quotes four weeks of reserve without modifying the existing wage obligations", () => {
    const state = initCareer("bra", "fla", "Reserve");
    const quote = quoteContract(state, 0.000001, 2.345, 0.000003);
    const horizon = projectFinanceHorizon(state, 4);
    expect(quote.signingBonus).toBe(0.00469);
    expect(quote.upfrontCost).toBe(0.004694);
    expect(quote.reserveRequired).toBe(addMoney(horizon.reserveRequired, 0.00938));
    expect(
      projectWeeklyFinance(state, { position: 5, won: false, homeGame: false }).costs.wages,
    ).toBeGreaterThan(0);
    const buyerId = Object.keys(CLUBS).find((id) => id !== state.clubId)!;
    const p = Object.values(state.players)[0]!;
    const sold = sellToClub(state, p.id, buyerId, 0.000001);
    expect(moneyToEuros(sold.finances.budget) - moneyToEuros(state.finances.budget)).toBe(1);
    expect(sellToClub(sold, p.id, buyerId, 0.000001)).toBe(sold);
  });
});

describe("versioned market value", () => {
  it("retains the old formula when no version is supplied", () => {
    for (const age of [18, 21, 22, 27, 28, 30, 31, 33, 34, 40]) {
      const factor = age <= 21 ? 1.5 : age <= 27 ? 1.35 : age <= 30 ? 1 : age <= 33 ? 0.55 : 0.25;
      expect(valueFor(80, age)).toBe(
        Math.round(Math.max(0.3, (Math.pow(28, 2.15) / 55) * factor) * 10) / 10,
      );
    }
  });
  it("interpolates continuously at age and contract anchors and keeps the floor", () => {
    const context = { economyRulesVersion: 2 as const, potential: 87, contractYears: 2 };
    for (const age of [18, 21, 27, 30, 33, 36]) {
      expect(
        Math.abs(valueFor(80, age - 0.0001, context) - valueFor(80, age + 0.0001, context)),
      ).toBeLessThan(0.001);
    }
    for (const contractYears of [0, 1, 2, 4]) {
      expect(
        Math.abs(
          valueFor(80, 27, { ...context, contractYears: contractYears - 0.0001 }) -
            valueFor(80, 27, { ...context, contractYears: contractYears + 0.0001 }),
        ),
      ).toBeLessThan(0.001);
    }
    expect(valueFor(20, 50, context)).toBe(0.3);
    expect(valueFor(80, 99, context)).toBe(valueFor(80, 36, context));
    expect(valueFor(80, 27, { economyRulesVersion: 2 })).toBe(
      valueFor(80, 27, { economyRulesVersion: 2, contractYears: 2 }),
    );
    expect(valueFor(80, 27, { ...context, potential: 200 })).toBe(
      valueFor(80, 27, { ...context, potential: 92 }),
    );
  });
});
