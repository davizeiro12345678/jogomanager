import { ScreenHeader, SectionCard } from "@/components/game/screen-kit";

import { Link } from "@tanstack/react-router";

import { Copy, LogOut, Play, RefreshCw, Swords, Users, WifiOff } from "lucide-react";

import { lazy, Suspense, useCallback, useEffect, useState } from "react";

import { Crest } from "@/components/game/Crest";

import { CLUBS, getLeague, LEAGUES } from "@/game/data/leagues";

import { useOnline } from "@/hooks/useOnline";

import { useAuthUserId } from "@/hooks/useAuthUserId";
import { useT } from "@/i18n/provider";

import { supabase } from "@/integrations/supabase/client";

import { isSettlementLeaseExpired } from "@/lib/multiplayer-settlement";

import { RoomChat } from "@/features/multiplayer/RoomChat";
import type { MultiplayerRoomRecord as Room } from "@/lib/multiplayer.functions";

import { reportSilent } from "@/lib/silent-errors";

const LiveRoom = lazy(() =>
  import("@/features/multiplayer/LiveRoom").then((module) => ({ default: module.LiveRoom })),
);

export function MultiplayerPage() {
  const userId = useAuthUserId();
  const { t } = useT();
  if (userId === undefined)
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </Shell>
    );
  if (!userId) return <SignedOut />;
  return <MultiplayerAccount key={userId} userId={userId} />;
}

function SignedOut() {
  return (
    <Shell>
      <p className="text-sm text-muted-foreground">
        O multiplayer precisa de uma conta para identificar os dois jogadores.
      </p>
      <Link
        to="/auth"
        className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 font-display text-sm uppercase tracking-wide text-primary-foreground"
      >
        Entrar ou criar conta
      </Link>
    </Shell>
  );
}

function MultiplayerAccount({ userId }: { userId: string }) {
  const { t } = useT();
  const online = useOnline();
  const [room, setRoom] = useState<Room | null>(null);
  const [open, setOpen] = useState<Room[]>([]);
  const [history, setHistory] = useState<Room[]>([]);
  const [leagueId, setLeagueId] = useState(LEAGUES[0]!.id);
  const [club, setClub] = useState(LEAGUES[0]!.clubs[0]!.id);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId || !online) return;
    const [{ data: rooms }, { data: mine }] = await Promise.all([
      supabase
        .from("match_rooms")
        .select("*")
        .eq("status", "open")
        .eq("server_seeded", true)
        .is("guest_id", null)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("match_rooms")
        .select("*")
        .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setOpen((rooms ?? []) as unknown as Room[]);
    const list = (mine ?? []) as unknown as Room[];
    const active = list.find((r) => r.status !== "done");
    setHistory(
      list.filter((r) => {
        const state = r.state as { hg?: unknown; ag?: unknown };
        return (
          r.server_seeded &&
          r.status === "done" &&
          Number.isInteger(state.hg) &&
          Number.isInteger(state.ag)
        );
      }),
    );
    setRoom((cur) => cur ?? active ?? null);
  }, [online, userId]);

  useEffect(() => {
    void refresh().catch((error) => {
      reportSilent("multiplayer.operation", error, {
        classification: "fatal",
        feature: "rooms",
        phase: "refresh",
        dedupeKey: "rooms-refresh",
      });
      setError("Não foi possível atualizar as salas agora.");
    });
  }, [refresh]);

  // Atualização em tempo real da sala atual.
  useEffect(() => {
    const roomId = room?.id;
    if (!roomId || !online) return;
    let disposed = false;
    const revalidateRoom = async () => {
      const { data } = await supabase
        .from("match_rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();
      if (!disposed && data) setRoom(data as unknown as Room);
    };
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "match_rooms", filter: `id=eq.${roomId}` },
        (payload) => setRoom(payload.new as unknown as Room),
      )
      .subscribe();
    // Reconexão automática: revalida a sala periodicamente.
    void revalidateRoom();
    const timer = window.setInterval(() => void revalidateRoom(), 8000);
    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
      window.clearInterval(timer);
    };
  }, [online, room?.id]);

  async function createRoom() {
    if (!userId) return setError("Entre na conta novamente para criar uma sala.");
    setBusy(true);
    setError(null);
    const { createMatchRoom } = await import("@/lib/multiplayer.functions");
    const result = await createMatchRoom({ data: { hostClub: club } }).catch((error) => {
      reportSilent("multiplayer.operation", error, {
        classification: "fatal",
        feature: "rooms",
        phase: "create",
        dedupeKey: "room-create",
      });
      return {
        ok: false as const,
        reason: "create_failed",
      };
    });
    setBusy(false);
    if (!result.ok)
      return setError(
        result.reason === "rate_limited"
          ? "Você atingiu o limite de criação de salas desta hora. Aguarde para criar outra."
          : result.reason === "too_many_rooms"
            ? "Você já tem três salas ativas. Encerre uma delas antes de criar outra."
            : result.reason === "verification_required"
              ? "Confirme o e-mail da sua conta para criar uma sala online."
              : "Não foi possível criar a sala.",
      );
    setRoom(result.room as unknown as Room);
  }

  async function joinRoom(target: Room) {
    if (!userId) return setError("Entre na conta novamente para entrar na sala.");
    setBusy(true);
    setError(null);
    const { joinMatchRoom } = await import("@/lib/multiplayer.functions");
    const result = await joinMatchRoom({
      data: { roomId: target.id, guestClub: club },
    }).catch((error) => {
      reportSilent("multiplayer.operation", error, {
        classification: "fatal",
        feature: "rooms",
        phase: "join",
        dedupeKey: "room-join",
      });
      return { ok: false as const, reason: "room_unavailable" };
    });
    setBusy(false);
    if (!result.ok) return setError("Essa sala já foi ocupada ou não está mais disponível.");
    setRoom(result.room as unknown as Room);
  }

  async function joinByCode() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    const { data } = await supabase
      .from("match_rooms")
      .select("*")
      .eq("code", code)
      .eq("status", "open")
      .eq("server_seeded", true)
      .maybeSingle();
    if (!data) return setError("Código não encontrado.");
    await joinRoom(data as unknown as Room);
  }

  async function leave() {
    if (!room) return;
    const { leaveMatchRoom } = await import("@/lib/multiplayer.functions");
    const result = await leaveMatchRoom({ data: { roomId: room.id } }).catch((error) => {
      reportSilent("multiplayer.operation", error, {
        classification: "fatal",
        feature: "rooms",
        phase: "leave",
        dedupeKey: "room-leave",
      });
      return {
        ok: false as const,
        reason: "leave_failed",
      };
    });
    if (!result.ok) {
      setError(
        result.reason === "settling"
          ? "O resultado já está sendo confirmado pelo servidor. Aguarde alguns instantes."
          : "Não foi possível encerrar a sala. Tente novamente.",
      );
      return;
    }
    setRoom(null);
    void refresh();
  }

  if (room && room.status === "live" && room.guest_club) {
    return (
      <Suspense
        fallback={
          <main className="grid h-[100dvh] place-items-center bg-background px-6 text-center">
            <p role="status" className="text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          </main>
        }
      >
        <LiveRoom
          room={room}
          isHost={room.host_id === userId}
          online={online}
          onExit={() => {
            void leave();
          }}
        />
      </Suspense>
    );
  }

  if (!online) {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-sm text-amber-400">
          <WifiOff size={16} /> O multiplayer exige internet. Sua carreira e as partidas contra o
          computador continuam funcionando offline.
        </p>
        <Link to="/partida-rapida" className="mt-4 inline-block text-sm text-primary underline">
          Jogar uma partida rápida
        </Link>
      </Shell>
    );
  }

  const league = getLeague(leagueId);

  return (
    <Shell>
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      {room ? (
        <section className="rounded-2xl border border-primary/40 bg-primary/5 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Sala
            </span>
            <span className="rounded-lg bg-card px-3 py-1 font-display text-2xl tracking-[0.3em]">
              {room.code}
            </span>
            <button
              onClick={() => void navigator.clipboard?.writeText(room.code)}
              className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Copy size={12} /> Copiar código
            </button>
            <button
              onClick={() => void leave()}
              disabled={room.status === "settling" && !isSettlementLeaseExpired(room.updated_at)}
              className="ml-auto flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut size={12} />
              {room.status === "settling" && !isSettlementLeaseExpired(room.updated_at)
                ? "Confirmando"
                : "Sair da sala"}
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <SideCard title="Anfitrião" clubId={room.host_club} ready />
            <SideCard title="Visitante" clubId={room.guest_club} ready={!!room.guest_club} />
          </div>

          {room.status === "settling" ? (
            <p className="mt-5 text-sm text-muted-foreground" aria-live="polite">
              O servidor está confirmando o resultado com o replay oficial. A sala será atualizada
              automaticamente.
            </p>
          ) : room.host_id === userId ? (
            <button
              disabled={!room.guest_club || busy || room.status !== "ready"}
              onClick={async () => {
                setBusy(true);
                const { startMatchRoom } = await import("@/lib/multiplayer.functions");
                const result = await startMatchRoom({ data: { roomId: room.id } }).catch(
                  (error) => {
                    reportSilent("multiplayer.operation", error, {
                      classification: "fatal",
                      feature: "rooms",
                      phase: "start",
                      dedupeKey: "room-start",
                    });
                    return {
                      ok: false as const,
                      reason: "room_not_ready",
                    };
                  },
                );
                setBusy(false);
                if (result.ok) setRoom(result.room as unknown as Room);
                else setError("A sala não está mais pronta para iniciar.");
              }}
              className="mt-5 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-display text-sm uppercase tracking-wide text-primary-foreground disabled:opacity-40"
            >
              <Play size={15} /> Iniciar partida
            </button>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              Esperando o anfitrião iniciar a partida…
            </p>
          )}

          <RoomChat key={`${userId}:${room.id}`} roomId={room.id} userId={userId} />
        </section>
      ) : (
        <>
          <SectionCard className="rounded-2xl border border-border/60 surface-card p-5">
            <h2 className="font-display text-sm uppercase tracking-[0.25em] text-muted-foreground">
              Escolha seu clube
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {LEAGUES.slice(0, 24).map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setLeagueId(l.id);
                    setClub(getLeague(l.id).clubs[0]!.id);
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs ${
                    l.id === leagueId
                      ? "border-primary bg-primary/15"
                      : "border-border surface-card text-muted-foreground"
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>
            <div className="mt-4 grid max-h-52 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
              {league.clubs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setClub(c.id)}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                    c.id === club ? "bg-primary/15" : "text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <Crest club={CLUBS[c.id]!} size={20} detail="simple" />
                  {c.name}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => void createRoom()}
                disabled={busy}
                className="rounded-lg bg-primary px-4 py-2 font-display text-sm uppercase tracking-wide text-primary-foreground disabled:opacity-40"
              >
                Criar sala
              </button>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Código"
                maxLength={8}
                className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-center font-display tracking-[0.2em]"
              />
              <button
                onClick={() => void joinByCode()}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Entrar pelo código
              </button>
            </div>
          </SectionCard>

          <SectionCard className="mt-6 rounded-2xl border border-border/60 surface-card p-5">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-muted-foreground" />
              <h2 className="font-display text-sm uppercase tracking-[0.25em] text-muted-foreground">
                Salas abertas
              </h2>
              <button
                onClick={() => void refresh()}
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw size={12} /> Atualizar
              </button>
            </div>
            {open.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhuma sala aberta agora — crie a sua e compartilhe o código.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {open.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 px-3 py-2"
                  >
                    <Crest club={CLUBS[r.host_club] ?? CLUBS[club]!} size={22} detail="simple" />
                    <span className="text-sm">{CLUBS[r.host_club]?.name ?? r.host_club}</span>
                    <span className="font-display tracking-[0.3em] text-muted-foreground">
                      {r.code}
                    </span>
                    <button
                      onClick={() => void joinRoom(r)}
                      className="ml-auto rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                    >
                      Entrar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {history.length > 0 && (
            <SectionCard className="mt-6 rounded-2xl border border-border/60 surface-card p-5">
              <h2 className="font-display text-sm uppercase tracking-[0.25em] text-muted-foreground">
                Histórico de confrontos
              </h2>
              <ul className="mt-3 grid gap-1 text-sm">
                {history.map((r) => {
                  const s = r.state as { hg?: number; ag?: number };
                  return (
                    <li key={r.id} className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-display tracking-[0.2em]">{r.code}</span>
                      <span>{CLUBS[r.host_club]?.short ?? "?"}</span>
                      <span className="text-foreground">
                        {s.hg ?? "-"} : {s.ag ?? "-"}
                      </span>
                      <span>{r.guest_club ? (CLUBS[r.guest_club]?.short ?? "?") : "—"}</span>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          )}
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="pitch-bg min-h-[100dvh] px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <ScreenHeader
          title={
            <>
              <Swords className="text-primary" /> Multiplayer 1x1
            </>
          }
        />
        <p className="mt-1 text-sm text-muted-foreground">
          Crie uma sala, mande o código e joguem a mesma partida ao vivo, cada um no seu aparelho.
        </p>
        <div className="mt-6">{children}</div>
        <Link to="/dashboard" className="mt-6 inline-block text-xs text-muted-foreground underline">
          Voltar ao painel
        </Link>
      </div>
    </main>
  );
}

function SideCard({
  title,
  clubId,
  ready,
}: {
  title: string;
  clubId: string | null;
  ready: boolean;
}) {
  const c = clubId ? CLUBS[clubId] : undefined;
  return (
    <div className="rounded-xl border border-border/50 bg-background/40 p-4">
      <p className="font-display text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-2 flex items-center gap-3">
        {c ? <Crest club={c} size={36} detail="full" /> : null}
        <span className="font-display text-lg">{c?.name ?? "Aguardando jogador…"}</span>
      </div>
      <span
        className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] ${
          ready ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"
        }`}
      >
        {ready ? "Pronto" : "Aguardando"}
      </span>
    </div>
  );
}

