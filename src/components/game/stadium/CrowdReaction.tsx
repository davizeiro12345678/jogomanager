// ============================================================================
//  CrowdReaction.tsx
//  Reação da torcida ao que acontece em campo.
//
//  A torcida do projeto já tem geometria, sway e pulso de gol
//  (`CrowdLod`). Este módulo não mexe nisso: ele acrescenta a CAMADA DE
//  REAÇÃO — o que a arquibancada faz em cada tipo de lance:
//
//   - gol            → erupção: flashes de celular, fumaça, bandeiras;
//   - chance clara   → suspiro: flashes esparsos e um "ahhh" visual (brilho);
//   - falta/cartão   → protesto: agito curto e denso;
//   - bola no ataque → zumbido: brilho baixo e constante.
//
//  Custo: 3 nuvens de pontos + 6 sprites de fumaça, todos reciclados. Nenhum
//  objeto é criado durante a partida — o lixo de memória derruba o quadro mais
//  do que qualquer shader.
// ============================================================================

import { useFrame } from "@react-three/fiber";
import { createContext, memo, useContext, useMemo, useRef, useState } from "react";
import type React from "react";
import * as THREE from "three";

import { censusRef } from "@/game/scene-census";
import { useRuntimeSceneBudget } from "@/components/game/RuntimeBudget";
import { FIELD_X, FIELD_Z, type SimView } from "@/game/sim";
import type { SupporterMatchday } from "@/game/career-world-types";

export type CrowdMood = "idle" | "buzz" | "chance" | "erupt" | "protest";

export interface CrowdReactionState {
  mood: CrowdMood;
  /** 0 a 1, decai sozinho */
  intensity: number;
  /** lado que provocou a reação ("home" = a favor do mandante) */
  side: "home" | "away";
  /** minuto do último evento que gerou reação */
  since: number;
}

const EMPTY: CrowdReactionState = { mood: "idle", intensity: 0, side: "home", since: 0 };

/** Contexto para outros subsistemas (câmera, narração) lerem o clima da torcida. */
export const CrowdReactionContext = createContext<React.MutableRefObject<CrowdReactionState>>({
  current: EMPTY,
});

export function useCrowdReaction(): React.MutableRefObject<CrowdReactionState> {
  return useContext(CrowdReactionContext);
}

/** Decaimento por segundo de cada humor. */
const DECAY: Record<CrowdMood, number> = {
  idle: 0.6,
  buzz: 0.9,
  chance: 0.55,
  erupt: 0.22,
  protest: 0.75,
};

/** Prioridade: um gol atropela um zumbido, um protesto não atropela um gol. */
const RANK: Record<CrowdMood, number> = {
  idle: 0,
  buzz: 1,
  protest: 2,
  chance: 3,
  erupt: 4,
};

/**
 * Observa o jogo e mantém o estado de reação. Roda uma vez por quadro e não
 * aloca nada: os contadores anteriores ficam em refs.
 */
function useReactionTracker(sim: SimView, supporters?: SupporterMatchday) {
  const ref = useRef<CrowdReactionState>({ ...EMPTY });
  const last = useRef({ goals: 0, shots: 0, cards: 0, fouls: 0, minute: 0, homeGoals: 0 });

  useFrame((_, dt) => {
    const state = ref.current;
    const home = sim.stats.home;
    const away = sim.stats.away;
    const goals = home.goals + away.goals;
    const shots = home.onTarget + away.onTarget;
    const cards = home.yellow + away.yellow + home.red * 2 + away.red * 2;
    const fouls = home.fouls + away.fouls;
    const minute = sim.minute();
    const prev = last.current;

    let mood: CrowdMood = "idle";
    let side: "home" | "away" = "home";
    let boost = 0;

    if (goals > prev.goals) {
      mood = "erupt";
      side = home.goals > prev.homeGoals ? "home" : "away";
      boost = 1;
    } else if (shots > prev.shots) {
      mood = "chance";
      boost = 0.62;
      // a chance é do lado que finalizou: quem tem mais finalizações no total
      side = home.onTarget + home.shots >= away.onTarget + away.shots ? "home" : "away";
    } else if (cards > prev.cards) {
      mood = "protest";
      boost = 0.46;
      side = home.yellow + home.red >= away.yellow + away.red ? "away" : "home";
    } else if (fouls > prev.fouls) {
      mood = "protest";
      boost = 0.28;
    }

    // bola no terço final: zumbido contínuo, sem evento
    if (mood === "idle") {
      const attackingHome = sim.ball.x > FIELD_X * 0.55;
      const attackingAway = sim.ball.x < -FIELD_X * 0.55;
      if (attackingHome || attackingAway) {
        mood = "buzz";
        side = attackingHome ? "home" : "away";
        boost = 0.24;
      }
    }
    if (supporters && mood === "idle" && minute > 0) {
      const against =
        supporters.side === "home" ? away.goals > home.goals : home.goals > away.goals;
      mood =
        supporters.climate === "protesto" || (supporters.climate === "cobrança" && against)
          ? "protest"
          : "buzz";
      side = supporters.side;
      boost = (mood === "protest" ? 0.18 : 0.06) + supporters.intensity * 0.1;
    }

    if (mood !== "idle" && RANK[mood] >= RANK[state.mood]) {
      state.mood = mood;
      state.side = side;
      state.intensity = Math.max(state.intensity, boost);
      state.since = minute;
    }

    // decaimento
    state.intensity = Math.max(0, state.intensity - dt * DECAY[state.mood]);
    if (state.intensity <= 0.001) {
      state.mood = "idle";
      state.intensity = 0;
    }

    prev.goals = goals;
    prev.shots = shots;
    prev.cards = cards;
    prev.fouls = fouls;
    prev.minute = minute;
    prev.homeGoals = home.goals;
  });

  return ref;
}

/** Sprites de fumaça/foguete: seis no máximo, reciclados por fila. */
const PUFFS = 6;

function SmokePlumes({
  reaction,
  color,
  enabled,
}: {
  reaction: React.MutableRefObject<CrowdReactionState>;
  color: string;
  enabled: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  const life = useRef<number[]>(new Array(PUFFS).fill(0));
  const origin = useRef<number[]>(new Array(PUFFS).fill(0));

  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,0.85)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.28)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useFrame((state, dt) => {
    if (!enabled) return;
    const reactionState = reaction.current;
    // dispara uma leva quando o gol acontece
    if (
      reactionState.mood === "erupt" &&
      reactionState.intensity > 0.85 &&
      life.current.every((v) => v <= 0)
    ) {
      const side = reactionState.side === "home" ? 1 : -1;
      for (let i = 0; i < PUFFS; i++) {
        life.current[i] = 1;
        origin.current[i] = side;
      }
    }
    for (let i = 0; i < PUFFS; i++) {
      const sprite = sprites.current[i];
      if (!sprite) continue;
      const l = life.current[i]!;
      if (l <= 0) {
        sprite.visible = false;
        continue;
      }
      const next = Math.max(0, l - dt * 0.22);
      life.current[i] = next;
      sprite.visible = true;
      const age = 1 - next;
      const side = origin.current[i]!;
      const spread = (i - (PUFFS - 1) / 2) * 3.4;
      sprite.position.set(
        side * (FIELD_X * 0.72) + spread,
        7 + age * 16,
        (i % 2 === 0 ? 1 : -1) * FIELD_Z * (0.55 + (i % 3) * 0.12),
      );
      const scale = 3 + age * 9;
      sprite.scale.set(scale, scale, 1);
      const material = sprite.material as THREE.SpriteMaterial;
      material.opacity = Math.sin(Math.min(1, age * 1.4) * Math.PI) * 0.5;
    }
    void state;
  });

  if (!enabled || !texture) return null;
  return (
    <group ref={group}>
      {Array.from({ length: PUFFS }, (_, i) => (
        <sprite
          key={`puff-${i}`}
          ref={(node) => {
            sprites.current[i] = node;
          }}
          visible={false}
          renderOrder={5}
        >
          <spriteMaterial
            map={texture}
            color={color}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  );
}

/**
 * Flashes de celular na arquibancada. Três nuvens com fases diferentes dão a
 * impressão de milhares de pontos sem um único ponto novo durante a partida.
 */
function FlashBursts({
  reaction,
  count,
  enabled,
}: {
  reaction: React.MutableRefObject<CrowdReactionState>;
  count: number;
  enabled: boolean;
}) {
  const groups = useRef<(THREE.Object3D | null)[]>([]);
  const phases = useMemo(() => [0, 0.37, 0.71], []);

  const clouds = useMemo(() => {
    const per = Math.max(12, Math.floor(count / phases.length));
    return phases.map((_, index) => {
      const positions = new Float32Array(per * 3);
      for (let i = 0; i < per; i++) {
        // anel da arquibancada: atrás dos gols e nas laterais
        const along = Math.random() * 2 - 1;
        const side = Math.random() < 0.5 ? -1 : 1;
        const depth = 0.86 + Math.random() * 0.22;
        positions[i * 3] = along * FIELD_X * 0.96;
        positions[i * 3 + 1] = 6 + Math.random() * 12;
        positions[i * 3 + 2] = side * FIELD_Z * depth;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      return geometry;
    });
    // `phases` é constante: incluí-la só silencia o lint de dependências
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  useFrame((state) => {
    if (!enabled) return;
    const reactionState = reaction.current;
    const t = state.clock.elapsedTime;
    for (let g = 0; g < groups.current.length; g++) {
      const points = groups.current[g];
      if (!points) continue;
      const material = (points as THREE.Points).material as THREE.PointsMaterial;
      const phase = phases[g]!;
      // pisca rápido e irregular: três fases bastam para não parecer um só flash
      const flicker = 0.5 + 0.5 * Math.sin(t * 9 + phase * 12) * Math.sin(t * 3.7 + phase * 5);
      const base =
        reactionState.mood === "erupt"
          ? 1
          : reactionState.mood === "chance"
            ? 0.45
            : reactionState.mood === "protest"
              ? 0.18
              : reactionState.mood === "buzz"
                ? 0.12
                : 0.05;
      material.opacity = Math.min(1, base * reactionState.intensity * flicker * 1.6);
      points.visible = material.opacity > 0.01;
    }
  });

  if (!enabled) return null;
  return (
    <group>
      {clouds.map((geometry, index) => (
        <points
          key={`flash-${index}`}
          geometry={geometry}
          ref={(node) => {
            groups.current[index] = node;
          }}
          frustumCulled={false}
          renderOrder={6}
        >
          <pointsMaterial
            size={0.55}
            sizeAttenuation
            color="#ffffff"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </points>
      ))}
    </group>
  );
}

/**
 * Reação completa. `night` liga os flashes (de dia eles não fazem sentido) e
 * `quality` corta tudo no tier baixo, onde cada ponto conta.
 */
export const CrowdReaction = memo(function CrowdReaction({
  sim,
  quality,
  night,
  color = "#ffb347",
  supporters,
}: {
  sim: SimView;
  quality: "alta" | "media" | "baixa";
  night: boolean;
  color?: string;
  supporters?: SupporterMatchday | undefined;
}) {
  const budget = useRuntimeSceneBudget();
  const reaction = useReactionTracker(sim, supporters);
  const [, force] = useState(0);

  // Só o mandante comemora de verdade; o protesto é do lado prejudicado. O
  // `useState` existe para que o React re-renderize quando a reação muda de
  // humor (os visuais leem o ref a cada quadro, mas o HUD precisa do estado).
  useFrame(() => {
    if (
      reaction.current.mood !== (reaction.current as unknown as { rendered?: CrowdMood }).rendered
    ) {
      (reaction.current as unknown as { rendered?: CrowdMood }).rendered = reaction.current.mood;
      force((n) => (n + 1) % 1024);
    }
  });

  const flashes =
    quality === "baixa" || budget.stage >= 7
      ? 0
      : Math.round((quality === "alta" ? 240 : 96) * budget.textureScale);
  const smoke = quality !== "baixa" && budget.stage < 8;

  return (
    <CrowdReactionContext.Provider value={reaction}>
      <group ref={censusRef("crowd")} name="crowd-reaction">
        {night && flashes > 0 ? <FlashBursts reaction={reaction} count={flashes} enabled /> : null}
        {smoke ? <SmokePlumes reaction={reaction} color={color} enabled /> : null}
      </group>
    </CrowdReactionContext.Provider>
  );
});

export default CrowdReaction;
