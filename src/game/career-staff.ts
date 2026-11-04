import { CLUBS } from "./data/leagues";
import { defaultStaff } from "./events";
import { makeRng } from "./rng";
import { financialChange, validFinancialState, financeLedgerFor } from "./financial-inputs";
import { operatingPlanFor } from "./finance-forecast";
import { buildSquad } from "./squad";
import type { CareerState, ScoutReport } from "./types";
import { enrichPlayer } from "./career";

/** Melhora um membro do staff (custo imediato em M€). */
export function upgradeStaff(
  state: CareerState,
  role: keyof ReturnType<typeof defaultStaff>,
): CareerState {
  if (!validFinancialState(state) || !Object.hasOwn(defaultStaff(), role)) return state;
  const staff = state.staff ?? defaultStaff();
  const level = staff[role];
  if (!Number.isSafeInteger(level) || level < 0 || level >= 5) return state;
  const cost = Math.round((level + 1) * 1.2 * 10) / 10;
  const finances = financialChange(state, 0, cost);
  if (!finances || finances.budget < 0) return state;
  return {
    ...state,
    staff: { ...staff, [role]: level + 1 },
    finances,
    financeLedger: [
      {
        id: `staff-${state.clubId}-${state.season}-${state.round}-${role}-${level + 1}`,
        season: state.season,
        round: state.round,
        kind: "infraestrutura" as const,
        label: `Melhoria de ${role} para nível ${level + 1}`,
        income: 0,
        expense: cost,
      },
      ...financeLedgerFor(state),
    ].slice(0, 96),
  };
}

/** Gera relatórios de olheiros conforme o nível do departamento. */
export function runScouting(state: CareerState): CareerState {
  const level = (state.staff ?? defaultStaff()).olheiro;
  const investment = operatingPlanFor(state).scouting;
  const rnd = makeRng(`scout-${state.clubId}-${state.season}-${state.round}`);
  const ids = Object.keys(CLUBS).filter((id) => id !== state.clubId);
  const reports: ScoutReport[] = [];
  for (let i = 0; i < 3 + level + investment; i++) {
    const clubId = ids[Math.floor(rnd() * ids.length)]!;
    const squad = buildSquad(clubId).map(enrichPlayer);
    const p = squad[Math.floor(rnd() * squad.length)];
    if (!p) continue;
    reports.push({
      id: `sc-${p.id}-${state.season}-${state.round}-${i}`,
      playerId: p.id,
      name: p.name,
      clubId,
      pos: p.pos,
      ovr: p.ovr,
      potential: p.potential ?? p.ovr,
      age: p.age,
      value: p.value,
      season: state.season,
    });
  }
  return { ...state, scoutReports: reports };
}
