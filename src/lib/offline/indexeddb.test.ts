import { afterEach, describe, expect, it, vi } from "vitest";
import { createBoundedStore } from "./indexeddb";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function nativeStub() {
  const requests: IDBOpenDBRequest[] = [];
  const events = new EventTarget();
  const abort = vi.fn(() => events.dispatchEvent(new Event("abort")));
  const transaction = {
    addEventListener: events.addEventListener.bind(events),
    abort,
    objectStore: () => ({ synthetic: true }),
    error: null,
  };
  const connection = {
    close: vi.fn(),
    transaction: vi.fn(() => transaction),
    onversionchange: null as (() => void) | null,
    onclose: null,
  };
  vi.stubGlobal("indexedDB", {
    open: vi.fn(() => {
      const request = { result: connection } as unknown as IDBOpenDBRequest;
      requests.push(request);
      return request;
    }),
  });
  const opened = (index = 0) => {
    const request = requests[index];
    if (!request) throw new Error("Expected a pending native open request");
    request.onsuccess?.call(request, new Event("success"));
  };
  return { requests, connection, transaction, events, opened, abort };
}

describe("bounded native IndexedDB lifecycle", () => {
  it("retries after a synchronous native open failure instead of caching rejection forever", async () => {
    const native = nativeStub();
    vi.mocked(indexedDB.open).mockImplementationOnce(() => {
      throw new DOMException("Synthetic blocked storage", "SecurityError");
    });
    const store = createBoundedStore("qa-only", "keyval");
    await expect(store("readonly", () => 1)).rejects.toThrow(/blocked storage/);
    const retry = store("readonly", () => 2);
    expect(native.requests).toHaveLength(1);
    native.opened();
    await Promise.resolve();
    native.events.dispatchEvent(new Event("complete"));
    await expect(retry).resolves.toBe(2);
  });
  it("rejects a blocked open and closes the late connection without invoking any write", async () => {
    vi.useFakeTimers();
    const native = nativeStub();
    const callback = vi.fn();
    const store = createBoundedStore("qa-only", "keyval", 1000, 2000);
    const result = store("readwrite", callback);
    const rejected = expect(result).rejects.toThrow(/abertura/i);
    await vi.advanceTimersByTimeAsync(1001);
    await rejected;
    native.opened();
    expect(native.connection.close).toHaveBeenCalledOnce();
    expect(native.connection.transaction).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
    const retry = store("readonly", () => "retry");
    native.opened(1);
    await Promise.resolve();
    native.events.dispatchEvent(new Event("complete"));
    await expect(retry).resolves.toBe("retry");
  });

  it("aborts an overdue transaction before rejecting instead of permitting a late commit", async () => {
    vi.useFakeTimers();
    const native = nativeStub();
    const store = createBoundedStore("qa-only", "keyval", 1000, 2000);
    const result = store("readwrite", () => new Promise<void>(() => {}));
    const rejected = expect(result).rejects.toThrow(/transação/i);
    native.opened();
    await vi.advanceTimersByTimeAsync(2001);
    await rejected;
    expect(native.abort).toHaveBeenCalledOnce();
  });

  it("waits for native commit even if the callback resolves first", async () => {
    const native = nativeStub();
    const store = createBoundedStore("qa-only", "keyval");
    let settled = false;
    const result = store("readwrite", () => 42).then((value) => {
      settled = true;
      return value;
    });
    native.opened();
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    native.events.dispatchEvent(new Event("complete"));
    await expect(result).resolves.toBe(42);
  });

  it("closes on versionchange and opens a fresh connection on the next operation", async () => {
    const native = nativeStub();
    const store = createBoundedStore("qa-only", "keyval");
    const first = store("readonly", () => 1);
    native.opened();
    await Promise.resolve();
    native.events.dispatchEvent(new Event("complete"));
    await first;
    native.connection.onversionchange?.();
    expect(native.connection.close).toHaveBeenCalledOnce();
    const second = store("readonly", () => 2);
    expect(native.requests).toHaveLength(2);
    native.opened(1);
    await Promise.resolve();
    native.events.dispatchEvent(new Event("complete"));
    await expect(second).resolves.toBe(2);
  });
});
