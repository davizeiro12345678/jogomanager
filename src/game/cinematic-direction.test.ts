import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { cinematicCueFor, cinematicGestureAt } from "./cinematic-cue";
import { cinematicShotFor } from "./cinematic-shot";
import { compactCinematicSkin } from "./cinematic-skin";
import { directScene } from "./cutscene-director";
import { CUTSCENES } from "@/content/cutscenes";
import { cinematicActorPose, cinematicLook } from "./cinematic-actor";
import { proportionsFor } from "./player-model";
import { buildRigSkin } from "./rig-skin";
import { playerMaterials } from "./player-materials";
import { soleHeightFor } from "./ground-contact";
import {
  beginCinematicOverlay,
  cinematicOverlayActive,
  subscribeCinematicOverlay,
} from "./cinematic-overlay";

describe("cinematic direction and compact actors", () => {
  it("resumes background previews only after the last dialog releases visual focus", () => {
    const changes: boolean[] = [];
    const unsubscribe = subscribeCinematicOverlay(() => changes.push(cinematicOverlayActive()));
    const releaseFirst = beginCinematicOverlay();
    const releaseSecond = beginCinematicOverlay();
    expect(cinematicOverlayActive()).toBe(true);
    releaseFirst();
    releaseFirst();
    expect(cinematicOverlayActive()).toBe(true);
    releaseSecond();
    releaseSecond();
    expect(cinematicOverlayActive()).toBe(false);
    expect(changes).toEqual([true, false]);
    unsubscribe();
    const releaseThird = beginCinematicOverlay();
    releaseThird();
    expect(changes).toEqual([true, false]);
  });
  it("directs every authored scene and its replies with finite, deterministic timings", () => {
    for (const scene of Object.values(CUTSCENES)) {
      const direction = directScene(scene);
      scene.lines.forEach((line, index) => {
        const cue = cinematicCueFor(
          `${scene.id}:${index}`,
          line,
          direction.lines[index]!,
          scene.mood ?? "neutral",
        );
        expect(cue).toEqual(
          cinematicCueFor(
            `${scene.id}:${index}`,
            line,
            direction.lines[index]!,
            scene.mood ?? "neutral",
          ),
        );
        expect(cue.duration).toBeGreaterThan(1.7);
        expect(cue.speaker).toBe(line.who);
        for (const time of [0, 0.15, 1, 2, cue.duration, cue.duration + 30]) {
          const sample = cinematicGestureAt(time, cue, 21);
          expect(
            Object.values(sample).every(
              (value) => typeof value === "boolean" || Number.isFinite(value),
            ),
          ).toBe(true);
          expect(sample.weight).toBeGreaterThanOrEqual(0);
          expect(sample.weight).toBeLessThanOrEqual(1);
        }
      });
    }
  });
  it("holds a decision without speaking or gesturing forever", () => {
    const scene = CUTSCENES["derby-eve-talk"]!;
    const direction = directScene(scene);
    const cue = cinematicCueFor("decision", scene.lines[1]!, direction.lines[1]!, "neutral");
    expect(cue.gesture).toBe("question");
    expect(cinematicGestureAt(0, cue, 5).weight).toBe(0);
    expect(cinematicGestureAt(0.8, cue, 5).weight).toBeGreaterThan(0.5);
    expect(cinematicGestureAt(cue.duration + 1, cue, 5)).toMatchObject({
      weight: 0,
      jaw: 0,
      speaking: false,
    });
  });
  it("keeps seated foot contact with expressive upper-body gestures", () => {
    const scene = CUTSCENES["derby-eve-talk"]!;
    const direction = directScene(scene);
    const cue = cinematicCueFor("captain", scene.lines[1]!, direction.lines[1]!, "neutral");
    const p = proportionsFor(cinematicLook(5));
    for (let frame = 0; frame < 180; frame++) {
      const pose = cinematicActorPose(
        frame / 30,
        5,
        "sit",
        true,
        p,
        undefined,
        undefined,
        cue,
        frame / 30,
      );
      expect(Object.values(pose).every(Number.isFinite)).toBe(true);
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
  });
  it("frames speakers on either side of the press dialogue and keeps portrait cameras inside walls", () => {
    for (const aspect of [0.42, 0.56, 1, 1.78, 2.4]) {
      for (const kind of [
        "locker",
        "office",
        "press",
        "tunnel",
        "pitch",
        "arrival",
        "stands",
      ] as const) {
        for (const size of ["geral", "medio", "proximo", "close"] as const) {
          const shot = cinematicShotFor(kind, "manager", size, aspect);
          expect([...shot.position, ...shot.target, shot.fov].every(Number.isFinite)).toBe(true);
          if (["locker", "office", "press"].includes(kind)) {
            expect(Math.abs(shot.position[0])).toBeLessThan(7);
            expect(shot.position[2]).toBeLessThan(7);
            expect(shot.position[2]).toBeGreaterThan(-3.8);
          }
        }
      }
    }
    const press = cinematicShotFor("press", "press", "close", 1.78);
    const manager = cinematicShotFor("press", "manager", "close", 1.78);
    expect(press.position[2]).toBeLessThan(press.target[2]);
    expect(manager.position[2]).toBeGreaterThan(manager.target[2]);
    expect(cinematicShotFor("press", "press", "close", 1.78, false, true).framing).toBe(
      "establishing",
    );
  });
  it("reduces material draws while preserving indexed geometry, vertex albedo and skin weights", () => {
    const look = cinematicLook(21);
    const p = proportionsFor(look);
    const kit = {
      base: "#b01724",
      shorts: "#17222b",
      socks: "#17222b",
      detail: "#b01724",
      pattern: "solid" as const,
    };
    const mats = playerMaterials(look, kit, null, "media");
    const skin = buildRigSkin(
      {
        P: p,
        look,
        mats,
        hi: false,
        segs: { radial: 10, cap: 4 },
        jerseyInk: "#fff",
        handR: p.handR,
        handMat: mats.skin,
      },
      [0, 0, 0],
      { mergeLods: true },
    );
    const vertices = skin.groups.reduce(
      (sum, part) => sum + part.geometry.getAttribute("position").count,
      0,
    );
    const indices = skin.groups.reduce(
      (sum, part) =>
        sum + (part.geometry.index?.count ?? part.geometry.getAttribute("position").count),
      0,
    );
    const compact = compactCinematicSkin(skin);
    expect(compact.groups.length).toBeLessThan(skin.groups.length / 2);
    expect(compact.skeleton).toBe(skin.skeleton);
    expect(
      compact.groups.reduce((sum, part) => sum + part.geometry.getAttribute("position").count, 0),
    ).toBe(vertices);
    expect(compact.groups.reduce((sum, part) => sum + part.geometry.index!.count, 0)).toBe(indices);
    for (const part of compact.groups) {
      expect(part.geometry.getAttribute("skinWeight").count).toBe(
        part.geometry.getAttribute("position").count,
      );
      expect(part.geometry.getAttribute("skinIndex").count).toBe(
        part.geometry.getAttribute("position").count,
      );
      expect(
        [...part.geometry.getAttribute("color").array].every(
          (value) => Number.isFinite(value) && value >= 0,
        ),
      ).toBe(true);
    }
    let releases = 0;
    compact.groups[0]!.geometry.addEventListener("dispose", () => releases++);
    compact.dispose();
    expect(releases).toBe(1);
  });
});
