import {
  financeLedgerFor,
  financialChange,
  finiteAmount,
  validFinancialState,
} from "./financial-inputs";
import type { CareerState, FinanceLedgerEntry } from "./types";

export const MAX_TRACKED_FINANCE_EVENT_IDS = 4096;

/**
 * Aplica uma receita/despesa de carreira uma única vez.
 *
 * O saldo continua sendo calculado por financialChange; este módulo apenas
 * liga o evento idempotente ao ledger já persistido no save.
 */
export function applyFinanceEvent(state: CareerState, event: FinanceLedgerEntry): CareerState {
  if (
    !validFinancialState(state) ||
    typeof event.id !== "string" ||
    event.id.trim().length === 0 ||
    !Number.isSafeInteger(event.season) ||
    event.season < 1 ||
    !Number.isSafeInteger(event.round) ||
    event.round < 1 ||
    typeof event.label !== "string" ||
    !finiteAmount(event.income) ||
    !finiteAmount(event.expense)
  )
    return state;

  const ledger = financeLedgerFor(state);
  const tracked = Array.isArray(state.financeAppliedEventIds)
    ? [
        ...new Set(
          state.financeAppliedEventIds.filter(
            (id): id is string =>
              typeof id === "string" && id.trim().length > 0 && id.length <= 180,
          ),
        ),
      ].slice(-MAX_TRACKED_FINANCE_EVENT_IDS)
    : [];
  if (tracked.includes(event.id)) return state;

  // Promote the bounded legacy ledger into durable history before it rolls off.
  const appliedIds = [...new Set([...tracked, ...ledger.map((entry) => entry.id)])];
  if (ledger.some((entry) => entry.id === event.id))
    return {
      ...state,
      financeAppliedEventIds: appliedIds.slice(-MAX_TRACKED_FINANCE_EVENT_IDS),
    };

  const finances = financialChange(state, event.income, event.expense);
  if (!finances) return state;

  return {
    ...state,
    finances,
    financeLedger: [event, ...ledger].slice(0, 96),
    financeAppliedEventIds: [...appliedIds, event.id].slice(-MAX_TRACKED_FINANCE_EVENT_IDS),
  };
}

export const applyCareerFinanceEvent = applyFinanceEvent;
