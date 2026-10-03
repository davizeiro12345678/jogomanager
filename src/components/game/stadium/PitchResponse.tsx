// ============================================================================
//  PitchResponse.tsx
//  Resposta do gramado: marcas de chute, escorregões e rastro da bola.
//
//  Um gramado que não guarda marca nenhuma entrega que o jogo é renderizado,
//  não jogado. Aqui as marcas ficam no campo até o fim da partida (como na
//  vida real) e são escritas numa ÚNICA malha instanciada — 64 marcas custam
//  um desenho, não 64.
//
//  A malha é um anel de memória: quando as 64 vagas acabam, as mais antigas
//  são reaproveitadas. Nenhum objeto é criado depois do primeiro quadro.
// ============================================================================

import { useFrame } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { censusRef } from "@/game/scene-census";
import { useRuntimeSceneBudget } from "@/components/game/RuntimeBudget";
import { FIELD_X, FIELD_Z, type SimView } from "@/game/sim";

const MAX_MARKS = 64;
const SCUFF = 0;
const TRAIL = 1;

interface Mark {
  x: number;
  z: number;
  /** rotação no plano do chão */
  angle: number;
  /** comprimento (rastro) e largura */
  length: number;
  width: number;
  /** 0 = arranhão de chute, 1 = rastro de bola rolada */
  kind: number;
  /** tom: mais escuro = terra solta */
  dark: number;
}

function emptyMark(): Mark {
  return { x: 0, z: 0, angle: 0, length: 0, width: 0, kind: SCUFF, dark: 0.5 };
}

/** Textura de arranhão: um borrão com borda irregular, sem simetria. */
function scuffTexture(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, size, size);
  // núcleo
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(38,28,16,0.85)");
  grad.addColorStop(0.55, "rgba(52,40,22,0.42)");
  grad.addColorStop(1, "rgba(60,48,28,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  // respingos de terra
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 22;
    const rad = 0.8 + Math.random() * 2.2;
    ctx.fillStyle = `rgba(44,34,20,${0.12 + Math.random() * 0.22})`;
    ctx.beginPath();
    ctx.arc(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Escreve as marcas no campo. Detecta finalização e falta pela mudança nas
 * estatísticas (o `SimView` não expõe o fluxo de eventos) e o rastro pela
 * distância rolada pela bola.
 */
export const PitchResponse = memo(function PitchResponse({
  sim,
  quality,
  enabled = true,
}: {
  sim: SimView;
  quality: "alta" | "media" | "baixa";
  enabled?: boolean;
}) {
  const budget = useRuntimeSceneBudget();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const marks = useRef<Mark[]>(Array.from({ length: MAX_MARKS }, emptyMark));
  const cursor = useRef(0);
  const live = useRef(0);
  const last = useRef({ shots: 0, fouls: 0, x: 0, z: 0, rolled: 0 });
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const texture = useMemo(() => scuffTexture(), []);
  useEffect(() => () => texture?.dispose(), [texture]);

  const capacity =
    quality === "baixa" ? 0 : quality === "media" ? Math.round(MAX_MARKS * 0.5) : MAX_MARKS;

  useEffect(() => {
    // troca de partida/qualidade: limpa o campo sem recriar a malha
    marks.current = Array.from({ length: MAX_MARKS }, emptyMark);
    cursor.current = 0;
    live.current = 0;
    last.current = { shots: 0, fouls: 0, x: 0, z: 0, rolled: 0 };
    const mesh = meshRef.current;
    if (mesh) mesh.count = 0;
  }, [capacity]);

  const write = (mark: Mark) => {
    const mesh = meshRef.current;
    if (!mesh || capacity <= 0) return;
    const index = cursor.current % capacity;
    cursor.current = (cursor.current + 1) % capacity;
    live.current = Math.min(capacity, live.current + 1);
    marks.current[index] = mark;

    dummy.position.set(mark.x, 0.015 + index * 0.00002, mark.z);
    dummy.rotation.set(-Math.PI / 2, 0, mark.angle);
    dummy.scale.set(mark.length, mark.width, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    // tom: marcas de chute são mais escuras que o rastro de rolamento
    color.setRGB(mark.dark, mark.dark * 0.96, mark.dark * 0.9);
    mesh.setColorAt(index, color);
    mesh.count = live.current;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  useFrame((_, dt) => {
    if (!enabled || capacity <= 0) return;
    const mesh = meshRef.current;
    if (!mesh) return;

    const home = sim.stats.home;
    const away = sim.stats.away;
    const shots = home.shots + away.shots;
    const fouls = home.fouls + away.fouls;
    const prev = last.current;
    const bx = sim.ball.x;
    const bz = sim.ball.z;
    const speed = Math.hypot(sim.ball.vx, sim.ball.vz);
    const rolling = sim.ball.height < 0.35 && speed > 3.2;

    // finalização: leque de arranhões apontando para onde a bola foi
    if (shots > prev.shots) {
      const angle = Math.atan2(sim.ball.vz, sim.ball.vx);
      for (let i = 0; i < 5; i++) {
        const spread = (i - 2) * 0.16;
        write({
          x: bx + Math.cos(angle + spread) * (0.3 + i * 0.12),
          z: bz + Math.sin(angle + spread) * (0.3 + i * 0.12),
          angle: -(angle + spread),
          length: 0.9 + Math.random() * 0.9,
          width: 0.5 + Math.random() * 0.4,
          kind: SCUFF,
          dark: 0.32 + Math.random() * 0.16,
        });
      }
    }

    // falta: escorregão mais largo e mais escuro
    if (fouls > prev.fouls) {
      for (let i = 0; i < 3; i++) {
        write({
          x: bx - 0.6 + Math.random() * 1.2,
          z: bz - 0.6 + Math.random() * 1.2,
          angle: Math.random() * Math.PI,
          length: 1.4 + Math.random() * 1.1,
          width: 0.8 + Math.random() * 0.5,
          kind: SCUFF,
          dark: 0.24 + Math.random() * 0.12,
        });
      }
    }

    // rastro da bola rolada: uma marca a cada ~1,4 m percorridos
    if (rolling) {
      const moved = Math.hypot(bx - prev.x, bz - prev.z);
      prev.rolled += moved;
      if (prev.rolled > 1.4) {
        prev.rolled = 0;
        if (Math.abs(bx) < FIELD_X && Math.abs(bz) < FIELD_Z) {
          write({
            x: bx,
            z: bz,
            angle: -Math.atan2(sim.ball.vz, sim.ball.vx),
            length: 1.1 + speed * 0.06,
            width: 0.42,
            kind: TRAIL,
            dark: 0.4 + Math.random() * 0.1,
          });
        }
      }
    }

    last.current = { shots, fouls, x: bx, z: bz, rolled: prev.rolled };
    void dt;
  });

  const limit = Math.round(capacity * (budget.stage >= 6 ? 0.5 : 1));
  if (!enabled || limit <= 0 || !texture) return null;

  return (
    <group ref={censusRef("grass")} name="pitch-response">
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, limit]}
        frustumCulled={false}
        renderOrder={1}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={0.75}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
});

export default PitchResponse;
