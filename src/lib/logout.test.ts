import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  disableFirebaseNotifications: vi.fn(),
  getUser: vi.fn(),
  hasFirebasePushDeviceToken: vi.fn(),
  revokeFirebasePushBrowser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
      signOut: mocks.signOut,
    },
  },
}));
vi.mock("./firebase-push", () => ({
  disableFirebaseNotifications: mocks.disableFirebaseNotifications,
  hasFirebasePushDeviceToken: mocks.hasFirebasePushDeviceToken,
  revokeFirebasePushBrowser: mocks.revokeFirebasePushBrowser,
}));

import { signOutAndCleanDevice } from "./logout";

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("signOutAndCleanDevice", () => {
  it("signs out when only cloud cleanup exceeds its deadline after browser revocation", async () => {
    vi.useFakeTimers();
    mocks.revokeFirebasePushBrowser.mockResolvedValue(true);
    mocks.disableFirebaseNotifications.mockReturnValue(new Promise(() => undefined));
    mocks.signOut.mockResolvedValue({ error: null });

    const logout = signOutAndCleanDevice();
    await vi.advanceTimersByTimeAsync(2000);
    const result = await logout;

    expect(mocks.revokeFirebasePushBrowser).toHaveBeenCalledTimes(1);
    expect(mocks.disableFirebaseNotifications).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ error: null });
  });

  it("continues logout when only cloud cleanup failed after browser revocation", async () => {
    mocks.disableFirebaseNotifications.mockResolvedValue({
      enabled: false,
      message: "Token local revogado; não foi possível remover a inscrição na nuvem.",
    });
    mocks.signOut.mockResolvedValue({ error: null });

    const result = await signOutAndCleanDevice();

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ error: null });
  });

  it("returns the push error without signing out when browser revocation is unconfirmed", async () => {
    mocks.revokeFirebasePushBrowser.mockResolvedValue(false);
    mocks.disableFirebaseNotifications.mockResolvedValue({
      enabled: true,
      message: "Não foi possível revogar o token local neste dispositivo.",
    });

    const result = await signOutAndCleanDevice();

    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.disableFirebaseNotifications).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      reason: "push_revocation_failed",
      error: expect.objectContaining({
        message: "Não foi possível revogar o token local neste dispositivo.",
      }),
    });
  });
});
