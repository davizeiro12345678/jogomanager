import { afterEach, expect, it, vi } from "vitest";

const preload = vi.hoisted(() => ({ set: vi.fn(() => Promise.resolve()) }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => unknown) => effect(),
}));
vi.mock("./sets/registry", () => ({ preloadCinematicSet: preload.set }));
vi.mock("../CinematicStage3D", () => ({ CinematicStage3D: () => null }));
import { useCinematicPreload } from "./cinematic-loading";

afterEach(() => vi.unstubAllGlobals());
it("warms the anticipated set alongside the stage after the host screen paints", async () => {
  let idle: (() => void) | undefined;
  vi.stubGlobal("navigator", { hardwareConcurrency: 8 });
  vi.stubGlobal("document", { hidden: false });
  vi.stubGlobal("window", {
    requestIdleCallback: (callback: () => void) => {
      idle = callback;
      return 1;
    },
    cancelIdleCallback: () => undefined,
  });
  (useCinematicPreload as (enabled: boolean, set: string) => void)(true, "locker");
  expect(preload.set).not.toHaveBeenCalled();
  idle!();
  await vi.waitFor(() => expect(preload.set).toHaveBeenCalledWith("locker"));
});
