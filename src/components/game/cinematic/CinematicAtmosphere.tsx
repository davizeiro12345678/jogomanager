import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { SceneArt, SceneMood } from "@/content/cutscenes";
import type { CinematicSet } from "@/game/cinematic-blocking";
import type { QualityLevel } from "@/game/device";
import { useCinematicFrame } from "./cinematic-runtime";
import { useCinematicRuntime } from "./cinematic-runtime";
import { cinematicDrillAt, cinematicDrillFor } from "@/game/cinematic-action";

const MARKS: Record<CinematicSet, number[][]> = {
  locker: [
    [-1.9, 0.9],
    [-0.4, 0.9],
    [1.4, 0.9],
    [2.9, 0.9],
    [0.2, -2.1],
  ],
  office: [
    [-0.9, -2.3],
    [1.1, -2.3],
  ],
  press: [[0, -1.95], ...Array.from({ length: 5 }, (_, i) => [-3.4 + i * 1.7, 2.4])],
  tunnel: Array.from({ length: 8 }, (_, i) => [i % 2 ? 0.95 : -0.95, 1 - Math.floor(i / 2) * 1.7]),
  pitch: Array.from({ length: 11 }, (_, i) => [-5.2 + i * 1.06, 0.4 + (i % 2) * 0.5]),
  arrival: [
    [-6.1, -3.4],
    [-6.3, -1.1],
    [-6, 1.2],
    [1.9, 1.8],
  ],
  stands: [],
};
const TRAINING_MARKS = [
  [-5.2, 0.4],
  [-4.7, -1.8],
  ...Array.from({ length: 5 }, (_, i) => [-2.4 + i * 1.55, -1.2 + (i % 2) * 2.7]),
];
const GYM_MARKS = [
  [-0.4, 0.6],
  [1.7, -1.4],
  [-1.6, -1.7],
];
const MEDICAL_MARKS = [
  [-0.4, 0.6],
  [-1.8, -0.9],
  [1.6, -1.65],
];

/** One draw for all contact shadows, including GPUs with dynamic shadows off. */
function ContactShadows({ kind, art }: { kind: CinematicSet; art: SceneArt }) {
  const runtime = useCinematicRuntime();
  const ref = useRef<THREE.InstancedMesh>(null);
  const marks =
    art === "training"
      ? TRAINING_MARKS
      : art === "gym" || art === "medical"
        ? art === "gym"
          ? GYM_MARKS
          : MEDICAL_MARKS
        : MARKS[kind];
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const placed = useRef(false);
  const texture = useMemo(() => {
    const data = new Uint8Array(32 * 32 * 4);
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const radius = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5);
        data[(y * 32 + x) * 4 + 3] = Math.round(Math.max(0, 1 - radius) ** 2 * 150);
      }
    const map = new THREE.DataTexture(data, 32, 32);
    map.needsUpdate = true;
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const place = useCallback(
    (time: number) => {
      if (!ref.current) return;
      marks.forEach((mark, i) => {
        dummy.position.set(mark[0]!, 0.012, mark[1]!);
        if (art === "training" && i > 1) {
          const drill = cinematicDrillAt(
            time,
            i - 2,
            cinematicDrillFor(runtime.cue?.id.split(":")[0]),
          );
          dummy.position.x = drill.x;
          dummy.position.z = drill.z;
        }
        if (kind === "arrival" && i === 3) dummy.position.z -= (1 - Math.min(1, time / 4.8)) * 3;
        dummy.rotation.x = -Math.PI / 2;
        dummy.scale.set(
          0.85,
          kind === "locker" && (marks === GYM_MARKS || marks === MEDICAL_MARKS ? i === 0 : i < 4)
            ? 1
            : 0.55,
          1,
        );
        dummy.updateMatrix();
        ref.current!.setMatrixAt(i, dummy.matrix);
      });
      ref.current.instanceMatrix.needsUpdate = true;
      placed.current = true;
    },
    [marks, kind, art, dummy, runtime.cue?.id],
  );
  useLayoutEffect(() => place(0), [place]);
  useCinematicFrame((time, dt) => {
    if ((art === "training" || kind === "arrival") && (dt > 0 || !placed.current)) place(time);
  });
  if (!marks.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, marks.length]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </instancedMesh>
  );
}

/** Sparse dust is lit by practical fixtures; no fullscreen effect or extra pass. */
export function CinematicAtmosphere({
  kind,
  art,
  mood,
  quality,
}: {
  kind: CinematicSet;
  art: SceneArt;
  mood: SceneMood;
  quality: QualityLevel;
}) {
  const indoor = ["locker", "office", "press"].includes(kind);
  const openAir = kind === "pitch" || kind === "stands" || kind === "arrival";
  // The light profile retains a single contact shadow for grounding, but no
  // animated particle buffer or office shaft. This keeps its promise of a
  // genuinely low-cost path after the scene's props have been mounted.
  const count = quality === "baixa" ? 0 : indoor ? 44 : 28;
  const geometry = useMemo(() => {
    const value = new THREE.BufferGeometry();
    value.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3),
    );
    return value;
  }, [count]);
  const initialized = useRef(false);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    initialized.current = false;
  }, [kind, art, mood, count]);
  useCinematicFrame((time, dt) => {
    if (!count || (!indoor && !openAir) || (initialized.current && dt === 0)) return;
    initialized.current = true;
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < count; i++) {
      if (openAir) {
        const width = kind === "stands" ? 23 : kind === "arrival" ? 12 : 16;
        const depth = kind === "stands" ? 13 : kind === "arrival" ? 10 : 18;
        const baseZ = kind === "stands" ? -1 : kind === "arrival" ? -1.5 : -6;
        positions.setXYZ(
          i,
          -width + ((i * 37) % 200) * (width / 100) + Math.sin(time * 0.13 + i) * 0.24,
          0.55 + ((i * 19) % 36) * 0.075 + Math.sin(time * 0.18 + i * 0.4) * 0.1,
          baseZ - depth / 2 + ((i * 23) % 100) * (depth / 100),
        );
        continue;
      }
      positions.setXYZ(
        i,
        -5 + ((i * 37) % 100) * 0.1 + Math.sin(time * 0.18 + i) * 0.18,
        1.6 + ((i * 17) % 20) * 0.07 + Math.sin(time * 0.11 + i * 0.5) * 0.08,
        -3 + ((i * 23) % 50) * 0.1,
      );
    }
    positions.needsUpdate = true;
  });
  return (
    <group>
      <ContactShadows kind={kind} art={art} />
      {count > 0 && (indoor || openAir) && (
        <points geometry={geometry} frustumCulled={false}>
          <pointsMaterial
            color={mood === "bad" ? "#b1c9eb" : openAir ? "#e7f1d9" : "#ffe2ae"}
            size={openAir ? 0.018 : 0.013}
            transparent
            opacity={openAir ? 0.12 : 0.22}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      )}
      {quality !== "baixa" && kind === "office" && (
        <mesh position={[4.4, 2.15, -2.2]} rotation={[0.52, 0, 0.45]}>
          <coneGeometry args={[1.05, 3.5, 4, 1, true]} />
          <meshBasicMaterial
            color="#b6ccdd"
            transparent
            opacity={0.018}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
}
