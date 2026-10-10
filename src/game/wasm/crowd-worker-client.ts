import {
  CAMERA_VALUES,
  MAILBOX_CAPACITY,
  createCrowdMailbox,
  writeCrowdCamera,
  type CrowdMailbox,
} from "./crowd-mailbox";
import {
  decodeCrowdSelection,
  type CrowdSelection,
  type CrowdVisibilityInput,
  type CrowdVisibilityLayout,
} from "./crowd-visibility";
import { validCrowdLayout } from "./crowd-layout-validation";

export const crowdWorkerStats = {
  active: 0,
  wasm: false,
  shared: false,
  submitted: 0,
  completed: 0,
  skipped: 0,
  failures: 0,
};

const CROWD_FRUSTUM_VALUES = 24;
const finiteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Keep malformed presentation values out of the Worker/WASM boundary. A short
 * frustum remains valid: the canonical TypeScript path intentionally treats it
 * as no frustum culling while the camera is being rebuilt.
 */
function validCrowdInput(
  input: unknown,
  layout: CrowdVisibilityLayout,
): input is CrowdVisibilityInput {
  try {
    if (!input || typeof input !== "object") return false;
    const candidate = input as CrowdVisibilityInput;
    if (candidate.layout !== layout || !(candidate.frustumPlanes instanceof Float64Array))
      return false;
    if (!candidate.camera || typeof candidate.camera !== "object") return false;
    if (
      !finiteNumber(candidate.camera.x) ||
      !finiteNumber(candidate.camera.y) ||
      !finiteNumber(candidate.camera.z) ||
      !finiteNumber(candidate.projectedScale) ||
      !finiteNumber(candidate.maxTiles) ||
      !finiteNumber(candidate.maxInstances) ||
      !finiteNumber(candidate.detailedPixels) ||
      !finiteNumber(candidate.meshPixels) ||
      typeof candidate.perspective !== "boolean"
    )
      return false;
    // Only the first six planes cross the boundary. Short frames are zeroed by
    // writeCrowdCamera and preserve the established all-visible fallback.
    if (candidate.frustumPlanes.length >= CROWD_FRUSTUM_VALUES) {
      for (let index = 0; index < CROWD_FRUSTUM_VALUES; index += 1)
        if (!finiteNumber(candidate.frustumPlanes[index])) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Bounded async WASM lane: no main-thread wait, no backlog of camera snapshots. */
export class CrowdWorkerClient {
  readonly shared: boolean;
  wasm = false;
  failed = false;
  private ready = false;
  private busy = false;
  private startedAt = 0;
  private selectionTimeout: ReturnType<typeof setTimeout> | undefined;
  private selected: CrowdSelection | null = null;
  private recycled: ArrayBuffer | undefined;
  private requestId = 0;
  private requestCapacity = 0;
  private readonly camera = new Float64Array(CAMERA_VALUES);
  private readonly previous = new Float64Array(CAMERA_VALUES).fill(Number.NaN);
  private readonly mailbox: CrowdMailbox | undefined;
  private readonly worker: Worker;
  private readonly initTimeout: ReturnType<typeof setTimeout>;

  constructor(
    private readonly layout: CrowdVisibilityLayout,
    private readonly releaseLane: () => void = () => undefined,
  ) {
    if (!validCrowdLayout(layout)) throw new RangeError("Invalid crowd worker layout");
    this.shared =
      globalThis.crossOriginIsolated === true && typeof SharedArrayBuffer !== "undefined";
    this.mailbox = this.shared ? createCrowdMailbox() : undefined;
    this.worker = new Worker(new URL("./crowd-visibility.worker.ts", import.meta.url), {
      type: "module",
    });
    crowdWorkerStats.active += 1;
    crowdWorkerStats.shared = this.shared;
    this.initTimeout = setTimeout(() => this.fail(), 10_000);
    this.worker.onerror = () => this.fail();
    this.worker.onmessageerror = () => this.fail();
    this.worker.onmessage = ({
      data,
    }: MessageEvent<{
      type: string;
      wasm?: boolean;
      packed?: Uint32Array;
      requestId?: number;
    }>) => {
      if (!data || typeof data !== "object") {
        this.fail();
        return;
      }
      if (data.type === "ready") {
        if (typeof data.wasm !== "boolean") {
          this.fail();
          return;
        }
        clearTimeout(this.initTimeout);
        this.ready = true;
        this.wasm = Boolean(data.wasm);
        crowdWorkerStats.wasm = this.wasm;
      } else if (data.type === "result") {
        // Every ordinary reply belongs to the one in-flight request. A late
        // or unsolicited result must never replace the current scene's seats.
        if (!this.busy || data.requestId !== this.requestId) return;
        if (!data.packed) {
          this.fail();
          return;
        }
        if (!this.acceptResult(data.packed)) return;
        this.recycled = data.packed.buffer instanceof ArrayBuffer ? data.packed.buffer : undefined;
        this.busy = false;
        clearTimeout(this.selectionTimeout);
        crowdWorkerStats.completed += 1;
      } else this.fail();
    };
    // Static layout crosses the boundary once. WASM retains it until disposal.
    try {
      this.worker.postMessage({ type: "init", layout, mailbox: this.mailbox });
    } catch {
      this.fail();
    }
  }

  select(input: CrowdVisibilityInput): CrowdSelection | null {
    if (this.failed) return null;
    if (!validCrowdInput(input, this.layout)) {
      this.fail();
      return null;
    }
    if (!this.ready) return this.selected;
    if (this.mailbox && Atomics.load(this.mailbox.state, 0) === 2) {
      const length = Atomics.load(this.mailbox.state, 1);
      if (!this.busy || length < 0 || length > this.requestCapacity) {
        this.fail();
        return null;
      }
      if (!this.acceptResult(this.mailbox.packed.subarray(0, length))) return null;
      Atomics.store(this.mailbox.state, 0, 0);
      this.busy = false;
      clearTimeout(this.selectionTimeout);
      crowdWorkerStats.completed += 1;
    }
    if (this.busy) {
      if (performance.now() - this.startedAt > 3_000) this.fail();
      return this.selected;
    }
    writeCrowdCamera(this.camera, input);
    if (this.camera.every((value, index) => value === this.previous[index])) {
      crowdWorkerStats.skipped += 1;
      return this.selected;
    }
    this.previous.set(this.camera);
    this.requestCapacity = this.camera[30]!;
    this.busy = true;
    this.startedAt = performance.now();
    this.selectionTimeout = setTimeout(() => {
      // A shared result may already be published while the scene is hidden.
      if (
        !this.mailbox ||
        Atomics.load(this.mailbox.state, 0) !== 2 ||
        Atomics.load(this.mailbox.state, 1) < 0 ||
        Atomics.load(this.mailbox.state, 1) > this.requestCapacity
      )
        this.fail();
    }, 3_000);
    crowdWorkerStats.submitted += 1;
    this.requestId++;
    try {
      if (this.mailbox) {
        this.mailbox.camera.set(this.camera);
        Atomics.store(this.mailbox.state, 0, 1);
        this.worker.postMessage({ type: "select", requestId: this.requestId });
      } else {
        const recycled = this.recycled;
        this.recycled = undefined;
        this.worker.postMessage(
          {
            type: "select",
            camera: this.camera,
            requestId: this.requestId,
            ...(recycled ? { recycled } : {}),
          },
          recycled ? [recycled] : [],
        );
      }
    } catch {
      this.fail();
    }
    return this.selected;
  }

  private acceptResult(packed: Uint32Array): boolean {
    try {
      if (
        !(packed instanceof Uint32Array) ||
        packed.length > MAILBOX_CAPACITY ||
        packed.length > this.requestCapacity
      )
        throw new RangeError("Invalid crowd worker result");
      for (const value of packed)
        if (value >>> 2 >= this.layout.positionCount) throw new RangeError("Unknown crowd seat");
      this.selected = decodeCrowdSelection(packed, this.selected);
      return true;
    } catch {
      this.fail();
      return false;
    }
  }

  private fail(): void {
    if (this.failed) return;
    clearTimeout(this.initTimeout);
    clearTimeout(this.selectionTimeout);
    crowdWorkerStats.active -= 1;
    crowdWorkerStats.failures += 1;
    this.failed = true;
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.onmessageerror = null;
    this.worker.terminate();
    this.selected = null;
    this.recycled = undefined;
    this.releaseLane();
  }

  dispose(): void {
    if (!this.failed) {
      this.failed = true;
      clearTimeout(this.initTimeout);
      clearTimeout(this.selectionTimeout);
      crowdWorkerStats.active -= 1;
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.onmessageerror = null;
      this.worker.terminate();
      this.releaseLane();
    }
    this.selected = null;
    this.recycled = undefined;
  }
}
