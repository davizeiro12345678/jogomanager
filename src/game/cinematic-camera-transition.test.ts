import { describe, expect, it, vi } from "vitest";
import {
  cinematicCameraTransition,
  TransitionController,
  type CinematicTransitionSnapshot,
} from "./cinematic-camera-transition";

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

  it("keeps the matte opaque while sequencing fade-out, swap, and fade-in", async () => {
    vi.useFakeTimers();
    try {
      const snapshots: CinematicTransitionSnapshot[] = [];
      const matte = { style: {}, dataset: {} } as unknown as HTMLElement;
      const controller = new TransitionController({
        fadeOutMs: 40,
        fadeInMs: 30,
        onChange: (snapshot) => snapshots.push(snapshot),
      });
      controller.attachMatte(matte);

      const completed = controller.transition(() => undefined);
      expect(controller.snapshot).toMatchObject({ state: "fade-out", opacity: 1, generation: 1 });
      await vi.advanceTimersByTimeAsync(40);
      expect(controller.snapshot).toMatchObject({ state: "fade-in", opacity: 0, generation: 1 });
      await vi.advanceTimersByTimeAsync(30);

      expect(await completed).toBe(true);
      expect(snapshots.map(({ state }) => state)).toEqual([
        "fade-out",
        "swap",
        "fade-in",
        "stable",
      ]);
      expect(snapshots.find(({ state }) => state === "swap")?.opacity).toBe(1);
      expect(matte.style.background).toContain("rgb(0 0 0");
      controller.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels an older generation without running its swap and cleans up the matte", async () => {
    vi.useFakeTimers();
    try {
      const states: string[] = [];
      const firstSwap = vi.fn();
      const secondSwap = vi.fn();
      const matte = { style: {}, dataset: {} } as unknown as HTMLElement;
      const controller = new TransitionController({
        fadeOutMs: 50,
        fadeInMs: 20,
        onChange: ({ state }) => states.push(state),
      });
      controller.attachMatte(matte);

      const first = controller.transition(firstSwap);
      await vi.advanceTimersByTimeAsync(10);
      const second = controller.transition(secondSwap);
      expect(controller.snapshot.generation).toBe(2);
      await vi.advanceTimersByTimeAsync(50);
      await vi.advanceTimersByTimeAsync(20);

      expect(await first).toBe(false);
      expect(await second).toBe(true);
      expect(firstSwap).not.toHaveBeenCalled();
      expect(secondSwap).toHaveBeenCalledOnce();
      expect(states).toContain("cancelled");

      controller.cancel();
      expect(controller.snapshot).toMatchObject({ state: "cancelled", opacity: 0 });
      controller.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("runs the same swap sequence without animated time when reduced motion is enabled", async () => {
    const states: string[] = [];
    const controller = new TransitionController({
      reducedMotion: true,
      onChange: ({ state }) => states.push(state),
    });

    await expect(controller.transition(() => undefined)).resolves.toBe(true);
    expect(states).toEqual(["fade-out", "swap", "fade-in", "stable"]);
    expect(controller.snapshot.opacity).toBe(0);
    controller.dispose();
  });

  it("invalidates a demand-rendered canvas for every transition phase", async () => {
    const invalidate = vi.fn();
    const controller = new TransitionController({ reducedMotion: true });
    controller.setInvalidator(invalidate);

    await expect(controller.transition(() => undefined)).resolves.toBe(true);

    expect(invalidate).toHaveBeenCalledTimes(4);
    controller.dispose();
  });
});
