import { Coins, Crown, Dumbbell, Palette, Search } from "lucide-react";
import { careerValue, parseOfferContents, type CareerBenefit } from "@/game/store-value";

const ICONS: Record<CareerBenefit["kind"], typeof Coins> = {
  coins: Coins,
  scout: Search,
  training: Dumbbell,
  cosmetic: Palette,
  pass: Crown,
};

/** "What changes in your career" summary shown on each offer before checkout. */
export function CareerValueBox({ kind, contents }: { kind: string; contents: unknown }) {
  const value = careerValue(kind, parseOfferContents(contents));
  if (value.benefits.length === 0) return null;
  return (
    <section
      aria-label="O que muda na sua carreira"
      className="mt-4 rounded-xl border border-border/60 bg-background/40 p-3"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
        Na sua carreira
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value.headline}</p>
      <ul className="mt-2 space-y-2">
        {value.benefits.map((benefit) => {
          const Icon = ICONS[benefit.kind];
          return (
            <li key={benefit.title} className="flex gap-2 text-xs">
              <Icon size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                <span className="font-medium text-foreground">{benefit.title}</span>
                <span className="block text-muted-foreground">{benefit.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {value.coinEquivalent > 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {kind === "pass" ? "Equivale a cerca de " : "Equivale a "}
          {value.coinEquivalent.toLocaleString("pt-BR")} moedas
          {kind === "pass" ? " por mês" : ""} na troca dentro do jogo.
        </p>
      ) : null}
    </section>
  );
}
