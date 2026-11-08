import { describe, expect, it } from "vitest";

import {
  canMutateCareer,
  deriveCareerHydrationStatus,
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
