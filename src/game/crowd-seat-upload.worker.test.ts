import { afterEach, beforeEach, expect, it, vi } from "vitest";

const worker = {
  location: { origin: "https://jogomanager.com" },
  onmessage: null as ((event: MessageEvent<unknown>) => void) | null,
  postMessage: vi.fn(),
};
const origin = worker.location.origin;
const input = new Float64Array([1, 2, 3, 0.2, 0.4, 0.6, 0.5, 0.5, 0.5]);

beforeEach(async () => {
  vi.resetModules();
  worker.postMessage.mockClear();
  worker.onmessage = null;
  vi.stubGlobal("self", worker);
  await import("./crowd-seat-upload.worker");
});
afterEach(() => vi.unstubAllGlobals());

function deliver(data: unknown, messageOrigin: string, isTrusted: boolean) {
  worker.onmessage!({ data, origin: messageOrigin, isTrusted } as MessageEvent);
}

it("rejects synthetic and foreign-origin messages before computing a seat buffer", () => {
  deliver(input, origin, false);
  deliver(input, "https://foreign.example", true);
  expect(worker.postMessage).not.toHaveBeenCalled();
});

it("accepts native dedicated-worker messages, whose origin can be empty", () => {
  deliver(input, "", true);
  expect(worker.postMessage).toHaveBeenCalledOnce();
  const [result, options] = worker.postMessage.mock.calls[0]!;
  expect(result.matrices).toBeInstanceOf(Float32Array);
  expect(result.matrices.length).toBe(16);
  expect(options.transfer).toEqual([result.matrices.buffer]);
});

it("retains the existing shape and length validation on trusted messages", () => {
  deliver(new Float64Array(2), "", true);
  deliver({ invalid: true }, origin, true);
  expect(worker.postMessage.mock.calls).toEqual([[null], [null]]);
});
