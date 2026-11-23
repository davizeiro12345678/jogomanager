import { afterEach, describe, expect, it, vi } from "vitest";
import { createCeremonyCompletion } from "./ceremony-completion";

afterEach(() => {
  vi.useRealTimers();
});
describe("ceremony completion watchdog", () => {
  it("finishes at most once when WebGL frames stall", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const control = createCeremonyCompletion(done, 28_000);
    vi.advanceTimersByTime(27_999);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    control.complete();
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("an early manual skip cancels the timeout", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const control = createCeremonyCompletion(done, 28_000);
    control.complete();
    vi.advanceTimersByTime(30_000);
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("teardown prevents late state updates", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const control = createCeremonyCompletion(done, 28_000);
    control.cancel();
    vi.advanceTimersByTime(30_000);
    expect(done).not.toHaveBeenCalled();
  });
});
