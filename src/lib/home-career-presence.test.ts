import { describe, expect, it } from "vitest";
import { shouldLoadHomeCareer } from "./home-career-presence";

describe("home career preload detection", () => {
  it("skips the legacy offline-store import for a new visitor", () => {
    const queried: string[] = [];
    expect(
      shouldLoadHomeCareer(() => ({
        getItem(key: string) {
          queried.push(key);
          return null;
        },
      })),
    ).toBe(false);
    expect(queried).toEqual(["manager3d.career.v2.guest", "manager3d.career.v1"]);
  });

  it("keeps current guest saves eligible for resume", () => {
    expect(
      shouldLoadHomeCareer(() => ({
        getItem(key: string) {
          return key === "manager3d.career.v2.guest" ? '{"version":1}' : null;
        },
      })),
    ).toBe(true);
  });

  it("keeps legacy guest saves eligible for resume", () => {
    expect(
      shouldLoadHomeCareer(() => ({
        getItem(key: string) {
          return key === "manager3d.career.v1" ? '{"version":1}' : null;
        },
      })),
    ).toBe(true);
  });

  it("preserves the previous fallback if localStorage is unavailable", () => {
    expect(
      shouldLoadHomeCareer(() => {
        throw new DOMException("storage unavailable", "SecurityError");
      }),
    ).toBe(true);
    expect(
      shouldLoadHomeCareer(() => ({
        getItem() {
          throw new Error("restricted");
        },
      })),
    ).toBe(true);
  });
});
