/**
 * Guided first steps for a new manager, from the chosen club to the first
 * match. Pure: callers pass the career and which screens were visited.
 */
import type { CareerState } from "./types";

export type OnboardingStepId = "club" | "squad" | "lineup" | "tactics" | "prematch" | "match";
export type OnboardingVisit = "squad" | "tactics" | "prematch";

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  hint: string;
  to: "/new" | "/squad" | "/tactics" | "/pre-jogo";
  cta: string;
  done: boolean;
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  doneCount: number;
  next: OnboardingStep | null;
  /** True once the first match has been played: the guide retires itself. */
  complete: boolean;
}

/** Players needed on the pitch for a valid starting eleven. */
export const STARTING_ELEVEN = 11;

type Source = Pick<
  CareerState,
  "lineup" | "players" | "matchLog" | "round" | "season" | "results" | "clubId"
>;

export function firstMatchPlayed(career: Source): boolean {
  if ((career.matchLog?.length ?? 0) > 0) return true;
  return career.results.some((r) => r.home === career.clubId || r.away === career.clubId);
}

export function availableStarters(career: Source): number {
  return career.lineup.filter((id) => {
    const p = career.players[id];
    return p !== undefined && p.injuryWeeks === 0 && !p.suspended;
  }).length;
}

export function onboardingProgress(
  career: Source,
  visited: ReadonlySet<OnboardingVisit>,
): OnboardingProgress {
  const played = firstMatchPlayed(career);
  const starters = availableStarters(career);
  const steps: OnboardingStep[] = [
    {
      id: "club",
      title: "Escolher o clube",
      hint: "Seu clube e sua meta da diretoria já estão definidos.",
      to: "/new",
      cta: "Ver clube",
      done: true,
    },
    {
      id: "squad",
      title: "Conhecer o elenco",
      hint: "Veja quem são seus melhores jogadores, a forma e quem está lesionado.",
      to: "/squad",
      cta: "Abrir elenco",
      done: played || visited.has("squad"),
    },
    {
      id: "lineup",
      title: "Definir os 11 titulares",
      hint:
        starters >= STARTING_ELEVEN
          ? "Seus 11 titulares estão prontos para jogar."
          : `Só ${starters} dos titulares podem jogar. Troque lesionados ou suspensos no elenco.`,
      to: "/squad",
      cta: "Ajustar titulares",
      done: played || starters >= STARTING_ELEVEN,
    },
    {
      id: "tactics",
      title: "Escolher a tática",
      hint: "Formação, mentalidade e pressão: o jeito do seu time jogar.",
      to: "/tactics",
      cta: "Abrir táticas",
      done: played || visited.has("tactics"),
    },
    {
      id: "prematch",
      title: "Preparar o primeiro jogo",
      hint: "Veja o adversário, a forma recente e confirme a escalação.",
      to: "/pre-jogo",
      cta: "Ir ao pré-jogo",
      done: played || visited.has("prematch"),
    },
    {
      id: "match",
      title: "Jogar a primeira partida",
      hint: "Entre em campo e acompanhe o jogo em 3D.",
      to: "/pre-jogo",
      cta: "Entrar em campo",
      done: played,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, next: steps.find((s) => !s.done) ?? null, complete: played };
}
