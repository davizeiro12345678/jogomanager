import { describe, expect, it, vi } from "vitest";
import { deferHomeHydration, shouldDeferHomeHydration } from "./home-hydration";

function hooks() {
  const callbacks: Record<string, () => void> = {};
  const cancelled: string[] = [];
  const api = {
    onHeroSettled: vi.fn((callback: () => void) => {
      callbacks["hero"] = callback;
      return () => cancelled.push("hero");
    }),
    onFirstInteraction: vi.fn((callback: () => void) => {
      callbacks["interaction"] = callback;
      return () => cancelled.push("interaction");
    }),
    afterTwoFrames: vi.fn((callback: () => void) => {
      callbacks["paint"] = callback;
      return () => cancelled.push("paint");
    }),
    onIdle: vi.fn((callback: () => void) => {
      callbacks["idle"] = callback;
      return () => cancelled.push("idle");
    }),
    onDeadline: vi.fn((callback: () => void, delayMs: number) => {
      callbacks["deadline"] = callback;
      expect(delayMs).toBeGreaterThanOrEqual(2600);
      return () => cancelled.push("deadline");
    }),
  };
  return { api, callbacks, cancelled };
}

describe("public homepage hydration scheduling", () => {
  it("defers only the visible SSR home; gameplay and hidden documents hydrate immediately", () => {
    expect(shouldDeferHomeHydration(true, "/", false)).toBe(true);
    expect(shouldDeferHomeHydration(true, "/auth", false)).toBe(false);
    expect(shouldDeferHomeHydration(true, "/partida-rapida", false)).toBe(false);
    expect(shouldDeferHomeHydration(false, "/", false)).toBe(false);
    expect(shouldDeferHomeHydration(true, "/", true)).toBe(false);
  });

  it("does not start React while the LCP hero is loading or before two paints and an idle slot", () => {
    const h = hooks();
    const hydrate = vi.fn();
    deferHomeHydration(hydrate, h.api);
    expect(hydrate).not.toHaveBeenCalled();
    expect(h.api.afterTwoFrames).not.toHaveBeenCalled();
    h.callbacks["hero"]!();
    expect(hydrate).not.toHaveBeenCalled();
    expect(h.api.onIdle).not.toHaveBeenCalled();
    h.callbacks["paint"]!();
    expect(hydrate).not.toHaveBeenCalled();
    h.callbacks["idle"]!();
    expect(hydrate).toHaveBeenCalledTimes(1);
  });

  it("starts on first user interaction rather than blocking keyboard and pointer controls", () => {
    const h = hooks();
    const hydrate = vi.fn();
    deferHomeHydration(hydrate, h.api);
    h.callbacks["interaction"]!();
    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(h.cancelled).toContain("deadline");
    h.callbacks["hero"]!();
    h.callbacks["deadline"]!();
    expect(hydrate).toHaveBeenCalledTimes(1);
  });

  it("uses a bounded deadline when the hero fails to finish loading", () => {
    const h = hooks();
    const hydrate = vi.fn();
    deferHomeHydration(hydrate, h.api);
    h.callbacks["deadline"]!();
    expect(hydrate).toHaveBeenCalledTimes(1);
  });

  it("handles a subsequent interaction after hero/paint without evaluating React twice", () => {
    const h = hooks();
    const hydrate = vi.fn();
    deferHomeHydration(hydrate, h.api);
    h.callbacks["hero"]!();
    h.callbacks["paint"]!();
    h.callbacks["interaction"]!();
    h.callbacks["idle"]!();
    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(h.cancelled).toContain("idle");
  });
});
