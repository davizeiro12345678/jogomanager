import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  supported: vi.fn(),
  getAnalytics: vi.fn(),
  enabled: vi.fn(),
}));
vi.mock("./firebase-config.functions", () => ({ getFirebaseWebConfig: mocks.config }));
vi.mock("firebase/app", () => ({ getApps: () => [], initializeApp: () => ({}) }));
vi.mock("firebase/analytics", () => ({
  isSupported: mocks.supported,
  getAnalytics: mocks.getAnalytics,
  setAnalyticsCollectionEnabled: mocks.enabled,
}));

let allowed = true;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  allowed = true;
  vi.stubGlobal("window", {
    localStorage: { getItem: () => JSON.stringify({ analytics: allowed }) },
  });
  mocks.config.mockResolvedValue({ apiKey: "x", projectId: "x", appId: "x", measurementId: "G-X" });
  mocks.getAnalytics.mockReturnValue({});
});
afterEach(() => vi.unstubAllGlobals());

it("does not enable analytics if consent is withdrawn while support is checked", async () => {
  let finish: (value: boolean) => void = () => undefined;
  mocks.supported.mockReturnValue(
    new Promise<boolean>((resolve) => {
      finish = resolve;
    }),
  );
  const { initFirebase } = await import("./firebase");
  const pending = initFirebase({ analytics: true });
  await vi.waitFor(() => expect(mocks.supported).toHaveBeenCalled());
  allowed = false;
  finish(true);
  await pending;
  expect(mocks.getAnalytics).not.toHaveBeenCalled();
  expect(mocks.enabled).not.toHaveBeenCalled();
});

it("disables a running SDK and ignores a stale disable after renewed consent", async () => {
  mocks.supported.mockResolvedValue(true);
  const { initFirebase, disableFirebaseAnalytics } = await import("./firebase");
  await initFirebase({ analytics: true });
  allowed = false;
  disableFirebaseAnalytics();
  expect(mocks.enabled).toHaveBeenLastCalledWith(expect.anything(), false);
  allowed = true;
  await initFirebase({ analytics: true });
  disableFirebaseAnalytics();
  expect(mocks.enabled).toHaveBeenLastCalledWith(expect.anything(), true);
});
