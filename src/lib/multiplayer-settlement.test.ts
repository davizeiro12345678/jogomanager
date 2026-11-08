import { describe, expect, it } from "vitest";

import { createSettlementLeaseGuard } from "./multiplayer-settlement";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("settlement lease guard", () => {
  it("coalesces a controlled heartbeat and advances the fence only after CAS succeeds", async () => {
    const firstHeartbeat = deferred<string | null>();
    const expectedLeases: string[] = [];
    const guard = createSettlementLeaseGuard("lease-1", async (expectedLease) => {
      expectedLeases.push(expectedLease);
      return firstHeartbeat.promise;
    });

    const first = guard.refresh();
    const duplicate = guard.refresh();

    expect(expectedLeases).toEqual(["lease-1"]);
    expect(guard.currentLease()).toBe("lease-1");
    expect(guard.isLost()).toBe(false);

    firstHeartbeat.resolve("lease-2");

    expect(await first).toBe(true);
    expect(await duplicate).toBe(true);
    expect(guard.currentLease()).toBe("lease-2");
    expect(guard.isLost()).toBe(false);
  });
});
