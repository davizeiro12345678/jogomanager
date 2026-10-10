import { expect, it, vi } from "vitest";
import { SequentialWorkerQueue } from "./sequential-worker-queue";
it("bounds a stalled backlog and executes dependent weeks in FIFO order", async () => {
  let release!: () => void;
  const stalled = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queue = new SequentialWorkerQueue(2),
    seen: number[] = [],
    report = vi.fn();
  expect(
    queue.enqueue(async () => {
      await stalled;
      seen.push(1);
    }, report),
  ).toBe(true);
  expect(
    queue.enqueue(async () => {
      expect(seen).toEqual([1]);
      seen.push(2);
    }, report),
  ).toBe(true);
  expect(
    queue.enqueue(async () => {
      seen.push(3);
    }, report),
  ).toBe(false);
  expect(queue.pending).toBe(2);
  release();
  for (let i = 0; i < 15; i++) await Promise.resolve();
  expect(seen).toEqual([1, 2]);
  expect(queue.pending).toBe(0);
  expect(queue.stats.rejected).toBe(1);
  expect(report).not.toHaveBeenCalled();
});
it("releases failed slots even if error reporting itself throws", async () => {
  const queue = new SequentialWorkerQueue(1);
  queue.enqueue(
    async () => {
      throw new Error("failed");
    },
    () => {
      throw new Error("offline reporter");
    },
  );
  for (let i = 0; i < 10; i++) await Promise.resolve();
  const task = vi.fn(async () => undefined);
  expect(queue.enqueue(task, () => undefined)).toBe(true);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(task).toHaveBeenCalledTimes(1);
  expect(queue.pending).toBe(0);
});
