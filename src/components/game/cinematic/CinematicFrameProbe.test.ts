import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ callback: undefined as ((frame: unknown) => void) | undefined }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (value: unknown) => ({ current: value }),
  useEffect: (effect: () => unknown) => effect(),
}));
vi.mock("@react-three/fiber", () => ({
  useThree: (selector: (state: unknown) => unknown) =>
    selector({ gl: {}, camera: { userData: {} }, scene: {} }),
}));
vi.mock("./cinematic-runtime", () => ({
  useCinematicRuntime: () => ({ clock: { time: 0, lineTime: 0 } }),
}));
vi.mock("@/game/graphics-renderer-metadata", () => ({
  rendererMetadata: () => ({ kind: "webgl2", rendererClass: "test", gpuRenderer: "test" }),
}));
vi.mock("../graphics-probe", () => ({
  subscribeRenderedFrames: (_gl: unknown, callback: (frame: unknown) => void) => {
    state.callback = callback;
    return () => undefined;
  },
}));

import { CinematicFrameProbe } from "./CinematicFrameProbe";

it("keeps the placeholder until the selected set has mounted and a subsequent frame is drawn", () => {
  vi.stubGlobal("document", { hidden: false });
  const onReady = vi.fn();
  const setReady = { current: false };
  const host = { current: { dataset: {} } };
  CinematicFrameProbe({ host, openedAt: 0, stopped: true, onReady, setReady } as never);
  const frame = { now: 10, draws: 4, triangles: 30, width: 1280, height: 720, dpr: 1 };
  state.callback!(frame);
  expect(onReady).not.toHaveBeenCalled();
  setReady.current = true;
  state.callback!({ ...frame, now: 20 });
  expect(onReady).toHaveBeenCalledOnce();
  state.callback!({ ...frame, now: 30 });
  expect(onReady).toHaveBeenCalledOnce();
  vi.unstubAllGlobals();
});
