import { beforeEach, describe, expect, it, vi } from "vitest";

const probe = vi.hoisted(() => ({
  frame: undefined as ((state: unknown, dt: number) => void) | undefined,
  invalidate: vi.fn(),
}));
vi.mock("@react-three/fiber", () => ({
  useFrame: (callback: typeof probe.frame) => {
    probe.frame = callback;
  },
  useThree: (select: (state: { invalidate: typeof probe.invalidate }) => unknown) =>
    select({ invalidate: probe.invalidate }),
}));
vi.mock("react", () => ({ useRef: (current: unknown) => ({ current }) }));
vi.mock("./cinematic-runtime", () => ({
  useCinematicRuntime: () => ({ clock: { time: 0, lineTime: 0 } }),
}));
import { CinematicFrameProbe } from "./CinematicFrameProbe";

describe("paused cinematic initialization", () => {
  beforeEach(() => {
    probe.invalidate.mockClear();
  });

  it("requests only enough demand frames to finish readiness while remaining paused", () => {
    const onReady = vi.fn();
    const onVisible = vi.fn();
    const dataset: Record<string, string> = {};
    CinematicFrameProbe({
      host: { current: { dataset } as unknown as HTMLDivElement },
      openedAt: 0,
      stopped: true,
      onReady,
      onVisible,
    });
    const state = {
      gl: { info: { render: { calls: 12, triangles: 200 }, reset: vi.fn() } },
      camera: { userData: {} },
    };
    for (let index = 0; index < 3; index++) probe.frame!(state, 1 / 60);
    expect(probe.invalidate).toHaveBeenCalledTimes(3);
    expect(onReady).not.toHaveBeenCalled();
    probe.frame!(state, 1 / 60);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(dataset["cinematicReady"]).toBe("true");
    expect(onVisible).toHaveBeenCalledTimes(1);
    for (let index = 0; index < 8; index++) probe.frame!(state, 1 / 60);
    expect(probe.invalidate).toHaveBeenCalledTimes(3);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(dataset["cinematicFps"]).toBeUndefined();
  });
});
