import { supabase } from "@/integrations/supabase/client";
import { getFirebaseWebConfig } from "./firebase-config.functions";
import { initFirebase } from "./firebase";

const LEGACY_DEVICE_TOKEN_KEY = "pfm3d:fcm-device-token";
const DEVICE_TOKEN_KEY_PREFIX = `${LEGACY_DEVICE_TOKEN_KEY}:`;
const PENDING_CLOUD_CLEANUP_KEY = "pfm3d:fcm-pending-cloud-cleanup";
const MAX_PENDING_CLOUD_CLEANUPS = 32;
const DEFAULT_CLEANUP_TIMEOUT_MS = 800;
const DEFAULT_CLEANUP_RETRIES = 1;
const DEFAULT_BROWSER_OPERATION_TIMEOUT_MS = 1000;

type StoredTokenStorage = Pick<Storage, "getItem" | "removeItem" | "setItem"> &
  Partial<Pick<Storage, "key" | "length">>;

type PendingCloudCleanup = {
  userId: string;
  token: string;
  browserRevoked: boolean;
};

type StoredTokenRecord = { userId: string; token: string };

type PendingCloudCleanupStorageState =
  | { status: "readable"; records: PendingCloudCleanup[] }
  | { status: "full"; records: PendingCloudCleanup[] }
  | { status: "unreadable"; reason: "storage_unavailable" | "malformed" | "read_failed" };

export type PushResult = { enabled: boolean; message: string };

type PushSubscriptionUpsertResult =
  { ok: true } | { ok: false; reason: "token_owned_by_another_account" | "database_error" };

type LegacyTokenLookup =
  | { status: "absent" }
  | { status: "owned"; token: string }
  | { status: "not_owned" }
  | { status: "unknown" };

export interface DisableFirebaseNotificationsOptions {
  /** Bound each idempotent cloud cleanup attempt so logout cannot hang. */
  timeoutMs?: number;
  /** Number of retries after the first cleanup attempt. */
  retries?: number;
  /** The caller already confirmed browser revocation in a dedicated phase. */
  skipBrowserRevocation?: boolean;
}

function scopedDeviceTokenKey(userId: string): string {
  return `${DEVICE_TOKEN_KEY_PREFIX}${encodeURIComponent(userId)}`;
}

function storage(): StoredTokenStorage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readStoredToken(userId: string | null): string | null {
  const localStorage = storage();
  if (!localStorage) return null;
  try {
    return userId
      ? localStorage.getItem(scopedDeviceTokenKey(userId))
      : localStorage.getItem(LEGACY_DEVICE_TOKEN_KEY);
  } catch {
    return null;
  }
}

function readScopedStoredTokenRecords(): StoredTokenRecord[] {
  const localStorage = storage();
  if (
    !localStorage ||
    typeof localStorage.length !== "number" ||
    typeof localStorage.key !== "function"
  ) {
    return [];
  }
  const records: StoredTokenRecord[] = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(DEVICE_TOKEN_KEY_PREFIX)) continue;
      const token = localStorage.getItem(key);
      if (!token) continue;
      try {
        const userId = decodeURIComponent(key.slice(DEVICE_TOKEN_KEY_PREFIX.length));
        if (userId) records.push({ userId, token });
      } catch {
        // Ignore malformed keys; they cannot be safely owner-scoped.
      }
    }
  } catch {
    return [];
  }
  return records;
}

function readPendingCloudCleanupState(): PendingCloudCleanupStorageState {
  const localStorage = storage();
  if (!localStorage) return { status: "unreadable", reason: "storage_unavailable" };
  try {
    const raw = localStorage.getItem(PENDING_CLOUD_CLEANUP_KEY);
    if (!raw) return { status: "readable", records: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { status: "unreadable", reason: "malformed" };
    const records: PendingCloudCleanup[] = [];
    for (const entry of parsed) {
      if (
        typeof entry !== "object" ||
        entry === null ||
        typeof (entry as { userId?: unknown }).userId !== "string" ||
        typeof (entry as { token?: unknown }).token !== "string" ||
        (entry as { userId: string }).userId.length === 0 ||
        (entry as { token: string }).token.length === 0 ||
        ("browserRevoked" in entry &&
          typeof (entry as { browserRevoked?: unknown }).browserRevoked !== "boolean")
      ) {
        return { status: "unreadable", reason: "malformed" };
      }
      records.push({
        userId: (entry as { userId: string }).userId,
        token: (entry as { token: string }).token,
        browserRevoked: (entry as { browserRevoked?: boolean }).browserRevoked === true,
      });
    }
    return records.length >= MAX_PENDING_CLOUD_CLEANUPS
      ? { status: "full", records }
      : { status: "readable", records };
  } catch {
    return { status: "unreadable", reason: "read_failed" };
  }
}

function writePendingCloudCleanupRecords(records: PendingCloudCleanup[]): boolean {
  const localStorage = storage();
  if (!localStorage || records.length > MAX_PENDING_CLOUD_CLEANUPS) return false;
  try {
    if (records.length === 0) localStorage.removeItem(PENDING_CLOUD_CLEANUP_KEY);
    else localStorage.setItem(PENDING_CLOUD_CLEANUP_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

function rememberPendingCloudCleanup(
  userId: string,
  token: string,
  browserRevoked: boolean,
): boolean {
  const state = readPendingCloudCleanupState();
  if (state.status === "unreadable") return false;
  const records = state.records;
  const existing = records.find((entry) => entry.userId === userId && entry.token === token);
  if (existing) existing.browserRevoked ||= browserRevoked;
  else if (records.length >= MAX_PENDING_CLOUD_CLEANUPS) return false;
  else records.push({ userId, token, browserRevoked });
  return writePendingCloudCleanupRecords(records);
}

function removePendingCloudCleanup(userId: string, token: string): boolean {
  const state = readPendingCloudCleanupState();
  if (state.status === "unreadable") return false;
  const records = state.records.filter((entry) => entry.userId !== userId || entry.token !== token);
  return writePendingCloudCleanupRecords(records);
}

function pendingCloudCleanupForOwner(userId: string): PendingCloudCleanup[] {
  const state = readPendingCloudCleanupState();
  return state.status === "unreadable"
    ? []
    : state.records.filter((entry) => entry.userId === userId);
}

function hasPendingCloudCleanup(): boolean {
  const state = readPendingCloudCleanupState();
  return state.status === "unreadable" || state.records.length > 0;
}

function pendingCloudCleanupStorageReadable(): boolean {
  return readPendingCloudCleanupState().status !== "unreadable";
}

function markForeignStoredTokensPending(userId: string, browserRevoked: boolean): boolean {
  let stored = true;
  for (const record of readScopedStoredTokenRecords()) {
    if (record.userId !== userId) {
      if (!rememberPendingCloudCleanup(record.userId, record.token, browserRevoked)) stored = false;
    }
  }
  return stored;
}

function foreignStoredTokensBrowserRevoked(userId: string): boolean {
  const state = readPendingCloudCleanupState();
  if (state.status === "unreadable") return false;
  const pending = state.records;
  const foreign = readScopedStoredTokenRecords().filter((record) => record.userId !== userId);
  return (
    foreign.length > 0 &&
    foreign.every((record) =>
      pending.some(
        (entry) =>
          entry.userId === record.userId && entry.token === record.token && entry.browserRevoked,
      ),
    )
  );
}

function readLegacyStoredToken(): string | null {
  const localStorage = storage();
  if (!localStorage) return null;
  try {
    return localStorage.getItem(LEGACY_DEVICE_TOKEN_KEY);
  } catch {
    return null;
  }
}

function hasScopedStoredToken(): boolean {
  const localStorage = storage();
  if (!localStorage) return false;
  try {
    if (localStorage.getItem(LEGACY_DEVICE_TOKEN_KEY)) return true;
    if (typeof localStorage.length !== "number" || typeof localStorage.key !== "function") {
      return false;
    }
    for (let index = 0; index < localStorage.length; index += 1) {
      if (localStorage.key(index)?.startsWith(DEVICE_TOKEN_KEY_PREFIX)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

function hasForeignScopedToken(userId: string | null): boolean {
  const localStorage = storage();
  if (
    !localStorage ||
    typeof localStorage.length !== "number" ||
    typeof localStorage.key !== "function"
  ) {
    return false;
  }
  try {
    const currentKey = userId ? scopedDeviceTokenKey(userId) : null;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(DEVICE_TOKEN_KEY_PREFIX) && key !== currentKey) return true;
    }
  } catch {
    return false;
  }
  return false;
}

function readForeignStoredTokens(userId: string | null): string[] {
  const localStorage = storage();
  if (!localStorage) return [];
  const tokens = new Set<string>();
  try {
    const legacyToken = localStorage.getItem(LEGACY_DEVICE_TOKEN_KEY);
    if (legacyToken) tokens.add(legacyToken);
    if (typeof localStorage.length !== "number" || typeof localStorage.key !== "function")
      return [...tokens];
    const currentKey = userId ? scopedDeviceTokenKey(userId) : null;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(DEVICE_TOKEN_KEY_PREFIX) || key === currentKey) continue;
      const token = localStorage.getItem(key);
      if (token) tokens.add(token);
    }
  } catch {
    // A later owner-authenticated attempt can retry when storage is available.
  }
  return [...tokens];
}

function hasForeignStoredToken(userId: string, token: string): boolean {
  const localStorage = storage();
  if (!localStorage) return false;
  try {
    if (localStorage.getItem(LEGACY_DEVICE_TOKEN_KEY) === token) return true;
    if (typeof localStorage.length !== "number" || typeof localStorage.key !== "function") {
      return false;
    }
    const currentKey = scopedDeviceTokenKey(userId);
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (
        key?.startsWith(DEVICE_TOKEN_KEY_PREFIX) &&
        key !== currentKey &&
        localStorage.getItem(key) === token
      ) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function clearAllStoredTokens(): void {
  const localStorage = storage();
  if (!localStorage) return;
  try {
    const keys = [LEGACY_DEVICE_TOKEN_KEY];
    if (typeof localStorage.length === "number" && typeof localStorage.key === "function") {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(DEVICE_TOKEN_KEY_PREFIX)) keys.push(key);
      }
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable; browser-token revocation still proceeds.
  }
}

function clearStoredToken(userId: string | null, token?: string): boolean {
  const localStorage = storage();
  if (!localStorage) return false;
  try {
    if (userId) localStorage.removeItem(scopedDeviceTokenKey(userId));
    if (token === undefined || localStorage.getItem(LEGACY_DEVICE_TOKEN_KEY) === token) {
      localStorage.removeItem(LEGACY_DEVICE_TOKEN_KEY);
    }
    if (userId && localStorage.getItem(scopedDeviceTokenKey(userId)) !== null) return false;
    if (token !== undefined && localStorage.getItem(LEGACY_DEVICE_TOKEN_KEY) === token)
      return false;
    return true;
  } catch {
    // localStorage can be unavailable in private browsing or after storage eviction.
    return false;
  }
}

function rememberStoredToken(userId: string, token: string): boolean {
  const localStorage = storage();
  if (!localStorage) return false;
  try {
    localStorage.setItem(scopedDeviceTokenKey(userId), token);
    // A legacy unscoped token is only migrated after the current account owns the row.
    localStorage.removeItem(LEGACY_DEVICE_TOKEN_KEY);
    return true;
  } catch {
    return false;
  }
}

async function currentUserId(): Promise<string | null | undefined> {
  try {
    const { data, error } = await withTimeout(supabase.auth.getUser(), DEFAULT_CLEANUP_TIMEOUT_MS);
    if (error) return undefined;
    return data.user?.id ?? null;
  } catch {
    return undefined;
  }
}

function withTimeout<T>(operation: PromiseLike<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("FCM operation timed out"));
    }, timeoutMs);

    Promise.resolve(operation).then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const LATE_SIDE_EFFECT_BARRIER_TIMEOUT_MS = DEFAULT_BROWSER_OPERATION_TIMEOUT_MS;

class BrowserSideEffectTimeoutError extends Error {
  constructor() {
    super("FCM browser side effect timed out");
    this.name = "BrowserSideEffectTimeoutError";
  }
}

function isBrowserSideEffectTimeout(error: unknown): boolean {
  return error instanceof BrowserSideEffectTimeoutError;
}

let lateSideEffectBarrier: Promise<void> | undefined;

function addLateSideEffectBarrier(completion: PromiseLike<void>): void {
  const previous = lateSideEffectBarrier ?? Promise.resolve();
  const barrier = Promise.all([previous, Promise.resolve(completion)]).then(() => undefined);
  lateSideEffectBarrier = barrier;
  void barrier.then(
    () => {
      if (lateSideEffectBarrier === barrier) lateSideEffectBarrier = undefined;
    },
    () => {
      if (lateSideEffectBarrier === barrier) lateSideEffectBarrier = undefined;
    },
  );
}

function withBrowserSideEffectTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs: number,
  compensateLateResolution?: (value: T) => Promise<void>,
): Promise<T> {
  const raw = Promise.resolve(operation);
  let timedOut = false;
  let settled = false;
  const lateCompletion = raw.then(
    (value) => {
      if (!timedOut) return;
      return Promise.resolve(compensateLateResolution?.(value)).catch(() => undefined);
    },
    () => undefined,
  );

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      addLateSideEffectBarrier(lateCompletion);
      settled = true;
      reject(new BrowserSideEffectTimeoutError());
    }, timeoutMs);
    raw.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function waitForLateSideEffectBarrier(): Promise<boolean> {
  const barrier = lateSideEffectBarrier;
  if (!barrier) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      barrier.then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), LATE_SIDE_EFFECT_BARRIER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function expectedPushRegistrationScope(): string | null {
  try {
    if (typeof window === "undefined" || typeof window.location?.origin !== "string") return null;
    return new URL("/firebase-push/", window.location.origin).href;
  } catch {
    return null;
  }
}

async function cleanupDedicatedPushRegistration(
  registration: ServiceWorkerRegistration,
): Promise<void> {
  if (registration.scope !== expectedPushRegistrationScope()) return;
  try {
    const subscription = await withTimeout(
      registration.pushManager.getSubscription(),
      DEFAULT_BROWSER_OPERATION_TIMEOUT_MS,
    );
    if (subscription) {
      await withBrowserSideEffectTimeout(
        subscription.unsubscribe(),
        DEFAULT_BROWSER_OPERATION_TIMEOUT_MS,
      );
    }
  } catch {
    // The dedicated registration remains protected by the late-side-effect barrier.
  }
  try {
    await withBrowserSideEffectTimeout(
      registration.unregister(),
      DEFAULT_BROWSER_OPERATION_TIMEOUT_MS,
    );
  } catch {
    // A late cleanup failure keeps the original source token/pending state intact.
  }
}

async function removeCloudToken(
  userId: string,
  token: string,
  options: DisableFirebaseNotificationsOptions = {},
  ownerCheck?: () => Promise<boolean>,
): Promise<boolean> {
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_CLEANUP_TIMEOUT_MS);
  const retries = Math.max(0, Math.floor(options.retries ?? DEFAULT_CLEANUP_RETRIES));

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (ownerCheck && !(await ownerCheck())) return false;
    try {
      const { cleanupForeignPushSubscription } = await withTimeout(
        import("./firebase-push.functions"),
        timeoutMs,
      );
      const result = await withTimeout(
        cleanupForeignPushSubscription({ data: { token } }),
        timeoutMs,
      );
      if (result.ok) return true;
    } catch {
      // Deletion is idempotent; a bounded retry handles transient auth/network failures.
    }
  }
  return false;
}

async function revokeDedicatedPushRegistration(
  ownerCheck?: () => boolean | Promise<boolean>,
  timeoutMs = DEFAULT_BROWSER_OPERATION_TIMEOUT_MS,
  allowAbsent = true,
): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return true;
  try {
    if (ownerCheck && !(await ownerCheck())) return false;
    const registration = await withTimeout(
      navigator.serviceWorker.getRegistration("/firebase-push/"),
      timeoutMs,
    );
    if (ownerCheck && !(await ownerCheck())) return false;
    if (!registration) return allowAbsent;

    if (registration.scope !== expectedPushRegistrationScope()) return false;

    const subscription = await withTimeout(registration.pushManager.getSubscription(), timeoutMs);
    if (ownerCheck && !(await ownerCheck())) return false;
    const unsubscribed = subscription
      ? await withBrowserSideEffectTimeout(subscription.unsubscribe(), timeoutMs)
      : true;
    if (!unsubscribed) return false;
    // Unsubscription is the safety boundary. A generation change while it is
    // in flight must not trigger a late unregister side effect, but the
    // successful browser revocation can still be shared with the next owner.
    if (ownerCheck && !(await ownerCheck())) return true;
    try {
      await withBrowserSideEffectTimeout(registration.unregister(), timeoutMs);
    } catch {
      // A successfully removed PushSubscription cannot deliver future messages.
    }
    return true;
  } catch {
    return false;
  }
}

let browserRevocationInFlight: Promise<boolean> | undefined;

async function revokeBrowserToken(
  ownerCheck?: () => boolean | Promise<boolean>,
  timeoutMs = DEFAULT_BROWSER_OPERATION_TIMEOUT_MS,
): Promise<boolean> {
  if (ownerCheck && !(await ownerCheck())) return false;
  if (browserRevocationInFlight) return browserRevocationInFlight;

  const operation = (async (): Promise<boolean> => {
    try {
      if (ownerCheck && !(await ownerCheck())) return false;
      const app = await withTimeout(initFirebase(), timeoutMs).catch(() => undefined);
      if (app === undefined) return revokeDedicatedPushRegistration(ownerCheck, timeoutMs, false);
      if (!app) return revokeDedicatedPushRegistration(ownerCheck, timeoutMs);
      const { deleteToken, getMessaging, isSupported } = await withTimeout(
        import("firebase/messaging"),
        timeoutMs,
      );
      if (ownerCheck && !(await ownerCheck())) return false;
      if (!(await withTimeout(isSupported(), timeoutMs)))
        return revokeDedicatedPushRegistration(ownerCheck, timeoutMs);
      if (ownerCheck && !(await ownerCheck())) return false;
      const revoked = await withBrowserSideEffectTimeout(deleteToken(getMessaging(app)), timeoutMs);
      if (revoked !== false) return true;
      if (ownerCheck && !(await ownerCheck())) return false;
      return revokeDedicatedPushRegistration(ownerCheck, timeoutMs, false);
    } catch (error) {
      // If the SDK/network cannot revoke, try the browser's push subscription
      // directly before logout or account switching proceeds. A stale owner
      // must not start that fallback after a generation change.
      if (isBrowserSideEffectTimeout(error)) return false;
      if (ownerCheck && !(await ownerCheck())) return false;
      return revokeDedicatedPushRegistration(ownerCheck, timeoutMs, false);
    }
  })();
  browserRevocationInFlight = operation;
  try {
    return await operation;
  } finally {
    if (browserRevocationInFlight === operation) browserRevocationInFlight = undefined;
  }
}

async function readLegacyTokenForUser(
  userId: string,
  ownerCheck?: () => Promise<boolean>,
): Promise<LegacyTokenLookup> {
  const token = readLegacyStoredToken();
  if (!token) return { status: "absent" };
  try {
    if (ownerCheck && !(await ownerCheck())) return { status: "unknown" };
    const { readOwnedPushSubscription } = await withTimeout(
      import("./firebase-push.functions"),
      DEFAULT_CLEANUP_TIMEOUT_MS,
    );
    const result = await withTimeout(
      readOwnedPushSubscription({ data: { token } }),
      DEFAULT_CLEANUP_TIMEOUT_MS,
    );
    if (!result.ok) return { status: "unknown" };
    return result.owned ? { status: "owned", token } : { status: "not_owned" };
  } catch {
    return { status: "unknown" };
  }
}

type PushOwner = { generation: number; userId: string | null };

let observedPushUserId: string | null | undefined;
let pushIdentityCleanupPending = false;
let pushIdentityGeneration = 0;
let pushOperationQueue: Promise<void> = Promise.resolve();
let confirmedBrowserRevocation: { generation: number; userId: string; token: string } | undefined;

function enqueuePushOperation<T>(operation: () => Promise<T>, blockedResult: T): Promise<T> {
  const run = pushOperationQueue.then(
    async () => ((await waitForLateSideEffectBarrier()) ? operation() : blockedResult),
    async () => ((await waitForLateSideEffectBarrier()) ? operation() : blockedResult),
  );
  pushOperationQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function isCurrentPushOwner(owner: PushOwner): Promise<boolean> {
  if (owner.generation !== pushIdentityGeneration) return false;
  if (observedPushUserId !== undefined && observedPushUserId !== owner.userId) return false;
  const current = await currentUserId();
  return (
    current === owner.userId &&
    owner.generation === pushIdentityGeneration &&
    (observedPushUserId === undefined || observedPushUserId === owner.userId)
  );
}

function isCurrentObservedOwner(owner: PushOwner): boolean {
  return owner.generation === pushIdentityGeneration && observedPushUserId === owner.userId;
}

async function cleanupForeignPushTokens(
  userId: string | null,
  ownerCheck?: () => Promise<boolean>,
): Promise<boolean> {
  if (!userId) return false;
  // The current authenticated owner cannot safely delete a previous owner's row.
  // Persist the owner/token pair and wait for that owner to authenticate again.
  if (!markForeignStoredTokensPending(userId, true)) return false;
  return !ownerCheck || (await ownerCheck());
}

async function upsertPushTokenForCurrentUser(token: string): Promise<PushSubscriptionUpsertResult> {
  try {
    const { upsertPushSubscriptionForCurrentUser } = await withTimeout(
      import("./firebase-push.functions"),
      DEFAULT_CLEANUP_TIMEOUT_MS,
    );
    return await withTimeout(
      upsertPushSubscriptionForCurrentUser({ data: { token } }),
      DEFAULT_CLEANUP_TIMEOUT_MS,
    );
  } catch {
    return { ok: false, reason: "database_error" };
  }
}

async function cleanupPendingCloudForOwner(
  userId: string,
  ownerCheck: () => Promise<boolean>,
  options: DisableFirebaseNotificationsOptions = {},
): Promise<boolean> {
  if (!pendingCloudCleanupStorageReadable()) return false;
  let cleaned = true;
  for (const pending of pendingCloudCleanupForOwner(userId)) {
    if (!(await ownerCheck())) return false;
    const removed = await removeCloudToken(userId, pending.token, options, ownerCheck);
    if (!removed) {
      cleaned = false;
      continue;
    }
    if (readStoredToken(userId) === pending.token && !clearStoredToken(userId, pending.token)) {
      cleaned = false;
      continue;
    }
    if (!removePendingCloudCleanup(userId, pending.token)) cleaned = false;
  }
  return cleaned;
}

function markPendingCloudCleanupBrowserRevoked(userId: string): boolean {
  let stored = true;
  for (const pending of pendingCloudCleanupForOwner(userId)) {
    if (!rememberPendingCloudCleanup(userId, pending.token, true)) stored = false;
  }
  return stored;
}

function syncPendingCleanupFlag(): void {
  pushIdentityCleanupPending = hasPendingCloudCleanup();
}

function stalePushResult(): PushResult {
  return { enabled: false, message: "A conta mudou; tente novamente." };
}

/** Revoke browser-level tokens whenever ownership changes or stored ownership is ambiguous. */
export async function observeFirebasePushIdentity(userId: string | null): Promise<void> {
  const previousUserId = observedPushUserId;
  const initial = previousUserId === undefined;
  const changed = !initial && previousUserId !== userId;
  const generation = initial || changed ? ++pushIdentityGeneration : pushIdentityGeneration;
  let transitionPendingStored = true;
  if (changed && previousUserId) {
    const previousToken = readStoredToken(previousUserId);
    if (previousToken) {
      transitionPendingStored = rememberPendingCloudCleanup(previousUserId, previousToken, false);
    }
  }
  syncPendingCleanupFlag();
  observedPushUserId = userId;
  const owner: PushOwner = { generation, userId };
  const ownerCheck = async () => isCurrentObservedOwner(owner);

  return enqueuePushOperation(async () => {
    if (!pendingCloudCleanupStorageReadable() || !transitionPendingStored) {
      pushIdentityCleanupPending = true;
      return;
    }
    const hasStoredToken = hasScopedStoredToken();
    const permissionGranted =
      typeof Notification !== "undefined" && Notification.permission === "granted";
    const ambiguousInitialState =
      initial &&
      (hasForeignScopedToken(userId) ||
        Boolean(readLegacyStoredToken()) ||
        (userId === null && hasStoredToken) ||
        (!hasStoredToken && permissionGranted));
    const pendingForCurrentOwner = userId ? pendingCloudCleanupForOwner(userId) : [];
    const shouldCleanup =
      pushIdentityCleanupPending ||
      pendingForCurrentOwner.length > 0 ||
      ambiguousInitialState ||
      (changed && (hasStoredToken || permissionGranted));
    if (!shouldCleanup || !isCurrentObservedOwner(owner)) return;

    if (changed && userId && !markForeignStoredTokensPending(userId, false)) {
      pushIdentityCleanupPending = true;
      return;
    }
    const pendingNeedsBrowserRevocation = pendingForCurrentOwner.some(
      (pending) => !pending.browserRevoked,
    );
    const needsBrowserRevocation =
      pendingNeedsBrowserRevocation ||
      ambiguousInitialState ||
      changed ||
      (pushIdentityCleanupPending &&
        pendingForCurrentOwner.length === 0 &&
        !(userId ? foreignStoredTokensBrowserRevoked(userId) : false));
    if (needsBrowserRevocation) {
      const revoked = await revokeBrowserToken(ownerCheck);
      if (!(await ownerCheck())) return;
      if (!revoked) {
        pushIdentityCleanupPending = true;
        return;
      }
      if (userId && !markPendingCloudCleanupBrowserRevoked(userId)) {
        pushIdentityCleanupPending = true;
        return;
      }
      if (changed && userId && !markForeignStoredTokensPending(userId, true)) {
        pushIdentityCleanupPending = true;
        return;
      }
    }

    if (userId) {
      const cloudCleaned = await cleanupPendingCloudForOwner(userId, ownerCheck);
      if (!(await ownerCheck())) return;
      if (!cloudCleaned) {
        pushIdentityCleanupPending = true;
        return;
      }
    }
    syncPendingCleanupFlag();
  }, undefined);
}

/**
 * Only call from a user click. Never ask for push permission automatically.
 * Uses a separate worker scope so messaging and offline caching can coexist.
 */
export function enableFirebaseNotifications(
  config: Awaited<ReturnType<typeof getFirebaseWebConfig>>,
): Promise<PushResult> {
  const generation = pushIdentityGeneration;
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return Promise.resolve({
      enabled: false,
      message: "Notificações não suportadas neste navegador.",
    });
  }
  try {
    if (window.top !== window.self) {
      return Promise.resolve({
        enabled: false,
        message:
          "Abra o jogo em uma nova aba para ativar notificações; a prévia não permite solicitar essa permissão.",
      });
    }
  } catch {
    return Promise.resolve({
      enabled: false,
      message: "Não foi possível validar a aba atual para ativar notificações.",
    });
  }
  if (
    !config.apiKey ||
    !config.projectId ||
    !config.appId ||
    !config.messagingSenderId ||
    !config.vapidPublicKey
  ) {
    return Promise.resolve({
      enabled: false,
      message:
        "Atualize a conexão Firebase e selecione Include web push para configurar notificações no navegador.",
    });
  }
  const notification = window.Notification;
  if (!notification || typeof notification.permission !== "string") {
    return Promise.resolve({
      enabled: false,
      message: "Notificações não suportadas neste navegador.",
    });
  }
  let permissionPromise: Promise<NotificationPermission> | undefined;
  if (notification.permission !== "granted") {
    if (typeof notification.requestPermission !== "function") {
      return Promise.resolve({
        enabled: false,
        message: "Notificações não suportadas neste navegador.",
      });
    }
    try {
      // Keep transient user activation by calling this before the first await
      // and before entering the serialized operation queue.
      permissionPromise = Promise.resolve(notification.requestPermission());
    } catch {
      return Promise.resolve({
        enabled: false,
        message: "Não foi possível solicitar a permissão de notificações.",
      });
    }
  }
  return enqueuePushOperation(
    () => enableFirebaseNotificationsInternal(config, generation, permissionPromise),
    stalePushResult(),
  );
}

async function enableFirebaseNotificationsInternal(
  config: Awaited<ReturnType<typeof getFirebaseWebConfig>>,
  generation: number,
  permissionPromise: Promise<NotificationPermission> | undefined,
): Promise<PushResult> {
  if (generation !== pushIdentityGeneration) return stalePushResult();
  syncPendingCleanupFlag();
  if (!pendingCloudCleanupStorageReadable()) {
    return {
      enabled: false,
      message: "Não foi possível ler o estado local das inscrições; tente novamente.",
    };
  }

  if (permissionPromise) {
    let permission: NotificationPermission;
    try {
      permission = await withTimeout(permissionPromise, DEFAULT_BROWSER_OPERATION_TIMEOUT_MS);
    } catch {
      return {
        enabled: false,
        message: "Não foi possível solicitar a permissão de notificações.",
      };
    }
    if (generation !== pushIdentityGeneration) return stalePushResult();
    if (permission !== "granted") {
      return {
        enabled: false,
        message:
          "Notificações bloqueadas. Libere a permissão nas configurações deste site no navegador e tente novamente.",
      };
    }
  }
  if (generation !== pushIdentityGeneration) return stalePushResult();

  let identity;
  try {
    identity = await withTimeout(supabase.auth.getUser(), DEFAULT_CLEANUP_TIMEOUT_MS);
  } catch {
    return { enabled: false, message: "Não foi possível confirmar a conta. Tente novamente." };
  }
  if (identity.error || !identity.data?.user) {
    return {
      enabled: false,
      message: identity.error
        ? "Não foi possível confirmar a conta. Tente novamente."
        : "Entre na conta antes de ativar notificações.",
    };
  }
  const userId = identity.data.user.id;
  const owner: PushOwner = { generation, userId };
  const ownerCheck = () => isCurrentPushOwner(owner);
  if (!(await ownerCheck())) return stalePushResult();

  const pendingForCurrentOwner = pendingCloudCleanupForOwner(userId);
  if (pendingForCurrentOwner.length > 0) {
    const cloudCleaned = await cleanupPendingCloudForOwner(userId, ownerCheck);
    if (!(await ownerCheck())) return stalePushResult();
    if (!cloudCleaned) {
      pushIdentityCleanupPending = true;
      return {
        enabled: false,
        message: "Não foi possível atualizar a inscrição neste dispositivo.",
      };
    }
  }

  const hasForeignToken = hasForeignScopedToken(userId);
  if (hasForeignToken && !foreignStoredTokensBrowserRevoked(userId)) {
    const revoked = await revokeBrowserToken(ownerCheck);
    if (!(await ownerCheck())) return stalePushResult();
    if (!revoked) {
      pushIdentityCleanupPending = true;
      return {
        enabled: false,
        message: "Não foi possível revogar o token local neste dispositivo.",
      };
    }
  }
  if (hasForeignToken) {
    if (!(await cleanupForeignPushTokens(userId, ownerCheck))) {
      pushIdentityCleanupPending = true;
      return {
        enabled: false,
        message: "Não foi possível atualizar a inscrição neste dispositivo.",
      };
    }
  }
  syncPendingCleanupFlag();

  const app = await withTimeout(initFirebase({ config }), DEFAULT_BROWSER_OPERATION_TIMEOUT_MS);
  if (!app) return { enabled: false, message: "Firebase indisponível neste momento." };
  const { deleteToken, getMessaging, getToken, isSupported } = await withTimeout(
    import("firebase/messaging"),
    DEFAULT_BROWSER_OPERATION_TIMEOUT_MS,
  );
  if (!(await ownerCheck())) return stalePushResult();
  if (!(await withTimeout(isSupported(), DEFAULT_BROWSER_OPERATION_TIMEOUT_MS))) {
    return { enabled: false, message: "Este dispositivo não suporta Firebase Messaging." };
  }
  const query = new URLSearchParams({
    apiKey: config.apiKey,
    projectId: config.projectId,
    appId: config.appId,
    messagingSenderId: config.messagingSenderId,
  });
  let registration: ServiceWorkerRegistration;
  try {
    registration = await withBrowserSideEffectTimeout(
      navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`, {
        scope: "/firebase-push/",
      }),
      DEFAULT_BROWSER_OPERATION_TIMEOUT_MS,
      cleanupDedicatedPushRegistration,
    );
  } catch {
    return {
      enabled: false,
      message: "Não foi possível registrar o worker de notificações.",
    };
  }
  if (!(await ownerCheck())) return stalePushResult();
  const expectedScope = expectedPushRegistrationScope();
  if (!expectedScope || registration.scope !== expectedScope) {
    return {
      enabled: false,
      message: "Não foi possível validar o escopo do worker de notificações.",
    };
  }
  const messaging = getMessaging(app);
  const tokenOptions = {
    vapidKey: config.vapidPublicKey,
    serviceWorkerRegistration: registration,
  };
  if (!(await ownerCheck())) return stalePushResult();
  let token: string;
  try {
    token = await withBrowserSideEffectTimeout(
      getToken(messaging, tokenOptions),
      DEFAULT_BROWSER_OPERATION_TIMEOUT_MS,
      cleanupDedicatedPushRegistration.bind(undefined, registration),
    );
  } catch {
    return { enabled: false, message: "Não foi possível gerar um token de mensagens." };
  }
  if (!token) return { enabled: false, message: "Não foi possível gerar um token de mensagens." };
  if (!(await ownerCheck())) return stalePushResult();

  const legacyLookup = await readLegacyTokenForUser(userId, ownerCheck);
  if (legacyLookup.status === "unknown") {
    return {
      enabled: false,
      message: "Não foi possível confirmar a inscrição remota desta conta.",
    };
  }
  const previousToken =
    readStoredToken(userId) ?? (legacyLookup.status === "owned" ? legacyLookup.token : null);
  if (!(await ownerCheck())) return stalePushResult();
  if (previousToken !== token && hasForeignStoredToken(userId, token)) {
    try {
      if (!(await ownerCheck())) return stalePushResult();
      const revoked = await withBrowserSideEffectTimeout(
        deleteToken(messaging),
        DEFAULT_BROWSER_OPERATION_TIMEOUT_MS,
      );
      if (!revoked) throw new Error("Could not revoke a token owned by another account.");
      if (!(await ownerCheck())) return stalePushResult();
      if (!(await cleanupForeignPushTokens(userId, ownerCheck))) {
        pushIdentityCleanupPending = true;
        return {
          enabled: false,
          message: "Não foi possível atualizar a inscrição neste dispositivo.",
        };
      }
      if (!(await ownerCheck())) return stalePushResult();
      const rotatedToken = await withBrowserSideEffectTimeout(
        getToken(messaging, tokenOptions),
        DEFAULT_BROWSER_OPERATION_TIMEOUT_MS,
        cleanupDedicatedPushRegistration.bind(undefined, registration),
      );
      if (!rotatedToken || rotatedToken === token) {
        return {
          enabled: false,
          message: "Não foi possível separar a inscrição deste dispositivo das outras contas.",
        };
      }
      token = rotatedToken;
    } catch {
      return {
        enabled: false,
        message: "Não foi possível separar a inscrição deste dispositivo das outras contas.",
      };
    }
  }

  if (previousToken && previousToken !== token) {
    if (!rememberPendingCloudCleanup(userId, previousToken, true)) {
      return {
        enabled: true,
        message: "Não foi possível atualizar a inscrição neste dispositivo.",
      };
    }
    const removed = await removeCloudToken(userId, previousToken, {}, ownerCheck);
    if (!removed) {
      if (!(await ownerCheck())) return stalePushResult();
      return {
        enabled: false,
        message: "Não foi possível atualizar a inscrição neste dispositivo.",
      };
    }
    if (!removePendingCloudCleanup(userId, previousToken)) {
      return {
        enabled: true,
        message: "Não foi possível atualizar a inscrição neste dispositivo.",
      };
    }
  }

  if (!(await ownerCheck())) return stalePushResult();
  let upserted = await upsertPushTokenForCurrentUser(token);
  if (!(await ownerCheck())) return stalePushResult();
  if (!upserted.ok && upserted.reason === "token_owned_by_another_account") {
    // The current owner must not delete a foreign row. Rotate only the local
    // browser token and let the authenticated owner clean its row later.
    if (!(await ownerCheck())) return stalePushResult();
    try {
      const revoked = await withBrowserSideEffectTimeout(
        deleteToken(messaging),
        DEFAULT_BROWSER_OPERATION_TIMEOUT_MS,
      );
      if (!revoked) throw new Error("Could not rotate a foreign browser token.");
      if (!(await ownerCheck())) return stalePushResult();
      const rotatedToken = await withBrowserSideEffectTimeout(
        getToken(messaging, tokenOptions),
        DEFAULT_BROWSER_OPERATION_TIMEOUT_MS,
        cleanupDedicatedPushRegistration.bind(undefined, registration),
      );
      if (!rotatedToken || rotatedToken === token) {
        pushIdentityCleanupPending = true;
        return {
          enabled: false,
          message: "Não foi possível separar a inscrição deste dispositivo das outras contas.",
        };
      }
      token = rotatedToken;
    } catch {
      pushIdentityCleanupPending = true;
      return {
        enabled: false,
        message: "Não foi possível separar a inscrição deste dispositivo das outras contas.",
      };
    }
    if (!(await ownerCheck())) return stalePushResult();
    upserted = await upsertPushTokenForCurrentUser(token);
    if (!(await ownerCheck())) return stalePushResult();
  }
  if (!upserted.ok) return { enabled: false, message: "Não foi possível salvar a inscrição." };
  if (!(await ownerCheck())) return stalePushResult();
  if (!rememberStoredToken(userId, token)) {
    return {
      enabled: true,
      message: "Notificações ativadas; este navegador não permite lembrar a inscrição localmente.",
    };
  }
  return { enabled: true, message: "Notificações ativadas neste dispositivo." };
}

/** Remove this device only, never unsubscribe the user's other devices. */
export async function disableFirebaseNotifications(
  options: DisableFirebaseNotificationsOptions = {},
): Promise<PushResult> {
  return enqueuePushOperation(() => disableFirebaseNotificationsInternal(options), {
    enabled: true,
    message: "Não foi possível concluir a alteração das notificações.",
  });
}

/** Confirm browser revocation separately so cloud latency cannot block logout. */
export async function revokeFirebasePushBrowser(
  options: { timeoutMs?: number } = {},
): Promise<boolean> {
  return enqueuePushOperation(async () => {
    if (typeof window === "undefined") return false;
    const userId = await currentUserId();
    if (userId === undefined) return false;
    const generation = pushIdentityGeneration;
    const owner: PushOwner = { generation, userId };
    const ownerCheck = () => isCurrentPushOwner(owner);
    if (!(await ownerCheck())) return false;
    const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_BROWSER_OPERATION_TIMEOUT_MS);
    const revoked = await revokeBrowserToken(ownerCheck, timeoutMs);
    if (!(await ownerCheck()) || !revoked) return false;
    if (userId) {
      const token = readStoredToken(userId);
      if (token) confirmedBrowserRevocation = { generation, userId, token };
      if (!markPendingCloudCleanupBrowserRevoked(userId)) return false;
    }
    return true;
  }, false);
}

async function disableFirebaseNotificationsInternal(
  options: DisableFirebaseNotificationsOptions,
): Promise<PushResult> {
  const generation = pushIdentityGeneration;
  if (typeof window === "undefined") return { enabled: false, message: "Indisponível." };
  syncPendingCleanupFlag();
  if (!pendingCloudCleanupStorageReadable()) {
    return {
      enabled: true,
      message: "Não foi possível ler o estado local das inscrições; tente novamente.",
    };
  }

  const userId = await currentUserId();
  if (userId === undefined) {
    return { enabled: true, message: "Não foi possível confirmar a conta. Tente novamente." };
  }
  const owner: PushOwner = { generation, userId };
  const ownerCheck = () => isCurrentPushOwner(owner);
  if (!(await ownerCheck())) return stalePushResult();

  const browserTimeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_BROWSER_OPERATION_TIMEOUT_MS);
  const skipBrowserRevocation = options.skipBrowserRevocation === true;
  if (userId === null) {
    const permissionGranted =
      typeof Notification !== "undefined" && Notification.permission === "granted";
    if (!hasScopedStoredToken() && !readLegacyStoredToken() && !permissionGranted) {
      return { enabled: false, message: "Nenhuma inscrição neste dispositivo." };
    }
    const browserRevoked =
      skipBrowserRevocation || (await revokeBrowserToken(ownerCheck, browserTimeoutMs));
    if (!(await ownerCheck())) return stalePushResult();
    if (!browserRevoked) {
      pushIdentityCleanupPending = true;
      return {
        enabled: true,
        message: "Não foi possível revogar o token local neste dispositivo.",
      };
    }
    // A signed-out browser cannot prove ownership of any stored row. Keep all
    // owner-scoped records for the corresponding authenticated retry.
    if (!markForeignStoredTokensPending("", true)) {
      pushIdentityCleanupPending = true;
      return {
        enabled: true,
        message: "Não foi possível atualizar a inscrição neste dispositivo.",
      };
    }
    syncPendingCleanupFlag();
    return { enabled: false, message: "Notificações desativadas neste dispositivo." };
  }

  const pendingForOwner = pendingCloudCleanupForOwner(userId);
  const hadPendingForOwner = pendingForOwner.length > 0;
  const storedToken = readStoredToken(userId);
  const legacyLookup = storedToken
    ? ({ status: "absent" } satisfies LegacyTokenLookup)
    : await readLegacyTokenForUser(userId, ownerCheck);
  if (!(await ownerCheck())) return stalePushResult();
  if (legacyLookup.status === "unknown") {
    return {
      enabled: true,
      message: "Não foi possível confirmar a inscrição remota desta conta.",
    };
  }
  let token = storedToken ?? (legacyLookup.status === "owned" ? legacyLookup.token : null);
  const pendingToken = token
    ? pendingForOwner.find((pending) => pending.token === token)
    : undefined;
  const hasForeignLocalToken = hasForeignScopedToken(userId);
  const browserAlreadyRevoked =
    skipBrowserRevocation ||
    pendingToken?.browserRevoked === true ||
    (confirmedBrowserRevocation?.generation === generation &&
      confirmedBrowserRevocation.userId === userId &&
      confirmedBrowserRevocation.token === token);
  const needsBrowserRevocation =
    !browserAlreadyRevoked &&
    (Boolean(token) ||
      pendingForOwner.some((pending) => !pending.browserRevoked) ||
      Boolean(readLegacyStoredToken()) ||
      (hasForeignLocalToken && !foreignStoredTokensBrowserRevoked(userId)));
  if (needsBrowserRevocation) {
    const browserRevoked = await revokeBrowserToken(ownerCheck, browserTimeoutMs);
    if (!(await ownerCheck())) return stalePushResult();
    if (!browserRevoked) {
      pushIdentityCleanupPending = true;
      return {
        enabled: true,
        message: "Não foi possível revogar o token local neste dispositivo.",
      };
    }
    if (!markPendingCloudCleanupBrowserRevoked(userId)) {
      pushIdentityCleanupPending = true;
      return {
        enabled: true,
        message: "Não foi possível atualizar a inscrição neste dispositivo.",
      };
    }
    if (hasForeignLocalToken && !markForeignStoredTokensPending(userId, true)) {
      pushIdentityCleanupPending = true;
      return {
        enabled: true,
        message: "Não foi possível atualizar a inscrição neste dispositivo.",
      };
    }
    if (token) {
      confirmedBrowserRevocation = { generation, userId, token };
    }
  }

  const pendingCloudRemoved = await cleanupPendingCloudForOwner(userId, ownerCheck, options);
  if (!(await ownerCheck())) return stalePushResult();
  if (!pendingCloudRemoved) {
    syncPendingCleanupFlag();
    return {
      enabled: false,
      message: "Token local revogado; não foi possível remover a inscrição na nuvem.",
    };
  }
  token = readStoredToken(userId) ?? (legacyLookup.status === "owned" ? legacyLookup.token : null);
  if (!token) {
    const hasUnknownLocalOwner =
      legacyLookup.status === "not_owned" ||
      Boolean(readLegacyStoredToken()) ||
      hasForeignLocalToken;
    if (!hasUnknownLocalOwner) {
      syncPendingCleanupFlag();
      return hadPendingForOwner
        ? { enabled: false, message: "Notificações desativadas neste dispositivo." }
        : { enabled: false, message: "Nenhuma inscrição neste dispositivo." };
    }
    syncPendingCleanupFlag();
    return { enabled: false, message: "Notificações desativadas neste dispositivo." };
  }

  if (!rememberPendingCloudCleanup(userId, token, true)) {
    return {
      enabled: true,
      message: "Não foi possível atualizar a inscrição neste dispositivo.",
    };
  }
  const cloudRemoved = await removeCloudToken(userId, token, options, ownerCheck);
  if (!(await ownerCheck())) return stalePushResult();
  if (!cloudRemoved) {
    syncPendingCleanupFlag();
    return {
      enabled: false,
      message: "Token local revogado; não foi possível remover a inscrição na nuvem.",
    };
  }
  if (!clearStoredToken(userId, token) || !removePendingCloudCleanup(userId, token)) {
    syncPendingCleanupFlag();
    return {
      enabled: true,
      message: "A inscrição remota foi removida, mas o estado local precisa de nova tentativa.",
    };
  }
  confirmedBrowserRevocation = undefined;
  syncPendingCleanupFlag();
  return { enabled: false, message: "Notificações desativadas neste dispositivo." };
}

export function hasFirebasePushDeviceToken(userId?: string | null): boolean {
  if (userId === null) return false;
  if (userId !== undefined) return Boolean(readStoredToken(userId));
  return hasScopedStoredToken();
}
