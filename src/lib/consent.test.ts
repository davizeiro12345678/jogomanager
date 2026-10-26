import { afterEach, expect, it, vi } from "vitest";

const localData = vi.hoisted(() => ({
  exportCareer: vi.fn(async () => ({ career: { season: 4 }, snapshots: [{ season: 3 }] })),
  clearCareer: vi.fn(async () => true),
  exportReplays: vi.fn(async () => ({ "manager3d.replays.catalog.v1": [] })),
  clearReplays: vi.fn(async () => true),
  clearVoice: vi.fn(async () => true),
}));

vi.mock("@/lib/offline/store", () => ({
  exportLocalCareerData: localData.exportCareer,
  clearLocalCareerData: localData.clearCareer,
}));
vi.mock("@/game/replay-storage", () => ({
  exportReplayArchive: localData.exportReplays,
  clearReplayArchive: localData.clearReplays,
}));
vi.mock("@/game/audio-cache", () => ({ clearVoiceCache: localData.clearVoice }));

import { canAccessCareerMirror, clearLocalData, exportLocalData } from "./consent";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function browserStorage(seed: Record<string, string>) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    storage: {
      get length() {
        return values.size;
      },
      key: (index: number) => [...values.keys()][index] ?? null,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  };
}

it("exports browser preferences, offline career and replay data without auth tokens", async () => {
  const { storage } = browserStorage({
    "pfm-consent-v1": JSON.stringify({ analytics: false }),
    "sb-project-auth-token": "secret-session-token",
    "manager3d.career.v1:user:other-account": "private-other-career",
  });
  vi.stubGlobal("window", { localStorage: storage });

  const exported = await exportLocalData();

  expect(exported["pfm-consent-v1"]).toEqual({ analytics: false });
  expect(exported["offlineCareer"]).toEqual({ career: { season: 4 }, snapshots: [{ season: 3 }] });
  expect(exported["localReplayArchive"]).toEqual({ "manager3d.replays.catalog.v1": [] });
  expect(exported).not.toHaveProperty("sb-project-auth-token");
  expect(exported).not.toHaveProperty("manager3d.career.v1:user:other-account");
  expect(localData.exportCareer).toHaveBeenCalledOnce();
  expect(localData.exportReplays).toHaveBeenCalledOnce();
});

it("clears local game stores and preferences while preserving the Supabase session", async () => {
  const { values, storage } = browserStorage({
    "pfm-consent-v1": "preferences",
    "manager3d.athlete.v2.guest.1": "local-player-save",
    "sb-project-auth-token": "session-remains",
  });
  vi.stubGlobal("window", { localStorage: storage });

  await expect(clearLocalData()).resolves.toBe(true);

  expect([...values.entries()]).toEqual([["sb-project-auth-token", "session-remains"]]);
  expect(localData.clearCareer).toHaveBeenCalledOnce();
  expect(localData.clearReplays).toHaveBeenCalledOnce();
  expect(localData.clearVoice).toHaveBeenCalledOnce();
});

it("reports incomplete local deletion if an IndexedDB store cannot be cleared", async () => {
  const { values, storage } = browserStorage({ "pfm-consent-v1": "preferences" });
  vi.stubGlobal("window", { localStorage: storage });
  localData.clearReplays.mockResolvedValueOnce(false);

  await expect(clearLocalData()).resolves.toBe(false);
  expect(values.size).toBe(0);
});

it("never exports or deletes a different account career mirror", () => {
  expect(canAccessCareerMirror("manager3d.career.v1:user:alice", "bob")).toBe(false);
  expect(canAccessCareerMirror("manager3d.career.v1:user:alice", "alice")).toBe(true);
  expect(canAccessCareerMirror("manager3d.career.v1:user:alice", null)).toBe(false);
  expect(canAccessCareerMirror("manager3d.career.v1", "alice")).toBe(false);
  expect(canAccessCareerMirror("manager3d.career.v1", null)).toBe(true);
});

it("exports and clears only allowlisted preferences and the selected account data", async () => {
  const seed = {
    "pfm-consent-v1": "public-preference",
    "provider.access_token": "never-export-or-delete",
    "sb-project-auth-token": "auth-remains",
    "manager3d.athlete.envelope.v1.user:alice.1": JSON.stringify({ owner: "alice" }),
    "manager3d.athlete.envelope.v1.user:bob.1": JSON.stringify({ owner: "bob" }),
    "manager3d.athlete.outbox.v1.user:alice": "alice-pending",
    "manager3d.athlete.backup.v1.guest.1": "guest-backup",
    "manager3d.career.v1:user:alice": "alice-manager",
    "manager3d.career.v1:user:bob": "bob-manager",
    "manager3d.unknown.secret": "unknown-remains",
  };
  const { values, storage } = browserStorage(seed);
  vi.stubGlobal("window", { localStorage: storage });
  const exported = await exportLocalData("alice");
  expect(exported["manager3d.athlete.envelope.v1.user:alice.1"]).toEqual({ owner: "alice" });
  for (const key of [
    "provider.access_token",
    "sb-project-auth-token",
    "manager3d.athlete.envelope.v1.user:bob.1",
    "manager3d.career.v1:user:bob",
    "manager3d.athlete.backup.v1.guest.1",
    "manager3d.unknown.secret",
  ])
    expect(exported).not.toHaveProperty(key);
  expect(localData.exportReplays).toHaveBeenCalledWith("alice");
  expect(localData.exportCareer).toHaveBeenCalledWith("alice");
  await expect(clearLocalData("alice")).resolves.toBe(true);
  expect(localData.clearCareer).toHaveBeenCalledWith("alice");
  expect(localData.clearReplays).toHaveBeenCalledWith("alice");
  expect(localData.clearVoice).not.toHaveBeenCalled();
  expect(values.has("manager3d.athlete.envelope.v1.user:alice.1")).toBe(false);
  for (const key of [
    "provider.access_token",
    "sb-project-auth-token",
    "manager3d.athlete.envelope.v1.user:bob.1",
    "manager3d.career.v1:user:bob",
    "manager3d.athlete.backup.v1.guest.1",
    "manager3d.unknown.secret",
  ])
    expect(values.get(key)).toBe(seed[key as keyof typeof seed]);
});

it("guest operations preserve account envelopes and unknown keys while including guest legacy data", async () => {
  const { values, storage } = browserStorage({
    "manager3d.athlete.v1.1": "legacy-guest",
    "pfm.player-career.v1": "guest-profile",
    "manager3d.athlete.conflict-backup.v1.guest.2": "guest-conflict",
    "manager3d.athlete.index.v1.user:bob": "bob-index",
    "third-party-token": "untouched",
  });
  vi.stubGlobal("window", { localStorage: storage });
  const exported = await exportLocalData(null);
  expect(exported["manager3d.athlete.v1.1"]).toBe("legacy-guest");
  expect(exported["manager3d.athlete.conflict-backup.v1.guest.2"]).toBe("guest-conflict");
  expect(exported).not.toHaveProperty("manager3d.athlete.index.v1.user:bob");
  await clearLocalData(null);
  expect([...values.entries()]).toEqual([
    ["manager3d.athlete.index.v1.user:bob", "bob-index"],
    ["third-party-token", "untouched"],
  ]);
  expect(localData.exportReplays).toHaveBeenCalledOnce();
  expect(localData.clearReplays).toHaveBeenCalledOnce();
});
it.each(["alice", "bob"])(
  "applies export and delete to every supported athlete key only for %s",
  async (owner) => {
    const other = owner === "alice" ? "bob" : "alice";
    const seed: Record<string, string> = {};
    const slotPrefixes = ["v2", "envelope.v1", "backup.v1", "conflict-backup.v1"];
    for (const id of [owner, other]) {
      for (const prefix of slotPrefixes)
        for (const slot of [1, 2, 3])
          seed[`manager3d.athlete.${prefix}.user:${id}.${slot}`] = JSON.stringify({
            owner: id,
            slot,
          });
      for (const prefix of ["index.v1", "outbox.v1", "cloud-revisions.v1"])
        seed[`manager3d.athlete.${prefix}.user:${id}`] = JSON.stringify({ owner: id });
    }
    const { values, storage } = browserStorage(seed);
    vi.stubGlobal("window", { localStorage: storage });
    const exported = await exportLocalData(owner);
    for (const key of Object.keys(seed)) {
      if (key.includes(`user:${owner}`)) expect(exported[key]).toEqual(JSON.parse(seed[key]!));
      else expect(exported).not.toHaveProperty(key);
    }
    await clearLocalData(owner);
    for (const key of Object.keys(seed))
      expect(values.has(key)).toBe(key.includes(`user:${other}`));
  },
);
