import { memo, useEffect, useRef, useState } from "react";
import { Crest } from "@/components/game/Crest";
import { eventIcon } from "./event-icon";
import { safeClub } from "@/game/squad";
import type { Snap } from "./types";

export function StatRow({ label, h, a }: { label: string; h: number; a: number }) {
  const total = Math.max(1, h + a);
  const pct = (h / total) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-white/70">
        <span className="font-display tabular-nums text-white">{h}</span>
        <span className="uppercase tracking-widest">{label}</span>
        <span className="font-display tabular-nums text-white">{a}</span>
      </div>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="rounded-l-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
        <div className="flex-1 rounded-r-full bg-white/45" />
      </div>
    </div>
  );
}

/**
 * Pressão da partida: mede quem está criando mais nos últimos lances (chutes,
 * chutes no gol, escanteios) com esquecimento gradual, para o HUD mostrar de
 * quem é o jogo agora — e não o acumulado dos 90 minutos.
 */
function useMomentum(snap: Snap) {
  const prev = useRef({ hs: 0, as: 0, ho: 0, ao: 0, hc: 0, ac: 0 });
  const value = useRef(0);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const p = prev.current;
    const gain =
      (snap.hShots - p.hs) * 1 +
      (snap.hOn - p.ho) * 1.6 +
      (snap.hCorners - p.hc) * 0.8 -
      ((snap.aShots - p.as) * 1 + (snap.aOn - p.ao) * 1.6 + (snap.aCorners - p.ac) * 0.8);
    prev.current = {
      hs: snap.hShots,
      as: snap.aShots,
      ho: snap.hOn,
      ao: snap.aOn,
      hc: snap.hCorners,
      ac: snap.aCorners,
    };
    // decai devagar e soma o lance novo; fica preso entre -1 e 1
    const next = Math.max(-1, Math.min(1, value.current * 0.94 + gain * 0.35));
    value.current = next;
    setShown((v) => (Math.abs(v - next) > 0.02 ? next : v));
  }, [snap.hShots, snap.aShots, snap.hOn, snap.aOn, snap.hCorners, snap.aCorners]);

  return shown;
}

/** Linha do tempo com os marcos da partida (gols e cartões). */
function Timeline({ minute, events }: { minute: number; events: Snap["events"] }) {
  const marks = events.filter((e) => e.type === "goal" || e.type === "red");
  return (
    <div className="relative mx-4 mb-1 mt-1 h-1 rounded-full bg-white/12">
      <div
        className="h-full rounded-full bg-white/45 transition-[width] duration-700"
        style={{ width: `${Math.min(100, (minute / 90) * 100)}%` }}
      />
      <span className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
      {marks.map((e, i) => (
        <span
          key={`${e.minute}-${i}`}
          title={e.text}
          className="absolute -top-[3px] h-[7px] w-[7px] -translate-x-1/2 rounded-full ring-1 ring-black/60"
          style={{
            left: `${Math.min(100, (e.minute / 90) * 100)}%`,
            background: e.type === "red" ? "#ef4444" : "#ffffff",
          }}
        />
      ))}
    </div>
  );
}

export const Scoreboard = memo(function Scoreboard({
  homeId,
  awayId,
  snap,
  paused,
}: {
  homeId: string;
  awayId: string;
  snap: Snap;
  paused: boolean;
}) {
  const home = safeClub(homeId);
  const away = safeClub(awayId);
  const [ph, pa] = snap.poss;
  const momentum = useMomentum(snap);
  // pequeno destaque quando o placar muda
  const total = snap.hg + snap.ag;
  const [flash, setFlash] = useState(false);
  const lastTotal = useRef(total);
  useEffect(() => {
    if (total === lastTotal.current) return;
    lastTotal.current = total;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1600);
    return () => clearTimeout(t);
  }, [total]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center px-3">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {`${home.name} ${snap.hg}, ${away.name} ${snap.ag}. ${paused ? "Partida pausada" : `${snap.minute} minutos`}.`}
      </p>
      <div
        className={`match-scoreboard w-full max-w-[22rem] overflow-hidden rounded-lg border bg-black/75 shadow-xl backdrop-blur-md transition-all duration-500 sm:max-w-sm ${
          flash ? "scale-[1.03] border-primary/70 shadow-primary/30" : "border-white/12"
        }`}
      >
        <div className="flex h-1 w-full">
          <div className="flex-1" style={{ background: home.primary }} />
          <div className="flex-1" style={{ background: away.primary }} />
        </div>
        <div className="flex items-center justify-between px-3 pt-1.5 font-display text-[9px] uppercase tracking-[0.22em] text-white/55">
          <span className="flex items-center gap-1.5">
            <i
              className={`h-1.5 w-1.5 rounded-full ${paused ? "bg-amber-300" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,.9)]"}`}
            />
            {paused ? "Pausado" : "Ao vivo"}
          </span>
          <span>
            {snap.phase === "first"
              ? "1º tempo"
              : snap.phase === "half"
                ? "Intervalo"
                : snap.phase === "second"
                  ? "2º tempo"
                  : snap.phase === "shootout"
                    ? "Pênaltis"
                    : snap.phase === "done"
                      ? "Fim"
                      : "Prorrogação"}
          </span>
        </div>
        <div className="flex min-h-11 items-center gap-1.5 px-2 py-1.5 sm:gap-2 sm:px-3">
          <Crest club={home} size={24} detail="simple" />
          <span className="font-display text-sm tracking-wide text-white sm:text-base">
            {home.short}
          </span>
          <span
            className={`mx-auto font-display text-xl tabular-nums text-white transition-transform duration-300 sm:text-2xl ${
              flash ? "scale-125" : ""
            }`}
          >
            {snap.hg} <span className="text-white/35">:</span> {snap.ag}
          </span>
          <span className="font-display text-sm tracking-wide text-white sm:text-base">
            {away.short}
          </span>
          <Crest club={away} size={24} detail="simple" />
          <span className="ml-1 rounded-md bg-primary px-2 py-0.5 font-display text-xs tabular-nums text-primary-foreground sm:text-sm">
            {paused ? "||" : snap.clock}
          </span>
        </div>
        <div className="flex h-1.5 w-full">
          <div
            className="transition-[width] duration-700"
            style={{ width: `${ph}%`, background: home.primary }}
          />
          <div className="flex-1" style={{ background: away.primary }} />
        </div>
        {/* pressão: de quem é o jogo neste momento */}
        <div className="hidden px-3 pb-1 sm:block">
          <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
            <span className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
            <div
              className="absolute inset-y-0 rounded-full transition-all duration-500"
              style={{
                left: momentum >= 0 ? "50%" : `${50 + momentum * 50}%`,
                width: `${Math.abs(momentum) * 50}%`,
                background: momentum >= 0 ? home.primary : away.primary,
              }}
            />
          </div>
        </div>

        <div className="hidden sm:block">
          <Timeline minute={snap.minute} events={snap.events} />
        </div>
      </div>

      {/* faixa de gol: aparece por poucos segundos quando o placar muda */}
      {flash ? (
        <p
          aria-live="polite"
          className="cs-anim-rise mt-3 rounded-xl bg-primary px-6 py-1.5 font-display text-2xl uppercase tracking-[0.4em] text-primary-foreground shadow-2xl shadow-primary/40 sm:text-3xl"
        >
          Gol!
        </p>
      ) : null}
    </div>
  );
});
export const Feed = memo(function Feed({ events }: { events: Snap["events"] }) {
  return (
    <div
      aria-label="Eventos da partida"
      role="log"
      className="match-feed pointer-events-auto absolute bottom-24 left-3 z-10 hidden w-64 space-y-1 text-xs text-white/90 md:block [mask-image:linear-gradient(to_top,black_60%,transparent)]"
    >
      {events.slice(-4).map((e, i) => (
        <p
          key={`${e.minute}-${i}-${e.type}`}
          className={`flex gap-2 rounded-lg bg-black/45 px-2.5 py-1.5 backdrop-blur-md ${e.type === "goal" ? "font-display text-sm text-primary" : ""}`}
        >
          <span className="w-8 shrink-0 tabular-nums text-white/45">{e.minute}'</span>
          <span className="shrink-0">{eventIcon(e.type)}</span>
          <span>{e.text}</span>
        </p>
      ))}
    </div>
  );
});
