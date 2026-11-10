import { describe, expect, it } from "vitest";

import {
  canCreateCareer,
  canMutateCareer,
  canResetCareer,
  resolveCareerHydrationBarrier,
  resolveCareerHydrationStatus,
} from "./career-hydration";

describe("career hydration state", () => {
  it.each([
    "pending_save",
    "conflict",
    "legacy_outbox",
    "unknown_generation",
    "same_score_divergence",
    "future_reason",
  ])(
    "preserves local progress and blocks mutation for unresolved %s barriers even when cloud is older",
    (reason) => {
      const local = { score: 99 };
      const olderCloud = { score: 12 };
      const decision = resolveCareerHydrationBarrier({
        localBlock: { reason },
        localCareer: local,
        cloudCareer: olderCloud,
      });

      expect(decision).toEqual({ blocked: true, career: local, sync: "pending", mutable: false });
    },
  );

  it.each(["empty", "pending", "unreadable"] as const)(
    "blocks pending saves when the outbox is %s",
    (outboxState) => {
      const local = { score: 7 };
      const olderCloud = { score: 2 };
      expect(
        resolveCareerHydrationBarrier({
          localBlock: { reason: "pending_save" },
          localCareer: local,
          cloudCareer: olderCloud,
          outboxState,
        }),
      ).toMatchObject({ blocked: true, career: local, sync: "pending", mutable: false });
    },
  );

  it("keeps the form locked while auth or a retry is still loading", () => {
    expect(
      resolveCareerHydrationStatus({
        phase: "loading",
        hasCareer: true,
        signedIn: true,
        online: true,
      }),
    ).toBe("loading");
    expect(canCreateCareer({ status: "loading", hasCareer: false, replace: false })).toBe(false);
    expect(canResetCareer("loading")).toBe(false);
  });

  it("distinguishes an empty guest/account from an offline account", () => {
    expect(
      resolveCareerHydrationStatus({
        phase: "loaded",
        hasCareer: false,
        signedIn: false,
        online: false,
      }),
    ).toBe("empty");
    expect(
      resolveCareerHydrationStatus({
        phase: "loaded",
        hasCareer: false,
        signedIn: true,
        online: false,
      }),
    ).toBe("offline");
    expect(canCreateCareer({ status: "empty", hasCareer: false, replace: false })).toBe(true);
    expect(canCreateCareer({ status: "offline", hasCareer: false, replace: false })).toBe(false);
  });

  it("does not authorize replacement of a signed-in account's local save while offline", () => {
    const status = resolveCareerHydrationStatus({
      phase: "loaded",
      hasCareer: true,
      signedIn: true,
      online: false,
    });

    expect(status).toBe("offline");
    expect(canCreateCareer({ status, hasCareer: true, replace: true })).toBe(false);
    expect(canResetCareer(status)).toBe(false);
    expect(canMutateCareer(status)).toBe(true);
  });

  it("allows only explicit online recreation from a confirmed tombstone", () => {
    const status = resolveCareerHydrationStatus({
      phase: "loaded",
      hasCareer: false,
      signedIn: true,
      online: true,
      tombstoned: true,
    });

    expect(status).toBe("tombstoned");
    expect(canCreateCareer({ status, hasCareer: false, replace: false })).toBe(true);
    expect(canMutateCareer(status)).toBe(false);
    expect(canResetCareer(status)).toBe(false);
  });

  it("does not offer career recreation from a local tombstone while offline", () => {
    const status = resolveCareerHydrationStatus({
      phase: "loaded",
      hasCareer: false,
      signedIn: true,
      online: false,
      tombstoned: true,
    });

    expect(status).toBe("offline");
    expect(canCreateCareer({ status, hasCareer: false, replace: false })).toBe(false);
    expect(canResetCareer(status)).toBe(false);
  });

  it("keeps a hydrated save ready and requires explicit replacement", () => {
    expect(
      resolveCareerHydrationStatus({
        phase: "loaded",
        hasCareer: true,
        signedIn: true,
        online: true,
      }),
    ).toBe("ready");
    expect(canCreateCareer({ status: "ready", hasCareer: true, replace: false })).toBe(false);
    expect(canCreateCareer({ status: "ready", hasCareer: true, replace: true })).toBe(true);
    expect(canResetCareer("ready")).toBe(true);
    expect(canMutateCareer("empty")).toBe(true);
  });

  it("does not treat a failed cloud read as an empty save", () => {
    expect(
      resolveCareerHydrationStatus({
        phase: "loaded",
        hasCareer: false,
        signedIn: true,
        online: true,
        requestError: true,
      }),
    ).toBe("error");
    expect(
      resolveCareerHydrationStatus({
        phase: "loaded",
        hasCareer: true,
        signedIn: true,
        online: true,
        requestError: true,
      }),
    ).toBe("error");
    expect(canCreateCareer({ status: "error", hasCareer: false, replace: false })).toBe(false);
    expect(canResetCareer("error")).toBe(false);
  });
});
