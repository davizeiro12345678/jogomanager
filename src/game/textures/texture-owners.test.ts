import { describe, expect, it, vi } from "vitest";
import { TextureRendererOwners } from "./texture-owners";
import { disposeKtx2, onKtx2Ready } from "./ktx2";

describe("Canvas texture ownership", () => {
  it("coalesces texture changes into one redraw and releases subscribers before delivery", () => {
    let frame!: FrameRequestCallback;
    const schedule = vi.fn((callback: FrameRequestCallback) => {
      frame = callback;
      return 1;
    });
    vi.stubGlobal("requestAnimationFrame", schedule);
    vi.stubGlobal("document", { hidden: false });
    const changed = vi.fn();
    const removed = vi.fn();
    const release = onKtx2Ready(changed);
    const unsubscribe = onKtx2Ready(removed);
    try {
      disposeKtx2();
      disposeKtx2();
      expect(schedule).toHaveBeenCalledTimes(1);
      expect(changed).not.toHaveBeenCalled();
      unsubscribe();
      frame(0);
      expect(changed).toHaveBeenCalledTimes(1);
      expect(removed).not.toHaveBeenCalled();
    } finally {
      release();
      unsubscribe();
      vi.unstubAllGlobals();
    }
  });
  it("keeps one scene alive while the other unmounts and releases idempotently", () => {
    const owners = new TextureRendererOwners<object>();
    const stadium = {},
      portrait = {};
    const releaseStadium = owners.acquire(stadium, "bc7");
    const releasePortrait = owners.acquire(portrait, "bc7");
    expect(owners.count).toBe(2);
    releaseStadium();
    releaseStadium();
    expect(owners.count).toBe(1);
    expect(owners.compatible).toBe(true);
    releasePortrait();
    expect(owners.count).toBe(0);
  });
  it("uses procedural fallback while incompatible GPU backends coexist", () => {
    const owners = new TextureRendererOwners<object>();
    const renderer = {};
    const first = owners.acquire(renderer, "bc7");
    const second = owners.acquire(renderer, "bc7");
    const webGpu = owners.acquire({}, "etc2");
    expect(owners.compatible).toBe(false);
    webGpu();
    expect(owners.compatible).toBe(true);
    first();
    expect(owners.count).toBe(1);
    second();
    expect(owners.count).toBe(0);
  });
});
