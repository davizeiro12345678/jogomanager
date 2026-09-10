// ============================================================================
//  animation-core.ts
//  Tipos e utilidades compartilhadas do sistema de animação procedural.
//  Fica separado de `animation.ts` para que os clipes extras possam usar as
//  mesmas peças sem criar dependência circular.
// ============================================================================

export type JointName =
  | "hipY"
  | "hipPitch"
  | "hipRoll"
  | "hipYaw"
  | "spine"
  | "chest"
  | "headPitch"
  | "headYaw"
  | "armLPitch"
  | "armLRoll"
  | "elbowL"
  | "armRPitch"
  | "armRRoll"
  | "elbowR"
  | "legLPitch"
  | "legLRoll"
  | "kneeL"
  | "ankleL"
  | "legRPitch"
  | "legRRoll"
  | "kneeR"
  | "ankleR";

export type Pose = Record<JointName, number>;

export const JOINTS: JointName[] = [
  "hipY",
  "hipPitch",
  "hipRoll",
  "hipYaw",
  "spine",
  "chest",
  "headPitch",
  "headYaw",
  "armLPitch",
  "armLRoll",
  "elbowL",
  "armRPitch",
  "armRRoll",
  "elbowR",
  "legLPitch",
  "legLRoll",
  "kneeL",
  "ankleL",
  "legRPitch",
  "legRRoll",
  "kneeR",
  "ankleR",
];

export function emptyPose(): Pose {
  const p = {} as Pose;
  for (const j of JOINTS) p[j] = 0;
  return p;
}

export interface ClipCtx {
  /** tempo em segundos desde o início do clipe */
  t: number;
  /** progresso 0..1 quando o clipe é uma ação de duração fixa */
  u: number;
  /** velocidade do jogador em m/s */
  speed: number;
  /** 0..1 quanto o jogador está próximo do sprint */
  stride: number;
  /** variação individual determinística */
  seed: number;
}

export type Clip = (c: ClipCtx) => Pose;

/** mistura duas poses */
export function mixPose(a: Pose, b: Pose, k: number, out?: Pose): Pose {
  const o = out ?? emptyPose();
  for (const j of JOINTS) o[j] = a[j] + (b[j] - a[j]) * k;
  return o;
}
