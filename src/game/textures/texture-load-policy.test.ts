import { expect, it, vi } from "vitest";
import {
  canRequestTexture,
  scheduleTextureRetry,
  textureFailureAfter,
  textureHttpStatus,
} from "./texture-load-policy";

it("stops missing and private texture URLs from refetching on every player promotion", () => {
  for (const status of [401, 403, 404, 410]) {
    const failure = textureFailureAfter(undefined, 1_000, status);
    expect(canRequestTexture(failure, 1_000)).toBe(false);
    expect(canRequestTexture(failure, 10_000_000)).toBe(false);
  }
});

it("backs off temporary errors and bounds recovery attempts", () => {
  expect(canRequestTexture(undefined, 0)).toBe(true);
  const first = textureFailureAfter(undefined, 1_000, 503);
  expect(canRequestTexture(first, 30_999)).toBe(false);
  expect(canRequestTexture(first, 31_000)).toBe(true);
  const second = textureFailureAfter(first, 31_000);
  expect(canRequestTexture(second, 90_999)).toBe(false);
  expect(canRequestTexture(second, 91_000)).toBe(true);
  const final = textureFailureAfter(second, 91_000, 503);
  expect(canRequestTexture(final, 10_000_000)).toBe(false);
});

it("recognizes FileLoader HTTP errors and tolerates network exceptions", () => {
  expect(textureHttpStatus({ response: { status: 404 } })).toBe(404);
  expect(textureHttpStatus(new Error("offline"))).toBeUndefined();
  expect(textureHttpStatus(null)).toBeUndefined();
});

it("schedules transient texture retries and cancels them when the scene is disposed", () => {
  vi.useFakeTimers();
  try {
    const now = Date.now();
    const failure = textureFailureAfter(undefined, now, 503);
    const retry = vi.fn();
    const cancel = scheduleTextureRetry(failure, now, retry);

    expect(cancel).toBeTypeOf("function");
    vi.advanceTimersByTime(29_999);
    expect(retry).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(retry).toHaveBeenCalledOnce();

    const cancelledRetry = vi.fn();
    const cancelPending = scheduleTextureRetry(failure, Date.now(), cancelledRetry);
    cancelPending?.();
    vi.advanceTimersByTime(30_000);
    expect(cancelledRetry).not.toHaveBeenCalled();
    expect(scheduleTextureRetry(textureFailureAfter(undefined, now, 404), now, vi.fn())).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
