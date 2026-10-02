import type { Pose } from "./animation-core";
import { emptyPose } from "./animation-core";
import { gaitPoseAt, solveLegTarget } from "./gait-kinematics";
import { clampPoseAnatomy } from "./ground-contact";
import { lookFor, type PlayerLook, type Proportions } from "./player-model";
import type { ManagerLook } from "./types";
import { SKIN_TONES } from "./kits";
import { cinematicGestureAt, type CinematicCue } from "./cinematic-cue";

export interface CinematicManner {
  assertiveness: number;
  warmth: number;
}
const ease = (value: number) => {
  const u = Math.max(0, Math.min(1, value));
  return u * u * (3 - 2 * u);
};
export function cinematicIdleAt(time: number, seed: number, seated: boolean) {
  const start = 4 + (seed % 5) * 2,
    duration = seed % 5 === 4 && seated ? 10 : 5.5;
  const phase = ((Math.max(0, time) % (28 + (seed % 7))) - start) / duration;
  const kinds = ["foot", "look", "tilt", "cross", "rise"] as const;
  const kind = kinds[seed % 5] ?? "look";
  const active = phase > 0 && phase < 1;
  const weight = active
    ? kind === "rise" && seated
      ? phase < 0.32
        ? ease(phase / 0.32)
        : phase < 0.63
          ? 1
          : 1 - ease((phase - 0.63) / 0.37)
      : Math.sin(Math.PI * phase) ** 2
    : 0;
  return { kind: active ? kind : "none", weight, phase: Math.max(0, Math.min(1, phase)) };
}

export function cinematicLook(seed: number, identity?: ManagerLook): PlayerLook {
  const look = lookFor(`cinematic-actor-${seed}`, "MF");
  return {
    ...look,
    height: Math.max(0.95, Math.min(1.05, look.height)),
    captain: false,
    gloves: false,
    wristTape: "none",
    tattoo: "none",
    sockTape: false,
    earring: false,
    undershirt: false,
    sweat: 0.12,
    ...(identity
      ? {
          skin: SKIN_TONES[identity.skin % SKIN_TONES.length] ?? look.skin,
          hairStyle:
            (["bald", "buzz", "short", "medium", "curly", "afro", "bun"] as const)[identity.hair] ??
            "short",
          hairColor: identity.hairColor,
          beard:
            (["none", "stubble", "goatee", "full", "moustache"] as const)[identity.beard] ?? "none",
        }
      : {}),
  };
}

/** Seated feet, stride and speaking gestures use the player's real joints. */
export function cinematicActorPose(
  time: number,
  seed: number,
  posture: "stand" | "sit" | "walk",
  acting: boolean,
  p: Proportions,
  out: Pose = emptyPose(),
  manner: CinematicManner = { assertiveness: 55, warmth: 55 },
  cue?: CinematicCue,
  lineTime = time,
): Pose {
  for (const key of Object.keys(out) as (keyof Pose)[]) out[key] = 0;
  const t = time + (seed % 17) * 0.37;
  if (posture === "walk") gaitPoseAt(t * 5.2, 1.35, p, out);
  else {
    out.armLRoll = 0.07;
    out.armRRoll = -0.07;
    out.elbowL = out.elbowR = -0.2;
    if (posture === "sit") {
      out.hipY = p.shin + p.hipH * 0.4 + p.footH * 0.7 - p.hipY;
      out.legLPitch = out.legRPitch = -Math.PI / 2;
      out.kneeL = out.kneeR = -Math.PI / 2;
      out.ankleL = out.ankleR = 0;
      out.armLPitch = out.armRPitch = 0.15;
      out.elbowL = out.elbowR = -1.05;
    }
  }
  out.spine += 0.015 + Math.sin(t * 1.5) * 0.006;
  out.headYaw = Math.sin(t * 0.32) * 0.1;
  out.headPitch = Math.sin(t * 0.7) * 0.025;
  const idle = cinematicIdleAt(time, seed, posture === "sit");
  if (!acting && idle.weight > 0) {
    if (idle.kind === "look") out.headYaw += Math.sin(seed) * 0.48 * idle.weight;
    if (idle.kind === "tilt") out.headPitch -= 0.12 * idle.weight;
    if (idle.kind === "cross") {
      out.armLPitch -= 0.65 * idle.weight;
      out.armRPitch -= 0.62 * idle.weight;
      out.elbowL -= 0.85 * idle.weight;
      out.elbowR -= 0.8 * idle.weight;
    }
    if (idle.kind === "foot" && posture === "sit") {
      const leg = solveLegTarget(
        p.thigh - 0.035 * idle.weight,
        p.shin - 0.045 * idle.weight,
        p.thigh,
        p.shin,
      );
      out.legRPitch = leg.pitch;
      out.kneeR = leg.knee;
      out.ankleR = leg.ankle;
    }
    if (idle.kind === "rise" && posture === "sit") {
      const seatedHip = p.shin + p.hipH * 0.4 + p.footH * 0.7;
      // The standing skeleton includes clearance above the sole. Subtract it
      // here and reserve the IK reach margin, keeping the toes and heels on
      // the floor throughout the rise instead of lifting the feet at the end.
      const standingHip = p.hipY - p.footH * 0.14 - 0.001;
      out.hipY = seatedHip + (standingHip - seatedHip) * idle.weight - p.hipY;
      const down = p.hipY + out.hipY - p.hipH * 0.4 - p.footH * 0.7;
      const leg = solveLegTarget(p.thigh * (1 - idle.weight), down, p.thigh, p.shin);
      out.legLPitch = out.legRPitch = leg.pitch;
      out.kneeL = out.kneeR = leg.knee;
      out.ankleL = out.ankleR = leg.ankle;
      out.armLPitch = out.armRPitch = 0.15 * (1 - idle.weight);
      out.elbowL = out.elbowR = -1.05 + idle.weight * 0.85;
      out.spine += idle.weight * (1 - idle.weight) * 0.18;
    }
  }
  if (acting) {
    // Pause between gestures, with a preparation, outward stroke and recovery.
    const phraseLength = 4.5 - Math.max(0, Math.min(100, manner.assertiveness)) * 0.012;
    const phrase = (t % phraseLength) / phraseLength;
    const gesture = Math.sin(Math.PI * Math.min(1, phrase / 0.78)) ** 2;
    out.armRPitch =
      -0.26 - gesture * (0.42 + Math.max(0, Math.min(100, manner.assertiveness)) * 0.004);
    out.armRRoll = -0.16 - gesture * 0.21;
    out.elbowR = -0.8 - gesture * 0.3;
    out.armLPitch = -gesture * 0.22;
    out.elbowL -= gesture * 0.28;
    out.spine += gesture * 0.035;
    out.headPitch += Math.sin(t * 2.2) * 0.045;
  }
  if (cue) {
    const action = cinematicGestureAt(lineTime, cue, seed);
    const strength = 0.55 + Math.max(0, Math.min(100, manner.assertiveness)) * 0.005;
    const w = action.weight * strength;
    if (acting) {
      // Each line returns to a neutral listening pose after its delivery.
      out.armLPitch = 0;
      out.armRPitch = 0;
      out.armLRoll = 0.07;
      out.armRRoll = -0.07;
      out.elbowL = out.elbowR = posture === "sit" ? -1.05 : -0.2;
      out.headPitch = action.nod;
      switch (cue.gesture) {
        case "question":
          out.armLPitch = -w * 0.42;
          out.armRPitch = -w * 0.45;
          out.armLRoll += w * 0.2;
          out.armRRoll -= w * 0.24;
          out.elbowL -= w * 0.7;
          out.elbowR -= w * 0.7;
          out.headPitch -= w * 0.06;
          break;
        case "rally":
          out.armRPitch = -w * 0.88;
          out.elbowR -= w * 0.8;
          out.armLPitch = -w * 0.4;
          out.elbowL -= w * 0.5;
          out.chest -= w * 0.025;
          break;
        case "reassure":
          out.armLPitch = -w * 0.56;
          out.elbowL -= w * 1.05;
          out.armRPitch = -w * 0.25;
          out.elbowR -= w * 0.45;
          out.headPitch += w * 0.045;
          break;
        case "confront":
          out.armRPitch = -w * 0.96;
          out.elbowR -= w * 0.52;
          out.armRRoll -= w * 0.15;
          out.headPitch += w * 0.065;
          out.spine += w * 0.035;
          break;
        case "celebrate":
          out.armLPitch = out.armRPitch = -w * 1.25;
          out.armLRoll += w * 0.5;
          out.armRRoll -= w * 0.5;
          out.elbowL -= w * 0.5;
          out.elbowR -= w * 0.5;
          out.headPitch -= w * 0.08;
          break;
        default:
          out.armRPitch = -w * 0.62;
          out.elbowR -= w * 0.95;
          out.armRRoll -= w * 0.2;
          out.armLPitch = -w * 0.18;
      }
    } else {
      // Staggered acknowledgement, with restrained warmth or concern.
      const reaction = Math.max(0, 1 - Math.abs(lineTime - 1.8 - (seed % 4) * 0.4) / 0.8);
      out.headPitch += Math.sin(reaction * Math.PI) * (cue.mood === "bad" ? 0.065 : 0.09);
    }
  }
  return clampPoseAnatomy(out);
}
