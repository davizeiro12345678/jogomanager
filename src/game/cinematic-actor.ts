import type { Pose } from "./animation-core";
import { emptyPose } from "./animation-core";
import { gaitPoseAt } from "./gait-kinematics";
import { clampPoseAnatomy } from "./ground-contact";
import { lookFor, type PlayerLook, type Proportions } from "./player-model";
import type { ManagerLook } from "./types";
import { SKIN_TONES } from "./kits";

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
  if (acting) {
    // Pause between gestures, with a preparation, outward stroke and recovery.
    const phrase = (t % 3.8) / 3.8;
    const gesture = Math.sin(Math.PI * Math.min(1, phrase / 0.78)) ** 2;
    out.armRPitch = -0.32 - gesture * 0.62;
    out.armRRoll = -0.16 - gesture * 0.21;
    out.elbowR = -0.8 - gesture * 0.3;
    out.armLPitch = -gesture * 0.22;
    out.elbowL -= gesture * 0.28;
    out.spine += gesture * 0.035;
    out.headPitch += Math.sin(t * 2.2) * 0.045;
  }
  return clampPoseAnatomy(out);
}
