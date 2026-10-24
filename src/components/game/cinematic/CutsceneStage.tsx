import { CutsceneTransport } from "./CutsceneTransport";
import { CutsceneDialogue } from "./CutsceneDialogue";
import { CutsceneSettings } from "./CutsceneSettings";
import styles from "./cinematic.module.css";
import { Backdrop } from "./IllustratedBackdrop";
/**
 * Cutscene presentation: a clear 3D stage with compact dialogue and choices.
 * The illustrated scene is a separate fallback, never a layer over WebGL.
 */
import type React from "react";
import { useT } from "@/i18n/provider";
import { useAccessibility } from "@/hooks/useAccessibility";
import { sceneText, sceneTitle, sceneSpeakerLabels } from "@/game/scene-localization";

import {
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/** enquadramentos alternados: cada fala reposiciona levemente a câmera */
import {
  CUTSCENES,
  type ChoiceEffect,
  type Cutscene as SceneData,
  type CutsceneLine,
} from "@/content/cutscenes";
import { speakerName, type Cast } from "@/game/cast";
import { SHOTS } from "@/game/cutscene-timeline";
import { directScene } from "@/game/cutscene-director";
import { cinematicCueFor } from "@/game/cinematic-cue";
import { CinematicSound } from "@/game/cinematic-sound";
import { playCinematicVoice } from "@/game/cinematic-playback";
import { beginCinematicOverlay } from "@/game/cinematic-overlay";
import {
  cutsceneBranch,
  type CutsceneChoiceContext,
  type CutsceneChoiceReaction,
} from "@/game/cutscene-choice";
import { prefersReducedMotion, watchReducedMotion } from "@/game/device";
import { dialogueBoundaries, dialogueRevealLength } from "@/game/dialogue-reveal";
import type { Club, ManagerLook } from "@/game/types";
import type { QualityLevel } from "@/game/device";
import type { CinematicManner } from "@/game/cinematic-actor";
import { LazyCinematicStage, preloadCinematicStage } from "./cinematic-loading";
import { cinematicSetFor } from "@/game/cinematic-set";
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
  const { t, lang: uiLang, messageLanguage } = useT();
  const accessibility = useAccessibility();
  // uniforme real do clube tinge o cenário quando nenhuma cor é forçada
  const accent = accentProp ?? club?.primary ?? "#0a8f3c";
  const accent2 = accent2Prop ?? club?.secondary ?? "#0b1220";
  const data: SceneData | undefined = sceneData ?? CUTSCENES[scene];

  const [i, setI] = useState(0);
  // Replaying a performance never re-applies a career choice or rebuilds its branch.
  const [replay, setReplay] = useState(0);
  // roteiro vivo: a resposta da escolha é enxertada aqui e a cena continua
  const [lines, setLines] = useState<CutsceneLine[]>(data?.lines ?? []);
  const [chosen, setChosen] = useState<number | null>(null);
  const [branchReaction, setBranchReaction] = useState<CutsceneChoiceReaction | undefined>();
  const [branchLines, setBranchLines] = useState<readonly CutsceneLine[]>([]);
  const chosenRef = useRef<number | null>(null);
  const [mode, setMode] = useState<"3d" | "2d">(cinematic ? "3d" : "2d");
  const [paused, setPaused] = useState(startPaused);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const transcriptRef = useRef<HTMLElement>(null);
  const transcriptTrigger = useRef<HTMLButtonElement>(null);
  const transcriptWasOpen = useRef(false);
  useEffect(() => {
    if (transcriptOpen) transcriptRef.current?.focus();
    else if (transcriptWasOpen.current) transcriptTrigger.current?.focus();
    transcriptWasOpen.current = transcriptOpen;
  }, [transcriptOpen]);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  useEffect(() => setPortalHost(document.body), []);
  const [hidden, setHidden] = useState(false);
  const [stageReady, setStageReady] = useState(false);
  const [mountStage, setMountStage] = useState(false);
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
  const onUnavailable = useCallback(() => setMode("2d"), []);
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
    void preloadCinematicStage(data ? cinematicSetFor(data.art) : undefined).catch(() => undefined);
    // Commit the lightweight controls before constructing the actor meshes.
    const frame = requestAnimationFrame(() => startTransition(() => setMountStage(true)));
    return () => {
      cancelAnimationFrame(visibleFrame);
      cancelAnimationFrame(frame);
    };
  }, [mode, data]);
  const [captions, setCaptions] = useState(accessibility.preferences.captions);
  const [captionScale, setCaptionScale] = useState(1);
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
  const reduced =
    reduceMotion ||
    accessibility.reducedMotion ||
    (accessibility.preferences.motion === "system" && systemReduced);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const stageRef = useRef<HTMLDivElement>(null);
  const illustrationRef = useRef<HTMLDivElement>(null);
  const par = useRef({ x: 0, y: 0 });
  const dollyTime = useRef(0);
  const pausedRef = useRef(paused || hidden || transcriptOpen);
  pausedRef.current = paused || hidden || transcriptOpen;
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const voiceUrlRef = useRef<string | null>(null);
  const voiceContextRef = useRef<AudioContext | null>(null);
  const voiceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const voiceClockRef = useRef<ReturnType<typeof voiceClockFromContext> | null>(null);
  const voicePlayingRef = useRef(false);
  const voiceVisemesRef = useRef<readonly TimedViseme[]>([]);
  const voiceFallbackTimerRef = useRef<number | null>(null);
  const voiceFallbackRef = useRef<(() => void) | null>(null);
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
    voiceFallbackRef.current = null;
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
      if (pausedRef.current || voiceRef.current !== audio || audio.ended) return;
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
      // AudioContext.resume is asynchronous: the user may pause or advance while it resolves.
      if (pausedRef.current || voiceRef.current !== audio || audio.ended) return;
      if (
        !(await playCinematicVoice(audio, () => !pausedRef.current && voiceRef.current === audio))
      )
        return;
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
  }, [i, mode, replay]);
  useEffect(() => {
    if (reduced || mode === "3d" || paused || hidden || transcriptOpen) return;
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
  }, [i, reduced, mode, paused, hidden, transcriptOpen]);

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
  const presented = sceneText(data, line, uiLang, t, messageLanguage);
  const full = presented.text;
  const presentedTitle = data ? sceneTitle(data, uiLang, t) : "";
  const speakerLabels = useMemo(() => sceneSpeakerLabels(uiLang, t, data), [uiLang, t, data]);
  const boundaries = useMemo(() => dialogueBoundaries(full), [full]);
  const cue = useMemo(
    () =>
      line && direction?.lines[i] && data
        ? cinematicCueFor(
            `${data.id}:${line.id ?? i}:replay-${replay}`,
            line,
            direction.lines[i]!,
            lineMood,
            {
              previousLine,
              choiceReaction: branchReactionForLine,
            },
          )
        : undefined,
    [line, direction, i, data, lineMood, previousLine, branchReactionForLine, replay],
  );

  useEffect(() => () => ambientRef.current?.dispose(), []);
  useEffect(() => {
    ambientRef.current?.setPaused(paused || hidden || transcriptOpen);
  }, [paused, hidden, transcriptOpen]);
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
        sound.setPaused(paused || hidden || transcriptOpen);
        setAmbientEnabled(true);
      }
    }
  }, [ambientEnabled, data, paused, hidden, transcriptOpen]);

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
      // A hidden or paused scene keeps its authored clip and pending fallback.
      // No new utterance or timeout starts until the viewer resumes.
      if (pausedRef.current) {
        voiceFallbackRef.current = fallback;
        return;
      }
      fallbackStarted = true;
      clearVoiceFallbackTimer();
      voiceFallbackRef.current = null;
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
      const utterance = new SpeechSynthesisUtterance(full);
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
      utterance.lang = presented.lang;
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
        if (pausedRef.current) {
          audio?.pause();
          return;
        }
        clearVoiceFallbackTimer();
        voiceFallbackRef.current = null;
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
      voiceFallbackRef.current = fallback;
      if (!pausedRef.current)
        voiceFallbackTimerRef.current = window.setTimeout(fallback, SCENE_VOICE_WAIT_MS);
      if (!pausedRef.current) void startVoiceAudio(audio, visemes).catch(fallback);
    };

    const localClip = presented.lang.startsWith("pt") ? cutsceneVoiceFor(data.id, line.id) : null;
    if (!presented.lang.startsWith("pt")) {
      // Portuguese recorded clips must not contradict localized captions.
      fallback();
    } else if (localClip) {
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
    if (presented.lang.startsWith("pt") && nextAuthored >= 0 && nextLine) {
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
    replay,
    full,
    presented.lang,
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
      const length = dialogueRevealLength(boundaries, elapsed);
      setTyped((value) => Math.max(value, length));
      if (length >= full.length) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [full, boundaries, i, reduced, mode, stageReady, replay]);

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
        const buttons = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex='0']",
          ) ?? [],
        ).filter((element) => element.getClientRects().length > 0);
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
      if (e.defaultPrevented || e.isComposing || (transcriptOpen && e.key !== "Escape")) return;
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
        e.preventDefault();
        if (transcriptOpen) setTranscriptOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else doneRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, transcriptOpen, settingsOpen]);

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
    if (paused || hidden || transcriptOpen) {
      clearVoiceFallbackTimer();
      voicePlayingRef.current = false;
      voiceClockRef.current = voiceVisemesRef.current.length ? RESTING_VOICE_CLOCK : null;
      voiceRef.current?.pause();
      window.speechSynthesis?.pause();
    } else {
      const audio = voiceRef.current;
      if (voiceFallbackRef.current && voiceFallbackTimerRef.current === null)
        voiceFallbackTimerRef.current = window.setTimeout(
          voiceFallbackRef.current,
          SCENE_VOICE_WAIT_MS,
        );
      if (audio?.paused && !audio.ended)
        void startVoiceAudio(audio, voiceVisemesRef.current).catch(() => {
          voiceClockRef.current = null;
        });
      window.speechSynthesis?.resume();
      if (window.speechSynthesis?.speaking) voicePlayingRef.current = true;
    }
  }, [
    paused,
    hidden,
    transcriptOpen,
    narrate,
    voiceEnabled,
    startVoiceAudio,
    clearVoiceFallbackTimer,
  ]);
  useEffect(() => {
    if (
      !automatic ||
      (mode === "3d" && !stageReady) ||
      paused ||
      hidden ||
      transcriptOpen ||
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
    transcriptOpen,
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
  const speaker = speakerName(cast, speakerLabels, line.who, {
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
      data-state="open"
      aria-modal="true"
      aria-labelledby="cutscene-title"
      tabIndex={-1}
      className={styles["cutscene-screen"]}
      data-scene-mode={mode}
      data-scene-paused={paused || hidden || transcriptOpen}
      data-scene-reduced={reduced}
      data-scene-loading={mode === "3d" && !stageReady}
      data-scene-art={data.art}
      data-scene-mood={lineMood}
      data-scene-beat={i}
      style={{ "--cine-caption-scale": captionScale } as React.CSSProperties}
    >
      <div
        ref={stageRef}
        className={styles["cutscene-world"]}
        onPointerMove={mode === "2d" ? onPointerMove : undefined}
      >
        {mode === "2d" || !stageReady ? (
          <div ref={illustrationRef} className="absolute inset-0" aria-hidden="true">
            <Backdrop
              art={data.art}
              a={accent}
              b={accent2}
              reduced={reduced || mode === "3d"}
              trophies={trophies}
            />
          </div>
        ) : null}
        {mode === "3d" && mountStage ? (
          <GraphicsBoundary
            fallback={
              <button
                type="button"
                onClick={onUnavailable}
                className={`${styles["cutscene-loading"]} z-10`}
              >
                {t("scene.unavailable")}
              </button>
            }
          >
            <Suspense fallback={null}>
              <LazyCinematicStage
                key={data.id}
                art={data.art}
                business={data.business}
                language={data.language}
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
                paused={paused || hidden || transcriptOpen}
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
        {mode === "3d" && !stageReady ? (
          <p role="status" className={styles["cutscene-loading"]}>
            {t("scene.loading")}
          </p>
        ) : null}
      </div>
      <div className={styles["cutscene-matte"]} aria-hidden="true" />
      {stageReady && i === 0 && (
        <div className={styles["cutscene-slate"]} aria-hidden="true">
          <span>{club?.short ?? t("scene.storyTag")}</span>
          <strong>{presentedTitle}</strong>
        </div>
      )}
      <header className={styles["cutscene-top"]}>
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
              {club?.short ?? t("scene.managerCareer")}
            </p>
            <h2
              id="cutscene-title"
              className="truncate font-display text-sm uppercase tracking-wide text-white sm:text-base"
            >
              {presentedTitle}
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
          {t("scene.skip")}
        </Button>
      </header>
      {transcriptOpen && (
        <section
          ref={transcriptRef}
          tabIndex={0}
          className={styles["cutscene-transcript"]}
          aria-labelledby="cutscene-transcript-title"
        >
          <div className={styles["cutscene-transcript-heading"]}>
            <h3 id="cutscene-transcript-title">{t("scene.transcript")}</h3>
            <button
              type="button"
              onClick={() => setTranscriptOpen(false)}
              className={`${styles["cutscene-control"]} px-3`}
            >
              {t("scene.backToScene")}
            </button>
          </div>
          <p>{t("scene.transcriptHint")}</p>
          <ol>
            {lines.slice(0, i + 1).map((entry, index) => {
              const copy = sceneText(data, entry, uiLang, t, messageLanguage);
              const name = speakerName(cast, speakerLabels, entry.who, {
                ...(managerName ? { manager: managerName } : {}),
                ...(captainName ? { captain: captainName } : {}),
              });
              return (
                <li
                  key={`${entry.id ?? index}-${index}`}
                  aria-current={index === i ? "step" : undefined}
                >
                  {name && <strong>{name}</strong>}
                  <p lang={copy.lang} dir="auto">
                    {copy.text}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      )}
      <div className={styles["cutscene-bottom"]} hidden={transcriptOpen}>
        {(captions || pendingChoice) && (
          <CutsceneDialogue
            key={`${i}-${replay}`}
            speaker={speaker}
            fullText={full}
            visibleText={full.slice(0, typed)}
            choices={line.choices}
            selectedChoice={chosen}
            choiceLocked={chosen !== null}
            onAdvance={next}
            onChoose={choose}
            language={presented.lang}
            labels={{
              dialogue: t("scene.dialogue"),
              fullLine: t("scene.fullLine"),
              continue: t("scene.continue"),
              choice: t("scene.choice"),
            }}
          />
        )}
        {pendingChoice && <p className={styles["cutscene-decision"]}>{t("scene.decision")}</p>}
        {settingsOpen && (
          <CutsceneSettings
            captions={captions}
            pendingChoice={pendingChoice}
            onToggleCaptions={() => setCaptions((value) => !value)}
            narrate={narrate}
            voiceEnabled={voiceEnabled}
            onToggleVoice={() => setVoiceEnabled((value) => !value)}
            ambientEnabled={ambientEnabled}
            onToggleAmbience={toggleAmbience}
            automatic={automatic}
            onToggleAutomatic={() => setAutomatic((value) => !value)}
            mode={mode}
            onToggleMode={() => {
              setMode((value) => (value === "3d" ? "2d" : "3d"));
              setSettingsOpen(false);
            }}
            captionScale={captionScale}
            onCaptionScale={setCaptionScale}
            labels={{
              preferences: t("scene.preferences"),
              captionSize: t("scene.captionSize"),
              captionHide: t("scene.captionHide"),
              captionShow: t("scene.captionShow"),
              voiceOff: t("scene.voiceOff"),
              voiceOn: t("scene.voiceOn"),
              ambience: t("scene.ambience"),
              automatic: t("scene.automatic"),
              illustrated: t("scene.illustrated"),
              stage: t("scene.stage"),
            }}
          />
        )}
        <CutsceneTransport
          paused={paused}
          settingsOpen={settingsOpen}
          transcriptOpen={transcriptOpen}
          index={i}
          count={lines.length}
          advanceDisabled={pendingChoice && typed >= full.length}
          sequenceActions={sequenceActions}
          transcriptTrigger={transcriptTrigger}
          onPause={() => setPaused((value) => !value)}
          onReplay={() => {
            stopVoice();
            setReplay((value) => value + 1);
            setCaptions(true);
          }}
          onSettings={() => setSettingsOpen((value) => !value)}
          onTranscript={() => {
            setSettingsOpen(false);
            setTranscriptOpen(true);
          }}
          onAdvance={next}
        />
        <span className="sr-only" aria-live="polite">
          {voiceState === "loading"
            ? t("scene.voiceLoading")
            : voiceState === "playing"
              ? t("scene.voicePlaying")
              : ""}
        </span>
      </div>
    </div>,
    portalHost,
  );
}
