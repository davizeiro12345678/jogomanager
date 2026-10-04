import { describe, expect, it } from "vitest";
import { safeAuthNext, authCallbackErrorMessage, authErrorMessage } from "./auth-policy";

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
  it("uses the provider-login message for an OAuth code exchange error", () => {
    const message = authCallbackErrorMessage("unexpected_failure", "Unable to exchange code");
    expect(message).toMatch(/concluir o login com esse provedor/);
    expect(message).not.toMatch(/expirou|Unable to exchange/);
  });
  it("keeps an actionable expired-link message for email callbacks", () => {
    expect(authCallbackErrorMessage("otp_expired", "Email link is invalid")).toMatch(
      /Solicite outro e-mail/,
    );
  });
  it("offers a new email after an expired passwordless code", () => {
    expect(authErrorMessage({ code: "otp_expired" }, "magic")).toMatch(/Solicite um novo/);
  });
  it("gives an actionable error for an unconfirmed account", () => {
    expect(authErrorMessage({ code: "email_not_confirmed" }, "in")).toMatch(/Confirme/);
  });
  it("handles an existing email without disclosing or duplicating the account", () => {
    const message = authErrorMessage({ code: "user_already_exists" }, "up");
    expect(message).toMatch(/Tente entrar ou recuperar sua senha/);
    expect(message).not.toMatch(/já existe|cadastrado com esse e-mail/i);
  });
  it("does not disclose raw provider responses or internal details", () => {
    const message = authErrorMessage(new Error("private token and SQL details"), "up");
    expect(message).toMatch(/conexão/);
    expect(message).not.toMatch(/token|SQL/);
  });
});
