import { useCallback, useEffect, useRef, useState } from "react";

import { SectionCard } from "@/components/game/screen-kit";
import { useT } from "@/i18n/provider";
import { multiplayerMatchmakingMessages } from "@/i18n/multiplayer-matchmaking-messages";
import type { MatchmakingQueueStatus } from "@/lib/matchmaking.functions";

interface Props {
  clubId: string;
  online: boolean;
  onMatched: (roomId: string) => Promise<boolean>;
}

/** UI only: the authenticated server owns the queue, opponent and MMR. */
export function MatchmakingPanel({ clubId, online, onMatched }: Props) {
  const { lang } = useT();
  const copy = multiplayerMatchmakingMessages(lang);
  const [status, setStatus] = useState<MatchmakingQueueStatus | null>(null);
  const [mode, setMode] = useState<"casual" | "ranked">("casual");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const lastOpenedRoom = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!online) return;
    try {
      const { getMatchmakingQueueStatus } = await import("@/lib/matchmaking.functions");
      const state = await getMatchmakingQueueStatus({ data: {} });
      setStatus(state);
      setError(state.status === "unavailable");
    } catch {
      setError(true);
      setStatus({ status: "unavailable" });
    }
  }, [online]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isSearching = status?.status === "waiting" || status?.status === "reserved";
  useEffect(() => {
    if (!isSearching || !online) return;
    const timer = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [isSearching, online, refresh]);

  useEffect(() => {
    if (status?.status !== "matched" || !online) return;
    const roomId = status.roomId;
    if (lastOpenedRoom.current === roomId) return;
    lastOpenedRoom.current = roomId;
    void onMatched(roomId).then(
      (opened) => {
        if (!opened && lastOpenedRoom.current === roomId) {
          lastOpenedRoom.current = null;
          setError(true);
        }
      },
      () => {
        lastOpenedRoom.current = null;
        setError(true);
      },
    );
  }, [online, onMatched, status]);

  async function join() {
    if (!online || busy || isSearching) return;
    setBusy(true);
    setError(false);
    try {
      const { joinMatchmakingQueue } = await import("@/lib/matchmaking.functions");
      const result = await joinMatchmakingQueue({ data: { clubId, mode } });
      if (!result.ok) setError(true);
      else await refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!online || busy || status?.status !== "waiting") return;
    setBusy(true);
    setError(false);
    try {
      const { leaveMatchmakingQueue } = await import("@/lib/matchmaking.functions");
      const result = await leaveMatchmakingQueue({ data: {} });
      if (!result.ok) setError(true);
      else await refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  // Fail closed. The flag must be enabled by an authenticated server and a
  // supported matchmaking region must be configured before any queue UI shows.
  if (status === null || status.status === "disabled") return null;

  return (
    <SectionCard className="mt-6 rounded-2xl border border-border/60 surface-card p-5">
      <h2 className="font-display text-sm uppercase tracking-[0.25em] text-muted-foreground">
        {copy.title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{copy.description}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="matchmaking-mode"
            value="casual"
            checked={mode === "casual"}
            onChange={() => setMode("casual")}
            disabled={busy || isSearching}
          />
          {copy.casual}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="matchmaking-mode"
            value="ranked"
            checked={mode === "ranked"}
            onChange={() => setMode("ranked")}
            disabled={busy || isSearching}
          />
          {copy.ranked}
        </label>
        {status.status === "waiting" ? (
          <button
            type="button"
            onClick={() => void leave()}
            disabled={!online || busy}
            className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50"
          >
            {copy.cancel}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void join()}
            disabled={!online || busy || isSearching || status.status !== "not_joined"}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {busy ? copy.joining : copy.join}
          </button>
        )}
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-sm text-muted-foreground">
        {status.status === "waiting"
          ? copy.waiting
          : status.status === "reserved"
            ? copy.reserved
            : status.status === "matched"
              ? copy.matched
              : status.status === "unavailable" || error
                ? copy.unavailable
                : ""}
      </p>
      {error && status.status !== "unavailable" ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {copy.error}
        </p>
      ) : null}
    </SectionCard>
  );
}
