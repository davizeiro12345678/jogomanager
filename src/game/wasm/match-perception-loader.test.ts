import { afterEach, expect, it, vi } from "vitest";
const initialize = vi.hoisted(() => vi.fn(() => new Promise(() => {})));
vi.mock("./pkg/crowd_visibility_wasm", () => ({ default: initialize }));
import { loadPassLaneKernel } from "./match-perception";
afterEach(() => vi.useRealTimers());
it("bounds optional kernel initialization so match startup cannot wait forever", async () => {
  vi.useFakeTimers();
  const result = loadPassLaneKernel();
  let settled = false;
  void result.then(() => {
    settled = true;
  });
  await vi.advanceTimersByTimeAsync(5001);
  expect(settled).toBe(true);
  await expect(result).resolves.toBeNull();
  await expect(loadPassLaneKernel()).resolves.toBeNull();
  expect(initialize).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
