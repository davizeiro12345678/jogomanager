// ============================================================================
//  ik-solver.ts
//  Modulo de IK (Inverse Kinematics) reutilizavel para PlayerRig e LowPlayers.
// ============================================================================

import type { ActionContext, ContactContext, DominantFoot } from "./visual-context";
import { JOINTS, type Pose } from "./animation-core";

/** Comprimentos padrao das partes do corpo (em metros) */
export const BODY_LENGTHS = {
  hipToKnee: 0.45,
  kneeToAnkle: 0.40,
  ankleToFoot: 0.10,
  hipToShoulder: 0.50,
  shoulderToElbow: 0.30,
  elbowToHand: 0.25,
} as const;

/**
 * Aplica ajustes de IK a uma pose baseada no contexto visual.
 * Modifica a pose diretamente (mutacao).
 */
export function applyIKAdjustments(
  pose: Pose,
  actionCtx: ActionContext,
  contactCtx: ContactContext,
  playerInfo: {
    x: number;
    z: number;
    vx: number;
    vz: number;
    rotationY: number;
    isGK: boolean;
  },
): void {
  // IK de apoio dos pes
  applyFootSupport(pose, contactCtx);

  // Correcao de contato com a bola
  applyBallContact(pose, actionCtx, contactCtx);

  // Foco contextual
  if (actionCtx.target) {
    applyFocus(pose, actionCtx.target.x, actionCtx.target.z, playerInfo.x, playerInfo.z, playerInfo.rotationY);
  }

  // Estabilizacao de equilíbrio
  const accelX = playerInfo.vx * 0.1;
  const accelZ = playerInfo.vz * 0.1;
  applyBalance(pose, playerInfo.vx, playerInfo.vz, accelX, accelZ);

  // Transferencia de peso durante acoes
  if (actionCtx.action) {
    const progress = actionCtx.actionDur > 0 ? actionCtx.actionT / actionCtx.actionDur : 0;
    const weightShift = Math.sin(progress * Math.PI) * 0.5;
    applyWeightTransfer(pose, weightShift);
  }

  // IK especifico para goleiros
  if (playerInfo.isGK) {
    applyGoalkeeperIK(pose, actionCtx);
  }
}

function applyFootSupport(pose: Pose, contact: ContactContext): void {
  if (contact.type === "none" || contact.type === "airBall") return;

  const leftOnGround = contact.groundFoot === "left" || contact.groundFoot === null;
  const rightOnGround = contact.groundFoot === "right" || contact.groundFoot === null;

  const force = Math.max(0, Math.min(1, contact.force));

  // Apoio bilateral mantém o quadril neutro; apoio unilateral desloca o peso
  // discretamente para o pé plantado. A versão anterior gerava 0,9 rad quando
  // os dois pés tocavam o chão e fazia o corpo tombar lateralmente.
  const supportSide = leftOnGround === rightOnGround ? 0 : leftOnGround ? 1 : -1;
  pose.hipRoll += supportSide * 0.065 * force;

  // Mistura com a passada existente em vez de sobrescrevê-la. Isso mantém o
  // pé de apoio estável sem congelar a corrida inteira.
  const lock = 0.28 + force * 0.42;
  if (leftOnGround) {
    pose.legLPitch += (0.025 - pose.legLPitch) * lock;
    pose.kneeL += (-0.08 - pose.kneeL) * lock;
    pose.ankleL += (0.035 - pose.ankleL) * lock;
  }
  if (rightOnGround) {
    pose.legRPitch += (0.025 - pose.legRPitch) * lock;
    pose.kneeR += (-0.08 - pose.kneeR) * lock;
    pose.ankleR += (0.035 - pose.ankleR) * lock;
  }
}

function applyBallContact(pose: Pose, action: ActionContext, contact: ContactContext): void {
  if (!action.action) return;

  const actionName = action.action;
  const isBallAction = actionName.includes("shot") || actionName.includes("pass") || actionName.includes("cross") || actionName === "trap";

  if (isBallAction) {
    const foot = action.usedFoot;
    const legPitchKey = foot === "left" ? "legLPitch" : "legRPitch";
    const kneeKey = foot === "left" ? "kneeL" : "kneeR";
    const ankleKey = foot === "left" ? "ankleL" : "ankleR";
    const oppositeLegKey = foot === "left" ? "legRPitch" : "legLPitch";
    const intensity = 0.65 + action.intensity * 0.35;
    const phaseWeight = action.phase === "anticipation" ? -0.55
      : action.phase === "action" ? -0.15
      : action.phase === "contact" ? 0.95
      : action.phase === "followThrough" ? 0.72
      : 0.18;

    pose[legPitchKey] += phaseWeight * intensity;
    pose[kneeKey] += action.phase === "anticipation" ? -0.72 : -0.28 * intensity;
    pose[ankleKey] += action.phase === "contact" ? 0.34 : 0.12;
    pose[oppositeLegKey] += 0.12 * intensity;
    pose.hipYaw += (foot === "left" ? -1 : 1) * 0.12 * intensity;
    pose.chest -= phaseWeight * 0.12;

    // No contato real, fecha os últimos centímetros em direção à bola. Fora da
    // janela de contato preserva a preparação e o follow-through do clipe.
    if (contact.type === "ball" || contact.type === "groundBall") {
      pose[kneeKey] -= 0.18 * Math.max(0.25, contact.force);
    }
  }

  if (actionName.includes("shot") || actionName.includes("pass") || actionName === "trap") {
    const foot = action.usedFoot;
    const legPitchKey = foot === "left" ? "legLPitch" : "legRPitch";
    const kneeKey = foot === "left" ? "kneeL" : "kneeR";
    const ankleKey = foot === "left" ? "ankleL" : "ankleR";

    pose[legPitchKey] += -0.1;
    pose[kneeKey] += -0.24;
    pose[ankleKey] += 0.12;

    // Braco oposto para equilíbrio
    const armPitchKey = foot === "left" ? "armRPitch" : "armLPitch";
    pose[armPitchKey] += 0.3;
  }

  if (actionName === "header") {
    pose.headPitch = -0.4;
    pose.chest = 0.1;
    pose.spine = -0.1;
    pose.armLPitch = 0.4;
    pose.armRPitch = 0.4;
    pose.elbowL = -0.8;
    pose.elbowR = -0.8;
  }
}

/** normaliza um ângulo para o intervalo -PI..PI */
function wrapAngle(a: number): number {
  let v = a;
  while (v > Math.PI) v -= Math.PI * 2;
  while (v < -Math.PI) v += Math.PI * 2;
  return v;
}

function applyFocus(pose: Pose, focusX: number, focusZ: number, playerX: number, playerZ: number, rotationY: number): void {
  const dx = focusX - playerX;
  const dz = focusZ - playerZ;
  const distance = Math.sqrt(dx * dx + dz * dz);

  if (distance < 0.1) return;

  const focusAngle = Math.atan2(dx, dz);
  const relativeAngle = wrapAngle(focusAngle - rotationY);

  // Mistura em vez de sobrescrever: a cabeça procura o alvo mas o clipe de
  // corrida continua mandando no resto da pose (antes o olhar apagava tudo).
  const yaw = Math.max(-0.8, Math.min(0.8, relativeAngle));
  pose.headYaw += (yaw - pose.headYaw) * 0.6;
  pose.headPitch += -0.05;
  pose.chest += Math.max(-0.2, Math.min(0.2, relativeAngle * 0.18));
}

function applyBalance(pose: Pose, vx: number, vz: number, accelX: number, accelZ: number): void {
  const speed = Math.hypot(vx, vz);
  const forwardAccel = Math.hypot(accelX, accelZ);

  // Aditivo e com teto: equilíbrio é uma correção sobre a passada, não uma pose.
  pose.hipPitch += Math.max(-0.08, Math.min(0.08, -forwardAccel * 0.015));
  pose.chest += Math.max(-0.1, Math.min(0.1, forwardAccel * 0.025));

  if (speed > 5) {
    // Em velocidade alta os braços sobem e fecham um pouco, sem perder o
    // balanço alternado que vem do clipe.
    const w = Math.min(1, (speed - 5) / 4) * 0.45;
    pose.armLPitch += (-0.2 - pose.armLPitch) * w;
    pose.armRPitch += (-0.2 - pose.armRPitch) * w;
    pose.armLRoll += (0.15 - pose.armLRoll) * w;
    pose.armRRoll += (-0.15 - pose.armRRoll) * w;
  }
}

function applyWeightTransfer(pose: Pose, weightShift: number): void {
  pose.hipRoll += weightShift * 0.1;
  pose.legLPitch += weightShift * 0.08;
  pose.legRPitch -= weightShift * 0.08;
}

function applyGoalkeeperIK(pose: Pose, action: ActionContext): void {
  if (action.action === "diveLeft") {
    pose.armLPitch = 0.8;
    pose.armRPitch = -0.5;
    pose.elbowL = -1.2;
    pose.elbowR = -0.5;
    pose.spine = -0.3;
    pose.chest = -0.2;
    pose.legLPitch = 0.5;
    pose.legRPitch = -0.2;
    pose.kneeL = -0.8;
  }
  else if (action.action === "diveRight") {
    pose.armLPitch = -0.5;
    pose.armRPitch = 0.8;
    pose.elbowL = -0.5;
    pose.elbowR = -1.2;
    pose.spine = 0.3;
    pose.chest = 0.2;
    pose.legLPitch = -0.2;
    pose.legRPitch = 0.5;
    pose.kneeR = -0.8;
  }
  else if (action.action === "saveHigh" || action.action === "catch") {
    pose.armLPitch = 0.8;
    pose.armRPitch = 0.8;
    pose.elbowL = -1.2;
    pose.elbowR = -1.2;
    pose.spine = -0.2;
    pose.chest = -0.1;
  }
}

/**
 * Aplica IK completo para o PlayerRig.
 * Retorna uma nova pose com todos os ajustes aplicados.
 */
export function solveFullIK(
  pose: Pose,
  actionContext: ActionContext,
  contactContext: ContactContext,
  player: {
    x: number;
    z: number;
    vx: number;
    vz: number;
    rotationY: number;
    actionT: number;
    actionDur: number;
    isGK: boolean;
  },
  out?: Pose,
): Pose {
  const result = out ?? ({ ...pose } as Pose);
  if (out) {
    for (const joint of JOINTS) result[joint] = pose[joint];
  }
  
  applyIKAdjustments(result, actionContext, contactContext, {
    x: player.x,
    z: player.z,
    vx: player.vx,
    vz: player.vz,
    rotationY: player.rotationY,
    isGK: player.isGK,
  });
  
  return result;
}
