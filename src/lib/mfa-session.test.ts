import { describe, expect, it } from "vitest";
import { needsMfaChallenge, sessionMeetsMfa } from "./mfa-session";

describe("MFA session boundary", () => {
  it("requires the second factor after any first-factor login or recovery", () => {
    expect(needsMfaChallenge({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
    expect(needsMfaChallenge({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(false);
    expect(needsMfaChallenge({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(false);
  });
  it("does not trust user metadata to bypass a verified factor", () => {
    expect(sessionMeetsMfa("aal1", [{ status: "verified" }])).toBe(false);
    expect(sessionMeetsMfa(undefined, [{ status: "verified" }])).toBe(false);
    expect(sessionMeetsMfa("aal2", [{ status: "verified" }])).toBe(true);
  });
  it("preserves access for accounts without an enrolled factor", () => {
    expect(sessionMeetsMfa("aal1", [])).toBe(true);
    expect(sessionMeetsMfa("aal1", [{ status: "unverified" }])).toBe(true);
  });
});
