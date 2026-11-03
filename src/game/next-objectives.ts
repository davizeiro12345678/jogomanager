/**
 * Turns the current season and career records into a short list of clear
 * next goals. Presentation only: it never changes the save.
 */
import { careerMilestones } from "./achievements";
import { CLUBS } from "./data/leagues";
import { computeTable, nextFixture } from "./season";
import type { CareerState } from "./types";

export type ObjectiveRoute = "/pre-jogo" | "/league" | "/conquistas" | "/board";

export interface NextObjective {
  id: "pressure" | "board" | "match" | "milestone" | "season";
  title: string;
  detail: string;
  /** 0..1 progress toward the goal, when it can be measured. */
  progress: number | null;
  to: ObjectiveRoute;
  cta: string;
}

/** Board pressure at or above this level becomes the first objective. */
export const HIGH_PRESSURE = 70;
/** Hours away before a "welcome back" reminder is shown. */
export const RETURN_REMINDER_HOURS = 12;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function nextObjectives(career: CareerState, limit = 3): NextObjective[] {
  const list: NextObjective[] = [];
  const table = computeTable(career);
  const myIndex = table.findIndex((row) => row.clubId === career.clubId);
  const pos = myIndex + 1;
  const target = Math.max(1, Math.min(table.length || 1, career.objective || 1));
  const lastRound = career.fixtures.reduce((max, f) => Math.max(max, f.round), 0);
  const roundsLeft = Math.max(0, lastRound - career.round + 1);
  const fixture = nextFixture(career);

  const pressure = career.pressure ?? 0;
  if (pressure >= HIGH_PRESSURE && !career.sacked) {
    list.push({
      id: "pressure",
      title: "Aliviar a pressão da diretoria",
      detail: `A pressão está em ${Math.round(pressure)}/100. Vitórias nas próximas rodadas evitam a demissão.`,
      progress: Math.max(0, Math.min(1, (100 - pressure) / 100)),
      to: "/board",
      cta: "Ver diretoria",
    });
  }

  if (pos > 0 && fixture) {
    const mine = table[myIndex]!;
    const targetRow = table[target - 1];
    if (pos <= target) {
      list.push({
        id: "board",
        title: `Manter o time no top ${target}`,
        detail: `Você está em ${pos}º, dentro da meta da diretoria. ${plural(roundsLeft, "rodada restante", "rodadas restantes")}.`,
        progress: 1,
        to: "/league",
        cta: "Ver tabela",
      });
    } else {
      const gap = Math.max(1, (targetRow?.pts ?? mine.pts) - mine.pts + 1);
      list.push({
        id: "board",
        title: `Chegar ao top ${target}`,
        detail: `Você está em ${pos}º. Faltam ${plural(gap, "ponto", "pontos")} para passar o ${target}º colocado, com ${plural(roundsLeft, "rodada", "rodadas")} pela frente.`,
        progress: Math.max(0, Math.min(1, 1 - (pos - target) / Math.max(1, table.length - target))),
        to: "/league",
        cta: "Ver tabela",
      });
    }
  }

  if (fixture) {
    const home = fixture.home === career.clubId;
    const opponent = CLUBS[home ? fixture.away : fixture.home]?.name ?? "o adversário";
    list.push({
      id: "match",
      title: `Vencer ${opponent}`,
      detail: `Rodada ${fixture.round}, ${home ? "em casa" : "fora de casa"}. Três pontos aproximam você da meta.`,
      progress: null,
      to: "/pre-jogo",
      cta: "Preparar jogo",
    });
  } else {
    list.push({
      id: "season",
      title: "Encerrar a temporada",
      detail: "Todos os jogos foram disputados. Veja o balanço e comece a próxima temporada.",
      progress: 1,
      to: "/league",
      cta: "Ver balanço",
    });
  }

  const milestone = careerMilestones(career)
    .filter((m) => m.target > 0 && m.value < m.target)
    .sort((a, b) => b.value / b.target - a.value / a.target)[0];
  if (milestone) {
    const left = milestone.target - milestone.value;
    list.push({
      id: "milestone",
      title: `${milestone.label}: ${milestone.target}${milestone.suffix ? ` ${milestone.suffix}` : ""}`,
      detail: `Faltam ${left}${milestone.suffix ? ` ${milestone.suffix}` : ""} para o próximo marco da carreira.`,
      progress: milestone.value / milestone.target,
      to: "/conquistas",
      cta: "Ver conquistas",
    });
  }

  return list.slice(0, limit);
}

export interface ReturnReminder {
  hoursAway: number;
  message: string;
}

/** A welcome-back line when the player returns after a long break. */
export function returnReminder(
  lastVisitMs: number | null,
  career: Pick<CareerState, "season" | "round">,
  nowMs: number,
): ReturnReminder | null {
  if (lastVisitMs === null || !Number.isFinite(lastVisitMs) || lastVisitMs > nowMs) return null;
  const hoursAway = Math.floor((nowMs - lastVisitMs) / 3_600_000);
  if (hoursAway < RETURN_REMINDER_HOURS) return null;
  const away =
    hoursAway >= 48
      ? plural(Math.floor(hoursAway / 24), "dia", "dias")
      : plural(hoursAway, "hora", "horas");
  return {
    hoursAway,
    message: `Bem-vindo de volta! Faz ${away} que você não aparece. Seu clube parou na rodada ${career.round} da temporada ${career.season}.`,
  };
}
