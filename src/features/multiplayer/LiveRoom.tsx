import { WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Crest } from "@/components/game/Crest";
import { Stadium3D, type CameraMode, type Quality } from "@/components/game/Stadium3D";
import { CLUBS } from "@/game/data/leagues";
import { detectQuality } from "@/game/device";
import { WorkerMatchView } from "@/game/live-match";
import { buildTeamSetup } from "@/game/quickMatch";
import { createLiveMatchController, type LiveMatchController } from "@/game/simWorkerClient";
import { getLiveRoomConnectionState } from "@/game/multiplayer-connection";
import { MATCH_SETTLEMENT_LEASE_MS } from "@/lib/multiplayer-settlement";
import type { MultiplayerRoomRecord as Room } from "@/lib/multiplayer.functions";
import { reportSilent } from "@/lib/silent-errors";
import { useT } from "@/i18n/provider";
import { multiplayerLiveMessages } from "@/i18n/multiplayer-live-messages";

/**
 * Each browser renders a deterministic presentation seeded by the room ID.
 * The server keeps the outcome seed private and publishes the replayed score.
 */
export function LiveRoom({
  room,
  isHost,
  online,
  onExit,
}: {
  room: Room;
  isHost: boolean;
  online: boolean;
  onExit: () => void;
}) {
  const { lang } = useT();
  const copy = multiplayerLiveMessages(lang);
  const setups = useMemo(
    () => ({
      home: buildTeamSetup(room.host_club),
      away: buildTeamSetup(room.guest_club!),
      seed: ["multiplayer-view", room.id].join(":"),
    }),
    [room.id, room.host_club, room.guest_club],
  );
  const sim = useMemo(() => new WorkerMatchView(setups.home, setups.away), [setups]);
  const [quality] = useState<Quality>(() => detectQuality() as Quality);
  const [camera, setCamera] = useState<CameraMode>("broadcast");
  const [snap, setSnap] = useState({ minute: 0, hg: 0, ag: 0, finished: false });
  const published = useRef(false);
  const authoritativeResult = useRef(false);
  const controllerRef = useRef<LiveMatchController | null>(null);
  const publishRetry = useRef<number | null>(null);
  const onlineRef = useRef(online);
  const connection = getLiveRoomConnectionState(online);
  onlineRef.current = online;

  useEffect(() => {
    const controller = createLiveMatchController({
      ...setups,
      // Opt into bounded contacts for new multiplayer presentation sessions.
      contactPhysicsRevision: 2,
      view: sim,
      onSnapshot: (view) => {
        if (authoritativeResult.current) return;
        setSnap({
          minute: view.minute(),
          hg: view.stats.home.goals,
          ag: view.stats.away.goals,
          finished: view.finished,
        });
      },
      onFinished: (view) => {
        if (authoritativeResult.current) return;
        setSnap({
          minute: view.minute(),
          hg: view.stats.home.goals,
          ag: view.stats.away.goals,
          finished: true,
        });
      },
    });
    controllerRef.current = controller;
    controller.pause(document.hidden || !onlineRef.current);
    const onVisibility = () => controller.pause(document.hidden || !onlineRef.current);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      controller.dispose();
      controllerRef.current = null;
    };
  }, [setups, sim]);

  useEffect(() => {
    if (!online || !isHost || !snap.finished || published.current) return;
    let disposed = false;
    let attempts = 0;
    const publish = async () => {
      published.current = true;
      let retryReason: string | null = null;
      try {
        const { finishMatchRoom } = await import("@/lib/multiplayer.functions");
        const result = await finishMatchRoom({ data: { roomId: room.id } });
        if (result.ok || disposed) return;
        retryReason = result.reason;
      } catch (error) {
        if (disposed) return;
        reportSilent("multiplayer.operation", error, {
          classification: "fatal",
          feature: "rooms",
          phase: "finish",
          dedupeKey: "room-finish",
        });
      }
      published.current = false;
      if (attempts++ < 4) {
        const retryDelay = retryReason === "settling" ? MATCH_SETTLEMENT_LEASE_MS + 1000 : 3000;
        publishRetry.current = window.setTimeout(() => {
          publishRetry.current = null;
          if (!disposed && !published.current) void publish();
        }, retryDelay);
      }
    };
    void publish();
    return () => {
      disposed = true;
      if (publishRetry.current !== null) {
        window.clearTimeout(publishRetry.current);
        publishRetry.current = null;
      }
      // A request may still be resolving while the browser goes offline. Let a
      // fresh effect retry after reconnection; the server-side settling claim
      // remains the single authority if the earlier request also reaches it.
      published.current = false;
    };
  }, [online, snap.finished, isHost, room.id]);

  useEffect(() => {
    if (authoritativeResult.current) return;
    controllerRef.current?.pause(connection.pausePresentation || document.hidden);
  }, [connection.pausePresentation]);

  useEffect(() => {
    if (room.status !== "done") return;
    authoritativeResult.current = true;
    controllerRef.current?.pause(true);

    const state = room.state;
    if (typeof state !== "object" || state === null || Array.isArray(state)) return;
    const homeGoals = state["hg"];
    const awayGoals = state["ag"];
    if (
      typeof homeGoals !== "number" ||
      !Number.isInteger(homeGoals) ||
      typeof awayGoals !== "number" ||
      !Number.isInteger(awayGoals)
    ) {
      return;
    }
    setSnap({ minute: room.minute, hg: homeGoals, ag: awayGoals, finished: true });
  }, [room.minute, room.state, room.status]);

  const home = CLUBS[room.host_club]!;
  const away = CLUBS[room.guest_club!]!;

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <Stadium3D sim={sim} mode={camera} quality={quality} />
      <h1 className="sr-only">
        {copy.title} {home.name} {copy.versus} {away.name}
      </h1>
      <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3">
        <div className="flex w-full max-w-md items-center gap-2 rounded-2xl border border-white/12 bg-black/70 px-3 py-2 backdrop-blur-xl">
          <Crest club={home} size={26} detail="simple" />
          <span className="font-display text-base text-white">{home.short}</span>
          <span className="mx-auto font-display text-2xl tabular-nums text-white">
            {snap.hg} <span className="text-white/35">:</span> {snap.ag}
          </span>
          <span className="font-display text-base text-white">{away.short}</span>
          <Crest club={away} size={26} detail="simple" />
          <span className="ml-1 rounded-md bg-primary px-2 py-0.5 font-display text-xs tabular-nums text-primary-foreground">
            {snap.minute}'
          </span>
        </div>
      </div>
      {connection.notice ? (
        <div
          role="status"
          aria-live="assertive"
          className="absolute inset-0 z-30 grid place-items-center bg-background/85 px-5 text-center backdrop-blur-sm"
        >
          <div className="max-w-sm rounded-2xl border border-amber-400/30 bg-black/70 p-6 shadow-2xl">
            <WifiOff className="mx-auto mb-3 text-amber-300" size={28} aria-hidden="true" />
            <h2 className="font-display text-lg uppercase tracking-wide text-white">
              {connection.notice.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/70">{connection.notice.detail}</p>
          </div>
        </div>
      ) : null}
      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-full border border-white/12 bg-black/70 p-1.5 backdrop-blur-xl">
        <button
          onClick={() =>
            setCamera((c) =>
              c === "broadcast" ? "tactical" : c === "tactical" ? "fan" : "broadcast",
            )
          }
          className="rounded-full px-4 py-1.5 font-display text-xs uppercase tracking-wide text-white/80"
        >
          {copy.camera}
        </button>
        <button
          onClick={onExit}
          disabled={!online}
          className="rounded-full bg-white/15 px-4 py-1.5 font-display text-xs uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {!online ? copy.reconnecting : snap.finished ? copy.finish : copy.leave}
        </button>
      </div>
    </main>
  );
}
