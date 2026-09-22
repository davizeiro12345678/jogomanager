import { Link } from "@tanstack/react-router";
import { Camera, ChevronRight, Clapperboard, Focus, Play, Radio, Sparkles } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { SceneArt } from "@/content/cutscenes";

type ShotId = "stadium" | "duel" | "goal" | "reaction";

interface ShotPreview {
  id: ShotId;
  label: string;
  title: string;
  description: string;
  lens: string;
  duration: string;
  focus: string;
  position: string;
  art: SceneArt;
}

const CinematicStage3D = lazy(() =>
  import("@/components/game/CinematicStage3D").then((module) => ({ default: module.CinematicStage3D })),
);

const SHOT_PREVIEWS: readonly ShotPreview[] = [
  {
    id: "stadium",
    label: "Abertura",
    title: "Grua sobre o estádio",
    description: "Um plano amplo apresenta o gramado, a torcida e a leitura tática antes do apito.",
    lens: "24 mm · plano aberto",
    duration: "4–6 s",
    focus: "Estádio e formação",
    position: "object-[50%_34%]",
    art: "arrival",
  },
  {
    id: "duel",
    label: "Duelo",
    title: "Travelling de transição",
    description: "A câmera aproxima a disputa sem perder a bola e retorna ao enquadramento de transmissão.",
    lens: "40 mm · lateral baixa",
    duration: "2–3 s",
    focus: "Portador da bola",
    position: "object-[50%_58%]",
    art: "tunnel",
  },
  {
    id: "goal",
    label: "Finalização",
    title: "Linha do gol e rede",
    description: "O Diretor privilegia a área no momento do chute e preserva a leitura do lance para o replay.",
    lens: "55 mm · goal-line",
    duration: "1,5–2,5 s",
    focus: "Bola e goleiro",
    position: "object-[68%_62%]",
    art: "pitchentry",
  },
  {
    id: "reaction",
    label: "Reação",
    title: "Torcida e comemoração",
    description: "O corte editorial entra depois da confirmação do gol e volta à TV antes do reinício.",
    lens: "50 mm · retrato",
    duration: "3–5 s",
    focus: "Heróis e arquibancada",
    position: "object-[34%_42%]",
    art: "celebration",
  },
];

function Poster({ posterSrc, activeShot }: { posterSrc: string; activeShot: ShotPreview }) {
  return (
    <img
      key={activeShot.id}
      src={posterSrc}
      alt="Estádio iluminado do Pro Football Manager 3D durante uma transmissão noturna"
      width={1600}
      height={912}
      loading="lazy"
      decoding="async"
      className={`absolute inset-0 h-full w-full scale-110 object-cover ${activeShot.position} opacity-75 transition-[object-position,opacity,transform] duration-700 motion-reduce:transition-none`}
    />
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

export function HomeCinematicShowcase({ posterSrc }: { posterSrc: string }) {
  const [activeShotId, setActiveShotId] = useState<ShotId>("stadium");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isClientReady, setIsClientReady] = useState(false);
  const reducedMotion = useReducedMotion();
  const activeShot = SHOT_PREVIEWS.find((shot) => shot.id === activeShotId) ?? SHOT_PREVIEWS[0]!;

  // Mantém o hero como HTML e imagem no SSR. A carga do palco, do Three e do
  // Canvas só começa no navegador depois de uma escolha explícita da pessoa.
  useEffect(() => setIsClientReady(true), []);

  return (
    <section
      id="cinema"
      aria-labelledby="cinema-title"
      className="mt-12 overflow-hidden rounded-[2rem] border border-primary/25 bg-card/55 shadow-[0_30px_100px_-54px_hsl(var(--primary)/0.8)]"
    >
      <div className="grid lg:grid-cols-[0.92fr_1.08fr]">
        <div className="relative min-h-[23rem] overflow-hidden bg-background sm:min-h-[28rem]">
          {isPreviewOpen && isClientReady && !reducedMotion ? (
            <Suspense fallback={<Poster posterSrc={posterSrc} activeShot={activeShot} />}>
              <CinematicStage3D
                art={activeShot.art}
                primary="#4ade80"
                secondary="#0f3b2d"
                mood={activeShot.id === "reaction" ? "good" : "neutral"}
              />
            </Suspense>
          ) : (
            <Poster posterSrc={posterSrc} activeShot={activeShot} />
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(125deg,hsl(var(--background)/0.92)_0%,hsl(var(--background)/0.18)_55%,hsl(var(--background)/0.8)_100%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-60 [background-image:linear-gradient(hsl(var(--primary)/0.12)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary)/0.12)_1px,transparent_1px)] [background-size:3rem_3rem] [mask-image:linear-gradient(to_bottom,black,transparent)]"
          />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5 text-[0.65rem] font-medium uppercase tracking-[0.26em] text-primary sm:p-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-background/70 px-3 py-1.5 backdrop-blur">
              <Radio size={12} aria-hidden="true" /> transmissão 3D
            </span>
            <span className="rounded-full bg-background/70 px-3 py-1.5 text-foreground/80 backdrop-blur">
              {activeShot.lens}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/40 bg-background/75 text-primary shadow-lg shadow-primary/20 backdrop-blur">
              <Play size={19} fill="currentColor" aria-hidden="true" />
            </span>
            <p className="mt-4 max-w-sm font-display text-2xl uppercase leading-none tracking-wide text-foreground sm:text-3xl">
              {activeShot.title}
            </p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">{activeShot.description}</p>
          </div>
        </div>

        <div className="p-5 sm:p-7 lg:p-9">
          <p className="inline-flex items-center gap-2 font-display text-[0.7rem] uppercase tracking-[0.32em] text-primary">
            <Clapperboard size={15} aria-hidden="true" /> cinema de partida
          </p>
          <h2 id="cinema-title" className="mt-3 max-w-xl font-display text-3xl uppercase leading-[0.95] tracking-wide sm:text-4xl">
            O jogo sabe quando abrir o plano.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            O Diretor alterna entre transmissão, grua, travelling, linha do gol e reação da torcida
            somente quando o momento pede. Você continua livre para fixar sua câmera favorita.
          </p>

          <div className="mt-7 grid gap-2 sm:grid-cols-2" role="list" aria-label="Roteiro de câmera">
            {SHOT_PREVIEWS.map((shot) => {
              const isActive = activeShot.id === shot.id;
              return (
                <button
                  key={shot.id}
                  type="button"
                  onClick={() => setActiveShotId(shot.id)}
                  aria-pressed={isActive}
                  className={`group flex min-h-14 items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card motion-reduce:transition-none ${
                    isActive
                      ? "border-primary/60 bg-primary/12 text-foreground"
                      : "border-border/60 bg-background/35 text-muted-foreground hover:border-primary/35 hover:bg-background/65 hover:text-foreground"
                  }`}
                >
                  <span>
                    <span className="block font-display text-sm uppercase tracking-wide">{shot.label}</span>
                    <span className="mt-0.5 block text-xs opacity-75">{shot.lens}</span>
                  </span>
                  <ChevronRight
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            aria-expanded={isExpanded}
            aria-controls="cinema-details"
            onClick={() => setIsExpanded((expanded) => !expanded)}
          >
            <Camera size={16} aria-hidden="true" />
            {isExpanded ? "Fechar roteiro técnico" : "Ver roteiro técnico"}
          </button>

          {isExpanded ? (
            <div
              id="cinema-details"
              className="mt-4 grid gap-3 rounded-2xl border border-border/60 bg-background/45 p-4 text-sm sm:grid-cols-3"
            >
              <div>
                <span className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">Duração</span>
                <p className="mt-1 font-display uppercase tracking-wide text-foreground">{activeShot.duration}</p>
              </div>
              <div>
                <span className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">Prioridade</span>
                <p className="mt-1 font-display uppercase tracking-wide text-foreground">{activeShot.focus}</p>
              </div>
              <div>
                <span className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">Retorno</span>
                <p className="mt-1 font-display uppercase tracking-wide text-foreground">TV estável</p>
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              data-testid="home-open-3d-preview"
              className="min-h-11"
              variant={isPreviewOpen ? "outline" : "secondary"}
              onClick={() => setIsPreviewOpen((open) => !open)}
              aria-pressed={isPreviewOpen}
              disabled={reducedMotion}
            >
              <Play size={16} fill="currentColor" aria-hidden="true" />
              {isPreviewOpen ? "Voltar à prévia leve" : "Abrir prévia 3D"}
            </Button>
            <Button className="min-h-11" asChild>
              <Link to="/partida-rapida">
                Testar o Diretor <Sparkles aria-hidden="true" />
              </Link>
            </Button>
            <Button className="min-h-11 bg-background/45" variant="outline" asChild>
              <Link to="/replays">
                Ver replays <Focus aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {reducedMotion
              ? "A prévia 3D está desativada porque seu aparelho pediu redução de movimento."
              : "A página começa com uma imagem estática; a cena 3D só é iniciada quando você escolhe abri-la."}
          </p>
        </div>
      </div>
    </section>
  );
}
