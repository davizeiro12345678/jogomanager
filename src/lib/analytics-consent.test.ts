import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  init: vi.fn(),
  opt_out_capturing: vi.fn(),
  opt_in_capturing: vi.fn(),
  has_opted_out_capturing: vi.fn(() => false),
  initFirebase: vi.fn(),
  disableFirebaseAnalytics: vi.fn(),
}));
vi.mock("posthog-js", () => ({ default: mocks }));
vi.mock("./firebase", () => ({
  initFirebase: mocks.initFirebase,
  disableFirebaseAnalytics: mocks.disableFirebaseAnalytics,
}));

describe("analytics consent", () => {
  let allowed: boolean;
  let fakeWindow: {
    localStorage: { getItem: () => string };
    dataLayer?: unknown[];
    [key: string]: unknown;
  };
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    allowed = true;
    fakeWindow = { localStorage: { getItem: () => JSON.stringify({ analytics: allowed }) } };
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("document", { createElement: () => ({}), head: { appendChild: vi.fn() } });
    vi.stubEnv("VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY", "test-token");
    vi.stubEnv("VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY", "G-TEST");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("stops capture on revocation and resumes only after consent returns", async () => {
    const { initAnalytics, track } = await import("./analytics");
    await initAnalytics();
    track("before");
    expect(mocks.capture).toHaveBeenCalledTimes(1);
    allowed = false;
    await initAnalytics();
    track("after");
    expect(mocks.capture).toHaveBeenCalledTimes(1);
    expect(mocks.opt_out_capturing).toHaveBeenCalled();
    expect(fakeWindow["ga-disable-G-TEST"]).toBe(true);
    await vi.waitFor(() => expect(mocks.disableFirebaseAnalytics).toHaveBeenCalled());
    mocks.has_opted_out_capturing.mockReturnValueOnce(true);
    allowed = true;
    await initAnalytics();
    expect(mocks.opt_in_capturing).toHaveBeenCalled();
    expect(fakeWindow["ga-disable-G-TEST"]).toBe(false);
  });

  it("does not initialize analytics without consent", async () => {
    allowed = false;
    const { initAnalytics, track } = await import("./analytics");
    await initAnalytics();
    track("blocked");
    expect(mocks.init).not.toHaveBeenCalled();
    expect(mocks.capture).not.toHaveBeenCalled();
    expect(fakeWindow.dataLayer).toBeUndefined();
  });
});
