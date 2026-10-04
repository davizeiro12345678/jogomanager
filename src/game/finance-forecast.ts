import { CLUBS } from "./data/leagues";
import { weeklyIncome, wageBill } from "./economy";
import { gateIncome, staffBill } from "./events";
import type { CareerState, FinanceLedgerEntry, OperatingPlan } from "./types";

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
  revenue: {
    broadcast: number;
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

const money = (value: number) => Math.round(value * 100) / 100;
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
  const sponsor = money((state.sponsor ?? 0) * (1 + plan.commercial * 0.035));
  const ticketing = result.homeGame ? gateIncome(state) : 0;
  const matchday = result.homeGame ? money(ticketing * (0.1 + plan.commercial * 0.018)) : 0;
  const commercial = money((state.sponsor ?? 0) * (0.05 + plan.commercial * 0.025));

  const wages = money(
    wageBill(Object.values(state.players).filter((p) => p.clubId === state.clubId)) / 1000,
  );
  const staff = staffBill(state);
  const academy = money(0.025 + plan.academy * 0.035);
  const medical = money(0.018 + plan.medical * 0.022);
  const scouting = money(0.012 + plan.scouting * 0.025);
  const commercialCost = money(0.01 + plan.commercial * 0.016);
  const travel = result.played === false ? 0 : result.homeGame ? 0.035 : 0.12;
  const stadium = money(Math.max(0.02, (state.capacity ?? 45_000) / 1_500_000));

  const income = money(broadcast + sponsor + ticketing + matchday + commercial);
  const expense = money(
    wages + staff + academy + medical + scouting + commercialCost + travel + stadium,
  );
  const net = money(income - expense);
  const wageRatio = income > 0 ? money(wages / income) : 1;
  const runwayWeeks = net < 0 ? Math.max(0, money(state.finances.budget / Math.abs(net))) : null;
  const risk =
    state.finances.budget < 0 || (runwayWeeks !== null && runwayWeeks < 6) || wageRatio > 0.85
      ? "crítico"
      : (runwayWeeks !== null && runwayWeeks < 16) || wageRatio > 0.68
        ? "atenção"
        : "estável";

  return {
    revenue: { broadcast, sponsor, ticketing, matchday, commercial },
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
  if (state.financeLedger?.some((entry) => entry.id === id)) {
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
      finances: {
        budget: money(state.finances.budget + projection.net),
        spent: money(state.finances.spent + projection.expense),
        income: money(state.finances.income + projection.income),
      },
      financeLedger: [entry, ...(state.financeLedger ?? [])].slice(0, 96),
    },
  };
}
