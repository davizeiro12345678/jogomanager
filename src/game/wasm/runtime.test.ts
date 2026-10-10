import { afterEach, expect, it, vi } from "vitest";
import { WasmRuntime } from "./runtime";
const moduleFor = (abi = 1, capabilities = 31) => ({
  default: vi.fn(async () => undefined),
  wasm_abi_version: () => abi,
  wasm_capabilities: () => capabilities,
});
afterEach(() => vi.useRealTimers());
it("rejects capability masks that would wrap during bitwise coercion", async () => {
  const importer = vi.fn(async () => moduleFor());
  const runtime = new WasmRuntime(importer);
  for (const mask of [-1, 0.5, NaN, Infinity, 2 ** 32, 2 ** 32 + 1])
    expect(await runtime.load(mask)).toBeNull();
  expect(importer).not.toHaveBeenCalled();
  expect(await runtime.load(1)).not.toBeNull();
});
it("initializes once across concurrent consumers and rejects unsupported kernels", async () => {
  const module = moduleFor(1, 5),
    importer = vi.fn(async () => module);
  const runtime = new WasmRuntime(importer);
  expect(await Promise.all([runtime.load(1), runtime.load(4), runtime.load(2)])).toEqual([
    module,
    module,
    null,
  ]);
  expect(importer).toHaveBeenCalledTimes(1);
  expect(module.default).toHaveBeenCalledTimes(1);
});
it("bounds stalled imports without switching an already selected fallback", async () => {
  vi.useFakeTimers();
  let complete!: (module: ReturnType<typeof moduleFor>) => void;
  const runtime = new WasmRuntime(
    () =>
      new Promise<ReturnType<typeof moduleFor>>((resolve) => {
        complete = resolve;
      }),
  );
  const first = runtime.load(2, 20);
  await vi.advanceTimersByTimeAsync(21);
  expect(await first).toBeNull();
  const module = moduleFor();
  complete(module);
  expect(await runtime.load(4)).toBe(module);
  expect(await first).toBeNull();
  expect(runtime.stats.loads).toBe(1);
  expect(runtime.stats.timeouts).toBe(1);
  expect(vi.getTimerCount()).toBe(0);
});
it("caches unavailable or incompatible binaries as safe optional fallbacks", async () => {
  for (const importer of [
    async () => moduleFor(9),
    async () => {
      throw new Error("offline");
    },
  ]) {
    const runtime = new WasmRuntime(importer);
    expect(await runtime.load(1)).toBeNull();
    expect(await runtime.load(1)).toBeNull();
    expect(runtime.stats.loads).toBe(1);
    expect(runtime.stats.failures).toBe(1);
  }
});
