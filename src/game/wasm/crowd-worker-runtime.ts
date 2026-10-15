import {
  CAMERA_VALUES,
  MAILBOX_CAPACITY,
  normalizeCrowdBudget,
  publishCrowdResult,
  validCrowdMailbox,
  type CrowdMailbox,
} from "./crowd-mailbox";
import {
  CrowdFallbackBuffers,
  selectCrowdFallback,
  type CrowdVisibilityLayout,
} from "./crowd-visibility";
import { validCrowdLayout } from "./crowd-layout-validation";

export type PersistentCrowdSelector = {
  select(
    planes: Float64Array,
    camera: Float64Array,
    scale: number,
    perspective: boolean,
    tiles: number,
    instances: number,
    detailed: number,
    mesh: number,
  ): Uint32Array;
  select_into?(
    planes: Float64Array,
    camera: Float64Array,
    scale: number,
    perspective: boolean,
    tiles: number,
    instances: number,
    detailed: number,
    mesh: number,
    output: Uint32Array,
  ): number;
  free(): void;
};
export type CrowdWorkerRequest =
  | { type: "init"; layout: CrowdVisibilityLayout; mailbox?: CrowdMailbox }
  | { type: "select"; camera?: Float64Array; recycled?: ArrayBuffer; requestId?: number };

/** Owns one immutable layout. Optional compilation never blocks the TS lane. */
export class CrowdWorkerRuntime {
  private generation = 0;
  private layout: CrowdVisibilityLayout | undefined;
  private buffers: CrowdFallbackBuffers | undefined;
  private mailbox: CrowdMailbox | undefined;
  private selector: PersistentCrowdSelector | null = null;
  private readonly camera = new Float64Array(CAMERA_VALUES);
  private readonly planes = this.camera.subarray(0, 24);
  private readonly eye = this.camera.subarray(24, 27);
  private packedScratch = new Uint32Array();
  constructor(
    private readonly load: (
      layout: CrowdVisibilityLayout,
    ) => Promise<PersistentCrowdSelector | null>,
    private readonly post: (message: unknown, transfer?: Transferable[]) => void,
  ) {}
  handle(data: CrowdWorkerRequest): void {
    try {
      if (!data || typeof data !== "object") throw new Error("Invalid crowd request");
      if (data.type === "init") {
        if (!validCrowdLayout(data.layout)) throw new Error("Invalid crowd layout");
        if (data.mailbox !== undefined && !validCrowdMailbox(data.mailbox))
          throw new Error("Invalid crowd mailbox");
        this.dispose();
        const generation = this.generation;
        this.layout = data.layout;
        this.buffers = new CrowdFallbackBuffers(data.layout);
        this.mailbox = data.mailbox;
        this.post({ type: "ready", wasm: false });
        void this.load(data.layout)
          .then((selector) => {
            if (generation !== this.generation) {
              selector?.free();
              return;
            }
            this.selector = selector;
            this.post({ type: "ready", wasm: Boolean(selector) });
          })
          .catch(() => {
            /* Optional WASM: the TS lane stays usable. */
          });
        return;
      }
      if (!this.layout || !this.buffers) throw new Error("Crowd worker is not initialized");
      if (data.type !== "select") throw new Error("Unknown crowd request");
      if (
        data.requestId !== undefined &&
        (!Number.isSafeInteger(data.requestId) || data.requestId <= 0)
      )
        throw new Error("Invalid crowd request id");
      if (this.mailbox && Atomics.load(this.mailbox.state, 0) !== 1)
        throw new Error("Crowd mailbox has no pending camera");
      const source = this.mailbox?.camera ?? data.camera;
      if (!(source instanceof Float64Array) || source.length !== CAMERA_VALUES)
        throw new Error("Invalid crowd camera buffer");
      this.camera.set(source);
      const values = this.camera;
      const planes = this.planes,
        camera = this.eye;
      const tiles = normalizeCrowdBudget(values[29]!, this.layout.tileCount);
      const instances = normalizeCrowdBudget(values[30]!, MAILBOX_CAPACITY);
      if (
        !this.mailbox &&
        data.recycled instanceof ArrayBuffer &&
        data.recycled.byteLength >= instances * 4 &&
        data.recycled.byteLength <= MAILBOX_CAPACITY * 4 &&
        data.recycled.byteLength % 4 === 0
      )
        this.packedScratch = new Uint32Array(data.recycled);
      let packed: Uint32Array | undefined;
      if (this.selector) {
        try {
          if (this.selector.select_into) {
            if (this.packedScratch.length < instances)
              this.packedScratch = new Uint32Array(instances);
            const length = this.selector.select_into(
              planes,
              camera,
              values[27]!,
              Boolean(values[28]),
              tiles,
              instances,
              values[31]!,
              values[32]!,
              this.packedScratch,
            );
            if (!Number.isInteger(length) || length < 0 || length > instances)
              throw new Error("Invalid reusable WASM output length");
            packed = this.packedScratch.subarray(0, length);
          } else {
            packed = this.selector.select(
              planes,
              camera,
              values[27]!,
              Boolean(values[28]),
              tiles,
              instances,
              values[31]!,
              values[32]!,
            );
          }
          if (!(packed instanceof Uint32Array) || packed.length > instances)
            throw new Error("Invalid WASM crowd output");
          for (const value of packed)
            if ((value & 3) > 2 || value >>> 2 >= this.layout.positionCount)
              throw new Error("Invalid WASM crowd seat");
        } catch {
          packed = undefined;
          this.freeSelector();
          this.post({ type: "ready", wasm: false });
        }
      }
      if (!packed) {
        const selected = selectCrowdFallback(
          {
            layout: this.layout,
            frustumPlanes: planes,
            camera: { x: camera[0]!, y: camera[1]!, z: camera[2]! },
            projectedScale: values[27]!,
            perspective: Boolean(values[28]),
            maxTiles: tiles,
            maxInstances: instances,
            detailedPixels: values[31]!,
            meshPixels: values[32]!,
          },
          this.buffers,
        );
        const length = selected.indices.length;
        if (this.packedScratch.length < length) this.packedScratch = new Uint32Array(length);
        packed = this.packedScratch.subarray(0, length);
        for (let index = 0; index < packed.length; index++)
          packed[index] = (selected.indices[index]! << 2) | selected.tiers[index]!;
      }
      if (this.mailbox) publishCrowdResult(this.mailbox, packed);
      else
        this.post(
          {
            type: "result",
            packed,
            ...(data.requestId === undefined ? {} : { requestId: data.requestId }),
          },
          [packed.buffer as ArrayBuffer],
        );
    } catch {
      this.post({ type: "failed" });
    }
  }
  dispose(): void {
    this.generation++;
    this.freeSelector();
    this.layout = undefined;
    this.buffers = undefined;
    this.mailbox = undefined;
    this.packedScratch = new Uint32Array();
  }

  private freeSelector(): void {
    const selector = this.selector;
    this.selector = null;
    try {
      selector?.free();
    } catch {
      // A trapped/corrupted WASM owner may also trap while freeing. Its
      // teardown must not disable the independent TypeScript fallback.
    }
  }
}
