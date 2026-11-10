import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CareerState } from "@/game/types";
import * as store from "./offline/store";
import { recoverPendingCareerWrite } from "./career-save-recovery";

vi.mock("./offline/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./offline/store")>();
  return {
    ...actual,
    readCareerEpoch: vi.fn(),
    readLocalCareerSyncBlock: vi.fn(),
    readLocalCareerGeneration: vi.fn(),
    readLocalCareerTombstone: vi.fn(),
    loadLocalCareer: vi.fn(),
    readOutbox: vi.fn(),
    saveLocalCareer: vi.fn(),
    queueSync: vi.fn(),
    clearLocalCareerSyncBlock: vi.fn(),
    withCareerLock: vi.fn(),
  };
});

const state = {
  version: 3,
  season: 1,
  round: 7,
  clubId: "fla",
  players: {},
  fixtures: [],
} as unknown as CareerState;
const entry = { state, generation: 3, revision: "recovered", at: 100 };
const recover = () =>
  recoverPendingCareerWrite({ owner: "account-a", epoch: 4, isCurrent: () => true });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(store.readCareerEpoch).mockReturnValue(4);
  vi.mocked(store.readLocalCareerSyncBlock).mockResolvedValue({
    reason: "pending_save",
    generation: 3,
    blockedAt: "now",
  });
  vi.mocked(store.readLocalCareerGeneration).mockResolvedValue(3);
  vi.mocked(store.readLocalCareerTombstone).mockResolvedValue(null);
  vi.mocked(store.loadLocalCareer).mockResolvedValue(state);
  vi.mocked(store.readOutbox).mockResolvedValueOnce(null).mockResolvedValue(entry);
  vi.mocked(store.saveLocalCareer).mockResolvedValue(true);
  vi.mocked(store.queueSync).mockResolvedValue(entry);
  vi.mocked(store.clearLocalCareerSyncBlock).mockResolvedValue(true);
  vi.mocked(store.withCareerLock).mockImplementation(
    async <T>(
      _owner: store.LocalOwnerId | undefined,
      action: () => Promise<T> | T,
    ): Promise<store.CareerLockResult<T>> => ({ acquired: true, value: await action() }),
  );
});

describe("interrupted career local-save recovery", () => {
  it("rebuilds and confirms the same-generation outbox before clearing the pending barrier", async () => {
    await expect(recover()).resolves.toBe(true);
    expect(store.saveLocalCareer).toHaveBeenCalledWith(state, "recuperação", "account-a", {
      lockHeld: true,
      expectedEpoch: 4,
      generation: 3,
      allowPendingBarrier: true,
    });
    expect(store.queueSync).toHaveBeenCalledWith(
      state,
      "account-a",
      expect.objectContaining({ generation: 3, expectedEpoch: 4 }),
    );
    expect(store.readOutbox).toHaveBeenCalledTimes(2);
    expect(vi.mocked(store.clearLocalCareerSyncBlock).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(store.readOutbox).mock.invocationCallOrder[1]!,
    );
  });

  it.each(["conflict", "deleted", "legacy_outbox", "unknown_generation"] as const)(
    "never clears a %s barrier as interrupted local persistence",
    async (reason) => {
      vi.mocked(store.readLocalCareerSyncBlock).mockResolvedValue({
        reason,
        generation: 3,
        blockedAt: "now",
      });
      await expect(recover()).resolves.toBe(false);
      expect(store.queueSync).not.toHaveBeenCalled();
      expect(store.clearLocalCareerSyncBlock).not.toHaveBeenCalled();
    },
  );

  it.each([null, 2, 4])(
    "retains the barrier when generation %s does not match",
    async (generation) => {
      vi.mocked(store.readLocalCareerGeneration).mockResolvedValue(generation);
      await expect(recover()).resolves.toBe(false);
      expect(store.saveLocalCareer).not.toHaveBeenCalled();
      expect(store.clearLocalCareerSyncBlock).not.toHaveBeenCalled();
    },
  );

  it("does not resurrect a tombstoned career", async () => {
    vi.mocked(store.readLocalCareerTombstone).mockResolvedValue({
      generation: 3,
      deletedAt: "now",
    });
    await expect(recover()).resolves.toBe(false);
    expect(store.queueSync).not.toHaveBeenCalled();
  });

  it.each(["snapshot", "queue", "confirmation", "clear"])(
    "retains recovery state after %s failure",
    async (phase) => {
      if (phase === "snapshot") vi.mocked(store.saveLocalCareer).mockResolvedValue(false);
      if (phase === "queue") vi.mocked(store.queueSync).mockResolvedValue(null);
      if (phase === "confirmation")
        vi.mocked(store.readOutbox)
          .mockReset()
          .mockResolvedValueOnce(null)
          .mockResolvedValue({ ...entry, revision: "another-save" });
      if (phase === "clear") vi.mocked(store.clearLocalCareerSyncBlock).mockResolvedValue(false);
      await expect(recover()).resolves.toBe(false);
      if (phase !== "clear") expect(store.clearLocalCareerSyncBlock).not.toHaveBeenCalled();
    },
  );

  it("does not recover without a cross-tab lock, a snapshot, or a readable queue", async () => {
    vi.mocked(store.withCareerLock).mockResolvedValue({ acquired: false });
    await expect(recover()).resolves.toBe(false);
    expect(store.clearLocalCareerSyncBlock).not.toHaveBeenCalled();
  });

  it("leaves a newer or legacy outbox untouched", async () => {
    vi.mocked(store.readOutbox)
      .mockReset()
      .mockResolvedValue({ ...entry, generation: 4 });
    await expect(recover()).resolves.toBe(false);
    expect(store.queueSync).not.toHaveBeenCalled();
    expect(store.clearLocalCareerSyncBlock).not.toHaveBeenCalled();
  });

  it("stops between asynchronous writes when reset changes the epoch", async () => {
    vi.mocked(store.saveLocalCareer).mockImplementation(async () => {
      vi.mocked(store.readCareerEpoch).mockReturnValue(5);
      return true;
    });
    await expect(recover()).resolves.toBe(false);
    expect(store.queueSync).not.toHaveBeenCalled();
    expect(store.clearLocalCareerSyncBlock).not.toHaveBeenCalled();
  });
});
