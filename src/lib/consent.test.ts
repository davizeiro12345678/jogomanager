import { afterEach, expect, it, vi } from "vitest";
import { readConsent } from "./consent";

afterEach(() => vi.unstubAllGlobals());

it.each([null, 12, "", "not-a-date"])(
  "does not enable optional collection without a valid decision (%s)",
  (decidedAt) => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => JSON.stringify({ analytics: true, telemetry: true, decidedAt }),
      },
    });
    expect(readConsent()).toEqual({ analytics: false, telemetry: false, decidedAt: null });
  },
);

it("preserves an explicit valid decision", () => {
  const decision = { analytics: false, telemetry: true, decidedAt: "2026-11-27T00:00:00.000Z" };
  vi.stubGlobal("window", { localStorage: { getItem: () => JSON.stringify(decision) } });
  expect(readConsent()).toEqual(decision);
});
