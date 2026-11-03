import { eventIcon } from "./event-icon";
import { StatRow } from "./MatchHud";
import type { Snap } from "./types";

/** Live match statistics: bottom drawer on phones, side panel on desktop. */
export function MatchStatsPanel({ snap, onClose }: { snap: Snap; onClose: () => void }) {
  return (
    <div className="match-stats-panel pointer-events-auto absolute inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 max-h-[55vh] space-y-3 overflow-y-auto rounded-xl border border-primary/25 bg-[#07100d]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl md:inset-x-auto md:bottom-auto md:right-3 md:top-24 md:max-h-none md:w-64 md:rounded-xl md:p-3">
      <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-white/25 md:hidden" />
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[10px] uppercase tracking-[0.25em] text-white/50">
          Estatísticas
        </h2>
        <button
          onClick={onClose}
          aria-label="Fechar estatísticas"
          className="min-h-11 rounded-full bg-white/10 px-4 text-xs text-white/70"
        >
          Fechar
        </button>
      </div>
      <StatRow label="Posse" h={snap.poss[0]} a={snap.poss[1]} />
      <StatRow label="Chutes" h={snap.hShots} a={snap.aShots} />
      <StatRow label="No gol" h={snap.hOn} a={snap.aOn} />
      <StatRow label="xG" h={snap.hXg} a={snap.aXg} />
      <StatRow label="Passes" h={snap.hPass} a={snap.aPass} />
      <StatRow label="Passes certos" h={snap.hPassOk} a={snap.aPassOk} />
      <div className="flex items-center justify-between text-[11px] text-white/60">
        <span className="font-display tabular-nums text-white">
          {snap.hPass ? Math.round((snap.hPassOk / snap.hPass) * 100) : 0}%
        </span>
        <span className="uppercase tracking-widest">Acerto de passe</span>
        <span className="font-display tabular-nums text-white">
          {snap.aPass ? Math.round((snap.aPassOk / snap.aPass) * 100) : 0}%
        </span>
      </div>
      <StatRow label="Escanteios" h={snap.hCorners} a={snap.aCorners} />
      <StatRow label="Faltas" h={snap.hFouls} a={snap.aFouls} />
      <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-[11px] text-white/70">
        <span className="font-display tabular-nums text-white">
          <span className="mr-1 inline-block h-2.5 w-2 rounded-[2px] bg-yellow-400 align-middle" />
          {snap.hYellow}
          <span className="ml-2 mr-1 inline-block h-2.5 w-2 rounded-[2px] bg-red-500 align-middle" />
          {snap.hRed}
        </span>
        <span className="uppercase tracking-widest">Cartões</span>
        <span className="font-display tabular-nums text-white">
          {snap.aYellow}
          <span className="mx-1 inline-block h-2.5 w-2 rounded-[2px] bg-yellow-400 align-middle" />
          {snap.aRed}
          <span className="ml-1 inline-block h-2.5 w-2 rounded-[2px] bg-red-500 align-middle" />
        </span>
      </div>
      {/* eventos ao vivo — no celular o feed lateral fica oculto */}
      <div className="md:hidden">
        <p className="mb-1 font-display text-[10px] uppercase tracking-[0.25em] text-white/50">
          Lances
        </p>
        <div className="space-y-1 text-xs text-white/85">
          {[...snap.events]
            .reverse()
            .slice(0, 8)
            .map((e, i) => (
              <p key={`${e.minute}-${i}`} className="flex gap-2">
                <span className="w-7 shrink-0 tabular-nums text-white/45">{e.minute}'</span>
                <span className="shrink-0">{eventIcon(e.type)}</span>
                <span>{e.text}</span>
              </p>
            ))}
        </div>
      </div>
    </div>
  );
}
