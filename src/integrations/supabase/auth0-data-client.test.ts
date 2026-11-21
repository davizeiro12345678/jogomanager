import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createAuth0SupabasePilotClient } from "./auth0-data-client";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ isolatedAuth0Pilot: true })),
}));

function setup() {
  return {
    enabled: true,
    supabaseUrl: "https://project.supabase.co/",
    publishableKey: "sb_publishable_test_only",
    auth0: {
      getIdTokenClaims: vi.fn(async () => ({ __raw: "header.payload.signature" })),
    },
  };
}

describe("isolated Auth0 third-party Data API pilot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("never creates another client unless explicitly enabled", () => {
    expect(() => createAuth0SupabasePilotClient({ ...setup(), enabled: false })).toThrow(
      /disabled/,
    );
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each([
    "http://project.supabase.co",
    "https://user:pass@project.supabase.co",
    "https://project.supabase.co/api",
    "https://project.supabase.co/?redirect=evil",
    "not-a-url",
  ])("rejects an unsafe Supabase origin: %s", (url) => {
    expect(() => createAuth0SupabasePilotClient({ ...setup(), supabaseUrl: url })).toThrow();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("never accepts a server secret or legacy service role in a browser client", () => {
    expect(() =>
      createAuth0SupabasePilotClient({ ...setup(), publishableKey: "sb_secret_not_public" }),
    ).toThrow(/publishable/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("uses the Auth0 ID token, not an access token, without a shared Supabase Auth session", async () => {
    const config = setup();
    createAuth0SupabasePilotClient(config);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "sb_publishable_test_only",
      expect.objectContaining({
        accessToken: expect.any(Function),
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }),
    );

    const options = vi.mocked(createClient).mock.calls[0]?.[2];
    expect(options?.accessToken).toBeTypeOf("function");
    expect(await options?.accessToken?.()).toBe("header.payload.signature");
    expect(config.auth0.getIdTokenClaims).toHaveBeenCalledTimes(1);
  });

  it("fails closed when no Auth0 session is present", async () => {
    const config = setup();
    config.auth0.getIdTokenClaims.mockResolvedValue({ __raw: "" });
    createAuth0SupabasePilotClient(config);
    const options = vi.mocked(createClient).mock.calls[0]?.[2];
    await expect(options!.accessToken!()).rejects.toThrow(/login is required/);
  });

  it("never silently accepts malformed ID-token values", async () => {
    const config = setup();
    config.auth0.getIdTokenClaims.mockResolvedValue({ __raw: "not-a-jwt" });
    createAuth0SupabasePilotClient(config);
    const options = vi.mocked(createClient).mock.calls[0]?.[2];
    await expect(options!.accessToken!()).rejects.toThrow(/login is required/);
  });
});
