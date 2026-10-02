import { afterEach, describe, expect, it, vi } from "vitest";
import { passkeyErrorMessage, supportsPasskeys } from "./passkey-auth";

afterEach(() => vi.unstubAllGlobals());

describe("passkey availability", () => {
  it("does not offer browser ceremonies during SSR", () => {
    expect(supportsPasskeys()).toBe(false);
  });
  it.each([true, false])("requires a secure context (%s)", (secure) => {
    vi.stubGlobal("window", { isSecureContext: secure });
    vi.stubGlobal("PublicKeyCredential", class {});
    vi.stubGlobal("navigator", { credentials: { get: vi.fn(), create: vi.fn() } });
    expect(supportsPasskeys()).toBe(secure);
  });
  it("handles browsers without credential APIs", () => {
    vi.stubGlobal("window", { isSecureContext: true });
    vi.stubGlobal("PublicKeyCredential", class {});
    vi.stubGlobal("navigator", {});
    expect(supportsPasskeys()).toBe(false);
  });
});

describe("passkey errors", () => {
  it("allows the player to retry after cancelling the platform prompt", () => {
    expect(passkeyErrorMessage({ name: "NotAllowedError" })).toMatch(/cancelada.*Tente novamente/);
  });
  it("explains a domain mismatch without disclosing credentials", () => {
    expect(passkeyErrorMessage({ name: "SecurityError" })).toMatch(/endereço do jogo/);
  });
  it("handles a passkey toggle changed during sign-in", () => {
    expect(passkeyErrorMessage({ code: "passkey_disabled" })).toMatch(/indisponíveis/);
  });
  it("explains a server CAPTCHA requirement and offers linked-account access", () => {
    expect(passkeyErrorMessage({ code: "captcha_failed" })).toMatch(
      /serviço de acesso ainda exige.*conta vinculada/,
    );
  });
  it("never displays raw server or credential details", () => {
    const message = passkeyErrorMessage(new Error("private credential: secret"));
    expect(message).toMatch(/ou entre com e-mail/);
    expect(message).not.toMatch(/private|secret/);
  });
});
