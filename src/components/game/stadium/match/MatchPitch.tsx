import {
  useQualityPressure,
  useRuntimeSceneBudget,
} from "@/components/game/runtime-budget-context";

import { resolveRuntimeSceneBudget } from "@/game/runtime-scene-budget";
import { censusRef } from "@/game/scene-census";

import { Puddles } from "@/components/game/stadium/Puddles";

import { GoalNetPanel } from "@/components/game/stadium/GoalNet";

import { GrassChunks } from "@/components/game/stadium/GrassChunks";
import { createGrassBladeMaterial } from "@/game/grass-material";
import { createPitchSurfaceMaterial } from "@/game/pitch-material";

import { useFrame } from "@react-three/fiber";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  grassAlbedo,
  grassMowPreview,
  grassNormal,
  grassMicroRoughness,
  grassRoughness,
  retainGrassMaps,
  type MowPattern,
} from "@/components/game/stadium/textures/grass";

import { LINES_H, LINES_W, pitchLinesTexture } from "@/components/game/stadium/textures/lines";
import { pitchWearTexture } from "@/components/game/stadium/textures/wear";

import { FIELD_X, FIELD_Z } from "@/game/sim-rules";
import { type SimView } from "@/game/sim-types";

import { useResolvedVisual, useVisual } from "@/game/visual-settings";
import {
  ktx2,
  needsKtx2ProceduralFallback,
  requestKtx2,
  useKtx2Revision,
} from "@/game/textures/ktx2";

import { presentationBall, type Quality } from "./shared";
function useBladeMaterial(color: string, webgl2: boolean) {
  const data = useMemo(() => createGrassBladeMaterial(color, { webgl2 }), [color, webgl2]);
  return { mat: data.material, uniforms: data.uniforms };
}

function GrassField({ sim, quality, webgl2 }: { sim: SimView; quality: Quality; webgl2: boolean }) {
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
function PitchMarks({ sim }: { sim: SimView }) {
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
  // The precompiled albedo is the default checker cut; retain procedural maps
  // for custom mowing patterns and all low-end/offline devices.
  const compressed = quality !== "baixa";
  const grassVariant = mow === "checker" ? "grassAlbedo" : (`grass_${mow}_albedo` as const);
  const textureRevision = useKtx2Revision([
    grassVariant,
    "grassNormal",
    "grassRough",
    "grassDetailRough",
  ]);
  useEffect(() => {
    if (compressed && grassVariant !== "grassAlbedo") requestKtx2([grassVariant]);
  }, [compressed, grassVariant]);
  const tex = useMemo(() => {
    // A newly decoded map invalidates the procedural fallback.
    void textureRevision;
    const compressedMap = compressed ? ktx2(grassVariant) : null;
    // The 1024px procedural pitch is a main-thread startup spike. The solid
    // material remains readable while an immutable KTX2 request is live.
    return (
      compressedMap ??
      (!compressed || needsKtx2ProceduralFallback(grassVariant)
        ? grassAlbedo(mow)
        : grassMowPreview(mow))
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
  // Authored micro-blades only: no broad relief that tints the broadcast pitch.
  // Avoid spawning a second turf worker while compressed maps are in flight.
  const norm = useMemo(() => {
    void textureRevision;
    if (!compressed) return null;
    return (
      ktx2("grassNormal") ?? (needsKtx2ProceduralFallback("grassNormal") ? grassNormal(mow) : null)
    );
  }, [compressed, mow, textureRevision]);
  const microRoughness = useMemo(() => {
    void textureRevision;
    if (quality !== "alta") return null;
    return (
      ktx2("grassDetailRough") ??
      (needsKtx2ProceduralFallback("grassDetailRough") ? grassMicroRoughness() : null)
    );
  }, [quality, textureRevision]);
  const normalScale = useMemo(
    () => new THREE.Vector2(quality === "alta" ? 0.22 : 0.14, quality === "alta" ? 0.22 : 0.14),
    [quality],
  );
  const wear = useMemo(() => (quality === "baixa" ? null : pitchWearTexture()), [quality]);

  // Tom e desgaste do gramado escolhidos em /visual (global ou por clube).
  const vis = useResolvedVisual(sim.home.clubId);
  const tint = useMemo(() => {
    const k = 1 - vis.grassTint * 0.35; // >1 clareia, <1 escurece
    // Retain the club's tint control while giving the turf a cooler chlorophyll
    // base; daylight no longer washes the mower stripes into a yellow carpet.
    return new THREE.Color(k * 0.91, k * 0.98, k * 0.94);
  }, [vis.grassTint]);
  // A textura de desgaste mantém fibras e zonas de uso, mas nunca deve virar
  // uma camada de lama em uma partida seca vista da transmissão.
  const wearOpacity = 0.012 + vis.grassWear * 0.11;
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
      <mesh
        name="pitch-underlay"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.04, 0]}
        receiveShadow
      >
        <planeGeometry args={[FIELD_X * 2 + 34, FIELD_Z * 2 + 30]} />
        <meshStandardMaterial color="#124a2a" roughness={1} />
      </mesh>
      <mesh name="pitch-surface" rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
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
      <Goal side={1} quality={quality} sim={sim} wet={wet} />
      <Goal side={-1} quality={quality} sim={sim} wet={wet} />
      <CornerFlags sim={sim} webgl2={webgl2} />
    </group>
  );
}

/**
 * Chuva e neve: partículas instanciadas que caem num volume em volta da
 * câmera, inclinadas pelo vento. Nada de física — só movimento contínuo com
 * recolocação ao chegar ao chão, o que mantém o custo baixíssimo.
 */
function netTexture() {
  if (typeof document === "undefined") return null;
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  const step = s / 8;
  for (let i = -8; i <= 16; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step + s, s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step - s, s);
    ctx.stroke();
  }
  // nós nos cruzamentos
  ctx.fillStyle = "#ffffff";
  for (let a = 0; a <= 8; a++) {
    for (let b = 0; b <= 8; b++) {
      ctx.beginPath();
      ctx.arc(a * step, b * step, 2.6, 0, 7);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function useNetMaterial(repeatX: number, repeatY: number, high = false) {
  const textureRevision = useKtx2Revision();
  const material = useMemo(() => {
    void textureRevision;
    const alpha = (high ? ktx2("netMask")?.clone() : null) ?? netTexture();
    const mat = new THREE.MeshStandardMaterial({
      color: "#f4f8ff",
      normalMap: high ? ktx2("net_normal") : null,
      normalScale: new THREE.Vector2(0.1, 0.1),
      roughnessMap: high ? ktx2("net_rough") : null,
      roughness: 0.82,
      metalness: 0,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      opacity: 0.95,
    });
    if (alpha) {
      alpha.repeat.set(repeatX, repeatY);
      mat.alphaMap = alpha;
      mat.alphaTest = 0.32;
    } else {
      mat.opacity = 0.2;
    }
    return mat;
  }, [repeatX, repeatY, high, textureRevision]);
  useEffect(
    () => () => {
      // Each net owns its cloned mask; the KTX2 cache retains the source map.
      material.alphaMap?.dispose();
      material.dispose();
    },
    [material],
  );
  return material;
}

function Goal({
  side,
  quality,
  sim,
  wet,
}: {
  side: number;
  quality: Quality;
  sim: SimView;
  wet: number;
}) {
  const x = side * FIELD_X;
  const backMat = useNetMaterial(14, 5, quality === "alta");
  const sideMat = useNetMaterial(4, 5, quality === "alta");
  const topMat = useNetMaterial(4, 14, quality === "alta");
  const postMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#fdfdfd", roughness: 0.34, metalness: 0.025 }),
    [],
  );
  useEffect(() => () => postMaterial.dispose(), [postMaterial]);
  // trave viva: bola raspando poste/travessão treme a estrutura e pisca
  const frame = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Mesh>(null);
  const pulse = useRef(0);
  const cool = useRef(0);
  useFrame((_, rawDt) => {
    const g = frame.current;
    const f = flash.current;
    if (!g || !f) return;
    const dt = Math.min(rawDt, 0.05);
    cool.current = Math.max(0, cool.current - dt);
    const b = presentationBall(sim);
    const dx = Math.abs(b.x - x);
    const nearPost = Math.abs(Math.abs(b.z) - 3.66);
    const nearBar = Math.hypot(Math.abs(b.z) > 3.66 ? Math.abs(b.z) - 3.66 : 0, b.height - 2.44);
    const speed = Math.hypot(b.vx, b.vz);
    if (cool.current <= 0 && dx < 1.4 && b.height < 3.1 && speed > 4) {
      if (nearPost < 0.5 || nearBar < 0.45) {
        pulse.current = 1;
        cool.current = 1.2;
      }
    }
    if (pulse.current > 0) {
      pulse.current = Math.max(0, pulse.current - dt * 2.4);
      const s = pulse.current;
      g.position.x = Math.sin(s * 42) * 0.07 * s;
      g.position.z = Math.sin(s * 35) * 0.06 * s;
      f.visible = true;
      f.position.set(b.x - x, 1.2 + b.height * 0.5, b.z);
      f.scale.setScalar(1 + (1 - s) * 1.6);
      (f.material as THREE.MeshBasicMaterial).opacity = 0.5 * s;
    } else if (g.position.x !== 0 || g.position.z !== 0) {
      g.position.x = 0;
      g.position.z = 0;
      f.visible = false;
    }
  });
  return (
    <group position={[x, 0, 0]} ref={censusRef("goal")}>
      <mesh ref={flash} visible={false}>
        <sphereGeometry args={[0.7, 12, 12]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <group ref={frame}>
        {[-3.66, 3.66].map((z) => (
          <group key={z}>
            <mesh position={[0, 1.22, z]} material={postMaterial} castShadow={quality === "alta"}>
              <cylinderGeometry args={[0.06, 0.06, 2.44, 16]} />
            </mesh>
            <mesh
              position={[side * 1.05, 0.62, z]}
              rotation={[0, 0, side * 0.9]}
              material={postMaterial}
            >
              <cylinderGeometry args={[0.035, 0.035, 2.2, 8]} />
            </mesh>
          </group>
        ))}
        <mesh
          position={[0, 2.44, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          material={postMaterial}
          castShadow={quality === "alta"}
        >
          <cylinderGeometry args={[0.06, 0.06, 7.32, 16]} />
        </mesh>
        <mesh
          position={[side * 1.9, 0.05, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          material={postMaterial}
        >
          <cylinderGeometry args={[0.04, 0.04, 7.32, 10]} />
        </mesh>
        {/* rede: fundo (com barriga), laterais e teto */}
        <GoalNetPanel side={side} sim={sim} material={backMat} quality={quality} wet={wet} />
        <GoalNetPanel
          side={side}
          sim={sim}
          material={sideMat}
          quality={quality}
          face="left"
          wet={wet}
        />
        <GoalNetPanel
          side={side}
          sim={sim}
          material={sideMat}
          quality={quality}
          face="right"
          wet={wet}
        />
        <GoalNetPanel
          side={side}
          sim={sim}
          material={topMat}
          quality={quality}
          face="roof"
          wet={wet}
        />
      </group>
    </group>
  );
}

function CornerFlags({ sim, webgl2 }: { sim: SimView; webgl2: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const uTime = useRef({ value: 0 });
  const uAmp = useRef({ value: 0.16 });
  // tecido compartilhado: ondula no vértice, com fase pela posição no mundo
  // (cada escanteio tremula diferente) e amplitude crescendo para a ponta
  const cloth = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: "#f5c400",
      side: THREE.DoubleSide,
      roughness: 0.8,
    });
    if (webgl2)
      m.onBeforeCompile = (shader) => {
        shader.uniforms["uTime"] = uTime.current;
        shader.uniforms["uAmp"] = uAmp.current;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nuniform float uTime;\nuniform float uAmp;",
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
           float cphase = modelMatrix[3].x * 0.5 + modelMatrix[3].z * 0.5;
           transformed.z += sin(uTime * 6.0 + cphase + position.x * 8.0) * uAmp * (position.x + 0.275);`,
          );
      };
    return m;
  }, [webgl2]);
  useEffect(() => () => cloth.dispose(), [cloth]);
  useFrame(({ clock }) => {
    uTime.current.value = clock.elapsedTime;
    const gust =
      0.75 + 0.25 * Math.sin(clock.elapsedTime * 0.9) + 0.12 * Math.sin(clock.elapsedTime * 2.7);
    const wind = sim.wind?.strength01 ?? 0.25;
    uAmp.current.value = (0.015 + wind * 0.2) * gust;
    const g = ref.current;
    if (!g) return;
    g.children.forEach((c, i) => {
      c.rotation.y = Math.atan2(-(sim.wind?.z ?? 0.55), sim.wind?.x ?? 0.83);
      c.rotation.z = Math.sin(clock.elapsedTime * 2.4 + i) * wind * 0.035;
    });
  });
  return (
    <group ref={ref}>
      {[
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ].map(([sx, sz], i) => (
        <group key={i} position={[sx! * FIELD_X, 0, sz! * FIELD_Z]}>
          <mesh position={[0, 0.75, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 1.5, 6]} />
            <meshStandardMaterial color="#f5f5f5" />
          </mesh>
          <mesh position={[0.28, 1.32, 0]} material={cloth}>
            <planeGeometry args={[0.55, 0.35, 8, 3]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* -------------------------------------------------------------- estrutura */

/**
 * Placas de LED: uma faixa contínua por linha lateral, com a textura
 * rolando na horizontal (como um painel de LED de transmissão real).
 */
