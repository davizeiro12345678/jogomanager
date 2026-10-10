import { describe, expect, it } from "vitest";

import { telemetryRateLimitBucket } from "./telemetry.functions";

describe("technical telemetry admission identity", () => {
  it("creates a stable salted bucket without retaining a raw address", async () => {
    const headers = new Headers({ "cf-connecting-ip": "203.0.113.17" });
    const first = await telemetryRateLimitBucket(headers, "private-test-salt");
    const second = await telemetryRateLimitBucket(headers, "private-test-salt");
    expect(first).toMatch(/^tech-v1:[a-f0-9]{64}$/);
    expect(first).toBe(second);
    expect(first).not.toContain("203.0.113.17");
  });

  it("fails closed when a trusted request identity or salt is unavailable", async () => {
    expect(await telemetryRateLimitBucket(new Headers(), "private-test-salt")).toBeNull();
    expect(
      await telemetryRateLimitBucket(
        new Headers({ "cf-connecting-ip": "203.0.113.17" }),
        undefined,
      ),
    ).toBeNull();
  });
});
