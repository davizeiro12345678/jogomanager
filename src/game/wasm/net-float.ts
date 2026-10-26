import { loadGameWasm, gameWasmMemory, WASM_CAPABILITY, type GameWasmModule } from "./runtime";
import type { NetDynamics } from "../net-dynamics";

export interface NetMotion {
  readonly displacement: Float32Array;
  impact(u: number, v: number, speed: number): void;
  step(dt: number, time: number, wind: number, wet?: number): void;
}

/** Persistent Rust buffers, zero-copy reads and explicit disposal. If another
 * WASM consumer grows memory, refresh the detached view before reading it. */
export class FloatNetMotion implements NetMotion {
  private view: Float32Array;
  private buffer: ArrayBufferLike;
  private disposed = false;
  constructor(
    private readonly net: InstanceType<GameWasmModule["FloatNet"]>,
    private readonly memory: WebAssembly.Memory,
  ) {
    this.buffer = memory.buffer;
    this.view = new Float32Array(this.buffer, net.data_ptr(), net.data_len());
  }
  get displacement() {
    if (this.disposed) return this.view;
    if (this.buffer !== this.memory.buffer) {
      this.buffer = this.memory.buffer;
      this.view = new Float32Array(this.buffer, this.net.data_ptr(), this.net.data_len());
    }
    return this.view;
  }
  impact(u: number, v: number, speed: number) {
    if (!this.disposed) this.net.impact(u, v, speed);
  }
  step(dt: number, time: number, wind: number, wet = 0) {
    if (!this.disposed) this.net.step(dt, time, wind, wet);
  }
  dispose() {
    if (this.disposed) return;
    this.view = this.displacement.slice();
    this.disposed = true;
    this.net.free();
  }
}

export async function promoteNetFloat(fallback: NetDynamics): Promise<FloatNetMotion | null> {
  const module = await loadGameWasm(WASM_CAPABILITY.netFloat32);
  const memory = gameWasmMemory();
  if (!module || !memory) return null;
  let net: InstanceType<GameWasmModule["FloatNet"]> | undefined;
  try {
    net = new module.FloatNet(fallback.cols, fallback.rows, fallback.width, fallback.height);
    const state = fallback.snapshot();
    if (!net.restore(state.displacement, state.velocity, state.accumulator)) {
      net.free();
      return null;
    }
    return new FloatNetMotion(net, memory);
  } catch {
    net?.free();
    return null;
  }
}
