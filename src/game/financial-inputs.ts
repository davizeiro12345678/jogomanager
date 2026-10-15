import type { CareerState, FinanceLedgerEntry, Finances } from "./types";

/** M€ boundary; multiplication by 1e6 remains a safe integer. */
export const MAX_FINANCIAL_VALUE = 1_000_000_000;
export const EUROS_PER_MILLION = 1_000_000;
export const EUROS_PER_WEEKLY_K = 1_000;

/** Monetary calculations use integer euros; M€ and k€/week are save/UI boundaries. */
export function moneyToEuros(value: number): number {
  return Math.round(value * EUROS_PER_MILLION);
}
export function eurosToMoney(value: number): number {
  return value / EUROS_PER_MILLION;
}
export function wageToEuros(value: number): number {
  return Math.round(value * EUROS_PER_WEEKLY_K);
}
export function addMoney(...values: number[]): number {
  return eurosToMoney(values.reduce((sum, value) => sum + moneyToEuros(value), 0));
}
export const finiteAmount = (value: unknown, signed = false): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Math.abs(value) <= MAX_FINANCIAL_VALUE &&
  (signed || value >= 0);

/** Display/projection fallback only. Mutations must separately validate their input. */
export function safeMoney(value: unknown, fallback = 0): number {
  return eurosToMoney(moneyToEuros(finiteAmount(value, true) ? value : fallback));
}

export function financeLedgerFor(state: CareerState): FinanceLedgerEntry[] {
  return Array.isArray(state.financeLedger)
    ? state.financeLedger.filter((entry) => entry && typeof entry.id === "string")
    : [];
}

/** Reject corrupt financial data rather than translating missing obligations into free cash. */
export function validFinancialState(state: CareerState): boolean {
  const f = state.finances;
  if (!f || !finiteAmount(f.budget, true) || !finiteAmount(f.spent) || !finiteAmount(f.income))
    return false;
  if (
    !Number.isSafeInteger(state.season) ||
    state.season < 1 ||
    !Number.isSafeInteger(state.round) ||
    state.round < 1
  )
    return false;
  if (!state.players || typeof state.players !== "object" || Array.isArray(state.players))
    return false;
  if (
    Object.values(state.players).some(
      (p) => !p || (p.clubId === state.clubId && !finiteAmount(p.wage)),
    )
  )
    return false;
  if (
    state.staff &&
    [state.staff.assistente, state.staff.preparador, state.staff.medico, state.staff.olheiro].some(
      (n) => !finiteAmount(n) || n > 100,
    )
  )
    return false;
  if (state.capacity !== undefined && (!finiteAmount(state.capacity) || state.capacity > 1_000_000))
    return false;
  if (state.sponsor !== undefined && !finiteAmount(state.sponsor)) return false;
  if (
    state.ticketPrice !== undefined &&
    (!finiteAmount(state.ticketPrice) || state.ticketPrice > 100_000)
  )
    return false;
  return true;
}

/** Validate the whole transaction before any roster, staff or calendar mutation. */
export function financialChange(
  state: CareerState,
  income: number,
  expense: number,
): Finances | null {
  if (!validFinancialState(state) || !finiteAmount(income) || !finiteAmount(expense)) return null;
  const credit = safeMoney(income);
  const debit = safeMoney(expense);
  const budget = addMoney(state.finances.budget, credit, -debit);
  const spent = addMoney(state.finances.spent, debit);
  const totalIncome = addMoney(state.finances.income, credit);
  if (!finiteAmount(budget, true) || !finiteAmount(spent) || !finiteAmount(totalIncome))
    return null;
  return {
    ...state.finances,
    budget: safeMoney(budget),
    spent: safeMoney(spent),
    income: safeMoney(totalIncome),
  };
}
