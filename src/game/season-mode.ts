/**
 * Modo "temporada de treinador": em vez de jogar a partida, você vive a semana
 * como técnico — escolhe o foco da semana (treino, imprensa, reunião, descanso),
 * vê o efeito no elenco, na diretoria e nas finanças, e a rodada é resolvida
 * pelo simulador. Cada semana pode disparar uma cutscene de acordo com o
 * momento da carreira.
 */
import { autoWeek, clubName, type AutoWeek } from "@/game/autoplay";
import { CUTSCENES, TRAINING_SCENE_IDS } from "@/content/cutscenes";
import { memoryFrom, selectStoryScene } from "@/game/cutscene-selector";
import type { CareerState, TrainingFocus } from "@/game/types";

export type WeekActionId =
  | "treino-tatico"
  | "treino-fisico"
  | "treino-finalizacao"
  | "conversa"
  | "imprensa"
  | "descanso"
  | "comissao";

export interface WeekAction {
  id: WeekActionId;
  label: string;
  desc: string;
  /** cena 2D associada (quando houver) */
  scene?: string;
}

export const WEEK_ACTIONS: WeekAction[] = [
  {
    id: "treino-tatico",
    label: "Treino tático",
    desc: "Trabalha posicionamento e saída de bola. Melhora o entrosamento e a leitura de jogo.",
    scene: "training-tactics",
  },
  {
    id: "treino-fisico",
    label: "Treino físico",
    desc: "Academia e resistência. Sobe condição, com pequeno risco de desgaste.",
    scene: "training-gym",
  },
  {
    id: "treino-finalizacao",
    label: "Treino de finalização",
    desc: "Repetição de chute e cruzamento. Ataque mais afiado nesta rodada.",
    scene: "training-finishing",
  },
  {
    id: "conversa",
    label: "Conversa com o elenco",
    desc: "Puxa o grupo pelo lado emocional. Sobe a moral de todos.",
    scene: "training-talk",
  },
  {
    id: "imprensa",
    label: "Coletiva de imprensa",
    desc: "Protege o grupo e fala com a torcida. Alivia a pressão e agrada os torcedores.",
    scene: "press",
  },
  {
    id: "descanso",
    label: "Semana leve",
    desc: "Poupa o elenco. Recupera condição e reduz risco de lesão.",
  },
  {
    id: "comissao",
    label: "Reunião com a comissão",
    desc: "Alinha o trabalho com auxiliares e médicos. Ganho equilibrado no elenco.",
    scene: "staffroom",
  },
];

const FOCUS_BY_ACTION: Partial<Record<WeekActionId, TrainingFocus>> = {
  "treino-tatico": "tecnica",
  "treino-fisico": "fisico",
  "treino-finalizacao": "ataque",
  comissao: "equilibrado",
};

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

/** Aplica os efeitos da escolha da semana antes de resolver a rodada. */
export function applyWeekAction(state: CareerState, action: WeekActionId): CareerState {
  const players = { ...state.players };
  const bump = (
    fn: (p: CareerState["players"][string]) => Partial<CareerState["players"][string]>,
  ) => {
    for (const id of Object.keys(players)) {
      const p = players[id]!;
      if (p.clubId !== state.clubId) continue;
      players[id] = { ...p, ...fn(p) };
    }
  };

  let approval = state.approval;
  let fanApproval = state.fanApproval;
  let pressure = state.pressure;
  let training = state.training;
  let intensity: 0 | 1 | 2 = state.trainingIntensity ?? 1;

  switch (action) {
    case "treino-tatico":
      intensity = 1;
      bump((p) => ({
        morale: clamp(p.morale + 2, 0, 100),
        form: clamp((p.form ?? 60) + 4, 0, 100),
      }));
      break;
    case "treino-fisico":
      intensity = 2;
      bump((p) => ({
        condition: clamp(p.condition + 4, 0, 100),
        form: clamp((p.form ?? 60) + 2, 0, 100),
        morale: clamp(p.morale - 1, 0, 100),
      }));
      break;
    case "treino-finalizacao":
      intensity = 2;
      bump((p) => ({
        form: clamp((p.form ?? 60) + (p.pos === "FW" || p.pos === "MF" ? 6 : 2), 0, 100),
        condition: clamp(p.condition - 2, 0, 100),
      }));
      break;
    case "conversa":
      intensity = 0;
      bump((p) => ({ morale: clamp(p.morale + 6, 0, 100) }));
      fanApproval = clamp(fanApproval + 1, 0, 100);
      break;
    case "imprensa":
      pressure = clamp(pressure - 6, 0, 100);
      fanApproval = clamp(fanApproval + 3, 0, 100);
      approval = clamp(approval + 2, 0, 100);
      break;
    case "descanso":
      intensity = 0;
      bump((p) => ({
        condition: clamp(p.condition + 9, 0, 100),
        injuryWeeks: Math.max(0, p.injuryWeeks - 1),
      }));
      break;
    case "comissao":
      intensity = 1;
      bump((p) => ({
        condition: clamp(p.condition + 3, 0, 100),
        morale: clamp(p.morale + 2, 0, 100),
        form: clamp((p.form ?? 60) + 2, 0, 100),
      }));
      approval = clamp(approval + 1, 0, 100);
      break;
  }

  const focus = FOCUS_BY_ACTION[action];
  if (focus) training = focus;

  return {
    ...state,
    players,
    approval,
    fanApproval,
    pressure,
    training,
    trainingIntensity: intensity,
  };
}

export interface CoachWeek extends AutoWeek {
  action: WeekActionId;
  /** cena a exibir depois do resultado, se houver */
  scene?: string;
  headline: string;
}

/**
 * Escolhe uma cena de história de acordo com o momento da carreira.
 *
 * Primeiro o sorteio contextual (`cutscene-selector.ts`: demissão, ultimato,
 * crise, reconstrução...); se ele não casar nada, caem as regras clássicas de
 * humor (goleada, sequência, troféu). Toda cena devolvida existe no catálogo —
 * id inválido aqui virava tela quebrada na exibição.
 */
export function pickStoryScene(
  before: CareerState,
  after: CareerState,
  week: AutoWeek,
): string | undefined {
  const valid = (id: string | undefined) => (id && CUTSCENES[id] ? id : undefined);

  const story = selectStoryScene({ before, after, week }, memoryFrom(after, after.lastStoryScene));
  if (story) return valid(story);

  const seen = new Set(after.seenScenes ?? []);
  const once = (id: string) => (seen.has(id) ? undefined : id);

  if (after.sacked) return valid(once("farewell"));
  if (after.pressure >= 78) return valid(once("sackrisk"));
  if (week.gf - week.ga >= 3) return valid(once("winstreak"));
  if (after.streak >= 4) return valid(once("winstreak"));
  if (week.ga - week.gf >= 3) return valid(once("badloss"));
  if (after.trophies.length > before.trophies.length) return valid(once("trophyroom"));
  if (after.round <= 4 || (after.round >= 19 && after.round <= 22))
    return valid(once("transferwindow"));
  if (after.round % 7 === 0) return valid(once("board"));
  return undefined;
}

/** Roda uma semana completa: decisão do treinador + rodada + cena. */
export function coachWeek(state: CareerState, action: WeekActionId): CoachWeek | null {
  const prepared = applyWeekAction(state, action);
  const week = autoWeek(prepared);
  return finishCoachWeek(state, action, week);
}

/** The browser uses the existing sequential season Worker for one week too. */
export async function coachWeekAsync(
  state: CareerState,
  action: WeekActionId,
): Promise<CoachWeek | null> {
  const { autoSeasonAsync } = await import("./simWorkerClient");
  const prepared = applyWeekAction(state, action);
  const { weeks } = await autoSeasonAsync(prepared, 1);
  return finishCoachWeek(state, action, weeks[0] ?? null);
}

function finishCoachWeek(
  state: CareerState,
  action: WeekActionId,
  week: AutoWeek | null,
): CoachWeek | null {
  if (!week) return null;

  const story = pickStoryScene(state, week.state, week);
  const trainScene = WEEK_ACTIONS.find((a) => a.id === action)?.scene;
  const scene = story ?? (week.round % 3 === 1 ? trainScene : undefined);

  const opp = clubName(week.opponentId);
  const headline =
    week.gf > week.ga
      ? `Vitória sobre o ${opp} por ${week.gf} a ${week.ga}`
      : week.gf === week.ga
        ? `Empate com o ${opp} em ${week.gf} a ${week.ga}`
        : `Derrota para o ${opp} por ${week.ga} a ${week.gf}`;

  const seen = new Set(week.state.seenScenes ?? []);
  if (scene) seen.add(scene);

  return {
    ...week,
    state: {
      ...week.state,
      seenScenes: [...seen],
      // guarda a última cena para o sorteio não repetir na semana seguinte
      ...(scene ? { lastStoryScene: scene } : {}),
    },
    action,
    ...(scene ? { scene } : {}),
    headline,
  };
}

export { TRAINING_SCENE_IDS };
