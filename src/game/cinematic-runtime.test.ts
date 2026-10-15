import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  cinematicHairMotionDriveAt,
  cinematicDelta,
  cinematicDetail,
  cinematicAutoQualityOnDecline,
  cinematicAutoQualityOnFallback,
  cinematicAutoQualityOnIncline,
  cinematicInitialQuality,
  cinematicGpuQuality,
  cinematicPresentationBudget,
  CinematicPressureController,
} from "./cinematic-performance";
import { cinematicActorPose, cinematicIdleAt, cinematicLook } from "./cinematic-actor";
import { proportionsFor } from "./player-model";
import { soleHeightFor } from "./ground-contact";
import { cinematicFocus } from "./cinematic-blocking";
import { cutsceneBranch } from "./cutscene-choice";
import { CUTSCENES } from "@/content/cutscenes";
import { batchStaticStadium } from "./static-stadium-batch";

describe("cinematic runtime", () => {
  it("distinguishes an integrated physical GPU from software rendering", () => {
    expect(cinematicGpuQuality("media", "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics, D3D11)")).toBe(
      "media",
    );
    expect(cinematicGpuQuality("media", "Intel(R) UHD Graphics 620")).toBe("media");
    expect(cinematicGpuQuality("media", "ANGLE (Google, SwiftShader Device)")).toBe("baixa");
    expect(cinematicGpuQuality("media", "NVIDIA GeForce RTX 4060")).toBe("media");
    expect(cinematicGpuQuality("baixa", "NVIDIA GeForce RTX 4060")).toBe("baixa");
  });
  it("keeps portrait anatomy while sustained pressure drops effects then pixels", () => {
    const controller = new CinematicPressureController();
    expect(controller.sample(20, 50)).toBe(0);
    expect(controller.sample(20, 50)).toBe(1);
    expect(cinematicPresentationBudget("alta", 1).lens).toBe("media");
    for (let index = 0; index < 20; index++) controller.sample(20, 50);
    const budget = cinematicPresentationBudget("alta", controller.stage);
    expect(budget.lens).toBe("off");
    expect(budget.resolutionScale).toBeLessThan(1);
    expect(budget.actorQuality).toBe("alta");
    expect(controller.sample(Number.NaN, 0)).toBe(4);
  });
  it("starts auto balanced on CPU-rich devices and honours manual quality", () => {
    expect(cinematicInitialQuality("alta", "auto")).toBe("media");
    expect(cinematicInitialQuality("baixa", "auto")).toBe("baixa");
    expect(cinematicInitialQuality("media", "auto")).toBe("media");
    expect(cinematicInitialQuality("baixa", "alta")).toBe("alta");
    expect(cinematicInitialQuality("alta", "baixa")).toBe("baixa");
  });
  it("promotes automatic cinematic detail after a sustained high-FPS signal", () => {
    expect(cinematicAutoQualityOnIncline("media")).toBe("alta");
    expect(cinematicAutoQualityOnIncline("alta")).toBe("alta");
  });
  it("reduces automatic cinematic detail by one level after a sustained low-FPS signal", () => {
    expect(cinematicAutoQualityOnDecline("alta")).toBe("media");
    expect(cinematicAutoQualityOnDecline("media")).toBe("baixa");
    expect(cinematicAutoQualityOnDecline("baixa")).toBe("baixa");
  });
  it("uses the measured fallback FPS instead of treating fallback itself as poor performance", () => {
    expect(cinematicAutoQualityOnFallback("media", 60)).toBe("alta");
    expect(cinematicAutoQualityOnFallback("alta", 60)).toBe("alta");
    expect(cinematicAutoQualityOnFallback("alta", 20)).toBe("media");
    expect(cinematicAutoQualityOnFallback("media", 30)).toBe("media");
  });
  it("freezes on pause and contains stalls without injecting invalid time", () => {
    expect(cinematicDelta(0.016, true)).toBe(0);
    expect(cinematicDelta(12, false)).toBeLessThan(0.1);
    for (const dt of [NaN, Infinity, -1]) expect(cinematicDelta(dt, false)).toBe(0);
    expect(cinematicDelta(1 / 60, false) * 60).toBeCloseTo(1);
  });
  it("keeps portrait anatomy on the narrative subject from medium quality upward", () => {
    for (let seed = 0; seed < 16; seed++) {
      const look = cinematicLook(seed);
      const p = proportionsFor(look);
      expect(p.hipY).toBeGreaterThan(0.75);
      expect(look.height * 1.8).toBeGreaterThan(1.7);
      expect(cinematicLook(seed)).toEqual(look);
    }
    expect(cinematicDetail("alta", false).high).toBe(false);
    expect(cinematicDetail("baixa", true).high).toBe(false);
    expect(cinematicDetail("alta", true).high).toBe(true);
    expect(cinematicDetail("media", true).high).toBe(false);
    expect(cinematicDetail("baixa", true).portrait).toBe(false);
    expect(cinematicDetail("media", true).portrait).toBe(true);
    expect(cinematicDetail("alta", true).portrait).toBe(true);
    expect(cinematicDetail("media", false).portrait).toBe(false);
    expect(cinematicDetail("media", true).radial).toBe(12);
  });
  it("drives secondary hair from the close-up actor's gait and head turns", () => {
    const moving = cinematicHairMotionDriveAt({
      time: 1.25,
      seed: 12,
      dt: 1 / 60,
      moving: true,
      hipPitch: 0.16,
      hipYaw: -0.08,
      headYaw: 0.35,
      style: "ponytail",
    });
    expect(moving.speed).toBeGreaterThan(0);
    expect(moving.accelerationLean).not.toBe(0);
    expect(moving.turnRate).not.toBe(0);
    expect(moving.style).toBe("ponytail");

    const resting = cinematicHairMotionDriveAt({
      time: 8,
      seed: 12,
      dt: 1 / 60,
      moving: false,
      hipPitch: 0,
      hipYaw: 0,
      headYaw: 0,
      style: "ponytail",
    });
    expect(resting.speed).toBe(0);
    expect(resting.accelerationLean).toBe(0);
    expect(resting.turnRate).toBe(0);
  });
  it("plants the soles of seated actors across different leg proportions", () => {
    for (let seed = 1; seed < 12; seed++) {
      const P = proportionsFor(cinematicLook(seed));
      const pose = cinematicActorPose(0, seed, "sit", false, P);
      for (const left of [true, false])
        expect(
          soleHeightFor(
            { P, pose, hipShiftX: 0, leanX: 0, leanZ: 0, airborne: 0, previousRootY: 0, dt: 0 },
            left,
          ).y,
        ).toBeCloseTo(0, 5);
    }
  });
  it("retains gestures and finite poses throughout a speaking phrase", () => {
    const p = proportionsFor(cinematicLook(21));
    const samples = Array.from({ length: 90 }, (_, frame) =>
      cinematicActorPose(frame / 30, 21, "stand", true, p),
    );
    expect(samples.every((pose) => Object.values(pose).every(Number.isFinite))).toBe(true);
    const arms = samples.map((pose) => pose.armRPitch);
    expect(Math.max(...arms) - Math.min(...arms)).toBeGreaterThan(0.5);
    expect(cinematicActorPose(0, 21, "stand", false, p).armRPitch).toBe(0);
  });
  it("staggers small actions and keeps a seated actor grounded while standing up", () => {
    expect(cinematicIdleAt(0, 9, true).kind).toBe("none");
    expect(cinematicIdleAt(17, 9, true).kind).toBe("rise");
    expect(cinematicIdleAt(17, 9, true).weight).toBe(1);
    const p = proportionsFor(cinematicLook(9));
    const sitting = cinematicActorPose(0, 9, "sit", false, p);
    const upright = cinematicActorPose(17, 9, "sit", false, p);
    expect(upright.hipY).toBeGreaterThan(sitting.hipY + 0.3);
    for (let frame = 0; frame <= 24 * 30; frame++) {
      const pose = cinematicActorPose(frame / 30, 9, "sit", false, p);
      for (const left of [true, false])
        expect(
          Math.abs(
            soleHeightFor(
              {
                P: p,
                pose,
                hipShiftX: 0,
                leanX: 0,
                leanZ: 0,
                airborne: 0,
                previousRootY: 0,
                dt: 0,
              },
              left,
            ).y,
          ),
        ).toBeLessThan(0.003);
    }
    expect(cinematicIdleAt(12.5, 13, true).kind).toBe("cross");
    expect(cinematicIdleAt(6.5, 5, true).kind).toBe("foot");
    expect(cinematicIdleAt(10.5, 2, true).kind).toBe("tilt");
  });
  it("lets an assertive manager speak with different timing and amplitude", () => {
    const p = proportionsFor(cinematicLook(21));
    const assertive = Array.from(
      { length: 120 },
      (_, i) =>
        cinematicActorPose(i / 30, 21, "stand", true, p, undefined, {
          assertiveness: 90,
          warmth: 25,
        }).armRPitch,
    );
    const calm = Array.from(
      { length: 120 },
      (_, i) =>
        cinematicActorPose(i / 30, 21, "stand", true, p, undefined, {
          assertiveness: 20,
          warmth: 80,
        }).armRPitch,
    );
    expect(Math.min(...assertive)).toBeLessThan(Math.min(...calm) - 0.2);
    expect(assertive).not.toEqual(calm);
  });
  it("focuses the actual interlocutor instead of the room behind them", () => {
    expect(cinematicFocus("office", "manager")).toEqual([1.1, -2.3]);
    expect(cinematicFocus("office", "president")).toEqual([-0.9, -2.3]);
    expect(cinematicFocus("locker", "narrator")).toBeNull();
    expect(cinematicFocus("locker", "captain")).toEqual([-0.4, 0.6]);
    expect(cinematicFocus("locker", "captain")).not.toEqual(cinematicFocus("locker", "manager"));
    expect(cinematicFocus("press", "press")).not.toEqual(cinematicFocus("press", "manager"));
  });
  it("inserts a choice response without mutating or truncating the authored scene", () => {
    const scene = CUTSCENES["derby-eve-talk"]!;
    const lines = [
      ...scene.lines,
      { who: "narrator" as const, text: "A conversa continua no campo." },
    ];
    const original = JSON.stringify(lines);
    const lineIndex = lines.findIndex((line) => line.choices?.length);
    const branch = cutsceneBranch(lines, lineIndex, 0)!;
    const choice = lines[lineIndex]!.choices![0]!;
    expect(branch.lines[lineIndex + 1]).toBe(choice.response[0]);
    expect(branch.lines.slice(lineIndex + 1 + choice.response.length)).toEqual(
      lines.slice(lineIndex + 1),
    );
    expect(branch.lines.at(-1)).toBe(lines.at(-1));
    expect(JSON.stringify(lines)).toBe(original);
    expect(branch.effect).toEqual(choice.effect);
    expect(cutsceneBranch(lines, lineIndex, 100)).toBeNull();
  });
  it("keeps moving set pieces out of static batches while grouping the room", () => {
    const group = new THREE.Group();
    const moving = new THREE.Group();
    moving.userData["cinematicDynamic"] = true;
    const material = new THREE.MeshStandardMaterial();
    const box = () => new THREE.Mesh(new THREE.BoxGeometry(), material);
    const liveA = box(),
      liveB = box(),
      staticA = box(),
      staticB = box();
    moving.add(liveA, liveB);
    group.add(moving, staticA, staticB);
    const cleanup = batchStaticStadium(group);
    expect(liveA.visible && liveB.visible).toBe(true);
    expect(staticA.visible || staticB.visible).toBe(false);
    moving.position.x = 3;
    expect(liveA.parent).toBe(moving);
    cleanup();
    expect(staticA.visible && staticB.visible).toBe(true);
  });
});
