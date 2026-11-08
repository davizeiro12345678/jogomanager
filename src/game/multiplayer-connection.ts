export type LiveRoomConnectionState =
  | {
      pausePresentation: false;
      notice: null;
    }
  | {
      pausePresentation: true;
      notice: {
        title: string;
        detail: string;
      };
    };

/** Statuses normalizados do canal/socket, separados de navigator.onLine. */
export type LiveRoomRealtimeStatus =
  "connecting" | "subscribed" | "channel_error" | "timed_out" | "closed";

export interface LiveRoomRealtimeConnectionInput {
  browserOnline: boolean;
  realtimeStatus: LiveRoomRealtimeStatus;
  /** Número de tentativas já iniciadas desde a última inscrição confirmada. */
  reconnectAttempt?: number;
  /** Revisão mais recente conhecida no servidor, quando disponível. */
  serverRevision?: number | null;
  /** Última revisão aplicada à apresentação local. */
  appliedRevision?: number | null;
}

export interface LiveRoomRealtimeConnectionState {
  browserOnline: boolean;
  realtimeStatus: LiveRoomRealtimeStatus;
  pausePresentation: boolean;
  notice: { title: string; detail: string } | null;
  reconnectAttempt: number;
  /** Null while subscribed or while an in-flight connection is pending. */
  reconnectDelayMs: number | null;
  /** Cursor from which the caller should request a fresh authoritative snapshot. */
  resyncFromRevision: number | null;
}

/** A queda de rede não encerra uma sala já iniciada. A simulação exibida neste
 * navegador fica pausada até que a inscrição em tempo real seja restabelecida;
 * o placar final continua pertencendo ao replay do servidor.
 *
 * The boolean overload remains for existing callers. New room code must pass
 * the structured input so browser reachability cannot masquerade as a live
 * Realtime subscription.
 */
export function getLiveRoomConnectionState(online: boolean): LiveRoomConnectionState;
export function getLiveRoomConnectionState(
  input: LiveRoomRealtimeConnectionInput,
): LiveRoomRealtimeConnectionState;
export function getLiveRoomConnectionState(
  input: boolean | LiveRoomRealtimeConnectionInput,
): LiveRoomConnectionState | LiveRoomRealtimeConnectionState {
  if (typeof input === "boolean") {
    return legacyConnectionState(input);
  }

  const reconnectAttempt = normalizeReconnectAttempt(input.reconnectAttempt ?? 0);
  const appliedRevision = normalizeRevision(input.appliedRevision);
  const serverRevision = normalizeRevision(input.serverRevision);
  const realtimeConnected = input.realtimeStatus === "subscribed";
  const pausePresentation = !input.browserOnline || !realtimeConnected;
  const hasNewServerRevision =
    serverRevision !== null && (appliedRevision === null || serverRevision > appliedRevision);
  const resyncFromRevision =
    realtimeConnected && (reconnectAttempt > 0 || hasNewServerRevision)
      ? (appliedRevision ?? 0)
      : null;

  return {
    browserOnline: input.browserOnline,
    realtimeStatus: input.realtimeStatus,
    pausePresentation,
    notice: pausePresentation
      ? {
          title: "Reconectando à sala",
          detail: input.browserOnline
            ? "A rede está disponível, mas a conexão em tempo real da sala ainda não foi confirmada."
            : "A apresentação foi pausada. Quando a conexão voltar, o placar oficial continuará vindo do servidor.",
        }
      : null,
    reconnectAttempt,
    reconnectDelayMs:
      input.browserOnline && !realtimeConnected && input.realtimeStatus !== "connecting"
        ? getRealtimeReconnectDelayMs(reconnectAttempt)
        : null,
    resyncFromRevision,
  };
}

const REALTIME_RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000] as const;

/** Deterministic exponential backoff; the last slot is a hard upper bound. */
export function getRealtimeReconnectDelayMs(attempt: number): number {
  const normalizedAttempt = normalizeReconnectAttempt(attempt);
  return REALTIME_RECONNECT_DELAYS_MS[
    Math.min(normalizedAttempt, REALTIME_RECONNECT_DELAYS_MS.length - 1)
  ]!;
}

export interface LiveRoomRevisionResult {
  accepted: boolean;
  appliedRevision: number | null;
}

/**
 * Realtime is a presentation transport only. A snapshot can advance this
 * cursor, never rewind it; score, seed and final result remain server-owned.
 */
export function reconcileLiveRoomRevision(
  appliedRevision: number | null,
  incomingRevision: number,
): LiveRoomRevisionResult {
  const current = normalizeRevision(appliedRevision);
  const incoming = normalizeRevision(incomingRevision);
  if (incoming === null || (current !== null && incoming <= current)) {
    return { accepted: false, appliedRevision: current };
  }
  return { accepted: true, appliedRevision: incoming };
}

function legacyConnectionState(online: boolean): LiveRoomConnectionState {
  if (online) {
    return { pausePresentation: false, notice: null };
  }

  return {
    pausePresentation: true,
    notice: {
      title: "Reconectando à sala",
      detail:
        "A apresentação foi pausada. Quando a conexão voltar, o placar oficial continuará vindo do servidor.",
    },
  };
}

function normalizeReconnectAttempt(attempt: number): number {
  if (!Number.isSafeInteger(attempt) || attempt < 0) {
    throw new RangeError("reconnect attempt must be a non-negative safe integer");
  }
  return attempt;
}

function normalizeRevision(revision: number | null | undefined): number | null {
  return revision !== null &&
    revision !== undefined &&
    Number.isSafeInteger(revision) &&
    revision >= 0
    ? revision
    : null;
}
