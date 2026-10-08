/** One initialization per JavaScript realm; Workers own separate WASM memories. */
export const WASM_ABI_VERSION = 1;
export const WASM_CAPABILITY = {
  crowd: 1,
  perception: 2,
  turf: 4,
  persistentCrowd: 8,
  boundedCrowd: 16,
  reusableCrowdOutput: 32,
} as const;
export type GameWasmModule = typeof import("./pkg/crowd_visibility_wasm");
type AbiModule = {
  default(): Promise<unknown>;
  wasm_abi_version(): number;
  wasm_capabilities(): number;
};

export class WasmRuntime<M extends AbiModule> {
  private pending: Promise<M | null> | undefined;
  readonly stats = { loads: 0, failures: 0, timeouts: 0, abi: 0, capabilities: 0 };
  private readonly importer: () => Promise<M>;
  constructor(importer: () => Promise<M>) {
    this.importer = importer;
  }
  load(required: number, deadline = 5000): Promise<M | null> {
    this.pending ??= this.initialize();
    // A consumer's deadline never changes the backend of a match already
    // running. The underlying import can still serve another later consumer.
    return new Promise((resolve) => {
      let settled = false;
      const finish = (module: M | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(module && (this.stats.capabilities & required) === required ? module : null);
      };
      const timer = setTimeout(
        () => {
          this.stats.timeouts++;
          finish(null);
        },
        Math.max(1, Math.min(30000, Number.isFinite(deadline) ? deadline : 5000)),
      );
      void this.pending!.then(finish);
    });
  }
  private async initialize(): Promise<M | null> {
    this.stats.loads++;
    try {
      const module = await this.importer();
      await module.default();
      if (
        typeof module.wasm_abi_version !== "function" ||
        typeof module.wasm_capabilities !== "function"
      )
        throw new Error("Missing WASM ABI");
      const abi = module.wasm_abi_version(),
        capabilities = module.wasm_capabilities();
      if (
        abi !== WASM_ABI_VERSION ||
        !Number.isSafeInteger(capabilities) ||
        capabilities < 0 ||
        capabilities > 0x7fffffff
      )
        throw new Error("Unsupported WASM ABI");
      this.stats.abi = abi;
      this.stats.capabilities = capabilities;
      return module;
    } catch {
      this.stats.failures++;
      return null;
    }
  }
}

const runtime = new WasmRuntime<GameWasmModule>(() => import("./pkg/crowd_visibility_wasm"));
export const gameWasmStats = runtime.stats;
export const loadGameWasm = (required: number, deadline?: number) =>
  runtime.load(required, deadline);
