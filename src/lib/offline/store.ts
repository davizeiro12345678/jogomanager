/**
 * Camada de persistência offline.
 *
 * Guarda a carreira no IndexedDB (mais espaço e mais durável que o
 * localStorage), mantém um histórico das últimas 10 versões e uma fila de
 * envio ("outbox") com o que ainda não foi para a nuvem.
 * O localStorage continua sendo espelhado para leituras síncronas rápidas
 * (a home precisa saber na hora se existe carreira).
 */
import { clear, del, get, set } from "idb-keyval";

import type { CareerState } from "@/game/types";

export const LEGACY_KEY = "manager3d.career.v1";
const K_CAREER = "career.state";
const K_SAVED_AT = "career.savedAt";
const K_SNAPSHOTS = "career.snapshots";
const K_OUTBOX = "career.outbox";

const MAX_SNAPSHOTS = 10;

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

/* ------------------------------------------------------------------ *
 * Espelho síncrono (localStorage)
 * ------------------------------------------------------------------ */

export function readLocalCareer(): CareerState | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    return raw ? (JSON.parse(raw) as CareerState) : null;
  } catch {
    return null;
  }
}

function mirror(state: CareerState | null) {
  if (!isBrowser()) return;
  try {
    if (state) window.localStorage.setItem(LEGACY_KEY, JSON.stringify(state));
    else window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* modo privado ou cota cheia — o jogo segue em memória */
  }
}

/* ------------------------------------------------------------------ *
 * Carreira
 * ------------------------------------------------------------------ */

export async function loadLocalCareer(): Promise<CareerState | null> {
  if (!isBrowser()) return null;
  try {
    const stored = await get<CareerState>(K_CAREER);
    if (stored) return stored;
  } catch {
    /* IndexedDB indisponível — usa o espelho */
  }
  // Migração automática da chave antiga.
  const legacy = readLocalCareer();
  if (legacy) {
    await saveLocalCareer(legacy, "migração");
    return legacy;
  }
  return null;
}

export async function localSavedAt(): Promise<number> {
  if (!isBrowser()) return 0;
  try {
    return (await get<number>(K_SAVED_AT)) ?? 0;
  } catch {
    return 0;
  }
}

export async function saveLocalCareer(state: CareerState, label = "auto") {
  if (!isBrowser()) return;
  mirror(state);
  try {
    await set(K_CAREER, state);
    await set(K_SAVED_AT, Date.now());
    const list = (await get<Snapshot[]>(K_SNAPSHOTS)) ?? [];
    const next = [{ at: Date.now(), label, state }, ...list].slice(0, MAX_SNAPSHOTS);
    await set(K_SNAPSHOTS, next);
  } catch {
    /* sem IndexedDB: o espelho já garante o essencial */
  }
}

export async function listSnapshots(): Promise<Snapshot[]> {
  if (!isBrowser()) return [];
  try {
    return (await get<Snapshot[]>(K_SNAPSHOTS)) ?? [];
  } catch {
    return [];
  }
}

export async function clearLocalCareer() {
  mirror(null);
  if (!isBrowser()) return;
  try {
    await del(K_CAREER);
    await del(K_SAVED_AT);
    await del(K_OUTBOX);
  } catch {
    /* ignore */
  }
}

export async function wipeEverything() {
  mirror(null);
  try {
    await clear();
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ *
 * Fila de envio
 * ------------------------------------------------------------------ */

export async function queueSync(state: CareerState) {
  if (!isBrowser()) return;
  try {
    await set(K_OUTBOX, { at: Date.now(), state } satisfies OutboxEntry);
  } catch {
    /* ignore */
  }
}

export async function readOutbox(): Promise<OutboxEntry | null> {
  if (!isBrowser()) return null;
  try {
    return (await get<OutboxEntry>(K_OUTBOX)) ?? null;
  } catch {
    return null;
  }
}

export async function clearOutbox() {
  if (!isBrowser()) return;
  try {
    await del(K_OUTBOX);
  } catch {
    /* ignore */
  }
}

export function isOnline() {
  if (!isBrowser()) return true;
  return navigator.onLine !== false;
}
