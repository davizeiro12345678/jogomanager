import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { CareerState } from "@/game/types";

export type CareerSyncState =
  "local" | "saving" | "unsaved" | "syncing" | "synced" | "pending" | "offline";
export const CAREER_SAVE_ERROR =
  "Não foi possível salvar as últimas alterações neste aparelho. Elas continuam abertas apenas nesta sessão. Exporte a carreira antes de fechar ou recarregar a página.";
interface PersistenceFeedback {
  attempt: number;
  signature: string;
  phase: "saving" | "failed" | "verified";
  error: boolean;
}
export interface CareerQueryData {
  career: CareerState | null;
  sync: CareerSyncState;
  readAttempt?: number;
  persistence?: PersistenceFeedback;
}
export interface CareerSaveTicket {
  attempt: number;
  signature: string;
  baseline: string;
  state: CareerState;
  optimistic: boolean;
  verified: boolean;
}
type SyncGuard = Pick<CareerSaveTicket, "attempt" | "signature">;
const counters = new WeakMap<QueryClient, Map<string, number>>();
const signature = (state: CareerState | null | undefined) => JSON.stringify(state ?? null);
const read = (client: QueryClient, key: QueryKey) => client.getQueryData<CareerQueryData>(key);
function nextAttempt(client: QueryClient, key: QueryKey): number {
  let scopes = counters.get(client);
  if (!scopes) {
    scopes = new Map();
    counters.set(client, scopes);
  }
  const scope = JSON.stringify(key);
  const next = Math.max(scopes.get(scope) ?? 0, read(client, key)?.persistence?.attempt ?? 0) + 1;
  scopes.set(scope, next);
  return next;
}
const matches = (data: CareerQueryData | undefined, ticket: SyncGuard) =>
  data?.persistence?.attempt === ticket.attempt && signature(data.career) === ticket.signature;

export function hasUnpersistedCareer(data: CareerQueryData | undefined): boolean {
  return Boolean(
    data?.persistence &&
    data.persistence.phase !== "verified" &&
    signature(data.career) === data.persistence.signature,
  );
}
export function careerFeedbackSync(data: CareerQueryData | undefined): CareerSyncState {
  if (data?.persistence?.error && hasUnpersistedCareer(data)) return "unsaved";
  if (hasUnpersistedCareer(data)) return "saving";
  return data?.sync ?? "local";
}
/** A late fetch cannot replace a still-unpersisted in-memory save. */
export function preserveCareerMemory(previous: unknown, incoming: unknown): unknown {
  const old = previous as CareerQueryData | undefined;
  const next = incoming as CareerQueryData | undefined;
  if (old?.persistence) {
    if (next?.persistence && next.persistence.attempt < old.persistence.attempt) return previous;
    if (
      !next?.persistence &&
      (hasUnpersistedCareer(old) || (next?.readAttempt ?? -1) < old.persistence.attempt)
    )
      return previous;
  }
  return incoming;
}
export function beginCareerSave(
  client: QueryClient,
  key: QueryKey,
  state: CareerState,
  optimistic = true,
): CareerSaveTicket {
  const old = read(client, key);
  const ticket: CareerSaveTicket = {
    attempt: nextAttempt(client, key),
    signature: signature(state),
    baseline: signature(old?.career),
    state,
    optimistic,
    verified: false,
  };
  if (optimistic)
    client.setQueryData<CareerQueryData>(key, {
      career: state,
      sync: "saving",
      persistence: {
        attempt: ticket.attempt,
        signature: ticket.signature,
        phase: "saving",
        error: old?.persistence?.error ?? false,
      },
    });
  return ticket;
}
export function failCareerSave(client: QueryClient, key: QueryKey, ticket: CareerSaveTicket): void {
  if (ticket.verified || !matches(read(client, key), ticket)) return;
  client.setQueryData<CareerQueryData>(key, (data) =>
    data && matches(data, ticket)
      ? {
          ...data,
          sync: "unsaved",
          persistence: {
            attempt: ticket.attempt,
            signature: ticket.signature,
            phase: "failed",
            error: true,
          },
        }
      : data,
  );
}
export function verifyCareerSave(
  client: QueryClient,
  key: QueryKey,
  ticket: CareerSaveTicket,
  sync: CareerSyncState,
): boolean {
  ticket.verified = true;
  if (!ticket.optimistic || !matches(read(client, key), ticket)) return false;
  client.setQueryData<CareerQueryData>(key, (data) =>
    data && matches(data, ticket)
      ? {
          ...data,
          sync,
          persistence: {
            attempt: ticket.attempt,
            signature: ticket.signature,
            phase: "verified",
            error: false,
          },
        }
      : data,
  );
  return true;
}
export function publishVerifiedRestore(
  client: QueryClient,
  key: QueryKey,
  ticket: CareerSaveTicket,
  sync: CareerSyncState,
): boolean {
  const current = read(client, key);
  if (
    !ticket.verified ||
    (current?.persistence?.attempt ?? 0) > ticket.attempt ||
    signature(current?.career) !== ticket.baseline
  )
    return false;
  client.setQueryData<CareerQueryData>(key, {
    career: ticket.state,
    sync,
    persistence: {
      attempt: ticket.attempt,
      signature: ticket.signature,
      phase: "verified",
      error: false,
    },
  });
  return true;
}

/** Retain both the visible session and durable save before replacing either. */
export async function retainCareerRestoreSources(
  memory: CareerState | null,
  durable: CareerState | null,
  replacement: CareerState,
  backup: (state: CareerState) => Promise<void>,
): Promise<void> {
  const seen = new Set([signature(replacement)]);
  for (const original of [memory, durable]) {
    if (!original) continue;
    const value = signature(original);
    if (seen.has(value)) continue;
    seen.add(value);
    await backup(original);
  }
}
export function careerSyncGuard(data: CareerQueryData | undefined): SyncGuard {
  return { attempt: data?.persistence?.attempt ?? 0, signature: signature(data?.career) };
}
export function applyCareerSync(
  client: QueryClient,
  key: QueryKey,
  sync: CareerSyncState,
  guard: SyncGuard,
): void {
  client.setQueryData<CareerQueryData>(key, (data) => {
    if (
      !data ||
      hasUnpersistedCareer(data) ||
      (data.persistence?.attempt ?? 0) !== guard.attempt ||
      signature(data.career) !== guard.signature
    )
      return data;
    return { ...data, sync };
  });
}
export function clearCareerMemory(client: QueryClient, key: QueryKey, sync: CareerSyncState): void {
  client.setQueryData<CareerQueryData>(key, {
    career: null,
    sync,
    persistence: {
      attempt: nextAttempt(client, key),
      signature: "null",
      phase: "verified",
      error: false,
    },
  });
}
