import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { initCareer } from "@/game/career";
import type { CareerState } from "@/game/types";
import type { OutboxEntry, LocalCareerSyncBlock } from "@/lib/offline/store";
import { useCareer } from "./useCareer";

const harness = vi.hoisted(() => ({
  owner: "account-a" as string | null,
  online: true,
  epoch: 4,
  generation: 3,
  local: null as CareerState | null,
  cloud: null as CareerState | null,
  pending: null as OutboxEntry | null,
  block: null as LocalCareerSyncBlock | null,
  cache: new Map<string, unknown>(),
  effects: [] as Array<() => void | (() => void)>,
  observers: new Set<(event: string, session: { user: { id: string } } | null) => void>(),
  query: null as null | ((input: { signal: AbortSignal }) => Promise<unknown>),
  mutation: null as Promise<unknown> | null,
  save: vi.fn(),
  persisted: vi.fn(),
  queue: vi.fn(),
  wipe: vi.fn(),
  loadReset: vi.fn(),
  loadRecovery: vi.fn(),
  loadMigration: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: () => void | (() => void)) => {
    harness.effects.push(effect);
  },
}));
vi.mock("@/hooks/useAuthUserId", () => ({ useAuthUserId: () => harness.owner }));
vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: (fn: unknown) => fn,
}));
vi.mock("@/lib/career.functions", () => ({
  loadCareer: async () =>
    harness.cloud
      ? { state: harness.cloud, generation: harness.generation, deletedAt: null }
      : null,
  saveCareer: (...args: unknown[]) => harness.save(...args),
  createCareer: vi.fn(),
  deleteCareer: (...args: unknown[]) => harness.wipe(...args),
}));
vi.mock("@/lib/career-maintenance-loader", () => ({
  loadCareerReset: () => harness.loadReset(),
  loadCareerRecovery: () => harness.loadRecovery(),
  loadCareerMigration: () => harness.loadMigration(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (
        observe: (event: string, session: { user: { id: string } } | null) => void,
      ) => {
        harness.observers.add(observe);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                harness.observers.delete(observe);
              },
            },
          },
        };
      },
    },
  },
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    getQueryData: (key: unknown) => harness.cache.get(JSON.stringify(key)),
    setQueryData: (key: unknown, value: unknown) => {
      const cacheKey = JSON.stringify(key);
      const next = typeof value === "function" ? value(harness.cache.get(cacheKey)) : value;
      harness.cache.set(cacheKey, next);
    },
    cancelQueries: vi.fn().mockResolvedValue(undefined),
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  }),
  useQuery: (options: { queryKey: unknown; queryFn: typeof harness.query }) => {
    harness.query = options.queryFn;
    return {
      data: harness.cache.get(JSON.stringify(options.queryKey)),
      isPending: false,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
  },
  useMutation: (options: { mutationFn: (input: unknown) => Promise<unknown> }) => ({
    isPending: false,
    mutateAsync: (input: unknown) => {
      harness.mutation = options.mutationFn(input);
      return harness.mutation;
    },
  }),
}));
vi.mock("@/lib/offline/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/offline/store")>();
  return {
    ...actual,
    isOnline: () => harness.online,
    readCareerEpoch: () => harness.epoch,
    loadLocalCareer: async () => harness.local,
    readLocalCareerGeneration: async () => harness.generation,
    readLocalCareerTombstone: async () => null,
    readLocalCareerSyncBlock: async () => harness.block,
    readOutbox: async () => harness.pending,
    localSavedAt: async () => 100,
    markLocalCareerSyncBlock: async (block: LocalCareerSyncBlock) => {
      harness.block = block;
      return true;
    },
    clearLocalCareerSyncBlock: async () => {
      harness.block = null;
      return true;
    },
    setLocalCareerGeneration: async () => true,
    saveLocalCareer: (...args: unknown[]) => harness.persisted(...args),
    queueSync: (...args: unknown[]) => harness.queue(...args),
    acknowledgeOutbox: async () => {
      harness.pending = null;
      return true;
    },
    withCareerLock: async (_owner: unknown, action: () => Promise<unknown>) => ({
      acquired: true,
      value: await action(),
    }),
  };
});

const cacheKey = JSON.stringify(["career", "account-a", 0]);

function renderCareer() {
  const effectStart = harness.effects.length;
  let result!: ReturnType<typeof useCareer>;
  function CareerHarness() {
    result = useCareer();
    return null;
  }
  renderToString(createElement(CareerHarness));
  const unmount = harness.effects[effectStart]!();
  return {
    result,
    unmount: () => {
      if (typeof unmount === "function") unmount();
    },
  };
}

/** Execute the real reconnect effect with only its browser event/timer ports controlled. */
function mountReconnectEffect() {
  let onOnline!: () => void;
  vi.stubGlobal("window", {
    addEventListener: (event: string, callback: () => void) => {
      if (event === "online") onOnline = callback;
    },
    removeEventListener: vi.fn(),
    setInterval: () => 1,
    clearInterval: vi.fn(),
  });
  const cleanup = harness.effects.at(-1)!();
  return {
    reconnect: () => onOnline(),
    unmount: () => {
      if (typeof cleanup === "function") cleanup();
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  harness.owner = "account-a";
  harness.online = true;
  harness.epoch += 1;
  harness.generation = 3;
  harness.effects = [];
  harness.observers.clear();
  harness.cache.clear();
  harness.local = initCareer("bra", "fla", "Lifecycle");
  harness.cloud = structuredClone(harness.local);
  harness.pending = null;
  harness.block = null;
  harness.mutation = null;
  harness.cache.set(cacheKey, {
    career: harness.local,
    sync: "synced",
    status: "ready",
    generation: 3,
    tombstone: null,
    epoch: harness.epoch,
  });
  harness.persisted.mockImplementation(async (state: CareerState) => {
    harness.local = state;
    return true;
  });
  harness.queue.mockImplementation(async (state: CareerState) => {
    harness.pending = { state, generation: 3, revision: "next-save", at: 101 };
    return harness.pending;
  });
  harness.save.mockResolvedValue({ ok: true });
  harness.loadReset.mockImplementation(() => import("@/lib/career-reset"));
  harness.loadRecovery.mockImplementation(() => import("@/lib/career-save-recovery"));
  harness.loadMigration.mockImplementation(() => import("@/game/career-migration"));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCareer persistence lifecycle", () => {
  it("persists an accepted match result after the page unmounts and disposes the retained auth observer", async () => {
    const { result, unmount } = renderCareer();
    const next = { ...harness.local!, managerName: "Accepted result", round: 2 };
    result.update(next);
    unmount();
    await harness.mutation;
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.persisted).toHaveBeenCalled();
    expect(harness.local?.managerName).toBe("Accepted result");
    expect(harness.save).toHaveBeenCalledWith({
      data: expect.objectContaining({ expectedOwnerId: "account-a", expectedGeneration: 3 }),
    });
    expect(harness.pending).toBeNull();
    expect(harness.observers.size).toBe(0);
  });

  it("cancels an accepted save when auth switches A-B-A before its first local write", async () => {
    const { result, unmount } = renderCareer();
    result.update({ ...harness.local!, round: 2 });
    unmount();
    for (const observe of harness.observers) {
      observe("SIGNED_IN", { user: { id: "account-b" } });
      observe("SIGNED_IN", { user: { id: "account-a" } });
    }
    await harness.mutation;
    expect(harness.persisted).not.toHaveBeenCalled();
    expect(harness.save).not.toHaveBeenCalled();
  });

  it("saves an offline edit of a known local career and retains its upload queue", async () => {
    harness.online = false;
    harness.cache.set(cacheKey, {
      career: harness.local,
      sync: "offline",
      status: "offline",
      generation: 3,
      tombstone: null,
      epoch: harness.epoch,
    });
    const { result } = renderCareer();
    result.update({ ...harness.local!, round: 2 });
    await harness.mutation;
    expect(harness.local?.round).toBe(2);
    expect(harness.pending?.state.round).toBe(2);
    expect(harness.save).not.toHaveBeenCalled();
  });

  it("keeps offline creation without a snapshot or known generation blocked", () => {
    harness.online = false;
    harness.cache.set(cacheKey, {
      career: null,
      sync: "offline",
      status: "offline",
      generation: null,
      tombstone: null,
      epoch: harness.epoch,
    });
    const { result } = renderCareer();
    result.update(harness.local!);
    expect(harness.mutation).toBeNull();
    expect(harness.persisted).not.toHaveBeenCalled();
  });

  it("hydrates the newer same-generation outbox and local snapshot ahead of an older cloud copy", async () => {
    const pendingState = { ...harness.local!, ticketPrice: 77 };
    harness.pending = { state: pendingState, generation: 3, revision: "pending-price", at: 101 };
    renderCareer();
    const hydrated = (await harness.query!({ signal: new AbortController().signal })) as {
      career: CareerState;
      sync: string;
    };
    expect(hydrated.career.ticketPrice).toBe(77);
    expect(hydrated.sync).toBe("pending");
    expect(harness.local?.ticketPrice).toBe(77);
    expect(harness.pending?.revision).toBe("pending-price");
  });

  it("does not stamp a conflicting outbox with the cloud's newer generation", async () => {
    harness.pending = { state: harness.local!, generation: 2, revision: "old-generation", at: 101 };
    renderCareer();
    const hydrated = (await harness.query!({ signal: new AbortController().signal })) as {
      status: string;
    };
    expect(hydrated.status).toBe("error");
    expect(harness.block?.reason).toBe("conflict");
    expect(harness.persisted).not.toHaveBeenCalled();
  });

  it("does not load maintenance modules during ordinary hydration or saving", async () => {
    const { result } = renderCareer();
    await harness.query!({ signal: new AbortController().signal });
    result.update({ ...harness.local!, round: 2 });
    await harness.mutation;
    expect(harness.local?.round).toBe(2);
    expect(harness.loadReset).not.toHaveBeenCalled();
    expect(harness.loadRecovery).not.toHaveBeenCalled();
  });

  it("does not request migration code for an empty account", async () => {
    harness.local = null;
    harness.cloud = null;
    renderCareer();
    const empty = (await harness.query!({ signal: new AbortController().signal })) as {
      career: CareerState | null;
      status: string;
    };
    expect(empty).toMatchObject({ career: null, status: "empty" });
    expect(harness.loadMigration).not.toHaveBeenCalled();
  });

  it("does not request migration code when accepting a mutation from the already hydrated cache", async () => {
    const { result } = renderCareer();
    result.update({ ...harness.local!, round: 2 });
    await harness.mutation;
    expect(harness.local).toMatchObject({ round: 2 });
    expect(harness.loadMigration).not.toHaveBeenCalled();
  });

  it("rejects hydration if migration code cannot load and preserves the raw snapshot and outbox", async () => {
    harness.online = false;
    const raw = harness.local;
    const pending = { state: raw!, generation: 3, revision: "unmigrated", at: 101 };
    harness.pending = pending;
    harness.loadMigration.mockRejectedValue(new Error("migration chunk unavailable"));
    renderCareer();
    await expect(harness.query!({ signal: new AbortController().signal })).rejects.toThrow(
      "migration chunk unavailable",
    );
    expect(harness.local).toBe(raw);
    expect(harness.pending).toBe(pending);
    expect(harness.persisted).not.toHaveBeenCalled();
    expect(harness.save).not.toHaveBeenCalled();
  });

  it("does not migrate or expose the previous owner after its screen unmounts during loading", async () => {
    const migration = await import("@/game/career-migration");
    const migrate = vi.fn(migration.migrateCareer);
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness.loadMigration.mockImplementation(async () => {
      await delayed;
      return { ...migration, migrateCareer: migrate };
    });
    const { unmount } = renderCareer();
    const query = harness.query!({ signal: new AbortController().signal });
    await vi.waitFor(() => expect(harness.loadMigration).toHaveBeenCalledTimes(1));
    unmount();
    harness.owner = "account-b";
    release();
    await expect(query).rejects.toThrow("stale career hydration operation");
    expect(migrate).not.toHaveBeenCalled();
    expect(harness.persisted).not.toHaveBeenCalled();
  });

  it("does not migrate a snapshot after its career epoch changes while migration code loads", async () => {
    const migration = await import("@/game/career-migration");
    const migrate = vi.fn(migration.migrateCareer);
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness.loadMigration.mockImplementation(async () => {
      await delayed;
      return { ...migration, migrateCareer: migrate };
    });
    renderCareer();
    const query = harness.query!({ signal: new AbortController().signal });
    await vi.waitFor(() => expect(harness.loadMigration).toHaveBeenCalledTimes(1));
    harness.epoch += 1;
    release();
    await expect(query).rejects.toThrow("stale career hydration operation");
    expect(migrate).not.toHaveBeenCalled();
    expect(harness.persisted).not.toHaveBeenCalled();
  });

  it("retains a newer completed write instead of publishing the snapshot captured before migration loaded", async () => {
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness.loadMigration.mockImplementation(async () => {
      await delayed;
      return import("@/game/career-migration");
    });
    const { result } = renderCareer();
    const query = harness.query!({ signal: new AbortController().signal });
    await vi.waitFor(() => expect(harness.loadMigration).toHaveBeenCalledTimes(1));
    result.update({ ...harness.local!, round: 2 });
    await harness.mutation;
    release();
    await expect(query).rejects.toThrow("stale career hydration operation");
    expect(harness.local?.round).toBe(2);
    expect(harness.persisted).toHaveBeenCalledTimes(1);
  });

  it("blocks delayed migration while a new local write is pending before its revision advances", async () => {
    let releaseMigration!: () => void;
    let releaseWrite!: () => void;
    const delayedMigration = new Promise<void>((resolve) => {
      releaseMigration = resolve;
    });
    const delayedWrite = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    harness.loadMigration.mockImplementation(async () => {
      await delayedMigration;
      return import("@/game/career-migration");
    });
    harness.persisted.mockImplementation(async (state: CareerState) => {
      await delayedWrite;
      harness.local = state;
      return true;
    });
    const { result } = renderCareer();
    const query = harness.query!({ signal: new AbortController().signal });
    await vi.waitFor(() => expect(harness.loadMigration).toHaveBeenCalledTimes(1));
    result.update({ ...harness.local!, round: 2 });
    await vi.waitFor(() => expect(harness.persisted).toHaveBeenCalledTimes(1));
    releaseMigration();
    await expect(query).rejects.toThrow("stale career hydration operation");
    releaseWrite();
    await harness.mutation;
    expect(harness.local?.round).toBe(2);
    expect(harness.persisted).toHaveBeenCalledTimes(1);
  });

  it("keeps an outbox unacknowledged after a migration load failure and retries it on reconnect", async () => {
    const pending = { state: harness.local!, generation: 3, revision: "retry-after-load", at: 101 };
    harness.pending = pending;
    harness.loadMigration.mockRejectedValue(new Error("migration chunk unavailable"));
    renderCareer();
    const reconnect = mountReconnectEffect();
    await vi.waitFor(() => expect(harness.loadMigration).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(harness.pending).toBe(pending);
    expect(harness.save).not.toHaveBeenCalled();
    harness.loadMigration.mockImplementation(() => import("@/game/career-migration"));
    reconnect.reconnect();
    await vi.waitFor(() => expect(harness.save).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(harness.pending).toBeNull());
    reconnect.unmount();
  });

  it("does not upload an old outbox after its screen unmounts during migration loading", async () => {
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = { state: harness.local!, generation: 3, revision: "old-owner", at: 101 };
    harness.pending = pending;
    harness.loadMigration.mockImplementation(async () => {
      await delayed;
      return import("@/game/career-migration");
    });
    const screen = renderCareer();
    const reconnect = mountReconnectEffect();
    await vi.waitFor(() => expect(harness.loadMigration).toHaveBeenCalledTimes(1));
    screen.unmount();
    harness.owner = "account-b";
    release();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.pending).toBe(pending);
    expect(harness.save).not.toHaveBeenCalled();
    reconnect.unmount();
  });

  it("does not upload an old outbox if another screen completed a new write during migration loading", async () => {
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness.pending = { state: harness.local!, generation: 3, revision: "before-write", at: 101 };
    harness.loadMigration.mockImplementation(async () => {
      await delayed;
      return import("@/game/career-migration");
    });
    renderCareer();
    const reconnect = mountReconnectEffect();
    await vi.waitFor(() => expect(harness.loadMigration).toHaveBeenCalledTimes(1));
    const nextScreen = renderCareer();
    nextScreen.result.update({ ...harness.local!, round: 2 });
    await harness.mutation;
    expect(harness.save).toHaveBeenCalledTimes(1);
    release();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.save).toHaveBeenCalledTimes(1);
    expect(harness.local?.round).toBe(2);
    reconnect.unmount();
  });

  it("keeps pending_save protected when the exceptional recovery module is unavailable", async () => {
    harness.block = { reason: "pending_save", generation: 3, blockedAt: "now" };
    harness.loadRecovery.mockRejectedValue(new Error("repair chunk unavailable"));
    renderCareer();
    const data = (await harness.query!({ signal: new AbortController().signal })) as {
      status: string;
    };
    expect(data.status).toBe("error");
    expect(harness.block?.reason).toBe("pending_save");
    expect(harness.persisted).not.toHaveBeenCalled();
    expect(harness.queue).not.toHaveBeenCalled();
  });

  it("rechecks the hydration epoch after a delayed recovery module load", async () => {
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness.block = { reason: "pending_save", generation: 3, blockedAt: "now" };
    harness.loadRecovery.mockImplementation(async () => {
      await delayed;
      return import("@/lib/career-save-recovery");
    });
    renderCareer();
    const query = harness.query!({ signal: new AbortController().signal });
    await vi.waitFor(() => expect(harness.loadRecovery).toHaveBeenCalledTimes(1));
    harness.epoch += 1;
    release();
    await expect(query).rejects.toThrow("stale career hydration operation");
    expect(harness.block?.reason).toBe("pending_save");
    expect(harness.persisted).not.toHaveBeenCalled();
  });

  it("releases the synchronous reset gate if the reset chunk cannot load", async () => {
    harness.loadReset.mockRejectedValue(new Error("reset chunk unavailable"));
    const { result } = renderCareer();
    await expect(result.reset()).resolves.toEqual({ ok: false, reason: "preflight" });
    result.update({ ...harness.local!, round: 2 });
    await harness.mutation;
    expect(harness.local?.round).toBe(2);
    expect(harness.wipe).not.toHaveBeenCalled();
  });

  it("does not delete a career after its screen identity unmounts while the reset chunk loads", async () => {
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness.loadReset.mockImplementation(async () => {
      await delayed;
      return import("@/lib/career-reset");
    });
    const { result, unmount } = renderCareer();
    const reset = result.reset();
    expect(harness.loadReset).toHaveBeenCalledTimes(1);
    unmount();
    harness.owner = "account-b";
    release();
    await expect(reset).resolves.toEqual({ ok: false, reason: "identity_changed" });
    expect(harness.wipe).not.toHaveBeenCalled();
  });

  it("rechecks the shared write revision after a delayed reset load even if another screen finished its upload", async () => {
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness.loadReset.mockImplementation(async () => {
      await delayed;
      return import("@/lib/career-reset");
    });
    const first = renderCareer();
    const reset = first.result.reset();
    const second = renderCareer();
    second.result.update({ ...harness.local!, round: 2 });
    await harness.mutation;
    expect(harness.pending).toBeNull();
    release();
    await expect(reset).resolves.toEqual({ ok: false, reason: "preflight" });
    expect(harness.local?.round).toBe(2);
    expect(harness.wipe).not.toHaveBeenCalled();
  });
});
