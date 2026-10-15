/**
 * Roteiro das cutscenes 2D. Cada cena tem um cenário ilustrado e animado
 * (desenhado em SVG no componente Cutscene) e uma sequência de falas.
 */
export type SceneArt =
  | "arrival"
  | "press"
  | "dressing"
  | "trophy"
  | "training"
  | "gym"
  | "tactics"
  | "staff"
  | "board"
  | "transfer"
  | "tunnel"
  | "kitroom"
  | "pitchentry"
  | "celebration"
  | "defeat"
  | "farewell"
  | "bus"
  | "office"
  | "medical"
  | "gala";

export type Speaker =
  | "manager"
  | "president"
  | "press"
  | "captain"
  | "narrator"
  | "commentator"
  | "referee"
  | "assistant"
  | "doctor"
  | "scout"
  | "agent"
  | "fan";

export const SPEAKER_LABEL: Record<Speaker, string> = {
  manager: "Você",
  president: "Presidente",
  press: "Imprensa",
  captain: "Capitão",
  narrator: "",
  commentator: "Comentarista",
  referee: "Árbitro",
  assistant: "Auxiliar",
  doctor: "Médico",
  scout: "Olheiro",
  agent: "Empresário",
  fan: "Torcida",
};

/** Consequência numérica de uma escolha: soma nos medidores (trava 0..100). */
export interface ChoiceEffect {
  morale?: number;
  condition?: number;
  approval?: number;
  fanApproval?: number;
  pressure?: number;
  headline?: string;
  careerDecision?: import("@/game/career-world-types").InterviewDecision;
}

export interface CutsceneChoice {
  /** Stable identity for voice assets and authored branch analytics. */
  id?: string;
  label: string;
  hint?: string;
  response: CutsceneLine[];
  effect?: ChoiceEffect;
}

export interface CutsceneLine {
  /** Stable identity for voice assets; kept optional for external custom scenes. */
  id?: string;
  who: Speaker;
  text: string;
  /** escolha jogável: pausa o avanço e mostra as opções */
  choices?: CutsceneChoice[];
}

export type SceneMood = "good" | "bad" | "neutral";

export interface Cutscene {
  id: string;
  title: string;
  art: SceneArt;
  mood?: SceneMood;
  /** cena híbrida: encenação com câmera em 3D real sobre as camadas ilustradas */
  hybrid?: boolean;
  /** Presentation only; deal transactions remain owned by the career host. */
  business?: {
    kind: "transfer" | "sponsor";
    stage: "negotiation" | "signing" | "presentation";
    clubName: string;
    subjectName: string;
  };
  lines: CutsceneLine[];
}

export function scene(
  id: string,
  title: string,
  art: SceneArt,
  lines: CutsceneLine[],
  mood: SceneMood = "neutral",
): Cutscene {
  return { id, title, art, mood, lines };
}
