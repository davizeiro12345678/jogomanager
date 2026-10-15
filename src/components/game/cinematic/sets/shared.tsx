import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useDisposable } from "../../useDisposable";
import { useCinematicFrame, useCinematicRuntime } from "../cinematic-runtime";

export function hash(seed: number) {
  const s = Math.sin(seed * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export function CelebrationRain() {
  const COUNT = 130;
  const ref = useRef<THREE.InstancedMesh>(null);
  const parts = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        x: -8 + ((i * 37) % 160) / 10,
        y: ((i * 53) % 90) / 10,
        z: -6 + ((i * 29) % 120) / 10,
        fall: 0.7 + ((i * 11) % 10) / 12,
        spin: 1 + (i % 4),
        ph: (i % 9) * 0.7,
      })),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  useCinematicFrame((time, rawDt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(rawDt, 0.05);
    const t = time;
    for (let i = 0; i < COUNT; i++) {
      const p = parts[i]!;
      p.y -= p.fall * dt;
      if (p.y < 0.05) p.y = 8 + hash(i * 19 + Math.floor(t * 0.25)) * 2;
      dummy.position.set(p.x + Math.sin(t * 1.4 + p.ph) * 0.5, p.y, p.z);
      dummy.rotation.set(t * p.spin + p.ph, p.ph, t * p.spin * 0.6);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, COUNT]}
      frustumCulled={false}
      onUpdate={(m) => {
        for (let i = 0; i < COUNT; i++) {
          col.setHSL((i * 0.37) % 1, 0.85, 0.6);
          m.setColorAt(i, col);
        }
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }}
    >
      <planeGeometry args={[0.16, 0.1]} />
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  );
}

export function PressFlashes() {
  const runtime = useCinematicRuntime();
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const state = useMemo(
    () => Array.from({ length: 5 }, (_, i) => ({ x: -3.4 + i * 1.7, next: i * 0.7, heat: 0 })),
    [],
  );
  useCinematicFrame((_, rawDt) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (runtime.reduced) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    const dt = Math.min(rawDt, 0.05);
    for (let i = 0; i < state.length; i++) {
      const f = state[i]!;
      f.next -= dt;
      if (f.next <= 0) {
        f.next = 0.5 + Math.random() * 3.5;
        f.heat = 1;
      }
      f.heat = Math.max(0, f.heat - dt * 10);
      dummy.position.set(f.x, 1.55, 2.1);
      dummy.scale.setScalar(Math.max(0.0001, f.heat * 1.4));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 5]} frustumCulled={false}>
      <sphereGeometry args={[0.3, 8, 8]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

export function TunnelDust() {
  const COUNT = 70;
  const ref = useRef<THREE.Points>(null);
  const geo = useDisposable(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    return g;
  }, []);
  const seeds = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        x: -2.6 + ((i * 37) % 52) / 10,
        y: 0.3 + ((i * 23) % 30) / 10,
        z: -11 + ((i * 53) % 160) / 10,
        ph: (i % 12) * 0.5,
      })),
    [],
  );
  useCinematicFrame((time) => {
    if (!ref.current) return;
    const t = time;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i++) {
      const s = seeds[i]!;
      pos.setXYZ(
        i,
        s.x + Math.sin(t * 0.5 + s.ph) * 0.25,
        s.y + Math.sin(t * 0.34 + s.ph * 2) * 0.2,
        s.z,
      );
    }
    pos.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial
        color="#dff5e4"
        size={0.05}
        transparent
        opacity={0.6}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
