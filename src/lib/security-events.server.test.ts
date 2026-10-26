import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("bounded server security events", () => {
  it("records access denial, throttling and provider failures without normal traffic", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const { auditSecurityResponse } = await import("./security-events.server");
    for (const status of [200, 302, 401, 403, 429, 500, 503]) auditSecurityResponse(status);
    const events = log.mock.calls.map(([line]) => JSON.parse(String(line)));
    expect(events.map((event) => [event.security_event, event.status])).toEqual([
      ["http_access_denied", 401],
      ["http_access_denied", 403],
      ["http_rate_limited", 429],
      ["http_server_error", 500],
      ["http_server_error", 503],
    ]);
    expect(
      events.every((event) =>
        Object.keys(event).every((key) =>
          ["schemaVersion", "timestamp", "security_event", "result", "status"].includes(key),
        ),
      ),
    ).toBe(true);
  });
  it("bounds a denial flood and reports the suppressed count after the window", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const { auditSecurityResponse } = await import("./security-events.server");
    for (let index = 0; index < 120; index++) auditSecurityResponse(403);
    expect(log).toHaveBeenCalledTimes(60);
    vi.advanceTimersByTime(60_001);
    auditSecurityResponse(403);
    expect(log).toHaveBeenCalledTimes(62);
    expect(JSON.parse(String(log.mock.calls[60]![0]))).toMatchObject({
      security_event: "security_log_sampling",
      category: "http_access_denied",
      suppressed: 60,
    });
    expect(JSON.parse(String(log.mock.calls[61]![0]))).toMatchObject({
      security_event: "http_access_denied",
      status: 403,
    });
  });
});
