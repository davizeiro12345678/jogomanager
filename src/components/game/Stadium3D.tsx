import {
  RuntimeBudget,
  QualityPressure,
  RuntimeSceneBudgetContext,
  useQualityPressure,
  useRuntimeSceneBudget,
} from "@/components/game/RuntimeBudget";
import { GRAPHICS_PROFILES } from "@/game/contracts/graphics-profile";
import { resolveRuntimeSceneBudget } from "@/game/runtime-scene-budget";
import { censusRef } from "@/game/scene-census";
import { broadcastInterest, ShotHold } from "@/game/broadcast-interest";
import { StaticBatch } from "@/components/game/stadium/StaticBatch";
import { GoalNetPanel } from "@/components/game/stadium/GoalNet";
import { footballTextures } from "@/components/game/stadium/textures/ball";
import { BallResponse } from "@/game/ball-response";
import { GrassChunks } from "@/components/game/stadium/GrassChunks";
import { createGrassBladeMaterial } from "@/game/grass-material";
import { createPitchSurfaceMaterial } from "@/game/pitch-material";
import { ArenaArchitecture } from "@/components/game/stadium/ArenaArchitecture";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, AdaptiveEvents, Trail } from "@react-three/drei";
import { easing } from "maath";
import { createNoise2D } from "simplex-noise";
import type React from "react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { FrameProbe } from "@/components/game/FrameProbe";
import { PerfPanel } from "@/components/game/PerfPanel";
import { GraphicsBoundary } from "@/components/game/GraphicsBoundary";
import { MatchPlayers } from "@/components/game/players/MatchPlayers";
import { OfficialRig } from "@/components/game/players/OfficialRig";
import { CrowdLod } from "@/components/game/stadium/CrowdLod";
import { PostFX } from "@/components/game/post/LazyPostFX";
import { createWebGPURenderer, detectWebGPU, type GpuBackend } from "@/components/game/renderer";
import { adTexture } from "@/components/game/stadium/textures/ads";
import {
  concreteAlbedo,
  concreteRoughness,
  seatsTexture,
} from "@/components/game/stadium/textures/concrete";
import {
  grassAlbedo,
  grassNormal,
  grassRoughness,
  type MowPattern,
} from "@/components/game/stadium/textures/grass";

import { LINES_H, LINES_W, pitchLinesTexture } from "@/components/game/stadium/textures/lines";
import { pitchWearTexture, wearRoughness } from "@/components/game/stadium/textures/wear";
import { skyTexture } from "@/components/game/stadium/textures/sky";
import { lightGlowTexture } from "@/components/game/stadium/textures/light-glow";
import {
  bannerTexture,
  bigFlagTexture,
  mosaicTexture,
} from "@/components/game/stadium/textures/tifo";
import { StadiumProps } from "@/components/game/stadium/Props";

import { dprFor, higherQuality, lowerQuality } from "@/game/device";
import { cameraOption, type CameraMode } from "@/game/camera-modes";
import { kitFor, gkKitFor, skinFor, hairFor, colorClash, type Kit } from "@/game/kits";
import { Atmosphere } from "@/components/game/stadium/Atmosphere";
import { AmbientLife } from "@/components/game/stadium/AmbientLife";
import { CrowdReaction } from "@/components/game/stadium/CrowdReaction";
import type { SupporterMatchday } from "@/game/career-world-types";
import { BenchLife } from "@/components/game/stadium/BenchLife";
import { SidelineLife } from "@/components/game/stadium/SidelineLife";
import { PitchResponse } from "@/components/game/stadium/PitchResponse";
import { MatchSurfaceProvider } from "@/game/graphics/surface-context";
import { GradeLut } from "@/components/game/post/GradeLut";
import type { GradeWeather } from "@/game/graphics/grade";
import { FIELD_X, FIELD_Z, type SimView, type SimPlayer } from "@/game/sim";
import { matchLook, type TimeOfDay, type Weather } from "@/game/matchday";
import { useResolvedVisual, useVisual } from "@/game/visual-settings";
import { initKtx2, ktx2, requestKtx2, useKtx2Revision } from "@/game/textures/ktx2";

export type { CameraMode } from "@/game/camera-modes";
export type Quality = "alta" | "media" | "baixa";
const SHADOW_SETTINGS = { type: THREE.PCFShadowMap };

const SKY: Record<TimeOfDay, string> = {
  dia: "#8fbfe8",
  entardecer: "#4a3630",
  noite: "#060a10",
};

/**
 * A física visual pode enriquecer o voo, o quique e o contato da bola sem
 * participar da simulação canônica. Replays antigos e o caminho sem Rapier
 * continuam apresentando a própria bola da partida.
 */
const FPS_RING = 180 * 60;

function presentationBall(sim: SimView) {
  return sim.visualBall ?? sim.ball;
}

/* ---------------------------------------------------------------- gramado */

/** Tufos de grama instanciados perto das linhas laterais (só na qualidade alta). */
/**
 * Fibras de grama instanciadas com vento no vertex shader: nada é atualizado
 * na CPU por quadro, então dá para colocar dezenas de milhares de folhas.
 * A bola amassa a grama num raio curto ao passar.
 */
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
      maxVisibleChunks={budget.grassChunks}
    />
  );
}
/**
 * Marcas de pisada e rastro de deslize: um pool de manchas escuras deixadas
 * pela bola e pelos jogadores, que desbotam com o tempo.
 */
function PitchMarks({ sim }: { sim: SimView }) {
  const COUNT = 90;
  const ref = useRef<THREE.InstancedMesh>(null);
  const slots = useRef(Array.from({ length: COUNT }, () => ({ x: 0, z: 0, life: 0, s: 1, r: 0 })));
  const next = useRef(0);
  const timer = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, rawDt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(rawDt, 0.05);
    timer.current += dt;

    // deixa marcas onde os jogadores mais rápidos pisam
    if (timer.current > 0.12) {
      timer.current = 0;
      for (const p of sim.players) {
        const sp = Math.hypot(p.vx, p.vz);
        if (sp < 0.55) continue;
        const slot = slots.current[next.current % COUNT]!;
        next.current += 1;
        slot.x = p.x;
        slot.z = p.z;
        slot.life = 1;
        slot.s = 0.18 + Math.min(0.25, sp * 0.15);
        slot.r = Math.atan2(p.vx, p.vz);
      }
    }

    for (let i = 0; i < COUNT; i++) {
      const s = slots.current[i]!;
      if (s.life > 0) s.life = Math.max(0, s.life - dt * 0.4);
      dummy.position.set(s.x, 0.012, s.z);
      dummy.rotation.set(-Math.PI / 2, 0, -s.r);
      const k = s.life > 0 ? s.s : 0.0001;
      dummy.scale.set(k * 0.5, k, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} frustumCulled={false} args={[undefined, undefined, COUNT]}>
      <circleGeometry args={[0.5, 8]} />
      <meshBasicMaterial color="#0d3a1f" transparent opacity={0.08} depthWrite={false} />
    </instancedMesh>
  );
}

function Pitch({
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
    return (
      (compressed &&
      (mow === "checker" || mow === "stripes" || mow === "diagonal" || mow === "wide")
        ? ktx2(grassVariant)
        : null) ?? grassAlbedo(mow)
    );
  }, [mow, compressed, grassVariant, textureRevision]);
  const rough = useMemo(() => {
    void textureRevision;
    return (compressed ? ktx2("grassRough") : null) ?? grassRoughness(mow);
  }, [mow, compressed, textureRevision]);
  // Keep broad relief out of the field normals; it reads as cool blue blotches
  // from the high broadcast camera. The fine procedural blade detail remains.
  const norm = useMemo(() => (quality === "baixa" ? null : grassNormal(mow)), [quality, mow]);
  const normalScale = useMemo(
    () => new THREE.Vector2(quality === "alta" ? 0.18 : 0.12, quality === "alta" ? 0.18 : 0.12),
    [quality],
  );
  const wear = useMemo(() => (quality === "baixa" ? null : pitchWearTexture()), [quality]);
  const wearRough = useMemo(() => (quality === "alta" ? wearRoughness() : null), [quality]);

  // Tom e desgaste do gramado escolhidos em /visual (global ou por clube).
  const vis = useResolvedVisual(sim.home.clubId);
  const tint = useMemo(() => {
    const k = 1 - vis.grassTint * 0.35; // >1 clareia, <1 escurece
    return new THREE.Color(k, k, k);
  }, [vis.grassTint]);
  const wearOpacity = 0.1 + vis.grassWear * 0.48;
  const markings = useMemo(pitchLinesTexture, []);
  const surface = useMemo(
    () =>
      createPitchSurfaceMaterial({
        albedo: tex,
        roughness: wearRough ?? rough,
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
      wearRough,
      rough,
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
      {quality !== "baixa" && wet > 0.75 ? <Puddles wet={wet} /> : null}
      <Goal side={1} quality={quality} sim={sim} />
      <Goal side={-1} quality={quality} sim={sim} />
      <CornerFlags sim={sim} webgl2={webgl2} />
    </group>
  );
}

/** Poças espelhadas no gramado encharcado, sempre nos mesmos pontos. */
function Puddles({ wet }: { wet: number }) {
  const spots = useMemo(() => {
    const out: { x: number; z: number; rx: number; rz: number }[] = [];
    let s = 0x9e37;
    const r = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < 6; i++) {
      out.push({
        x: (r() * 2 - 1) * FIELD_X * 0.95,
        z: (r() * 2 - 1) * FIELD_Z * 0.95,
        rx: 0.5 + r() * 1.1,
        rz: 0.35 + r() * 0.7,
      });
    }
    return out;
  }, []);
  return (
    <group>
      {spots.map((p, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[p.x, 0.014, p.z]}
          scale={[p.rx, p.rz, 1]}
          renderOrder={3}
        >
          <circleGeometry args={[1, 20]} />
          <meshPhysicalMaterial
            color="#123b2a"
            roughness={0.06}
            metalness={0.1}
            clearcoat={1}
            clearcoatRoughness={0.05}
            transparent
            opacity={0.1 + wet * 0.12}
            depthWrite={false}
            envMapIntensity={1.6}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Chuva e neve: partículas instanciadas que caem num volume em volta da
 * câmera, inclinadas pelo vento. Nada de física — só movimento contínuo com
 * recolocação ao chegar ao chão, o que mantém o custo baixíssimo.
 */
function Weather({
  weather,
  wind,
  quality,
  density = 1,
}: {
  weather: "seco" | "molhado" | "chuva" | "neve";
  wind: number;
  quality: Quality;
  density?: number;
}) {
  const rain = weather === "chuva";
  const snow = weather === "neve";
  const partScale = useVisual().particles;
  const count = Math.max(
    0,
    Math.round(
      (quality === "alta" ? (rain ? 2600 : 1500) : rain ? 1100 : 700) * partScale * density,
    ),
  );
  const material = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const base = rain ? new THREE.PlaneGeometry(0.03, 0.85) : new THREE.CircleGeometry(0.05, 5);
    const offsets = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phases = new Float32Array(count);
    // Stable seeded distribution prevents hydration/re-entry changes and lets
    // the GPU animate every particle without a matrix upload each frame.
    let seed = count * 2654435761;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      offsets[i * 3] = (random() * 2 - 1) * (FIELD_X + 26);
      offsets[i * 3 + 1] = random() * 36;
      offsets[i * 3 + 2] = (random() * 2 - 1) * (FIELD_Z + 24);
      speeds[i] = 0.6 + random() * 0.9;
      phases[i] = random() * Math.PI * 2;
    }
    base.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 3));
    base.setAttribute("aSpeed", new THREE.InstancedBufferAttribute(speeds, 1));
    base.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
    return base;
  }, [count, rain]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWind: { value: wind },
      uRain: { value: rain ? 1 : 0 },
      uColor: { value: new THREE.Color(rain ? "#cfe6ff" : "#ffffff") },
      uOpacity: { value: rain ? 0.35 : 0.8 },
    }),
    [rain, wind],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    if (!material.current) return;
    material.current.uniforms["uTime"]!.value = clock.elapsedTime;
    material.current.uniforms["uWind"]!.value = wind;
  });

  if (!rain && !snow) return null;

  return (
    <instancedMesh frustumCulled={false} args={[geometry, undefined, count]}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        vertexShader={/* glsl */ `
          attribute vec3 aOffset;
          attribute float aSpeed;
          attribute float aPhase;
          uniform float uTime;
          uniform float uWind;
          uniform float uRain;
          void main() {
            float fall = mix(2.4, 34.0, uRain);
            float cycle = 36.0;
            vec3 world = position;
            if (uRain > 0.5) {
              float tilt = uWind * 0.28;
              mat2 rotation = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt));
              world.xy = rotation * world.xy;
            } else {
              world.y *= 0.5;
            }
            float spanX = ${(FIELD_X + 26) * 2}.0;
            world.x += mod(aOffset.x + uWind * uTime * mix(1.6, 5.0, uRain) + spanX, spanX) - spanX * 0.5;
            world.y += mod(aOffset.y - uTime * fall * aSpeed + cycle * 64.0, cycle);
            world.z += aOffset.z + (1.0 - uRain) * sin(aPhase + world.y * 0.4 + uTime) * 0.42;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
          uniform vec3 uColor;
          uniform float uOpacity;
          void main() {
            gl_FragColor = vec4(uColor, uOpacity);
          }
        `}
      />
    </instancedMesh>
  );
}

/**
 * Marcação do campo pintada: um plano com a textura de cal por cima do
 * gramado. Substitui as antigas linhas de 1 pixel, que serrilhavam e
 * pareciam desenho técnico.
 */
/** Rede em losango, com nós — usada como alphaMap (recorte real, não plano leitoso). */
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
      roughness: 0.65,
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

function Goal({ side, quality, sim }: { side: number; quality: Quality; sim: SimView }) {
  const x = side * FIELD_X;
  const backMat = useNetMaterial(14, 5, quality === "alta");
  const sideMat = useNetMaterial(4, 5, quality === "alta");
  const topMat = useNetMaterial(4, 14, quality === "alta");
  const post = <meshStandardMaterial color="#fdfdfd" roughness={0.22} metalness={0.08} />;
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
            <mesh position={[0, 1.22, z]} castShadow={quality === "alta"}>
              <cylinderGeometry args={[0.06, 0.06, 2.44, 16]} />
              {post}
            </mesh>
            {/* suporte traseiro da rede */}
            <mesh position={[side * 1.05, 0.62, z]} rotation={[0, 0, side * 0.9]}>
              <cylinderGeometry args={[0.035, 0.035, 2.2, 8]} />
              {post}
            </mesh>
          </group>
        ))}
        <mesh
          position={[0, 2.44, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow={quality === "alta"}
        >
          <cylinderGeometry args={[0.06, 0.06, 7.32, 16]} />
          {post}
        </mesh>
        {/* barras traseiras horizontais */}
        <mesh position={[side * 1.9, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 7.32, 10]} />
          {post}
        </mesh>
        {/* rede: fundo (com barriga), laterais e teto */}
        <GoalNetPanel side={side} sim={sim} material={backMat} quality={quality} />
        <GoalNetPanel side={side} sim={sim} material={sideMat} quality={quality} face="left" />
        <GoalNetPanel side={side} sim={sim} material={sideMat} quality={quality} face="right" />
        <GoalNetPanel side={side} sim={sim} material={topMat} quality={quality} face="roof" />
      </group>
    </group>
  );
}

const windNoise = createNoise2D(() => 0.4242);

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
    // rajadas orgânicas: 1 amostra de ruído por quadro (custo desprezível)
    const gust = 0.8 + 0.35 * windNoise(clock.elapsedTime * 0.45, 0);
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
function AdBoards({ homeColor, awayColor }: { homeColor: string; awayColor: string }) {
  const sponsors = useVisual().sponsors;
  const key = sponsors.join(",");
  const tex = useMemo(
    () => adTexture(homeColor, awayColor, key ? key.split(",") : []),
    [homeColor, awayColor, key],
  );
  const matA = useRef<THREE.MeshStandardMaterial>(null);
  const matB = useRef<THREE.MeshStandardMaterial>(null);
  const len = (FIELD_X + 8) * 2;

  const texA = useMemo(() => {
    if (!tex) return null;
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(3, 1);
    return t;
  }, [tex]);
  const texB = useMemo(() => {
    if (!tex) return null;
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(3, 1);
    t.offset.x = 0.5;
    return t;
  }, [tex]);

  useFrame((_, delta) => {
    if (texA) texA.offset.x = (texA.offset.x + delta * 0.05) % 1;
    if (texB) texB.offset.x = (texB.offset.x - delta * 0.05 + 1) % 1;
    // leve cintilar do painel
    const flick = 0.5 + Math.random() * 0.06;
    if (matA.current) matA.current.emissiveIntensity = flick;
    if (matB.current) matB.current.emissiveIntensity = flick;
  });

  if (!texA || !texB) return null;

  return (
    <group>
      {[
        { z: -(FIELD_Z + 5), rot: 0, m: matA, t: texA },
        { z: FIELD_Z + 5, rot: Math.PI, m: matB, t: texB },
      ].map((s, i) => (
        <mesh key={i} position={[0, 0.62, s.z]} rotation={[0, s.rot, 0]}>
          <boxGeometry args={[len, 1.24, 0.22]} />
          <meshStandardMaterial
            ref={s.m}
            map={s.t}
            emissiveMap={s.t}
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={0.5}
            roughness={0.35}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Telão atualizado no máximo cinco vezes por segundo, sem worker de fontes. */
function Scoreboard({
  sim,
  replay,
  goalPulse,
}: {
  sim: SimView;
  replay: boolean;
  goalPulse: React.MutableRefObject<number>;
}) {
  const board = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 320;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return { canvas, texture, last: "" };
  }, []);
  const tick = useRef(0);
  useFrame(({ clock }) => {
    if (!board || ++tick.current % 12 !== 0) return;
    const possessionTotal = sim.stats.home.possessionTicks + sim.stats.away.possessionTicks;
    const homePossession =
      possessionTotal > 0
        ? Math.round((sim.stats.home.possessionTicks / possessionTotal) * 100)
        : 50;
    // flash de gol: alterna o fundo 4x por segundo enquanto o pulso está alto
    const celebrating = goalPulse.current > 0.45;
    const flash = celebrating ? Math.floor(clock.elapsedTime * 4) % 2 : 0;
    const key = `${sim.home.short}|${sim.stats.home.goals}|${sim.stats.away.goals}|${sim.away.short}|${sim.minute()}|${replay}|${homePossession}|${sim.stats.home.shots}|${sim.stats.away.shots}|${flash}`;
    if (board.last === key) return;
    board.last = key;
    const ctx = board.canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, board.canvas.width, board.canvas.height);
    ctx.fillStyle = celebrating ? (flash ? "#7a1016" : "#3d080d") : replay ? "#5f151b" : "#07140d";
    ctx.fillRect(0, 0, board.canvas.width, board.canvas.height);
    ctx.fillStyle = "#25e77f";
    ctx.fillRect(0, 0, board.canvas.width, 12);
    ctx.fillRect(0, board.canvas.height - 12, board.canvas.width, 12);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "700 30px sans-serif";
    ctx.fillStyle = replay ? "#ffb3ba" : "#39f18b";
    ctx.fillText(replay ? "REPLAY" : "AO VIVO", 42, 48);
    ctx.textAlign = "right";
    ctx.fillStyle = "#9eb8aa";
    ctx.font = "600 26px sans-serif";
    ctx.fillText(`${sim.minute()}'`, 982, 48);
    ctx.textAlign = "center";
    ctx.font = "700 92px sans-serif";
    ctx.fillStyle = "#eafff2";
    ctx.fillText(
      `${sim.home.short}  ${sim.stats.home.goals} — ${sim.stats.away.goals}  ${sim.away.short}`,
      512,
      132,
    );
    ctx.font = "700 30px sans-serif";
    if (celebrating) {
      ctx.fillStyle = flash ? "#ffffff" : "#ffd76a";
      ctx.font = "800 44px sans-serif";
      ctx.fillText("★ GOOOL! ★", 512, 232);
      ctx.font = "700 30px sans-serif";
    } else {
      ctx.fillStyle = replay ? "#ffd2d5" : "#ffd76a";
      ctx.fillText(
        `${homePossession}% POSSE  ·  ${sim.stats.home.shots}–${sim.stats.away.shots} CHUTES`,
        512,
        232,
      );
    }
    ctx.fillStyle = "#2de67e";
    ctx.fillRect(42, 272, 940 * (homePossession / 100), 12);
    ctx.fillStyle = "#4c6a79";
    ctx.fillRect(42 + 940 * (homePossession / 100), 272, 940 * (1 - homePossession / 100), 12);
    board.texture.needsUpdate = true;
  });
  useEffect(() => () => board?.texture.dispose(), [board]);
  return (
    <group position={[0, 22, -(FIELD_Z + 26)]}>
      <mesh>
        <boxGeometry args={[30, 11, 1]} />
        <meshStandardMaterial color="#0b0e12" roughness={0.55} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.55]}>
        <planeGeometry args={[28.6, 9.6]} />
        <meshStandardMaterial color="#04070b" emissive="#0a1a12" emissiveIntensity={0.5} />
      </mesh>
      {/* moldura luminosa do painel */}
      <mesh position={[0, 4.9, 0.56]}>
        <boxGeometry args={[29.2, 0.22, 0.05]} />
        <meshBasicMaterial color="#1de07a" toneMapped={false} />
      </mesh>
      <mesh position={[0, -4.9, 0.56]}>
        <boxGeometry args={[29.2, 0.22, 0.05]} />
        <meshBasicMaterial color="#1de07a" toneMapped={false} />
      </mesh>
      {/* O placar DOM concentra os dados. O painel físico continua emissivo,
          sem gerar atlas de fonte/worker dentro do caminho crítico da partida. */}
      {board ? (
        <mesh position={[0, 0, 0.62]}>
          <planeGeometry args={[28.2, 8.9]} />
          <meshBasicMaterial map={board.texture} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function Floodlights({ time, quality }: { time: TimeOfDay; quality: Quality }) {
  const on = time !== "dia";
  const lampColor = time === "entardecer" ? "#ffe2c7" : "#e8f2ff";
  const haloColor = time === "entardecer" ? "#ffd1aa" : "#cfe3ff";
  const spots: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  const lamps = [-2.6, -0.9, 0.9, 2.6];
  return (
    <StaticBatch signature={`floodlights:${time}:${quality}`}>
      {spots.map(([sx, sz], i) => {
        const px = sx * (FIELD_X + 20);
        const pz = sz * (FIELD_Z + 22);
        const dist = Math.hypot(px, pz);
        return (
          <group key={i} position={[px, 0, pz]}>
            {/* mastro treliçado */}
            <mesh position={[0, 14, 0]} castShadow>
              <cylinderGeometry args={[0.5, 0.9, 28, 8]} />
              <meshStandardMaterial color="#252c33" roughness={0.85} metalness={0.35} />
            </mesh>
            {[0, 1, 2, 3].map((k) => (
              <mesh key={k} position={[0, 6 + k * 6, 0]}>
                <torusGeometry args={[0.85, 0.07, 4, 10]} />
                <meshStandardMaterial color="#39424b" roughness={0.8} metalness={0.4} />
              </mesh>
            ))}
            {/* rack com lâmpadas individuais */}
            <mesh position={[0, 28.5, 0]}>
              <boxGeometry args={[8.6, 3.6, 0.6]} />
              <meshStandardMaterial color="#39424b" roughness={0.8} metalness={0.4} />
            </mesh>
            {lamps.map((lx) =>
              [0.85, -0.85].map((ly) => (
                <mesh key={`${lx}${ly}`} position={[lx, 28.5 + ly, 0.45]}>
                  <boxGeometry args={[1.5, 1.3, 0.3]} />
                  <meshStandardMaterial
                    color="#f5f8ff"
                    emissive={on ? lampColor : "#2b3138"}
                    emissiveIntensity={on ? (time === "entardecer" ? 2.8 : 3.6) : 0}
                    toneMapped={false}
                  />
                </mesh>
              )),
            )}
            {on && (
              <>
                {/* halo volumétrico curto, apenas em volta do rack */}
                {quality === "alta" && (
                  <mesh position={[0, 26, 0]} rotation={[Math.PI, 0, 0]}>
                    <coneGeometry args={[5.5, 9, 14, 1, true]} />
                    <meshBasicMaterial
                      color={haloColor}
                      transparent
                      opacity={0.05}
                      depthWrite={false}
                      side={THREE.DoubleSide}
                      blending={THREE.AdditiveBlending}
                      toneMapped={false}
                    />
                  </mesh>
                )}

                <sprite position={[0, 28.5, 0]} scale={[30, 30, 1]}>
                  <spriteMaterial
                    map={lightGlowTexture()}
                    color={haloColor}
                    opacity={time === "entardecer" ? 0.14 : 0.18}
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                    toneMapped={false}
                  />
                </sprite>
                {quality === "alta" && (
                  <pointLight
                    position={[0, 28, 0]}
                    intensity={time === "entardecer" ? 1250 : 1700}
                    distance={230}
                    color={lampColor}
                  />
                )}
              </>
            )}
          </group>
        );
      })}
      {/* reflexo dos refletores no gramado úmido: discreto, colado nos cantos */}
      {on &&
        quality === "alta" &&
        spots.map(([sx, sz], i) => (
          <mesh
            key={`r${i}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[sx * (FIELD_X * 0.86), 0.02, sz * (FIELD_Z * 0.86)]}
          >
            <circleGeometry args={[10, 20]} />
            <meshBasicMaterial
              color="#9fc4ff"
              transparent
              opacity={0.02}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        ))}
    </StaticBatch>
  );
}

/** Concreto compartilhado por toda a estrutura (um material só, muitas peças). */
function useConcrete(color = "#6d747b", repeat = 6, high = false) {
  const textureRevision = useKtx2Revision();
  const material = useMemo(() => {
    void textureRevision;
    const map = (high ? ktx2("concreteAlbedo") : null) ?? concreteAlbedo();
    const rough = (high ? ktx2("concreteRough") : null) ?? concreteRoughness();
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.96,
      metalness: 0.02,
    });
    if (map) {
      const t = map.clone();
      t.needsUpdate = true;
      t.repeat.set(repeat, repeat * 0.4);
      m.map = t;
    }
    if (rough) {
      const t = rough.clone();
      t.needsUpdate = true;
      t.repeat.set(repeat, repeat * 0.4);
      m.roughnessMap = t;
    }
    return m;
  }, [color, repeat, high, textureRevision]);
  useEffect(
    () => () => {
      material.map?.dispose();
      material.roughnessMap?.dispose();
      material.dispose();
    },
    [material],
  );
  return material;
}

function Tiers({
  rings,
  homeColor,
  awayColor,
  high,
}: {
  rings: number;
  homeColor: string;
  awayColor: string;
  high: boolean;
}) {
  const steps: React.ReactElement[] = [];
  const lenX = FIELD_X * 2 + 30;
  const lenZ = FIELD_Z * 2 + 34;
  const concrete = useConcrete("#5f666d", 10, high);

  const seatMat = useMemo(() => {
    const t = seatsTexture(homeColor, awayColor);
    const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.82 });
    if (t) {
      const c = t.clone();
      c.needsUpdate = true;
      // Cada degrau já representa uma fileira. Repetir as doze fileiras da
      // textura em 1,2 m criava listras escuras e moiré à distância.
      c.repeat.set(14, 0.12);
      m.map = c;
    } else {
      m.color = new THREE.Color(homeColor);
    }
    return m;
  }, [homeColor, awayColor]);
  const seatMatSide = useMemo(() => {
    const c = seatMat.clone();
    if (c.map) {
      const t = c.map.clone();
      t.needsUpdate = true;
      t.repeat.set(10, 0.12);
      c.map = t;
    }
    return c;
  }, [seatMat]);

  for (let r = 0; r < rings; r++) {
    const y = 2.0 + r * 1.45;
    for (const z of [-1, 1]) {
      steps.push(
        <mesh
          key={`sz${r}${z}`}
          position={[0, y - 0.72, z * (FIELD_Z + 7 + r * 1.5)]}
          receiveShadow
          material={concrete}
        >
          <boxGeometry args={[lenX, 1.45, 1.5]} />
        </mesh>,
      );
      // faixa de cadeiras na frente do degrau
      steps.push(
        <mesh
          key={`cz${r}${z}`}
          position={[0, y - 0.6, z * (FIELD_Z + 7 + r * 1.5 - 0.78)]}
          rotation={[0, z > 0 ? Math.PI : 0, 0]}
          material={seatMat}
        >
          <planeGeometry args={[lenX, 1.2]} />
        </mesh>,
      );
    }
    for (const x of [-1, 1]) {
      steps.push(
        <mesh
          key={`sx${r}${x}`}
          position={[x * (FIELD_X + 10 + r * 1.5), y - 0.72, 0]}
          receiveShadow
          material={concrete}
        >
          <boxGeometry args={[1.5, 1.45, lenZ]} />
        </mesh>,
      );
      steps.push(
        <mesh
          key={`cx${r}${x}`}
          position={[x * (FIELD_X + 10 + r * 1.5 - 0.78), y - 0.6, 0]}
          rotation={[0, x > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}
          material={seatMatSide}
        >
          <planeGeometry args={[lenZ, 1.2]} />
        </mesh>,
      );
    }
  }

  // corrimãos verticais separando os setores (sem invadir o campo)
  const stairs: React.ReactElement[] = [];
  for (let i = -3; i <= 3; i++) {
    for (const z of [-1, 1]) {
      stairs.push(
        <mesh
          key={`v${i}${z}`}
          position={[i * 24, 2.0 + (rings * 1.45) / 2, z * (FIELD_Z + 8 + (rings * 1.5) / 2)]}
          rotation={[z > 0 ? -0.76 : 0.76, 0, 0]}
          material={concrete}
        >
          <boxGeometry args={[1.1, 0.1, rings * 1.9]} />
        </mesh>,
      );
    }
  }

  return (
    <StaticBatch signature={`tiers:${rings}:${homeColor}:${awayColor}`}>
      {steps}
      {stairs}
    </StaticBatch>
  );
}

function Roof({ rings }: { rings: number }) {
  const outer = 9 + rings * 1.5;
  const depth = 12;
  const height = 2.0 + rings * 1.45 + 7;
  const trusses: React.ReactElement[] = [];
  for (let i = -6; i <= 6; i++) {
    for (const z of [-1, 1]) {
      trusses.push(
        <mesh key={`tz${i}${z}`} position={[i * 13, height - 2.2, z * (FIELD_Z + outer)]}>
          <boxGeometry args={[0.5, 4.4, 0.5]} />
          <meshStandardMaterial color="#5a6672" roughness={0.7} metalness={0.35} />
        </mesh>,
      );
      // diagonal de contraventamento
      trusses.push(
        <mesh
          key={`dz${i}${z}`}
          position={[i * 13 + 6.5, height - 1.2, z * (FIELD_Z + outer)]}
          rotation={[0, 0, 0.9]}
        >
          <boxGeometry args={[0.22, 12, 0.22]} />
          <meshStandardMaterial color="#6b7783" roughness={0.6} metalness={0.4} />
        </mesh>,
      );
    }
  }
  for (let i = -4; i <= 4; i++) {
    for (const x of [-1, 1]) {
      trusses.push(
        <mesh key={`tx${i}${x}`} position={[x * (FIELD_X + outer), height - 2.2, i * 14]}>
          <boxGeometry args={[0.5, 4.4, 0.5]} />
          <meshStandardMaterial color="#5a6672" roughness={0.7} metalness={0.35} />
        </mesh>,
      );
    }
  }
  return (
    <StaticBatch signature={`roof:${rings}`}>
      {trusses}
      {[-1, 1].map((z) => (
        <group key={`rz${z}`}>
          <mesh position={[0, height, z * (FIELD_Z + outer + depth / 2 - 2)]}>
            <boxGeometry args={[FIELD_X * 2 + 36, 0.6, depth]} />
            <meshStandardMaterial color="#4b5661" roughness={0.75} metalness={0.25} />
          </mesh>
          {/* forro iluminado por baixo */}
          <mesh
            position={[0, height - 0.42, z * (FIELD_Z + outer + depth / 2 - 2)]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[FIELD_X * 2 + 34, depth - 1]} />
            <meshStandardMaterial
              color="#20272e"
              emissive="#8fb6d8"
              emissiveIntensity={0.18}
              roughness={0.9}
            />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((x) => (
        <group key={`rx${x}`}>
          <mesh position={[x * (FIELD_X + outer + depth / 2 - 2), height, 0]}>
            <boxGeometry args={[depth, 0.6, FIELD_Z * 2 + 40]} />
            <meshStandardMaterial color="#4b5661" roughness={0.75} metalness={0.25} />
          </mesh>
          <mesh
            position={[x * (FIELD_X + outer + depth / 2 - 2), height - 0.42, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[depth - 1, FIELD_Z * 2 + 38]} />
            <meshStandardMaterial
              color="#20272e"
              emissive="#8fb6d8"
              emissiveIntensity={0.18}
              roughness={0.9}
            />
          </mesh>
        </group>
      ))}
      {/* cantos fechados: o estádio deixa de ter buracos nas quinas */}
      {[
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ].map(([sx, sz], i) => (
        <mesh
          key={`c${i}`}
          position={[sx! * (FIELD_X + outer + 2), height, sz! * (FIELD_Z + outer + 2)]}
          rotation={[0, (sx! * sz! * Math.PI) / 4, 0]}
        >
          <boxGeometry args={[26, 0.6, depth]} />
          <meshStandardMaterial color="#49545f" roughness={0.8} metalness={0.2} />
        </mesh>
      ))}
    </StaticBatch>
  );
}

/**
 * Faixas de torcida organizada e mosaico de cartolinas dos setores atrás
 * dos gols — o que se vê primeiro numa panorâmica de transmissão.
 */
function Banners({ color, alt, rings }: { color: string; alt: string; rings: number }) {
  const words = ["torcida fiel", "aqui é nosso", "amor eterno", "raça e paixão"];
  const banners = useMemo(
    () =>
      words.map((w, i) => bannerTexture(w, i % 2 === 0 ? color : alt, i % 2 === 0 ? alt : color)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [color, alt],
  );
  const mosaic = useMemo(() => mosaicTexture(color, alt), [color, alt]);
  const top = 2.0 + rings * 1.45;

  return (
    <group>
      {/* faixas presas na grade da primeira fila */}
      {banners.map((t, i) =>
        t ? (
          <mesh key={`b${i}`} position={[(i - 1.5) * 26, 2.2, -(FIELD_Z + 6.4)]}>
            <planeGeometry args={[18, 2.2]} />
            <meshStandardMaterial map={t} roughness={0.92} side={THREE.DoubleSide} />
          </mesh>
        ) : null,
      )}
      {banners.map((t, i) =>
        t ? (
          <mesh
            key={`bb${i}`}
            position={[(i - 1.5) * 26, 2.2, FIELD_Z + 6.4]}
            rotation={[0, Math.PI, 0]}
          >
            <planeGeometry args={[18, 2.2]} />
            <meshStandardMaterial map={t} roughness={0.92} side={THREE.DoubleSide} />
          </mesh>
        ) : null,
      )}
      {/* mosaico atrás de cada gol, ocupando a altura do anel */}
      {mosaic
        ? [-1, 1].map((x) => (
            <mesh
              key={`m${x}`}
              position={[x * (FIELD_X + 11), top * 0.55 + 2, 0]}
              rotation={[0, x > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}
            >
              <planeGeometry args={[FIELD_Z * 1.6, Math.max(6, top * 0.7)]} />
              <meshStandardMaterial
                map={mosaic}
                roughness={0.95}
                transparent
                opacity={0.85}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))
        : null}
    </group>
  );
}

/**
 * Massa de torcida para planos abertos. As arquibancadas continuam com degraus
 * físicos e espectadores próximos 3D; esta camada resolve o detalhe que o
 * olho lê à distância em só quatro superfícies, sem milhares de meshes.
 */
function crowdBackdropTexture(homeColor: string, awayColor: string) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "rgba(9, 15, 20, 0.88)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const neutral = ["#d6dbe0", "#55708c", "#d1b36e", "#80909e", "#adbac4"];
  let seed = 0x9e3779b9;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  const rows = 20;
  const columns = 86;
  for (let row = 0; row < rows; row++) {
    const y = 5 + row * 16 + random() * 2;
    for (let col = 0; col < columns; col++) {
      const x = 3 + col * 12 + random() * 2;
      const sector = col / columns;
      const shirt =
        sector < 0.3
          ? homeColor
          : sector > 0.82
            ? awayColor
            : neutral[(row * 3 + col) % neutral.length]!;
      const height = 7 + random() * 5;
      ctx.fillStyle = shirt;
      ctx.fillRect(x, y + 5, 8 + random() * 2, height);
      ctx.fillStyle = ["#f0c9a5", "#d79d70", "#9b603a", "#70401f"][Math.floor(random() * 4)]!;
      ctx.beginPath();
      ctx.arc(x + 4.5, y + 3.5, 3 + random() * 0.8, 0, Math.PI * 2);
      ctx.fill();
      // cabeças, braços e bandeiras não ficam regulares como um grid de UI
      if (random() > 0.91) {
        ctx.fillStyle = shirt;
        ctx.fillRect(x - 1, y - 6 - random() * 12, 1.5, 11 + random() * 8);
        ctx.fillRect(x, y - 6 - random() * 12, 9, 5);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  // Cada lateral usa uma proporção diferente. Os UVs dos painéis repetem a
  // mesma textura sem duplicá-la, então a silhueta permanece humana em vez de
  // virar uma faixa horizontal quando ocupa uma arquibancada longa.
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

const CROWD_BACKDROP_TEXTURE_ASPECT = 1024 / 320;

/**
 * O painel longitudinal é muito mais largo que o canvas de torcedores.
 * Repetir somente o U com base na proporção do painel corrige a leitura dos
 * espectadores em planos abertos, sem criar outro material, textura ou draw.
 */
function crowdBackdropGeometry(width: number, height: number) {
  const geometry = new THREE.PlaneGeometry(width, height);
  const repeatX = Math.max(1, Math.round(width / height / CROWD_BACKDROP_TEXTURE_ASPECT));
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  for (let index = 0; index < uv.count; index++) uv.setX(index, uv.getX(index) * repeatX);
  uv.needsUpdate = true;
  return geometry;
}

function CrowdBackdrop({
  homeColor,
  awayColor,
  rings,
  occupancy = 1,
}: {
  homeColor: string;
  awayColor: string;
  rings: number;
  occupancy?: number;
}) {
  const texture = useMemo(() => crowdBackdropTexture(homeColor, awayColor), [homeColor, awayColor]);
  useEffect(() => () => texture?.dispose(), [texture]);
  const height = Math.max(9, rings * 1.45 + 0.6);
  // Dois buffers compartilhados entre quatro painéis: a mesma cobertura de
  // arquibancada, com o mesmo orçamento de quatro draws.
  const longitudinalGeometry = useMemo(
    () => crowdBackdropGeometry(FIELD_X * 2 + 24, height),
    [height],
  );
  const endGeometry = useMemo(() => crowdBackdropGeometry(FIELD_Z * 2 + 18, height), [height]);
  if (!texture) return null;
  const y = 1.9 + height * 0.5;
  // Os degraus finais são volumes opacos. A massa de silhuetas fica alguns
  // centímetros para dentro deles: assim ela fica visível acima das cadeiras
  // sem aparecer através da estrutura quando a câmera muda de lado.
  const zEdge = FIELD_Z + 6 + (rings - 1) * 1.5;
  const xEdge = FIELD_X + 9 + (rings - 1) * 1.5;
  return (
    <group renderOrder={1}>
      {[-1, 1].map((z) => (
        <mesh
          key={`crowd-z-${z}`}
          geometry={longitudinalGeometry}
          position={[0, y, z * zEdge]}
          rotation={[0, z > 0 ? Math.PI : 0, 0]}
        >
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={0.9 * occupancy}
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {[-1, 1].map((x) => (
        <mesh
          key={`crowd-x-${x}`}
          geometry={endGeometry}
          position={[x * xEdge, y, 0]}
          rotation={[0, x > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}
        >
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={0.84 * occupancy}
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function Stands({
  homeColor,
  awayColor,
  quality,
  goalPulse,
  night,
  supporters,
  sim,
  webgl2,
}: {
  sim: SimView;
  homeColor: string;
  awayColor: string;
  quality: Quality;
  goalPulse: React.MutableRefObject<number>;
  night: boolean;
  supporters?: SupporterMatchday | undefined;
  webgl2: boolean;
}) {
  const vis = useVisual();
  const pressure = useQualityPressure();
  const budget = useRuntimeSceneBudget();
  const occupancy = supporters?.occupancy ?? 1;
  const crowdBudget = useMemo(
    () => ({ ...budget, crowdInstances: Math.round(budget.crowdInstances * occupancy) }),
    [budget, occupancy],
  );
  const maximumDensity = quality === "alta" ? 460 : quality === "media" ? 240 : 100;
  const rings = Math.min(quality === "alta" ? 14 : quality === "media" ? 9 : 5, budget.propRings);
  // Keep enough source people to fill visible tiles, without allocating the
  // former 20k-person global crowd before the renderer can cull it.
  const sourceDensity = Math.max(
    32,
    Math.ceil((budget.crowdInstances * 1.8) / Math.max(1, rings * 3.2)),
  );
  const density = Math.round(
    Math.min(maximumDensity, sourceDensity) * Math.max(0.1, vis.crowdDensity),
  );
  const wallMat = useConcrete("#39424b", 14, quality === "alta");

  const crowd = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const colors: THREE.Color[] = [];
    const skins: THREE.Color[] = [];
    const home = new THREE.Color(homeColor);
    const homeAlt = new THREE.Color(homeColor).offsetHSL(0, -0.1, 0.14);
    const away = new THREE.Color(awayColor);
    const neutral = ["#d8d8d8", "#8fa3b8", "#42506b", "#e0c07a", "#b8c4cf", "#6c7a8c"].map(
      (c) => new THREE.Color(c),
    );
    const skinTones = ["#e8b98f", "#d19b6d", "#a9713f", "#7a4b26", "#f2cfa8", "#5c3418"];
    const pick = (i: number, ring: number) =>
      new THREE.Color(skinTones[(i * 5 + ring * 3) % skinTones.length]!);

    /** Setores: a torcida se agrupa em blocos, como num estádio de verdade.
     *  Cada bloco tem uma cor dominante e uma minoria de camisas neutras. */
    const SECTORS = 14;
    const sectorColor = (sector: number, side: number) => {
      const s = (sector + (side > 0 ? 0 : 7)) % SECTORS;
      if (s < 3) return home; // arquibancada organizada mandante
      if (s === 3 || s === 10) return homeAlt; // bloco do terceiro uniforme
      if (s >= 11) return away; // setor visitante
      return neutral[s % neutral.length]!;
    };
    const shirtFor = (sector: number, side: number, i: number, ring: number) => {
      const dominant = sectorColor(sector, side);
      // 22% de torcedores fora do padrão do setor, para o bloco não ficar chapado
      if ((i * 13 + ring * 7) % 9 < 2) return neutral[(i + ring) % neutral.length]!;
      return dominant;
    };

    for (let ring = 0; ring < rings; ring++) {
      for (let i = 0; i < density; i++) {
        const t = i / density;
        const px = -FIELD_X - 10 + t * (FIELD_X * 2 + 20);
        if ([-36, 0, 36].some((aisle) => Math.abs(px - aisle) < 0.88)) continue;
        const sector = Math.floor(t * SECTORS);
        for (const zSide of [-1, 1]) {
          positions.push(
            new THREE.Vector3(
              px + ((i * 7 + ring * 3) % 5) * 0.06,
              2.8 + ring * 1.45,
              zSide * (FIELD_Z + 7 + ring * 1.5),
            ),
          );
          colors.push(shirtFor(sector, zSide, i, ring));
          skins.push(pick(i, ring));
        }
      }
    }
    for (let ring = 0; ring < rings; ring++) {
      const n = Math.round(density * 0.6);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const pz = -FIELD_Z - 8 + t * (FIELD_Z * 2 + 16);
        if ([-24, 24].some((aisle) => Math.abs(pz - aisle) < 0.88)) continue;
        const sector = Math.floor(t * SECTORS);
        for (const xSide of [-1, 1]) {
          positions.push(
            new THREE.Vector3(xSide * (FIELD_X + 10 + ring * 1.5), 2.8 + ring * 1.45, pz),
          );
          // atrás do gol mandante: mosaico em faixas alternadas
          const mosaic =
            xSide === 1
              ? (ring + Math.floor(t * 9)) % 3 === 0
                ? new THREE.Color("#f2f2f2")
                : home
              : shirtFor(sector, xSide, i, ring);
          colors.push(mosaic);
          skins.push(pick(i + 3, ring));
        }
      }
    }
    return { positions, colors, skins };
  }, [homeColor, awayColor, density, rings]);

  return (
    <group>
      {/* muro externo (atrás das arquibancadas) */}
      {[-1, 1].map((z) => (
        <mesh key={z} position={[0, 6, z * (FIELD_Z + 9 + rings * 1.5)]} material={wallMat}>
          <boxGeometry args={[FIELD_X * 2 + 34, 12, 2]} />
        </mesh>
      ))}
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x * (FIELD_X + 12 + rings * 1.5), 6, 0]} material={wallMat}>
          <boxGeometry args={[2, 12, FIELD_Z * 2 + 36]} />
        </mesh>
      ))}

      <Tiers rings={rings} homeColor={homeColor} awayColor={awayColor} high={quality === "alta"} />
      <Roof rings={rings} />
      {quality !== "baixa" ? (
        <ArenaArchitecture rings={rings} color={homeColor} night={night} />
      ) : null}
      <CrowdBackdrop
        homeColor={homeColor}
        awayColor={awayColor}
        rings={rings}
        occupancy={occupancy}
      />
      <Banners color={homeColor} alt={awayColor} rings={rings} />
      <CrowdFlags
        sim={sim}
        color={homeColor}
        alt={awayColor}
        rings={rings}
        count={budget.flagCount}
        webgl2={webgl2}
      />

      <CrowdLod
        crowd={crowd}
        pulse={goalPulse}
        budget={crowdBudget}
        supporters={supporters}
        webgl2={webgl2}
      />
    </group>
  );
}

/**
 * Bandeirões da torcida: planos com ondulação no vertex shader, espalhados
 * pelas arquibancadas nas cores dos dois clubes.
 */
function CrowdFlags({
  sim,
  color,
  alt,
  rings,
  count,
  webgl2,
}: {
  color: string;
  alt: string;
  rings: number;
  count: number;
  sim: SimView;
  webgl2: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const uTime = useRef({ value: 0 });
  const uWind = useRef({ value: 0.3 });
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const flags = useMemo(() => {
    const out: { pos: [number, number, number]; rot: number; c: string; s: number }[] = [];
    for (let i = 0; i < count; i++) {
      const behind = i % 2 === 0;
      const ring = 1 + ((i * 3) % Math.max(1, rings - 1));
      const t = ((i * 37) % 100) / 100;
      const y = 3.4 + ring * 1.45;
      if (behind) {
        const zSide = i % 4 < 2 ? -1 : 1;
        out.push({
          pos: [-FIELD_X - 8 + t * (FIELD_X * 2 + 16), y, zSide * (FIELD_Z + 7 + ring * 1.5)],
          rot: zSide > 0 ? Math.PI : 0,
          c: t < 0.45 ? color : alt,
          s: 0.8 + (i % 3) * 0.35,
        });
      } else {
        const xSide = i % 4 < 2 ? -1 : 1;
        out.push({
          pos: [xSide * (FIELD_X + 10 + ring * 1.5), y, -FIELD_Z - 6 + t * (FIELD_Z * 2 + 12)],
          rot: xSide > 0 ? -Math.PI / 2 : Math.PI / 2,
          c: xSide > 0 ? color : alt,
          s: 0.8 + (i % 4) * 0.3,
        });
      }
    }
    return out;
  }, [count, rings, color, alt]);

  const geometry = useMemo(() => new THREE.PlaneGeometry(2.4, 1.5, 12, 6), []);
  const material = useMemo(() => {
    const value = new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0,
      vertexColors: true,
    });
    if (webgl2)
      value.onBeforeCompile = (shader) => {
        shader.uniforms["uTime"] = uTime.current;
        shader.uniforms["uWind"] = uWind.current;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nuniform float uTime; uniform float uWind;",
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
           float phase = instanceMatrix[3].x * 0.17 + instanceMatrix[3].z * 0.13;
           float wave = sin(uTime * 2.2 + phase + position.x * 3.0) * 0.12
                      + sin(uTime * 3.7 + phase + position.y * 2.0) * 0.05;
           transformed.z += wave * uWind * smoothstep(-1.2, 1.2, position.x);`,
          );
      };
    return value;
  }, [webgl2]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    flags.forEach((flag, index) => {
      dummy.position.set(...flag.pos);
      dummy.rotation.set(0, flag.rot, 0);
      dummy.scale.set(flag.s, flag.s, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, new THREE.Color(flag.c));
    });
    mesh.count = flags.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
  }, [dummy, flags]);

  useFrame(({ clock }) => {
    uTime.current.value = clock.elapsedTime;
    uWind.current.value =
      (0.12 + (sim.wind?.strength01 ?? 0.25) * 1.6) *
      (0.75 + 0.25 * Math.sin(clock.elapsedTime * 0.9));
  });

  if (!count) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, Math.max(1, count)]}
      frustumCulled={false}
    />
  );
}

/* --------------------------------------------------------------- jogadores */

function Ball({
  sim,
  quality,
  hiVis = false,
  wet = 0,
}: {
  sim: SimView;
  quality: Quality;
  hiVis?: boolean;
  wet?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const puff = useRef<THREE.Mesh>(null);
  const prevH = useRef(0.12);
  const spray = useRef(0);
  const textures = useMemo(footballTextures, []);
  const response = useMemo(() => new BallResponse(), []);
  const previous = useRef<{
    x: number;
    z: number;
    height: number;
    vx: number;
    vz: number;
    vy: number;
  } | null>(null);
  const axis = useMemo(() => new THREE.Vector3(), []);
  const squashAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const orientation = useMemo(() => new THREE.Quaternion(), []);
  const worldScale = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const visualBall = presentationBall(sim);
    const delta = Math.min(Math.max(0, dt), 0.05);
    const snap =
      !previous.current || Math.hypot(visualBall.x - m.position.x, visualBall.z - m.position.z) > 4;
    const blend = snap ? 1 : 1 - Math.exp(-42 * delta);
    m.position.x += (visualBall.x - m.position.x) * blend;
    m.position.z += (visualBall.z - m.position.z) * blend;
    // The simulation exposes height of the centre, including the ball radius.
    m.position.y = Math.max(0.12, visualBall.height);
    const prior = previous.current;
    const verticalVelocity =
      sim.visualBall?.vy ?? (prior && delta > 0 ? (visualBall.height - prior.height) / delta : 0);
    if (prior && !snap) {
      const kick = Math.hypot(visualBall.vx - prior.vx, visualBall.vz - prior.vz);
      const bounce = prior.vy < -0.6 && verticalVelocity >= 0 && visualBall.height < 0.35;
      if (bounce) {
        response.impact(Math.abs(prior.vy));
        squashAxis.set(0, 1, 0);
      } else if (kick > 3.5) {
        response.impact(kick);
        squashAxis.set(visualBall.vx - prior.vx, 0, visualBall.vz - prior.vz).normalize();
      }
    }
    const sp = Math.hypot(visualBall.vx, visualBall.vz);
    if (sp > 0.03 && !snap) {
      axis.set(visualBall.vz, 0, -visualBall.vx).normalize();
      const rolling = visualBall.height <= 0.2;
      m.rotateOnWorldAxis(axis, Math.min(90, sp / 0.12) * delta * (rolling ? 1 : 0.35));
      if (!rolling) m.rotateOnWorldAxis(axis.set(0, 1, 0), (sim.visualBall?.spin ?? 0) * delta);
    }
    const scale = response.step(delta);
    // Convert the collision normal to mesh-local coordinates so spin does not
    // rotate the flattening plane away from the foot or the ground.
    orientation.copy(m.quaternion).invert();
    worldScale.copy(squashAxis).applyQuaternion(orientation);
    m.scale.set(
      scale.radial + (scale.axial - scale.radial) * worldScale.x ** 2,
      scale.radial + (scale.axial - scale.radial) * worldScale.y ** 2,
      scale.radial + (scale.axial - scale.radial) * worldScale.z ** 2,
    );
    if (!previous.current)
      previous.current = {
        x: visualBall.x,
        z: visualBall.z,
        height: visualBall.height,
        vx: visualBall.vx,
        vz: visualBall.vz,
        vy: verticalVelocity,
      };
    else Object.assign(previous.current, visualBall, { vy: verticalVelocity });
    const s = shadow.current;
    if (s) {
      s.position.set(m.position.x, 0.015, m.position.z);
      const k = Math.max(0.35, 1 - visualBall.height * 0.25);
      s.scale.setScalar(k);
      (s.material as THREE.MeshBasicMaterial).opacity = 0.36 * k;
    }
    // respingo: quicada no gramado molhado levanta água
    const p = puff.current;
    if (p) {
      if (wet > 0.5 && prevH.current > 0.35 && visualBall.height <= 0.16) spray.current = 1;
      prevH.current = visualBall.height;
      if (spray.current > 0) {
        spray.current = Math.max(0, spray.current - dt * 3);
        p.visible = true;
        p.position.set(m.position.x, 0.06, m.position.z);
        p.scale.setScalar(0.3 + (1 - spray.current) * 1.4);
        (p.material as THREE.MeshBasicMaterial).opacity = 0.4 * spray.current;
      } else if (p.visible) {
        p.visible = false;
      }
    }
  });
  const ball = (
    <mesh ref={ref} castShadow={quality === "alta"} position={[0, 0.13, 0]}>
      <sphereGeometry args={[0.12, quality === "alta" ? 40 : 24, quality === "alta" ? 32 : 16]} />
      <meshStandardMaterial
        map={textures?.map ?? null}
        bumpMap={quality === "baixa" ? null : (textures?.bumpMap ?? null)}
        bumpScale={0.0012}
        roughnessMap={textures?.roughnessMap ?? null}
        // bola de alta visibilidade na neve; molhada reflete mais a luz
        color={hiVis ? "#f2ff45" : "#ffffff"}
        roughness={0.65 - wet * 0.27}
        metalness={0}
        envMapIntensity={0.8 + wet * 0.8}
      />
    </mesh>
  );
  return (
    <group ref={censusRef("ball")}>
      {/* rastro de velocidade (meshline) em chutes fortes — só média/alta */}
      {quality === "baixa" ? (
        ball
      ) : (
        <Trail width={1.1} length={5.5} color="#dff2ff" attenuation={(t) => t * t}>
          {ball}
        </Trail>
      )}
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.18, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.36} />
      </mesh>
      <mesh ref={puff} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.12, 0.3, 20]} />
        <meshBasicMaterial color="#cfe6ff" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ câmera */

/**
 * Diretor de câmera.
 *
 * Em vez de um único enquadramento seguindo a bola (que treme e cansa), a cena
 * tem um repertório de planos de transmissão. O diretor escolhe o plano pelo
 * contexto do lance, respeita um tempo mínimo em cada corte e evita repetir o
 * mesmo enquadramento em sequência. O amortecimento é por tempo real, com zona
 * morta ao redor da bola, o que elimina o tremor de alta frequência.
 */
type ShotId =
  | "wide"
  | "drone"
  | "skycam"
  | "lowline"
  | "sideline"
  | "duel"
  | "playercam"
  | "tower"
  | "netcam"
  | "stand"
  | "crane"
  | "celebration"
  | "orbit";

type Framing = {
  px: number;
  py: number;
  pz: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

/** Contexto simples do lance usado para escolher o plano. */
type ShotContext = {
  bx: number;
  bz: number;
  speed: number;
  height: number;
  attackDir: number; // +1 ataca para +X
  pulse: number;
  nearGoal: number; // 0..1 proximidade da grande área
  holder: SimPlayer | null;
  heading: number;
};

function framingFor(id: ShotId, c: ShotContext, t: number): Framing {
  const { bx, bz, attackDir, holder, heading } = c;
  switch (id) {
    case "skycam": {
      const sweep = Math.sin(t * 0.21) * 7;
      return {
        px: bx * 0.56 - attackDir * 10,
        py: 64 + Math.sin(t * 0.34) * 2.4,
        pz: bz * 0.34 + sweep,
        lx: bx + attackDir * 4,
        ly: 0.7,
        lz: bz * 0.78,
        fov: 34,
      };
    }
    case "drone":
      return {
        px: bx - attackDir * 26,
        py: 20 + c.height * 0.4,
        pz: bz * 0.6 + 16,
        lx: bx + attackDir * 6,
        ly: 1 + Math.min(3, c.height * 0.5),
        lz: bz * 0.7,
        fov: 46,
      };
    case "crane": {
      const arc = t * 0.18;
      return {
        px: bx - attackDir * 12 + Math.sin(arc) * 4.2,
        py: 11.5 + Math.cos(arc * 1.3) * 1.4,
        pz: bz * 0.5 + 13 + Math.cos(arc) * 2.4,
        lx: bx + attackDir * 2.8,
        ly: 1.05 + Math.min(1.8, c.height * 0.35),
        lz: bz * 0.76,
        fov: 37,
      };
    }
    case "sideline": {
      const side = bz >= 0 ? 1 : -1;
      return {
        px: bx * 0.88 - attackDir * 2.5,
        py: 3.65,
        pz: side * (FIELD_Z + 7.5),
        lx: bx + attackDir * 3.6,
        ly: 1.15 + Math.min(1.4, c.height * 0.34),
        lz: bz,
        fov: 39,
      };
    }
    case "lowline":
      return {
        px: bx * 0.7,
        py: 3.2,
        pz: FIELD_Z + 9,
        lx: bx,
        ly: 1.2 + c.height * 0.4,
        lz: bz,
        fov: 40,
      };
    case "duel":
      return {
        px: bx - attackDir * 9,
        py: 4.4,
        pz: bz + 11,
        lx: bx,
        ly: 1.5 + c.height * 0.5,
        lz: bz,
        fov: 34,
      };
    case "playercam": {
      const focusX = holder?.x ?? bx;
      const focusZ = holder?.z ?? bz;
      const forwardX = Math.sin(heading);
      const forwardZ = Math.cos(heading);
      return {
        px: focusX - forwardX * 7.2 + forwardZ * 1.15,
        py: 2.45,
        pz: focusZ - forwardZ * 7.2 - forwardX * 1.15,
        lx: focusX + forwardX * 3.2,
        ly: 1.18 + Math.min(1.2, c.height * 0.3),
        lz: focusZ + forwardZ * 3.2,
        fov: 41,
      };
    }
    case "tower":
      return {
        px: bx * 0.25,
        py: 58,
        pz: FIELD_Z + 28,
        lx: bx * 0.5,
        ly: 0.8,
        lz: bz * 0.5,
        fov: 44,
      };
    case "netcam":
      return {
        px: (FIELD_X + 6) * attackDir,
        py: 6.5,
        pz: bz * 0.35,
        lx: bx,
        ly: 1.4 + c.height * 0.6,
        lz: bz,
        fov: 38,
      };
    case "stand": {
      const side = bz >= 0 ? 1 : -1;
      return {
        px: bx * 0.58,
        py: 13.5,
        pz: side * (FIELD_Z + 20),
        lx: bx * 0.72,
        ly: 1,
        lz: bz * 0.78,
        fov: 40,
      };
    }
    case "celebration":
      return {
        px: bx + Math.cos(t * 0.5) * 11,
        py: 3.6,
        pz: bz + Math.sin(t * 0.5) * 11,
        lx: bx,
        ly: 1.7,
        lz: bz,
        fov: 33,
      };
    case "orbit": {
      const a = t * 0.35;
      return {
        px: bx + Math.cos(a) * 17,
        py: 7.5,
        pz: bz + Math.sin(a) * 17,
        lx: bx,
        ly: 1.2,
        lz: bz,
        fov: 36,
      };
    }
    case "wide":
    default:
      return {
        px: bx * 0.55,
        py: 44,
        pz: FIELD_Z + 42,
        lx: bx * 0.6,
        ly: 0.9 + Math.min(2.4, c.height * 0.5),
        lz: bz * 0.6,
        fov: 42,
      };
  }
}

/** Planos manuais: o jogador escolheu um enquadramento fixo, o diretor obedece. */
const MANUAL_SHOT: Partial<Record<CameraMode, ShotId>> = {
  broadcast: "wide",
  tactical: "tower",
  goal: "netcam",
  fan: "stand",
  rail: "lowline",
  behind: "drone",
  cinematic: "crane",
  player: "playercam",
  sideline: "sideline",
  skycam: "skycam",
};

/** Tempo mínimo em cada plano (s) — impede corte nervoso. */
const SHOT_MIN_TIME: Record<ShotId, number> = {
  wide: 4.5,
  drone: 3.5,
  skycam: 4,
  lowline: 3,
  sideline: 3.2,
  duel: 2.2,
  playercam: 2.6,
  tower: 5,
  netcam: 2.6,
  stand: 4.2,
  crane: 4.4,
  celebration: 2.4,
  orbit: 2.6,
};

function Rig({
  sim,
  mode,
  goalPulse,
}: {
  sim: SimView;
  mode: CameraMode;
  goalPulse: React.MutableRefObject<number>;
}) {
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const smoothLook = useMemo(() => new THREE.Vector3(0, 0.8, 0), []);
  const anchor = useMemo(() => new THREE.Vector2(), []); // bola com zona morta
  const hold = useRef(new ShotHold<ShotId>("wide"));
  const state = useRef({ shot: "wide" as ShotId, since: 0, prev: "wide" as ShotId, cut: 0 });

  useFrame(({ camera, clock }, dtRaw) => {
    const dt = Math.min(0.05, dtRaw); // trava picos de frame para não dar solavanco
    const s = state.current;
    s.since += dt;
    s.cut = Math.max(0, s.cut - dt);

    const visualBall = presentationBall(sim);
    const speed = Math.hypot(visualBall.vx, visualBall.vz);
    const interest = broadcastInterest(sim);
    const lead = interest.lead / 0.18;
    const rawX = visualBall.x + visualBall.vx * 0.18 * lead;
    const rawZ = visualBall.z + visualBall.vz * 0.18 * lead;
    // zona morta: só move o alvo quando a bola sai de um raio pequeno
    const dead = 0.9;
    const dx = rawX - anchor.x;
    const dz = rawZ - anchor.y;
    const dist = Math.hypot(dx, dz);
    if (dist > dead) {
      const k = (dist - dead) / dist;
      anchor.x += dx * k;
      anchor.y += dz * k;
    }

    const pulse = goalPulse.current;
    const attackDir = sim.possession === "home" ? 1 : -1;
    const nearGoal = Math.min(
      1,
      Math.max(0, (Math.abs(anchor.x) - FIELD_X * 0.45) / (FIELD_X * 0.55)),
    );
    const holder = sim.players.find((player) => player.id === sim.ball.holder) ?? null;
    const holderSpeed = holder ? Math.hypot(holder.vx, holder.vz) : 0;
    const heading =
      holder && holderSpeed > 0.3
        ? Math.atan2(holder.vx, holder.vz)
        : Math.atan2(visualBall.vx || attackDir, visualBall.vz || 0);
    const ctx: ShotContext = {
      bx: anchor.x,
      bz: anchor.y,
      speed,
      height: visualBall.height,
      attackDir,
      pulse,
      nearGoal,
      holder,
      heading,
    };

    const manual = mode !== "broadcast" ? MANUAL_SHOT[mode] : undefined;
    // O modo broadcast escolhe planos com intenção editorial. Cada condição
    // tem uma composição própria; o ShotHold impede cortes frenéticos quando a
    // bola cruza o meio-campo ou o simulador oscila entre dois limiares.
    let want: ShotId;
    if (manual) {
      want = manual;
    } else if (mode === "director") {
      // Diretor cinematográfico: alterna planos com uma lógica editorial
      // determinística. A ordem evita câmera de jogador em bola aérea e mantém
      // os cortes interessantes sem perder a leitura tática da jogada.
      if (pulse > 0.88) {
        want = "celebration";
      } else if (pulse > 0.5) {
        want = s.prev === "netcam" ? "orbit" : "netcam";
      } else if (interest.danger > 0.78 && speed > 11) {
        want = "netcam";
      } else if (ctx.height > 4.2 || interest.counter || speed > 17) {
        want = "skycam";
      } else if (interest.nearby >= 3 && speed < 6.2) {
        want = "playercam";
      } else if (ctx.nearGoal > 0.46) {
        want = "sideline";
      } else if (s.since > 10) {
        want = s.shot === "crane" ? "orbit" : s.shot === "orbit" ? "sideline" : "crane";
      } else {
        want = "crane";
      }
    } else if (pulse > 0.88) {
      want = "celebration";
    } else if (pulse > 0.5) {
      want = s.prev === "netcam" ? "orbit" : "netcam";
    } else if (interest.counter) {
      want = s.shot === "drone" ? "lowline" : "drone";
    } else if (ctx.height > 4.2) {
      want = "drone";
    } else if (interest.danger > 0.78 && speed > 12) {
      want = "netcam";
    } else if (interest.nearby >= 3 && interest.danger > 0.35 && speed < 5.5) {
      want = "duel";
    } else if (speed > 17) {
      want = s.shot === "drone" ? "lowline" : "drone";
    } else if (ctx.nearGoal > 0.48) {
      want = "lowline";
    } else if (interest.nearby >= 2 && ctx.nearGoal > 0.32 && speed < 2.5) {
      want = "duel";
    } else if (s.since > 12 && s.shot === "wide") {
      want = "tower";
    } else {
      want = "wide";
    }
    const selected = hold.current.update(want, dt, SHOT_MIN_TIME[s.shot], Boolean(manual));
    if (selected !== s.shot) {
      s.prev = s.shot;
      s.shot = selected;
      s.since = 0;
      s.cut = 0.45;
    }
    const f = framingFor(s.shot, ctx, clock.elapsedTime);
    pos.set(f.px, f.py, f.pz);
    // Nenhum modo manual coloca a lente abaixo do gramado, mesmo após o shake.
    pos.y = Math.max(2.1, pos.y);
    look.set(f.lx, f.ly, f.lz);

    // tremor discreto só em comemoração/perigo, com amplitude limitada
    if (pulse > 0.05) {
      const amp = Math.min(0.45, pulse * 0.5);
      pos.x += Math.sin(clock.elapsedTime * 19) * amp;
      pos.y += Math.cos(clock.elapsedTime * 15) * amp * 0.5;
    }

    // amortecimento por tempo real + limite de velocidade linear
    const closeShot = s.shot === "duel" || s.shot === "playercam" || s.shot === "celebration";
    const base = s.cut > 0 ? 0.18 : closeShot ? 0.3 : s.shot === "skycam" ? 0.7 : 0.55;
    easing.damp3(camera.position, pos, base, dt);
    easing.damp3(smoothLook, look, s.cut > 0 ? 0.16 : 0.3, dt);
    camera.lookAt(smoothLook);

    const cam = camera as THREE.PerspectiveCamera;
    if (cam.isPerspectiveCamera) {
      const horizontalFov = f.fov - pulse * 2;
      const wantFov =
        cam.aspect < 1.4
          ? THREE.MathUtils.radToDeg(
              2 *
                Math.atan(
                  (Math.tan(THREE.MathUtils.degToRad(horizontalFov / 2)) * 1.4) /
                    Math.max(0.6, cam.aspect),
                ),
            )
          : horizontalFov;
      if (Math.abs(cam.fov - wantFov) > 0.01) {
        cam.fov += (wantFov - cam.fov) * (1 - Math.exp(-dt * 3.2));
        cam.updateProjectionMatrix();
      }
    }
  });
  return null;
}

/* --------------------------------------------------------- pós-processamento */

/** Céu com degradê, nuvens volumosas, estrelas e sol/lua; gira bem devagar. */
function SkyDome({ time }: { time: TimeOfDay }) {
  const tex = useMemo(() => skyTexture(time), [time]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.0035;
  });
  if (!tex) return null;
  return (
    <mesh ref={ref} scale={[-1, 1, 1]} userData={{ census: "sky" }}>
      <sphereGeometry args={[420, 48, 28]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  );
}

/* ------------------------------------------------------------------- cena */

/**
 * Festa do gol: papel picado colorido caindo sobre o gramado e fumaça de
 * sinalizador subindo atrás do gol, tudo instanciado e disparado pelo pulso.
 */
function GoalFx({
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
function Officials({ sim, quality }: { sim: SimView; quality: Quality }) {
  return (
    <group>
      <OfficialRig sim={sim} role="ref" quality={quality} />
      <OfficialRig sim={sim} role="ar1" quality={quality} />
      <OfficialRig sim={sim} role="ar2" quality={quality} />
    </group>
  );
}

/**
 * Medidor de quadros: amostra o tempo entre quadros e reporta uma vez por
 * segundo a taxa instantânea, a média e o pior caso (p95) da partida inteira.
 * Fica dentro do Canvas para não forçar re-render da árvore 3D.
 */
function FpsMeter({
  onSample,
  backend,
  quality,
}: {
  onSample: (s: FpsSample) => void;
  backend: GpuBackend;
  quality: Quality;
}) {
  // Buffers fixos reutilizados: zero alocação por quadro ou por segundo.
  const ring = useRef(new Float32Array(FPS_RING));
  const sortScratch = useRef(new Float32Array(FPS_RING));
  const ringState = useRef({ head: 0, size: 0, secondCount: 0, lastPersist: 0 });
  const acc = useRef(0);
  const warmup = useRef(2);

  useEffect(() => {
    ringState.current.head = 0;
    ringState.current.size = 0;
    ringState.current.secondCount = 0;
    acc.current = 0;
    warmup.current = 2;
  }, [quality, backend]);

  useFrame((state, dt) => {
    if (document.hidden || dt <= 0 || dt > 0.25) return;
    const rs = ringState.current;
    acc.current += dt;
    rs.secondCount += 1;
    if (acc.current < 1) {
      ring.current[rs.head] = dt * 1000;
      rs.head = (rs.head + 1) % FPS_RING;
      if (rs.size < FPS_RING) rs.size += 1;
      return;
    }
    if (warmup.current > 0) {
      warmup.current -= 1;
      acc.current = 0;
      rs.secondCount = 0;
      rs.head = 0;
      rs.size = 0;
      return;
    }
    const fps = rs.secondCount / acc.current;
    acc.current = 0;
    rs.secondCount = 0;
    const n = rs.size;
    const sorted = sortScratch.current.subarray(0, n);
    sorted.set(ring.current.subarray(0, n));
    sorted.sort();
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += sorted[i];
    const meanMs = sum / Math.max(1, n);
    const p95FrameMs = n ? sorted[Math.min(n - 1, Math.floor(n * 0.95))] : meanMs;
    const p99FrameMs = n ? sorted[Math.min(n - 1, Math.floor(n * 0.99))] : meanMs;
    const info = state.gl.info;
    const canvas = state.gl.domElement;
    const memory = performance as Performance & { memory?: { usedJSHeapSize: number } };
    const sample = {
      fps,
      avg: 1000 / Math.max(1, meanMs),
      p95FrameMs,
      onePercentLow: 1000 / Math.max(1, p99FrameMs),
      frameMs: meanMs,
      backend,
      quality,
      width: canvas.width,
      height: canvas.height,
      triangles: info.render.triangles,
      drawCalls: info.render.calls,
      memoryMb: memory.memory ? Math.round(memory.memory.usedJSHeapSize / 1_048_576) : null,
      measuredAt: new Date().toISOString(),
    };
    onSample(sample);
    const now = performance.now();
    if (now - rs.lastPersist < 10_000) return;
    rs.lastPersist = now;
    try {
      localStorage.setItem("manager3d.performance.latest", JSON.stringify(sample));
    } catch {
      // Medição continua visível quando o armazenamento está indisponível.
    }
  });

  return null;
}

type FpsSample = {
  fps: number;
  avg: number;
  p95FrameMs: number;
  onePercentLow: number;
  frameMs: number;
  backend: GpuBackend;
  quality: Quality;
  width: number;
  height: number;
  triangles: number;
  drawCalls: number;
  memoryMb: number | null;
  measuredAt: string;
};

function Scene({
  sim,
  mode,
  quality,
  look,
  shadows,
  backend,
  postIntensity,
  supporters,
}: {
  sim: SimView;
  mode: CameraMode;
  quality: Quality;
  look: ReturnType<typeof matchLook>;
  shadows: boolean;
  backend: GpuBackend;
  postIntensity: number;
  supporters?: SupporterMatchday | undefined;
}) {
  useFrame(() => {
    const interpolated = sim as SimView & { renderTick?: (now?: number) => void };
    interpolated.renderTick?.();
  });
  const time = look.time;
  const pressure = useQualityPressure();
  const budget = useRuntimeSceneBudget();
  // O pós-processamento atual roda em WebGL2; no caminho WebGPU a imagem sai
  // direto do renderizador (tone mapping e exposição continuam ativos).
  const postOn = useVisual().postFx && backend === "webgl2";

  const goalPulse = useRef(0);
  const lastGoals = useRef(0);
  const [replay, setReplay] = useState(false);
  const [moment, setMoment] = useState<"match" | "replay" | "drama">("match");
  const momentRef = useRef<"match" | "replay" | "drama">("match");

  useFrame((_, dt) => {
    const total = sim.stats.home.goals + sim.stats.away.goals;
    if (total !== lastGoals.current) {
      lastGoals.current = total;
      goalPulse.current = 1;
    }
    if (goalPulse.current > 0) goalPulse.current = Math.max(0, goalPulse.current - dt * 0.22);
    const r = goalPulse.current > 0.55;

    const m = goalPulse.current > 0.82 ? "drama" : r ? "replay" : "match";
    if (momentRef.current !== m) {
      momentRef.current = m;
      setMoment(m);
      setReplay(r);
    }
  });

  const awayClash = colorClash(sim.home.primary, sim.away.primary);
  const homeKit = useMemo(
    () => kitFor(sim.home.clubId, sim.home.primary, sim.home.secondary),
    [sim.home.clubId, sim.home.primary, sim.home.secondary],
  );
  const awayKit = useMemo(
    () => kitFor(sim.away.clubId, sim.away.primary, sim.away.secondary, awayClash),
    [sim.away.clubId, sim.away.primary, sim.away.secondary, awayClash],
  );

  const sun = time === "dia" ? 1.72 : time === "entardecer" ? 1.5 : 1.18;
  const sunColor = time === "entardecer" ? "#ffc79a" : time === "dia" ? "#fff6e0" : "#bcd8ff";
  const visualBall = presentationBall(sim);

  return (
    <>
      <color attach="background" args={[SKY[time]]} />
      {/* Profundidade por horário: de noite a névoa fecha antes e dá volume às luzes */}
      <fog
        attach="fog"
        args={[
          SKY[time],
          time === "noite" ? 80 : time === "entardecer" ? 95 : 120,
          time === "noite" ? 230 : time === "entardecer" ? 270 : 330,
        ]}
      />
      <AdaptiveEvents />
      <FrameProbe />
      <PerfPanel />

      {/* IBL local (sem HDR remoto): reflexos coerentes em traves, bola e kits */}
      {quality !== "baixa" ? (
        <Environment
          resolution={Math.round((quality === "alta" ? 384 : 192) * budget.textureScale)}
          frames={1}
        >
          <color attach="background" args={[SKY[time]]} />
          <Lightformer
            intensity={time === "dia" ? (quality === "alta" ? 2.1 : 1.75) : 1.45}
            color={sunColor}
            position={[0, 24, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[60, 60, 1]}
          />
          <Lightformer
            intensity={time === "noite" ? 2.4 : 1.2}
            color="#dceaff"
            position={[-30, 14, 0]}
            rotation-y={Math.PI / 2}
            scale={[60, 8, 1]}
          />
          <Lightformer
            intensity={time === "noite" ? 2.4 : 1.2}
            color="#dceaff"
            position={[30, 14, 0]}
            rotation-y={-Math.PI / 2}
            scale={[60, 8, 1]}
          />
          <Lightformer
            intensity={0.8}
            color={time === "entardecer" ? "#ff9b5c" : "#8fd8ff"}
            position={[0, 6, -40]}
            scale={[60, 8, 1]}
          />
        </Environment>
      ) : null}

      <ambientLight intensity={time === "dia" ? 0.1 : 0.075} />
      <hemisphereLight
        intensity={time === "dia" ? 0.34 : time === "entardecer" ? 0.3 : 0.22}
        groundColor={time === "noite" ? "#08131a" : "#102c1d"}
        color={time === "entardecer" ? "#ffe0c6" : time === "noite" ? "#a9c9ef" : "#d9edff"}
      />
      <directionalLight
        position={[50, 80, 40]}
        intensity={sun * 1.08}
        color={sunColor}
        castShadow={shadows && budget.shadows}
        shadow-mapSize={
          quality === "alta" && pressure < 5
            ? [2048, 2048]
            : quality === "media"
              ? [1024, 1024]
              : [512, 512]
        }
        shadow-bias={-0.00014}
        shadow-normalBias={quality === "alta" ? 0.014 : 0.03}
        shadow-radius={quality === "alta" ? 2.4 : 1.2}
        shadow-camera-near={12}
        shadow-camera-far={165}
        shadow-camera-left={-52}
        shadow-camera-right={52}
        shadow-camera-top={38}
        shadow-camera-bottom={-38}
      />
      <directionalLight
        position={[-55, 48, -35]}
        intensity={time === "noite" ? 0.72 : 0.36}
        color={time === "entardecer" ? "#b9c9ff" : "#bcd8ff"}
      />
      {/* Contraluz de transmissão: recorta a silhueta dos atletas contra o gramado. */}
      <directionalLight
        position={[0, 18, -55]}
        intensity={
          (time === "entardecer" ? 0.58 : time === "noite" ? 0.34 : 0.3) *
          (quality === "alta" ? 1 : 0.82)
        }
        color={time === "entardecer" ? "#ff9b62" : "#91c9ff"}
      />
      <directionalLight
        position={[0, 14, 52]}
        intensity={time === "noite" ? 0.24 : 0.2}
        color={time === "entardecer" ? "#ffd2a8" : "#cfe6ff"}
      />

      <SkyDome time={time} />
      <Pitch
        quality={quality}
        sim={sim}
        wet={look.wet}
        mow={look.mow}
        webgl2={backend === "webgl2"}
      />
      {/* Arranhões de chute, escorregões e rastro da bola: 1 desenho no total */}
      <PitchResponse sim={sim} quality={quality} />
      {quality !== "baixa" ? (
        <Weather
          weather={look.weather}
          wind={look.wind}
          quality={quality}
          density={budget.weatherDensity}
        />
      ) : null}
      {quality !== "baixa" ? <Officials sim={sim} quality={quality} /> : null}
      <BenchLife sim={sim} quality={quality} goalPulse={goalPulse} />

      <AdBoards homeColor={sim.home.primary} awayColor={sim.away.primary} />
      <Floodlights time={time} quality={quality} />
      {/* Feixes volumétricos, poeira e brilho das lâmpadas (custo fixo e baixo) */}
      <Atmosphere
        time={time}
        quality={quality}
        weather={look.weather}
        webgl2={backend === "webgl2"}
      />
      <Stands
        sim={sim}
        homeColor={sim.home.primary}
        awayColor={sim.away.primary}
        quality={quality}
        goalPulse={goalPulse}
        night={time !== "dia"}
        supporters={supporters}
        webgl2={backend === "webgl2"}
      />
      {/* O que a arquibancada faz em cada lance: gol, chance, falta, protesto */}
      <CrowdReaction
        sim={sim}
        quality={quality}
        night={time === "noite"}
        color={sim.home.primary}
        supporters={supporters}
      />
      <StadiumProps
        rings={budget.propRings}
        quality={quality}
        homeColor={sim.home.primary}
        awayColor={sim.away.primary}
        sim={sim}
      />
      <Scoreboard sim={sim} replay={replay} goalPulse={goalPulse} />
      <SidelineLife goalPulse={goalPulse} />
      <AmbientLife time={time} />
      <Ball sim={sim} quality={quality} hiVis={look.hiVisBall} wet={look.wet} />
      <MatchSurfaceProvider
        sim={sim}
        weather={surfaceWeather(look.weather)}
        quality={quality}
        intensity={time === "noite" ? 1.1 : 1}
      >
        <MatchPlayers
          sim={sim}
          homeKit={homeKit}
          awayKit={awayKit}
          goalPulse={goalPulse}
          quality={quality}
          mode={mode}
          replay={replay}
          budget={budget}
        />
      </MatchSurfaceProvider>
      <GoalFx goalPulse={goalPulse} quality={quality} density={budget.goalFxDensity} />
      <Rig sim={sim} mode={mode} goalPulse={goalPulse} />
      <PostFX
        grading={
          postOn
            ? { time, weather: GRADE_WEATHER[surfaceWeather(look.weather)], moment }
            : undefined
        }
        quality={
          !postOn || budget.post === "off"
            ? "baixa"
            : budget.post === "cinema"
              ? "alta"
              : pressure >= 6
                ? "media"
                : quality
        }
        replay={replay}
        moment={moment}
        time={time}
        intensity={postIntensity}
        cinematic={cameraOption(mode).cinematicTreatment}
      />
    </>
  );
}

/**
 * Clima do jogo (`matchday.ts`: seco, molhado, chuva, neve) convertido para o
 * vocabulário da correção de cor e da superfície dos atletas.
 */
type SurfaceWeatherName = "limpo" | "nublado" | "chuva" | "neve";

const WEATHER_ALIAS: Record<Weather, SurfaceWeatherName> = {
  seco: "limpo",
  molhado: "nublado",
  chuva: "chuva",
  neve: "neve",
};

const GRADE_WEATHER: Record<SurfaceWeatherName, GradeWeather> = {
  limpo: "limpo",
  nublado: "nublado",
  chuva: "chuva",
  neve: "neve",
};

function surfaceWeather(weather: Weather): SurfaceWeatherName {
  return WEATHER_ALIAS[weather] ?? "limpo";
}

function CompressedTextures({ enabled }: { enabled: boolean }) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    if (enabled) initKtx2(gl as THREE.WebGLRenderer | import("three/webgpu").WebGPURenderer);
  }, [enabled, gl]);
  return null;
}

/** Finish a camera transition in demand mode, then release the GPU while paused. */
function PausedCameraFrames({
  paused,
  visible,
  mode,
}: {
  paused: boolean;
  visible: boolean;
  mode: CameraMode;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const remaining = useRef(0);
  useEffect(() => {
    remaining.current = paused && visible ? 1.2 : 0;
    if (remaining.current > 0) invalidate();
  }, [paused, visible, mode, invalidate]);
  useFrame((_, dt) => {
    if (remaining.current <= 0) return;
    remaining.current -= Math.min(dt, 0.1);
    if (remaining.current > 0) invalidate();
  });
  return null;
}

function Stadium3DImpl({
  sim,
  mode,
  quality: deviceQuality,
  pixelRatio,
  supporters,
  paused = false,
}: {
  sim: SimView;
  mode: CameraMode;
  quality: Quality;
  pixelRatio?: number;
  paused?: boolean;
  supporters?: SupporterMatchday | undefined;
}) {
  const vis = useResolvedVisual(sim.home.clubId);
  // Escolha do jogador em /visual manda; "auto" segue a detecção do aparelho.
  // Cinema usa a geometria alta e amplia seletivamente resolução/efeitos sem
  // duplicar toda a árvore 3D nem quebrar configurações antigas.
  const quality: Quality =
    vis.quality === "auto" ? deviceQuality : vis.quality === "cinema" ? "alta" : vis.quality;
  const baseLook = useMemo(
    () => matchLook(sim.home.clubId, sim.away.clubId),
    [sim.home.clubId, sim.away.clubId],
  );
  // o clima físico manda no visual: chuva do sim molha a cena, calor seca.
  // Com céu limpo, vale o visual do clube/jogador. O vento é sempre o da
  // partida (bandeiras, grama e chuva inclinada acompanham a física).
  const simWeather = sim.weather;
  const simWind = sim.wind?.strength01;
  const look = useMemo(() => {
    const live = { ...baseLook, wind: simWind ?? baseLook.wind };
    if (simWeather === "rain")
      return { ...live, weather: "chuva" as const, wet: Math.max(live.wet, 0.75) };
    if (simWeather === "heat")
      return { ...live, weather: "seco" as const, wet: Math.min(live.wet, 0.15) };
    return live;
  }, [baseLook, simWeather, simWind]);

  // Em segundo plano o desenho 3D é suspenso para poupar bateria no celular.
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /**
   * Qualidade adaptativa: mede o ritmo real dos quadros e desce um degrau
   * (resolução, pós-processamento e torcida antes de tudo) quando a partida
   * fica pesada; volta a subir só depois de um bom tempo estável.
   */
  const eff = quality;
  const [pressure, setPressure] = useState(0);
  const [fps, setFps] = useState<FpsSample | null>(null);
  const sceneTier = vis.quality === "cinema" ? "cinema" : quality;
  const sceneBudget = useMemo(
    () => resolveRuntimeSceneBudget(sceneTier, pressure),
    [sceneTier, pressure],
  );

  const declines = useRef(0);
  const inclines = useRef(0);

  // Sombras: preferência explícita do jogador vence a decisão automática.
  const shadowsOn = vis.shadows === "auto" ? eff === "alta" : vis.shadows === "ligadas";
  // Escala de resolução escolhida em /visual, aplicada sobre o limite do aparelho.
  const dpr = useMemo(() => {
    const base = dprFor(eff);
    const s = vis.resolutionScale * sceneBudget.resolutionScale;
    const cap = GRAPHICS_PROFILES[sceneTier].maxPixelRatio;
    return Array.isArray(base)
      ? ([Math.min(cap, base[0] * s), Math.min(cap, base[1] * s)] as [number, number])
      : Math.min(cap, base * s);
  }, [eff, vis.resolutionScale, sceneBudget.resolutionScale, sceneTier]);

  // Backend gráfico: WebGPU quando o aparelho suporta, senão WebGL2.
  // A detecção acontece uma vez, antes de montar o palco, para não recriar
  // o contexto (e perder todas as texturas) no meio da partida.
  const [backend, setBackend] = useState<GpuBackend | null>(null);
  const [rendererReady, setRendererReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void detectWebGPU().then((ok) => {
      if (alive) setBackend(ok ? "webgpu" : "webgl2");
    });
    return () => {
      alive = false;
    };
  }, []);

  const glProp = useMemo(() => {
    const base = {
      antialias: eff === "media",
      powerPreference: "high-performance" as const,
      stencil: false,
    };
    if (backend !== "webgpu") return base;
    return async (props: Record<string, unknown>) => {
      const renderer = await createWebGPURenderer({ ...props, ...base }, () =>
        setBackend("webgl2"),
      );

      if (renderer) return renderer as never;
      // Adaptador sumiu entre a detecção e a criação: volta para WebGL2.
      setBackend("webgl2");
      const { WebGLRenderer } = THREE;
      return new WebGLRenderer({ ...(props as object), ...base }) as never;
    };
  }, [backend, eff]);

  if (!backend)
    return (
      <div
        role="status"
        className="flex h-full min-h-64 w-full items-center justify-center gap-3 bg-background text-sm text-muted-foreground"
      >
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        Preparando o estádio 3D…
      </div>
    );

  return (
    <div
      className="relative h-full w-full"
      data-supporter-climate={supporters?.climate}
      data-supporter-occupancy={supporters?.occupancy.toFixed(3)}
    >
      <GraphicsBoundary>
        <Canvas
          key={backend}
          shadows={shadowsOn ? SHADOW_SETTINGS : false}
          frameloop={visible && !paused ? "always" : "demand"}
          dpr={
            pixelRatio === undefined
              ? dpr
              : Math.min(GRAPHICS_PROFILES[quality].maxPixelRatio, Math.max(0.6, pixelRatio))
          }
          camera={{ position: [0, 46, FIELD_Z + 44], fov: 42 }}
          gl={glProp}
          performance={{ min: 0.5 }}
          fallback={
            <div
              role={rendererReady ? undefined : "status"}
              aria-hidden={rendererReady || undefined}
              className="flex h-full min-h-64 items-center justify-center px-6 text-center text-sm text-muted-foreground"
            >
              Não foi possível iniciar os gráficos 3D. Os controles e o placar continuam
              disponíveis.
            </div>
          }
          onCreated={({ gl }) => {
            setRendererReady(true);
            const r = gl as unknown as {
              toneMapping: THREE.ToneMapping;
              toneMappingExposure: number;
              outputColorSpace: string;
              shadowMap?: { type?: THREE.ShadowMapType };
              capabilities?: { getMaxAnisotropy?: () => number };
            };
            r.toneMapping = THREE.ACESFilmicToneMapping;
            r.toneMappingExposure =
              look.time === "dia" ? 0.9 : look.time === "entardecer" ? 1.0 : 1.1;
            r.outputColorSpace = THREE.SRGBColorSpace;
            // borda de sombra suave só na qualidade alta: o filtro extra custa
            // pouco lá e é o que mais aproxima a imagem de uma transmissão
            if (r.shadowMap) r.shadowMap.type = THREE.PCFShadowMap;
            // Texturas nítidas em ângulos rasantes (linhas do campo, publicidade,
            // faixas de corte) — o custo é baixo e o ganho de definição é grande.
            const maxAniso = r.capabilities?.getMaxAnisotropy?.() ?? 16;
            THREE.Texture.DEFAULT_ANISOTROPY = Math.min(
              Math.max(
                1,
                Math.round(
                  (eff === "alta" ? 16 : eff === "media" ? 8 : 4) * sceneBudget.textureScale,
                ),
              ),
              maxAniso,
            );
          }}
        >
          <PausedCameraFrames paused={paused} visible={visible} mode={mode} />
          <CompressedTextures enabled={quality === "alta"} />
          <RuntimeBudget
            tier={sceneTier}
            enabled={vis.adaptive}
            suspended={paused}
            onChange={setPressure}
          />
          <QualityPressure.Provider value={pressure}>
            <RuntimeSceneBudgetContext.Provider value={sceneBudget}>
              <Scene
                sim={sim}
                mode={mode}
                quality={eff}
                look={look}
                shadows={shadowsOn}
                backend={backend}
                postIntensity={vis.postIntensity * (vis.quality === "cinema" ? 1.12 : 1)}
                supporters={supporters}
              />
            </RuntimeSceneBudgetContext.Provider>
          </QualityPressure.Provider>
          {vis.showFps && !paused ? (
            <FpsMeter onSample={setFps} backend={backend} quality={eff} />
          ) : null}
        </Canvas>
      </GraphicsBoundary>
      {vis.showFps && fps ? (
        <div className="pointer-events-none absolute left-2 top-2 rounded-lg bg-black/55 px-2 py-1 font-mono text-[10px] leading-tight text-white/85">
          <span className="text-white">{Math.round(fps.fps)} fps</span>
          <span className="ml-2 text-white/60">med {Math.round(fps.avg)}</span>
          <span className="ml-2 text-white/60">p95 {fps.p95FrameMs.toFixed(1)} ms</span>
          <span className="ml-2 text-white/60">1% {Math.round(fps.onePercentLow)}</span>
          <span className="ml-2 text-white/60">{fps.frameMs.toFixed(1)} ms</span>
          <span className="ml-2 uppercase text-white/60">{fps.backend}</span>
          <span className="ml-2 text-white/60">{fps.triangles.toLocaleString("pt-BR")} tri</span>
          <span className="ml-2 text-white/60">{fps.drawCalls} draws</span>
          {fps.memoryMb ? <span className="ml-2 text-white/60">{fps.memoryMb} MB</span> : null}
        </div>
      ) : null}
      {quality === "baixa" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,0.42) 100%)",
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Memoizado: o HUD da partida re-renderiza várias vezes por segundo e não deve
 * reconstruir a árvore 3D. Só mudanças reais de sim/câmera/qualidade renderizam.
 */
export const Stadium3D = memo(Stadium3DImpl);
