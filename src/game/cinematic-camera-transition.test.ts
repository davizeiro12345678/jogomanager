import { describe, expect, it } from "vitest";
import { cinematicCameraTransition } from "./cinematic-camera-transition";

describe("cinematicCameraTransition", () => {
  it("eases consecutive dialogue lines by the same staged actor", () => {
    const first = {
      scene: "office",
      framing: "dialogue" as const,
      subject: "manager",
      size: "medio" as const,
      reaction: false,
      opening: false,
    };
    const nextLine = { ...first, beat: 8 };
    expect(cinematicCameraTransition(first, nextLine)).toBe("ease");
  });

  it("cuts when the actor, shot grammar, or reaction changes", () => {
    const current = {
      scene: "office",
      framing: "dialogue" as const,
      subject: "manager",
      size: "medio" as const,
      reaction: false,
      opening: false,
    };
    expect(cinematicCameraTransition(current, { ...current, subject: "captain" })).toBe("cut");
    expect(cinematicCameraTransition(current, { ...current, size: "close" })).toBe("cut");
    expect(cinematicCameraTransition(current, { ...current, reaction: true })).toBe("cut");
    expect(cinematicCameraTransition(current, { ...current, framing: "establishing" })).toBe("cut");
    expect(cinematicCameraTransition(current, { ...current, scene: "tunnel" })).toBe("cut");
  });

  it("cuts the first composed shot and every opening geography shot", () => {
    const opening = {
      scene: "pitch",
      framing: "establishing" as const,
      subject: "environment",
      size: "geral" as const,
      reaction: false,
      opening: true,
    };
    expect(cinematicCameraTransition(null, opening)).toBe("cut");
    expect(cinematicCameraTransition(opening, opening)).toBe("cut");
  });
});
