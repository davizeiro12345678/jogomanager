import { describe, expect, it, vi } from "vitest";

import {
  canMutateCareer,
  captureCareerMutationEpoch,
  createCareerMutationGate,
  createCareerIdentityTracker,
  deriveCareerHydrationStatus,
  publishCareerAfterPersistence,
  type CareerHydrationStatus,
} from "./useCareer";

const data = (
  career: object | null,
  sync: "local" | "syncing" | "synced" | "pending" | "offline" = "local",
) => ({ career, sync });

describe("useCareer hydration contract", () => {
  it("keeps identity and save hydration in loading until the first read completes", () => {
    expect(
      deriveCareerHydrationStatus({
        userId: undefined,
        isPending: false,
        hasError: false,
        data: data({ id: "existing" }),
      }),
    ).toBe("loading");
    expect(
      deriveCareerHydrationStatus({
        userId: "user-1",
        isPending: true,
        hasError: false,
        data: undefined,
      }),
    ).toBe("loading");
  });

  it.each([
    ["empty", null, "local"],
    ["ready", { id: "existing" }, "local"],
    ["offline", null, "offline"],
    ["offline", { id: "local-save" }, "offline"],
  ] as const)("distinguishes %s after a completed read", (expected, career, sync) => {
    expect(
      deriveCareerHydrationStatus({
        userId: "user-1",
        isPending: false,
        hasError: false,
        data: data(career, sync),
      }),
    ).toBe(expected);
  });

  it("keeps a read error distinct from an offline result", () => {
    expect(
      deriveCareerHydrationStatus({
        userId: "user-1",
        isPending: false,
        hasError: true,
        data: data({ id: "cached" }, "offline"),
      }),
    ).toBe("error");
    expect(
      deriveCareerHydrationStatus({
        userId: "user-1",
        isPending: false,
        hasError: false,
        data: { ...data({ id: "local" }), hydration: "error" },
      }),
    ).toBe("error");
  });

  it.each<[CareerHydrationStatus, boolean]>([
    ["loading", false],
    ["error", false],
    ["empty", true],
    ["ready", true],
    ["offline", true],
  ])("%s is %s for explicit career writes", (status, allowed) => {
    expect(canMutateCareer(status)).toBe(allowed);
  });
});

describe("career identity session barrier", () => {
  it("invalidates an old save callback after A-B-A instead of contaminating hydration", () => {
    const identity = createCareerIdentityTracker("account-a");
    const oldSave = identity.capture();
    let hydratedCareer = "account-a-new-session";

    identity.switchTo("account-b");
    identity.switchTo("account-a");
    if (identity.isCurrent(oldSave)) hydratedCareer = "stale-account-a-save";

    expect(identity.isCurrent(oldSave)).toBe(false);
    expect(hydratedCareer).toBe("account-a-new-session");
  });
});

describe("career mutation epoch", () => {
  it("uses the query epoch when a prior career snapshot exists", () => {
    expect(captureCareerMutationEpoch({ epoch: 4 }, 9)).toBe(4);
  });

  it("preserves an unknown prior epoch instead of replacing it with the current value", () => {
    expect(captureCareerMutationEpoch({ epoch: null }, 9)).toBeNull();
  });

  it("uses the current epoch only when no prior query snapshot exists", () => {
    expect(captureCareerMutationEpoch(undefined, 9)).toBe(9);
    expect(captureCareerMutationEpoch(undefined, null)).toBeNull();
  });
});

describe("authenticated career mutation barrier", () => {
  it("rejects a concurrent update and does not publish ready when persistence is rejected", async () => {
    const gate = createCareerMutationGate();
    let rejectPersistence!: (confirmed: boolean) => void;
    const persist = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          rejectPersistence = resolve;
        }),
    );
    const readyStates: string[] = [];
    const attempt = (state: string) => {
      if (!gate.tryAcquire()) return Promise.resolve(false);
      return publishCareerAfterPersistence(persist, () => readyStates.push(state)).finally(() => {
        gate.release();
      });
    };

    const first = attempt("first");
    expect(persist).toHaveBeenCalledTimes(1);
    expect(readyStates).toEqual([]);
    await expect(attempt("second")).resolves.toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(readyStates).toEqual([]);

    rejectPersistence(false);
    await expect(first).resolves.toBe(false);
    expect(readyStates).toEqual([]);
  });

  it("publishes ready only after the local barrier confirms", async () => {
    const gate = createCareerMutationGate();
    let confirmPersistence!: (confirmed: boolean) => void;
    const persist = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          confirmPersistence = resolve;
        }),
    );
    const readyStates: string[] = [];
    const first = (async () => {
      expect(gate.tryAcquire()).toBe(true);
      try {
        return await publishCareerAfterPersistence(persist, () => readyStates.push("first"));
      } finally {
        gate.release();
      }
    })();

    expect(readyStates).toEqual([]);
    confirmPersistence(true);
    await expect(first).resolves.toBe(true);
    expect(readyStates).toEqual(["first"]);
  });
});
