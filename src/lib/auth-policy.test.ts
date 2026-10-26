import { describe, expect, it } from "vitest";
import {
  safeAuthNext,
  authCallbackErrorMessage,
  authCallbackUrlWithoutErrorDetails,
  authErrorMessage,
  completePasswordRecovery,
} from "./auth-policy";

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

describe("password recovery session containment", () => {
  it("updates the password before revoking other sessions and keeps this session", async () => {
    const operations: string[] = [];
    const result = await completePasswordRecovery(
      {
        updateUser: async ({ password }) => {
          operations.push(`password:${password}`);
          return { error: null };
        },
        signOut: async ({ scope }) => {
          operations.push(`signout:${scope}`);
          return { error: null };
        },
      },
      "new-password",
    );
    expect(operations).toEqual(["password:new-password", "signout:others"]);
    expect(result.otherSessionsRevoked).toBe(true);
  });
  it("does not revoke sessions or report success after a rejected password", async () => {
    let revoked = false;
    await expect(
      completePasswordRecovery(
        {
          updateUser: async () => ({ error: new Error("weak_password") }),
          signOut: async () => {
            revoked = true;
            return { error: null };
          },
        },
        "weak",
      ),
    ).rejects.toThrow("weak_password");
    expect(revoked).toBe(false);
  });
  it("reports a partial recovery when the other-session revocation fails", async () => {
    const result = await completePasswordRecovery(
      {
        updateUser: async () => ({ error: null }),
        signOut: async () => {
          throw new Error("network");
        },
      },
      "new-password",
    );
    expect(result.otherSessionsRevoked).toBe(false);
  });
});

describe("auth errors", () => {
  it("removes provider errors and leaked code fragments from the callback URL", () => {
    expect(
      authCallbackUrlWithoutErrorDetails(
        "https://jogomanager.com/auth?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+4%2F0A&next=%2Floja#error=server_error&error_description=Unable+to+exchange+external+code%3A+4%2F0A&sb=",
      ),
    ).toBe("/auth?next=%2Floja");
  });
  it("preserves OAuth tokens and unrelated fragment state when no error is present", () => {
    expect(
      authCallbackUrlWithoutErrorDetails(
        "https://jogomanager.com/auth?next=%2Floja#access_token=example&refresh_token=example",
      ),
    ).toBe("/auth?next=%2Floja#access_token=example&refresh_token=example");
  });
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
  it("gives an actionable retry message when Supabase rate limits SMS", () => {
    expect(authErrorMessage({ code: "over_sms_send_rate_limit" }, "phone")).toMatch(/outro SMS/);
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
