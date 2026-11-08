/**
 * The room's updated_at is the settlement lease version. The match-room
 * trigger refreshes it on every write, and no other operation writes a room
 * while a replay is settling.
 */
export const MATCH_SETTLEMENT_LEASE_MS = 60_000;
export const MATCH_SETTLEMENT_HEARTBEAT_MS = Math.floor(MATCH_SETTLEMENT_LEASE_MS / 3);

export function settlementLeaseCutoff(now = Date.now()): string {
  return new Date(now - MATCH_SETTLEMENT_LEASE_MS).toISOString();
}

export function isSettlementLeaseExpired(updatedAt: string, now = Date.now()): boolean {
  const updatedAtMs = Date.parse(updatedAt);
  return Number.isFinite(updatedAtMs) && updatedAtMs <= now - MATCH_SETTLEMENT_LEASE_MS;
}

export type SettlementLeaseRefresh = (expectedLease: string) => Promise<string | null>;

export interface SettlementLeaseGuard {
  currentLease(): string;
  isLost(): boolean;
  refresh(): Promise<boolean>;
  start(): void;
  stop(): Promise<void>;
}

/**
 * Keeps one in-flight heartbeat per settlement and advances the local fence
 * only after the backing store confirms the expected lease version.
 */
export function createSettlementLeaseGuard(
  initialLease: string,
  refreshLease: SettlementLeaseRefresh,
  heartbeatMs = MATCH_SETTLEMENT_HEARTBEAT_MS,
): SettlementLeaseGuard {
  let current = initialLease;
  let lost = false;
  let inFlight: Promise<boolean> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const refresh = async (): Promise<boolean> => {
    if (lost) return false;
    if (inFlight) return inFlight;

    const expectedLease = current;
    const attempt = (async () => {
      try {
        const nextLease = await refreshLease(expectedLease);
        if (!nextLease) {
          lost = true;
          return false;
        }
        current = nextLease;
        return true;
      } catch {
        lost = true;
        return false;
      }
    })();
    inFlight = attempt;
    try {
      return await attempt;
    } finally {
      if (inFlight === attempt) inFlight = null;
    }
  };

  const start = () => {
    if (timer !== null) return;
    timer = setInterval(() => {
      void refresh();
    }, heartbeatMs);
  };

  const stop = async () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    const pending = inFlight;
    if (pending) await pending;
  };

  return {
    currentLease: () => current,
    isLost: () => lost,
    refresh,
    start,
    stop,
  };
}
