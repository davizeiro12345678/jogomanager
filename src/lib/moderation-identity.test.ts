import { describe, expect, it } from "vitest";
import { mayShowModerationData } from "./moderation-identity";

describe("moderation review identity isolation", () => {
  it("shows private records only after the current account finishes loading", () => {
    expect(mayShowModerationData("account-a", null)).toBe(false);
    expect(mayShowModerationData("account-a", "account-a")).toBe(true);
    expect(mayShowModerationData("account-b", "account-a")).toBe(false);
    expect(mayShowModerationData("account-b", "account-b")).toBe(true);
  });

  it("never displays cached moderation records while signed out or checking login", () => {
    expect(mayShowModerationData(null, "account-a")).toBe(false);
    expect(mayShowModerationData(undefined, "account-a")).toBe(false);
    expect(mayShowModerationData("", "")).toBe(false);
  });
});
