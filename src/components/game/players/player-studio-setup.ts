import { type PlayerAction } from "@/game/animation";
import { WorkerMatchView } from "@/game/live-match";
import { STUDIO_NEUTRAL_GAZE_BALL_Z } from "@/game/player-studio-presentation";
import type { SimPlayer, TeamSetup } from "@/game/sim";
import { safeClub } from "@/game/squad";

export interface StudioMovement {
  id: string;
  label: string;
  speed: number;
  action: PlayerAction | null;
  lateral?: number;
  reverse?: boolean;
  profile?: "accelerate" | "brake" | "curve";
  hasBall?: boolean;
}

export type CameraCommand = { action: "left" | "right" | "in" | "out"; sequence: number } | null;

export const MOVEMENTS: StudioMovement[] = [
  { id: "idle", label: "Em pé", speed: 0, action: null },
  { id: "walk", label: "Caminhada", speed: 1.6, action: null },
  { id: "run", label: "Corrida", speed: 5.5, action: null },
  { id: "sprint", label: "Sprint", speed: 8, action: null },
  {
    id: "accelerate",
    label: "Arranque e aceleração",
    speed: 8,
    profile: "accelerate",
    action: null,
  },
  { id: "decelerate", label: "Frenagem e retomada", speed: 8, profile: "brake", action: null },
  {
    id: "curveRunLeft",
    label: "Corrida com mudança de direção",
    speed: 5.5,
    profile: "curve",
    action: null,
  },
  { id: "dribble", label: "Condução da bola", speed: 3.4, hasBall: true, action: null },
  { id: "sideStep", label: "Deslocamento lateral", speed: 1.9, lateral: 1.9, action: null },
  { id: "backpedal", label: "Recuo defensivo", speed: 1.9, reverse: true, action: null },
  { id: "pass", label: "Passe", speed: 0, action: "pass" },
  { id: "passLong", label: "Passe longo", speed: 0, action: "passLong" },
  { id: "cross", label: "Cruzamento", speed: 0, action: "cross" },
  { id: "shotPower", label: "Finalização", speed: 0, action: "shotPower" },
  { id: "shotPlaced", label: "Finalização colocada", speed: 0, action: "shotPlaced" },
  { id: "chip", label: "Cavadinha", speed: 0, action: "chip" },
  { id: "volley", label: "Voleio", speed: 0, action: "volley" },
  { id: "firstTime", label: "Finalização de primeira", speed: 0, action: "firstTime" },
  { id: "trap", label: "Domínio da bola", speed: 0, action: "trap" },
  { id: "tackle", label: "Desarme", speed: 0, action: "tackle" },
  { id: "slide", label: "Carrinho", speed: 0, action: "slide" },
  { id: "block", label: "Bloqueio defensivo", speed: 0, action: "block" },
  { id: "duel", label: "Disputa de corpo", speed: 0, action: "duel" },
  { id: "feint", label: "Finta", speed: 0, action: "feint" },
  { id: "stepover", label: "Pedalada", speed: 0, action: "stepover" },
  { id: "cut", label: "Corte de direção", speed: 0, action: "cut" },
  { id: "elastico", label: "Elástico", speed: 0, action: "elastico" },
  { id: "throwIn", label: "Arremesso lateral", speed: 0, action: "throwIn" },
  { id: "header", label: "Cabeceio", speed: 0, action: "header" },
  { id: "diveLeft", label: "Defesa à esquerda", speed: 0, action: "diveLeft" },
  { id: "diveRight", label: "Defesa à direita", speed: 0, action: "diveRight" },
  { id: "saveHigh", label: "Defesa alta", speed: 0, action: "saveHigh" },
  { id: "save", label: "Defesa frontal", speed: 0, action: "save" },
  { id: "catch", label: "Encaixe do goleiro", speed: 0, action: "catch" },
  { id: "celebrate", label: "Comemoração", speed: 0, action: "celebrate" },
];

/** Cosmetic fixture: no simulation tick, career update or server progress. */
export function fixture(clubId: string, position: string, variation: number) {
  const team = (id: string): TeamSetup => {
    const club = safeClub(id);
    return {
      clubId: id,
      name: club.name,
      short: club.short,
      primary: club.primary,
      secondary: club.secondary,
      players: [],
      tactics: { formation: "4-3-3", mentality: 2, pressing: 1, width: 1, tempo: 1 },
    };
  };
  const home = team(clubId);
  const away = team(clubId === "pal" ? "fla" : "pal");
  const view = new WorkerMatchView(home, away);
  const id = `studio-${clubId}-${position}-${variation}`;
  const player: SimPlayer = {
    id,
    pid: id,
    side: "home",
    name: "ATLETA",
    number: 10,
    pos: position,
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    slotX: 0,
    slotZ: 0,
    pace: 80,
    shooting: 80,
    passing: 80,
    defending: 80,
    physical: 80,
    stamina: 100,
    action: null,
    actionT: 0,
    actionDur: 1.5,
    goals: 0,
    assists: 0,
    shots: 0,
    passes: 0,
    tackles: 0,
    saves: 0,
    onSince: 0,
    minutes: 0,
    yellows: 0,
    sentOff: false,
    injuryWeeks: 0,
    interceptions: 0,
    offsides: 0,
    foulsWon: 0,
    pensScored: 0,
    pensMissed: 0,
    xg: 0,
  };
  view.players = [player];
  // The rig shares the normal match gaze layer. Keep the off-stage target far
  // enough away that an idle portrait looks at eye level instead of down at a
  // ball on the studio floor. Ball-focused movements restore the close target.
  view.ball.z = STUDIO_NEUTRAL_GAZE_BALL_Z;
  return { view, player };
}
