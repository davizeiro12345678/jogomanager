import { describe, expect, it } from "vitest";
import { TextureRendererOwners } from "./texture-owners";

describe("Canvas texture ownership", () => {
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
