import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useQualityPressure, useRuntimeSceneBudget } from "../RuntimeBudget";
import { resolveRuntimeSceneBudget } from "@/game/runtime-scene-budget";
import { Puddles } from "./Puddles";
import { GrassChunks } from "./GrassChunks";
import { createGrassBladeMaterial } from "@/game/grass-material";
import { createPitchSurfaceMaterial } from "@/game/pitch-material";
import { grassAlbedo, grassNormal, grassMicroRoughness, grassRoughness, retainGrassMaps, type MowPattern } from "./textures/grass";
import { LINES_H, LINES_W, pitchLinesTexture } from "./textures/lines";
import { pitchWearTexture } from "./textures/wear";
import { FIELD_X, FIELD_Z } from "@/game/sim-rules";
import { useResolvedVisual, useVisual } from "@/game/visual-settings";
import { ktx2, needsKtx2ProceduralFallback, requestKtx2, useKtx2Revision } from "@/game/textures/ktx2";
import type { SimView } from "@/game/sim-contracts";
import type { Quality } from "../Stadium3D";
import { presentationBall } from "./stadium-ball";
import { Goal, CornerFlags } from "./StadiumGoals";

function useBladeMaterial(color: string, webgl2: boolean) {
  const data = useMemo(() => createGrassBladeMaterial(color, { webgl2 }), [color, webgl2]);
  return { mat: data.material, uniforms: data.uniforms };
}

export function GrassField({ sim, quality, webgl2 }: { sim: SimView; quality: Quality; webgl2: boolean }) {
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

export function Pitch({
  quality,
  sim,
  wet,
  mow,
  webgl2,
}: {
  quality: Quality;
  sim: SimView;
  wet: number;
  mow: MowPattern;
  webgl2: boolean;
}) {
  const textureRevision = useKtx2Revision();
  // The precompiled albedo is the default checker cut; retain procedural maps
  // for custom mowing patterns and all low-end/offline devices.
  const compressed = quality === "alta";
  const grassVariant =
    mow === "stripes" || mow === "diagonal" || mow === "wide"
      ? (`grass_${mow}_albedo` as const)
      : "grassAlbedo";
  useEffect(() => {
    if (compressed && grassVariant !== "grassAlbedo") requestKtx2([grassVariant]);
  }, [compressed, grassVariant]);
  const tex = useMemo(() => {
    // A newly decoded map invalidates the procedural fallback.
    void textureRevision;
    const compressedMap =
      compressed && (mow === "checker" || mow === "stripes" || mow === "diagonal" || mow === "wide")
        ? ktx2(grassVariant)
        : null;
    // The 1024px procedural pitch is a main-thread startup spike. The solid
    // material remains readable while an immutable KTX2 request is live.
    return (
      compressedMap ??
      (!compressed || needsKtx2ProceduralFallback(grassVariant) ? grassAlbedo(mow) : null)
    );
  }, [mow, compressed, grassVariant, textureRevision]);
  const rough = useMemo(() => {
    void textureRevision;
    const compressedMap = compressed ? ktx2("grassRough") : null;
    return (
      compressedMap ??
      (!compressed || needsKtx2ProceduralFallback("grassRough") ? grassRoughness(mow) : null)
    );
  }, [mow, compressed, textureRevision]);
  useEffect(() => retainGrassMaps(tex, rough), [tex, rough]);
  // Keep broad relief out of the field normals; it reads as cool blue blotches
  // from the high broadcast camera. The fine procedural blade detail remains.
  const norm = useMemo(() => (quality === "baixa" ? null : grassNormal(mow)), [quality, mow]);
  const microRoughness = useMemo(
    () => (quality === "alta" ? grassMicroRoughness() : null),
    [quality],
  );
  const normalScale = useMemo(
    () => new THREE.Vector2(quality === "alta" ? 0.42 : 0.28, quality === "alta" ? 0.42 : 0.28),
    [quality],
  );
  const wear = useMemo(() => (quality === "baixa" ? null : pitchWearTexture()), [quality]);

  // Tom e desgaste do gramado escolhidos em /visual (global ou por clube).
  const vis = useResolvedVisual(sim.home.clubId);
  const tint = useMemo(() => {
    const k = 1 - vis.grassTint * 0.35; // >1 clareia, <1 escurece
    return new THREE.Color(k, k, k);
  }, [vis.grassTint]);
  // A textura de desgaste mantém fibras e zonas de uso, mas nunca deve virar
  // uma camada de lama em uma partida seca vista da transmissão.
  const wearOpacity = 0.018 + vis.grassWear * 0.17;
  const markings = useMemo(pitchLinesTexture, []);
  const surface = useMemo(
    () =>
      createPitchSurfaceMaterial({
        albedo: tex,
        roughness: rough,
        microRoughness,
        normal: norm,
        normalScale,
        markings,
        wear,
        wearOpacity,
        tint,
        wet,
        high: quality === "alta",
        mergeLayers: webgl2,
      }),
    [
      tex,
      rough,
      microRoughness,
      norm,
      normalScale,
      markings,
      wear,
      wearOpacity,
      tint,
      wet,
      quality,
      webgl2,
    ],
  );
  useEffect(() => () => surface.dispose(), [surface]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[FIELD_X * 2 + 34, FIELD_Z * 2 + 30]} />
        <meshStandardMaterial color="#124a2a" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[FIELD_X * 2 + 10, FIELD_Z * 2 + 10]} />
        <primitive object={surface} attach="material" />
      </mesh>
      {/* WebGPU uses standard materials; the stable WebGL2 path merges both
          layers in its opaque PBR shader without two field-sized passes. */}
      {!webgl2 && wear ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} renderOrder={1}>
          <planeGeometry args={[LINES_W, LINES_H]} />
          <meshStandardMaterial
            map={wear}
            transparent
            opacity={wearOpacity}
            roughness={0.95}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      ) : null}
      {!webgl2 && markings ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} renderOrder={2}>
          <planeGeometry args={[LINES_W, LINES_H]} />
          <meshStandardMaterial
            map={markings}
            color="#c9cec6"
            transparent
            roughness={0.92}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      ) : null}
      {quality !== "baixa" && <GrassField sim={sim} quality={quality} webgl2={webgl2} />}
      {quality !== "baixa" && <PitchMarks sim={sim} />}
      {quality !== "baixa" && wet > 0.72 ? <Puddles wet={wet} /> : null}
      <Goal side={1} quality={quality} sim={sim} />
      <Goal side={-1} quality={quality} sim={sim} />
      <CornerFlags sim={sim} webgl2={webgl2} />
    </group>
  );
}

/**
 * Chuva e neve: partículas instanciadas que caem num volume em volta da
 * câmera, inclinadas pelo vento. Nada de física — só movimento contínuo com
 * recolocação ao chegar ao chão, o que mantém o custo baixíssimo.
 */
