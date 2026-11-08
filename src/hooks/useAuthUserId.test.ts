import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  observeFirebasePushIdentity: vi.fn(),
  onAuthStateChange: vi.fn(),
  reportSilent: vi.fn(),
  setUserId: vi.fn(),
  calls: [] as string[],
  useEffect: vi.fn(),
  useState: vi.fn(),
}));

vi.mock("react", () => ({
  useEffect: mocks.useEffect,
  useState: mocks.useState,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  },
}));
vi.mock("@/lib/firebase-push", () => ({
  observeFirebasePushIdentity: mocks.observeFirebasePushIdentity,
}));
vi.mock("@/lib/silent-errors", () => ({ reportSilent: mocks.reportSilent }));

import { useAuthUserId } from "./useAuthUserId";

let effectCleanup: (() => void) | undefined;

beforeEach(() => {
  mocks.calls = [];
  mocks.useEffect.mockImplementation((effect: () => void | (() => void)) => {
    effectCleanup = effect() ?? undefined;
  });
  mocks.useState.mockReturnValue([undefined, mocks.setUserId]);
  mocks.onAuthStateChange.mockImplementation(() => {
    mocks.calls.push("listener");
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  mocks.getSession.mockImplementation(async () => {
    mocks.calls.push("initial-read");
    return { data: { session: { user: { id: "initial-user" } } } };
  });
  mocks.observeFirebasePushIdentity.mockResolvedValue(undefined);
});

afterEach(() => {
  effectCleanup?.();
  effectCleanup = undefined;
  vi.clearAllMocks();
});

describe("useAuthUserId auth ordering", () => {
  it("registers auth listeners before reading the initial session and observes that identity", async () => {
    useAuthUserId();
    await Promise.resolve();
    await Promise.resolve();
    await vi.dynamicImportSettled();

    expect(mocks.calls).toEqual(["listener", "initial-read"]);
    expect(mocks.setUserId).toHaveBeenCalledWith("initial-user");
    expect(mocks.observeFirebasePushIdentity).toHaveBeenCalledWith("initial-user");
  });
});
