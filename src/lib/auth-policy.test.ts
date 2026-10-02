import { describe, expect, it } from "vitest";
import { safeAuthNext, authErrorMessage } from "./auth-policy";

describe("auth callback destinations", () => {
  it("keeps local paths, queries and anchors", () => {
    expect(safeAuthNext("/club?tab=team#squad")).toBe("/club?tab=team#squad");
  });
  it.each([
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example",
    "/\n/evil.example",
    "javascript:alert(1)",
    null,
    1,
  ])("rejects external or ambiguous destination %s", (value) => {
    expect(safeAuthNext(value)).toBeUndefined();
  });
});

describe("auth errors", () => {
  it("offers a new email after an expired passwordless code", () => {
    expect(authErrorMessage({ code: "otp_expired" }, "magic")).toMatch(/Solicite um novo/);
  });
  it("gives an actionable error for an unconfirmed account", () => {
    expect(authErrorMessage({ code: "email_not_confirmed" }, "in")).toMatch(/Confirme/);
  });
  it("does not disclose raw provider responses or internal details", () => {
    const message = authErrorMessage(new Error("private token and SQL details"), "up");
    expect(message).toMatch(/conexão/);
    expect(message).not.toMatch(/token|SQL/);
  });
});
