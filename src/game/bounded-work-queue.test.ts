import { describe, expect, it } from "vitest";
import { BoundedWorkQueue } from "./bounded-work-queue";

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe("bounded background work", () => {
  it("does not enqueue a duplicate of an active buffer preparation", async () => {
    const queue = new BoundedWorkQueue(1);
    let finish!: () => void;
    let duplicateRuns = 0;
    queue.enqueue(
      "texture",
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await flush();
    queue.enqueue("texture", async () => {
      duplicateRuns += 1;
    });
    finish();
    await flush();
    expect(duplicateRuns).toBe(0);
    queue.enqueue("texture", async () => {
      duplicateRuns += 1;
    });
    await flush();
    expect(duplicateRuns).toBe(1);
  });
  it("starts only the permitted jobs and resumes after failure", async () => {
    const queue = new BoundedWorkQueue(2);
    const started: number[] = [];
    const finish: (() => void)[] = [];
    for (let i = 0; i < 5; i++)
      queue.enqueue(String(i), () => {
        started.push(i);
        return new Promise<void>((resolve, reject) =>
          finish.push(i === 0 ? () => reject(new Error("failed")) : resolve),
        );
      });
    await flush();
    expect(started).toEqual([0, 1]);
    finish[0]!();
    await flush();
    expect(started).toEqual([0, 1, 2]);
    expect(queue.pending).toBe(2);
    finish[1]!();
    finish[2]!();
    await flush();
    expect(started).toEqual([0, 1, 2, 3, 4]);
    finish[3]!();
    finish[4]!();
    await flush();
  });

  it("discards queued jobs and ignores completion from a previous generation", async () => {
    const queue = new BoundedWorkQueue(1);
    let finishOld!: () => void;
    let finishNew!: () => void;
    const started: string[] = [];
    queue.enqueue(
      "old",
      () =>
        new Promise<void>((resolve) => {
          finishOld = resolve;
        }),
    );
    queue.enqueue("discarded", async () => {
      started.push("discarded");
    });
    await flush();
    queue.clear();
    queue.enqueue(
      "new",
      () =>
        new Promise<void>((resolve) => {
          finishNew = resolve;
        }),
    );
    queue.enqueue("next", async () => {
      started.push("next");
    });
    await flush();
    finishOld();
    await flush();
    expect(started).toEqual([]);
    finishNew();
    await flush();
    expect(started).toEqual(["next"]);
  });
});
