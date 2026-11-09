import { describe, expect, it } from "vitest";
import { oauthTransport, socialAuthErrorMessage, usesLovableOAuth } from "./auth-transport";

describe("OAuth identity transport", () => {
  it.each([undefined, null, "", "supabase", "supabase-direct", "unknown", false])(
    "uses direct Supabase OAuth for mode %j",
    (mode) => {
      expect(usesLovableOAuth(mode)).toBe(false);
      expect(oauthTransport(mode, "google")).toEqual({ kind: "supabase", provider: "google" });
      expect(oauthTransport(mode, "azure")).toEqual({ kind: "supabase", provider: "azure" });
    },
  );

  it("keeps the broker available only through the explicit legacy mode", () => {
    expect(usesLovableOAuth("lovable")).toBe(true);
    expect(oauthTransport("lovable", "google")).toEqual({ kind: "lovable", provider: "google" });
    expect(oauthTransport("lovable", "azure")).toEqual({
      kind: "lovable",
      provider: "microsoft",
    });
    expect(oauthTransport("lovable", "github")).toEqual({
      kind: "supabase",
      provider: "github",
    });
  });

  it("offers another configured method when a direct provider has no credentials", () => {
    expect(
      socialAuthErrorMessage(
        { code: "validation_failed", message: "Unsupported provider: provider is not enabled" },
        "in",
      ),
    ).toMatch(/Use e-mail ou outro método disponível/);
    expect(socialAuthErrorMessage({ code: "provider_disabled" }, "in")).toMatch(
      /não está configurado/,
    );
  });

  it("preserves denied/invalid-credential errors without switching identity providers", () => {
    expect(socialAuthErrorMessage({ code: "invalid_credentials", status: 401 }, "in")).toMatch(
      /E-mail ou senha incorretos/,
    );
    expect(socialAuthErrorMessage({ code: "forbidden", status: 403 }, "in")).toMatch(
      /Não foi possível entrar agora/,
    );
    expect(socialAuthErrorMessage(new Error("secret token"), "in")).not.toContain("secret");
  });
});
