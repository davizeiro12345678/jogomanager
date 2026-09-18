/**
 * Motor de cutscenes 2D: cenário ilustrado em SVG com camadas animadas,
 * atores que entram em cena, texto máquina de escrever e botão de pular.
 * Respeita "reduzir movimento" (sem animação e texto imediato).
 */
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** granulado de filme reutilizado na moldura da cena */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter><rect width='160' height='160' filter='url(%23n)' opacity='0.6'/></svg>\")";

/** enquadramentos alternados: cada fala reposiciona levemente a câmera */
/** enquadramentos: posição inicial + direção do travelling contínuo */
const SHOTS = [
  { x: 0, y: 0, z: 0, dx: 10, dy: -3, dz: 0.05 },
  { x: -10, y: -4, z: 0.06, dx: 12, dy: 4, dz: 0.04 },
  { x: 9, y: 3, z: 0.03, dx: -14, dy: -5, dz: 0.06 },
  { x: -4, y: 6, z: 0.09, dx: 6, dy: -8, dz: 0.03 },
] as const;


import {
  CUTSCENES,
  SPEAKER_LABEL,
  type Cutscene as SceneData,
  type SceneArt,
} from "@/content/cutscenes";
import { ManagerPortrait } from "@/components/game/ManagerPortrait";
import { prefersReducedMotion } from "@/game/device";
import { Crest } from "@/components/game/Crest";
import type { Club, ManagerLook } from "@/game/types";

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
  onDone: () => void;
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

function Backdrop({
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
  const anim = (c: string) => (reduced ? undefined : c);
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
              <path d="M-17 10 h34 l7 9 -9 7 -3 -3 v39 h-24 v-39 l-3 3 -9 -7 z" fill={i % 2 ? b : a} />
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
          <ellipse cx="200" cy="156" rx="52" ry="20" fill="none" stroke="#ffffff" strokeOpacity="0.5" />
          <circle cx="200" cy="156" r="5" fill="#f7f7f5" className={anim("cs-anim-bob")} />
          <Person x={140} y={132} s={0.95} shirt={a} anim={anim("cs-anim-enter")} />
          <Person x={262} y={132} s={0.95} shirt={b} anim={anim("cs-anim-enter")} delay={180} />
          <Person x={200} y={124} s={0.85} shirt="#1b2430" anim={anim("cs-anim-enter")} delay={360} />
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
    </svg>
  );
}

/* ------------------------------------------------------------- runtime */

export function Cutscene({
  scene,
  look,
  accent: accentProp,
  accent2: accent2Prop,
  trophies = 0,
  club,
  managerName,
  captainName,
  onDone,
}: Props) {
  // uniforme real do clube tinge o cenário quando nenhuma cor é forçada
  const accent = accentProp ?? club?.primary ?? "#0a8f3c";
  const accent2 = accent2Prop ?? club?.secondary ?? "#0b1220";
  const data: SceneData | undefined = CUTSCENES[scene];

  const [i, setI] = useState(0);
  const [typed, setTyped] = useState(0);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const stageRef = useRef<HTMLDivElement>(null);
  const [par, setPar] = useState({ x: 0, y: 0 });
  /** travelling contínuo da câmera dentro de cada fala (0..1) */
  const [dolly, setDolly] = useState(0);

  useEffect(() => {
    if (reduced) {
      setDolly(0);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const DUR = 9000;
    const tick = (t: number) => {
      const u = Math.min(1, (t - t0) / DUR);
      // easing suave: sem solavanco no início nem no fim
      setDolly(u * u * (3 - 2 * u));
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [i, reduced]);



  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (reduced) return;
      const el = stageRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPar({
        x: (e.clientX - r.left) / r.width - 0.5,
        y: (e.clientY - r.top) / r.height - 0.5,
      });
    },
    [reduced],
  );

  const line = data?.lines[i];
  const full = line?.text ?? "";

  // máquina de escrever
  useEffect(() => {
    if (reduced || !full) {
      setTyped(full.length);
      return;
    }
    setTyped(0);
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setTyped(n);
      if (n >= full.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [full, reduced]);

  useEffect(() => {
    if (!data) doneRef.current();
  }, [data]);

  const next = useCallback(() => {
    if (!data) return;
    if (typed < full.length) {
      setTyped(full.length);
      return;
    }
    if (i + 1 >= data.lines.length) doneRef.current();
    else setI(i + 1);
  }, [data, full.length, i, typed]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
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

  if (!data || !line) return null;
  const base = SPEAKER_LABEL[line.who];
  const speaker =
    line.who === "manager" && managerName
      ? managerName
      : line.who === "captain" && captainName
        ? captainName
        : base;
  /** enquadramento determinístico por fala: leve travelling + zoom */
  const shot = SHOTS[i % SHOTS.length]!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4">
      <div
        className={`w-full max-w-3xl overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl ${
          reduced ? "" : "animate-scale-in"
        }`}
      >
        <div
          ref={stageRef}
          onPointerMove={onPointerMove}
          className="relative h-48 overflow-hidden sm:h-64"
          style={
            data.hybrid && !reduced
              ? { perspective: "900px", perspectiveOrigin: "50% 45%" }
              : undefined
          }
        >
          {/* corte de câmera a cada fala + travelling contínuo dentro da fala */}
          {/* camada de fundo: mais lenta, levemente desfocada (profundidade) */}
          <div
            key={`bg${i}`}
            className="absolute -inset-6"
            style={{
              transform: data.hybrid
                ? `translate3d(${par.x * 6 + (shot.x + shot.dx * dolly) * 0.4}px, ${par.y * 4 + (shot.y + shot.dy * dolly) * 0.4}px, -220px) rotateY(${par.x * 2.5}deg) rotateX(${par.y * -1.6}deg) scale(1.34)`
                : `translate3d(${par.x * 6 + (shot.x + shot.dx * dolly) * 0.4}px, ${par.y * 4 + (shot.y + shot.dy * dolly) * 0.4}px, 0) scale(${1.12 + (shot.z + shot.dz * dolly) * 0.5})`,
              filter: "blur(3px) saturate(0.85)",
              opacity: 0.85,
              transition: reduced ? undefined : "transform 220ms linear",
            }}
          >
            <Backdrop art={data.art} a={accent2} b={accent} reduced={reduced} trophies={trophies} />
          </div>
          {/* camada principal */}
          <div
            key={`fg${i}`}
            className={`absolute inset-0 ${reduced ? "" : "cs-anim-cut"}`}
            style={{
              transform: data.hybrid
                ? `translate3d(${par.x * -14 + shot.x + shot.dx * dolly}px, ${par.y * -9 + shot.y + shot.dy * dolly}px, ${40 + (shot.z + shot.dz * dolly) * 120}px) rotateY(${par.x * -4}deg) rotateX(${par.y * 2.4}deg)`
                : `translate3d(${par.x * -14 + shot.x + shot.dx * dolly}px, ${par.y * -9 + shot.y + shot.dy * dolly}px, 0) scale(${1.04 + shot.z + shot.dz * dolly})`,
              transition: reduced ? undefined : "transform 220ms linear",
            }}
          >
            <Backdrop art={data.art} a={accent} b={accent2} reduced={reduced} trophies={trophies} />
          </div>

          {/* plano de chão inclinado: dá volume real à cena híbrida */}
          {data.hybrid && !reduced && (
            <div
              className="pointer-events-none absolute inset-x-[-20%] bottom-[-28%] h-1/2"
              style={{
                transform: `rotateX(72deg) translateZ(${-30 + dolly * 8}px)`,
                transformOrigin: "50% 0%",
                background: `linear-gradient(to bottom, ${accent}33, transparent 72%), repeating-linear-gradient(90deg, #ffffff12 0 2px, transparent 2px 46px)`,
                filter: "blur(0.4px)",
                opacity: 0.75,
              }}
            />
          )}


          {/* luzes desfocadas ao fundo (bokeh de refletores) */}
          {!reduced && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 7 }).map((_, n) => (
                <span
                  key={`b${n}`}
                  className="absolute block rounded-full cs-anim-bob"
                  style={{
                    left: `${8 + ((n * 61) % 85)}%`,
                    top: `${4 + ((n * 29) % 45)}%`,
                    width: `${18 + (n % 4) * 10}px`,
                    height: `${18 + (n % 4) * 10}px`,
                    background: `radial-gradient(circle, ${n % 2 ? accent : accent2}66, transparent 70%)`,
                    filter: "blur(6px)",
                    opacity: 0.5,
                    animationDelay: `${n * 520}ms`,
                    animationDuration: `${5 + (n % 3)}s`,
                  }}
                />
              ))}
            </div>
          )}
          {/* varredura de luz */}
          {!reduced && (
            <div
              className="pointer-events-none absolute inset-0 cs-anim-sweep"
              style={{
                background:
                  "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.10) 50%, transparent 65%)",
              }}
            />
          )}
          {/* partículas de poeira no facho de luz */}
          {!reduced && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 18 }).map((_, n) => (
                <span
                  key={n}
                  className="absolute block rounded-full bg-white/40 cs-anim-bob"
                  style={{
                    left: `${(n * 37) % 100}%`,
                    top: `${(n * 53) % 100}%`,
                    width: `${1 + (n % 3)}px`,
                    height: `${1 + (n % 3)}px`,
                    opacity: 0.12 + (n % 5) * 0.05,
                    animationDelay: `${(n % 7) * 380}ms`,
                    animationDuration: `${3 + (n % 4)}s`,
                  }}
                />
              ))}
            </div>
          )}
          {/* tonalização quente/fria conforme o clima da cena */}
          <div
            className="pointer-events-none absolute inset-0 mix-blend-soft-light"
            style={{
              background:
                data.mood === "bad"
                  ? "linear-gradient(180deg, rgba(40,80,160,0.45), rgba(0,0,0,0.2))"
                  : data.mood === "good"
                    ? "linear-gradient(180deg, rgba(255,190,90,0.4), rgba(0,0,0,0.15))"
                    : "linear-gradient(180deg, rgba(255,255,255,0.12), transparent)",
            }}
          />
          {/* vinheta + granulado */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 45%, transparent 40%, rgba(0,0,0,0.55) 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
            style={{ backgroundImage: GRAIN, backgroundSize: "160px 160px" }}
          />
          {/* halation: brilho difuso nas altas luzes, como filme */}
          <div
            className="pointer-events-none absolute inset-0 mix-blend-screen"
            style={{
              background:
                "radial-gradient(60% 45% at 50% 22%, rgba(255,214,150,0.16), transparent 70%)",
            }}
          />
          {/* franja cromática sutil nas bordas */}
          <div
            className="pointer-events-none absolute inset-0 mix-blend-screen opacity-30"
            style={{
              background:
                "linear-gradient(90deg, rgba(60,130,255,0.22), transparent 12%, transparent 88%, rgba(255,80,60,0.2))",
            }}
          />

          {/* identidade do clube da campanha */}
          {club ? (
            <div className="absolute right-3 top-6 flex items-center gap-2 rounded-full bg-black/45 px-2.5 py-1 backdrop-blur-sm sm:top-7">
              <Crest club={club} size={26} detail="simple" />
              <span className="font-display text-sm uppercase tracking-wide text-white/90">
                {club.short || club.name}
              </span>
            </div>
          ) : null}

          {/* tarjas cinematográficas */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-black/80 sm:h-5" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-black/80 sm:h-5" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />

          <div className="absolute bottom-3 left-4 flex items-end gap-3">
            <ManagerPortrait look={look} size={72} accent={accent} />
            <div>
              <p className="font-display text-xl uppercase tracking-wide drop-shadow">
                {data.title}
              </p>
              {data.mood && data.mood !== "neutral" && (
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                    data.mood === "good"
                      ? "bg-primary/20 text-primary"
                      : "bg-destructive/20 text-destructive"
                  }`}
                >
                  {data.mood === "good" ? "Momento alto" : "Momento difícil"}
                </span>
              )}
            </div>
          </div>
        </div>

        <button onClick={next} className="block w-full p-5 text-left">
          {speaker && (
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{speaker}</p>
          )}
          <p
            className={`mt-1 min-h-14 text-lg ${line.who === "narrator" ? "italic text-muted-foreground" : ""}`}
          >
            {full.slice(0, typed)}
            {typed < full.length && <span className="opacity-50">▍</span>}
          </p>
          <div className="mt-4 flex items-center gap-1.5">
            {data.lines.map((_, n) => (
              <span
                key={n}
                className={`h-1.5 rounded-full transition-all ${
                  n === i ? "w-6 bg-primary" : n < i ? "w-2 bg-primary/40" : "w-2 bg-border"
                }`}
              />
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              Toque, espaço ou Enter para continuar
            </span>
          </div>
        </button>

        <div className="flex justify-end border-t border-border/60 p-3">
          <button
            onClick={() => doneRef.current()}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Pular cena
          </button>
        </div>
      </div>
    </div>
  );
}
