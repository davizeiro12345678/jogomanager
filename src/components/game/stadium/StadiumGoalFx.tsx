import { useFrame } from "@react-three/fiber";
import type React from "react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FIELD_X, FIELD_Z } from "@/game/sim-rules";
import { useVisual } from "@/game/visual-settings";
import type { Quality } from "./quality";
import {
  createStadiumCosmeticRng,
  DEFAULT_STADIUM_FIXTURE,
  poolVisibleCount,
} from "./stadium-cosmetics";

export const GOAL_FX_POOL_CAPACITY = 320;

/**
 * Festa do gol: papel picado colorido caindo sobre o gramado e fumaça de
 * sinalizador subindo atrás do gol, tudo instanciado e disparado pelo pulso.
 */
export function GoalFx({
  goalPulse,
  quality,
  density = 1,
  fixtureKey = DEFAULT_STADIUM_FIXTURE,
}: {
  goalPulse: React.MutableRefObject<number>;
  quality: Quality;
  density?: number;
  fixtureKey?: string;
}) {
  const count = poolVisibleCount(
    Math.round((quality === "alta" ? 320 : 140) * useVisual().particles * density),
    GOAL_FX_POOL_CAPACITY,
  );
  const ref = useRef<THREE.InstancedMesh>(null);
  const smoke = useRef<THREE.InstancedMesh>(null);
  const parts = useMemo(
    () =>
      Array.from({ length: GOAL_FX_POOL_CAPACITY }, (_, index) => {
        const rand = createStadiumCosmeticRng(fixtureKey, "goal-fx", index, 0);
        return {
          index,
          x: 0,
          y: -5,
          z: 0,
          vx: 0,
          vy: 0,
          vz: 0,
          r: rand() * Math.PI,
          spin: (rand() - 0.5) * 6,
        };
      }),
    [fixtureKey],
  );
  const armed = useRef(false);
  const goalBeat = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < GOAL_FX_POOL_CAPACITY; i++) {
      const rand = createStadiumCosmeticRng(fixtureKey, "goal-fx-color", i);
      col.setHSL(rand(), 0.85, 0.6);
      mesh.setColorAt(i, col);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [col, fixtureKey]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const mesh = ref.current;
    if (!mesh) return;
    mesh.count = count;
    mesh.visible = count > 0 && goalPulse.current > 0.01;
    if (goalPulse.current <= 0.01 && !armed.current) return;

    if (goalPulse.current > 0.9 && !armed.current) {
      armed.current = true;
      const beat = goalBeat.current++;
      for (const p of parts) {
        const rand = createStadiumCosmeticRng(fixtureKey, "goal-fx-spawn", beat, p.index);
        p.x = (rand() * 2 - 1) * (FIELD_X * 0.8);
        p.y = 16 + rand() * 10;
        p.z = (rand() * 2 - 1) * (FIELD_Z * 0.8);
        p.vx = (rand() - 0.5) * 1.2;
        p.vy = -1 - rand() * 1.5;
        p.vz = (rand() - 0.5) * 1.2;
      }
    }
    if (goalPulse.current < 0.2) armed.current = false;

    for (let i = 0; i < count; i++) {
      const p = parts[i]!;
      if (p.y > 0.05) {
        p.vy -= dt * 2.2;
        p.x += (p.vx + Math.sin(clock.elapsedTime * 2 + i) * 0.4) * dt;
        p.z += (p.vz + Math.cos(clock.elapsedTime * 1.7 + i) * 0.4) * dt;
        p.y = Math.max(0.03, p.y + p.vy * dt);
        p.r += p.spin * dt;
      }
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.r, p.r * 0.7, p.r * 0.4);
      dummy.scale.setScalar(p.y > 0.05 ? 1 : 0.0001);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    const sm = smoke.current;
    if (sm) {
      const glow = goalPulse.current;
      for (let i = 0; i < 12; i++) {
        const side = i < 6 ? -1 : 1;
        const t = (clock.elapsedTime * 0.35 + i * 0.17) % 1;
        dummy.position.set(side * (FIELD_X + 6), 1 + t * 12, (i % 6) * 6 - 15);
        dummy.rotation.set(0, 0, t * 1.5);
        dummy.scale.setScalar(glow > 0.05 ? (2 + t * 9) * glow : 0.0001);
        dummy.updateMatrix();
        sm.setMatrixAt(i, dummy.matrix);
      }
      sm.instanceMatrix.needsUpdate = true;
      (sm.material as THREE.MeshBasicMaterial).opacity = 0.16 * glow;
    }
  });

  return (
    <group>
      <instancedMesh
        ref={ref}
        frustumCulled={false}
        args={[undefined, undefined, GOAL_FX_POOL_CAPACITY]}
      >
        <planeGeometry args={[0.28, 0.16]} />
        <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={smoke} frustumCulled={false} args={[undefined, undefined, 12]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#ff6a3d"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </group>
  );
}
