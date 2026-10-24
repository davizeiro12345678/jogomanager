import { describe, expect, it } from "vitest";

import { lookFor, proportionsFor } from "./player-model";
import {
  createStudioAppearanceStore,
  resolveStudioAppearance,
  studioAppearanceRevision,
} from "./player-studio-appearance";
import { sculptedHair } from "./player-sculpt";

describe("Player Studio appearance revision", () => {
  it("notifies a subscription snapshot when a listener resubscribes during notification", () => {
    const original = lookFor("studio-resubscribe", "MF", true);
    const store = createStudioAppearanceStore(original);
    let calls = 0;
    let unsubscribe = () => {};
    const listener = () => {
      calls++;
      unsubscribe();
      if (calls < 2) unsubscribe = store.subscribe(listener);
    };
    unsubscribe = store.subscribe(listener);
    store.set({ ...original, hairStyle: "buzz" });
    expect(calls).toBe(1);
    unsubscribe();
  });
  it("notifies the mounted Canvas subscriber synchronously for structural edits only", () => {
    const original = lookFor("studio-root-bridge", "MF", true);
    const store = createStudioAppearanceStore(original);
    const received: string[] = [];
    const unsubscribe = store.subscribe(() => received.push(store.getSnapshot().hairStyle));
    const buzz = resolveStudioAppearance(original, {
      hairStyle: "buzz",
      beard: "original",
      physique: "original",
    });
    store.set(buzz);
    expect(received).toEqual(["buzz"]);
    expect(store.getSnapshot()).toBe(buzz);
    store.set({ ...buzz });
    expect(received).toEqual(["buzz"]);
    unsubscribe();
    store.set(original);
    expect(store.getSnapshot()).toBe(original);
    expect(received).toEqual(["buzz"]);
    expect(buzz.seed).toBe(original.seed);
  });
  it("resolves a selected buzz cut through the same authoring path into distinct scalp geometry", () => {
    const original = {
      ...lookFor("studio-control-integration", "MF", true),
      hairStyle: "short" as const,
    };
    const selection = {
      hairStyle: "buzz" as const,
      beard: "original" as const,
      physique: "original" as const,
    };
    const buzz = resolveStudioAppearance(original, selection);
    expect(buzz.hairStyle).toBe("buzz");
    expect(buzz.headband).toBe(false);
    expect(buzz.seed).toBe(original.seed);
    expect(proportionsFor(buzz)).toEqual(proportionsFor(original));
    expect(studioAppearanceRevision(buzz)).not.toBe(studioAppearanceRevision(original));
    const p = proportionsFor(buzz),
      shaved = sculptedHair(p, buzz),
      short = sculptedHair(p, original);
    const a = shaved.getAttribute("position"),
      b = short.getAttribute("position");
    let difference = 0;
    for (let i = 0; i < a.count; i++)
      difference = Math.max(
        difference,
        Math.hypot(a.getX(i) - b.getX(i), a.getY(i) - b.getY(i), a.getZ(i) - b.getZ(i)),
      );
    expect(difference).toBeGreaterThan(0.003);
    expect(resolveStudioAppearance(original, { ...selection, hairStyle: "original" })).toEqual(
      original,
    );
    const band = resolveStudioAppearance(original, { ...selection, hairStyle: "headband" });
    expect(band.hairStyle).toBe("medium");
    expect(band.headband).toBe(true);
    shaved.dispose();
    short.dispose();
  });

  it("is stable for the same saved athlete and changes for a rebuilt visual rig", () => {
    const look = lookFor("studio-appearance-revision", "MF", true);
    expect(studioAppearanceRevision(look)).toBe(studioAppearanceRevision({ ...look }));
    expect(
      studioAppearanceRevision({
        ...look,
        hairStyle: look.hairStyle === "bald" ? "short" : "bald",
      }),
    ).not.toBe(studioAppearanceRevision(look));
    expect(
      studioAppearanceRevision({
        ...look,
        beard: look.beard === "none" ? "stubble" : "none",
      }),
    ).not.toBe(studioAppearanceRevision(look));
    expect(studioAppearanceRevision({ ...look, height: look.height + 0.02 })).not.toBe(
      studioAppearanceRevision(look),
    );
  });
});
