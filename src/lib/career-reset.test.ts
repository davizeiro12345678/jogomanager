import { describe, expect, it, vi } from "vitest";

import { resetCareerSafely } from "./career-reset";

type ResetOptions = Parameters<typeof resetCareerSafely>[0];

function createResetOptions(overrides: Partial<ResetOptions> = {}) {
  const order: string[] = [];
  const options: ResetOptions = {
    status: "ready",
    owner: "user-a",
    userId: "user-a",
    getSync: () => "synced",
    isSaving: () => false,
    isOnline: () => true,
    isCurrentOwner: (owner) => owner === "user-a",
    readOutbox: vi.fn(async () => null),
    wipeRemote: vi.fn(async () => {
      order.push("wipe-remote");
      return { generation: 2, deletedAt: "2026-11-08T00:00:00.000Z" };
    }),
    persistTombstone: vi.fn(async () => {
      order.push("persist-tombstone");
      return true;
    }),
    clearLocal: vi.fn(async () => {
      order.push("clear-local");
      return true;
    }),
    withCrossTabLock: vi.fn(async (_owner, callback) => ({
      acquired: true,
      value: await callback(),
    })),
    ...overrides,
  };
  return { options, order };
}

const TOMBSTONE = { generation: 2, deletedAt: "2026-11-08T00:00:00.000Z" };

describe("safe career reset", () => {
  it("preserves the snapshot and outbox when connectivity drops during preflight", async () => {
    let online = true;
    const { options } = createResetOptions({
      isOnline: () => online,
      readOutbox: vi.fn(async () => {
        online = false;
        return null;
      }),
    });

    await expect(resetCareerSafely(options)).resolves.toMatchObject({
      ok: false,
      reason: "preflight",
    });
    expect(options.wipeRemote).not.toHaveBeenCalled();
    expect(options.clearLocal).not.toHaveBeenCalled();
  });

  it("does not start a signed-in reset while already offline", async () => {
    const { options } = createResetOptions({ isOnline: () => false });

    await expect(resetCareerSafely(options)).resolves.toMatchObject({
      ok: false,
      reason: "preflight",
    });
    expect(options.readOutbox).not.toHaveBeenCalled();
    expect(options.wipeRemote).not.toHaveBeenCalled();
    expect(options.clearLocal).not.toHaveBeenCalled();
  });

  it("fails closed when a durable outbox exists but its read is unreadable", async () => {
    const { options } = createResetOptions({
      readOutbox: vi.fn(async () => {
        throw new Error("IndexedDB read rejected");
      }),
    });

    await expect(resetCareerSafely(options)).resolves.toMatchObject({ ok: false });
    expect(options.wipeRemote).not.toHaveBeenCalled();
    expect(options.clearLocal).not.toHaveBeenCalled();
  });

  it("does not confuse a rejected outbox read with an empty queue", async () => {
    const readOutbox = vi.fn(async () => {
      throw new Error("Career outbox is unreadable");
    });
    const wipeRemote = vi.fn(async () => TOMBSTONE);
    const persistTombstone = vi.fn(async () => true);
    const clearLocal = vi.fn(async () => true);
    const { options } = createResetOptions({
      readOutbox,
      wipeRemote,
      persistTombstone,
      clearLocal,
    });

    await expect(resetCareerSafely(options)).resolves.toMatchObject({
      ok: false,
      reason: "preflight",
    });
    expect(readOutbox).toHaveBeenCalledTimes(1);
    expect(wipeRemote).not.toHaveBeenCalled();
    expect(persistTombstone).not.toHaveBeenCalled();
    expect(clearLocal).not.toHaveBeenCalled();
  });

  it("preserves a signed-in save still marked offline after connectivity returns", async () => {
    const { options } = createResetOptions({ getSync: () => "offline" });

    await expect(resetCareerSafely(options)).resolves.toMatchObject({
      ok: false,
      reason: "preflight",
    });
    expect(options.readOutbox).not.toHaveBeenCalled();
    expect(options.wipeRemote).not.toHaveBeenCalled();
    expect(options.clearLocal).not.toHaveBeenCalled();
  });

  it("does not wipe or clear when the sync-barrier read fails", async () => {
    const { options } = createResetOptions({
      hasSyncBlock: vi.fn(async () => {
        throw new Error("storage unavailable");
      }),
    });

    await expect(resetCareerSafely(options)).resolves.toMatchObject({
      ok: false,
      reason: "preflight",
    });
    expect(options.wipeRemote).not.toHaveBeenCalled();
    expect(options.clearLocal).not.toHaveBeenCalled();
  });

  it("blocks while a save, sync, or queued outbox entry is pending", async () => {
    const saving = createResetOptions({ isSaving: () => true });
    await expect(resetCareerSafely(saving.options)).resolves.toMatchObject({ ok: false });
    expect(saving.options.wipeRemote).not.toHaveBeenCalled();
    expect(saving.options.clearLocal).not.toHaveBeenCalled();

    const syncing = createResetOptions({ getSync: () => "syncing" });
    await expect(resetCareerSafely(syncing.options)).resolves.toMatchObject({ ok: false });
    expect(syncing.options.wipeRemote).not.toHaveBeenCalled();
    expect(syncing.options.clearLocal).not.toHaveBeenCalled();

    const pending = createResetOptions({
      readOutbox: vi.fn(async () => ({ at: 1, state: {} as never })),
    });
    await expect(resetCareerSafely(pending.options)).resolves.toMatchObject({ ok: false });
    expect(pending.options.wipeRemote).not.toHaveBeenCalled();
    expect(pending.options.clearLocal).not.toHaveBeenCalled();
  });

  it("rechecks sync after the asynchronous outbox read", async () => {
    let sync: "synced" | "pending" = "synced";
    const { options } = createResetOptions({
      getSync: () => sync,
      readOutbox: vi.fn(async () => {
        sync = "pending";
        return null;
      }),
    });

    await expect(resetCareerSafely(options)).resolves.toMatchObject({ ok: false });
    expect(options.wipeRemote).not.toHaveBeenCalled();
    expect(options.clearLocal).not.toHaveBeenCalled();
  });

  it("does not claim the career was preserved when remote deletion is unconfirmed", async () => {
    const { options } = createResetOptions({
      wipeRemote: vi.fn(async () => {
        throw new Error("connection lost");
      }),
    });

    await expect(resetCareerSafely(options)).resolves.toMatchObject({
      ok: false,
      reason: "remote_unconfirmed",
    });
    expect(options.clearLocal).not.toHaveBeenCalled();
  });

  it("wipes the cloud before clearing the local snapshot after a safe preflight", async () => {
    const { options, order } = createResetOptions();

    await expect(resetCareerSafely(options)).resolves.toEqual({ ok: true, tombstone: TOMBSTONE });
    expect(order).toEqual(["wipe-remote", "persist-tombstone", "clear-local"]);
  });

  it("reports confirmed remote deletion when local cleanup is not confirmed", async () => {
    const { options, order } = createResetOptions({
      clearLocal: vi.fn(async () => false),
    });

    await expect(resetCareerSafely(options)).resolves.toEqual({
      ok: false,
      reason: "local_cleanup_failed",
      tombstone: TOMBSTONE,
    });
    expect(order).toEqual(["wipe-remote", "persist-tombstone"]);
  });

  it("never clears local data when the remote response lacks a valid tombstone", async () => {
    const { options } = createResetOptions({
      wipeRemote: vi.fn(async () => ({ generation: 0, deletedAt: "invalid" })),
    });

    await expect(resetCareerSafely(options)).resolves.toMatchObject({
      ok: false,
      reason: "remote_unconfirmed",
    });
    expect(options.persistTombstone).not.toHaveBeenCalled();
    expect(options.clearLocal).not.toHaveBeenCalled();
  });

  it("preserves local recovery data when tombstone persistence fails", async () => {
    const { options, order } = createResetOptions({
      persistTombstone: vi.fn(async () => false),
    });

    await expect(resetCareerSafely(options)).resolves.toEqual({
      ok: false,
      reason: "tombstone_persist_failed",
      tombstone: TOMBSTONE,
    });
    expect(order).toEqual(["wipe-remote"]);
    expect(options.persistTombstone).toHaveBeenCalledWith("user-a", TOMBSTONE);
    expect(options.clearLocal).not.toHaveBeenCalled();
  });

  it("fails closed for an authenticated reset without cross-tab coordination", async () => {
    const { options } = createResetOptions({
      withCrossTabLock: vi.fn(async () => ({ acquired: false })),
    });

    await expect(resetCareerSafely(options)).resolves.toMatchObject({
      ok: false,
      reason: "lock_unavailable",
    });
    expect(options.wipeRemote).not.toHaveBeenCalled();
    expect(options.clearLocal).not.toHaveBeenCalled();
  });

  it("fails closed for guest reset when cross-tab coordination is unavailable", async () => {
    const { options } = createResetOptions({
      owner: null,
      userId: null,
      isOnline: () => false,
      isCurrentOwner: (owner) => owner === null,
    });
    delete options.withCrossTabLock;

    await expect(resetCareerSafely(options)).resolves.toMatchObject({
      ok: false,
      reason: "lock_unavailable",
    });
    expect(options.wipeRemote).not.toHaveBeenCalled();
    expect(options.clearLocal).not.toHaveBeenCalled();
  });

  it("runs guest local reset only inside the shared cross-tab lock", async () => {
    const { options } = createResetOptions({
      owner: null,
      userId: null,
      isOnline: () => false,
      isCurrentOwner: (owner) => owner === null,
    });

    await expect(resetCareerSafely(options)).resolves.toEqual({ ok: true });
    expect(options.withCrossTabLock).toHaveBeenCalledWith(null, expect.any(Function));
    expect(options.wipeRemote).not.toHaveBeenCalled();
    expect(options.clearLocal).toHaveBeenCalledWith(null);
  });

  it("does not clear guest data when another save owns the shared lock", async () => {
    const { options } = createResetOptions({
      owner: null,
      userId: null,
      isOnline: () => false,
      isCurrentOwner: (owner) => owner === null,
      withCrossTabLock: vi.fn(async () => ({ acquired: false })),
    });

    await expect(resetCareerSafely(options)).resolves.toMatchObject({
      ok: false,
      reason: "lock_unavailable",
    });
    expect(options.clearLocal).not.toHaveBeenCalled();
  });

  it("does not clear another account's local compartment after remote tombstone confirmation", async () => {
    let currentOwner = "user-a";
    const { options } = createResetOptions({
      isCurrentOwner: (owner) => owner === currentOwner,
      persistTombstone: vi.fn(async () => {
        currentOwner = "user-b";
        return true;
      }),
    });

    await expect(resetCareerSafely(options)).resolves.toEqual({
      ok: false,
      reason: "identity_changed",
      tombstone: TOMBSTONE,
    });
    expect(options.clearLocal).not.toHaveBeenCalled();
  });

  it("aborts if account ownership changes during preflight", async () => {
    let currentOwner = "user-a";
    const { options } = createResetOptions({
      isCurrentOwner: (owner) => owner === currentOwner,
      readOutbox: vi.fn(async () => {
        currentOwner = "user-b";
        return null;
      }),
    });

    await expect(resetCareerSafely(options)).resolves.toMatchObject({
      ok: false,
      reason: "preflight",
    });
    expect(options.wipeRemote).not.toHaveBeenCalled();
    expect(options.clearLocal).not.toHaveBeenCalled();
  });
});
