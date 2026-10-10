import { deviceGeometryPreparationWorkers } from "./presentation-worker-budget";

type Release = () => void;
type Job = { count: number; grant: (release: Release) => void };

/** Geometry workers across all mounted scenes share this capacity. */
export class PresentationLanePool {
  private used = 0;
  private readonly waiting: Job[] = [];
  constructor(private readonly capacity: number) {}

  acquire(count: number, signal: AbortSignal, timeoutMs = 3_000): Promise<Release | null> {
    if (signal.aborted || count < 1 || count > this.capacity) return Promise.resolve(null);
    return new Promise((resolve) => {
      const remove = () => {
        const index = this.waiting.indexOf(job);
        if (index >= 0) this.waiting.splice(index, 1);
        clearTimeout(timer);
        signal.removeEventListener("abort", remove);
        resolve(null);
        this.drain();
      };
      const job: Job = {
        count,
        grant: (release) => {
          clearTimeout(timer);
          signal.removeEventListener("abort", remove);
          resolve(release);
        },
      };
      const timer = setTimeout(remove, timeoutMs);
      signal.addEventListener("abort", remove, { once: true });
      this.waiting.push(job);
      this.drain();
    });
  }

  private drain(): void {
    while (this.waiting.length && this.used + this.waiting[0]!.count <= this.capacity) {
      const job = this.waiting.shift()!;
      this.used += job.count;
      let released = false;
      job.grant(() => {
        if (released) return;
        released = true;
        this.used -= job.count;
        this.drain();
      });
    }
  }
}
let pool: PresentationLanePool | null = null;
export function acquirePresentationLanes(
  count: number,
  signal: AbortSignal,
): Promise<Release | null> {
  return (pool ??= new PresentationLanePool(deviceGeometryPreparationWorkers())).acquire(
    count,
    signal,
  );
}
