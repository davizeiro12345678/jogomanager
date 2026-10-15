/**
 * Persistência offline de carreira.
 *
 * O aparelho pode ser compartilhado. Por isso cada conta e o modo visitante
 * possuem compartimentos independentes no IndexedDB e no espelho local. Saves
 * antigos, que não tinham dono, são tratados exclusivamente como visitante;
 * nunca são adotados silenciosamente por quem acabou de entrar na conta.
 */
import { clear, del, get, set } from "idb-keyval";

import type { CareerState } from "@/game/types";

/** Chave de compatibilidade de saves locais sem dono (visitante). */
export const LEGACY_KEY = "manager3d.career.v1";
const LEGACY_IDB = {
  career: "career.state",
  savedAt: "career.savedAt",
  snapshots: "career.snapshots",
  outbox: "career.outbox",
} as const;
const LOCAL_PREFIX = "manager3d.career.v2.";
const IDB_PREFIX = "career.v2.";
const MAX_SNAPSHOTS = 10;

export type LocalOwnerId = string | null;

export interface Snapshot {
  at: number;
  label: string;
  state: CareerState;
}

export interface OutboxEntry {
  at: number;
  state: CareerState;
}

const isBrowser = () => typeof window !== "undefined";

/** Keeps arbitrary auth subject strings inside a single storage-key segment. */
export function localOwnerScope(owner: LocalOwnerId | undefined = null) {
  return owner && owner.trim() ? `account-${encodeURIComponent(owner)}` : "guest";
}

function idbKey(owner: LocalOwnerId | undefined, name: keyof typeof LEGACY_IDB) {
  return `${IDB_PREFIX}${localOwnerScope(owner)}.${name}`;
}

function localKey(owner: LocalOwnerId | undefined) {
  return `${LOCAL_PREFIX}${localOwnerScope(owner)}`;
}

function isGuest(owner: LocalOwnerId | undefined) {
  return !owner || !owner.trim();
}

/* ------------------------------------------------------------------ *
 * Espelho síncrono (localStorage)
 * ------------------------------------------------------------------ */

/**
 * Reads only the requested compartment. The old shared key is intentionally
 * available to guests alone, so signing into a second account cannot reveal a
 * predecessor's career before that account is loaded from its own storage.
 */
export function readLocalCareer(owner: LocalOwnerId | undefined = null): CareerState | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(localKey(owner));
    if (raw) return JSON.parse(raw) as CareerState;
    if (isGuest(owner)) {
      const legacy = window.localStorage.getItem(LEGACY_KEY);
      return legacy ? (JSON.parse(legacy) as CareerState) : null;
    }
  } catch {
    /* Corrupt local data is ignored instead of blocking the game. */
  }
  return null;
}

function mirror(state: CareerState | null, owner: LocalOwnerId | undefined = null) {
  if (!isBrowser()) return;
  try {
    const key = localKey(owner);
    if (state) window.localStorage.setItem(key, JSON.stringify(state));
    else window.localStorage.removeItem(key);

    // Keep the backwards-compatible mirror only for an unsigned visitor.
    if (isGuest(owner)) {
      if (state) window.localStorage.setItem(LEGACY_KEY, JSON.stringify(state));
      else window.localStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    /* modo privado ou cota cheia — o jogo segue em memória */
  }
}

/* ------------------------------------------------------------------ *
 * Carreira
 * ------------------------------------------------------------------ */

export async function loadLocalCareer(
  owner: LocalOwnerId | undefined = null,
): Promise<CareerState | null> {
  if (!isBrowser()) return null;
  try {
    const stored = await get<CareerState>(idbKey(owner, "career"));
    if (stored) return stored;
  } catch {
    /* IndexedDB indisponível — usa o espelho */
  }

  if (!isGuest(owner)) return null;

  // A migração de chaves sem dono termina no cofre visitante. Ela nunca roda
  // para uma conta autenticada, pois não há prova de que aquele save a pertence.
  try {
    const legacy = await get<CareerState>(LEGACY_IDB.career);
    if (legacy) {
      await saveLocalCareer(legacy, "migração", null);
      return legacy;
    }
  } catch {
    /* fallback below */
  }
  const legacy = readLocalCareer(null);
  if (legacy) {
    await saveLocalCareer(legacy, "migração", null);
    return legacy;
  }
  return null;
}

export async function localSavedAt(owner: LocalOwnerId | undefined = null): Promise<number> {
  if (!isBrowser()) return 0;
  try {
    return (await get<number>(idbKey(owner, "savedAt"))) ?? 0;
  } catch {
    return 0;
  }
}

export async function saveLocalCareer(
  state: CareerState,
  label = "auto",
  owner: LocalOwnerId | undefined = null,
) {
  if (!isBrowser()) return;
  mirror(state, owner);
  try {
    const now = Date.now();
    await set(idbKey(owner, "career"), state);
    await set(idbKey(owner, "savedAt"), now);
    const list = (await get<Snapshot[]>(idbKey(owner, "snapshots"))) ?? [];
    const next = [{ at: now, label, state }, ...list].slice(0, MAX_SNAPSHOTS);
    await set(idbKey(owner, "snapshots"), next);
  } catch {
    /* sem IndexedDB: o espelho já garante o essencial */
  }
}

export async function listSnapshots(owner: LocalOwnerId | undefined = null): Promise<Snapshot[]> {
  if (!isBrowser()) return [];
  try {
    return (await get<Snapshot[]>(idbKey(owner, "snapshots"))) ?? [];
  } catch {
    return [];
  }
}

export async function clearLocalCareer(owner: LocalOwnerId | undefined = null) {
  mirror(null, owner);
  if (!isBrowser()) return;
  try {
    await Promise.all([
      del(idbKey(owner, "career")),
      del(idbKey(owner, "savedAt")),
      del(idbKey(owner, "snapshots")),
      del(idbKey(owner, "outbox")),
    ]);
    if (isGuest(owner)) {
      await Promise.all([
        del(LEGACY_IDB.career),
        del(LEGACY_IDB.savedAt),
        del(LEGACY_IDB.snapshots),
        del(LEGACY_IDB.outbox),
      ]);
    }
  } catch {
    /* ignore */
  }
}

/** Explicit device-wide reset used only by the existing destructive settings action. */
export async function wipeEverything() {
  if (isBrowser()) {
    try {
      const keys = Array.from({ length: window.localStorage.length }, (_, index) =>
        window.localStorage.key(index),
      );
      for (const key of keys) {
        if (key === LEGACY_KEY || key?.startsWith(LOCAL_PREFIX))
          window.localStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
  }
  try {
    await clear();
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ *
 * Fila de envio
 * ------------------------------------------------------------------ */

export async function queueSync(state: CareerState, owner: LocalOwnerId | undefined = null) {
  if (!isBrowser()) return;
  try {
    await set(idbKey(owner, "outbox"), { at: Date.now(), state } satisfies OutboxEntry);
  } catch {
    /* ignore */
  }
}

export async function readOutbox(
  owner: LocalOwnerId | undefined = null,
): Promise<OutboxEntry | null> {
  if (!isBrowser()) return null;
  try {
    return (await get<OutboxEntry>(idbKey(owner, "outbox"))) ?? null;
  } catch {
    return null;
  }
}

export async function clearOutbox(owner: LocalOwnerId | undefined = null) {
  if (!isBrowser()) return;
  try {
    await del(idbKey(owner, "outbox"));
  } catch {
    /* ignore */
  }
}

export function isOnline() {
  if (!isBrowser()) return true;
  return navigator.onLine !== false;
}
