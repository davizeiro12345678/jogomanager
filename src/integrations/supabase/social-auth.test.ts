import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  availableAuthMethods,
  lovableOAuthProvider,
  parseAuthMethods,
  socialOAuthOptions,
  socialProviderLabel,
} from "./social-auth";

const enabledSettings = {
  external: {
    google: true,
    azure: true,
    discord: true,
    facebook: true,
    figma: true,
    github: true,
    linkedin_oidc: true,
    spotify: true,
    apple: false,
    phone: false,
    email: true,
    anonymous_users: false,
  },
  disable_signup: false,
  passkeys_enabled: true,
};

describe("configured authentication methods", () => {
  it("exposes every social login in the project's public settings", () => {
    const methods = parseAuthMethods(enabledSettings);
    expect(methods.socialProviders.map(socialProviderLabel)).toEqual([
      "Google",
      "Microsoft",
      "Discord",
      "Facebook",
      "GitHub",
      "LinkedIn",
      "Spotify",
      "Figma",
    ]);
    expect(methods).toMatchObject({ email: true, passkeys: true, signup: true });
  });

  it("filters enabled social providers through an explicit public allowlist", () => {
    const methods = parseAuthMethods(enabledSettings, ["google", "github"]);
    expect(methods.socialProviders).toEqual(["google", "github"]);
    expect(methods).toMatchObject({ email: true, passkeys: true, signup: true });
  });

  it("supports hiding all social buttons until provider credentials are validated", () => {
    expect(parseAuthMethods(enabledSettings, ["none"]).socialProviders).toEqual([]);
  });

  it("never treats email, phone, anonymous users, unknown flags or truthy strings as OAuth", () => {
    expect(
      parseAuthMethods({
        external: {
          email: true,
          phone: true,
          anonymous_users: true,
          google: "true",
          azure: 1,
          unknown: true,
        },
      }).socialProviders,
    ).toEqual([]);
  });

  it("follows disabled email, signup and passkey settings without inventing defaults", () => {
    expect(
      parseAuthMethods({ external: { email: false, google: false }, disable_signup: true }),
    ).toEqual({
      socialProviders: [],
      email: false,
      passkeys: false,
      signup: false,
    });
  });

  it("supports newly enabled built-in and custom OIDC providers", () => {
    const methods = parseAuthMethods({
      external: { apple: true, gitlab: true, "custom:Clube": true, "custom:": true },
    });
    expect(methods.socialProviders).toEqual(["apple", "gitlab", "custom:Clube"]);
    expect(socialProviderLabel("custom:Clube")).toBe("Clube");
  });

  it.each([null, {}, { external: [] }, { external: null }])(
    "rejects malformed settings %j",
    (settings) => {
      expect(() => parseAuthMethods(settings)).toThrow(/settings/);
    },
  );

  it("only brokers providers the Lovable SDK supports", () => {
    expect(lovableOAuthProvider("google")).toBe("google");
    expect(lovableOAuthProvider("azure")).toBe("microsoft");
    expect(lovableOAuthProvider("apple")).toBe("apple");
    for (const provider of parseAuthMethods(enabledSettings).socialProviders.filter(
      (value) => value !== "google" && value !== "azure",
    )) {
      expect(lovableOAuthProvider(provider)).toBeUndefined();
    }
  });

  it("preserves the callback destination for every configured direct provider", () => {
    const redirectTo = "https://jogomanager.com/auth?next=%2Fperfil";
    for (const provider of [
      "google",
      "discord",
      "facebook",
      "github",
      "linkedin_oidc",
      "spotify",
      "figma",
    ] as const) {
      expect(socialOAuthOptions(provider, redirectTo)).toEqual({ redirectTo });
    }
    expect(socialOAuthOptions("azure", redirectTo)).toEqual({ redirectTo, scopes: "email" });
  });
});

describe("public settings discovery", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co/");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the configured project, publishable key, a bounded request and fresh settings", async () => {
    vi.stubEnv("VITE_AUTH_PROVIDER_ALLOWLIST", "google, github,google");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(enabledSettings)));
    vi.stubGlobal("fetch", fetchMock);
    expect((await availableAuthMethods()).socialProviders).toEqual(["google", "github"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/auth/v1/settings",
      expect.objectContaining({
        headers: { apikey: "sb_publishable_test" },
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("reports an HTTP failure so the UI can offer retry, without leaking server details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("private server details", { status: 503 })),
    );
    await expect(availableAuthMethods()).rejects.toThrow("Authentication settings unavailable");
  });

  it("allows cleanup to cancel pending discovery", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url, init: RequestInit) => {
        init.signal?.throwIfAborted();
        return Promise.resolve(new Response(JSON.stringify(enabledSettings)));
      }),
    );
    await expect(availableAuthMethods(controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("does not request another project when public configuration is missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(availableAuthMethods()).rejects.toThrow(/configuration/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
