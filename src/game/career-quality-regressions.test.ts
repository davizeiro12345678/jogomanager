import { describe, expect, it } from "vitest";

import { initCareer, runPremiumScouting } from "./career";
import { applyFinanceEvent } from "./career-finances";
import { pickLineup } from "./career-lineup";
import { careerMatchSelection } from "./career-quick-sim";
import { repairCareer } from "./career-repair";
import { runScouting } from "./career-staff";
import { normalizedCareerTactics } from "./career-tactics";
import { quoteContract } from "./economy-contracts";
import { settleSeasonPrize } from "./finance-forecast";
import { MAX_FINANCIAL_VALUE, moneyToEuros } from "./financial-inputs";
import { quoteRealSigning, signRealPlayer, type RealTarget } from "./realMarket";
import { generateMarket, signPlayer, type MarketEntry } from "./transfers";
import type { FormationKey } from "./types";

const base = initCareer("bra", "fla", "Qualidade");
const target: RealTarget = {
  id: "quality-target",
  name: "Atleta de teste",
  clubId: "flu",
  pos: "MF",
  age: 24,
  ovr: 72,
  number: 99,
  nationality: null,
  photo: null,
};

describe("career tactical recovery", () => {
  it.each(["constructor", "toString", "__proto__", "unknown"])(
    "selects a full legal XI for the unsupported formation %s",
    (formation) => {
      const players = Object.values(base.players);
      const expected = pickLineup(players, "4-3-3");
      const selected = pickLineup(players, formation as FormationKey);
      expect(selected).toEqual(expected);
      expect(selected.lineup).toHaveLength(11);
      expect(new Set([...selected.lineup, ...selected.bench]).size).toBe(18);
    },
  );

  it("repairs corrupt tactical numbers once without rewriting valid choices or results", () => {
    const corrupt = {
      ...base,
      tactics: {
        formation: "constructor" as FormationKey,
        mentality: Number.NaN,
        pressing: Number.POSITIVE_INFINITY,
        width: -8,
        tempo: 1.7,
      },
    };
    const before = structuredClone(corrupt);
    const repaired = repairCareer(corrupt);
    expect(repaired.state.tactics).toEqual({
      formation: "4-3-3",
      mentality: 2,
      pressing: 1,
      width: 0,
      tempo: 2,
    });
    expect(repaired.fixes).toContain("Tática com valores inválidos corrigida");
    expect(repaired.state.results).toEqual(base.results);
    expect(corrupt).toEqual(before);
    expect(repairCareer(repaired.state).fixes).toEqual([]);
    expect(normalizedCareerTactics(base.tactics)).toEqual(base.tactics);
  });

  it("excludes starters, duplicates, unavailable and foreign players from the match bench", () => {
    const first = base.bench[0]!;
    const injured = base.bench[1]!;
    const suspended = base.bench[2]!;
    const foreign = { ...base.players[first]!, id: "foreign-player", clubId: "flu" };
    const corrupt = {
      ...base,
      players: {
        ...base.players,
        [injured]: { ...base.players[injured]!, injuryWeeks: 2 },
        [suspended]: { ...base.players[suspended]!, suspended: true },
        [foreign.id]: foreign,
      },
      bench: [base.lineup[0]!, first, first, injured, suspended, foreign.id, "missing"],
    };
    const selected = careerMatchSelection(corrupt);
    expect(selected.lineup).toEqual(base.lineup);
    expect(selected.bench).toEqual([first]);
    expect(corrupt.bench).toHaveLength(7);
  });
});

describe("bounded career work", () => {
  it.each([Number.POSITIVE_INFINITY, Number.NaN, -1, 0.5, Number.MAX_SAFE_INTEGER])(
    "rejects invalid market and premium report counts (%s) before seeded work",
    (count) => {
      expect(generateMarket("bounded", count)).toEqual([]);
      expect(runPremiumScouting(base, "bounded", count)).toBe(base);
    },
  );

  it.each([Number.POSITIVE_INFINITY, Number.NaN, -1, 0.5, 100])(
    "does not loop or change the career for invalid scouting level %s",
    (olheiro) => {
      const corrupt = { ...base, staff: { ...base.staff, olheiro } };
      expect(runScouting(corrupt)).toBe(corrupt);
    },
  );

  it("retains deterministic normal market/scouting results and requested sizes", () => {
    expect(generateMarket("bounded", 12)).toHaveLength(12);
    expect(generateMarket("bounded", 12)).toEqual(generateMarket("bounded", 12));
    expect(runPremiumScouting(base, "normal", 5)).toEqual(runPremiumScouting(base, "normal", 5));
    expect(runScouting(base)).toEqual(runScouting(base));
  });
});

describe("signing integrity and euro precision", () => {
  it("pays exactly the quoted half salary on a loan, preserving single-euro precision", () => {
    const opts = { fee: 0.2, wage: 12.346, loan: true };
    const quote = quoteRealSigning(base, target, opts);
    const signed = signRealPlayer(base, target, opts);
    expect(quote.affordable).toBe(true);
    expect(quote.weeklyWage).toBe(6.173);
    expect(quote.upfrontCost).toBe(0.062346);
    expect(signed.players[`real-${target.id}`]?.wage).toBe(quote.weeklyWage);
    expect(moneyToEuros(base.finances.budget) - moneyToEuros(signed.finances.budget)).toBe(
      moneyToEuros(quote.upfrontCost),
    );
    expect(signRealPlayer(signed, target, opts)).toBe(signed);
  });

  it.each([
    { id: "" },
    { id: "x".repeat(156) },
    { name: " " },
    { name: "x\nname" },
    { clubId: "" },
    { ovr: Number.NaN },
  ])("rejects malformed target %j before a quote authorizes payment", (patch) => {
    const invalid = { ...target, ...patch };
    expect(quoteRealSigning(base, invalid, { fee: 0, wage: 1 }).affordable).toBe(false);
    expect(signRealPlayer(base, invalid, { fee: 0, wage: 1 })).toBe(base);
  });

  it("validates original loan money before applying the loan discount", () => {
    const opts = { fee: MAX_FINANCIAL_VALUE + 1, wage: 0, loan: true };
    const rich = { ...base, finances: { ...base.finances, budget: MAX_FINANCIAL_VALUE } };
    expect(quoteRealSigning(rich, target, opts).affordable).toBe(false);
    expect(signRealPlayer(rich, target, opts)).toBe(rich);
  });

  it("uses a legal current-club shirt number when the imported preference is invalid", () => {
    const signed = signRealPlayer(
      base,
      { ...target, number: Number.POSITIVE_INFINITY },
      { fee: 0, wage: 1 },
    );
    const number = signed.players[`real-${target.id}`]!.number;
    expect(Number.isSafeInteger(number)).toBe(true);
    expect(Object.values(base.players).some((player) => player.number === number)).toBe(false);
  });

  it("rejects a malformed generated signing name without throwing or spending", () => {
    const entry = { ...generateMarket("entry", 1)[0]!, name: null } as unknown as MarketEntry;
    expect(signPlayer(base, entry)).toBe(base);
  });

  it("rejects out-of-range remaining cash instead of interpreting it as a zero balance", () => {
    const debt = { ...base, finances: { ...base.finances, budget: -MAX_FINANCIAL_VALUE } };
    expect(quoteContract(debt, MAX_FINANCIAL_VALUE, 0, 0).affordable).toBe(false);
  });
});

describe("financial event recovery", () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, MAX_FINANCIAL_VALUE + 1])(
    "does not consume a season prize ID for invalid amount %s",
    (prize) => {
      const rejected = settleSeasonPrize(base, prize);
      expect(rejected).toEqual({ state: base, settled: false });
      const recovered = settleSeasonPrize(rejected.state, 1.25);
      expect(recovered.settled).toBe(true);
      expect(recovered.state.financeLedger?.[0]?.income).toBe(1.25);
    },
  );

  it("rejects an event ID the persisted replay history cannot retain", () => {
    const event = {
      id: "x".repeat(181),
      season: 1,
      round: 1,
      kind: "premio" as const,
      label: "Prêmio",
      income: 1,
      expense: 0,
    };
    expect(applyFinanceEvent(base, event)).toBe(base);
    const valid = applyFinanceEvent(base, { ...event, id: "valid-prize" });
    expect(
      applyFinanceEvent({ ...valid, financeLedger: [] }, { ...event, id: "valid-prize" }).finances,
    ).toEqual(valid.finances);
  });
});
