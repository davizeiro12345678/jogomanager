// ============================================================================
//  AmbientLife.tsx
//  Camada ambiente do estádio: gaivotas circulando de dia, papel picado à
//  deriva no vento e mariposas orbitando os refletores à noite.
//
//  Custo: 3 desenhos (2 instanciados + 1 nuvem de pontos), todos reciclados.
// ============================================================================

import { useFrame } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { censusRef } from "@/game/scene-census";
import type { TimeOfDay } from "@/game/matchday";
import { FIELD_X, FIELD_Z } from "@/game/sim";

const BIRDS = 7;
const PAPERS = 22;
const MOTHS = 64;

/** gaivota em "V": duas asas finas unidas no corpo */
function gullGeometry() {
  const wing = (side: number) => {
    const g = new THREE.PlaneGeometry(0.85, 0.26);
    g.translate(side * 0.425, 0, 0);
    g.rotateZ(side * -0.42);
    return g;
  };
  const merged = mergeGeometries([wing(-1), wing(1)], false)!;
  return merged;
}

export const AmbientLife = memo(function AmbientLife({ time }: { time: TimeOfDay }) {
  const night = time === "noite";
  const birds = useRef<THREE.InstancedMesh>(null);
  const papers = useRef<THREE.InstancedMesh>(null);
  const moths = useRef<THREE.Points>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const gull = useMemo(() => gullGeometry(), []);

  const flock = useMemo(
    () =>
      Array.from({ length: BIRDS }, (_, i) => ({
        r: 38 + (i % 3) * 14 + (i * 7) % 9,
        h: 24 + ((i * 13) % 12),
        speed: (0.05 + (i % 4) * 0.012) * (i % 2 ? 1 : -1),
        phase: (i / BIRDS) * Math.PI * 2,
        flap: 2.2 + (i % 3) * 0.5,
      })),
    [],
  );
  const litter = useMemo(
    () =>
      Array.from({ length: PAPERS }, (_, i) => ({
        x: ((i * 37) % 120) - 60,
        y: 0.1 + ((i * 23) % 40) / 22,
        z: ((i * 53) % 90) - 45,
        tumble: (i % 5) * 1.3,
        spin: 1 + (i % 3),
      })),
    [],
  );
  const mothGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(MOTHS * 3);
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const mothSeed = useMemo(
    () =>
      Array.from({ length: MOTHS }, (_, i) => ({
        lamp: i % 4,
        r: 1.2 + ((i * 7) % 10) / 6,
        speed: 1.5 + ((i * 11) % 20) / 8,
        phase: (i / MOTHS) * Math.PI * 2,
        rise: 27.5 + ((i * 5) % 30) / 10,
      })),
    [],
  );
  // cabeças dos 4 mastros (mesmas coordenadas do Floodlights)
  const lamps = useMemo(
    () =>
      [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ].map(([sx, sz]) => ({ x: sx! * (FIELD_X + 20), z: sz! * (FIELD_Z + 22) })),
    [],
  );

  useEffect(
    () => () => {
      gull.dispose();
      mothGeo.dispose();
    },
    [gull, mothGeo],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (birds.current && !night) {
      for (let i = 0; i < BIRDS; i++) {
        const b = flock[i]!;
        const a = b.phase + t * b.speed;
        dummy.position.set(
          Math.cos(a) * b.r,
          b.h + Math.sin(t * 0.7 + i * 2) * 1.5,
          Math.sin(a) * b.r * 0.75,
        );
        // proa na tangente + inclinação na curva + balanço do bater de asas
        dummy.rotation.set(0, -a + (b.speed > 0 ? 0 : Math.PI), 0);
        dummy.rotateZ(0.18 * Math.sign(b.speed));
        dummy.rotateX(Math.sin(t * b.flap + i) * 0.25);
        dummy.updateMatrix();
        birds.current.setMatrixAt(i, dummy.matrix);
      }
      birds.current.instanceMatrix.needsUpdate = true;
    }
    if (papers.current) {
      for (let i = 0; i < PAPERS; i++) {
        const p = litter[i]!;
        // deriva do vento de oeste para leste, reciclando na borda
        const x = ((p.x + t * 1.1 + 60) % 120) - 60;
        dummy.position.set(x, p.y + Math.sin(t * 1.3 + i * 1.7) * 0.35, p.z + Math.sin(t * 0.4 + i) * 2);
        dummy.rotation.set(t * p.spin + p.tumble, p.tumble * 2 + t * 0.7, 0);
        dummy.updateMatrix();
        papers.current.setMatrixAt(i, dummy.matrix);
      }
      papers.current.instanceMatrix.needsUpdate = true;
    }
    if (moths.current && night) {
      const pos = mothGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < MOTHS; i++) {
        const m = mothSeed[i]!;
        const lamp = lamps[m.lamp]!;
        const a = m.phase + t * m.speed;
        pos.setXYZ(
          i,
          lamp.x + Math.cos(a) * m.r,
          m.rise + Math.sin(t * 2.1 + i) * 0.8,
          lamp.z + Math.sin(a * 1.3) * m.r,
        );
      }
      pos.needsUpdate = true;
    }
  });

  return (
    <group ref={censusRef("props")} name="ambient-life">
      {!night && (
        <instancedMesh ref={birds} args={[undefined, undefined, BIRDS]} frustumCulled={false}>
          <primitive object={gull} attach="geometry" />
          <meshBasicMaterial color="#3a4048" side={THREE.DoubleSide} />
        </instancedMesh>
      )}
      <instancedMesh ref={papers} args={[undefined, undefined, PAPERS]} frustumCulled={false}>
        <planeGeometry args={[0.16, 0.12]} />
        <meshBasicMaterial color="#e8e4d8" side={THREE.DoubleSide} />
      </instancedMesh>
      {night && (
        <points ref={moths} geometry={mothGeo} frustumCulled={false}>
          <pointsMaterial
            color="#ffe9b8"
            size={0.14}
            transparent
            opacity={0.75}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}
    </group>
  );
});
