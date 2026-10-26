import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assessGuestCheckoutFraudDefense,
  assessAccountCheckoutFraudDefense,
} from "./google-fraud-defense.server";
import {
  createGoogleFraudDefenseToken,
  isGoogleFraudDefenseEnabled,
} from "./google-fraud-defense.client";
const request = new Request("https://jogomanager.com/_server");
const token = "fixture-token-never-real";
const good = {
  tokenProperties: { valid: true, action: "guest_checkout", hostname: "jogomanager.com" },
  riskAnalysis: { score: 0.9 },
};
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("GOOGLE_FRAUD_DEFENSE_MODE", "off");
  vi.stubEnv("GOOGLE_CLOUD_PROJECT_ID", "fixture-project");
  vi.stubEnv("GOOGLE_RECAPTCHA_SITE_KEY", "fixture-site");
  vi.stubEnv("GOOGLE_RECAPTCHA_API_KEY", "fixture-key");
  vi.stubEnv("GOOGLE_FRAUD_DEFENSE_MIN_SCORE", "0.5");
  vi.stubEnv("VITE_GOOGLE_FRAUD_DEFENSE_ENABLED", "false");
  fetchMock = vi.fn().mockResolvedValue(Response.json(good));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("local Google Fraud Defense policies", () => {
  it("isolates authenticated checkout tokens from guest checkout tokens", async () => {
    vi.stubEnv("GOOGLE_FRAUD_DEFENSE_MODE", "enforce");
    await expect(assessAccountCheckoutFraudDefense(token, request)).rejects.toThrow();
    fetchMock.mockResolvedValue(
      Response.json({
        ...good,
        tokenProperties: { ...good.tokenProperties, action: "account_checkout" },
      }),
    );
    await expect(assessAccountCheckoutFraudDefense(token, request)).resolves.toBeUndefined();
    const body = JSON.parse(fetchMock.mock.calls.at(-1)?.[1].body);
    expect(body.event.expectedAction).toBe("account_checkout");
    await expect(assessGuestCheckoutFraudDefense(token, request)).rejects.toThrow();
  });
  it("stays off without sending any assessment or loading a browser script", async () => {
    vi.stubEnv("GOOGLE_FRAUD_DEFENSE_MODE", "");
    expect(isGoogleFraudDefenseEnabled()).toBe(false);
    expect(await createGoogleFraudDefenseToken("guest_checkout")).toBeNull();
    await assessGuestCheckoutFraudDefense(null, request);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects enforcement without credentials or a token before provider work", async () => {
    vi.stubEnv("GOOGLE_FRAUD_DEFENSE_MODE", "enforce");
    await expect(assessGuestCheckoutFraudDefense(null, request)).rejects.toThrow();
    vi.stubEnv("GOOGLE_RECAPTCHA_API_KEY", "");
    await expect(assessGuestCheckoutFraudDefense(token, request)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("allows only a valid matching checkout assessment above the threshold", async () => {
    vi.stubEnv("GOOGLE_FRAUD_DEFENSE_MODE", "enforce");
    await expect(assessGuestCheckoutFraudDefense(token, request)).resolves.toBeUndefined();
    const args = fetchMock.mock.calls[0];
    expect(String(args?.[0])).toContain(
      "recaptchaenterprise.googleapis.com/v1/projects/fixture-project/assessments",
    );
    expect(new URL(String(args?.[0])).search).toBe("");
    expect(args?.[1].headers["x-goog-api-key"]).toBe("fixture-key");
    expect(JSON.parse(args?.[1].body)).toEqual({
      event: { token, siteKey: "fixture-site", expectedAction: "guest_checkout" },
    });
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(token);
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain("fixture-key");
  });
  it.each([
    null,
    [],
    { tokenProperties: { ...good.tokenProperties, valid: false }, riskAnalysis: good.riskAnalysis },
    {
      tokenProperties: { ...good.tokenProperties, hostname: "evil.example" },
      riskAnalysis: good.riskAnalysis,
    },
    {
      tokenProperties: { ...good.tokenProperties, action: "login" },
      riskAnalysis: good.riskAnalysis,
    },
    { tokenProperties: { ...good.tokenProperties, action: 4 }, riskAnalysis: good.riskAnalysis },
    { ...good, riskAnalysis: { score: 0.1 } },
    { ...good, riskAnalysis: { score: 2 } },
    { ...good, riskAnalysis: {} },
  ])(
    "enforcement rejects malformed or risky assessments while observe remains available: %j",
    async (payload) => {
      fetchMock.mockImplementation(async () => Response.json(payload));
      vi.stubEnv("GOOGLE_FRAUD_DEFENSE_MODE", "enforce");
      await expect(assessGuestCheckoutFraudDefense(token, request)).rejects.toThrow();
      vi.stubEnv("GOOGLE_FRAUD_DEFENSE_MODE", "observe");
      await expect(assessGuestCheckoutFraudDefense(token, request)).resolves.toBeUndefined();
    },
  );
  it("handles Google outages according to policy without logging secrets", async () => {
    fetchMock.mockRejectedValue(new Error("private provider secret"));
    vi.stubEnv("GOOGLE_FRAUD_DEFENSE_MODE", "observe");
    await expect(assessGuestCheckoutFraudDefense(token, request)).resolves.toBeUndefined();
    vi.stubEnv("GOOGLE_FRAUD_DEFENSE_MODE", "enforce");
    await expect(assessGuestCheckoutFraudDefense(token, request)).rejects.toThrow();
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(
      "private provider secret",
    );
  });
});
