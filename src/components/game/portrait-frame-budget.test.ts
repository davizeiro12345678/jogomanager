import { afterEach, expect, it, vi } from "vitest";
import { schedulePortraitFrames } from "./portrait-frame-budget";
afterEach(() => vi.useRealTimers());

it("limits idle invalidations and leaves no animation timer after hiding or unmounting", () => {
  vi.useFakeTimers();
  const invalidate = vi.fn();
  const stop = schedulePortraitFrames(invalidate);
  vi.advanceTimersByTime(1000);
  expect(invalidate.mock.calls.length).toBeGreaterThanOrEqual(29);
  expect(invalidate.mock.calls.length).toBeLessThanOrEqual(31);
  stop();
  const calls = invalidate.mock.calls.length;
  vi.advanceTimersByTime(60_000);
  expect(invalidate.mock.calls.length).toBe(calls);
  expect(vi.getTimerCount()).toBe(0);
});
