/**
 * Cutscene presentation: a clear 3D stage with compact dialogue and choices.
 * The illustrated scene is a separate fallback, never a layer over WebGL.
 */
import type React from "react";
import "./cinematic.css";
import {
  lazy,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Volume2,
  VolumeX,
  Pause,
  Play,
  ChevronRight,
  Eye,
  EyeOff,
  SlidersHorizontal,
} from "lucide-react";
import { createPortal } from "react-dom";

/** enquadramentos alternados: cada fala reposiciona levemente a câmera */
import {
  CUTSCENES,
  SPEAKER_LABEL,
  type ChoiceEffect,
  type Cutscene as SceneData,
  type CutsceneLine,
} from "@/content/cutscenes";
import { speakerName, type Cast } from "@/game/cast";
import { SHOTS } from "@/game/cutscene-timeline";
import { directScene } from "@/game/cutscene-director";
import { cinematicCueFor } from "@/game/cinematic-cue";
import { CinematicSound } from "@/game/cinematic-sound";
import { beginCinematicOverlay } from "@/game/cinematic-overlay";
import {
  cutsceneBranch,
  type CutsceneChoiceContext,
  type CutsceneChoiceReaction,
} from "@/game/cutscene-choice";
import { prefersReducedMotion, watchReducedMotion } from "@/game/device";
import type { Club, ManagerLook } from "@/game/types";
import type { QualityLevel } from "@/game/device";
import type { CinematicManner } from "@/game/cinematic-actor";
import { LazyCinematicStage, preloadCinematicStage } from "./cinematic-loading";
import { CutsceneLoadFallback } from "./CutsceneLoadFallback";
import { GraphicsBoundary } from "../GraphicsBoundary";
import { Button } from "@/components/ui/button";
import { audioBlobUrl } from "@/game/audio-cache";
import {
  sceneVoice,
  voiceWithin,
  SCENE_VOICE_WAIT_MS,
  type SceneVoiceLoader,
} from "@/game/cutscene-voice";
import { cutsceneVoiceFor } from "@/game/cutscene-voice-manifest";
import {
  RESTING_VOICE_CLOCK,
  voiceClockFromContext,
  type TimedViseme,
} from "@/game/cutscene-visemes";

type VoiceLoader = SceneVoiceLoader;

interface Props {
  scene: keyof typeof CUTSCENES | string;
  look: ManagerLook;
  accent?: string;
  accent2?: string;
  /** número de troféus já conquistados (usado na sala de troféus) */
  trophies?: number;
  /** clube da campanha: escudo e nome reais aparecem na cena */
  club?: Club | undefined;
  /** nome do treinador, usado no lugar de "Você" */
  managerName?: string | undefined;
  /** nome do capitão, usado no lugar de "Capitão" */
  captainName?: string | undefined;
  /** Liga voz à sequência quando ela faz parte de uma partida. */
  narrate?: boolean;
  /** Encena no palco 3D; false abre diretamente a alternativa ilustrada. */
  cinematic?: boolean;
  /** elenco da carreira: quem fala aparece com nome e rosto */
  cast?: Cast | undefined;
  /** Consequência authored e reação relacional opcional; o chamador aplica na carreira. */
  onEffect?: ((effect: ChoiceEffect, reaction?: CutsceneChoiceReaction) => void) | undefined;
  onDone: () => void;
  /** The host supplies its own voice transport and official crest. */
  loadVoice?: VoiceLoader | undefined;
  brand?: React.ReactNode;
  /** Sequence controls belong to the modal so they remain reachable and focused. */
  sequenceActions?: React.ReactNode;
  renderQuality?: QualityLevel | "auto";
  sceneData?: SceneData | undefined;
  manner?: CinematicManner | undefined;
  /** Optional live relationship data used only to direct branch reactions. */
  choiceContext?: CutsceneChoiceContext | undefined;
  /** Initial actor time for the studio's pose inspection. */
  previewTime?: number | undefined;
  autoPlay?: boolean;
  reduceMotion?: boolean;
  startPaused?: boolean;
}

// Load the SVG scene in a separate chunk. The 3D canvas and its controls do
// not need to parse the many SVG illustrations at startup.
const Backdrop = lazy(() =>
  import("./CutsceneBackdrop").then(({ Backdrop }) => ({ default: Backdrop })),
);

/* ------------------------------------------------------------- runtime */

export function CutsceneStage({
  scene,
  look,
  accent: accentProp,
  accent2: accent2Prop,
  trophies = 0,
  club,
  managerName,
  captainName,
  narrate = false,
  cinematic = true,
  cast,
  onEffect,
  onDone,
  loadVoice,
  brand,
  sequenceActions,
  renderQuality = "auto",
  sceneData,
  manner,
  choiceContext,
  previewTime,
  autoPlay = false,
  reduceMotion = false,
  startPaused = false,
}: Props) {
  // uniforme real do clube tinge o cenário quando nenhuma cor é forçada
  const accent = accentProp ?? club?.primary ?? "#0a8f3c";
  const accent2 = accent2Prop ?? club?.secondary ?? "#0b1220";
  const data: SceneData | undefined = sceneData ?? CUTSCENES[scene];

  const [i, setI] = useState(0);
  // roteiro vivo: a resposta da escolha é enxertada aqui e a cena continua
  const [lines, setLines] = useState<CutsceneLine[]>(data?.lines ?? []);
  const [chosen, setChosen] = useState<number | null>(null);
  const [branchReaction, setBranchReaction] = useState<CutsceneChoiceReaction | undefined>();
  const [branchLines, setBranchLines] = useState<readonly CutsceneLine[]>([]);
  const chosenRef = useRef<number | null>(null);
  const [mode, setMode] = useState<"3d" | "2d">(cinematic ? "3d" : "2d");
  const [paused, setPaused] = useState(startPaused);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  useEffect(() => setPortalHost(document.body), []);
  const [hidden, setHidden] = useState(false);
  const [stageReady, setStageReady] = useState(false);
  const [mountStage, setMountStage] = useState(false);
  const [stageLoadError, setStageLoadError] = useState<unknown>(null);
  const [stageAttempt, setStageAttempt] = useState(0);
  const sceneStartedAt = useRef(0);
  const onStageReady = useCallback(() => {
    if (dialogRef.current) {
      dialogRef.current.dataset["sceneLoadMs"] = (
        performance.now() - sceneStartedAt.current
      ).toFixed(1);
      dialogRef.current.dataset["sceneInteractiveMs"] = (
        performance.now() - sceneStartedAt.current
      ).toFixed(1);
    }
    setStageReady(true);
  }, []);
  const onStageVisible = useCallback(() => {
    if (dialogRef.current && !dialogRef.current.dataset["sceneVisibleMs"])
      dialogRef.current.dataset["sceneVisibleMs"] = (
        performance.now() - sceneStartedAt.current
      ).toFixed(1);
  }, []);
  const onUnavailable = useCallback(() => {
    setStageLoadError(null);
    setMode("2d");
  }, []);
  const retryStage = useCallback(() => {
    setStageLoadError(null);
    setStageReady(false);
    setMountStage(false);
    setStageAttempt((attempt) => attempt + 1);
  }, []);
  useEffect(() => {
    const changed = () => setHidden(document.hidden);
    changed();
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  useEffect(() => {
    sceneStartedAt.current = performance.now();
    setStageReady(false);
    setMountStage(false);
    setStageLoadError(null);
    if (dialogRef.current) {
      delete dialogRef.current.dataset["sceneVisibleMs"];
      delete dialogRef.current.dataset["sceneInteractiveMs"];
      delete dialogRef.current.dataset["sceneLoadMs"];
      delete dialogRef.current.dataset["sceneBackdropVisibleMs"];
    }
    if (mode !== "3d") return;
    const visibleFrame = requestAnimationFrame(() => {
      if (dialogRef.current)
        dialogRef.current.dataset["sceneBackdropVisibleMs"] = (
          performance.now() - sceneStartedAt.current
        ).toFixed(1);
    });
    let alive = true;
    void preloadCinematicStage().catch((error: unknown) => {
      if (alive) setStageLoadError(error);
    });
    // Commit the lightweight controls before constructing the actor meshes.
    const frame = requestAnimationFrame(() => startTransition(() => setMountStage(true)));
    return () => {
      alive = false;
      cancelAnimationFrame(visibleFrame);
      cancelAnimationFrame(frame);
    };
  }, [mode, data, stageAttempt]);
  const [captions, setCaptions] = useState(true);
  const [automatic, setAutomatic] = useState(autoPlay);
  const [ambientEnabled, setAmbientEnabled] = useState(false);
  const ambientRef = useRef<CinematicSound | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setLines(data?.lines ?? []);
    setI(0);
    setChosen(null);
    setBranchReaction(undefined);
    setBranchLines([]);
    chosenRef.current = null;
  }, [data]);
  // Direção da cena: cada fala ganha tamanho de plano, luz e tensão. O palco
  // 3D lê a fala atual para ajustar tremor de mão, aperto de lente e cor.
  const direction = useMemo(() => (data ? directScene({ ...data, lines }) : null), [data, lines]);
  const lineMood = useMemo(() => {
    const fallback = data?.mood ?? "neutral";
    const light = direction?.lines[i]?.light;
    if (light === "festa" || light === "quente") return "good" as const;
    if (light === "dramatica" || light === "fria") return "bad" as const;
    return fallback;
  }, [direction, data, i]);
  const lineTension = direction?.lines[i]?.emotion.tension ?? 0;
  const [typed, setTyped] = useState(0);
  const [systemReduced, setSystemReduced] = useState(() => prefersReducedMotion());
  const reduced = reduceMotion || systemReduced;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const stageRef = useRef<HTMLDivElement>(null);
  const illustrationRef = useRef<HTMLDivElement>(null);
  const par = useRef({ x: 0, y: 0 });
  const dollyTime = useRef(0);
  const pausedRef = useRef(paused || hidden);
  pausedRef.current = paused || hidden;
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const voiceUrlRef = useRef<string | null>(null);
  const voiceContextRef = useRef<AudioContext | null>(null);
  const voiceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const voiceClockRef = useRef<ReturnType<typeof voiceClockFromContext> | null>(null);
  const voicePlayingRef = useRef(false);
  const voiceVisemesRef = useRef<readonly TimedViseme[]>([]);
  const voiceFallbackTimerRef = useRef<number | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(narrate);
  const [voiceState, setVoiceState] = useState<"idle" | "loading" | "playing" | "fallback">("idle");

  useEffect(() => watchReducedMotion(setSystemReduced), []);

  const clearVoiceFallbackTimer = useCallback(() => {
    if (voiceFallbackTimerRef.current !== null) {
      window.clearTimeout(voiceFallbackTimerRef.current);
      voiceFallbackTimerRef.current = null;
    }
  }, []);

  const stopVoice = useCallback(() => {
    clearVoiceFallbackTimer();
    voicePlayingRef.current = false;
    voiceRef.current?.pause();
    voiceRef.current = null;
    voiceNodeRef.current?.disconnect();
    voiceNodeRef.current = null;
    voiceClockRef.current = null;
    voiceVisemesRef.current = [];
    if (voiceUrlRef.current) URL.revokeObjectURL(voiceUrlRef.current);
    voiceUrlRef.current = null;
    window.speechSynthesis?.cancel();
  }, [clearVoiceFallbackTimer]);

  const startVoiceAudio = useCallback(
    async (audio: HTMLAudioElement, visemes: readonly TimedViseme[]) => {
      let context = voiceContextRef.current;
      if (visemes.length) {
        try {
          if (typeof window !== "undefined" && window.AudioContext) {
            context ??= new window.AudioContext();
            voiceContextRef.current = context;
            if (context.state === "suspended") await context.resume();
            if (!voiceNodeRef.current) {
              voiceNodeRef.current = context.createMediaElementSource(audio);
              voiceNodeRef.current.connect(context.destination);
            }
          }
        } catch {
          context = null;
        }
      }
      await audio.play();
      if (context && visemes.length) {
        voiceClockRef.current = voiceClockFromContext(
          context,
          context.currentTime,
          audio.currentTime * 1000,
          visemes,
        );
      } else {
        voiceClockRef.current = null;
      }
    },
    [],
  );

  useEffect(
    () => () => {
      stopVoice();
      const context = voiceContextRef.current;
      voiceContextRef.current = null;
      if (context && context.state !== "closed") void context.close();
    },
    [stopVoice],
  );

  useEffect(() => {
    dollyTime.current = 0;
  }, [i, mode]);
  useEffect(() => {
    if (reduced || mode === "3d" || paused || hidden) return;
    let raf = 0;
    let previous = performance.now();
    const shot = SHOTS[i % SHOTS.length]!;
    const tick = (t: number) => {
      dollyTime.current += Math.min(80, Math.max(0, t - previous));
      previous = t;
      const u = Math.min(1, dollyTime.current / 9000);
      const dolly = u * u * (3 - 2 * u);
      if (illustrationRef.current)
        illustrationRef.current.style.transform = `scale(1.06) translate3d(${par.current.x * -8 + (shot.x + shot.dx * dolly) * 0.3}px,${par.current.y * -5}px,0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [i, reduced, mode, paused, hidden]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (reduced || pausedRef.current) return;
      const el = stageRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      par.current = {
        x: (e.clientX - r.left) / r.width - 0.5,
        y: (e.clientY - r.top) / r.height - 0.5,
      };
    },
    [reduced],
  );

  const line = lines[i];
  const previousLine = i > 0 ? lines[i - 1] : undefined;
  const branchReactionForLine =
    line && branchReaction && branchLines.includes(line) ? branchReaction : undefined;
  const full = line?.text ?? "";
  const cue = useMemo(
    () =>
      line && direction?.lines[i] && data
        ? cinematicCueFor(`${data.id}:${line.id ?? i}`, line, direction.lines[i]!, lineMood, {
            previousLine,
            choiceReaction: branchReactionForLine,
          })
        : undefined,
    [line, direction, i, data, lineMood, previousLine, branchReactionForLine],
  );

  useEffect(() => () => ambientRef.current?.dispose(), []);
  useEffect(() => {
    ambientRef.current?.setPaused(paused || hidden);
  }, [paused, hidden]);
  useEffect(() => {
    if (ambientEnabled) ambientRef.current?.accent(lineTension, lineMood === "good");
  }, [i, ambientEnabled, lineTension, lineMood]);
  const toggleAmbience = useCallback(() => {
    if (!data) return;
    if (ambientEnabled) {
      ambientRef.current?.dispose();
      ambientRef.current = null;
      setAmbientEnabled(false);
    } else {
      const sound = CinematicSound.create(data.art);
      if (sound) {
        ambientRef.current = sound;
        sound.setPaused(paused || hidden);
        setAmbientEnabled(true);
      }
    }
  }, [ambientEnabled, data, paused, hidden]);

  useEffect(() => {
    if (!narrate || !voiceEnabled || !data || !line || (mode === "3d" && !stageReady)) {
      stopVoice();
      setVoiceState("idle");
      return;
    }
    let alive = true;
    let fallbackStarted = false;
    let audio: HTMLAudioElement | null = null;
    stopVoice();
    setVoiceState("loading");
    const fallback = () => {
      if (!alive || fallbackStarted) return;
      fallbackStarted = true;
      clearVoiceFallbackTimer();
      voicePlayingRef.current = false;
      voiceClockRef.current = null;
      voiceVisemesRef.current = [];
      audio?.pause();
      if (audio) {
        audio.onplaying = null;
        audio.onended = null;
        audio.onerror = null;
      }
      voiceNodeRef.current?.disconnect();
      voiceNodeRef.current = null;
      voiceRef.current = null;
      if (!("speechSynthesis" in window)) {
        setVoiceState("idle");
        return;
      }
      setVoiceState("playing");
      voicePlayingRef.current = true;
      const utterance = new SpeechSynthesisUtterance(line.text);
      utterance.onstart = () => {
        if (!alive) return;
        voicePlayingRef.current = true;
        setVoiceState("playing");
      };
      utterance.onend = () => {
        if (!alive) return;
        voicePlayingRef.current = false;
        setVoiceState("idle");
      };
      utterance.onerror = () => {
        if (!alive) return;
        voicePlayingRef.current = false;
        setVoiceState("idle");
      };
      const lang = document.documentElement.lang || navigator.language || "pt-BR";
      utterance.lang = lang;
      utterance.rate = line.who === "referee" ? 0.9 : line.who === "commentator" ? 1.08 : 0.96;
      utterance.pitch =
        line.who === "referee"
          ? 0.88
          : line.who === "commentator"
            ? 1.08
            : data.mood === "good"
              ? 1.04
              : data.mood === "bad"
                ? 0.94
                : 1;
      window.speechSynthesis.speak(utterance);
      if (pausedRef.current) window.speechSynthesis.pause();
    };
    const beginAudio = (src: string, visemes: readonly TimedViseme[]) => {
      if (!alive || fallbackStarted) return;
      audio = new Audio(src);
      audio.preload = "auto";
      voiceRef.current = audio;
      voiceVisemesRef.current = visemes;
      audio.onplaying = () => {
        if (!alive || fallbackStarted) return;
        clearVoiceFallbackTimer();
        voicePlayingRef.current = true;
        setVoiceState("playing");
      };
      audio.onended = () => {
        if (!alive || fallbackStarted) return;
        clearVoiceFallbackTimer();
        voicePlayingRef.current = false;
        voiceClockRef.current = visemes.length ? RESTING_VOICE_CLOCK : null;
        setVoiceState("idle");
      };
      audio.onerror = fallback;
      voiceFallbackTimerRef.current = window.setTimeout(fallback, SCENE_VOICE_WAIT_MS);
      if (!pausedRef.current) void startVoiceAudio(audio, visemes).catch(fallback);
      else setVoiceState("idle");
    };

    const localClip = cutsceneVoiceFor(data.id, line.id);
    if (localClip) {
      beginAudio(localClip.src, localClip.visemes);
    } else {
      const authoredIndex = data.lines.indexOf(line);
      // The optional host loader remains compatible with its scene/index API.
      // Local licensed files use stable line IDs and also cover branch replies.
      void voiceWithin(
        authoredIndex < 0
          ? Promise.resolve(null)
          : sceneVoice(loadVoice, data.id, authoredIndex, line.id),
      )
        .then((audioData) => {
          if (!alive || !audioData) {
            fallback();
            return;
          }
          const url = audioBlobUrl(audioData);
          voiceUrlRef.current = url;
          beginAudio(url, []);
        })
        .catch(fallback);
    }

    const authoredIndex = data.lines.indexOf(line);
    const nextLine = lines[i + 1];
    const nextAuthored = nextLine ? data.lines.indexOf(nextLine) : -1;
    if (nextAuthored >= 0 && nextLine) {
      void sceneVoice(loadVoice, data.id, nextAuthored, nextLine.id).catch(() => undefined);
    }
    return () => {
      alive = false;
      clearVoiceFallbackTimer();
      stopVoice();
    };
  }, [
    data,
    i,
    line,
    narrate,
    stopVoice,
    voiceEnabled,
    lines,
    loadVoice,
    mode,
    stageReady,
    clearVoiceFallbackTimer,
    startVoiceAudio,
  ]);

  // The dialogue begins with the visible scene, in small batches of characters.
  useEffect(() => {
    if (reduced || !full) {
      setTyped(full.length);
      return;
    }
    setTyped(0);
    if (mode === "3d" && !stageReady) return;
    let elapsed = 0;
    let previous = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      if (!pausedRef.current) elapsed += Math.min(100, now - previous);
      previous = now;
      const length = Math.min(full.length, Math.floor(elapsed / 24));
      setTyped((value) => Math.max(value, length));
      if (length >= full.length) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [full, i, reduced, mode, stageReady]);

  useEffect(() => {
    if (!data) doneRef.current();
  }, [data]);

  const next = useCallback(() => {
    if (!data) return;
    if (typed < full.length) {
      setTyped(full.length);
      return;
    }
    // escolha pendente: a cena só anda quando o jogador decide
    if (line?.choices && chosenRef.current === null) return;
    if (i + 1 >= lines.length) doneRef.current();
    else {
      setChosen(null);
      chosenRef.current = null;
      setI(i + 1);
    }
  }, [data, full.length, i, lines.length, typed, line]);

  /** Escolhe uma opção: enxerta a resposta no roteiro e dispara o efeito. */
  const choose = useCallback(
    (index: number) => {
      const responseLines = lines[i]?.choices?.[index]?.response ?? [];
      const branch = cutsceneBranch(lines, i, index, choiceContext);
      if (!branch || chosenRef.current !== null) return;
      chosenRef.current = index;
      setChosen(index);
      setLines(branch.lines);
      setBranchReaction(branch.reaction);
      setBranchLines(responseLines);
      setCaptions(true);
      if (branch.effect) onEffectRef.current?.(branch.effect, branch.reaction);
    },
    [lines, i, choiceContext],
  );
  const onEffectRef = useRef(onEffect);
  onEffectRef.current = onEffect;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Tab") {
        const buttons = dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), select, a[href]",
        );
        const first = buttons?.[0],
          last = buttons?.[buttons.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === dialogRef.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
        return;
      }
      if (
        e.key !== "Escape" &&
        e.target instanceof HTMLElement &&
        e.target.closest("button, input, select, textarea, a")
      )
        return;
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "Escape") {
        doneRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next]);

  useEffect(() => {
    if (!portalHost) return;
    const releaseOverlay = beginCinematicOverlay();
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      releaseOverlay();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [portalHost]);
  useEffect(() => {
    if (!narrate || !voiceEnabled) return;
    if (paused || hidden) {
      voiceClockRef.current = voiceVisemesRef.current.length ? RESTING_VOICE_CLOCK : null;
      voiceRef.current?.pause();
      window.speechSynthesis?.pause();
    } else {
      const audio = voiceRef.current;
      if (audio?.paused)
        void startVoiceAudio(audio, voiceVisemesRef.current).catch(() => {
          voiceClockRef.current = null;
        });
      window.speechSynthesis?.resume();
    }
  }, [paused, hidden, narrate, voiceEnabled, startVoiceAudio]);
  useEffect(() => {
    if (
      !automatic ||
      (mode === "3d" && !stageReady) ||
      paused ||
      hidden ||
      typed < full.length ||
      (line?.choices && chosen === null) ||
      voiceState === "playing" ||
      voiceState === "loading"
    )
      return;
    const timer = setTimeout(
      next,
      Math.max(1200, full.length * 28) + (direction?.lines[i]?.pause ?? 0.45) * 1000,
    );
    return () => clearTimeout(timer);
  }, [
    automatic,
    paused,
    hidden,
    typed,
    full,
    line,
    chosen,
    voiceState,
    next,
    direction,
    i,
    mode,
    stageReady,
  ]);

  if (!data || !line || !portalHost) return null;
  // elenco que fala: nome e rosto do locutor atual vêm do elenco da carreira
  const speaker = speakerName(cast, SPEAKER_LABEL, line.who, {
    ...(managerName ? { manager: managerName } : {}),
    ...(captainName ? { captain: captainName } : {}),
  });
  const pendingChoice = Boolean(line.choices && chosen === null);
  // Page transitions create a transformed containing block. Mount outside it so fixed scene
  // controls and the WebGL camera always use the viewport, even after scroll.
  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cutscene-title"
      tabIndex={-1}
      className="cutscene-screen"
      data-scene-mode={mode}
      data-scene-paused={paused || hidden}
      data-scene-reduced={reduced}
      data-scene-loading={mode === "3d" && !stageReady}
      data-scene-art={data.art}
      data-scene-mood={lineMood}
      data-scene-beat={i}
    >
      <div
        ref={stageRef}
        className="cutscene-world"
        onPointerMove={mode === "2d" ? onPointerMove : undefined}
      >
        {mode === "2d" || !stageReady ? (
          <div ref={illustrationRef} className="absolute inset-0" aria-hidden="true">
            <Suspense
              fallback={
                <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-950" />
              }
            >
              <Backdrop
                art={data.art}
                a={accent}
                b={accent2}
                reduced={reduced || mode === "3d"}
                trophies={trophies}
              />
            </Suspense>
          </div>
        ) : null}
        {mode === "3d" && stageLoadError ? (
          <CutsceneLoadFallback onIllustrated={onUnavailable} onRetry={retryStage} />
        ) : null}
        {mode === "3d" && !stageLoadError && mountStage ? (
          <GraphicsBoundary
            fallback={
              <button type="button" onClick={onUnavailable} className="cutscene-loading z-10">
                A cena 3D não carregou. Abrir cena ilustrada.
              </button>
            }
          >
            <Suspense
              fallback={
                <p role="status" className="cutscene-loading">
                  Preparando cena 3D…
                </p>
              }
            >
              <LazyCinematicStage
                key={`${data.id}:${stageAttempt}`}
                art={data.art}
                business={data.business}
                primary={accent}
                secondary={accent2}
                beat={i}
                mood={lineMood}
                intensity={lineTension}
                speaker={line.who}
                size={direction?.lines[i]?.size ?? "medio"}
                dollyFrom={direction?.lines[i]?.dollyFrom ?? 0}
                dollyTo={direction?.lines[i]?.dollyTo ?? 0}
                climax={direction?.lines[i]?.beat ?? false}
                light={direction?.lines[i]?.light ?? "neutra"}
                paused={paused}
                reduced={reduced}
                look={look}
                cast={cast}
                onUnavailable={onUnavailable}
                onVisible={onStageVisible}
                onReady={onStageReady}
                qualityMode={renderQuality}
                manner={manner}
                previewTime={previewTime}
                cue={cue}
                voiceClockRef={voiceClockRef}
                voicePlayingRef={voicePlayingRef}
              />
            </Suspense>
          </GraphicsBoundary>
        ) : null}
        {mode === "3d" && !stageReady && !stageLoadError ? (
          <p role="status" className="cutscene-loading">
            Preparando cena 3D…
          </p>
        ) : null}
      </div>
      <div className="cutscene-matte" aria-hidden="true" />
      {stageReady && i === 0 && (
        <div className="cutscene-slate" aria-hidden="true">
          <span>{club?.short ?? "Futebol. Bastidores. História."}</span>
          <strong>{data.title}</strong>
        </div>
      )}
      <header className="cutscene-top">
        <div className="flex min-w-0 items-center gap-3">
          {club ? (
            (brand ?? (
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/30 text-xs font-bold"
                style={{ background: accent }}
              >
                {club.short.slice(0, 3)}
              </span>
            ))
          ) : (
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
          )}
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/55">
              {club?.short ?? "Carreira de treinador"}
            </p>
            <h2
              id="cutscene-title"
              className="truncate font-display text-sm uppercase tracking-wide text-white sm:text-base"
            >
              {data.title}
            </h2>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-white/80 hover:bg-white/10 hover:text-white"
          onClick={() => doneRef.current()}
        >
          Pular cena
        </Button>
      </header>
      <div className="cutscene-bottom">
        {(captions || pendingChoice) && (
          <section key={i} className="cutscene-dialogue" aria-label="Diálogo da cena">
            {speaker ? <p className="cutscene-speaker">{speaker}</p> : null}
            <button
              type="button"
              onClick={next}
              aria-label={typed < full.length ? "Mostrar fala completa" : "Continuar diálogo"}
              className="block w-full text-left text-base leading-relaxed text-white sm:text-lg"
            >
              {full.slice(0, typed)}
              {typed < full.length && (
                <span aria-hidden className="opacity-40">
                  ▍
                </span>
              )}
            </button>
            <p className="sr-only" aria-live="polite">
              {speaker ? `${speaker}: ` : ""}
              {full}
            </p>
            {line.choices && (
              <div className="cutscene-choices" role="group" aria-label="Escolha sua resposta">
                {line.choices.map((choice, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => choose(index)}
                    disabled={chosen !== null}
                    aria-pressed={chosen === index}
                    className="cutscene-choice"
                  >
                    <span className="block font-semibold">{choice.label}</span>
                    {choice.hint ? (
                      <span className="mt-1 block text-xs text-white/60">{choice.hint}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
        {pendingChoice && (
          <p className="cutscene-decision">Sua resposta muda o rumo da conversa.</p>
        )}
        {settingsOpen && (
          <div
            id="cutscene-settings"
            className="cutscene-settings"
            role="group"
            aria-label="Preferências da cena"
          >
            <button
              type="button"
              aria-pressed={captions}
              disabled={pendingChoice}
              onClick={() => setCaptions((value) => !value)}
              className="cutscene-control px-3 text-xs"
            >
              {captions ? <Eye size={17} /> : <EyeOff size={17} />}
              {captions ? "Ocultar legendas" : "Mostrar legendas"}
            </button>
            {narrate && (
              <button
                type="button"
                aria-pressed={voiceEnabled}
                onClick={() => setVoiceEnabled((value) => !value)}
                className="cutscene-control px-3 text-xs"
              >
                {voiceEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
                {voiceEnabled ? "Desligar voz" : "Ligar voz"}
              </button>
            )}
            <button
              type="button"
              aria-pressed={ambientEnabled}
              onClick={toggleAmbience}
              className="cutscene-control px-3 text-xs"
            >
              {ambientEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
              Som ambiente
            </button>
            <button
              type="button"
              aria-pressed={automatic}
              onClick={() => setAutomatic((value) => !value)}
              className="cutscene-control px-3 text-xs"
            >
              Automático
            </button>
            <button
              type="button"
              onClick={() => {
                setMode((value) => (value === "3d" ? "2d" : "3d"));
                setSettingsOpen(false);
              }}
              className="cutscene-control px-3 text-xs"
            >
              {mode === "3d" ? "Cena ilustrada" : "Ver palco 3D"}
            </button>
          </div>
        )}
        <div className="cutscene-progress" aria-hidden="true">
          {lines.map((_, index) => (
            <span key={index} data-complete={index < i} data-active={index === i} />
          ))}
        </div>
        <div className="cutscene-controls" role="group" aria-label="Controles da cena">
          <button
            type="button"
            aria-label={paused ? "Reproduzir cena" : "Pausar cena"}
            aria-pressed={paused}
            onClick={() => setPaused((value) => !value)}
            className="cutscene-control"
          >
            {paused ? <Play size={17} /> : <Pause size={17} />}
          </button>
          <button
            type="button"
            aria-label="Preferências da cena"
            aria-expanded={settingsOpen}
            aria-controls="cutscene-settings"
            onClick={() => setSettingsOpen((value) => !value)}
            className="cutscene-control px-3 text-xs"
          >
            <SlidersHorizontal size={17} />
            <span className="hidden sm:inline">Ajustes</span>
          </button>
          {sequenceActions}
          <span
            className="ml-auto text-xs tabular-nums text-white/60"
            aria-label="Progresso do diálogo"
          >
            {i + 1} / {lines.length}
          </span>
          <button
            type="button"
            onClick={next}
            disabled={pendingChoice && typed >= full.length}
            className="cutscene-control bg-primary px-3 text-primary-foreground"
            aria-label="Avançar diálogo"
          >
            <ChevronRight size={18} />
            <span className="hidden text-xs sm:inline">Continuar</span>
          </button>
        </div>
        <span className="sr-only" aria-live="polite">
          {voiceState === "loading"
            ? "Carregando narração"
            : voiceState === "playing"
              ? "Narração em reprodução"
              : ""}
        </span>
      </div>
    </div>,
    portalHost,
  );
}
