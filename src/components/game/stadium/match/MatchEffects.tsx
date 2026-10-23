import { useFrame } from "@react-three/fiber";

import type React from "react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { skyTexture } from "@/components/game/stadium/textures/sky";

import { FIELD_X, FIELD_Z } from "@/game/sim-rules";

import { type TimeOfDay, type Weather } from "@/game/matchday";
import { matchLighting } from "@/game/match-lighting";
import { useVisual } from "@/game/visual-settings";

import { type Quality } from "./shared";
export function SkyDome({ time, weather }: { time: TimeOfDay; weather: Weather }) {
  const tex = useMemo(() => skyTexture(time), [time]);
  const material = useMemo(() => {
    const surface = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    if (weather === "chuva" || weather === "neve") {
      // Keep the cached cloud detail but close the blue sky and the solar halo
      // under active precipitation. One existing sky draw, no extra overlay.
      const overcast = new THREE.Color(matchLighting(time, weather, false).sky);
      surface.customProgramCacheKey = () => "stadium-overcast-sky-v1";
      surface.onBeforeCompile = (shader) => {
        shader.uniforms["skyOvercastColor"] = { value: overcast };
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\nuniform vec3 skyOvercastColor;")
          .replace(
            "#include <map_fragment>",
            `#include <map_fragment>
            float skyLuminance = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
            diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(skyLuminance), skyOvercastColor, 0.58), 0.88);`,
          );
      };
    }
    return surface;
  }, [tex, time, weather]);
  useEffect(() => () => material.dispose(), [material]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.0035;
  });
  if (!tex) return null;
  return (
    <mesh ref={ref} renderOrder={-1000} userData={{ census: "sky" }}>
      <sphereGeometry args={[420, 48, 28]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* ------------------------------------------------------------------- cena */

/**
 * Festa do gol: papel picado colorido caindo sobre o gramado e fumaça de
 * sinalizador subindo atrás do gol, tudo instanciado e disparado pelo pulso.
 */
export function GoalFx({
  goalPulse,
  quality,
  density = 1,
}: {
  goalPulse: React.MutableRefObject<number>;
  quality: Quality;
  density?: number;
}) {
  const COUNT = Math.max(
    0,
    Math.round((quality === "alta" ? 320 : 140) * useVisual().particles * density),
  );
  const ref = useRef<THREE.InstancedMesh>(null);
  const smoke = useRef<THREE.InstancedMesh>(null);
  const parts = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        x: 0,
        y: -5,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        r: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 6,
      })),
    [COUNT],
  );
  const armed = useRef(false);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < COUNT; i++) {
      col.setHSL(Math.random(), 0.85, 0.6);
      mesh.setColorAt(i, col);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [COUNT, col]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const mesh = ref.current;
    if (!mesh) return;
    if (goalPulse.current <= 0.01 && !armed.current) return;

    if (goalPulse.current > 0.9 && !armed.current) {
      armed.current = true;
      for (const p of parts) {
        p.x = (Math.random() * 2 - 1) * (FIELD_X * 0.8);
        p.y = 16 + Math.random() * 10;
        p.z = (Math.random() * 2 - 1) * (FIELD_Z * 0.8);
        p.vx = (Math.random() - 0.5) * 1.2;
        p.vy = -1 - Math.random() * 1.5;
        p.vz = (Math.random() - 0.5) * 1.2;
      }
    }
    if (goalPulse.current < 0.2) armed.current = false;

    for (let i = 0; i < COUNT; i++) {
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
      <instancedMesh ref={ref} frustumCulled={false} args={[undefined, undefined, COUNT]}>
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

/* ------------------------------------------------------- arbitragem */

/**
 * Árbitro e assistentes com corpo articulado: tronco com gola, calção, meiões,
 * braços que balançam na corrida, apito no pescoço e cartões no bolso. O
 * árbitro corre na diagonal clássica e levanta o cartão quando há falta; os
 * assistentes acompanham a linha e levantam a bandeira quando o lance para.
 */
