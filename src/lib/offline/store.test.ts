import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CareerState } from "@/game/types";

const { indexed } = vi.hoisted(() => ({ indexed: new Map<string, unknown>() }));

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => indexed.get(key)),
  set: vi.fn(async (key: string, value: unknown) => void indexed.set(key, value)),
  del: vi.fn(async (key: string) => void indexed.delete(key)),
  clear: vi.fn(async () => void indexed.clear()),
}));

import {
  LEGACY_KEY,
  clearOutbox,
  loadLocalCareer,
  queueSync,
  readLocalCareer,
  readOutbox,
  saveLocalCareer,
} from "./store";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const career = (managerName: string) => ({ managerName }) as CareerState;

describe("offline career owner boundary", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    indexed.clear();
    storage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
    vi.stubGlobal("navigator", { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps saves, snapshots and sync outboxes separated for each account", async () => {
    const alice = career("Alice");
    const bruno = career("Bruno");
    await saveLocalCareer(alice, "alice", "alice-id");
    await saveLocalCareer(bruno, "bruno", "bruno-id");
    await queueSync(alice, "alice-id");
    await queueSync(bruno, "bruno-id");

    expect(readLocalCareer("alice-id")).toEqual(alice);
    expect(readLocalCareer("bruno-id")).toEqual(bruno);
    expect(await loadLocalCareer("alice-id")).toEqual(alice);
    expect(await readOutbox("alice-id")).toMatchObject({ state: alice });
    expect(await readOutbox("bruno-id")).toMatchObject({ state: bruno });

    await clearOutbox("alice-id");
    expect(await readOutbox("alice-id")).toBeNull();
    expect(await readOutbox("bruno-id")).toMatchObject({ state: bruno });
  });

  it("treats legacy shared storage as a guest save and never gives it to a signed-in account", async () => {
    const guest = career("Visitante antigo");
    storage.setItem(LEGACY_KEY, JSON.stringify(guest));

    expect(readLocalCareer()).toEqual(guest);
    expect(readLocalCareer("new-account")).toBeNull();
    expect(await loadLocalCareer("new-account")).toBeNull();
    expect(await loadLocalCareer()).toEqual(guest);
  });
});
