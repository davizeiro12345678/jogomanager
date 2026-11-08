import { describe, expect, it } from "vitest";

import { initCareer } from "./career";
import { processCups } from "./career-cups";
import { endSeason } from "./career-season-end";
import { applyFinanceEvent } from "./career-finances";
import { repairCareer } from "./career-repair";
import { CLUBS } from "./data/leagues";
import { cupPrize, playCupStage } from "./cup";
import { seasonPrize } from "./economy";
import { moneyToEuros } from "./financial-inputs";
import type { CupState } from "./types";

function finalCup(clubId: string, opponentId: string): CupState {
  return {
    id: "national",
    competitionId: "national:Brasil",
    entered: true,
    name: "Copa de teste",
    stage: 3,
    ties: [{ round: 3, home: clubId, away: opponentId, hg: null, ag: null }],
    out: false,
    winner: null,
    everyRounds: 1,
  };
}

describe("ledger financeiro da carreira", () => {
  it("registra cada prêmio de copa uma vez e mantém o resultado no replay", () => {
    const base = initCareer("bra", "fla", "Ledger");
    const opponentId = Object.keys(CLUBS).find((id) => id !== base.clubId)!;
    let state = base;

    for (let season = 1; season <= 100; season++) {
      const candidate = {
        ...base,
        season,
        cups: [finalCup(base.clubId, opponentId)],
      };
      if (playCupStage(candidate.cups[0]!, candidate).champion === base.clubId) {
        state = candidate;
        break;
      }
    }

    expect(state.cups).toBeDefined();
    expect(playCupStage(state.cups![0]!, state).champion).toBe(state.clubId);

    const first = processCups(state, 1);
    const replay = processCups(first, 1);
    const prize = cupPrize("national", 3) + cupPrize("national", 4);
    const entries = first.financeLedger?.filter((entry) => entry.kind === "premio") ?? [];

    expect(entries).toHaveLength(2);
    expect(moneyToEuros(first.finances.budget) - moneyToEuros(state.finances.budget)).toBe(
      moneyToEuros(prize),
    );
    expect(replay.finances).toEqual(first.finances);
    expect(replay.financeLedger).toEqual(first.financeLedger);
    expect(replay.trophies).toEqual(first.trophies);
  });

  it("separa prêmios de clubes diferentes na mesma temporada e não recredita o ID legado", () => {
    const base = initCareer("bra", "fla", "IDs de copa");
    const otherClub = "flu";
    const opponentId = Object.keys(CLUBS).find((id) => id !== base.clubId && id !== otherClub)!;
    const otherOpponentId = Object.keys(CLUBS).find(
      (id) => id !== base.clubId && id !== otherClub,
    )!;
    let firstState: ReturnType<typeof initCareer> | undefined;
    let switchedState: ReturnType<typeof initCareer> | undefined;
    for (let season = 1; season <= 100; season++) {
      const candidate = {
        ...base,
        season,
        cups: [finalCup(base.clubId, opponentId)],
      };
      const switchedCandidate = {
        ...base,
        clubId: otherClub,
        season,
        cups: [finalCup(otherClub, otherOpponentId)],
      };
      if (
        playCupStage(candidate.cups[0]!, candidate).champion === candidate.clubId &&
        playCupStage(switchedCandidate.cups[0]!, switchedCandidate).champion === otherClub
      ) {
        firstState = candidate;
        switchedState = switchedCandidate;
        break;
      }
    }
    expect(firstState).toBeDefined();
    expect(switchedState).toBeDefined();
    const first = processCups(firstState!, 1);
    const firstStageId = `cup-prize-${firstState!.cups![0]!.competitionId}-${first.clubId}-${first.season}-3`;
    expect(first.financeLedger?.some((entry) => entry.id.includes(`-${first.clubId}-`))).toBe(true);

    const switched = processCups(
      {
        ...first,
        clubId: otherClub,
        managerHistory: [
          { clubId: base.clubId, from: 1, to: first.season, note: "Saiu" },
          { clubId: otherClub, from: first.season, to: null, note: "Contratado" },
        ],
        cups: switchedState!.cups ?? [],
      },
      1,
    );
    expect(
      switched.financeLedger?.some(
        (entry) => entry.id === `cup-prize-national:Brasil-${otherClub}-${first.season}-3`,
      ),
    ).toBe(true);
    expect(switched.finances.budget).toBe(
      first.finances.budget + cupPrize("national", 3) + cupPrize("national", 4),
    );

    const legacyStage = {
      id: `cup-prize-${firstState!.cups![0]!.competitionId}-${first.season}-3`,
      season: first.season,
      round: 1,
      kind: "premio" as const,
      label: "Premiação legada",
      income: cupPrize("national", 3),
      expense: 0,
    };
    const legacyState = {
      ...firstState!,
      financeLedger: [legacyStage],
      financeAppliedEventIds: [legacyStage.id],
      finances: {
        ...firstState!.finances,
        budget: firstState!.finances.budget + legacyStage.income,
        income: firstState!.finances.income + legacyStage.income,
      },
    };
    const legacyReplay = processCups(legacyState, 1);
    expect(legacyReplay.financeLedger?.some((entry) => entry.id === firstStageId)).toBe(false);
    expect(legacyReplay.finances.budget).toBe(
      legacyState.finances.budget + cupPrize("national", 4),
    );
  });

  it("mantém idempotência depois que um evento sai do ledger visual", () => {
    const base = initCareer("bra", "fla", "Idempotência");
    const originalEvent = {
      id: "season-prize-fla-1",
      season: 1,
      round: 1,
      kind: "premio" as const,
      label: "Prêmio único",
      income: 1,
      expense: 0,
    };
    let state = applyFinanceEvent(base, originalEvent);

    for (let round = 1; round <= 110; round++) {
      state = applyFinanceEvent(state, {
        ...originalEvent,
        id: `operacao-${round}`,
        season: 2,
        round,
        kind: "operacao",
        label: `Lançamento ${round}`,
        income: 0.01,
      });
    }

    expect(state.financeLedger).toHaveLength(96);
    expect(state.financeLedger?.some((entry) => entry.id === originalEvent.id)).toBe(false);
    const restored = repairCareer(JSON.parse(JSON.stringify(state)) as typeof state).state;
    expect(restored.financeAppliedEventIds).toContain(originalEvent.id);
    expect(applyFinanceEvent(restored, originalEvent)).toBe(restored);
  });

  it("registra o prêmio de fechamento no ledger sem alterar o reset da nova temporada", () => {
    const state = initCareer("bra", "fla", "Fechamento");
    const next = endSeason({ ...state, cups: [] });
    const position = next.history.at(-1)!.position;
    const prize = seasonPrize(position, CLUBS[state.clubId]!.strength);
    const entry = next.financeLedger?.find(
      (candidate) => candidate.id === `season-prize-${state.clubId}-${state.season}`,
    );

    expect(entry).toMatchObject({
      kind: "premio",
      season: state.season,
      income: prize,
      expense: 0,
    });
    expect(next.finances).toEqual({
      budget: state.finances.budget + prize,
      spent: 0,
      income: 0,
    });
  });
});
