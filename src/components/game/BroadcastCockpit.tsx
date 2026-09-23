import {
  Camera,
  ChevronDown,
  Clapperboard,
  Gauge,
  MonitorPlay,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  CAMERA_CATEGORIES,
  cameraOption,
  camerasForCategory,
  type CameraCategory,
  type CameraMode,
} from "@/game/camera-modes";
import {
  setBroadcastPreferences,
  setVisual,
  toggleBroadcastFavorite,
  useVisual,
  type QualityPref,
} from "@/game/visual-settings";

export type DeviceQuality = "baixa" | "media" | "alta";
export type BroadcastCockpitContext = "match" | "replay";

interface BroadcastCockpitProps {
  camera: CameraMode;
  deviceQuality: DeviceQuality;
  onCameraChange: (camera: CameraMode) => void;
  onQualityPreferenceChange?: (quality: QualityPref) => void;
  context?: BroadcastCockpitContext;
  className?: string;
}

const QUALITY_OPTIONS: ReadonlyArray<{ id: QualityPref; label: string; description: string }> = [
  { id: "auto", label: "Auto", description: "Ajusta a cena para manter a partida estável." },
  { id: "baixa", label: "Baixa", description: "Prioriza fluidez em aparelhos modestos." },
  { id: "media", label: "Média", description: "Equilíbrio para telas e GPU intermediárias." },
  { id: "alta", label: "Alta", description: "Mais materiais, sombras e detalhes visíveis." },
  { id: "cinema", label: "Cinema", description: "Pós e detalhes editoriais para hardware capaz." },
];

function qualityLabel(preference: QualityPref, deviceQuality: DeviceQuality) {
  if (preference === "auto") return `Auto · ${deviceQuality}`;
  return preference === "cinema" ? "Cinema" : preference;
}

/**
 * Controle compartilhado de transmissão. Em telas pequenas se comporta como
 * uma bottom sheet; em desktop fica como painel secundário junto do HUD.
 */
export function BroadcastCockpit({
  camera,
  deviceQuality,
  onCameraChange,
  onQualityPreferenceChange,
  context = "match",
  className = "",
}: BroadcastCockpitProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<CameraCategory>(() => cameraOption(camera).category);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openedByUserRef = useRef(false);
  const visual = useVisual();
  const broadcast = visual.broadcast;
  const activeOption = cameraOption(camera);
  const isReplay = context === "replay";
  const currentReplayCamera =
    broadcast.replayCamera === "inherit" ? broadcast.camera : broadcast.replayCamera;

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  // The director and match shortcuts can change the active lens outside this
  // popover. Keep its selected tab aligned so reopening the cockpit always
  // describes the camera that is actually on screen.
  useEffect(() => {
    setCategory(cameraOption(camera).category);
  }, [camera]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    if (open) {
      const frameId = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
      cleanup = () => window.cancelAnimationFrame(frameId);
    } else if (openedByUserRef.current) {
      triggerRef.current?.focus();
      openedByUserRef.current = false;
    }
    return cleanup;
  }, [open]);

  function toggleOpen() {
    setOpen((value) => {
      const next = !value;
      if (next) openedByUserRef.current = true;
      return next;
    });
  }

  function focusCategory(index: number) {
    const nextIndex = (index + CAMERA_CATEGORIES.length) % CAMERA_CATEGORIES.length;
    const next = CAMERA_CATEGORIES[nextIndex];
    if (!next) return;
    setCategory(next.id);
    window.requestAnimationFrame(() =>
      document.getElementById(panelId + "-" + next.id + "-tab")?.focus(),
    );
  }

  function handleCategoryKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusCategory(index - 1);
        break;
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusCategory(index + 1);
        break;
      case "Home":
        event.preventDefault();
        focusCategory(0);
        break;
      case "End":
        event.preventDefault();
        focusCategory(CAMERA_CATEGORIES.length - 1);
        break;
    }
  }

  function selectCamera(next: CameraMode) {
    setCategory(cameraOption(next).category);
    if (isReplay) {
      setBroadcastPreferences({ replayCamera: next, directorAuto: next === "director" });
    } else {
      setBroadcastPreferences({ camera: next, directorAuto: next === "director" });
    }
    onCameraChange(next);
  }

  function toggleDirector() {
    const enabled = !broadcast.directorAuto;
    const fallback = camera === "director" ? "broadcast" : camera;
    const next = enabled ? "director" : fallback;
    if (isReplay) {
      setBroadcastPreferences({ directorAuto: enabled, replayCamera: next });
    } else {
      setBroadcastPreferences({ directorAuto: enabled, camera: next });
    }
    setCategory(cameraOption(next).category);
    onCameraChange(next);
  }

  function setQualityPreference(next: QualityPref) {
    setVisual({ quality: next });
    onQualityPreferenceChange?.(next);
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        aria-label={`Abrir cabine de transmissão; câmera atual: ${activeOption.label}`}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex min-h-11 items-center gap-2 rounded-full border px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
          open
            ? "border-primary/70 bg-primary/20 text-white"
            : "border-white/10 bg-white/5 text-white/85 hover:bg-white/15"
        }`}
      >
        {broadcast.directorAuto ? (
          <Clapperboard size={15} className="text-primary" />
        ) : (
          <Camera size={15} />
        )}
        <span className="font-display text-[11px] uppercase tracking-wide">
          {activeOption.shortLabel}
        </span>
        <ChevronDown
          size={14}
          className={
            open
              ? "rotate-180 transition-transform motion-reduce:transition-none"
              : "transition-transform motion-reduce:transition-none"
          }
        />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <section
              id={panelId}
              role="dialog"
              aria-labelledby={panelId + "-title"}
              aria-describedby={panelId + "-description"}
              className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[70] max-h-[min(42rem,calc(100dvh-6rem))] overflow-y-auto rounded-2xl border border-primary/25 bg-[#07100d]/[.98] p-3 shadow-2xl shadow-black/60 backdrop-blur-2xl md:inset-x-auto md:bottom-4 md:right-3 md:w-[23rem] md:max-h-[min(42rem,calc(100dvh-3rem))]"
            >
              <div
                className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/25 md:hidden"
                aria-hidden="true"
              />
              <header className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                  <MonitorPlay size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2
                    id={panelId + "-title"}
                    className="font-display text-sm uppercase tracking-[0.15em] text-white"
                  >
                    Cabine de transmissão
                  </h2>
                  <p id={panelId + "-description"} className="mt-0.5 text-xs text-white/60">
                    {isReplay
                      ? `Replay usa ${cameraOption(currentReplayCamera).label.toLowerCase()} por padrão.`
                      : "Escolha a leitura do jogo sem perder o lance."}
                  </p>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid h-11 w-11 place-items-center rounded-full text-white/60 transition-colors motion-reduce:transition-none hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Fechar cabine de transmissão"
                >
                  <X size={17} />
                </button>
              </header>

              <div className="mt-3 rounded-xl border border-primary/20 bg-primary/[.08] p-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1.5 font-display text-[10px] uppercase tracking-[0.18em] text-primary">
                      <Clapperboard size={12} /> Diretor automático
                    </p>
                    <p className="mt-1 text-xs text-white/65">
                      {broadcast.directorAuto
                        ? "Planos cinematográficos com retenção de cena ativa."
                        : "A lente atual fica fixa até você trocar."}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={broadcast.directorAuto}
                    onClick={toggleDirector}
                    className={`relative h-11 w-14 shrink-0 rounded-full transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      broadcast.directorAuto ? "bg-primary" : "bg-white/15"
                    }`}
                  >
                    <span
                      className={`absolute left-1.5 top-1.5 h-8 w-8 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
                        broadcast.directorAuto ? "translate-x-[1.125rem]" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-[10px] uppercase tracking-[0.2em] text-white/50">
                    Câmeras
                  </p>
                  <span className="text-[10px] text-white/45">
                    {isReplay
                      ? "Preferência do replay"
                      : "Favoritos ficam disponíveis em qualquer partida"}
                  </span>
                </div>
                <div
                  className="mt-2 grid grid-cols-4 gap-1"
                  role="tablist"
                  aria-label="Categorias de câmera"
                  aria-orientation="horizontal"
                >
                  {CAMERA_CATEGORIES.map((item, index) => {
                    const selected = category === item.id;
                    const tabId = panelId + "-" + item.id + "-tab";
                    const tabPanelId = panelId + "-" + item.id + "-panel";
                    return (
                      <button
                        key={item.id}
                        id={tabId}
                        type="button"
                        role="tab"
                        tabIndex={selected ? 0 : -1}
                        aria-selected={selected}
                        aria-controls={tabPanelId}
                        onClick={() => setCategory(item.id)}
                        onKeyDown={(event) => handleCategoryKeyDown(event, index)}
                        className={[
                          "min-h-11 rounded-lg px-1 text-[10px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          selected
                            ? "bg-white/20 text-white"
                            : "bg-white/[.06] text-white/60 hover:bg-white/10",
                        ].join(" ")}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {CAMERA_CATEGORIES.map((item) => {
                  const selected = category === item.id;
                  const tabId = panelId + "-" + item.id + "-tab";
                  const tabPanelId = panelId + "-" + item.id + "-panel";
                  return (
                    <div
                      key={item.id}
                      id={tabPanelId}
                      role="tabpanel"
                      aria-labelledby={tabId}
                      hidden={!selected}
                    >
                      <p className="mt-1.5 text-[11px] text-white/50">{item.description}</p>
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        {camerasForCategory(item.id).map((option) => {
                          const active = option.id === camera;
                          const favorite = broadcast.favorites.includes(option.id);
                          return (
                            <div
                              key={option.id}
                              className={[
                                "group relative min-h-[4.5rem] rounded-xl border p-2 text-left transition-colors motion-reduce:transition-none",
                                active
                                  ? "border-primary/60 bg-primary/15"
                                  : "border-white/10 bg-white/[.045] hover:bg-white/[.09]",
                              ].join(" ")}
                            >
                              <button
                                type="button"
                                onClick={() => selectCamera(option.id)}
                                className="block min-h-11 w-full rounded-lg pr-10 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#07100d]"
                                aria-pressed={active}
                                title={option.description}
                              >
                                <span className="flex items-center gap-1.5 font-display text-xs uppercase tracking-wide text-white">
                                  {option.cinematicTreatment ? (
                                    <Sparkles size={12} className="text-primary" />
                                  ) : (
                                    <Camera size={12} />
                                  )}
                                  {option.label}
                                </span>
                                <span className="mt-1 block text-[10px] leading-snug text-white/55">
                                  {option.description}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleBroadcastFavorite(option.id)}
                                aria-label={
                                  favorite
                                    ? "Remover " + option.label + " dos favoritos"
                                    : "Favoritar " + option.label
                                }
                                aria-pressed={favorite}
                                className={[
                                  "absolute right-1.5 top-1.5 grid h-11 w-11 place-items-center rounded-full transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                  favorite
                                    ? "bg-primary/20 text-primary"
                                    : "text-white/35 hover:bg-white/10 hover:text-white/70",
                                ].join(" ")}
                              >
                                <Star size={12} fill={favorite ? "currentColor" : "none"} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 border-t border-white/10 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 font-display text-[10px] uppercase tracking-[0.2em] text-white/50">
                    <Gauge size={12} /> Qualidade
                  </p>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] capitalize text-white/75">
                    {qualityLabel(visual.quality, deviceQuality)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-white/50">
                  Perfil atual:{" "}
                  <span className="capitalize text-white/80">
                    {qualityLabel(visual.quality, deviceQuality)}
                  </span>
                  . Auto protege o frame time antes de reduzir a leitura do jogo.
                </p>
                <div className="mt-2 grid grid-cols-5 gap-1">
                  {QUALITY_OPTIONS.map((option) => {
                    const active = option.id === visual.quality;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setQualityPreference(option.id)}
                        title={option.description}
                        aria-pressed={active}
                        className={`min-h-11 rounded-lg px-1 text-[10px] transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-white/[.07] text-white/65 hover:bg-white/15"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {broadcast.favorites.length > 0 ? (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <p className="font-display text-[10px] uppercase tracking-[0.2em] text-white/50">
                    Favoritos
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {broadcast.favorites.map((favorite) => {
                      const option = cameraOption(favorite);
                      return (
                        <button
                          key={favorite}
                          type="button"
                          onClick={() => selectCamera(favorite)}
                          className={`min-h-11 rounded-full border px-2.5 py-1.5 text-[11px] transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            favorite === camera
                              ? "border-primary/60 bg-primary/15 text-primary"
                              : "border-white/10 bg-white/[.04] text-white/70 hover:bg-white/10"
                          }`}
                        >
                          {option.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>,
            document.body,
          )
        : null}
    </div>
  );
}
