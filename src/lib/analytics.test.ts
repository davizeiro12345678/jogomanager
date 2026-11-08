import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  opt_out_capturing: vi.fn(),
  opt_in_capturing: vi.fn(),
  has_opted_out_capturing: vi.fn(),
}));

vi.mock("posthog-js/dist/module.slim.no-external.js", () => ({ default: mocks }));
vi.mock("./firebase", () => ({ initFirebase: vi.fn() }));

let allowed = false;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY", "fixture-token");
  vi.stubEnv("VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY", "");
  vi.stubGlobal("window", {
    location: { origin: "https://jogomanager.com" },
    localStorage: {
      getItem: () => JSON.stringify({ analytics: allowed, decidedAt: "fixture" }),
    },
  });
  allowed = false;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("analytics consent and checkout privacy", () => {
  it("loads only after consent, removes checkout identifiers and stops after revocation", async () => {
    const { initAnalytics, track } = await import("./analytics");
    await initAnalytics();
    expect(mocks.init).not.toHaveBeenCalled();
    allowed = true;
    await initAnalytics();
    expect(mocks.init).toHaveBeenCalledOnce();
    const config = mocks.init.mock.calls[0]![1] as {
      before_send: (event: { properties: Record<string, string> }) => unknown;
    };
    const event = {
      properties: {
        $current_url: "https://jogomanager.com/checkout/return?session_id=cs_fixture#payment",
        $referrer: "https://example.com/private/path?email=user@example.com",
      },
    };
    expect(config.before_send(event)).toEqual({
      properties: {
        $current_url: "https://jogomanager.com/checkout/return",
        $referrer: "https://example.com",
      },
    });
    track("decisao_bastidor_confirmada");
    expect(mocks.capture).toHaveBeenCalledOnce();
    allowed = false;
    await initAnalytics();
    expect(mocks.opt_out_capturing).toHaveBeenCalledOnce();
    expect(config.before_send(event)).toBeNull();
    track("compra_concluida");
    expect(mocks.capture).toHaveBeenCalledOnce();
  });
});
