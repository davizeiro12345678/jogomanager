import { useMemo, useState } from "react";
import { Clapperboard, Play } from "lucide-react";
import { CUTSCENES } from "@/content/cutscenes";
import { safeClub } from "@/game/squad";
import type { ManagerLook } from "@/game/types";
import type { QualityLevel } from "@/game/device";
import { CutsceneStage as Cutscene } from "./CutsceneStage";

const look: ManagerLook = { skin: 2, hair: 2, hairColor: "#30231d", beard: 1, outfit: 1 };
const examples = ["dressing", "press", "arrival", "board", "tunnel", "trophy"] as const;
const labels = ["Vestiário", "Coletiva", "Chegada", "Diretoria", "Túnel", "Taça"];

export default function CinematicStudio({ clubId = "fla" }: { clubId?: string }) {
  const [scene, setScene] = useState<string | null>(null);
  const [selected, setSelected] = useState("derby-eve-talk");
  const [outcome, setOutcome] = useState("");
  const [quality, setQuality] = useState<QualityLevel | "auto">("auto");
  const club = safeClub(clubId);
  const scenes = useMemo(() => Object.values(CUTSCENES), []);
  return (
    <section
      className="mt-5 rounded-2xl border border-border/70 surface-card p-5"
      aria-label="Prévia das cenas cinematográficas"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-primary">
            <Clapperboard size={16} /> Cinema da carreira
          </p>
          <h2 className="font-display text-xl uppercase">A cena ocupa o palco</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Confira os personagens, a luz e a câmera. As escolhas nesta prévia servem apenas para
            experimentar o diálogo.
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <select
            aria-label="Cena cinematográfica"
            className="h-11 w-full max-w-xs rounded-xl border border-border bg-background px-3 text-sm sm:w-64"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            {scenes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Qualidade do cinema"
            value={quality}
            onChange={(event) => setQuality(event.target.value as QualityLevel | "auto")}
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="auto">Qualidade automática</option>
            <option value="alta">Mais detalhes</option>
            <option value="media">Equilibrada</option>
            <option value="baixa">Mais leve</option>
          </select>
          <button
            type="button"
            className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            onClick={() => {
              setOutcome("");
              setScene(selected);
            }}
          >
            <Play size={16} /> Ver cena
          </button>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {examples.map((art, index) => (
          <button
            type="button"
            key={art}
            onClick={() => {
              const example = scenes.find((item) => item.art === art);
              if (example) {
                setOutcome("");
                setScene(example.id);
              }
            }}
            className="min-h-12 rounded-xl border border-border/70 bg-secondary/40 px-3 text-sm font-semibold transition-colors hover:border-primary/50 hover:bg-primary/10"
          >
            {labels[index]}
          </button>
        ))}
      </div>
      {outcome ? (
        <p role="status" className="mt-3 text-sm text-primary">
          {outcome}
        </p>
      ) : null}
      {scene ? (
        <Cutscene
          scene={scene}
          look={look}
          cinematic
          accent={club.primary}
          accent2={club.secondary}
          club={club}
          managerName="Treinador"
          renderQuality={quality}
          onEffect={() => setOutcome("Resposta experimentada. A prévia não altera sua carreira.")}
          onDone={() => setScene(null)}
        />
      ) : null}
    </section>
  );
}
