import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFirebaseWebConfig: vi.fn(),
  getUser: vi.fn(),
  hasFirebasePushDeviceToken: vi.fn(),
  observeFirebasePushIdentity: vi.fn(),
  onAuthStateChange: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useState: vi.fn(),
  events: [] as string[],
  configured: true,
}));

vi.mock("react", () => ({
  useEffect: mocks.useEffect,
  useRef: mocks.useRef,
  useState: mocks.useState,
}));
vi.mock("lucide-react", () => ({ Bell: () => null, BellOff: () => null }));
vi.mock("@/components/ui/button", () => ({ Button: "button" }));
vi.mock("@/integrations/supabase/client", () => ({
  getConfiguredSupabaseClient: () =>
    mocks.configured
      ? {
          auth: {
            getUser: mocks.getUser,
            onAuthStateChange: mocks.onAuthStateChange,
          },
        }
      : null,
}));
vi.mock("@/lib/firebase-config.functions", () => ({
  getFirebaseWebConfig: mocks.getFirebaseWebConfig,
}));
vi.mock("@/lib/firebase-push", () => ({
  disableFirebaseNotifications: vi.fn(),
  enableFirebaseNotifications: vi.fn(),
  hasFirebasePushDeviceToken: mocks.hasFirebasePushDeviceToken,
  observeFirebasePushIdentity: mocks.observeFirebasePushIdentity,
}));

import { FirebasePushControl } from "./FirebasePushControl";

let effectCallback: (() => void | (() => void)) | undefined;
let effectCleanup: (() => void) | undefined;
let authListener: ((_event: string, session: { user?: { id: string } } | null) => void) | undefined;

beforeEach(() => {
  mocks.configured = true;
  mocks.events = [];
  mocks.useEffect.mockImplementation((effect: () => void | (() => void)) => {
    effectCallback = effect;
  });
  mocks.useRef.mockImplementation((initial: unknown) => ({ current: initial }));
  mocks.useState.mockImplementation((initial: unknown) => [initial, vi.fn()]);
  mocks.onAuthStateChange.mockImplementation((listener) => {
    mocks.events.push("listener");
    authListener = listener;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  mocks.getUser.mockImplementation(async () => {
    mocks.events.push("initial-read");
    return { data: { user: { id: "stale-user" } }, error: null };
  });
  mocks.observeFirebasePushIdentity.mockResolvedValue(undefined);
  mocks.hasFirebasePushDeviceToken.mockReturnValue(true);
});

afterEach(() => {
  effectCleanup?.();
  effectCallback = undefined;
  effectCleanup = undefined;
  authListener = undefined;
  vi.clearAllMocks();
});

describe("FirebasePushControl identity ordering", () => {
  it("does not subscribe to push or auth when the project is unavailable", () => {
    mocks.configured = false;
    FirebasePushControl();
    expect(effectCallback?.()).toBeUndefined();
    expect(mocks.onAuthStateChange).not.toHaveBeenCalled();
    expect(mocks.getFirebaseWebConfig).not.toHaveBeenCalled();
  });

  it("keeps the auth event identity when the initial user read resolves afterward", async () => {
    let resolveInitial: ((value: unknown) => void) | undefined;
    mocks.getUser.mockImplementation(() => {
      mocks.events.push("initial-read");
      return new Promise((resolve) => (resolveInitial = resolve));
    });

    FirebasePushControl();
    effectCleanup = effectCallback?.() ?? undefined;
    expect(mocks.events).toEqual(["listener", "initial-read"]);

    authListener?.("SIGNED_IN", { user: { id: "current-user" } });
    resolveInitial?.({ data: { user: { id: "stale-user" } }, error: null });
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.observeFirebasePushIdentity).toHaveBeenCalledWith("current-user");
    expect(mocks.observeFirebasePushIdentity).not.toHaveBeenCalledWith("stale-user");
    expect(mocks.hasFirebasePushDeviceToken).toHaveBeenCalledWith("current-user");
  });
});
