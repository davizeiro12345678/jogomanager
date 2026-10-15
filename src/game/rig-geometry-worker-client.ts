import { acquirePresentationLanes } from "./presentation-lanes";
import { RUST_GEOMETRY_RELEASE } from "./rig-geometry-gate";
import {
  generateRigSectionFallback,
  rigSectionVertexCount,
  type RigSectionInput,
} from "./rig-section-kernel";
import type { GeometryBatch, SectionJob } from "./rig-geometry.worker";

export interface GeometryBatchResult {
  sections: { part: string; packed: ArrayBuffer; backend: string }[];
  retainedBytes: number;
  degraded: boolean;
}
type Pending = { request: GeometryBatch; resolve: (result: GeometryBatchResult | null) => void };
/** One active batch plus a replaceable pending batch. All settlements are bounded. */
export class RigGeometryWorkerClient {
  private worker: Worker | null = null;
  private active: Pending | null = null;
  private pending: Pending | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private release: (() => void) | null = null;
  private abort = new AbortController();
  private disposed = false;
  private sequence = 0;
  private starting = false;
  readonly stats = { requests: 0, completed: 0, dropped: 0, timeouts: 0, retainedBytes: 0 };
  constructor(
    private readonly create = () =>
      new Worker(new URL("./rig-geometry.worker.ts", import.meta.url), { type: "module" }),
    private readonly reserve = (signal: AbortSignal) => acquirePresentationLanes(1, signal),
    private readonly deadlineMs = 3000,
  ) {}
  request(batch: Omit<GeometryBatch, "id">): Promise<GeometryBatchResult | null> {
    if (this.disposed) return Promise.resolve(null);
    return new Promise((resolve) => {
      const job = { request: { ...batch, id: ++this.sequence }, resolve };
      this.stats.requests++;
      if (this.pending) {
        this.pending.resolve(null);
        this.stats.dropped++;
      }
      this.pending = job;
      void this.drain();
    });
  }
  private async drain() {
    if (this.disposed || this.active || this.starting || !this.pending) return;
    if (!this.worker) {
      this.starting = true;
      try {
        this.release = await this.reserve(this.abort.signal);
        if (!this.release || this.disposed) {
          this.release?.();
          this.release = null;
          this.dispose();
          return;
        }
        this.worker = this.create();
        this.worker.onerror = () => this.dispose();
        this.worker.onmessageerror = () => this.dispose();
        this.worker.onmessage = ({ data }) => {
          const job = this.active;
          if (!job || data?.id !== job.request.id) return;
          clearTimeout(this.timer);
          this.timer = undefined;
          this.active = null;
          const valid =
            Array.isArray(data.sections) &&
            data.sections.length === job.request.sections.length &&
            data.sections.every(
              (s: GeometryBatchResult["sections"][number], i: number) =>
                s.part === job.request.sections[i]!.part &&
                s.packed instanceof ArrayBuffer &&
                s.packed.byteLength ===
                  rigSectionVertexCount(job.request.sections[i]!.input) * 20 &&
                new Float32Array(s.packed).every(Number.isFinite),
            );
          if (valid) {
            this.stats.completed++;
            this.stats.retainedBytes = Math.min(
              8 * 1024 * 1024,
              Math.max(0, Number(data.retainedBytes) || 0),
            );
          }
          job.resolve(valid ? data : null);
          void this.drain();
        };
      } catch {
        this.dispose();
        return;
      } finally {
        this.starting = false;
      }
    }
    if (!this.pending || this.disposed) return;
    this.active = this.pending;
    this.pending = null;
    this.timer = setTimeout(() => {
      this.stats.timeouts++;
      this.dispose();
    }, this.deadlineMs);
    try {
      this.worker!.postMessage(this.active.request);
    } catch {
      this.dispose();
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    clearTimeout(this.timer);
    this.worker?.terminate();
    this.worker = null;
    this.release?.();
    this.release = null;
    this.active?.resolve(null);
    this.pending?.resolve(null);
    this.active = this.pending = null;
    this.stats.retainedBytes = 0;
  }
}

interface Context {
  identity: string;
  style: string;
  lod: number;
  sections: SectionJob[];
}
let context: Context | null = null;
let owners = 0;
let client: RigGeometryWorkerClient | null = null;
const cached = new Map<string, Float32Array>();
let cachedBytes = 0;
function key(input: RigSectionInput) {
  return JSON.stringify([input.radial, input.roundness, input.caps, Array.from(input.rings)]);
}
export function retainRigGeometryPreparation() {
  if (!RUST_GEOMETRY_RELEASE.enabled) return () => undefined;
  owners++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--owners === 0) {
      client?.dispose();
      client = null;
      cached.clear();
      cachedBytes = 0;
    }
  };
}
export function withRigGeometryContext<T>(
  identity: string,
  style: string,
  lod: number,
  build: () => T,
): T {
  if (!RUST_GEOMETRY_RELEASE.enabled || owners === 0) return build();
  const previous = context;
  const current: Context = { identity, style, lod, sections: [] };
  context = current;
  try {
    return build();
  } finally {
    context = previous;
    if (current.sections.length) {
      client ??= new RigGeometryWorkerClient();
      const selected = current.sections.slice(0, 64);
      void client.request({ ...current, sections: selected }).then((result) => {
        if (!result || !owners) return;
        result.sections.forEach((section, i) => {
          const input = selected[i]!.input;
          const cacheKey = key(input);
          const packed = new Float32Array(section.packed);
          if (cached.has(cacheKey)) return;
          while (
            cached.size &&
            (cachedBytes + packed.byteLength > 8 * 1024 * 1024 || cached.size >= 64)
          ) {
            const oldest = cached.keys().next().value!;
            cachedBytes -= cached.get(oldest)!.byteLength;
            cached.delete(oldest);
          }
          cached.set(cacheKey, packed);
          cachedBytes += packed.byteLength;
        });
      });
    }
  }
}
export function rigSectionData(input: RigSectionInput): Float32Array {
  if (context && context.sections.length < 64) {
    const cacheKey = key(input);
    const ready = cached.get(cacheKey);
    if (ready) return ready;
    context.sections.push({ part: String(context.sections.length), input });
  }
  return generateRigSectionFallback(input);
}
