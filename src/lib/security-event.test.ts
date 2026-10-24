import { expect, it } from "vitest";
import { googleSecOpsBatch, securityEvent } from "./security-event";
it("projects security events without secrets, user data or arbitrary reason strings", () => {
  const event = securityEvent({
    security_event: "google_fraud_defense",
    result: "rejected",
    policy: "enforce",
    scoreBucket: "low",
    reason: "token=secret email@example.com",
    token: "private-token",
    email: "email@example.com",
    url: "https://site.test/?secret",
  });
  expect(event).not.toBeNull();
  expect(JSON.stringify(event)).not.toMatch(/secret|email|private|site.test/);
  expect(securityEvent({ security_event: "injected\nvalue", result: "rejected" })).toBeNull();
});
it("builds bounded modern ImportEvents envelopes and preserves event time", () => {
  const event = securityEvent(
    { security_event: "http_access_denied", result: "rejected", status: 403 },
    new Date("2026-10-19T12:00:00Z"),
  )!;
  const batch = googleSecOpsBatch([event]);
  expect(batch.inlineSource.events[0]?.udm.metadata.eventTimestamp).toBe(event.timestamp);
  expect(batch.inlineSource.events[0]?.udm.securityResult[0]?.action).toEqual(["BLOCK"]);
  expect(() => googleSecOpsBatch([])).toThrow();
  expect(() => googleSecOpsBatch(Array(101).fill(event))).toThrow();
  expect(() => googleSecOpsBatch([{ ...event, timestamp: "bad" }])).toThrow();
});
