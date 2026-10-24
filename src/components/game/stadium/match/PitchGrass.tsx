import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  useQualityPressure,
  useRuntimeSceneBudget,
} from "@/components/game/runtime-budget-context";
import { resolveRuntimeSceneBudget } from "@/game/runtime-scene-budget";
import { useVisual } from "@/game/visual-settings";
import { GrassChunks } from "../GrassChunks";
import { createGrassBladeMaterial } from "@/game/grass-material";
import type { SimView } from "@/game/sim-types";
import { presentationBall, type Quality } from "./shared";

function useBladeMaterial(color: string, webgl2: boolean) {
  const data = useMemo(() => createGrassBladeMaterial(color, { webgl2 }), [color, webgl2]);
  return { mat: data.material, uniforms: data.uniforms };
}

export function GrassField({
  sim,
  quality,
  webgl2,
}: {
  sim: SimView;
  quality: Quality;
  webgl2: boolean;
}) {
  const vis = useVisual();
  const pressure = useQualityPressure();
  const budget = useRuntimeSceneBudget();
  const { mat, uniforms } = useBladeMaterial("#46824b", webgl2);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(({ clock }) => {
    if (!webgl2) return;
    const visualBall = presentationBall(sim);
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uBall.value.set(visualBall.x, visualBall.height, visualBall.z);
    uniforms.uWind.value = (sim.wind?.strength01 ?? 0.25) * 1.6;
    let count = 0;
    for (const player of sim.players) {
      if (player.sentOff || count >= 22) continue;
      uniforms.uPlayers.value[count++]!.set(player.x, 0, player.z);
    }
    uniforms.uPlayerCount.value = count;
    if (sim.wind && Math.hypot(sim.wind.x, sim.wind.z) > 0.001)
      uniforms.uWindDirection.value.set(sim.wind.x, sim.wind.z).normalize();
  });
  return (
    <GrassChunks
      pressure={pressure}
      material={mat}
      density={vis.grassDensity * budget.grassDensity}
      capacityDensity={vis.grassDensity * resolveRuntimeSceneBudget(budget.tier).grassDensity}
      maxVisibleChunks={budget.grassChunks}
    />
  );
}
/**
 * Marcas de pisada e rastro de deslize: um pool de manchas escuras deixadas
 * pela bola e pelos jogadores, que desbotam com o tempo.
 */
export function PitchMarks({ sim }: { sim: SimView }) {
  // Marcas devem recompensar um close de carrinho ou arrancada. No plano TV,
  // um histórico longo de discos escuros passava a ler como manchas de lama.
  const COUNT = 64;
  const ref = useRef<THREE.InstancedMesh>(null);
  const slots = useRef(Array.from({ length: COUNT }, () => ({ x: 0, z: 0, life: 0, s: 1, r: 0 })));
  const next = useRef(0);
  const timer = useRef(0);
  const initialized = useRef(false);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, rawDt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(rawDt, 0.05);
    timer.current += dt;

    // Só uma arrancada real imprime a grama. O rastro fica curto e desaparece
    // antes de tornar a leitura tática do campo irregular.
    if (timer.current > 0.16) {
      timer.current = 0;
      for (const p of sim.players) {
        const sp = Math.hypot(p.vx, p.vz);
        if (sp < 4.4) continue;
        const slot = slots.current[next.current % COUNT]!;
        next.current += 1;
        slot.x = p.x;
        slot.z = p.z;
        slot.life = 1;
        slot.s = 0.22 + Math.min(0.36, (sp - 4.4) * 0.13);
        slot.r = Math.atan2(p.vx, p.vz);
      }
    }

    let dirty = false;
    let active = false;
    for (let i = 0; i < COUNT; i++) {
      const s = slots.current[i]!;
      if (initialized.current && s.life <= 0) continue;
      if (s.life > 0) s.life = Math.max(0, s.life - dt * 0.28);
      active ||= s.life > 0;
      dummy.position.set(s.x, 0.012, s.z);
      dummy.rotation.set(-Math.PI / 2, 0, -s.r);
      const k = s.life > 0 ? s.s * Math.sqrt(s.life) : 0;
      dummy.scale.set(k * 0.5, k, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      dirty = true;
    }
    initialized.current = true;
    mesh.visible = active;
    if (dirty) mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} frustumCulled={false} args={[undefined, undefined, COUNT]}>
      <circleGeometry args={[0.5, 10]} />
      <meshBasicMaterial color="#1b5a31" transparent opacity={0.095} depthWrite={false} />
    </instancedMesh>
  );
}
