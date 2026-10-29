import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consent: { analytics: true },
  optedOut: false,
  init: vi.fn(),
  capture: vi.fn(),
  disableFirebase: vi.fn(),
  initFirebase: vi.fn(),
  optOut: vi.fn(),
  optIn: vi.fn(),
}));

vi.mock("./consent", () => ({
  readConsent: () => mocks.consent,
}));

vi.mock("./firebase", () => ({
  initFirebase: mocks.initFirebase,
  disableFirebaseAnalytics: mocks.disableFirebase,
}));

vi.mock("posthog-js", () => ({
  default: {
    init: mocks.init,
    capture: mocks.capture,
    has_opted_out_capturing: () => mocks.optedOut,
    opt_out_capturing: () => {
      mocks.optedOut = true;
      mocks.optOut();
    },
    opt_in_capturing: () => {
      mocks.optedOut = false;
      mocks.optIn();
    },
  },
}));

it("deduplicates PostHog initialization, guards consent and uses the gated proxy", async () => {
  vi.stubEnv("VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY", "phc_test_only");
  vi.stubEnv("VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY", "");
  vi.stubEnv("VITE_POSTHOG_PROXY_HOST", "https://e.jogomanager.com");

  const { initAnalytics, track } = await import("./analytics");
  const [first, second] = await Promise.all([initAnalytics(), initAnalytics()]);
  expect(first).toBeTruthy();
  expect(second).toBe(first);
  expect(mocks.init).toHaveBeenCalledTimes(1);
  expect(mocks.init).toHaveBeenCalledWith(
    "phc_test_only",
    expect.objectContaining({
      api_host: "https://e.jogomanager.com",
      ui_host: "https://us.posthog.com",
      autocapture: false,
      disable_session_recording: true,
    }),
  );
  await vi.waitFor(() => expect(mocks.initFirebase).toHaveBeenCalledTimes(1));

  mocks.consent.analytics = false;
  expect(await initAnalytics()).toBeNull();
  track("should_not_be_sent");
  expect(mocks.capture).not.toHaveBeenCalled();
  expect(mocks.optOut).toHaveBeenCalledTimes(1);
  await vi.waitFor(() => expect(mocks.disableFirebase).toHaveBeenCalledTimes(1));

  mocks.consent.analytics = true;
  expect(await initAnalytics()).toBe(first);
  expect(mocks.optIn).toHaveBeenCalledTimes(1);
  expect(mocks.init).toHaveBeenCalledTimes(1);
  vi.unstubAllEnvs();
});
