import { describe, expect, it, vi } from "vitest";
import { keepScreenAwake, type ScreenLockState } from "./screen-wake-lock";

class Visibility extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
  change(value: DocumentVisibilityState) {
    this.visibilityState = value;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}
function sentinel() {
  const value = Object.assign(new EventTarget(), {
    released: false,
    type: "screen" as const,
    onrelease: null,
    release: vi.fn(async () => {
      value.released = true;
      value.dispatchEvent(new Event("release"));
    }),
  });
  return value as unknown as WakeLockSentinel & { release: ReturnType<typeof vi.fn> };
}
const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe("optional visible screen lock", () => {
  it("releases on hiding, reacquires on return and cleans up on leaving the game", async () => {
    const doc = new Visibility();
    const first = sentinel(),
      second = sentinel();
    const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const states: ScreenLockState[] = [];
    const dispose = keepScreenAwake(doc, { request }, (state) => states.push(state));
    await flush();
    expect(request).toHaveBeenCalledWith("screen");
    expect(states.at(-1)).toBe("active");
    doc.change("hidden");
    expect(first.release).toHaveBeenCalledOnce();
    doc.change("visible");
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
    dispose();
    expect(second.release).toHaveBeenCalledOnce();
    doc.change("visible");
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("releases a late grant after the component has unmounted", async () => {
    let grant!: (value: WakeLockSentinel) => void;
    const request = vi.fn(
      () =>
        new Promise<WakeLockSentinel>((resolve) => {
          grant = resolve;
        }),
    );
    const state = vi.fn();
    const dispose = keepScreenAwake(new Visibility(), { request }, state);
    dispose();
    const late = sentinel();
    grant(late);
    await flush();
    expect(late.release).toHaveBeenCalledOnce();
    expect(state).not.toHaveBeenCalledWith("active");
  });
  it("handles a hidden-visible race while a request is pending", async () => {
    const doc = new Visibility();
    let grant!: (value: WakeLockSentinel) => void;
    const old = sentinel(),
      current = sentinel();
    const request = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<WakeLockSentinel>((resolve) => {
            grant = resolve;
          }),
      )
      .mockResolvedValue(current);
    const state = vi.fn();
    const dispose = keepScreenAwake(doc, { request }, state);
    doc.change("hidden");
    doc.change("visible");
    expect(request).toHaveBeenCalledOnce();
    grant(old);
    await flush();
    await flush();
    expect(old.release).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledTimes(2);
    expect(state).toHaveBeenLastCalledWith("active");
    dispose();
  });
  it("does not fight a battery or browser revocation with a retry loop", async () => {
    const lock = sentinel();
    const request = vi.fn().mockResolvedValue(lock);
    const state = vi.fn();
    const dispose = keepScreenAwake(new Visibility(), { request }, state);
    await flush();
    await lock.release();
    await flush();
    expect(request).toHaveBeenCalledOnce();
    expect(state).toHaveBeenLastCalledWith("released");
    dispose();
  });
  it("keeps playing when the browser rejects the optional request", async () => {
    const state = vi.fn();
    const request = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    const dispose = keepScreenAwake(new Visibility(), { request }, state);
    await flush();
    expect(state).toHaveBeenLastCalledWith("unavailable");
    expect(request).toHaveBeenCalledOnce();
    dispose();
  });
  it("waits for a hidden document to become visible", async () => {
    const doc = new Visibility();
    doc.visibilityState = "hidden";
    const request = vi.fn().mockResolvedValue(sentinel());
    const dispose = keepScreenAwake(doc, { request }, vi.fn());
    expect(request).not.toHaveBeenCalled();
    doc.change("visible");
    await flush();
    expect(request).toHaveBeenCalledOnce();
    dispose();
  });
});
