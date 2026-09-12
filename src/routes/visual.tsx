/**
 * /visual — Ajustes visuais do jogo.
 *
 * Tudo aqui é salvo no navegador (localStorage) e lido pelo estádio 3D e pela
 * "cara" da partida: texturas, densidade da grama, detalhe dos jogadores,
 * torcida, clima, horário, corte do gramado (geral e por clube) e efeitos.
 */
import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";

import { GameShell } from "@/components/game/GameShell";
import { Chips } from "@/components/game/CrestBuilder";
import { Crest } from "@/components/game/Crest";
import { MOW_PATTERNS, type MowPattern } from "@/components/game/stadium/textures/grass";
import { CLUBS, getLeague } from "@/game/data/leagues";
import type { TimeOfDay, Weather } from "@/game/matchday";
import {
  resetVisual,
  setClubVisual,
  setVisual,
  useVisual,
  type Auto,
  type QualityPref,
  type ShadowPref,
} from "@/game/visual-settings";
import { useCareer } from "@/hooks/useCareer";

export const Route = createFileRoute("/visual")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ajustes visuais · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      {
        property: "og:title",
        content: "Ajustes visuais · Pro Football Manager 3D: Jogo de Futebol Manager Online",
      },
      {
        property: "og:description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VisualPage,
});

const MOW_LABEL: Record<MowPattern, string> = {
  stripes: "Faixas",
  checker: "Xadrez",
  rings: "Anéis",
  diagonal: "Diagonal",
  wide: "Faixas largas",
};

const WEATHER_LABEL: Record<Weather, string> = {
  seco: "Seco",
  molhado: "Molhado",
  chuva: "Chuva",
  neve: "Neve",
};

const TIME_LABEL: Record<TimeOfDay, string> = {
  dia: "Dia",
  entardecer: "Entardecer",
  noite: "Noite",
};

/** Prévia simples do corte do gramado (sem 3D, leve no celular). */
function MowPreview({ pattern }: { pattern: MowPattern }) {
  const a = "#2f7d3a";
  const b = "#3d9a4a";
  const bg: Record<MowPattern, string> = {
    stripes: `repeating-linear-gradient(90deg, ${a} 0 12px, ${b} 12px 24px)`,
    wide: `repeating-linear-gradient(90deg, ${a} 0 26px, ${b} 26px 52px)`,
    diagonal: `repeating-linear-gradient(45deg, ${a} 0 14px, ${b} 14px 28px)`,
    checker: `repeating-linear-gradient(90deg, ${a} 0 16px, ${b} 16px 32px), repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 16px, transparent 16px 32px)`,
    rings: `repeating-radial-gradient(circle at 50% 50%, ${a} 0 12px, ${b} 12px 24px)`,
  };
  return (
    <div
      aria-hidden
      className="h-16 w-full rounded-lg border border-border/60"
      style={{ backgroundImage: bg[pattern], backgroundBlendMode: "overlay" }}
    />
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{value.toFixed(1)}×</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-primary"
        aria-label={label}
      />
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function VisualPage() {
  const { career } = useCareer();
  const v = useVisual();

  const myClub = career ? CLUBS[career.clubId] : undefined;
  const leagueClubs = career ? (getLeague(career.leagueId)?.clubs ?? []) : [];
  const clubs = leagueClubs.length ? leagueClubs : myClub ? [myClub] : [];

  const effectiveMow: MowPattern = v.mow === "auto" ? "stripes" : v.mow;

  return (
    <GameShell career={career}>
      <header className="rounded-2xl border border-border/60 surface-card p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl uppercase tracking-wide">Ajustes visuais</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Deixe o jogo mais bonito ou mais leve. Tudo fica salvo neste aparelho e vale para
              todas as partidas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => resetVisual()}
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm hover:border-primary/50"
          >
            <RotateCcw size={16} /> Restaurar
          </button>
        </div>
      </header>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-border/60 surface-card p-5">
          <h2 className="font-display text-lg uppercase tracking-wide">Qualidade</h2>
          <div className="mt-4 space-y-4">
            <Chips
              label="Nível geral"
              value={v.quality}
              onChange={(quality) => setVisual({ quality: quality as QualityPref })}
              options={[
                { id: "auto" as const, label: "Automático" },
                { id: "baixa" as const, label: "Baixa" },
                { id: "media" as const, label: "Média" },
                { id: "alta" as const, label: "Alta" },
              ]}
            />
            <Chips
              label="Riqueza das texturas"
              value={v.textureDetail}
              onChange={(textureDetail) => setVisual({ textureDetail })}
              options={[
                { id: "baixa" as const, label: "Baixa" },
                { id: "media" as const, label: "Média" },
                { id: "alta" as const, label: "Alta" },
              ]}
            />
            <Chips
              label="Detalhe dos jogadores"
              value={v.playerDetail}
              onChange={(playerDetail) => setVisual({ playerDetail })}
              options={[
                { id: "simples" as const, label: "Simples" },
                { id: "padrao" as const, label: "Padrão" },
                { id: "detalhado" as const, label: "Detalhado" },
              ]}
            />
            <Slider
              label="Grama"
              value={v.grassDensity}
              min={0}
              max={1.5}
              step={0.1}
              onChange={(grassDensity) => setVisual({ grassDensity })}
              hint="Menos grama deixa o jogo bem mais leve no celular."
            />
            <Slider
              label="Torcida"
              value={v.crowdDensity}
              min={0.2}
              max={1.5}
              step={0.1}
              onChange={(crowdDensity) => setVisual({ crowdDensity })}
              hint="Quantidade de pessoas nas arquibancadas."
            />
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3 text-sm">
              <span>
                Efeitos de imagem
                <span className="block text-[11px] text-muted-foreground">
                  Brilho, foco e granulado de transmissão de TV.
                </span>
              </span>
              <input
                type="checkbox"
                checked={v.postFx}
                onChange={(e) => setVisual({ postFx: e.target.checked })}
                className="size-5 accent-primary"
              />
            </label>
            <Slider
              label="Força dos efeitos"
              value={v.postIntensity}
              min={0.2}
              max={1.4}
              step={0.1}
              onChange={(postIntensity) => setVisual({ postIntensity })}
              hint="Quanto mais forte, mais 'cara de TV' — e mais pesado."
            />
            <Slider
              label="Partículas"
              value={v.particles}
              min={0}
              max={1.5}
              step={0.1}
              onChange={(particles) => setVisual({ particles })}
              hint="Chuva, neve, confete e fumaça."
            />
            <Slider
              label="Nitidez do 3D"
              value={v.resolutionScale}
              min={0.6}
              max={1.2}
              step={0.1}
              onChange={(resolutionScale) => setVisual({ resolutionScale })}
              hint="Abaixe para ganhar desempenho no celular."
            />
            <Chips
              label="Sombras"
              value={v.shadows}
              onChange={(shadows) => setVisual({ shadows: shadows as ShadowPref })}
              options={[
                { id: "auto" as const, label: "Automático" },
                { id: "ligadas" as const, label: "Ligadas" },
                { id: "desligadas" as const, label: "Desligadas" },
              ]}
            />
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3 text-sm">
              <span>
                Ajuste automático
                <span className="block text-[11px] text-muted-foreground">
                  O jogo baixa ou sobe a qualidade sozinho para não travar.
                </span>
              </span>
              <input
                type="checkbox"
                checked={v.adaptive}
                onChange={(e) => setVisual({ adaptive: e.target.checked })}
                className="size-5 accent-primary"
              />
            </label>
            <label className="block rounded-xl border border-border/60 p-3 text-sm">
              <span>
                Placas do estádio
                <span className="block text-[11px] text-muted-foreground">
                  Coloque sites de marcas separados por vírgula (ex.: nike.com, spotify.com) e os
                  logos aparecem nas placas de LED à beira do campo.
                </span>
              </span>
              <input
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                defaultValue={v.sponsors.join(", ")}
                placeholder="nike.com, spotify.com"
                onBlur={(e) =>
                  setVisual({
                    sponsors: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .slice(0, 8),
                  })
                }
              />
            </label>
          </div>
        </article>

        <article className="rounded-2xl border border-border/60 surface-card p-5">
          <h2 className="font-display text-lg uppercase tracking-wide">Clima e horário</h2>
          <div className="mt-4 space-y-4">
            <Chips
              label="Clima"
              value={v.weather}
              onChange={(weather) => setVisual({ weather: weather as Auto<Weather> })}
              options={[
                { id: "auto" as const, label: "Automático" },
                ...(Object.keys(WEATHER_LABEL) as Weather[]).map((w) => ({
                  id: w,
                  label: WEATHER_LABEL[w],
                })),
              ]}
            />
            <Chips
              label="Horário"
              value={v.time}
              onChange={(time) => setVisual({ time: time as Auto<TimeOfDay> })}
              options={[
                { id: "auto" as const, label: "Automático" },
                ...(Object.keys(TIME_LABEL) as TimeOfDay[]).map((t) => ({
                  id: t,
                  label: TIME_LABEL[t],
                })),
              ]}
            />
            <Chips
              label="Corte do gramado"
              value={v.mow}
              onChange={(mow) => setVisual({ mow: mow as Auto<MowPattern> })}
              options={[
                { id: "auto" as const, label: "Automático" },
                ...MOW_PATTERNS.map((m) => ({ id: m, label: MOW_LABEL[m] })),
              ]}
            />
            <MowPreview pattern={effectiveMow} />
            <Slider
              label="Vento"
              value={v.wind === "auto" ? 0.5 : v.wind}
              min={0}
              max={1}
              step={0.1}
              onChange={(wind) => setVisual({ wind })}
              hint={
                v.wind === "auto"
                  ? "Automático: cada partida sorteia o vento. Mexa para fixar."
                  : "Vento fixo em todas as partidas."
              }
            />
            {v.wind !== "auto" ? (
              <button
                type="button"
                onClick={() => setVisual({ wind: "auto" })}
                className="rounded-full border border-border/60 px-3 py-1 text-[11px] text-muted-foreground hover:border-primary/50"
              >
                Voltar o vento para automático
              </button>
            ) : null}
            <Slider
              label="Tom do gramado"
              value={v.grassTint}
              min={-1}
              max={1}
              step={0.1}
              onChange={(grassTint) => setVisual({ grassTint })}
              hint="Negativo deixa a grama mais clara; positivo, mais escura."
            />
            <Slider
              label="Desgaste do gramado"
              value={v.grassWear}
              min={0}
              max={1}
              step={0.1}
              onChange={(grassWear) => setVisual({ grassWear })}
              hint="Campo impecável ou bem castigado pelos jogos."
            />
          </div>
        </article>
      </section>

      {clubs.length ? (
        <section className="mt-4 rounded-2xl border border-border/60 surface-card p-5">
          <h2 className="font-display text-lg uppercase tracking-wide">Corte por clube</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Cada estádio pode ter o seu desenho de grama nos jogos em casa.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {clubs.map((c) => {
              const cur = v.byClub[c.id]?.mow;
              return (
                <div key={c.id} className="rounded-xl border border-border/60 p-3">
                  <div className="flex items-center gap-2">
                    <Crest club={c} size={26} detail="simple" />
                    <span className="truncate text-sm font-medium">{c.name}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setClubVisual(c.id, null)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                        !cur
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border/60 text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      Automático
                    </button>
                    {MOW_PATTERNS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setClubVisual(c.id, { mow: m })}
                        className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                          cur === m
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border/60 text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {MOW_LABEL[m]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </GameShell>
  );
}
