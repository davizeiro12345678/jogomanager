import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createGoogleFraudDefenseToken } from "./google-fraud-defense.client";

beforeEach(() => {
  vi.stubGlobal("window", { setTimeout, clearTimeout });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("does not execute the provider while the browser integration is disabled", async () => {
  vi.stubEnv("VITE_GOOGLE_FRAUD_DEFENSE_ENABLED", "false");
  const execute = vi.fn();
  window.grecaptcha = { enterprise: { ready: (callback) => callback(), execute } };
  expect(await createGoogleFraudDefenseToken("account_checkout")).toBeNull();
  expect(execute).not.toHaveBeenCalled();
});

it("leaves provider failures to the server's observe/enforce decision", async () => {
  vi.stubEnv("VITE_GOOGLE_FRAUD_DEFENSE_ENABLED", "true");
  vi.stubEnv("VITE_GOOGLE_RECAPTCHA_SITE_KEY", "public-site-key");
  window.grecaptcha = {
    enterprise: {
      ready: (callback) => callback(),
      execute: async () => {
        throw new Error("offline");
      },
    },
  };
  expect(await createGoogleFraudDefenseToken("account_checkout")).toBeNull();
});

it("requests the action-specific token without changing it on the client", async () => {
  vi.stubEnv("VITE_GOOGLE_FRAUD_DEFENSE_ENABLED", "true");
  vi.stubEnv("VITE_GOOGLE_RECAPTCHA_SITE_KEY", "public-site-key");
  const execute = vi.fn().mockResolvedValue("assessment-token");
  window.grecaptcha = { enterprise: { ready: (callback) => callback(), execute } };
  expect(await createGoogleFraudDefenseToken("account_checkout")).toBe("assessment-token");
  expect(execute).toHaveBeenCalledWith("public-site-key", { action: "account_checkout" });
});
