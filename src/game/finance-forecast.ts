import { CLUBS } from "./data/leagues";
import { weeklyIncome, wageBill } from "./economy";
import { gateIncome, staffBill } from "./events";
import { sponsorBaseFor, sponsorIncomeFor } from "./sponsorships";
import type { CareerState, FinanceLedgerEntry, OperatingPlan } from "./types";
import {
  addMoney,
  finiteAmount,
  financialChange,
  safeMoney,
  financeLedgerFor,
  validFinancialState,
} from "./financial-inputs";

/** Padrão seguro para carreiras antigas que ainda não carregam um plano. */
export const DEFAULT_OPERATING_PLAN: OperatingPlan = {
  academy: 1,
  medical: 1,
  scouting: 1,
  commercial: 1,
};

export const OPERATING_PLAN_PRESETS = [
  {
    id: "prudente",
    label: "Prudente",
    description: "Protege o caixa e reduz a estrutura fora do campo.",
    plan: { academy: 1, medical: 1, scouting: 0, commercial: 1 } satisfies OperatingPlan,
  },
  {
    id: "equilibrado",
    label: "Equilibrado",
    description: "Mantém uma operação estável entre elenco, base e receita.",
    plan: DEFAULT_OPERATING_PLAN,
  },
  {
    id: "crescimento",
    label: "Crescimento",
    description: "Investe em base, saúde e receita para sustentar uma carreira longa.",
    plan: { academy: 2, medical: 2, scouting: 2, commercial: 2 } satisfies OperatingPlan,
  },
] as const;

type WeeklyResult = { position: number; won: boolean; homeGame: boolean; played?: boolean };

export interface FinanceProjection {
  /** Invalid personal save values never authorize a settlement or signing. */
  valid: boolean;
  revenue: {
    broadcast: number;
    performance: number;
    sponsor: number;
    ticketing: number;
    matchday: number;
    commercial: number;
  };
  costs: {
    wages: number;
    staff: number;
    academy: number;
    medical: number;
    scouting: number;
    commercial: number;
    travel: number;
    stadium: number;
  };
  income: number;
  expense: number;
  net: number;
  wageRatio: number;
  runwayWeeks: number | null;
  risk: "estável" | "atenção" | "crítico";
}

const money = safeMoney;
const level = (value: unknown): 0 | 1 | 2 | 3 => {
  const number = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 1;
  return Math.max(0, Math.min(3, number)) as 0 | 1 | 2 | 3;
};

/** Normaliza sem mutar saves antigos ou carregar configurações inválidas. */
export function operatingPlanFor(state: Pick<CareerState, "operatingPlan">): OperatingPlan {
  const input = state.operatingPlan;
  return {
    academy: level(input?.academy),
    medical: level(input?.medical),
    scouting: level(input?.scouting),
    commercial: level(input?.commercial),
  };
}

export function updateOperatingPlan(
  state: CareerState,
  patch: Partial<OperatingPlan>,
): CareerState {
  const current = operatingPlanFor(state);
  return {
    ...state,
    operatingPlan: {
      academy: level(patch.academy ?? current.academy),
      medical: level(patch.medical ?? current.medical),
      scouting: level(patch.scouting ?? current.scouting),
      commercial: level(patch.commercial ?? current.commercial),
    },
  };
}

/**
 * Projeção semanal em M€. Mantém as receitas já existentes e acrescenta uma
 * decomposição de operação: estádio, comercial, viagens e investimentos.
 */
export function projectWeeklyFinance(state: CareerState, result: WeeklyResult): FinanceProjection {
  const plan = operatingPlanFor(state);
  const strength = CLUBS[state.clubId]?.strength ?? 70;
  const broadcast = weeklyIncome(strength, Math.max(1, result.position), result.won);
  const performance = 0;
  const rawSponsor = sponsorIncomeFor(state, result) * (1 + plan.commercial * 0.035);
  const sponsor = money(rawSponsor);
  const homeGame = result.played !== false && result.homeGame;
  const rawTicketing = homeGame ? gateIncome(state) : 0;
  const ticketing = money(rawTicketing);
  const matchday = homeGame ? money(ticketing * (0.1 + plan.commercial * 0.018)) : 0;
  const rawCommercial = sponsorBaseFor(state) * (0.05 + plan.commercial * 0.025);
  const commercial = money(rawCommercial);

  const rawWages =
    wageBill(Object.values(state.players ?? {}).filter((p) => p?.clubId === state.clubId)) / 1000;
  const wages = money(rawWages);
  const rawStaff = staffBill(state);
  const staff = money(rawStaff);
  const academy = money(0.025 + plan.academy * 0.035);
  const medical = money(0.018 + plan.medical * 0.022);
  const scouting = money(0.012 + plan.scouting * 0.025);
  const commercialCost = money(0.01 + plan.commercial * 0.016);
  const travel = result.played === false ? 0 : result.homeGame ? 0.035 : 0.12;
  const stadium = money(Math.max(0.02, (state.capacity ?? 45_000) / 1_500_000));

  const rawIncome = addMoney(broadcast, performance, sponsor, ticketing, matchday, commercial);
  const rawExpense = addMoney(
    wages,
    staff,
    academy,
    medical,
    scouting,
    commercialCost,
    travel,
    stadium,
  );
  const income = money(rawIncome);
  const expense = money(rawExpense);
  const net = addMoney(income, -expense);
  const wageRatio = income > 0 ? money(wages / income) : 1;
  const budget = money(state.finances?.budget);
  const valid =
    validFinancialState(state) &&
    [rawSponsor, rawCommercial, rawTicketing, rawWages, rawStaff, rawIncome, rawExpense].every(
      (v) => finiteAmount(v),
    );
  const runwayWeeks = net < 0 ? Math.max(0, money(budget / Math.abs(net))) : null;
  const risk =
    !valid || budget < 0 || (runwayWeeks !== null && runwayWeeks < 6) || wageRatio > 0.85
      ? "crítico"
      : (runwayWeeks !== null && runwayWeeks < 16) || wageRatio > 0.68
        ? "atenção"
        : "estável";

  return {
    valid,
    revenue: { broadcast, performance, sponsor, ticketing, matchday, commercial },
    costs: {
      wages,
      staff,
      academy,
      medical,
      scouting,
      commercial: commercialCost,
      travel,
      stadium,
    },
    income,
    expense,
    net,
    wageRatio,
    runwayWeeks,
    risk,
  };
}

export interface FinanceHorizon {
  valid: boolean;
  weeks: {
    round: number;
    homeGame: boolean;
    played: boolean;
    projection: FinanceProjection;
    closingCash: number;
  }[];
  income: number;
  expense: number;
  net: number;
  closingCash: number;
  minimumCash: number;
  /** Caixa necessário para cobrir o pior saldo acumulado da operação prevista. */
  reserveRequired: number;
}

/**
 * Cenário conservador com o calendário salvo e sem antecipar vitórias, vendas ou
 * premiações. Semanas sem jogo ainda pagam salários e estrutura. Não avança o save.
 */
export function projectFinanceHorizon(state: CareerState, weeks = 8): FinanceHorizon {
  const count = Number.isFinite(weeks) ? Math.max(1, Math.min(52, Math.round(weeks))) : 8;
  let cash = money(state.finances?.budget);
  let minimumCash = cash;
  let income = 0;
  let expense = 0;
  let valid = validFinancialState(state);
  const timeline: FinanceHorizon["weeks"] = [];
  for (let index = 0; index < count; index++) {
    const round = state.round + index;
    const fixture = (Array.isArray(state.fixtures) ? state.fixtures : []).find(
      (f) => f && f.round === round && (f.home === state.clubId || f.away === state.clubId),
    );
    const played = !!fixture;
    const homeGame = fixture?.home === state.clubId;
    const projection = projectWeeklyFinance(
      { ...state, round, finances: { ...state.finances, budget: cash } },
      {
        position: state.objective,
        won: false,
        homeGame,
        played,
      },
    );
    const nextCash = addMoney(cash, projection.net);
    valid =
      valid &&
      projection.valid &&
      finiteAmount(nextCash, true) &&
      finiteAmount(income + projection.income) &&
      finiteAmount(expense + projection.expense);
    cash = money(nextCash);
    minimumCash = Math.min(minimumCash, cash);
    income = addMoney(income, projection.income);
    expense = addMoney(expense, projection.expense);
    timeline.push({ round, homeGame, played, projection, closingCash: cash });
  }
  return {
    valid,
    weeks: timeline,
    income,
    expense,
    net: money(income - expense),
    closingCash: cash,
    minimumCash,
    reserveRequired: money(Math.max(0, money(state.finances?.budget) - minimumCash)),
  };
}

export interface FinanceSettlement {
  state: CareerState;
  projection: FinanceProjection;
  settled: boolean;
}

/**
 * Aplica uma única operação por rodada. A chave imutável impede que uma tela
 * reprocessada ou uma reconexão cobre a semana duas vezes.
 */
export function settleWeeklyFinance(state: CareerState, result: WeeklyResult): FinanceSettlement {
  const id = `operations-${state.clubId}-${state.season}-${state.round}`;
  const projection = projectWeeklyFinance(state, result);
  const finances = financialChange(state, projection.income, projection.expense);
  const cursor = state.financeSettledThrough;
  const alreadySettled =
    cursor &&
    cursor.clubId === state.clubId &&
    Number.isSafeInteger(cursor.season) &&
    cursor.season > 0 &&
    Number.isSafeInteger(cursor.round) &&
    cursor.round > 0 &&
    (cursor.season > state.season ||
      (cursor.season === state.season && cursor.round >= state.round));
  if (
    !projection.valid ||
    !finances ||
    alreadySettled ||
    !finiteAmount(state.finances.budget + projection.net, true) ||
    !finiteAmount(state.finances.spent + projection.expense) ||
    !finiteAmount(state.finances.income + projection.income) ||
    financeLedgerFor(state).some((entry) => entry.id === id)
  ) {
    return { state, projection, settled: false };
  }

  const entry: FinanceLedgerEntry = {
    id,
    season: state.season,
    round: state.round,
    kind: "operacao",
    label:
      result.played === false
        ? "Operação semanal sem partida"
        : result.homeGame
          ? "Operação semanal e jogo em casa"
          : "Operação semanal e viagem",
    income: projection.income,
    expense: projection.expense,
  };
  return {
    projection,
    settled: true,
    state: {
      ...state,
      operatingPlan: operatingPlanFor(state),
      financeSettledThrough: { clubId: state.clubId, season: state.season, round: state.round },
      finances: finances!,
      financeLedger: [entry, ...financeLedgerFor(state)].slice(0, 96),
    },
  };
}
