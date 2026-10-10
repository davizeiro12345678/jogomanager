/** Starts independent jobs without retaining an unbounded set of active buffers. */
export class BoundedWorkQueue {
  private active = 0;
  private epoch = 0;
  private readonly jobs = new Map<string, () => Promise<unknown>>();
  private readonly running = new Set<string>();

  constructor(private readonly concurrency: number) {
    if (!Number.isInteger(concurrency) || concurrency < 1)
      throw new RangeError("Concurrency must be a positive integer");
  }

  enqueue(key: string, job: () => Promise<unknown>): void {
    if (this.jobs.has(key) || this.running.has(key)) return;
    this.jobs.set(key, job);
    this.drain();
  }

  clear(): void {
    this.epoch += 1;
    this.active = 0;
    this.jobs.clear();
    this.running.clear();
  }

  get pending(): number {
    return this.jobs.size;
  }

  private drain(): void {
    while (this.active < this.concurrency && this.jobs.size) {
      const [key, job] = this.jobs.entries().next().value!;
      this.jobs.delete(key);
      this.running.add(key);
      this.active += 1;
      const epoch = this.epoch;
      Promise.resolve()
        .then(job)
        .catch(() => undefined)
        .finally(() => {
          if (epoch !== this.epoch) return;
          this.running.delete(key);
          this.active -= 1;
          this.drain();
        });
    }
  }
}
