/**
 * Cutscene presentation: a clear 3D stage with compact dialogue and choices.
 * The illustrated scene is a separate fallback, never a layer over WebGL.
 */
import type React from "react";
import "./cinematic.css";
import {
  memo,
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
  type SceneArt,
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

/* ------------------------------------------------------------------ arte */

function Person({
  x,
  y,
  s = 1,
  shirt,
  skin = "#e8bd97",
  anim,
  delay = 0,
}: {
  x: number;
  y: number;
  s?: number | undefined;
  shirt: string;
  skin?: string | undefined;
  anim?: string | undefined;
  delay?: number | undefined;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${s})`}
      className={anim}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <rect x="-6" y="0" width="12" height="18" rx="4" fill={shirt} />
      <rect x="-5" y="17" width="4" height="12" rx="2" fill="#1b2430" />
      <rect x="1" y="17" width="4" height="12" rx="2" fill="#1b2430" />
      <circle cx="0" cy="-6" r="6" fill={skin} />
      <path d="M-6 -8 A6 6 0 0 1 6 -8 L6 -10 A6 6 0 0 0 -6 -10 Z" fill="#23180f" />
    </g>
  );
}

function Crowd({
  a,
  b,
  rows = 4,
  cols = 22,
  y = 32,
  reduced,
}: {
  a: string;
  b: string;
  rows?: number;
  cols?: number;
  y?: number;
  reduced: boolean;
}) {
  const dots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      dots.push(
        <circle
          key={i}
          cx={10 + c * (380 / cols)}
          cy={y + r * 13}
          r={3.4}
          fill={i % 3 === 0 ? b : a}
          opacity={0.35 + ((i * 7) % 5) / 12}
          className={reduced ? undefined : "cs-anim-bob"}
          style={reduced ? undefined : { animationDelay: `${(i % 11) * 160}ms` }}
        />,
      );
    }
  }
  return <g>{dots}</g>;
}

const Backdrop = memo(function Backdrop({
  art,
  a,
  b,
  reduced,
  trophies,
}: {
  art: SceneArt;
  a: string;
  b: string;
  reduced: boolean;
  trophies: number;
}) {
  const anim = (c: string | undefined) => (reduced ? undefined : c);
  return (
    <svg viewBox="0 0 400 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="cs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={a} stopOpacity="0.9" />
          <stop offset="100%" stopColor={b} stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="cs-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d6b39" />
          <stop offset="100%" stopColor="#0e3d20" />
        </linearGradient>
        <radialGradient id="cs-spot" cx="50%" cy="0%" r="80%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="200" fill="url(#cs-sky)" />

      {art === "arrival" && (
        <>
          <rect x="20" y="66" width="360" height="96" fill="#0e1620" opacity="0.78" />
          {Array.from({ length: 14 }).map((_, i) => (
            <rect
              key={i}
              x={30 + i * 25}
              y={78}
              width="14"
              height="22"
              fill={a}
              opacity="0.55"
              className={anim("cs-anim-shine")}
              style={reduced ? undefined : { animationDelay: `${i * 220}ms` }}
            />
          ))}
          <rect x="0" y="160" width="400" height="40" fill="#101a12" />
          <Person x={120} y={140} shirt={a} anim={anim("cs-anim-enter")} />
          <Person
            x={150}
            y={142}
            s={0.9}
            shirt="#2b3440"
            anim={anim("cs-anim-enter")}
            delay={200}
          />
        </>
      )}

      {art === "press" && (
        <>
          <rect x="0" y="60" width="400" height="140" fill="#0d1218" opacity="0.9" />
          {Array.from({ length: 12 }).map((_, i) => (
            <circle
              key={i}
              cx={20 + i * 33}
              cy={96 + (i % 3) * 12}
              r="9"
              fill="#ffffff"
              opacity="0.14"
              className={anim("cs-anim-flash")}
              style={reduced ? undefined : { animationDelay: `${i * 260}ms` }}
            />
          ))}
          <rect x="140" y="128" width="120" height="72" rx="6" fill={b} opacity="0.55" />
          <rect x="150" y="140" width="100" height="12" rx="3" fill="#ffffff" opacity="0.2" />
        </>
      )}

      {art === "dressing" && (
        <>
          <rect x="0" y="46" width="400" height="154" fill="#111a22" opacity="0.92" />
          {Array.from({ length: 6 }).map((_, i) => (
            <g key={i}>
              <rect x={26 + i * 60} y={64} width="38" height="56" rx="5" fill={a} opacity="0.6" />
              <rect x={40 + i * 60} y={64} width="10" height="56" fill={b} opacity="0.45" />
              <rect x={30 + i * 60} y={122} width="30" height="8" rx="3" fill="#0b1015" />
            </g>
          ))}
          <rect x="0" y="150" width="400" height="50" fill="#0b1015" />
        </>
      )}

      {art === "tunnel" && (
        <>
          <rect x="0" y="0" width="400" height="200" fill="#080c11" />
          <ellipse cx="200" cy="110" rx="120" ry="86" fill="url(#cs-spot)" />
          <rect x="120" y="60" width="160" height="140" rx="12" fill="#dff3e4" opacity="0.16" />
          <Person x={170} y={130} shirt={a} anim={anim("cs-anim-bob")} />
          <Person x={200} y={132} s={0.95} shirt={a} anim={anim("cs-anim-bob")} delay={300} />
          <Person x={230} y={130} s={0.9} shirt={a} anim={anim("cs-anim-bob")} delay={600} />
        </>
      )}

      {art === "kitroom" && (
        <>
          <rect x="0" y="40" width="400" height="160" fill="#0e161e" />
          <rect x="16" y="58" width="368" height="5" rx="2.5" fill="#33414f" />
          {Array.from({ length: 7 }).map((_, i) => (
            <g key={i} transform={`translate(${44 + i * 52} 63)`}>
              <rect x="-1.5" y="0" width="3" height="10" fill="#6b7684" />
              {/* camisa pendurada com número nas costas */}
              <path
                d="M-17 10 h34 l7 9 -9 7 -3 -3 v39 h-24 v-39 l-3 3 -9 -7 z"
                fill={i % 2 ? b : a}
              />
              <text
                x="0"
                y="46"
                textAnchor="middle"
                fontSize="15"
                fontWeight="700"
                fill="#ffffff"
                opacity="0.8"
              >
                {i + 2}
              </text>
              {!reduced && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="-1;1.4;-1"
                  dur={`${3 + (i % 3) * 0.6}s`}
                  begin={`${i * 0.2}s`}
                  repeatCount="indefinite"
                  additive="sum"
                />
              )}
            </g>
          ))}
          <rect x="0" y="152" width="400" height="48" fill="#0a1015" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i} transform={`translate(${52 + i * 58} 168)`}>
              <rect x="-12" y="0" width="24" height="9" rx="4" fill={i % 2 ? a : "#1b2430"} />
            </g>
          ))}
          <ellipse cx="200" cy="40" rx="170" ry="52" fill="url(#cs-spot)" opacity="0.6" />
        </>
      )}

      {art === "pitchentry" && (
        <>
          <rect x="0" y="0" width="400" height="120" fill="#060b12" />
          <Crowd a={a} b={b} reduced={reduced} rows={5} cols={26} y={12} />
          {!reduced &&
            Array.from({ length: 16 }).map((_, i) => (
              <circle
                key={i}
                cx={(i * 53) % 396}
                cy={16 + ((i * 29) % 60)}
                r="3"
                fill="#ffffff"
                opacity="0.5"
                className="cs-anim-flash"
                style={{ animationDelay: `${(i % 8) * 190}ms` }}
              />
            ))}
          {[70, 200, 330].map((x) => (
            <g key={x}>
              <rect x={x - 3} y="0" width="6" height="28" fill="#20303c" />
              <rect x={x - 22} y="24" width="44" height="9" rx="3" fill="#dfe8ef" opacity="0.85" />
              <ellipse
                cx={x}
                cy="52"
                rx="40"
                ry="26"
                fill="#ffffff"
                opacity={reduced ? 0.1 : 0.14}
                className={anim("cs-anim-shine")}
              />
            </g>
          ))}
          <rect x="0" y="112" width="400" height="88" fill="url(#cs-grass)" />
          {Array.from({ length: 10 }).map((_, i) => (
            <rect key={i} x={i * 40} y={112} width="20" height="88" fill="#ffffff" opacity="0.04" />
          ))}
          <ellipse
            cx="200"
            cy="156"
            rx="52"
            ry="20"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.5"
          />
          <circle cx="200" cy="156" r="5" fill="#f7f7f5" className={anim("cs-anim-bob")} />
          <Person x={140} y={132} s={0.95} shirt={a} anim={anim("cs-anim-enter")} />
          <Person x={262} y={132} s={0.95} shirt={b} anim={anim("cs-anim-enter")} delay={180} />
          <Person
            x={200}
            y={124}
            s={0.85}
            shirt="#1b2430"
            anim={anim("cs-anim-enter")}
            delay={360}
          />
        </>
      )}

      {(art === "training" || art === "tactics") && (
        <>
          <rect x="0" y="70" width="400" height="130" fill="url(#cs-grass)" />
          {Array.from({ length: 10 }).map((_, i) => (
            <rect
              key={i}
              x={i * 40}
              y={70}
              width="20"
              height="130"
              fill="#ffffff"
              opacity="0.035"
            />
          ))}
          {art === "tactics" ? (
            <>
              <rect x="30" y="86" width="150" height="96" rx="6" fill="#0d1a14" opacity="0.9" />
              <rect x="38" y="94" width="134" height="80" rx="4" fill="#12613a" opacity="0.7" />
              {Array.from({ length: 8 }).map((_, i) => (
                <circle
                  key={i}
                  cx={52 + (i % 4) * 32}
                  cy={112 + Math.floor(i / 4) * 30}
                  r="6"
                  fill={i % 2 ? b : a}
                  className={anim("cs-anim-bob")}
                  style={reduced ? undefined : { animationDelay: `${i * 180}ms` }}
                />
              ))}
              <Person x={230} y={116} s={1.15} shirt="#1b2432" anim={anim("cs-anim-enter")} />
            </>
          ) : (
            <>
              {Array.from({ length: 6 }).map((_, i) => (
                <polygon
                  key={i}
                  points="0,0 7,12 -7,12"
                  transform={`translate(${45 + i * 58} 150)`}
                  fill="#f0a500"
                  opacity="0.85"
                />
              ))}
              {[0, 1, 2, 3].map((i) => (
                <g
                  key={i}
                  className={anim("cs-anim-run")}
                  style={reduced ? undefined : { animationDelay: `${i * 900}ms` }}
                >
                  <Person x={0} y={96 + i * 16} s={0.85 + i * 0.05} shirt={i % 2 ? b : a} />
                </g>
              ))}
              <circle cx="330" cy="168" r="6" fill="#f7f7f5" className={anim("cs-anim-bob")} />
            </>
          )}
        </>
      )}

      {art === "gym" && (
        <>
          <rect x="0" y="50" width="400" height="150" fill="#141c24" />
          <rect x="0" y="160" width="400" height="40" fill="#1e2a33" />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${70 + i * 110} 120)`}>
              <rect x="-30" y="22" width="60" height="8" rx="4" fill="#2b3742" />
              <Person
                x={0}
                y={0}
                s={0.95}
                shirt={i % 2 ? a : b}
                anim={anim("cs-anim-bob")}
                delay={i * 320}
              />
              <rect x="-26" y="4" width="52" height="4" rx="2" fill="#8a949e" />
              <circle cx="-28" cy="6" r="7" fill="#5b6670" />
              <circle cx="28" cy="6" r="7" fill="#5b6670" />
            </g>
          ))}
        </>
      )}

      {art === "staff" && (
        <>
          <rect x="0" y="44" width="400" height="156" fill="#131b23" />
          <rect x="24" y="60" width="150" height="90" rx="6" fill="#0f2a1e" />
          {Array.from({ length: 6 }).map((_, i) => (
            <circle
              key={i}
              cx={44 + (i % 3) * 46}
              cy={84 + Math.floor(i / 3) * 38}
              r="7"
              fill={i % 2 ? b : a}
              className={anim("cs-anim-shine")}
              style={reduced ? undefined : { animationDelay: `${i * 240}ms` }}
            />
          ))}
          <rect x="196" y="120" width="180" height="12" rx="6" fill="#26313c" />
          <Person x={230} y={92} s={1} shirt="#1b2432" anim={anim("cs-anim-enter")} />
          <Person x={278} y={92} s={1} shirt="#2f4a3a" anim={anim("cs-anim-enter")} delay={180} />
          <Person x={326} y={92} s={1} shirt="#3c3550" anim={anim("cs-anim-enter")} delay={360} />
        </>
      )}

      {art === "trophy" && (
        <>
          <rect x="0" y="40" width="400" height="160" fill="#10151c" />
          {[0, 1].map((row) => (
            <g key={row}>
              <rect x="30" y={80 + row * 58} width="340" height="6" rx="3" fill="#2a3440" />
              {Array.from({ length: 7 }).map((_, i) => {
                const idx = row * 7 + i;
                const filled = idx < Math.max(1, trophies);
                return (
                  <g
                    key={i}
                    transform={`translate(${58 + i * 48} ${80 + row * 58})`}
                    opacity={filled ? 1 : 0.16}
                  >
                    <path d="M-9 -30 h18 v10 a9 9 0 0 1 -18 0 z" fill="#d9b45b" />
                    <rect x="-2" y="-20" width="4" height="12" fill="#c8a24a" />
                    <rect x="-8" y="-8" width="16" height="6" rx="2" fill="#8f7430" />
                    {filled && !reduced && (
                      <circle
                        cx="0"
                        cy="-26"
                        r="12"
                        fill="#ffe9a8"
                        opacity="0.18"
                        className="cs-anim-shine"
                      />
                    )}
                  </g>
                );
              })}
            </g>
          ))}
          <ellipse cx="200" cy="40" rx="180" ry="60" fill="url(#cs-spot)" />
        </>
      )}

      {art === "board" && (
        <>
          <rect x="0" y="46" width="400" height="154" fill="#161d26" />
          <rect x="60" y="120" width="280" height="16" rx="6" fill="#2b3644" />
          <rect x="90" y="136" width="220" height="64" fill="#101821" />
          <Person x={130} y={86} s={1.05} shirt="#243043" anim={anim("cs-anim-enter")} />
          <Person x={200} y={84} s={1.1} shirt="#1b2432" anim={anim("cs-anim-enter")} delay={160} />
          <Person
            x={270}
            y={86}
            s={1.05}
            shirt="#33404f"
            anim={anim("cs-anim-enter")}
            delay={320}
          />
          <rect x="24" y="60" width="70" height="46" rx="4" fill={a} opacity="0.25" />
        </>
      )}

      {art === "transfer" && (
        <>
          <rect x="0" y="48" width="400" height="152" fill="#121a22" />
          <rect x="40" y="70" width="150" height="100" rx="8" fill="#1b2733" />
          <rect x="52" y="84" width="126" height="8" rx="4" fill={a} opacity="0.7" />
          {Array.from({ length: 5 }).map((_, i) => (
            <rect
              key={i}
              x="52"
              y={102 + i * 14}
              width={110 - i * 12}
              height="7"
              rx="3"
              fill="#3a4756"
              className={anim("cs-anim-shine")}
              style={reduced ? undefined : { animationDelay: `${i * 200}ms` }}
            />
          ))}
          <Person x={250} y={100} s={1.1} shirt="#1b2432" anim={anim("cs-anim-enter")} />
          <Person x={310} y={100} s={1.1} shirt={b} anim={anim("cs-anim-enter")} delay={200} />
        </>
      )}

      {(art === "celebration" || art === "farewell") && (
        <>
          <rect x="0" y="0" width="400" height="130" fill="#0b1220" opacity="0.55" />
          <Crowd a={a} b={b} reduced={reduced} rows={5} y={18} />
          <rect x="0" y="120" width="400" height="80" fill="url(#cs-grass)" />
          {art === "celebration" &&
            !reduced &&
            Array.from({ length: 26 }).map((_, i) => (
              <rect
                key={i}
                x={(i * 37) % 396}
                y={-10}
                width="4"
                height="9"
                fill={i % 3 === 0 ? "#f5d36b" : i % 3 === 1 ? a : b}
                className="cs-anim-confetti"
                style={{ animationDelay: `${(i % 9) * 260}ms` }}
              />
            ))}
          <Person x={200} y={140} s={1.2} shirt={a} anim={anim("cs-anim-bob")} />
          {art === "celebration" && (
            <g transform="translate(200 118)" className={anim("cs-anim-shine")}>
              <path d="M-10 -16 h20 v10 a10 10 0 0 1 -20 0 z" fill="#f0d585" />
              <rect x="-3" y="-6" width="6" height="10" fill="#d9b45b" />
            </g>
          )}
        </>
      )}

      {art === "defeat" && (
        <>
          <rect x="0" y="0" width="400" height="200" fill="#0a0f14" />
          <rect x="0" y="50" width="400" height="150" fill="#111820" />
          <ellipse cx="200" cy="60" rx="150" ry="60" fill="url(#cs-spot)" opacity="0.5" />
          <Person x={150} y={120} s={1.05} shirt={a} />
          <Person x={210} y={124} s={1} shirt={a} />
          <Person x={262} y={122} s={0.95} shirt={a} />
          <rect x="0" y="176" width="400" height="24" fill="#080c11" />
        </>
      )}

      {art === "bus" && (
        <>
          <rect x="0" y="0" width="400" height="200" fill="#070b12" />
          {Array.from({ length: 5 }).map((_, i) => (
            <g key={i}>
              <rect x={20 + i * 76} y={30} width="10" height="70" fill="#1b2430" />
              <ellipse cx={25 + i * 76} cy={28} rx="16" ry="8" fill="#ffe9a8" opacity="0.8" />
              <ellipse cx={25 + i * 76} cy={60} rx="30" ry="26" fill="#ffe9a8" opacity="0.08" />
            </g>
          ))}
          <rect x="30" y="86" width="340" height="64" rx="10" fill={a} opacity="0.9" />
          <rect x="30" y="128" width="340" height="22" rx="8" fill={b} opacity="0.85" />
          {Array.from({ length: 8 }).map((_, i) => (
            <rect
              key={i}
              x={44 + i * 40}
              y={94}
              width="30"
              height="24"
              rx="3"
              fill="#ffe9a8"
              opacity="0.75"
              className={anim(i % 2 ? "cs-anim-shine" : undefined)}
              style={reduced ? undefined : { animationDelay: `${i * 300}ms` }}
            />
          ))}
          <circle cx="100" cy="152" r="14" fill="#0b0e12" />
          <circle cx="300" cy="152" r="14" fill="#0b0e12" />
          <rect x="0" y="164" width="400" height="36" fill="#0d1117" />
          <rect x="0" y="164" width="400" height="4" fill="#f5d36b" opacity="0.5" />
        </>
      )}

      {art === "office" && (
        <>
          <rect x="0" y="0" width="400" height="200" fill="#10141b" />
          <rect x="0" y="0" width="400" height="120" fill="#1a2230" opacity="0.7" />
          <rect x="40" y="30" width="120" height="70" rx="4" fill="#0b0f15" />
          {Array.from({ length: 4 }).map((_, i) => (
            <rect
              key={i}
              x={50}
              y={40 + i * 16}
              width={90 - i * 12}
              height="7"
              rx="3"
              fill={a}
              opacity="0.5"
            />
          ))}
          <rect x="250" y="24" width="90" height="76" rx="4" fill={b} opacity="0.6" />
          <circle cx="295" cy="52" r="16" fill={a} opacity="0.8" />
          <rect x="270" y="74" width="50" height="7" rx="3" fill="#ffffff" opacity="0.25" />
          <rect x="90" y="128" width="220" height="14" rx="4" fill="#2c3646" />
          <rect x="100" y="142" width="14" height="40" fill="#232c3a" />
          <rect x="286" y="142" width="14" height="40" fill="#232c3a" />
          <rect x="176" y="108" width="48" height="22" rx="3" fill="#0b0f15" />
          <rect x="182" y="112" width="36" height="5" rx="2" fill="#f5d36b" opacity="0.7" />
          <rect x="182" y="120" width="24" height="4" rx="2" fill="#ffffff" opacity="0.3" />
          <Person x={120} y={120} s={1.05} shirt="#2b3440" />
          <Person x={280} y={122} s={1.05} shirt={a} />
        </>
      )}

      {art === "medical" && (
        <>
          <rect x="0" y="0" width="400" height="200" fill="#e8eef2" />
          <rect x="0" y="0" width="400" height="90" fill="#d5e2ea" />
          <rect x="0" y="150" width="400" height="50" fill="#c4d3dd" />
          <rect x="60" y="110" width="150" height="16" rx="6" fill={a} opacity="0.85" />
          <rect x="70" y="126" width="12" height="34" fill="#8fa3b3" />
          <rect x="188" y="126" width="12" height="34" fill="#8fa3b3" />
          <ellipse cx="120" cy="104" rx="26" ry="10" fill="#ffffff" opacity="0.7" />
          <rect x="255" y="60" width="70" height="90" rx="6" fill="#ffffff" opacity="0.85" />
          <rect x="282" y="78" width="16" height="44" rx="3" fill="#e05252" />
          <rect x="268" y="92" width="44" height="16" rx="3" fill="#e05252" />
          <g className={anim("cs-anim-shine")}>
            <polyline
              points="20,60 70,60 85,40 100,78 115,52 140,52 155,30 170,70 185,60 240,60"
              fill="none"
              stroke="#1d9d55"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          <Person x={250} y={130} s={1.05} shirt="#ffffff" />
        </>
      )}

      {art === "gala" && (
        <>
          <rect x="0" y="0" width="400" height="200" fill="#0d0a16" />
          <ellipse cx="200" cy="30" rx="170" ry="70" fill="url(#cs-spot)" opacity="0.7" />
          {Array.from({ length: 3 }).map((_, i) => (
            <polygon
              key={i}
              points={`${120 + i * 80},0 ${150 + i * 80},0 ${170 + i * 80},200 ${110 + i * 80},200`}
              fill="#f5d36b"
              opacity="0.07"
            />
          ))}
          <rect x="0" y="150" width="400" height="50" fill="#7a1420" />
          <rect x="0" y="150" width="400" height="6" fill="#f5d36b" opacity="0.8" />
          {Array.from({ length: 20 }).map((_, i) => (
            <circle
              key={i}
              cx={(i * 53) % 400}
              cy={10 + ((i * 29) % 60)}
              r={i % 3 === 0 ? 2.4 : 1.4}
              fill="#ffe9a8"
              opacity="0.85"
              className={anim("cs-anim-flash")}
              style={reduced ? undefined : { animationDelay: `${i * 330}ms` }}
            />
          ))}
          <g transform="translate(200 108)" className={anim("cs-anim-shine")}>
            <path d="M-16 -26 h32 v16 a16 16 0 0 1 -32 0 z" fill="#f0d585" />
            <rect x="-5" y="-10" width="10" height="16" fill="#d9b45b" />
            <rect x="-14" y="6" width="28" height="6" rx="2" fill="#8a6a2a" />
          </g>
          <Person x={140} y={140} shirt="#1c2330" />
          <Person x={260} y={140} shirt="#1c2330" />
        </>
      )}
    </svg>
  );
});

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
            <Backdrop
              art={data.art}
              a={accent}
              b={accent2}
              reduced={reduced || mode === "3d"}
              trophies={trophies}
            />
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
