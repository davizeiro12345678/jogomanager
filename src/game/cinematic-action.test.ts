import { describe, expect, it } from "vitest";
import {
  cinematicAttentionYaw,
  cinematicCurlAt,
  cinematicDrillAt,
  cinematicDrillFor,
  cinematicDrillPose,
} from "./cinematic-action";
import { cinematicReactionSpeaker, cinematicStageFocus } from "./cinematic-blocking";
import { cinematicCueFor, cinematicGestureAt } from "./cinematic-cue";
import { cinematicShotFor } from "./cinematic-shot";
import { cinematicActorPose, cinematicLook } from "./cinematic-actor";
import { directScene } from "./cutscene-director";
import { proportionsFor } from "./player-model";
import { soleHeightFor } from "./ground-contact";
import { emptyPose } from "./animation-core";
import { CUTSCENES } from "@/content/cutscenes";

describe("cinematic action, speech and actor marks", () => {
  it("keeps speech quiet at punctuation and after the delivery, including branches", () => {
    const line = { who: "manager" as const, text: "Calma. Vamos juntos, até o fim!" };
    const scene = { ...CUTSCENES["derby-eve-talk"]!, lines: [line] };
    const cue = cinematicCueFor("branch", line, directScene(scene).lines[0]!, "neutral");
    const phrase = cue.phrases![0]!;
    const next = cue.phrases![1]!;
    expect(phrase.end).toBeLessThan(next.start);
    const rest = cinematicGestureAt((phrase.end + next.start) / 2, cue, 21);
    expect(rest).toMatchObject({ weight: 0, jaw: 0, phase: "rest" });
    const first = cinematicGestureAt(phrase.start + (phrase.end - phrase.start) * 0.35, cue, 21);
    const second = cinematicGestureAt(next.start + (next.end - next.start) * 0.35, cue, 21);
    expect(first.weight).toBeGreaterThan(0.5);
    expect(first.side).toBe(-second.side);
    expect(cinematicGestureAt(cue.duration + 5, cue, 21)).toMatchObject({
      jaw: 0,
      weight: 0,
      speaking: false,
    });
  });
  it("keeps reverse-facing attention equivalent on either side of the angle wrap", () => {
    const attention = [0, -2] as const;
    expect(cinematicAttentionYaw(0, 0, Math.PI, attention)).toBeCloseTo(0, 8);
    expect(cinematicAttentionYaw(0, 0, -Math.PI, attention)).toBeCloseTo(0, 8);
    expect(cinematicAttentionYaw(0, 0, Math.PI + Math.PI * 8, attention)).toBeCloseTo(0, 8);
  });
  it("separates the doctor, coach and captain in both recovery rooms", () => {
    for (const art of ["medical", "gym"] as const) {
      const positions = ["doctor", "manager", "captain"].map((role) =>
        cinematicStageFocus("locker", role as "doctor" | "manager" | "captain", art),
      );
      expect(new Set(positions.map((p) => JSON.stringify(p))).size).toBe(3);
      for (const role of ["doctor", "manager", "captain"] as const) {
        const mark = cinematicStageFocus("locker", role, art)!;
        const shot = cinematicShotFor("locker", role, "close", 0.46, false, false, art);
        // Look room can offset the optical target slightly; the actual actor
        // must still be framed rather than aiming at another stage mark.
        expect(Math.hypot(shot.target[0] - mark[0], shot.target[2] - mark[1])).toBeLessThan(0.12);
        expect(shot.position[2]).toBeGreaterThan(-4.2);
        expect(Math.abs(shot.position[0])).toBeLessThan(7);
      }
    }
    for (const id of ["injury-blow", "medical-room", "captain-injury"])
      expect(CUTSCENES[id]!.art).toBe("medical");
    expect(cinematicReactionSpeaker("locker", "manager", "medical")).toBe("doctor");
    expect(cinematicReactionSpeaker("press", "press")).toBe("manager");
    expect(cinematicReactionSpeaker("office", "narrator")).toBeNull();
  });
  it("shares drill routes with the camera and launches the ball only after contact", () => {
    expect(cinematicDrillFor("training-finishing")).toBe("finish");
    expect(cinematicDrillFor("training-warmup")).toBe("dribble");
    const at = 1.972;
    const before = cinematicDrillAt(at - 0.001, 0, "finish");
    const contact = cinematicDrillAt(at, 0, "finish");
    const after = cinematicDrillAt(at + 0.2, 0, "finish");
    expect(Math.hypot(contact.ballX - before.ballX, contact.ballZ - before.ballZ)).toBeLessThan(
      0.01,
    );
    expect(after.ballZ).toBeLessThan(contact.ballZ - 1);
    expect(cinematicDrillAt(at + 1.5, 0, "finish").ballZ).toBeCloseTo(-15.8, 6);
    for (const mode of ["finish", "dribble"] as const)
      for (let frame = 0; frame < 360; frame++) {
        const sample = cinematicDrillAt(frame / 30, 0, mode);
        expect(Object.values(sample).every(Number.isFinite)).toBe(true);
        expect(sample).toEqual(cinematicDrillAt(frame / 30, 0, mode));
        const focus = cinematicStageFocus("pitch", "captain", "training", false, frame / 30, mode)!;
        expect(focus).toEqual([sample.x, sample.z]);
      }
  });
  it("keeps the support foot grounded through winding up, striking and recovering", () => {
    const p = proportionsFor(cinematicLook(4));
    const out = emptyPose(),
      scratch = emptyPose();
    for (const mode of ["finish", "dribble"] as const)
      for (let frame = 0; frame < 180; frame++) {
        cinematicActorPose(frame / 30, 4, "stand", false, p, out);
        cinematicDrillPose(
          out,
          cinematicDrillAt(frame / 30, 0, mode),
          p,
          frame / 30,
          false,
          scratch,
        );
        expect(Object.values(out).every(Number.isFinite)).toBe(true);
        const input = {
          P: p,
          pose: out,
          hipShiftX: 0,
          leanX: 0,
          leanZ: 0,
          airborne: 0,
          previousRootY: 0,
          dt: 0,
        };
        expect(
          Math.abs(Math.min(soleHeightFor(input, true).y, soleHeightFor(input, false).y)),
        ).toBeLessThan(0.003);
      }
  });
  it("uses alternating curls and retains the seat over a long recovery dialogue", () => {
    expect(cinematicCurlAt(2).left).not.toBeCloseTo(cinematicCurlAt(2).right, 1);
    const p = proportionsFor(cinematicLook(9));
    const seated = cinematicActorPose(
      0,
      9,
      "sit",
      false,
      p,
      undefined,
      undefined,
      undefined,
      0,
      true,
    );
    for (let frame = 0; frame < 1800; frame++) {
      const time = frame / 30;
      const pose = cinematicActorPose(
        time,
        9,
        "sit",
        false,
        p,
        undefined,
        undefined,
        undefined,
        time,
        true,
      );
      expect(pose.hipY).toBeCloseTo(seated.hipY, 6);
      const curl = cinematicCurlAt(time);
      expect(curl.left).toBeGreaterThanOrEqual(0);
      expect(curl.left).toBeLessThanOrEqual(1);
      expect(curl.right).toBeGreaterThanOrEqual(0);
      expect(curl.right).toBeLessThanOrEqual(1);
    }
  });
});
