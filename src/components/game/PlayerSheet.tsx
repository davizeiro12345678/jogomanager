import { PlayerPortrait } from "@/components/game/PlayerPortrait";
import { useEffect, useRef } from "react";
import { ATTR_LABELS, attrTone, groupsFor, PERSONALITY_DESC, profileFor } from "@/game/attributes";
import { CLUBS } from "@/game/data/leagues";
import { formatMoney, formatWage } from "@/game/economy";
import type { CareerState, Player } from "@/game/types";
import { formAdjustment, POSITION_WEIGHTS, positionalOverall } from "@/game/overall";
import { DEVELOPMENT_OVR_WEIGHTS, effectivePlayer } from "@/game/player-development";

const CORE_LABELS = {
  pace: "Velocidade",
  shooting: "Finalização",
  passing: "Passe",
  defending: "Defesa",
  physical: "Físico",
} as const;

/** Mostra como cada atributo pesa no overall desta posição. */
function OverallBreakdown({ player }: { player: Player }) {
  const baseline = player.developmentBase?.rulesVersion === 2 ? player.developmentBase : undefined;
  const weights = baseline ? DEVELOPMENT_OVR_WEIGHTS[player.pos] : POSITION_WEIGHTS[player.pos];
  const base = baseline?.ovr ?? positionalOverall(player.pos, player);
  const form = formAdjustment(player.form ?? 60);
  const keys = (Object.keys(CORE_LABELS) as (keyof typeof CORE_LABELS)[]).filter(
    (k) => weights[k] > 0,
  );
  return (
    <section className="mt-4 rounded-xl border border-border/50 bg-background/40 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Como o overall é calculado · {player.pos}
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {keys.map((k) => (
          <li key={k} className="flex items-center justify-between gap-2">
            <span>
              {CORE_LABELS[k]}{" "}
              <span className="text-muted-foreground">
                ({(player[k] - (baseline?.core[k] ?? 0)).toFixed(1)} ×{" "}
                {Math.round(weights[k] * 100)}%)
              </span>
            </span>
            <span className="hud-num">
              {((player[k] - (baseline?.core[k] ?? 0)) * weights[k]).toFixed(1)}
            </span>
          </li>
        ))}
        <li className="flex justify-between border-t border-border/50 pt-1">
          <span>{baseline ? "Overall inicial" : "Base pela posição"}</span>
          <span className="hud-num">{base}</span>
        </li>
        <li className="flex justify-between">
          <span>Forma recente</span>
          <span className="hud-num">
            {form >= 0 ? "+" : ""}
            {form}
          </span>
        </li>
        <li className="flex justify-between text-muted-foreground">
          <span>Overall atual</span>
          <span className="hud-num font-semibold text-primary">{player.ovr.toFixed(1)}</span>
        </li>
      </ul>
    </section>
  );
}

function Bar({ v }: { v: number }) {
  return (
    <span className="ml-2 inline-block h-1.5 w-16 overflow-hidden rounded bg-muted align-middle">
      <span className="block h-full rounded bg-primary" style={{ width: `${v}%` }} />
    </span>
  );
}

/** Ficha completa do jogador: retrato, atributos, personalidade e carreira. */
export function PlayerSheet({
  player,
  career,
  onClose,
}: {
  player: Player;
  career?: CareerState;
  onClose: () => void;
}) {
  player = effectivePlayer(player, career);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab" && dialog) {
        const controls = [
          ...dialog.querySelectorAll<HTMLElement>(
            "button, a[href], input, select, textarea, [tabindex]",
          ),
        ].filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(":disabled") &&
            element.getClientRects().length > 0,
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [onClose]);
  const prof = profileFor(player, career);
  const club = CLUBS[player.clubId];
  const groups = groupsFor(player.pos);

  return (
    <div
      ref={dialogRef}
      className="career-player-dialog fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label={`Ficha de ${player.name}`}
      onClick={onClose}
    >
      <div
        className="my-6 w-full max-w-3xl rounded-2xl border border-border/60 bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-wrap items-center gap-4">
          <PlayerPortrait
            player={player}
            size={84}
            primary={club?.primary ?? "#0a8f3c"}
            secondary={club?.secondary ?? "#ffffff"}
          />
          <div className="min-w-40 flex-1">
            <h2 className="font-display text-xl uppercase tracking-wide">{player.name}</h2>
            <p className="text-sm text-muted-foreground">
              #{player.number} · {player.pos} · {player.age} anos · {club?.name ?? "sem clube"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {prof.height} cm · {prof.weight} kg · pé {prof.foot} · afinidade com você{" "}
              {prof.rapport}%
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl text-primary">{Math.round(player.ovr)}</p>
            <p className="text-[11px] uppercase text-muted-foreground">
              potencial {player.potential ?? player.ovr}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border/60 px-3 py-1.5 text-sm"
          >
            Fechar
          </button>
        </header>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            ["Condição", `${player.condition}%`],
            ["Moral", `${player.morale}%`],
            ["Salário", formatWage(player.wage)],
            ["Valor", formatMoney(player.value)],
          ].map(([k, v]) => (
            <div
              key={k}
              className="rounded-xl border border-border/50 bg-background/40 p-2 text-center"
            >
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</p>
              <p className="text-sm font-semibold">{v}</p>
            </div>
          ))}
        </div>

        <OverallBreakdown player={player} />

        <section className="mt-4 rounded-xl border border-border/50 bg-background/40 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Personalidade · {prof.personality}
          </p>
          <p className="mt-1 text-sm">{PERSONALITY_DESC[prof.personality]}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {prof.traits.map((t) => (
              <span
                key={t}
                className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] text-primary"
              >
                {t}
              </span>
            ))}
          </div>
        </section>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <section
              key={g.label}
              className="rounded-xl border border-border/50 bg-background/40 p-3"
            >
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">{g.label}</h3>
              <ul className="mt-2 space-y-1">
                {g.keys.map((k) => (
                  <li key={k} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{ATTR_LABELS[k]}</span>
                    <span className={attrTone(prof.attrs[k])}>
                      {Math.round(prof.attrs[k])}
                      <Bar v={Math.round(prof.attrs[k])} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="mt-4 rounded-xl border border-border/50 bg-background/40 p-3">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
            Passagem por clubes
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {prof.spells.map((s, i) => (
              <li key={`${s.clubId}-${i}`} className="flex justify-between gap-3">
                <span>
                  {s.from}–{s.to} · {s.clubName}
                </span>
                <span className="text-muted-foreground">
                  {s.apps} jogos · {s.goals} gols
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
