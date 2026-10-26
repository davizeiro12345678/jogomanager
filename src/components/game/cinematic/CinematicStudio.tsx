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
import { useT } from "@/i18n/provider";
import { sceneTitle } from "@/game/scene-localization";
import { createTransferDealScene, createSponsorDealScene } from "@/game/business-cutscenes";
import { CutsceneStage as Cutscene } from "./CutsceneStage";
import { preloadCinematicStage, useCinematicPreload } from "./cinematic-loading";
import "./studio.css";

const look: ManagerLook = { skin: 2, hair: 2, hairColor: "#30231d", beard: 1, outfit: 1 };
const examples = [
  { art: "dressing", icon: Shirt },
  { art: "press", icon: Mic2 },
  { art: "arrival", icon: BusFront },
  { art: "board", icon: Building2 },
  { art: "tunnel", icon: DoorOpen },
  { art: "trophy", icon: Trophy },
  { art: "training", icon: Activity },
  { art: "gym", icon: Dumbbell },
  { art: "medical", icon: HeartPulse },
] as const;
const searchable = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export default function CinematicStudio({ clubId = "fla" }: { clubId?: string }) {
  const { t, lang } = useT();
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
  const [startPaused, setStartPaused] = useState(false);
  const club = safeClub(clubId);
  const scenes = useMemo(() => {
    const en = !lang.startsWith("pt");
    const stages = ["negotiation", "signing", "presentation"] as const;
    const demos = stages
      .flatMap((stage) => [
        createTransferDealScene(
          {
            dealId: `studio-${club.id}`,
            clubName: club.name,
            playerName: en ? "Demo player" : "Jogador de demonstração",
            managerName: t("cinemaStudio.manager"),
            fromName: en ? "Demo club" : "Clube de demonstração",
            feeMillion: 8.5,
            wageThousandWeekly: 35,
            shirtNumber: 10,
          },
          stage,
          lang,
        ),
        createSponsorDealScene(
          {
            dealId: `studio-${club.id}`,
            clubName: club.name,
            sponsorName: en ? "Demo sponsor" : "Patrocinador de demonstração",
            managerName: t("cinemaStudio.manager"),
            incomeMillionWeekly: 0.25,
            currentRound: 1,
            endsRound: 20,
          },
          stage,
          lang,
        ),
      ])
      .map((item) => ({ ...item, title: `${en ? "Demo" : "Demonstração"} — ${item.title}` }));
    return [...Object.values(CUTSCENES), ...demos];
  }, [club.id, club.name, lang, t]);
  const filtered = useMemo(
    () =>
      scenes.filter((item) =>
        searchable(`${sceneTitle(item, lang, t)} ${item.title}`).includes(searchable(query)),
      ),
    [scenes, query, lang, t],
  );
  const selectedScene = scenes.find((item) => item.id === selected);
  const open = (id: string) => {
    setOutcome("");
    setScene(id);
  };
  return (
    <section className="studio-card" aria-label={t("cinemaStudio.previewLabel")}>
      <div className="cinema-intro">
        <div className="mr-auto">
          <p className="studio-kicker flex items-center gap-2">
            <Clapperboard size={16} />
            {t("cinemaStudio.title")}
          </p>
          <h2>
            {t("cinemaStudio.headlineStart")}
            <br />
            {t("cinemaStudio.headlineEnd")}
          </h2>
          <p className="studio-hint">{t("cinemaStudio.description")}</p>
        </div>
        <span className="studio-height">
          {t("cinemaStudio.sceneCount", { count: scenes.length })}
        </span>
      </div>
      <div className="studio-toolbar cinema-toolbar">
        <label className="min-w-0 flex-1 basis-48 text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <Search size={14} />
            {t("cinemaStudio.search")}
          </span>
          <input
            type="search"
            className="studio-input"
            aria-label={t("cinemaStudio.search")}
            placeholder={t("cinemaStudio.searchPlaceholder")}
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              setQuery(value);
              const first = scenes.find((item) =>
                searchable(`${sceneTitle(item, lang, t)} ${item.title}`).includes(
                  searchable(value),
                ),
              );
              if (first) setSelected(first.id);
            }}
          />
        </label>
        <label className="min-w-0 flex-1 basis-60 text-xs text-slate-400">
          {t("cinemaStudio.scene")}
          <select
            aria-label={t("cinemaStudio.scene")}
            className="studio-select"
            value={selected}
            disabled={filtered.length === 0}
            onChange={(e) => setSelected(e.target.value)}
          >
            {filtered.map((item) => (
              <option key={item.id} value={item.id}>
                {sceneTitle(item, lang, t)}
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
          {t("cinemaStudio.play")}
        </button>
      </div>
      <p className="studio-hint px-4 pt-3" role="status">
        {filtered.length === 0
          ? t("cinemaStudio.noResults")
          : query
            ? t("cinemaStudio.resultCount", { count: filtered.length })
            : t("cinemaStudio.selectedDetail", {
                title: selectedScene ? sceneTitle(selectedScene, lang, t) : "",
                count: selectedScene?.lines.length ?? 0,
              })}
      </p>
      <div className="cinema-library" aria-label={t("cinemaStudio.environments")}>
        {examples.map(({ art, icon: Icon }) => (
          <button
            type="button"
            key={art}
            className="cinema-card"
            aria-pressed={selectedScene?.art === art}
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
            <strong>{t(`cinemaStudio.environment.${art}.label`)}</strong>
            <span>{t(`cinemaStudio.environment.${art}.hint`)}</span>
          </button>
        ))}
      </div>
      <details className="cinema-config">
        <summary>{t("cinemaStudio.settings")}</summary>
        <div className="studio-fields">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoPlay}
              onChange={(e) => setAutoPlay(e.target.checked)}
            />
            {t("cinemaStudio.autoPlay")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={narration}
              onChange={(e) => setNarration(e.target.checked)}
            />
            {t("cinemaStudio.narration")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={reduceMotion}
              onChange={(e) => setReduceMotion(e.target.checked)}
            />
            {t("cinemaStudio.reduceMotion")}
          </label>
          <label>
            {t("cinemaStudio.quality")}
            <select
              aria-label={t("cinemaStudio.qualityLabel")}
              value={quality}
              onChange={(e) => setQuality(e.target.value as QualityLevel | "auto")}
              className="studio-select"
            >
              <option value="auto">{t("cinemaStudio.qualityAuto")}</option>
              <option value="alta">{t("cinemaStudio.qualityHigh")}</option>
              <option value="media">{t("cinemaStudio.qualityMedium")}</option>
              <option value="baixa">{t("cinemaStudio.qualityLow")}</option>
            </select>
          </label>
          <label>
            {t("cinemaStudio.moment")}
            <select
              aria-label={t("cinemaStudio.moment")}
              value={previewTime}
              onChange={(e) => setPreviewTime(Number(e.target.value))}
              className="studio-select"
            >
              <option value={0}>{t("cinemaStudio.momentStart")}</option>
              <option value={1.972}>{t("cinemaStudio.momentContact")}</option>
              <option value={8}>{t("cinemaStudio.momentGaze")}</option>
              <option value={13}>{t("cinemaStudio.momentPosture")}</option>
              <option value={17}>{t("cinemaStudio.momentRise")}</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={startPaused}
              onChange={(e) => setStartPaused(e.target.checked)}
            />
            {t("cinemaStudio.pauseOnOpen")}
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
          sceneData={scenes.find((item) => item.id === scene)}
          look={look}
          cinematic
          accent={club.primary}
          accent2={club.secondary}
          club={club}
          managerName={t("cinemaStudio.manager")}
          renderQuality={quality}
          previewTime={previewTime}
          startPaused={startPaused}
          autoPlay={autoPlay}
          narrate={narration}
          reduceMotion={reduceMotion}
          onEffect={() => setOutcome(t("cinemaStudio.choicePreview"))}
          onDone={() => setScene(null)}
        />
      )}
    </section>
  );
}
