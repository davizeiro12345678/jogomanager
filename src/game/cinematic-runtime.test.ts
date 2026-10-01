import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { cinematicDelta, cinematicDetail } from "./cinematic-performance";
import { cinematicActorPose, cinematicLook } from "./cinematic-actor";
import { proportionsFor } from "./player-model";
import { soleHeightFor } from "./ground-contact";
import { cinematicFocus } from "./cinematic-blocking";
import { cutsceneBranch } from "./cutscene-choice";
import { CUTSCENES } from "@/content/cutscenes";
import { batchStaticStadium } from "./static-stadium-batch";

describe("cinematic runtime", () => {
  it("freezes on pause and contains stalls without injecting invalid time", () => {
    expect(cinematicDelta(0.016, true)).toBe(0);
    expect(cinematicDelta(12, false)).toBeLessThan(0.1);
    for (const dt of [NaN, Infinity, -1]) expect(cinematicDelta(dt, false)).toBe(0);
    expect(cinematicDelta(1 / 60, false) * 60).toBeCloseTo(1);
  });
  it("reserves facial detail for speaking heroes and scales the same adult anatomy", () => {
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
