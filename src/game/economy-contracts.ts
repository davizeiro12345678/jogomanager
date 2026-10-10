import { projectFinanceHorizon } from "./finance-forecast";
import type { CareerState } from "./types";
import {
  addMoney,
  eurosToMoney,
  finiteAmount,
  safeMoney,
  validFinancialState,
  wageToEuros,
} from "./financial-inputs";

export const roundMoney = safeMoney;

export interface SigningQuote {
  fee: number;
  agentFee: number;
  signingBonus: number;
  upfrontCost: number;
  /** Salário efetivamente pago pelo clube em k€/semana. */
  weeklyWage: number;
  weeklyWageCost: number;
  reserveRequired: number;
  cashAfterSigning: number;
  affordable: boolean;
  reason: string | null;
}

/** Quatro semanas de proteção operacional, sem consumir ou bloquear caixa no save. */
export function quoteContract(
  state: CareerState,
  fee: number,
  wage: number,
  agentFee: number,
): SigningQuote {
  const valid = [fee, wage, agentFee].every((v) => finiteAmount(v)) && validFinancialState(state);
  const weeklyWage = valid ? wage : 0;
  const weeklyWageCost = eurosToMoney(wageToEuros(weeklyWage));
  // Luvas equivalentes a duas semanas do salário contratado.
  const signingBonus = eurosToMoney(wageToEuros(weeklyWage) * 2);
  const roundedFee = valid ? roundMoney(fee) : 0;
  const roundedAgentFee = valid ? roundMoney(agentFee) : 0;
  const upfrontCost = valid ? addMoney(roundedFee, roundedAgentFee, signingBonus) : 0;
  const horizon = projectFinanceHorizon(state, 4);
  const rawReserve = addMoney(horizon.reserveRequired, eurosToMoney(wageToEuros(weeklyWage) * 4));
  const reserveRequired = safeMoney(rawReserve);
  const cashAfterSigning = safeMoney(safeMoney(state.finances?.budget) - upfrontCost);
  const reason =
    !valid ||
    !horizon.valid ||
    !finiteAmount(rawReserve) ||
    ![upfrontCost, reserveRequired].every((v) => finiteAmount(v)) ||
    !finiteAmount((state.finances?.spent ?? 0) + upfrontCost)
      ? "Proposta financeira inválida."
      : cashAfterSigning < 0
        ? "O caixa não cobre taxa, comissão e luvas."
        : cashAfterSigning < reserveRequired
          ? "A contratação compromete a reserva de quatro semanas de operação e salários."
          : null;
  return {
    fee: roundedFee,
    agentFee: roundedAgentFee,
    signingBonus,
    upfrontCost,
    weeklyWage,
    weeklyWageCost,
    reserveRequired,
    cashAfterSigning,
    affordable: reason === null,
    reason,
  };
}
