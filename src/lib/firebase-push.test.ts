import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteToken: vi.fn(),
  cleanupForeignPushSubscription: vi.fn(),
  readOwnedPushSubscription: vi.fn(),
  from: vi.fn(),
  getMessaging: vi.fn(),
  getToken: vi.fn(),
  getUser: vi.fn(),
  initFirebase: vi.fn(),
  isSupported: vi.fn(),
  upsertPushSubscriptionForCurrentUser: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}));
vi.mock("./firebase", () => ({ initFirebase: mocks.initFirebase }));
vi.mock("./firebase-push.functions", () => ({
  cleanupForeignPushSubscription: mocks.cleanupForeignPushSubscription,
  readOwnedPushSubscription: mocks.readOwnedPushSubscription,
  upsertPushSubscriptionForCurrentUser: mocks.upsertPushSubscriptionForCurrentUser,
}));
vi.mock("firebase/messaging", () => ({
  deleteToken: mocks.deleteToken,
  getMessaging: mocks.getMessaging,
  getToken: mocks.getToken,
  isSupported: mocks.isSupported,
}));

import {
  disableFirebaseNotifications,
  enableFirebaseNotifications,
  hasFirebasePushDeviceToken,
  observeFirebasePushIdentity,
} from "./firebase-push";

function createStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    clear: () => {
      values.clear();
    },
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

function deleteBuilder(result: { error: unknown }) {
  const filters: Array<[string, string]> = [];
  const terminal = {
    eq: vi.fn((column: string, value: string) => {
      filters.push([column, value]);
      return filters.length === 2 ? Promise.resolve(result) : terminal;
    }),
  };
  return {
    builder: { delete: vi.fn(() => terminal) },
    filters,
  };
}

function selectBuilder(result: { data: { token: string } | null; error: unknown }) {
  const filters: Array<[string, string]> = [];
  const terminal = {
    eq: vi.fn((column: string, value: string) => {
      filters.push([column, value]);
      return terminal;
    }),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return { builder: { select: vi.fn(() => terminal) }, filters };
}

const config = {
  apiKey: "web-key",
  appId: "1:123456:web:app",
  authDomain: "same-project.firebaseapp.com",
  measurementId: "G-TEST",
  messagingSenderId: "123456",
  projectId: "same-project",
  storageBucket: "same-project.appspot.com",
  vapidPublicKey: "vapid-public-key",
};

function prepareBrowser(storage: ReturnType<typeof createStorage>) {
  const self = {};
  const notification = { permission: "granted" };
  vi.stubGlobal("window", {
    Notification: notification,
    localStorage: storage,
    location: { origin: "https://app.test" },
    self,
    top: self,
  });
  vi.stubGlobal("Notification", notification);
  vi.stubGlobal("navigator", {
    serviceWorker: {
      register: vi.fn().mockResolvedValue({ scope: "https://app.test/firebase-push/" }),
    },
  });
  mocks.initFirebase.mockResolvedValue({ name: "pfm3d" });
  mocks.isSupported.mockResolvedValue(true);
  mocks.getMessaging.mockReturnValue({});
  mocks.getToken.mockResolvedValue("new-token");
  mocks.deleteToken.mockResolvedValue(true);
  mocks.cleanupForeignPushSubscription.mockResolvedValue({ ok: true });
  mocks.readOwnedPushSubscription.mockResolvedValue({ ok: true, owned: true });
  mocks.upsertPushSubscriptionForCurrentUser.mockResolvedValue({ ok: true });
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("Firebase push token lifecycle", () => {
  it("removes a rotated token only for the authenticated account before upserting the new token", async () => {
    const storage = createStorage({ "pfm3d:fcm-device-token:user-a": "old-token" });
    prepareBrowser(storage);
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-a" } } });

    mocks.getToken.mockResolvedValue("new-token");

    const result = await enableFirebaseNotifications(config);

    expect(result).toEqual({ enabled: true, message: "Notificações ativadas neste dispositivo." });
    expect(mocks.cleanupForeignPushSubscription).toHaveBeenCalledWith({
      data: { token: "old-token" },
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.upsertPushSubscriptionForCurrentUser).toHaveBeenCalledWith({
      data: { token: "new-token" },
    });
    expect(storage.getItem("pfm3d:fcm-device-token:user-a")).toBe("new-token");
  });

  it("rotates an unowned legacy token before associating the browser with another account", async () => {
    const storage = createStorage({ "pfm3d:fcm-device-token": "account-a-token" });
    prepareBrowser(storage);
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-b" } } });
    mocks.getToken.mockResolvedValueOnce("account-a-token").mockResolvedValueOnce("new-b-token");
    mocks.readOwnedPushSubscription.mockResolvedValueOnce({ ok: true, owned: false });

    const result = await enableFirebaseNotifications(config);

    expect(result).toEqual({ enabled: true, message: "Notificações ativadas neste dispositivo." });
    expect(mocks.deleteToken).toHaveBeenCalledTimes(1);
    expect(mocks.getToken).toHaveBeenCalledTimes(2);
    expect(mocks.readOwnedPushSubscription).toHaveBeenCalledWith({
      data: { token: "account-a-token" },
    });
    expect(mocks.cleanupForeignPushSubscription).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.upsertPushSubscriptionForCurrentUser).toHaveBeenCalledWith({
      data: { token: "new-b-token" },
    });
    expect(storage.getItem("pfm3d:fcm-device-token:user-b")).toBe("new-b-token");
    expect(storage.getItem("pfm3d:fcm-device-token")).toBeNull();
  });

  it("revokes the browser token without deleting a foreign cloud row", async () => {
    const storage = createStorage({ "pfm3d:fcm-device-token:user-a": "account-a-token" });
    prepareBrowser(storage);
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-b" } } });
    const result = await disableFirebaseNotifications();

    expect(result).toEqual({
      enabled: false,
      message: "Notificações desativadas neste dispositivo.",
    });
    expect(mocks.cleanupForeignPushSubscription).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.deleteToken).toHaveBeenCalledTimes(1);
    expect(storage.getItem("pfm3d:fcm-device-token:user-a")).toBe("account-a-token");
    expect(storage.getItem("pfm3d:fcm-pending-cloud-cleanup")).toContain("user-a");
  });

  it("does not touch a root service-worker registration returned for the dedicated scope", async () => {
    const storage = createStorage({ "pfm3d:fcm-device-token:user-a": "account-a-token" });
    prepareBrowser(storage);
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-a" } } });
    mocks.deleteToken.mockRejectedValueOnce(new Error("SDK unavailable"));
    const getSubscription = vi.fn().mockResolvedValue({ unsubscribe: vi.fn() });
    const unregister = vi.fn().mockResolvedValue(true);
    const getRegistration = vi.fn().mockResolvedValue({
      scope: "https://app.test/",
      pushManager: { getSubscription },
      unregister,
    });
    vi.stubGlobal("navigator", { serviceWorker: { getRegistration } });

    const result = await disableFirebaseNotifications({ retries: 0 });

    expect(result).toEqual({
      enabled: true,
      message: "Não foi possível revogar o token local neste dispositivo.",
    });
    expect(getRegistration).toHaveBeenCalledWith("/firebase-push/");
    expect(getSubscription).not.toHaveBeenCalled();
    expect(unregister).not.toHaveBeenCalled();
    expect(storage.getItem("pfm3d:fcm-device-token:user-a")).toBe("account-a-token");
  });

  it("does not pass a root registration to Firebase while enabling notifications", async () => {
    const storage = createStorage();
    prepareBrowser(storage);
    mocks.getUser.mockResolvedValue({ data: { user: { id: "root-scope-user" } } });
    const register = vi.fn().mockResolvedValue({ scope: "https://app.test/" });
    vi.stubGlobal("navigator", { serviceWorker: { register } });

    const result = await enableFirebaseNotifications(config);

    expect(result).toEqual({
      enabled: false,
      message: "Não foi possível validar o escopo do worker de notificações.",
    });
    expect(register).toHaveBeenCalledWith(expect.stringContaining("/firebase-messaging-sw.js?"), {
      scope: "/firebase-push/",
    });
    expect(mocks.getToken).not.toHaveBeenCalled();
    expect(mocks.upsertPushSubscriptionForCurrentUser).not.toHaveBeenCalled();
  });

  it("deletes only the current account's legacy token and revokes the browser token", async () => {
    const storage = createStorage({ "pfm3d:fcm-device-token": "legacy-token" });
    prepareBrowser(storage);
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-b" } } });

    const result = await disableFirebaseNotifications();

    expect(result).toEqual({
      enabled: false,
      message: "Notificações desativadas neste dispositivo.",
    });
    expect(mocks.readOwnedPushSubscription).toHaveBeenCalledWith({
      data: { token: "legacy-token" },
    });
    expect(mocks.cleanupForeignPushSubscription).toHaveBeenCalledWith({
      data: { token: "legacy-token" },
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.deleteToken).toHaveBeenCalledTimes(1);
    expect(storage.getItem("pfm3d:fcm-device-token")).toBeNull();
  });

  it("revokes an unowned legacy token without deleting another account's cloud row", async () => {
    const storage = createStorage({ "pfm3d:fcm-device-token": "account-a-token" });
    prepareBrowser(storage);
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-b" } } });
    mocks.readOwnedPushSubscription.mockResolvedValueOnce({ ok: true, owned: false });

    const result = await disableFirebaseNotifications();

    expect(result).toEqual({
      enabled: false,
      message: "Notificações desativadas neste dispositivo.",
    });
    expect(mocks.readOwnedPushSubscription).toHaveBeenCalledWith({
      data: { token: "account-a-token" },
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.cleanupForeignPushSubscription).not.toHaveBeenCalled();
    expect(mocks.deleteToken).toHaveBeenCalledTimes(1);
    expect(storage.getItem("pfm3d:fcm-device-token")).toBe("account-a-token");
  });

  it("retries cloud removal, then clears local state even when the remote row is unavailable", async () => {
    const storage = createStorage({ "pfm3d:fcm-device-token:user-a": "old-token" });
    prepareBrowser(storage);
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-a" } } });
    mocks.cleanupForeignPushSubscription
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });

    const result = await disableFirebaseNotifications({ retries: 1 });

    expect(result).toEqual({
      enabled: false,
      message: "Notificações desativadas neste dispositivo.",
    });
    expect(mocks.cleanupForeignPushSubscription).toHaveBeenCalledTimes(2);
    expect(mocks.cleanupForeignPushSubscription).toHaveBeenNthCalledWith(1, {
      data: { token: "old-token" },
    });
    expect(mocks.cleanupForeignPushSubscription).toHaveBeenNthCalledWith(2, {
      data: { token: "old-token" },
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.deleteToken).toHaveBeenCalledTimes(1);
    expect(mocks.deleteToken.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.cleanupForeignPushSubscription.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(storage.getItem("pfm3d:fcm-device-token:user-a")).toBeNull();
  });

  it("reports an account-scoped token to callers without leaking the token value", () => {
    const storage = createStorage({ "pfm3d:fcm-device-token:user-a": "account-a-token" });
    prepareBrowser(storage);

    expect(hasFirebasePushDeviceToken()).toBe(true);
  });

  it("preserves local state when the authenticated owner cannot be confirmed", async () => {
    const storage = createStorage({ "pfm3d:fcm-device-token:user-a": "account-a-token" });
    prepareBrowser(storage);
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("offline") });

    const result = await disableFirebaseNotifications();

    expect(result).toEqual({
      enabled: true,
      message: "Não foi possível confirmar a conta. Tente novamente.",
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.deleteToken).not.toHaveBeenCalled();
    expect(storage.getItem("pfm3d:fcm-device-token:user-a")).toBe("account-a-token");
  });

  it("fails closed and preserves a legacy token when remote ownership lookup fails", async () => {
    const storage = createStorage({ "pfm3d:fcm-device-token": "ambiguous-token" });
    prepareBrowser(storage);
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-a" } } });
    mocks.readOwnedPushSubscription.mockResolvedValue({ ok: false, owned: false });

    const result = await disableFirebaseNotifications();

    expect(result).toEqual({
      enabled: true,
      message: "Não foi possível confirmar a inscrição remota desta conta.",
    });
    expect(mocks.deleteToken).not.toHaveBeenCalled();
    expect(mocks.cleanupForeignPushSubscription).not.toHaveBeenCalled();
    expect(storage.getItem("pfm3d:fcm-device-token")).toBe("ambiguous-token");
  });

  it("fails closed when enabling cannot confirm the authenticated owner", async () => {
    const storage = createStorage();
    prepareBrowser(storage);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: new Error("offline"),
    });

    const result = await enableFirebaseNotifications(config);

    expect(result).toEqual({
      enabled: false,
      message: "Não foi possível confirmar a conta. Tente novamente.",
    });
    expect(mocks.initFirebase).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(storage.length).toBe(0);
  });

  it("revokes the browser token when the authenticated account changes", async () => {
    const storage = createStorage({ "pfm3d:fcm-device-token:user-a": "account-a-token" });
    prepareBrowser(storage);

    await observeFirebasePushIdentity("user-a");
    expect(mocks.deleteToken).not.toHaveBeenCalled();
    let releaseDeleteToken: ((revoked: boolean) => void) | undefined;
    mocks.deleteToken.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (releaseDeleteToken = resolve)),
    );
    let secondFinished = false;
    const firstChange = observeFirebasePushIdentity("user-b");
    const secondChange = observeFirebasePushIdentity("user-b").then(() => {
      secondFinished = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.deleteToken).toHaveBeenCalledTimes(1);
    expect(secondFinished).toBe(false);
    expect(storage.getItem("pfm3d:fcm-device-token:user-a")).toBe("account-a-token");
    releaseDeleteToken?.(true);
    await Promise.all([firstChange, secondChange]);

    expect(mocks.deleteToken).toHaveBeenCalledTimes(1);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.cleanupForeignPushSubscription).not.toHaveBeenCalled();
    expect(storage.getItem("pfm3d:fcm-device-token:user-a")).toBe("account-a-token");
    expect(storage.getItem("pfm3d:fcm-pending-cloud-cleanup")).toContain("user-a");
  });

  it("waits for deferred identity cleanup before enabling the next account", async () => {
    const storage = createStorage();
    prepareBrowser(storage);
    const notification = { permission: "denied" };
    const self = {};
    vi.stubGlobal("window", {
      Notification: notification,
      localStorage: storage,
      location: { origin: "https://app.test" },
      self,
      top: self,
    });
    vi.stubGlobal("Notification", notification);
    await observeFirebasePushIdentity("user-a");
    storage.setItem("pfm3d:fcm-device-token:user-a", "account-a-token");
    notification.permission = "granted";

    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-b" } }, error: null });
    let releaseDeleteToken: ((revoked: boolean) => void) | undefined;
    mocks.deleteToken.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (releaseDeleteToken = resolve)),
    );
    mocks.getToken.mockResolvedValue("account-b-token");
    const cleanup = observeFirebasePushIdentity("user-b");
    const enable = enableFirebaseNotifications(config);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.deleteToken).toHaveBeenCalledTimes(1);
    expect(mocks.upsertPushSubscriptionForCurrentUser).not.toHaveBeenCalled();
    expect(storage.getItem("pfm3d:fcm-device-token:user-a")).toBe("account-a-token");

    releaseDeleteToken?.(true);
    const [cleanupResult, result] = await Promise.all([cleanup, enable]);

    expect(cleanupResult).toBeUndefined();
    expect(result).toEqual({ enabled: true, message: "Notificações ativadas neste dispositivo." });
    expect(mocks.cleanupForeignPushSubscription).not.toHaveBeenCalled();
    expect(mocks.upsertPushSubscriptionForCurrentUser).toHaveBeenCalledWith({
      data: { token: "account-b-token" },
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.deleteToken.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.upsertPushSubscriptionForCurrentUser.mock.invocationCallOrder[0] ??
        Number.POSITIVE_INFINITY,
    );
    expect(storage.getItem("pfm3d:fcm-device-token:user-a")).toBe("account-a-token");
    expect(storage.getItem("pfm3d:fcm-pending-cloud-cleanup")).toContain("user-a");
    expect(storage.getItem("pfm3d:fcm-device-token:user-b")).toBe("account-b-token");
  });

  it("preserves the previous owner's pending cloud cleanup across an account switch", async () => {
    const storage = createStorage({ "pfm3d:fcm-device-token:owner-a": "owner-a-token" });
    prepareBrowser(storage);
    const notification = (window as Window & { Notification: { permission: string } }).Notification;
    notification.permission = "denied";
    await observeFirebasePushIdentity("owner-a");
    notification.permission = "granted";
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner-b" } }, error: null });

    await observeFirebasePushIdentity("owner-b");

    expect(mocks.cleanupForeignPushSubscription).not.toHaveBeenCalled();
    expect(storage.getItem("pfm3d:fcm-device-token:owner-a")).toBe("owner-a-token");
    expect(storage.getItem("pfm3d:fcm-pending-cloud-cleanup")).toContain("owner-a");
    expect(storage.getItem("pfm3d:fcm-pending-cloud-cleanup")).toContain("owner-a-token");

    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner-a" } }, error: null });
    mocks.cleanupForeignPushSubscription.mockResolvedValue({ ok: true });
    await observeFirebasePushIdentity("owner-a");

    expect(mocks.cleanupForeignPushSubscription).toHaveBeenCalledWith({
      data: { token: "owner-a-token" },
    });
    expect(storage.getItem("pfm3d:fcm-pending-cloud-cleanup")).toBeNull();
  });

  it("revokes browser token before returning on cloud failure and retries with preserved storage", async () => {
    const storage = createStorage();
    prepareBrowser(storage);
    const notification = (window as Window & { Notification: { permission: string } }).Notification;
    notification.permission = "denied";
    const userId = "remote-failure-user";
    await observeFirebasePushIdentity(userId);
    storage.setItem(`pfm3d:fcm-device-token:${userId}`, "owned-token");
    notification.permission = "granted";
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.cleanupForeignPushSubscription.mockResolvedValue({ ok: false });

    const result = await disableFirebaseNotifications({ retries: 0 });

    expect(result).toEqual({
      enabled: false,
      message: "Token local revogado; não foi possível remover a inscrição na nuvem.",
    });
    expect(mocks.cleanupForeignPushSubscription).toHaveBeenCalledWith({
      data: { token: "owned-token" },
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.deleteToken).toHaveBeenCalledTimes(1);
    expect(storage.getItem(`pfm3d:fcm-device-token:${userId}`)).toBe("owned-token");

    mocks.cleanupForeignPushSubscription.mockResolvedValueOnce({ ok: true });
    const retry = await disableFirebaseNotifications({ retries: 0 });

    expect(retry).toEqual({
      enabled: false,
      message: "Notificações desativadas neste dispositivo.",
    });
    expect(storage.getItem(`pfm3d:fcm-device-token:${userId}`)).toBeNull();
  });

  it("preserves the token after a cloud cleanup timeout for a later retry", async () => {
    const storage = createStorage();
    prepareBrowser(storage);
    const notification = (window as Window & { Notification: { permission: string } }).Notification;
    notification.permission = "denied";
    const userId = "cloud-timeout-user";
    await observeFirebasePushIdentity(userId);
    storage.setItem(`pfm3d:fcm-device-token:${userId}`, "timeout-token");
    notification.permission = "granted";
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.cleanupForeignPushSubscription.mockReturnValue(new Promise(() => undefined));

    const result = await disableFirebaseNotifications({ timeoutMs: 5, retries: 0 });

    expect(result).toEqual({
      enabled: false,
      message: "Token local revogado; não foi possível remover a inscrição na nuvem.",
    });
    expect(mocks.deleteToken).toHaveBeenCalledTimes(1);
    expect(mocks.cleanupForeignPushSubscription).toHaveBeenCalledWith({
      data: { token: "timeout-token" },
    });
    expect(mocks.deleteToken.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.cleanupForeignPushSubscription.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(storage.getItem(`pfm3d:fcm-device-token:${userId}`)).toBe("timeout-token");
  });

  it("retries owner-scoped pending cleanup after the browser storage is reloaded", async () => {
    const storage = createStorage();
    prepareBrowser(storage);
    const notification = (window as Window & { Notification: { permission: string } }).Notification;
    notification.permission = "denied";
    const userId = "reload-pending-user";
    await observeFirebasePushIdentity(userId);
    storage.setItem(`pfm3d:fcm-device-token:${userId}`, "reload-token");
    notification.permission = "granted";
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.cleanupForeignPushSubscription.mockResolvedValue({ ok: false });

    await disableFirebaseNotifications({ retries: 0 });

    const pending = storage.getItem("pfm3d:fcm-pending-cloud-cleanup");
    expect(pending).toContain(userId);
    const reloadedStorage = createStorage({
      [`pfm3d:fcm-device-token:${userId}`]: "reload-token",
      "pfm3d:fcm-pending-cloud-cleanup": pending ?? "[]",
    });
    prepareBrowser(reloadedStorage);
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });

    await observeFirebasePushIdentity(userId);

    expect(mocks.cleanupForeignPushSubscription).toHaveBeenCalledWith({
      data: { token: "reload-token" },
    });
    expect(reloadedStorage.getItem(`pfm3d:fcm-device-token:${userId}`)).toBeNull();
    expect(reloadedStorage.getItem("pfm3d:fcm-pending-cloud-cleanup")).toBeNull();
  });

  it("releases the push queue after a browser timeout without clearing the next identity", async () => {
    vi.useFakeTimers();
    const storage = createStorage();
    prepareBrowser(storage);
    const notification = (window as Window & { Notification: { permission: string } }).Notification;
    notification.permission = "denied";
    await observeFirebasePushIdentity("timeout-user-a");
    storage.setItem("pfm3d:fcm-device-token:timeout-user-a", "old-token");
    notification.permission = "granted";
    mocks.getUser
      .mockResolvedValueOnce({ data: { user: { id: "timeout-user-a" } } })
      .mockResolvedValue({ data: { user: { id: "timeout-user-b" } } });
    let releaseOldDelete: ((revoked: boolean) => void) | undefined;
    mocks.deleteToken.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (releaseOldDelete = resolve)),
    );
    mocks.deleteToken.mockResolvedValue(true);

    const oldCleanup = disableFirebaseNotifications({ timeoutMs: 5, retries: 0 });
    await vi.advanceTimersByTimeAsync(0);
    const nextIdentity = observeFirebasePushIdentity("timeout-user-b");
    const nextEnable = enableFirebaseNotifications(config);

    await vi.advanceTimersByTimeAsync(5);
    releaseOldDelete?.(true);
    const [, result] = await Promise.all([oldCleanup, nextEnable]);
    await nextIdentity;

    expect(result).toEqual({ enabled: true, message: "Notificações ativadas neste dispositivo." });
    expect(storage.getItem("pfm3d:fcm-device-token:timeout-user-a")).toBe("old-token");
    expect(storage.getItem("pfm3d:fcm-pending-cloud-cleanup")).toContain("timeout-user-a");
    expect(storage.getItem("pfm3d:fcm-device-token:timeout-user-b")).toBe("new-token");
  });

  it("compensates a late dedicated worker registration before the next account proceeds", async () => {
    vi.useFakeTimers();
    const storage = createStorage();
    prepareBrowser(storage);
    const notification = (window as Window & { Notification: { permission: string } }).Notification;
    notification.permission = "denied";
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "late-register-user-a" } },
      error: null,
    });
    await observeFirebasePushIdentity("late-register-user-a");
    notification.permission = "granted";
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "late-register-user-a" } },
      error: null,
    });

    let resolveRegistration: ((registration: ServiceWorkerRegistration) => void) | undefined;
    const subscription = { unsubscribe: vi.fn().mockResolvedValue(true) };
    const registrationUnregister = vi.fn().mockResolvedValue(true);
    const registration = {
      scope: "https://app.test/firebase-push/",
      pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) },
      unregister: registrationUnregister,
    } as unknown as ServiceWorkerRegistration;
    const nextRegistration = {
      scope: "https://app.test/firebase-push/",
      pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
      unregister: vi.fn().mockResolvedValue(true),
    } as unknown as ServiceWorkerRegistration;
    const register = vi.fn(
      () => new Promise<ServiceWorkerRegistration>((resolve) => (resolveRegistration = resolve)),
    );
    vi.stubGlobal("navigator", {
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue(null), register },
    });

    const oldEnable = enableFirebaseNotifications(config);
    for (let turn = 0; turn < 50 && register.mock.calls.length === 0; turn += 1) {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(mocks.getUser).toHaveBeenCalled();
    expect(mocks.initFirebase).toHaveBeenCalled();
    expect(register).toHaveBeenCalledTimes(1);
    register.mockResolvedValueOnce(nextRegistration);
    await vi.advanceTimersByTimeAsync(1000);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "late-register-user-b" } },
      error: null,
    });
    const nextIdentity = observeFirebasePushIdentity("late-register-user-b");
    const nextEnable = enableFirebaseNotifications(config);
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.getToken).not.toHaveBeenCalled();
    expect(mocks.upsertPushSubscriptionForCurrentUser).not.toHaveBeenCalled();

    resolveRegistration?.(registration);
    await expect(oldEnable).resolves.toEqual({
      enabled: false,
      message: "Não foi possível registrar o worker de notificações.",
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(registration.unregister).toHaveBeenCalledTimes(1);
    expect(registrationUnregister.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getToken.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    const nextResult = await nextEnable;
    await nextIdentity;

    expect(registrationUnregister).toHaveBeenCalledTimes(1);
    expect(mocks.getToken).toHaveBeenCalledTimes(1);
    expect(mocks.upsertPushSubscriptionForCurrentUser).toHaveBeenCalledWith({
      data: { token: "new-token" },
    });
    expect(nextResult).toEqual({
      enabled: true,
      message: "Notificações ativadas neste dispositivo.",
    });
  });

  it("does not let stale identity cleanup clear state before the new identity enables", async () => {
    const storage = createStorage();
    prepareBrowser(storage);
    const notification = (window as Window & { Notification: { permission: string } }).Notification;
    notification.permission = "denied";
    const firstUserId = "stale-cleanup-user-a";
    const nextUserId = "stale-cleanup-user-c";
    await observeFirebasePushIdentity(firstUserId);
    storage.setItem(`pfm3d:fcm-device-token:${firstUserId}`, "first-token");
    notification.permission = "granted";

    let releaseOldCleanup: ((revoked: boolean) => void) | undefined;
    mocks.deleteToken.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (releaseOldCleanup = resolve)),
    );
    const staleCleanup = observeFirebasePushIdentity("stale-cleanup-user-b");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.deleteToken).toHaveBeenCalledTimes(1);

    const currentCleanup = observeFirebasePushIdentity(nextUserId);
    mocks.getUser.mockResolvedValue({ data: { user: { id: nextUserId } }, error: null });
    mocks.getToken.mockResolvedValue("next-token");
    const enabling = enableFirebaseNotifications(config);

    releaseOldCleanup?.(true);
    await staleCleanup;
    expect(storage.getItem(`pfm3d:fcm-device-token:${firstUserId}`)).toBe("first-token");

    const [, result] = await Promise.all([currentCleanup, enabling]);

    expect(result).toEqual({ enabled: true, message: "Notificações ativadas neste dispositivo." });
    expect(mocks.cleanupForeignPushSubscription).not.toHaveBeenCalled();
    expect(mocks.upsertPushSubscriptionForCurrentUser).toHaveBeenCalledWith({
      data: { token: "next-token" },
    });
    expect(storage.getItem(`pfm3d:fcm-device-token:${firstUserId}`)).toBe("first-token");
    expect(storage.getItem("pfm3d:fcm-pending-cloud-cleanup")).toContain(firstUserId);
    expect(storage.getItem(`pfm3d:fcm-device-token:${nextUserId}`)).toBe("next-token");
  });

  it("unsubscribes the dedicated service worker when Firebase token deletion fails", async () => {
    const userId = "logout-fallback-user";
    const storage = createStorage();
    prepareBrowser(storage);
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    const notification = (window as Window & { Notification: { permission: string } }).Notification;
    notification.permission = "denied";
    await observeFirebasePushIdentity(userId);
    storage.setItem(`pfm3d:fcm-device-token:${userId}`, "owned-token");
    notification.permission = "granted";
    mocks.deleteToken.mockClear();
    mocks.deleteToken.mockRejectedValueOnce(new Error("network unavailable"));

    const subscription = { unsubscribe: vi.fn().mockResolvedValue(true) };
    const registration = {
      scope: "https://app.test/firebase-push/",
      pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) },
      unregister: vi.fn().mockResolvedValue(true),
    };
    const getRegistration = vi.fn().mockResolvedValue(registration);
    vi.stubGlobal("navigator", { serviceWorker: { getRegistration } });

    const result = await disableFirebaseNotifications({ retries: 0 });

    expect(result).toEqual({
      enabled: false,
      message: "Notificações desativadas neste dispositivo.",
    });
    expect(getRegistration).toHaveBeenCalledWith("/firebase-push/");
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(registration.unregister).toHaveBeenCalledTimes(1);
    expect(storage.getItem(`pfm3d:fcm-device-token:${userId}`)).toBeNull();
  });

  it("rotates a token after remote ownership conflict even when local storage is empty", async () => {
    const storage = createStorage();
    prepareBrowser(storage);
    const userId = "cross-account-user";
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    await observeFirebasePushIdentity(userId);
    mocks.deleteToken.mockClear();
    mocks.cleanupForeignPushSubscription.mockClear();
    mocks.upsertPushSubscriptionForCurrentUser
      .mockResolvedValueOnce({ ok: false, reason: "token_owned_by_another_account" })
      .mockResolvedValueOnce({ ok: true });
    mocks.getToken.mockResolvedValueOnce("foreign-token").mockResolvedValueOnce("rotated-token");

    const result = await enableFirebaseNotifications(config);

    expect(result).toEqual({ enabled: true, message: "Notificações ativadas neste dispositivo." });
    expect(mocks.cleanupForeignPushSubscription).not.toHaveBeenCalled();
    expect(mocks.deleteToken).toHaveBeenCalledTimes(1);
    expect(mocks.upsertPushSubscriptionForCurrentUser).toHaveBeenNthCalledWith(1, {
      data: { token: "foreign-token" },
    });
    expect(mocks.upsertPushSubscriptionForCurrentUser).toHaveBeenNthCalledWith(2, {
      data: { token: "rotated-token" },
    });
    expect(storage.getItem(`pfm3d:fcm-device-token:${userId}`)).toBe("rotated-token");
  });

  it("does not continue a permission callback after the identity generation changes", async () => {
    const storage = createStorage();
    prepareBrowser(storage);
    const notification = (
      window as Window & {
        Notification: {
          permission: string;
          requestPermission?: () => Promise<NotificationPermission>;
        };
      }
    ).Notification;
    notification.permission = "denied";
    await observeFirebasePushIdentity("prompt-owner");
    let resolvePermission: ((permission: NotificationPermission) => void) | undefined;
    notification.requestPermission = () =>
      new Promise<NotificationPermission>((resolve) => {
        resolvePermission = resolve;
      });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "prompt-owner" } }, error: null });

    const enabling = enableFirebaseNotifications(config);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const identity = observeFirebasePushIdentity("prompt-next-owner");
    resolvePermission?.("granted");

    await expect(enabling).resolves.toEqual({
      enabled: false,
      message: "A conta mudou; tente novamente.",
    });
    await identity;
    expect(mocks.initFirebase).not.toHaveBeenCalled();
    expect(mocks.getToken).not.toHaveBeenCalled();
    expect(mocks.upsertPushSubscriptionForCurrentUser).not.toHaveBeenCalled();
  });

  it("handles a missing notification permission capability without a rejection", async () => {
    const storage = createStorage();
    prepareBrowser(storage);
    const notification = (window as Window & { Notification: { permission: string } }).Notification;
    notification.permission = "denied";
    await observeFirebasePushIdentity("unsupported-notification-owner");
    delete (notification as { requestPermission?: unknown }).requestPermission;

    await expect(enableFirebaseNotifications(config)).resolves.toEqual({
      enabled: false,
      message: "Notificações não suportadas neste navegador.",
    });
    expect(mocks.initFirebase).not.toHaveBeenCalled();
  });

  it("does not claim cloud cleanup success when pending storage cannot be written", async () => {
    const storage = createStorage({
      "pfm3d:fcm-device-token:storage-failure-user": "storage-token",
    });
    prepareBrowser(storage);
    const userId = "storage-failure-user";
    await observeFirebasePushIdentity(userId);
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    const originalSetItem = storage.setItem;
    storage.setItem = (key: string, value: string) => {
      if (key === "pfm3d:fcm-pending-cloud-cleanup") throw new Error("quota");
      originalSetItem(key, value);
    };

    const result = await disableFirebaseNotifications({ retries: 0 });

    expect(result.enabled).toBe(true);
    expect(mocks.cleanupForeignPushSubscription).not.toHaveBeenCalled();
    expect(storage.getItem(`pfm3d:fcm-device-token:${userId}`)).toBe("storage-token");
  });

  it("does not drop new pending owners when the pending list is at capacity", async () => {
    const full = Array.from({ length: 32 }, (_, index) => ({
      userId: `old-${index}`,
      token: `token-${index}`,
      browserRevoked: true,
    }));
    const storage = createStorage({
      "pfm3d:fcm-device-token:new-owner": "new-owner-token",
      "pfm3d:fcm-pending-cloud-cleanup": JSON.stringify(full),
    });
    prepareBrowser(storage);
    const notification = (window as Window & { Notification: { permission: string } }).Notification;
    notification.permission = "denied";
    await observeFirebasePushIdentity("new-owner");
    notification.permission = "granted";
    mocks.getUser.mockResolvedValue({ data: { user: { id: "new-owner" } }, error: null });

    const result = await disableFirebaseNotifications({ retries: 0 });

    expect(result.enabled).toBe(true);
    expect(mocks.cleanupForeignPushSubscription).not.toHaveBeenCalled();
    expect(storage.getItem("pfm3d:fcm-device-token:new-owner")).toBe("new-owner-token");
  });

  it("treats malformed pending cleanup JSON as unreadable and preserves token ownership", async () => {
    const userId = "malformed-pending-user";
    const storage = createStorage({
      [`pfm3d:fcm-device-token:${userId}`]: "malformed-token",
      "pfm3d:fcm-pending-cloud-cleanup": "{broken",
    });
    prepareBrowser(storage);
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });

    const result = await disableFirebaseNotifications({ retries: 0 });

    expect(result.enabled).toBe(true);
    expect(mocks.cleanupForeignPushSubscription).not.toHaveBeenCalled();
    expect(storage.getItem(`pfm3d:fcm-device-token:${userId}`)).toBe("malformed-token");
    expect(storage.getItem("pfm3d:fcm-pending-cloud-cleanup")).toBe("{broken");
  });

  it("requests permission synchronously before a queued enable drains", async () => {
    const storage = createStorage();
    prepareBrowser(storage);
    const notification = (
      window as Window & {
        Notification: {
          permission: string;
          requestPermission?: () => Promise<NotificationPermission>;
        };
      }
    ).Notification;
    notification.permission = "denied";
    const requestPermission = vi.fn(() => Promise.resolve("granted" as NotificationPermission));
    notification.requestPermission = requestPermission;
    mocks.getUser.mockResolvedValue({ data: { user: { id: "gesture-owner" } }, error: null });
    let release!: () => void;
    const blocker = observeFirebasePushIdentity("gesture-owner");
    // Hold the queue in a browser revocation while enable is invoked.
    const deferred = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = observeFirebasePushIdentity("gesture-other");
    await Promise.resolve();
    const enabling = enableFirebaseNotifications(config);
    expect(requestPermission).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([blocker, queued, enabling]);
  });
});
