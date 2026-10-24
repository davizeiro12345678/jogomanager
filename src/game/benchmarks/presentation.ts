import type { Bench } from "tinybench";

import { emptyPose } from "../animation-core";
import { gaitPoseAt } from "../gait-kinematics";
import { solveGroundContact, type GroundContactInput } from "../ground-contact";
import { lookFor, proportionsFor } from "../player-model";
import { PlayerLocomotionPose } from "../player-locomotion-pose";
import type { ClipName } from "../animation";
import { sculptedHead, sculptedHair } from "../sculpt/head";

/** Fixed inputs isolate presentation CPU from the authoritative solver and RNG.
 * Keep geometry disposal inside the workload: repeated construction must not
 * accumulate live buffers. These are CPU benchmarks, never GPU/FPS evidence. */
export function registerPresentationBenchmarks(bench: Bench) {
  const look = lookFor("bench-presentation-MF", "MF", true);
  const P = proportionsFor(look);
  const gaitOutputs = Array.from({ length: 22 }, () => emptyPose());
  const locomotion = Array.from({ length: 22 }, (_, index) => ({
    sampler: new PlayerLocomotionPose(),
    context: { t: index / 22, u: 0.4, speed: 5.5, stride: 5.5 / 7, seed: index },
    phase: (index / 22) * Math.PI * 2,
    direction: { forward: 1, lateral: 0.12, stamina: 0.8, turnRate: 0.1, hasBall: false },
  }));
  const mixedLocomotion = locomotion.map((athlete, index) => ({
    ...athlete,
    sampler: new PlayerLocomotionPose(),
    clip: (index < 18 ? "run" : index < 20 ? "idle" : "shotPower") as ClipName,
    action: index >= 20 ? "shot" : null,
    context: {
      ...athlete.context,
      speed: index < 16 ? 5.5 : index < 18 ? 0.7 : index < 20 ? 0 : 2,
    },
  }));
  const contacts: GroundContactInput[] = Array.from({ length: 22 }, (_, index) => ({
    P,
    pose: gaitPoseAt((index / 22) * Math.PI * 2, index % 3 === 0 ? 0 : 5.5, P).pose,
    hipShiftX: Math.sin(index) * 0.015,
    hipRollOffset: 0.015,
    leanX: 0.04,
    leanZ: Math.cos(index) * 0.025,
    airborne: 0,
    previousRootY: 0.01,
    dt: 1 / 60,
    plantedFoot: index % 2 === 0 ? "left" : "right",
  }));
  const recovery: GroundContactInput = {
    ...contacts[0]!,
    pose: { ...emptyPose(), hipY: -0.35, hipRoll: 0.6, legLPitch: 0.8, kneeL: -0.9 },
    bodyContact: 1,
    plantedFoot: undefined,
  };
  // Validate fixtures once, outside instrumented sections.
  if (![...contacts, recovery].every((input) => Number.isFinite(solveGroundContact(input).rootY)))
    throw new Error("Invalid ground-contact benchmark fixture");

  bench
    .add("presentation adapter: 22 mixed action poses", () => {
      let checksum = 0;
      for (const athlete of mixedLocomotion) {
        const pose = athlete.sampler.sample(
          athlete.clip,
          athlete.context,
          athlete.action,
          athlete.phase,
          P,
          athlete.direction,
        );
        checksum += pose.kneeL + pose.kneeR;
      }
      return checksum;
    })
    .add("presentation adapter: 22 run poses", () => {
      let checksum = 0;
      for (const athlete of locomotion) {
        const pose = athlete.sampler.sample(
          "run",
          athlete.context,
          null,
          athlete.phase,
          P,
          athlete.direction,
        );
        checksum += pose.kneeL + pose.kneeR;
      }
      return checksum;
    })
    .add("presentation locomotion: 22 reusable gait poses", () => {
      let checksum = 0;
      for (let index = 0; index < gaitOutputs.length; index++) {
        const result = gaitPoseAt(
          (index / 22) * Math.PI * 2,
          index % 3 === 0 ? 0 : 5.5,
          P,
          gaitOutputs[index],
        );
        checksum += result.pose.kneeL + result.pose.kneeR;
      }
      return checksum;
    })
    .add("presentation contact: 22 grounded athletes", () => {
      let checksum = 0;
      for (const input of contacts) {
        const result = solveGroundContact(input);
        checksum += result.rootY + result.ankleLFix + result.ankleRFix;
      }
      return checksum;
    })
    .add("presentation contact: body recovery", () => solveGroundContact(recovery).rootY);

  for (const [label, detail, portrait] of [
    ["portrait", true, true],
    ["match close", true, false],
    ["match distant", false, false],
  ] as const) {
    bench.add(`presentation geometry: head ${label}`, () => {
      const geometry = sculptedHead(P, look.seed, detail, portrait);
      const vertices = geometry.getAttribute("position").count;
      geometry.dispose();
      return vertices;
    });
  }
  bench.add("presentation geometry: detailed hair", () => {
    const geometry = sculptedHair(P, look, true);
    const vertices = geometry.getAttribute("position").count;
    geometry.dispose();
    return vertices;
  });
}
