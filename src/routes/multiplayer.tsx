import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, LogOut, Play, RefreshCw, Send, Swords, Users, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Crest } from "@/components/game/Crest";
import { Stadium3D, type CameraMode, type Quality } from "@/components/game/Stadium3D";
import { CLUBS, LEAGUES, getLeague } from "@/game/data/leagues";
import { detectQuality } from "@/game/device";
import { buildTeamSetup } from "@/game/quickMatch";
import { MatchSim } from "@/game/sim";
import { useOnline } from "@/hooks/useOnline";
import { useSignedIn } from "@/hooks/useCareer";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/multiplayer")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Multiplayer online 1x1 · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Crie uma sala com código, convide um amigo e dispute uma partida 3D sincronizada minuto a minuto, com chat da sala e histórico de confrontos.",
      },
      { property: "og:title", content: "Multiplayer online 1x1 · Pro Football Manager 3D" },
      {
        property: "og:description",
        content: "Partidas 1x1 em tempo real com salas por código, chat e histórico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MultiplayerPage,
});

interface Room {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  host_club: string;
  guest_club: string | null;
  seed: string;
  status: string;
  minute: number;
  state: Record<string, unknown>;
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function MultiplayerPage() {
  const signedIn = useSignedIn();
  const online = useOnline();
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [open, setOpen] = useState<Room[]>([]);
  const [history, setHistory] = useState<Room[]>([]);
  const [leagueId, setLeagueId] = useState(LEAGUES[0]!.id);
  const [club, setClub] = useState(LEAGUES[0]!.clubs[0]!.id);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [signedIn]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [{ data: rooms }, { data: mine }] = await Promise.all([
      supabase
        .from("match_rooms")
        .select("*")
        .eq("status", "open")
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
    setHistory(list.filter((r) => r.status === "done"));
    setRoom((cur) => cur ?? active ?? null);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Atualização em tempo real da sala atual.
  useEffect(() => {
    if (!room) return;
    const channel = supabase
      .channel(`room-${room.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "match_rooms", filter: `id=eq.${room.id}` },
        (payload) => setRoom(payload.new as unknown as Room),
      )
      .subscribe();
    // Reconexão automática: revalida a sala periodicamente.
    const timer = window.setInterval(async () => {
      const { data } = await supabase.from("match_rooms").select("*").eq("id", room.id).maybeSingle();
      if (data) setRoom(data as unknown as Room);
    }, 8000);
    return () => {
      void supabase.removeChannel(channel);
      window.clearInterval(timer);
    };
  }, [room?.id]);

  async function createRoom() {
    if (!userId) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("match_rooms")
      .insert({
        code: randomCode(),
        host_id: userId,
        host_club: club,
        seed: `mp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        status: "open",
      })
      .select()
      .single();
    setBusy(false);
    if (err) return setError("Não foi possível criar a sala.");
    setRoom(data as unknown as Room);
  }

  async function joinRoom(target: Room) {
    if (!userId) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("match_rooms")
      .update({ guest_id: userId, guest_club: club, status: "ready" })
      .eq("id", target.id)
      .is("guest_id", null)
      .select()
      .maybeSingle();
    setBusy(false);
    if (err || !data) return setError("Essa sala já foi ocupada.");
    setRoom(data as unknown as Room);
  }

  async function joinByCode() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    const { data } = await supabase
      .from("match_rooms")
      .select("*")
      .eq("code", code)
      .eq("status", "open")
      .maybeSingle();
    if (!data) return setError("Código não encontrado.");
    await joinRoom(data as unknown as Room);
  }

  async function leave() {
    if (!room) return;
    await supabase.from("match_rooms").update({ status: "done" }).eq("id", room.id);
    setRoom(null);
    void refresh();
  }

  if (signedIn === false) {
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

  if (room && room.status === "live" && room.guest_club) {
    return (
      <LiveRoom
        room={room}
        isHost={room.host_id === userId}
        onExit={() => {
          void leave();
        }}
      />
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
              className="ml-auto flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut size={12} /> Sair da sala
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <SideCard title="Anfitrião" clubId={room.host_club} ready />
            <SideCard title="Visitante" clubId={room.guest_club} ready={!!room.guest_club} />
          </div>

          {room.host_id === userId ? (
            <button
              disabled={!room.guest_club || busy}
              onClick={async () => {
                setBusy(true);
                await supabase.from("match_rooms").update({ status: "live" }).eq("id", room.id);
                setBusy(false);
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

          <RoomChat roomId={room.id} userId={userId} />
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
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
                      : "border-border bg-card/60 text-muted-foreground"
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
                maxLength={5}
                className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-center font-display tracking-[0.3em]"
              />
              <button
                onClick={() => void joinByCode()}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Entrar pelo código
              </button>
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-border/60 bg-card/60 p-5">
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
          </section>

          {history.length > 0 && (
            <section className="mt-6 rounded-2xl border border-border/60 bg-card/60 p-5">
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
            </section>
          )}
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pitch-bg min-h-[100dvh] px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="flex items-center gap-2 font-display text-4xl uppercase tracking-wide">
          <Swords className="text-primary" /> Multiplayer 1x1
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie uma sala, mande o código e joguem a mesma partida ao vivo, cada um no seu aparelho.
        </p>
        <div className="mt-6">{children}</div>
        <Link to="/dashboard" className="mt-6 inline-block text-xs text-muted-foreground underline">
          Voltar ao painel
        </Link>
      </div>
    </div>
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

/** Chat da sala por canal em tempo real (não fica salvo). */
function RoomChat({ roomId, userId }: { roomId: string; userId: string | null }) {
  const [msgs, setMsgs] = useState<{ id: string; from: string; text: string }[]>([]);
  const [text, setText] = useState("");
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const ch = supabase.channel(`room-chat-${roomId}`, { config: { broadcast: { self: true } } });
    ch.on("broadcast", { event: "msg" }, ({ payload }) => {
      setMsgs((m) => [...m.slice(-40), payload as { id: string; from: string; text: string }]);
    }).subscribe();
    chanRef.current = ch;
    return () => {
      void supabase.removeChannel(ch);
      chanRef.current = null;
    };
  }, [roomId]);

  return (
    <div className="mt-5 rounded-xl border border-border/50 bg-background/40 p-3">
      <div className="max-h-40 overflow-y-auto text-sm">
        {msgs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Converse com seu adversário aqui.</p>
        ) : (
          msgs.map((m, i) => (
            <p key={`${m.id}-${i}`} className="mb-1">
              <span className="text-muted-foreground">
                {m.from === userId ? "Você" : "Adversário"}:{" "}
              </span>
              {m.text}
            </p>
          ))
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = text.trim().slice(0, 200);
          if (!value) return;
          void chanRef.current?.send({
            type: "broadcast",
            event: "msg",
            payload: { id: userId ?? "anon", from: userId ?? "anon", text: value },
          });
          setText("");
        }}
        className="mt-2 flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mensagem…"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        />
        <button className="rounded-lg bg-primary px-3 py-1.5 text-primary-foreground">
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

/**
 * Partida sincronizada: os dois lados rodam a mesma simulação determinística
 * (mesma semente), então o placar é idêntico sem enviar cada lance pela rede.
 * O anfitrião publica o minuto e o resultado final.
 */
function LiveRoom({
  room,
  isHost,
  onExit,
}: {
  room: Room;
  isHost: boolean;
  onExit: () => void;
}) {
  const sim = useMemo(
    () => new MatchSim(buildTeamSetup(room.host_club), buildTeamSetup(room.guest_club!), room.seed),
    [room.host_club, room.guest_club, room.seed],
  );
  const [quality] = useState<Quality>(() => detectQuality() as Quality);
  const [camera, setCamera] = useState<CameraMode>("broadcast");
  const [snap, setSnap] = useState({ minute: 0, hg: 0, ag: 0, finished: false });
  const published = useRef(false);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    let acc = 0;
    function loop(t: number) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - (last || t)) / 1000);
      last = t;
      sim.step(dt * 6);
      acc += dt;
      if (acc >= 0.15 || sim.finished) {
        acc = 0;
        setSnap({
          minute: sim.minute(),
          hg: sim.stats.home.goals,
          ag: sim.stats.away.goals,
          finished: sim.finished,
        });
      }
      if (sim.finished) cancelAnimationFrame(raf);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sim]);

  useEffect(() => {
    if (!isHost) return;
    if (snap.finished && !published.current) {
      published.current = true;
      void supabase
        .from("match_rooms")
        .update({ status: "done", minute: snap.minute, state: { hg: snap.hg, ag: snap.ag } })
        .eq("id", room.id);
    }
  }, [snap, isHost, room.id]);

  const home = CLUBS[room.host_club]!;
  const away = CLUBS[room.guest_club!]!;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#070b12]">
      <Stadium3D sim={sim} mode={camera} quality={quality} />
      <h1 className="sr-only">
        Multiplayer: {home.name} x {away.name}
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
      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-full border border-white/12 bg-black/70 p-1.5 backdrop-blur-xl">
        <button
          onClick={() =>
            setCamera((c) => (c === "broadcast" ? "tactical" : c === "tactical" ? "fan" : "broadcast"))
          }
          className="rounded-full px-4 py-1.5 font-display text-xs uppercase tracking-wide text-white/80"
        >
          Câmera
        </button>
        <button
          onClick={onExit}
          className="rounded-full bg-white/15 px-4 py-1.5 font-display text-xs uppercase tracking-wide text-white"
        >
          {snap.finished ? "Encerrar" : "Abandonar"}
        </button>
      </div>
    </div>
  );
}
