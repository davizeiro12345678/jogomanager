import { Check, Monitor, Sparkles, Gauge, Clapperboard } from "lucide-react";
import {
  activeGraphicsPreset,
  GRAPHICS_PRESETS,
  graphicsPresetPatch,
} from "@/game/graphics-presets";
import { setVisual, useVisual } from "@/game/visual-settings";

const ICONS = [Gauge, Monitor, Clapperboard, Sparkles];

export function GraphicsPresets() {
  const visual = useVisual();
  const active = activeGraphicsPreset(visual);
  return (
    <section
      aria-label="Perfis gráficos"
      className="mt-4 rounded-2xl border border-border/60 surface-card p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg uppercase tracking-wide">Escolha o acabamento</h2>
        <span className="text-xs text-muted-foreground">
          {active ? "Perfil selecionado" : "Ajustes personalizados"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Aplique um conjunto de ajustes e refine os detalhes abaixo. A prévia dos atletas usa detalhe
        alto para comparação.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {GRAPHICS_PRESETS.map((preset, index) => {
          const Icon = ICONS[index]!;
          const selected = active === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={selected}
              aria-label={`Perfil ${preset.label}`}
              onClick={() => setVisual(graphicsPresetPatch(preset.id))}
              className={`min-h-28 rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                selected
                  ? "border-primary bg-primary/10"
                  : "border-border/70 hover:border-primary/50 hover:bg-secondary/50"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Icon size={18} className={selected ? "text-primary" : "text-muted-foreground"} />
                {preset.label}
                {selected ? <Check size={16} className="ml-auto text-primary" aria-hidden /> : null}
              </span>
              <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
                {preset.detail}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
