import kernelUrl from "./pkg/seat-transforms.wasm?url";
import { acquirePresentationLanes } from "../presentation-lanes";
import { MAX_SHARED_SEATS } from "./seat-transform-contract";
export type SeatBuffers = {
  matrices: Float32Array;
  colors: Float32Array;
  skins: Float32Array;
  styles: Float32Array;
};
type Source = {
  positions: readonly { x: number; y: number; z: number }[];
  colors: readonly { r: number; g: number; b: number }[];
  skins: readonly { r: number; g: number; b: number }[];
};
function validSource(source: Source): boolean {
  if (
    !source ||
    !Array.isArray(source.positions) ||
    !Array.isArray(source.colors) ||
    !Array.isArray(source.skins) ||
    source.positions.length > MAX_SHARED_SEATS ||
    source.colors.length !== source.positions.length ||
    source.skins.length !== source.positions.length
  )
    return false;
  const finite = (value: number) => Number.isFinite(value) && Math.abs(value) <= 1_000_000;
  for (let index = 0; index < source.positions.length; index++) {
    const position = source.positions[index],
      color = source.colors[index],
      skin = source.skins[index];
    if (
      !position ||
      !color ||
      !skin ||
      !finite(position.x) ||
      !finite(position.y) ||
      !finite(position.z) ||
      !finite(color.r) ||
      !finite(color.g) ||
      !finite(color.b) ||
      !finite(skin.r) ||
      !finite(skin.g) ||
      !finite(skin.b)
    )
      return false;
  }
  return true;
}
let compiled: Promise<WebAssembly.Module | null> | null = null;
const COMPILE_TIMEOUT_MS = 5_000;

function loadKernel(): Promise<WebAssembly.Module | null> {
  if (compiled) return compiled;
  const controller = new AbortController();
  compiled = new Promise((resolve) => {
    let settled = false;
    const finish = (module: WebAssembly.Module | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(module);
    };
    const timer = setTimeout(() => {
      controller.abort();
      finish(null);
    }, COMPILE_TIMEOUT_MS);
    Promise.resolve()
      .then(() => fetch(kernelUrl, { signal: controller.signal }))
      .then(async (response) => {
        if (!response.ok) throw new Error("Shared WASM kernel unavailable");
        return WebAssembly.compile(await response.arrayBuffer());
      })
      .then(finish, () => finish(null));
  });
  return compiled;
}

function waitForKernel(signal: AbortSignal): Promise<WebAssembly.Module | null> {
  if (signal.aborted) return Promise.resolve(null);
  return new Promise((resolve) => {
    const finish = (module: WebAssembly.Module | null) => {
      signal.removeEventListener("abort", abort);
      resolve(module);
    };
    const abort = () => finish(null);
    signal.addEventListener("abort", abort, { once: true });
    void loadKernel().then(finish);
    if (signal.aborted) abort();
  });
}
export const sharedSeatStats = { workers: 0, completed: 0, arenaBytes: 0, failures: 0 };

/** Two native WASM instances share a bounded arena and write disjoint ranges. */
export async function prepareSharedSeatBuffers(
  source: Source,
  signal: AbortSignal,
): Promise<SeatBuffers | null> {
  if (
    !validSource(source) ||
    !globalThis.crossOriginIsolated ||
    typeof SharedArrayBuffer === "undefined" ||
    typeof Worker === "undefined" ||
    typeof navigator === "undefined" ||
    !Number.isFinite(navigator.hardwareConcurrency) ||
    navigator.hardwareConcurrency < 8 ||
    source.positions.length < 512
  )
    return null;
  if (signal.aborted) return null;
  const count = source.positions.length;
  if (source.colors.length !== count || source.skins.length !== count) return null;
  const pages = Math.ceil((64 + count * 168) / 65536);
  if (pages > 512) return null;
  const module = await waitForKernel(signal);
  if (!module || signal.aborted || !validSource(source)) return null;
  const workers: Worker[] = [];
  const cleanups: (() => void)[] = [];
  const release = await acquirePresentationLanes(2, signal);
  if (!release) return null;
  let arenaBytes = 0;
  try {
    const memory = new WebAssembly.Memory({ initial: pages, maximum: 512, shared: true });
    if (signal.aborted) return null;
    const inputs = new Float64Array(memory.buffer, 64, count * 9);
    for (let index = 0; index < count; index++) {
      const position = source.positions[index]!;
      const color = source.colors[index]!,
        skin = source.skins[index]!;
      const offset = index * 9;
      inputs[offset] = position.x;
      inputs[offset + 1] = position.y;
      inputs[offset + 2] = position.z;
      inputs[offset + 3] = color.r;
      inputs[offset + 4] = color.g;
      inputs[offset + 5] = color.b;
      inputs[offset + 6] = skin.r;
      inputs[offset + 7] = skin.g;
      inputs[offset + 8] = skin.b;
    }
    const matrixOffset = 64 + inputs.byteLength;
    const colorOffset = matrixOffset + count * 64;
    const skinOffset = colorOffset + count * 12;
    const styleOffset = skinOffset + count * 12;
    const state = new Int32Array(memory.buffer, 0, 16);
    arenaBytes = memory.buffer.byteLength;
    sharedSeatStats.arenaBytes += arenaBytes;
    await Promise.all(
      [0, 1].map(
        (lane) =>
          new Promise<void>((resolve, reject) => {
            const worker = new Worker(
              new URL("./shared-seat-transforms.worker.ts", import.meta.url),
              { type: "module" },
            );
            workers.push(worker);
            sharedSeatStats.workers += 1;
            let settled = false;
            const finish = (error?: Error) => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              signal.removeEventListener("abort", fail);
              worker.onmessage = worker.onerror = worker.onmessageerror = null;
              if (error) reject(error);
              else resolve();
            };
            const fail = () => finish(new Error("Shared WASM preparation interrupted"));
            const timer = setTimeout(fail, 10_000);
            cleanups.push(() => {
              fail();
            });
            signal.addEventListener("abort", fail, { once: true });
            worker.onerror = fail;
            worker.onmessageerror = fail;
            worker.onmessage = ({ data }: MessageEvent<{ type: string; lane: number }>) => {
              if (
                !data ||
                data.type !== "done" ||
                data.lane !== lane ||
                Atomics.load(state, 2 + lane) !== 1
              ) {
                fail();
                return;
              }
              finish();
            };
            if (signal.aborted) {
              fail();
              return;
            }
            try {
              worker.postMessage({
                module,
                memory,
                lane,
                args: [
                  Math.floor((count * lane) / 2),
                  Math.floor((count * (lane + 1)) / 2),
                  64,
                  matrixOffset,
                  colorOffset,
                  skinOffset,
                  styleOffset,
                ],
              });
            } catch {
              fail();
            }
          }),
      ),
    );
    if (signal.aborted) return null;
    sharedSeatStats.completed += 1;
    // Retain only output attributes, allowing the larger shared input arena to be collected.
    return {
      matrices: new Float32Array(memory.buffer, matrixOffset, count * 16).slice(),
      colors: new Float32Array(memory.buffer, colorOffset, count * 3).slice(),
      skins: new Float32Array(memory.buffer, skinOffset, count * 3).slice(),
      styles: new Float32Array(memory.buffer, styleOffset, count * 2).slice(),
    };
  } catch {
    if (!signal.aborted) sharedSeatStats.failures += 1;
    return null;
  } finally {
    cleanups.forEach((cleanup) => cleanup());
    workers.forEach((worker) => worker.terminate());
    sharedSeatStats.workers -= workers.length;
    sharedSeatStats.arenaBytes -= arenaBytes;
    release();
  }
}
