import type { PlayerCareerState, PlayerPosition } from "./types";

/** Metas sazonais são derivadas do save: não dependem do relógio ou de dados remotos. */
export interface SeasonObjective {
  id: "minutos" | "impacto" | "regularidade";
  title: string;
  detail: string;
  current: number;
  target: number;
  display: string;
  complete: boolean;
  /** Consequências são consolidadas uma única vez ao encerrar a temporada. */
  consequence: string;
}

const lineAverage = (state: PlayerCareerState) =>
  state.current.apps > 0 ? state.current.ratingSum / state.current.apps : 0;

function isDefensive(position: PlayerPosition): boolean {
  return position === "GOL" || position === "ZAG" || position === "LAT" || position === "VOL";
}

/** Nunca toma decisões por timestamp: salva e verifica apenas estatísticas do ano atual. */
export function seasonObjectives(state: PlayerCareerState, seasonWeeks: number): SeasonObjective[] {
  const weeks = Math.max(10, Math.floor(seasonWeeks));
  const appsTarget = Math.min(12, Math.max(4, Math.round(weeks * 0.36)));
  const defensive = isDefensive(state.position);
  const impactTarget = defensive
    ? Math.min(8, Math.max(3, Math.round(weeks * 0.23)))
    : Math.min(7, Math.max(2, Math.round(weeks * 0.18)));
  const impact = defensive ? state.current.starts : state.current.goals + state.current.assists;
  const average = lineAverage(state);
  const ratingTarget = state.position === "GOL" ? 6.7 : defensive ? 6.75 : 6.9;
  const sampleReady = state.current.apps >= 4;

  return [
    {
      id: "minutos",
      title: "Ganhar espaço no elenco",
      detail: "Participe de partidas para conquistar a confiança do treinador.",
      current: state.current.apps,
      target: appsTarget,
      display: `${state.current.apps}/${appsTarget} jogos`,
      complete: state.current.apps >= appsTarget,
      consequence: "Mais confiança e moral se alcançar a meta; cobranças se ficar abaixo.",
    },
    {
      id: "impacto",
      title: defensive ? "Consolidar a titularidade" : "Participar dos gols",
      detail: defensive
        ? "A consistência como titular pesa mais para goleiros, zagueiros e volantes."
        : "Gols e assistências contam igualmente; o alvo não depende de sorte em convocações.",
      current: impact,
      target: impactTarget,
      display: defensive
        ? `${impact}/${impactTarget} titularidades`
        : `${impact}/${impactTarget} participações em gols`,
      complete: impact >= impactTarget,
      consequence: "Uma boa temporada eleva a confiança; desempenho insuficiente reduz moral.",
    },
    {
      id: "regularidade",
      title: "Manter atuações consistentes",
      detail: "A nota média só conta depois de pelo menos quatro aparições.",
      current: sampleReady ? Number(average.toFixed(2)) : 0,
      target: ratingTarget,
      display: sampleReady
        ? `Nota ${average.toFixed(2)} / alvo ${ratingTarget.toFixed(2)}`
        : `Jogue ${Math.max(0, 4 - state.current.apps)} partida(s) para avaliar a média`,
      complete: sampleReady && average >= ratingTarget,
      consequence: "A regularidade melhora sua reputação e gera interesse de clubes.",
    },
  ];
}

export function seasonObjectiveSummary(state: PlayerCareerState, seasonWeeks: number) {
  const objectives = seasonObjectives(state, seasonWeeks);
  const completed = objectives.filter((objective) => objective.complete).length;
  return { objectives, completed, total: objectives.length };
}
