import { useMemo, useState } from "react";
import {
  Clapperboard,
  Play,
  Shirt,
  Mic2,
  BusFront,
  Building2,
  DoorOpen,
  Trophy,
  Search,
  Activity,
  Dumbbell,
  HeartPulse,
} from "lucide-react";
import { CUTSCENES } from "@/content/cutscenes";
import { safeClub } from "@/game/squad";
import type { ManagerLook } from "@/game/types";
import type { QualityLevel } from "@/game/device";
import { CutsceneStage as Cutscene } from "./CutsceneStage";
import { preloadCinematicStage, useCinematicPreload } from "./cinematic-loading";
import "./studio.css";

const look: ManagerLook = { skin: 2, hair: 2, hairColor: "#30231d", beard: 1, outfit: 1 };
const examples = [
  { art: "dressing", label: "Vestiário", hint: "Conversas de grupo", icon: Shirt },
  { art: "press", label: "Coletiva", hint: "Sob os holofotes", icon: Mic2 },
  { art: "arrival", label: "Chegada", hint: "A recepção da torcida", icon: BusFront },
  { art: "board", label: "Diretoria", hint: "Decisões nos bastidores", icon: Building2 },
  { art: "tunnel", label: "Túnel", hint: "Antes de entrar em campo", icon: DoorOpen },
  { art: "trophy", label: "Taça", hint: "A noite da conquista", icon: Trophy },
  { art: "training", label: "Treino", hint: "Trabalho com bola", icon: Activity },
  { art: "gym", label: "Academia", hint: "Preparação e força", icon: Dumbbell },
  { art: "medical", label: "Departamento médico", hint: "Cuidar de quem joga", icon: HeartPulse },
] as const;
const searchable = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export default function CinematicStudio({ clubId = "fla" }: { clubId?: string }) {
  useCinematicPreload();
  const [scene, setScene] = useState<string | null>(null);
  const [selected, setSelected] = useState("derby-eve-talk");
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState("");
  const [quality, setQuality] = useState<QualityLevel | "auto">("auto");
  const [previewTime, setPreviewTime] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [narration, setNarration] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const club = safeClub(clubId);
  const scenes = useMemo(() => Object.values(CUTSCENES), []);
  const filtered = useMemo(
    () => scenes.filter((item) => searchable(item.title).includes(searchable(query))),
    [scenes, query],
  );
  const selectedScene = CUTSCENES[selected];
  const open = (id: string) => {
    setOutcome("");
    setScene(id);
  };
  return (
    <section className="studio-card" aria-label="Prévia das cenas cinematográficas">
      <div className="cinema-intro">
        <div className="mr-auto">
          <p className="studio-kicker flex items-center gap-2">
            <Clapperboard size={16} />
            Cinema da carreira
          </p>
          <h2>
            O futebol também acontece
            <br />
            fora das quatro linhas.
          </h2>
          <p className="studio-hint">
            Explore os ambientes, os exercícios, os olhares e os diálogos em uma cena 3D. Suas
            escolhas aqui ficam apenas na prévia.
          </p>
        </div>
        <span className="studio-height">{scenes.length} cenas para explorar</span>
      </div>
      <div className="studio-toolbar">
        <label className="min-w-0 flex-1 basis-48 text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <Search size={14} />
            Buscar cena
          </span>
          <input
            type="search"
            className="studio-input"
            aria-label="Buscar cena"
            placeholder="Clássico, contratação, título…"
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              setQuery(value);
              const first = scenes.find((item) =>
                searchable(item.title).includes(searchable(value)),
              );
              if (first) setSelected(first.id);
            }}
          />
        </label>
        <label className="min-w-0 flex-1 basis-60 text-xs text-slate-400">
          Cena cinematográfica
          <select
            aria-label="Cena cinematográfica"
            className="studio-select"
            value={selected}
            disabled={filtered.length === 0}
            onChange={(e) => setSelected(e.target.value)}
          >
            {filtered.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="studio-button studio-button-primary self-end"
          disabled={filtered.length === 0}
          onPointerEnter={() => void preloadCinematicStage().catch(() => undefined)}
          onFocus={() => void preloadCinematicStage().catch(() => undefined)}
          onClick={() => open(selected)}
        >
          <Play size={16} />
          Ver cena
        </button>
      </div>
      <p className="studio-hint px-4 pt-3" role="status">
        {filtered.length === 0
          ? "Nenhuma cena encontrada. Experimente outra palavra."
          : query
            ? filtered.length + " cenas encontradas"
            : selectedScene?.title + " · " + selectedScene?.lines.length + " falas"}
      </p>
      <div className="cinema-library" aria-label="Ambientes do cinema">
        {examples.map(({ art, label, hint, icon: Icon }) => (
          <button
            type="button"
            key={art}
            className="cinema-card"
            onClick={() => {
              const example =
                art === "trophy"
                  ? CUTSCENES["trophy-lift"]
                  : art === "arrival"
                    ? CUTSCENES["bus-arrival"]
                    : scenes.find((item) => item.art === art);
              if (example) {
                setSelected(example.id);
                setQuery("");
                open(example.id);
              }
            }}
          >
            <Icon size={24} />
            <strong>{label}</strong>
            <span>{hint}</span>
          </button>
        ))}
      </div>
      <details className="cinema-config">
        <summary>Ajustes de exibição e encenação</summary>
        <div className="studio-fields">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoPlay}
              onChange={(e) => setAutoPlay(e.target.checked)}
            />
            Reprodução automática
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={narration}
              onChange={(e) => setNarration(e.target.checked)}
            />
            Ouvir diálogos
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={reduceMotion}
              onChange={(e) => setReduceMotion(e.target.checked)}
            />
            Reduzir movimento
          </label>
          <label>
            Qualidade
            <select
              aria-label="Qualidade do cinema"
              value={quality}
              onChange={(e) => setQuality(e.target.value as QualityLevel | "auto")}
              className="studio-select"
            >
              <option value="auto">Qualidade automática</option>
              <option value="alta">Mais detalhes</option>
              <option value="media">Equilibrada</option>
              <option value="baixa">Mais leve</option>
            </select>
          </label>
          <label>
            Momento da encenação
            <select
              aria-label="Momento da encenação"
              value={previewTime}
              onChange={(e) => setPreviewTime(Number(e.target.value))}
              className="studio-select"
            >
              <option value={0}>Início da encenação</option>
              <option value={8}>Olhares e pés · 8 s</option>
              <option value={13}>Posturas e braços · 13 s</option>
              <option value={17}>Levantar do banco · 17 s</option>
            </select>
          </label>
        </div>
      </details>
      {outcome && (
        <p role="status" className="studio-footer">
          {outcome}
        </p>
      )}
      {scene && (
        <Cutscene
          scene={scene}
          look={look}
          cinematic
          accent={club.primary}
          accent2={club.secondary}
          club={club}
          managerName="Treinador"
          renderQuality={quality}
          previewTime={previewTime}
          autoPlay={autoPlay}
          narrate={narration}
          reduceMotion={reduceMotion}
          onEffect={() => setOutcome("Resposta experimentada. A prévia não altera sua carreira.")}
          onDone={() => setScene(null)}
        />
      )}
    </section>
  );
}
