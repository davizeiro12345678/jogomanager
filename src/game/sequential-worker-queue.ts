/** Bounded command backlog; career weeks never run concurrently. */
export const MAX_PENDING_SIMULATION_COMMANDS = 64;
export class SequentialWorkerQueue {
  private tail = Promise.resolve();
  private count = 0;
  readonly stats = { accepted: 0, rejected: 0, peak: 0 };
  constructor(private readonly capacity = MAX_PENDING_SIMULATION_COMMANDS) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 1024)
      throw new RangeError("Invalid worker queue capacity");
  }
  get pending() {
    return this.count;
  }
  enqueue(task: () => Promise<void>, onError: (error: unknown) => void): boolean {
    if (this.count >= this.capacity) {
      this.stats.rejected++;
      return false;
    }
    this.count++;
    this.stats.accepted++;
    this.stats.peak = Math.max(this.stats.peak, this.count);
    this.tail = this.tail
      .then(task)
      .catch((error) => {
        try {
          onError(error);
        } catch {
          /* Reporting must not poison the next command. */
        }
      })
      .finally(() => {
        this.count--;
      });
    return true;
  }
}
