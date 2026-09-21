// ============================================================================
//  ik-solver.ts
//  Modulo de IK (Inverse Kinematics) reutilizavel para PlayerRig e LowPlayers.
// ============================================================================

import type { ActionContext, ContactContext, DominantFoot } from "./visual-context";
import type { Pose } from "./animation-core";

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

  // Inclinacao do quadril baseada no peso
  pose.hipRoll = (leftOnGround ? 1 : 0) - (rightOnGround ? 1 : 0) * 0.1;

  // Flexao das pernas
  if (leftOnGround) {
    pose.legLPitch = 0.05;
    pose.kneeL = -0.1;
    pose.ankleL = 0.05;
  }
  if (rightOnGround) {
    pose.legRPitch = 0.05;
    pose.kneeR = -0.1;
    pose.ankleR = 0.05;
  }
}

function applyBallContact(pose: Pose, action: ActionContext, contact: ContactContext): void {
  if (contact.type !== "ball" && contact.type !== "groundBall") return;

  if (!action.action) return;

  const actionName = action.action;
  
  if (actionName.includes("shot") || actionName.includes("pass") || actionName === "trap") {
    const foot = action.usedFoot;
    const legPitchKey = foot === "left" ? "legLPitch" : "legRPitch";
    const kneeKey = foot === "left" ? "kneeL" : "kneeR";
    const ankleKey = foot === "left" ? "ankleL" : "ankleR";

    pose[legPitchKey] = -0.1;
    pose[kneeKey] = -0.6;
    pose[ankleKey] = 0.2;

    // Braco oposto para equilíbrio
    const armPitchKey = foot === "left" ? "armRPitch" : "armLPitch";
    pose[armPitchKey] = 0.3;
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

function applyFocus(pose: Pose, focusX: number, focusZ: number, playerX: number, playerZ: number, rotationY: number): void {
  const dx = focusX - playerX;
  const dz = focusZ - playerZ;
  const distance = Math.sqrt(dx * dx + dz * dz);

  if (distance < 0.1) return;

  const focusAngle = Math.atan2(dx, dz);
  const relativeAngle = focusAngle - rotationY;

  pose.headYaw = Math.max(-0.8, Math.min(0.8, relativeAngle));
  pose.headPitch = -0.05;
  pose.chest = relativeAngle * 0.2;
}

function applyBalance(pose: Pose, vx: number, vz: number, accelX: number, accelZ: number): void {
  const speed = Math.hypot(vx, vz);
  const forwardAccel = Math.hypot(accelX, accelZ);

  pose.hipPitch = -forwardAccel * 0.015;
  pose.chest = forwardAccel * 0.025;

  if (speed > 5) {
    pose.armLPitch = -0.2;
    pose.armRPitch = -0.2;
    pose.armLRoll = 0.15;
    pose.armRRoll = -0.15;
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
): Pose {
  const result: Pose = { ...pose };
  
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
