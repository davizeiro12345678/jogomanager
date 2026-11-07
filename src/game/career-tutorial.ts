/** Tutorial progress is guidance only; it never authorizes currency rewards. */
import type { CareerState } from "./types";
import { firstMatchPlayed } from "./onboarding";

export function practicedCareerLessons(
  career: Pick<
    CareerState,
    | "lineup"
    | "players"
    | "matchLog"
    | "round"
    | "season"
    | "results"
    | "clubId"
    | "trainingReports"
    | "scoutReports"
    | "transferredIn"
    | "financeLedger"
  >,
): Set<string> {
  const lessons = new Set<string>();
  if (firstMatchPlayed(career)) {
    lessons.add("prematch");
    lessons.add("match");
  }
  if (career.trainingReports?.length) lessons.add("training");
  if (career.scoutReports.length) lessons.add("scouting");
  if (career.transferredIn?.length) lessons.add("transfers");
  if (career.financeLedger?.length) lessons.add("weekly-budget");
  return lessons;
}

export interface TutorialLesson {
  id: string;
  title: string;
  instruction: string;
  to: string;
}

export const TUTORIAL_CHAPTERS: { title: string; lessons: TutorialLesson[] }[] = [
  {
    title: "Primeiros passos",
    lessons: [
      {
        id: "club",
        title: "Conheça seu clube",
        instruction: "Confira a meta da diretoria, a próxima partida e o orçamento disponível.",
        to: "/club",
      },
      {
        id: "objectives",
        title: "Escolha seu próximo objetivo",
        instruction: "Veja os marcos da temporada no painel e escolha o próximo compromisso.",
        to: "/dashboard",
      },
    ],
  },
  {
    title: "Elenco e tática",
    lessons: [
      {
        id: "squad",
        title: "Monte seus titulares",
        instruction:
          "Abra a ficha dos jogadores e escolha 11 atletas sem lesão nem suspensão. Reserve opções para o banco.",
        to: "/squad",
      },
      {
        id: "tactics",
        title: "Defina como jogar",
        instruction:
          "Escolha formação, mentalidade e pressão de acordo com os pontos fortes do elenco.",
        to: "/tactics",
      },
    ],
  },
  {
    title: "Primeira partida",
    lessons: [
      {
        id: "prematch",
        title: "Prepare o jogo",
        instruction: "Confira o adversário e a escalação antes de confirmar a entrada em campo.",
        to: "/pre-jogo",
      },
      {
        id: "match",
        title: "Acompanhe e ajuste",
        instruction:
          "Observe as chances e o desgaste. No intervalo, ajuste a tática; use o banco para substituir jogadores cansados.",
        to: "/pre-jogo",
      },
    ],
  },
  {
    title: "Gestão da temporada",
    lessons: [
      {
        id: "training",
        title: "Planeje o treino",
        instruction:
          "Escolha foco e intensidade. Aplique um exercício por rodada e veja quem respondeu melhor.",
        to: "/training",
      },
      {
        id: "scouting",
        title: "Encontre reforços",
        instruction: "Envie olheiros e compare os relatórios antes de gastar com uma contratação.",
        to: "/scouting",
      },
      {
        id: "finances",
        title: "Mantenha o clube saudável",
        instruction: "Compare receita e despesas. Preserve caixa para salários e contratações.",
        to: "/finances",
      },
      {
        id: "contracts",
        title: "Cuide dos contratos",
        instruction:
          "Revise contratos curtos e insatisfação no elenco; confira o efeito e o custo antes de usar um serviço.",
        to: "/squad",
      },
    ],
  },
  {
    title: "Mercado e calendário",
    lessons: [
      {
        id: "transfers",
        title: "Contrate para uma necessidade real",
        instruction:
          "Identifique a posição mais fraca. Compare idade, potencial e salário de dois candidatos antes de decidir se vale fazer uma proposta.",
        to: "/transfers",
      },
      {
        id: "weekly-budget",
        title: "Feche a semana no azul",
        instruction:
          "Abra o extrato após avançar a rodada. Compare bilheteria, salários e outras despesas. Se o saldo caiu, revise o custo do elenco antes da próxima contratação.",
        to: "/finances",
      },
      {
        id: "league-table",
        title: "Leia a tabela e ajuste sua meta",
        instruction:
          "Compare sua posição com a meta da diretoria. Confira a diferença em pontos e o saldo de gols antes de decidir se precisa arriscar no próximo jogo.",
        to: "/league",
      },
    ],
  },
];

export function tutorialProgress(learned: ReadonlySet<string>) {
  const lessons = TUTORIAL_CHAPTERS.flatMap((chapter) => chapter.lessons);
  const completed = lessons.filter((lesson) => learned.has(lesson.id)).length;
  return {
    completed,
    total: lessons.length,
    next: lessons.find((lesson) => !learned.has(lesson.id)) ?? null,
  };
}

export function parseTutorialLessons(value: unknown): Set<string> {
  const allowed = new Set(
    TUTORIAL_CHAPTERS.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.id)),
  );
  return new Set(
    Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string" && allowed.has(id))
      : [],
  );
}
