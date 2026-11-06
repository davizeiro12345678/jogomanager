import { describe, expect, it, vi } from "vitest";
import { isLightweightCssPath } from "../lib/public-content-routes";

const world = vi.hoisted(() => ({ ready: false, apply: vi.fn() }));
const stylesheet = vi.hoisted(() => ({ ensure: vi.fn(async () => undefined) }));
vi.mock("@/lib/world", () => ({
  default: () => {
    if (!world.ready) world.apply();
  },
}));
vi.mock("@/components/game/QuickLive", () => ({ default: () => world.ready }));
vi.mock("@/lib/game-stylesheet-loader", () => ({ ensureGameStylesheet: stylesheet.ensure }));

describe("quick match startup", () => {
  it("shows selection without booting a career and initializes the world before live play", async () => {
    expect(isLightweightCssPath("/partida-rapida/")).toBe(true);
    expect(isLightweightCssPath("/dashboard")).toBe(false);
    expect(isLightweightCssPath("/guias")).toBe(true);
    world.apply.mockImplementation(() => {
      world.ready = true;
    });
    const { loadQuickLive } = await import("./quick-match-entry");
    expect(world.apply).not.toHaveBeenCalled();
    const preloaded = loadQuickLive();
    const clicked = loadQuickLive();
    expect(clicked).toBe(preloaded);
    expect((await clicked).default).toBeTypeOf("function");
    expect(world.ready).toBe(true);
    expect(world.apply).toHaveBeenCalledTimes(1);
    expect(stylesheet.ensure).toHaveBeenCalledTimes(1);
    await loadQuickLive();
    expect(world.apply).toHaveBeenCalledTimes(1);
    expect(stylesheet.ensure).toHaveBeenCalledTimes(2);
  });
});
