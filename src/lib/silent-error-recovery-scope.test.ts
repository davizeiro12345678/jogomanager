import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { reportSilent, getSilentErrorReports, resetSilentErrorReports } from "./silent-errors";
import { consumeLastCapturedError } from "./error-capture";
beforeEach(() => {
  resetSilentErrorReports();
  consumeLastCapturedError();
});
afterEach(() => vi.unstubAllEnvs());
it("retains browser diagnostics without populating the server-only recovery slot", () => {
  vi.stubEnv("SSR", false);
  reportSilent("client.fixture", new Error("fixture"), { classification: "degradation" });
  expect(getSilentErrorReports()).toHaveLength(1);
  expect(consumeLastCapturedError()).toBeUndefined();
});
it("preserves the original error for server-side consume-once recovery", () => {
  vi.stubEnv("SSR", true);
  const error = new Error("server fixture");
  reportSilent("server.fixture", error, { classification: "degradation" });
  expect(consumeLastCapturedError()).toBe(error);
  expect(consumeLastCapturedError()).toBeUndefined();
});
