import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  AdaptiveDpr,
  AdaptiveEvents,
  PerformanceMonitor,
  Text,
  Trail,
} from "@react-three/drei";
import { easing } from "maath";
import type React from "react";
import { memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { PlayerRig } from "@/components/game/players/PlayerRig";
import { PostFX } from "@/components/game/post/PostFX";
import { adTexture } from "@/components/game/stadium/textures/ads";
import {
  concreteAlbedo,
  concreteRoughness,
  seatsTexture,
} from "@/components/game/stadium/textures/concrete";
import { grassAlbedo, grassNormal, grassRoughness } from "@/components/game/stadium/textures/grass";
import { LINES_H, LINES_W, pitchLinesTexture } from "@/components/game/stadium/textures/lines";
import { pitchWearTexture } from "@/components/game/stadium/textures/wear";
import { bannerTexture, bigFlagTexture, mosaicTexture } from "@/components/game/stadium/textures/tifo";
import { StadiumProps } from "@/components/game/stadium/Props";

import { dprFor, higherQuality, lowerQuality } from "@/game/device";
import { kitFor, gkKitFor, kitTexture, skinFor, hairFor, colorClash, type Kit } from "@/game/kits";
import { FIELD_X, FIELD_Z, type MatchSim, type SimPlayer } from "@/game/sim";


export type CameraMode = "broadcast" | "tactical" | "goal" | "fan" | "rail" | "behind";
export type Quality = "alta" | "media" | "baixa";

type TimeOfDay = "dia" | "entardecer" | "noite";

const SKY: Record<TimeOfDay, string> = {
  dia: "#8fbfe8",
  entardecer: "#4a3630",
  noite: "#060a10",
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/* ---------------------------------------------------------------- gramado */

/** Tufos de grama instanciados perto das linhas laterais (só na qualidade alta). */
/**
 * Fibras de grama instanciadas com vento no vertex shader: nada é atualizado
 * na CPU por quadro, então dá para colocar dezenas de milhares de folhas.
 * A bola amassa a grama num raio curto ao passar.
 */
function useBladeMaterial(color: string) {
  const uniforms = useRef({
    uTime: { value: 0 },
    uBall: { value: new THREE.Vector3() },
    uWind: { value: 1 },
  });
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.94, metalness: 0 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms["uTime"] = uniforms.current.uTime;
      shader.uniforms["uBall"] = uniforms.current.uBall;
      shader.uniforms["uWind"] = uniforms.current.uWind;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform float uTime;
           uniform float uWind;
           uniform vec3 uBall;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           vec3 wp = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
           float h = clamp(position.y / 0.22, 0.0, 1.0);
           float w = sin(uTime * 1.7 + wp.x * 0.35 + wp.z * 0.22)
                   + 0.5 * sin(uTime * 3.1 + wp.x * 0.9);
           transformed.x += w * 0.07 * h * uWind;
           transformed.z += w * 0.04 * h * uWind;
           vec2 d = wp.xz - uBall.xz;
           float near = 1.0 - smoothstep(0.0, 1.6, length(d));
           transformed.xz += normalize(d + 0.0001) * near * 0.16 * h;
           transformed.y -= near * 0.1 * h;`,
        );
    };
    return m;
  }, [color]);
  return { mat, uniforms: uniforms.current };
}

function GrassField({ sim, quality }: { sim: MatchSim; quality: Quality }) {
  const short = quality === "alta" ? 12000 : 5000;
  const tall = quality === "alta" ? 3600 : 1400;
  const shortRef = useRef<THREE.InstancedMesh>(null);
  const tallRef = useRef<THREE.InstancedMesh>(null);
  const { mat, uniforms } = useBladeMaterial("#2b8a4d");

  useEffect(() => {
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    const fill = (mesh: THREE.InstancedMesh | null, n: number, tallLayer: boolean) => {
      if (!mesh) return;
      for (let i = 0; i < n; i++) {
        const x = (Math.random() * 2 - 1) * (FIELD_X + 5);
        const z = (Math.random() * 2 - 1) * (FIELD_Z + 5);
        d.position.set(x, tallLayer ? 0.09 : 0.05, z);
        d.rotation.set(0, Math.random() * Math.PI, (Math.random() - 0.5) * (tallLayer ? 0.4 : 0.22));
        const s = tallLayer ? 0.7 + Math.random() * 0.8 : 0.5 + Math.random() * 0.5;
        d.scale.set(s, s * (0.75 + Math.random() * 0.7), s);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
        // faixas de corte: alternância clara/escura também nas fibras
        const stripe = Math.floor((z + FIELD_Z) / 6) % 2 === 0 ? 0.05 : 0;
        col.setHSL(0.33 + Math.random() * 0.03, 0.5, 0.22 + stripe + Math.random() * 0.1);
        mesh.setColorAt(i, col);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    fill(shortRef.current, short, false);
    fill(tallRef.current, tall, true);
  }, [short, tall]);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uBall.value.set(sim.ball.x, 0, sim.ball.z);
    uniforms.uWind.value = 0.8 + Math.sin(clock.elapsedTime * 0.23) * 0.35;
  });

  return (
    <group>
      <instancedMesh
        ref={shortRef}
        frustumCulled={false}
        material={mat}
        args={[undefined, undefined, short]}
      >
        <coneGeometry args={[0.045, 0.12, 3]} />
      </instancedMesh>
      <instancedMesh
        ref={tallRef}
        frustumCulled={false}
        material={mat}
        args={[undefined, undefined, tall]}
      >
        <coneGeometry args={[0.06, 0.22, 4]} />
      </instancedMesh>
    </group>
  );
}



/**
 * Marcas de pisada e rastro de deslize: um pool de manchas escuras deixadas
 * pela bola e pelos jogadores, que desbotam com o tempo.
 */
function PitchMarks({ sim }: { sim: MatchSim }) {
  const COUNT = 90;
  const ref = useRef<THREE.InstancedMesh>(null);
  const slots = useRef(
    Array.from({ length: COUNT }, () => ({ x: 0, z: 0, life: 0, s: 1, r: 0 })),
  );
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
        slot.s = 0.35 + Math.min(0.7, sp * 0.5);
        slot.r = Math.atan2(p.vx, p.vz);
      }
    }

    for (let i = 0; i < COUNT; i++) {
      const s = slots.current[i]!;
      if (s.life > 0) s.life = Math.max(0, s.life - dt * 0.06);
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
      <meshBasicMaterial color="#0d3a1f" transparent opacity={0.22} depthWrite={false} />
    </instancedMesh>
  );
}

function Pitch({ quality, sim, wet }: { quality: Quality; sim: MatchSim; wet: number }) {
  const tex = useMemo(grassAlbedo, []);
  const rough = useMemo(grassRoughness, []);
  const norm = useMemo(() => (quality === "baixa" ? null : grassNormal()), [quality]);
  const wear = useMemo(() => (quality === "baixa" ? null : pitchWearTexture()), [quality]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[FIELD_X * 2 + 34, FIELD_Z * 2 + 30]} />
        <meshStandardMaterial color="#124a2a" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[FIELD_X * 2 + 10, FIELD_Z * 2 + 10]} />
        <meshPhysicalMaterial
          {...(tex ? { map: tex } : { color: "#1d7a45" })}
          {...(rough ? { roughnessMap: rough } : {})}
          {...(norm ? { normalMap: norm, normalScale: new THREE.Vector2(0.7, 0.7) } : {})}
          roughness={0.74}
          metalness={0.0}
          clearcoat={quality === "alta" ? 0.32 + wet * 0.4 : quality === "media" ? 0.14 : 0}
          clearcoatRoughness={0.62 - wet * 0.3}
          sheen={quality === "alta" ? 0.34 + wet * 0.3 : 0}
          sheenRoughness={0.75}
          sheenColor="#5fae7c"
          envMapIntensity={0.45 + wet * 0.4}
        />
      </mesh>
      {/* desgaste, lama e terra exposta por cima do gramado */}
      {wear ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} renderOrder={1}>
          <planeGeometry args={[LINES_W, LINES_H]} />
          <meshStandardMaterial
            map={wear}
            transparent
            opacity={0.34}

            roughness={0.95}
            metalness={0}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      ) : null}
      {quality !== "baixa" && <GrassField sim={sim} quality={quality} />}
      {quality !== "baixa" && <PitchMarks sim={sim} />}
      <PaintedLines />
      <Goal side={1} quality={quality} sim={sim} />
      <Goal side={-1} quality={quality} sim={sim} />
      <CornerFlags />
    </group>
  );
}




/**
 * Marcação do campo pintada: um plano com a textura de cal por cima do
 * gramado. Substitui as antigas linhas de 1 pixel, que serrilhavam e
 * pareciam desenho técnico.
 */
function PaintedLines() {
  const tex = useMemo(pitchLinesTexture, []);
  if (!tex) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} renderOrder={2}>
      <planeGeometry args={[LINES_W, LINES_H]} />
      <meshStandardMaterial
        map={tex}
        color="#c9cec6"
        transparent
        roughness={0.92}
        metalness={0}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}

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

function useNetMaterial(repeatX: number, repeatY: number) {
  return useMemo(() => {
    const alpha = netTexture();
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
  }, [repeatX, repeatY]);
}





/**
 * Rede simulada: malha de pontos com equação de onda no eixo de profundidade.
 * O vento faz a rede respirar e a bola estufa o pano de verdade, com a
 * ondulação se espalhando pelos fios e amortecendo aos poucos.
 */
function NetCloth({
  side,
  sim,
  material,
  quality,
}: {
  side: number;
  sim: MatchSim;
  material: THREE.Material;
  quality: Quality;
}) {
  const cols = quality === "alta" ? 22 : quality === "media" ? 14 : 9;
  const rows = quality === "alta" ? 14 : quality === "media" ? 9 : 6;
  const W = 7.32;
  const H = 2.44;

  const geo = useMemo(() => new THREE.PlaneGeometry(W, H, cols, rows), [cols, rows]);
  const state = useMemo(() => {
    const n = (cols + 1) * (rows + 1);
    return { z: new Float32Array(n), zp: new Float32Array(n) };
  }, [cols, rows]);
  const ref = useRef<THREE.Mesh>(null);
  const acc = useRef(0);

  useFrame(({ clock }, rawDt) => {
    acc.current += Math.min(rawDt, 0.05);
    const step = 1 / 60;
    if (acc.current < step) return;
    acc.current = 0;

    const { z, zp } = state;
    const cx = cols + 1;
    const t = clock.elapsedTime;

    // impulso da bola: dentro do gol, empurra a rede no ponto de impacto
    const bx = sim.ball.x;
    const insideGoal = side > 0 ? bx > FIELD_X - 0.2 : bx < -FIELD_X + 0.2;
    if (insideGoal && Math.abs(sim.ball.z) < W / 2 && sim.ball.height < H) {
      const u = (sim.ball.z / W + 0.5) * cols;
      const v = (1 - sim.ball.height / H) * rows;
      const power = Math.min(1.4, 0.25 + Math.hypot(sim.ball.vx, sim.ball.vz) * 0.12);
      for (let ry = -2; ry <= 2; ry++) {
        for (const rx of [-2, -1, 0, 1, 2]) {
          const ix = Math.round(u) + rx;
          const iy = Math.round(v) + ry;
          if (ix < 1 || ix >= cols || iy < 1 || iy >= rows) continue;
          const f = Math.exp(-(rx * rx + ry * ry) * 0.35);
          z[iy * cx + ix] = (z[iy * cx + ix] ?? 0) - power * f * 0.28;
        }
      }
    }

    // propagação + vento + gravidade leve (barriga da rede)
    for (let y = 1; y < rows; y++) {
      for (let x = 1; x < cols; x++) {
        const i = y * cx + x;
        const lap =
          (z[i - 1] ?? 0) + (z[i + 1] ?? 0) + (z[i - cx] ?? 0) + (z[i + cx] ?? 0) - 4 * (z[i] ?? 0);
        const wind = Math.sin(t * 1.3 + x * 0.4 + y * 0.2) * 0.0016;
        const next = 2 * (z[i] ?? 0) - (zp[i] ?? 0) + lap * 0.22 + wind - 0.0009;
        zp[i] = z[i] ?? 0;
        z[i] = next * 0.986;
      }
    }

    const pos = geo.attributes["position"] as THREE.BufferAttribute;
    for (let y = 0; y <= rows; y++) {
      for (let x = 0; x <= cols; x++) {
        const i = y * cx + x;
        const fx = 1 - Math.abs(x / cols - 0.5) * 2;
        const fy = 1 - y / rows;
        const sag = -0.5 * fx * (0.3 + 0.7 * fy);
        pos.setZ(i, sag + (z[i] ?? 0));
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <mesh
      ref={ref}
      position={[side * 1.9, 1.22, 0]}
      rotation={[0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
      geometry={geo}
      material={material}
    />
  );
}

function Goal({ side, quality, sim }: { side: number; quality: Quality; sim: MatchSim }) {
  const x = side * FIELD_X;
  const backMat = useNetMaterial(14, 5);
  const sideMat = useNetMaterial(4, 5);
  const topMat = useNetMaterial(4, 14);
  const post = (
    <meshStandardMaterial color="#fdfdfd" roughness={0.22} metalness={0.08} />
  );
  return (
    <group position={[x, 0, 0]}>
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
      <mesh position={[0, 2.44, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow={quality === "alta"}>
        <cylinderGeometry args={[0.06, 0.06, 7.32, 16]} />
        {post}
      </mesh>
      {/* barras traseiras horizontais */}
      <mesh position={[side * 1.9, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 7.32, 10]} />
        {post}
      </mesh>
      {/* rede: fundo (com barriga), laterais e teto */}
      <NetCloth side={side} sim={sim} material={backMat} quality={quality} />
      {[-3.66, 3.66].map((z) => (
        <mesh key={`s${z}`} position={[side * 0.95, 1.22, z]} material={sideMat}>
          <planeGeometry args={[1.9, 2.44]} />
        </mesh>
      ))}
      <mesh
        position={[side * 0.95, 2.4, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={topMat}
      >
        <planeGeometry args={[1.9, 7.32]} />
      </mesh>
    </group>
  );
}


function CornerFlags() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    g.children.forEach((c, i) => {
      c.rotation.z = Math.sin(clock.elapsedTime * 2.4 + i) * 0.14;
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
          <mesh position={[0.28, 1.32, 0]}>
            <planeGeometry args={[0.55, 0.35]} />
            <meshStandardMaterial color="#f5c400" side={THREE.DoubleSide} />
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
  const tex = useMemo(() => adTexture(homeColor, awayColor), [homeColor, awayColor]);
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


function scoreboardTexture(text: string) {
  if (typeof document === "undefined") return null;
  const w = 512;
  const h = 192;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#05070a";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#7dfcb0";
  ctx.font = "bold 96px 'Barlow Condensed', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Scoreboard({ sim }: { sim: MatchSim }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const label = useRef("");
  useFrame(() => {
    const text = `${sim.home.short} ${sim.stats.home.goals}-${sim.stats.away.goals} ${sim.away.short}  ${sim.minute()}'`;
    if (text === label.current) return;
    label.current = text;
    const tex = scoreboardTexture(text);
    if (tex && matRef.current) {
      matRef.current.map?.dispose();
      matRef.current.map = tex;
      matRef.current.emissiveMap = tex;
      matRef.current.needsUpdate = true;
    }
  });
  return (
    <group position={[0, 22, -(FIELD_Z + 26)]}>
      <mesh>
        <boxGeometry args={[30, 11, 1]} />
        <meshStandardMaterial color="#0b0e12" />
      </mesh>
      <mesh position={[0, 0, 0.6]}>
        <planeGeometry args={[28, 9.5]} />
        <meshStandardMaterial
          ref={matRef}
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.9}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Floodlights({ time, quality }: { time: TimeOfDay; quality: Quality }) {
  const on = time !== "dia";
  const spots: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  const lamps = [-2.6, -0.9, 0.9, 2.6];
  return (
    <group>
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
                    emissive={on ? "#dceaff" : "#2b3138"}
                    emissiveIntensity={on ? 3.4 : 0}
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
                      color="#cfe3ff"
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
                    color="#cfe3ff"
                    opacity={0.18}
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                  />
                </sprite>
                {quality !== "baixa" && (
                  <pointLight position={[0, 28, 0]} intensity={1400} distance={230} color="#e8f2ff" />
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

    </group>
  );
}


/** Concreto compartilhado por toda a estrutura (um material só, muitas peças). */
function useConcrete(color = "#6d747b", repeat = 6) {
  return useMemo(() => {
    const map = concreteAlbedo();
    const rough = concreteRoughness();
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
  }, [color, repeat]);
}

function Tiers({
  rings,
  homeColor,
  awayColor,
}: {
  rings: number;
  homeColor: string;
  awayColor: string;
}) {
  const steps: React.ReactElement[] = [];
  const lenX = FIELD_X * 2 + 30;
  const lenZ = FIELD_Z * 2 + 34;
  const concrete = useConcrete("#5f666d", 10);

  const seatMat = useMemo(() => {
    const t = seatsTexture(homeColor, awayColor);
    const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.82 });
    if (t) {
      const c = t.clone();
      c.needsUpdate = true;
      c.repeat.set(14, 1);
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
      t.repeat.set(10, 1);
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
    <group>
      {steps}
      {stairs}
    </group>
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
    <group>
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
          rotation={[0, sx! * sz! * Math.PI / 4, 0]}
        >
          <boxGeometry args={[26, 0.6, depth]} />
          <meshStandardMaterial color="#49545f" roughness={0.8} metalness={0.2} />
        </mesh>
      ))}
    </group>
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


function Stands({
  homeColor,
  awayColor,
  quality,
  goalPulse,
  night,
}: {
  homeColor: string;
  awayColor: string;
  quality: Quality;
  goalPulse: React.MutableRefObject<number>;
  night: boolean;
}) {
  const density = quality === "alta" ? 460 : quality === "media" ? 240 : 100;
  const rings = quality === "alta" ? 14 : quality === "media" ? 9 : 5;
  const wallMat = useConcrete("#39424b", 14);

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
      if (s < 3) return home;              // arquibancada organizada mandante
      if (s === 3 || s === 10) return homeAlt; // bloco do terceiro uniforme
      if (s >= 11) return away;            // setor visitante
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
        const sector = Math.floor(t * SECTORS);
        for (const zSide of [-1, 1]) {
          positions.push(
            new THREE.Vector3(
              px + ((i * 7 + ring * 3) % 5) * 0.06,
              2.6 + ring * 1.45,
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
        const sector = Math.floor(t * SECTORS);
        for (const xSide of [-1, 1]) {
          positions.push(
            new THREE.Vector3(xSide * (FIELD_X + 10 + ring * 1.5), 2.6 + ring * 1.45, pz),
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


  const ref = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const hairRef = useRef<THREE.InstancedMesh>(null);
  const shoulderRef = useRef<THREE.InstancedMesh>(null);
  const flashRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const flashCount = night ? Math.min(200, Math.round(crowd.positions.length * 0.05)) : 0;
  const armsRef = useRef<THREE.InstancedMesh>(null);
  const armCount = quality === "alta" ? Math.round(crowd.positions.length * 0.45) : 0;

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    crowd.colors.forEach((c, i) => mesh.setColorAt(i, c));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    const shoulders = shoulderRef.current;
    if (shoulders) {
      crowd.colors.forEach((c, i) => shoulders.setColorAt(i, c));
      if (shoulders.instanceColor) shoulders.instanceColor.needsUpdate = true;
    }
    const head = headRef.current;
    if (head) {
      crowd.skins.forEach((c, i) => head.setColorAt(i, c));
      if (head.instanceColor) head.instanceColor.needsUpdate = true;
    }
    const hair = hairRef.current;
    if (hair) {
      const hairs = ["#221a14", "#3d2a19", "#7a5a33", "#c9b48a", "#101010", "#5e5e5e", "#e8e8e8"];
      for (let i = 0; i < crowd.positions.length; i++) {
        // 1 em cada 4 usa boné na cor do setor, o resto usa cabelo
        const cap = i % 4 === 0;
        hair.setColorAt(
          i,
          cap ? crowd.colors[i]! : new THREE.Color(hairs[(i * 7) % hairs.length]!),
        );
      }
      if (hair.instanceColor) hair.instanceColor.needsUpdate = true;
    }
    const mat = mesh.material as THREE.Material | THREE.Material[];
    if (Array.isArray(mat)) mat.forEach((m) => (m.needsUpdate = true));
    else mat.needsUpdate = true;
  }, [crowd]);

  // atualiza a torcida em taxa reduzida fora da qualidade alta: o movimento
  // continua contínuo aos olhos, mas o custo por quadro cai pela metade/terço
  const tick = useRef(0);
  const everyN = quality === "alta" ? 1 : quality === "media" ? 2 : 3;

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    tick.current++;
    if (tick.current % everyN !== 0) return;
    const head = headRef.current;
    const hair = hairRef.current;
    const shoulders = shoulderRef.current;
    const t = clock.elapsedTime;
    const pulse = goalPulse.current;
    for (let i = 0; i < crowd.positions.length; i++) {
      const p = crowd.positions[i]!;
      const wave = Math.sin(t * 1.1 - p.x * 0.06) > 0.86 ? 0.5 : 0;
      const jump = pulse > 0 ? Math.abs(Math.sin(t * 9 + i)) * 0.75 * pulse : 0;
      const y = p.y + Math.sin(t * 3 + i) * 0.06 + wave + jump;
      // balanço lateral: a massa nunca fica perfeitamente enfileirada
      const swayX = Math.sin(t * 1.6 + i * 0.7) * 0.05 * (0.4 + pulse);
      const yaw = ((i % 7) - 3) * 0.06 + Math.sin(t * 0.8 + i) * 0.05;
      const tall = 0.9 + ((i % 5) * 0.045);
      dummy.position.set(p.x + swayX, y, p.z);
      dummy.scale.set(1, tall, 1);
      dummy.rotation.set(0, yaw, Math.sin(t * 1.9 + i * 1.3) * 0.03);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (shoulders) {
        dummy.position.set(p.x + swayX, y + 0.3 * tall, p.z);
        dummy.scale.set(1.5, 0.55, 1);
        dummy.rotation.set(0, yaw, Math.PI / 2);
        dummy.updateMatrix();
        shoulders.setMatrixAt(i, dummy.matrix);
      }
      const headY = y + 0.5 * tall + 0.06;
      const headPitch = Math.sin(t * 2 + i) * 0.05;
      if (head) {
        dummy.position.set(p.x + swayX, headY, p.z);
        dummy.scale.setScalar(1);
        dummy.rotation.set(headPitch, yaw, 0);
        dummy.updateMatrix();
        head.setMatrixAt(i, dummy.matrix);
      }
      if (hair) {
        dummy.position.set(p.x + swayX, headY + 0.015, p.z);
        dummy.scale.set(1, i % 4 === 0 ? 0.7 : 1, 1);
        dummy.rotation.set(headPitch, yaw, 0);
        dummy.updateMatrix();
        hair.setMatrixAt(i, dummy.matrix);
      }
      // braços: palmas no ritmo, erguidos na comemoração e na ola
      const arms = armsRef.current;
      if (arms && i < armCount) {
        const raise = Math.min(1, pulse * 1.2 + (wave > 0 ? 0.8 : 0) + (Math.sin(t * 6 + i) > 0.7 ? 0.25 : 0));
        dummy.position.set(p.x + swayX, y + 0.42 + raise * 0.3, p.z);
        dummy.rotation.set(-raise * 1.5, yaw, 0);
        dummy.scale.set(1, 0.5 + raise * 0.7, 1);
        dummy.updateMatrix();
        arms.setMatrixAt(i, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (head) head.instanceMatrix.needsUpdate = true;
    if (hair) hair.instanceMatrix.needsUpdate = true;
    if (shoulders) shoulders.instanceMatrix.needsUpdate = true;
    if (armsRef.current && armCount) armsRef.current.instanceMatrix.needsUpdate = true;

    // flashes de câmera na torcida (mais intensos após o gol)
    const fm = flashRef.current;
    if (fm && flashCount) {
      for (let i = 0; i < flashCount; i++) {
        const p = crowd.positions[(i * 37) % crowd.positions.length]!;
        const on = Math.sin(t * (6 + (i % 5)) + i * 2.3) > (pulse > 0.05 ? 0.55 : 0.95);
        dummy.position.set(p.x, p.y + 0.45, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(on ? 1 : 0.0001);
        dummy.updateMatrix();
        fm.setMatrixAt(i, dummy.matrix);
      }
      fm.instanceMatrix.needsUpdate = true;
    }
  });

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

      <Tiers rings={rings} homeColor={homeColor} awayColor={awayColor} />
      <Roof rings={rings} />
      <Banners color={homeColor} alt={awayColor} rings={rings} />
      <CrowdFlags color={homeColor} alt={awayColor} rings={rings} quality={quality} />

      {/* tronco: ombros mais largos que o quadril, tecido fosco */}
      <instancedMesh ref={ref} frustumCulled={false} args={[undefined, undefined, crowd.positions.length]}>
        <capsuleGeometry args={[0.22, 0.44, quality === "alta" ? 4 : 3, quality === "alta" ? 10 : 6]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh
        ref={shoulderRef}
        frustumCulled={false}
        args={[undefined, undefined, crowd.positions.length]}
      >
        <capsuleGeometry args={[0.13, 0.3, 2, quality === "alta" ? 8 : 5]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh
        ref={headRef}
        frustumCulled={false}
        args={[undefined, undefined, crowd.positions.length]}
      >
        <sphereGeometry args={[0.16, quality === "alta" ? 10 : 6, quality === "alta" ? 8 : 5]} />
        <meshStandardMaterial roughness={0.72} />
      </instancedMesh>
      {/* cabelo/boné: quebra a fileira de cabeças todas iguais */}
      <instancedMesh
        ref={hairRef}
        frustumCulled={false}
        args={[undefined, undefined, crowd.positions.length]}
      >
        <sphereGeometry args={[0.165, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      {armCount > 0 && (
        <instancedMesh ref={armsRef} frustumCulled={false} args={[undefined, undefined, armCount]}>
          <capsuleGeometry args={[0.07, 0.34, 2, 4]} />
          <meshStandardMaterial color="#d7a377" roughness={0.8} />
        </instancedMesh>
      )}
      {flashCount > 0 && (
        <instancedMesh ref={flashRef} frustumCulled={false} args={[undefined, undefined, flashCount]}>
          <sphereGeometry args={[0.13, 6, 6]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} transparent opacity={0.9} />
        </instancedMesh>
      )}
    </group>
  );
}


/**
 * Bandeirões da torcida: planos com ondulação no vertex shader, espalhados
 * pelas arquibancadas nas cores dos dois clubes.
 */
function CrowdFlags({
  color,
  alt,
  rings,
  quality,
}: {
  color: string;
  alt: string;
  rings: number;
  quality: Quality;
}) {
  const count = quality === "alta" ? 46 : quality === "media" ? 24 : 10;
  const uTime = useRef({ value: 0 });

  const flags = useMemo(() => {
    const out: { pos: [number, number, number]; rot: number; c: string; s: number }[] = [];
    for (let i = 0; i < count; i++) {
      const behind = i % 2 === 0;
      const ring = 1 + (i * 3) % Math.max(1, rings - 1);
      const t = ((i * 37) % 100) / 100;
      const y = 3.4 + ring * 1.45;
      if (behind) {
        const zSide = i % 4 < 2 ? -1 : 1;
        out.push({
          pos: [-FIELD_X - 8 + t * (FIELD_X * 2 + 16), y, zSide * (FIELD_Z + 7 + ring * 1.5)],
          rot: zSide > 0 ? Math.PI : 0,
          c: t < 0.45 ? color : alt,
          s: 0.8 + ((i % 3) * 0.35),
        });
      } else {
        const xSide = i % 4 < 2 ? -1 : 1;
        out.push({
          pos: [xSide * (FIELD_X + 10 + ring * 1.5), y, -FIELD_Z - 6 + t * (FIELD_Z * 2 + 12)],
          rot: xSide > 0 ? -Math.PI / 2 : Math.PI / 2,
          c: xSide > 0 ? color : alt,
          s: 0.8 + ((i % 4) * 0.3),
        });
      }
    }
    return out;
  }, [count, rings, color, alt]);

  const materials = useMemo(() => flags.map((f, i) => {
    // bandeirões grandes ganham estampa (listras + escudo); os pequenos ficam
    // só na cor, para não pesar em aparelho fraco
    const printed = i % 3 === 0 ? bigFlagTexture(f.c, f.c === color ? alt : color) : null;
    const m = new THREE.MeshStandardMaterial({
      color: printed ? "#ffffff" : f.c,
      ...(printed ? { map: printed } : {}),
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms["uTime"] = uTime.current;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           float wave = sin(uTime * 2.2 + position.x * 3.0) * 0.12
                      + sin(uTime * 3.7 + position.y * 2.0) * 0.05;
           transformed.z += wave * (0.4 + position.x + 0.5);`,
        );
    };
    return m;
  }), [flags, color, alt]);


  useFrame(({ clock }) => {
    uTime.current.value = clock.elapsedTime;
  });

  if (!count) return null;
  return (
    <group>
      {flags.map((f, i) => (
        <mesh
          key={i}
          position={f.pos}
          rotation={[0, f.rot, 0]}
          scale={[f.s, f.s, 1]}
          material={materials[i]!}
        >
          <planeGeometry args={[2.4, 1.5, 12, 6]} />
        </mesh>
      ))}
    </group>
  );
}

/* --------------------------------------------------------------- jogadores */




function Ball({ sim, quality }: { sim: MatchSim; quality: Quality }) {
  const ref = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const trail = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    m.position.x += (sim.ball.x - m.position.x) * 0.5;
    m.position.z += (sim.ball.z - m.position.z) * 0.5;
    m.position.y = 0.13 + sim.ball.height;
    const sp = Math.hypot(sim.ball.vx, sim.ball.vz);
    m.rotation.x += dt * (2 + sp * 0.9);
    m.rotation.z += dt * (1.5 + sp * 0.6);
    const s = shadow.current;
    if (s) {
      s.position.set(m.position.x, 0.015, m.position.z);
      const k = Math.max(0.35, 1 - sim.ball.height * 0.25);
      s.scale.setScalar(k);
      (s.material as THREE.MeshBasicMaterial).opacity = 0.36 * k;
    }
    // rastro de velocidade em chutes fortes
    const t = trail.current;
    if (t) {
      const active = sp > 16;
      t.visible = active;
      if (active) {
        const k = Math.min(1, (sp - 16) / 18);
        t.position.copy(m.position);
        t.rotation.y = Math.atan2(sim.ball.vx, sim.ball.vz);
        t.scale.set(1, 1, 1 + k * 9);
        (t.material as THREE.MeshBasicMaterial).opacity = 0.22 * k;
      }
    }
  });
  return (
    <group>
      <mesh ref={ref} castShadow={quality === "alta"} position={[0, 0.13, 0]}>
        <sphereGeometry args={[0.13, 20, 20]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.05} />
      </mesh>
      <mesh ref={trail} position={[0, 0.13, 0]} visible={false}>
        <boxGeometry args={[0.09, 0.09, 0.5]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.2}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.18, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.36} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ câmera */

function Rig({
  sim,
  mode,
  goalPulse,
}: {
  sim: MatchSim;
  mode: CameraMode;
  goalPulse: React.MutableRefObject<number>;
}) {
  const target = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const smoothLook = useMemo(() => new THREE.Vector3(0, 0.8, 0), []);
  useFrame(({ camera, clock }, dt) => {
    const bx = sim.ball.x;
    const bz = sim.ball.z;
    const pulse = goalPulse.current;
    // replay automático: no gol a câmera vai para trás da bola em órbita lenta
    const effective: CameraMode = pulse > 0.55 ? "behind" : mode;
    switch (effective) {
      case "broadcast":
        target.set(bx * 0.55, 46, FIELD_Z + 44);
        break;
      case "tactical":
        target.set(bx * 0.2, 72, 6);
        break;
      case "goal":
        target.set(FIELD_X + 34, 22, bz * 0.3);
        break;
      case "fan":
        target.set(bx * 0.3, 17, FIELD_Z + 22);
        break;
      case "rail":
        target.set(bx, 9, FIELD_Z + 13);
        break;
      case "behind": {
        const a = clock.elapsedTime * 0.15;
        target.set(bx + Math.cos(a) * 16, 6.5, bz + Math.sin(a) * 16);
        break;
      }
    }
    // tremor sutil em lances de perigo / comemoração
    if (pulse > 0.05) {
      const s = pulse * 0.5;
      target.x += Math.sin(clock.elapsedTime * 21) * s;
      target.y += Math.cos(clock.elapsedTime * 17) * s * 0.6;
    }
    // damping independente de framerate (maath)
    const smooth = effective === "behind" ? 0.35 : effective === "rail" ? 0.28 : 0.75;
    easing.damp3(camera.position, target, smooth, dt);
    look.set(bx * 0.6, 0.8, bz * 0.6);
    easing.damp3(smoothLook, look, 0.35, dt);
    camera.lookAt(smoothLook);
  });
  return null;
}

/* --------------------------------------------------------- pós-processamento */

/** Céu em degradê + nuvens leves; substitui o fundo chapado. */
function SkyDome({ time }: { time: TimeOfDay }) {
  const tex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const w = 32;
    const h = 256;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const stops: Record<TimeOfDay, [string, string, string]> = {
      dia: ["#3f86d0", "#8fbfe8", "#d8ecf8"],
      entardecer: ["#20304f", "#6b5570", "#ffb277"],
      noite: ["#02040a", "#080f1c", "#16243a"],
    };
    const [top, mid, low] = stops[time];
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top);
    g.addColorStop(0.55, mid);
    g.addColorStop(1, low);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [time]);
  if (!tex) return null;
  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[420, 24, 16]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  );
}

/* ------------------------------------------------------------------- cena */


/**
 * Festa do gol: papel picado colorido caindo sobre o gramado e fumaça de
 * sinalizador subindo atrás do gol, tudo instanciado e disparado pelo pulso.
 */
function GoalFx({ goalPulse, quality }: { goalPulse: React.MutableRefObject<number>; quality: Quality }) {
  const COUNT = quality === "alta" ? 320 : 140;
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
        dummy.position.set(
          side * (FIELD_X + 6),
          1 + t * 12,
          (i % 6) * 6 - 15,
        );
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

function Scene({
  sim,
  mode,
  quality,
  time,
}: {
  sim: MatchSim;
  mode: CameraMode;
  quality: Quality;
  time: TimeOfDay;
}) {
  const goalPulse = useRef(0);
  const lastGoals = useRef(0);
  const [replay, setReplay] = useState(false);
  const [moment, setMoment] = useState<"match" | "replay" | "drama">("match");

  useFrame((_, dt) => {
    const total = sim.stats.home.goals + sim.stats.away.goals;
    if (total !== lastGoals.current) {
      lastGoals.current = total;
      goalPulse.current = 1;
    }
    if (goalPulse.current > 0) goalPulse.current = Math.max(0, goalPulse.current - dt * 0.22);
    const r = goalPulse.current > 0.55;
    setReplay((v) => (v === r ? v : r));
    const m = goalPulse.current > 0.82 ? "drama" : r ? "replay" : "match";
    setMoment((v) => (v === m ? v : m));

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

  const sun = time === "dia" ? 1.9 : time === "entardecer" ? 1.5 : 1.2;
  const sunColor = time === "entardecer" ? "#ffc79a" : time === "dia" ? "#fff6e0" : "#bcd8ff";

  return (
    <>
      <color attach="background" args={[SKY[time]]} />
      <fog attach="fog" args={[SKY[time], 110, 300]} />
      <AdaptiveDpr pixelated={false} />
      <AdaptiveEvents />

      {/* IBL local (sem HDR remoto): reflexos coerentes em traves, bola e kits */}
      <Environment resolution={quality === "alta" ? 256 : 128} frames={1}>
        <color attach="background" args={[SKY[time]]} />
        <Lightformer
          intensity={time === "dia" ? 3 : 1.6}
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

      <ambientLight intensity={0.32} />
      <hemisphereLight
        intensity={time === "dia" ? 0.5 : 0.32}
        groundColor="#0d2a18"
        color={time === "entardecer" ? "#ffd8ba" : "#cfe4ff"}
      />
      <directionalLight
        position={[50, 80, 40]}
        intensity={sun}
        color={sunColor}
        castShadow={quality === "alta"}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
      />
      <directionalLight position={[-60, 60, -40]} intensity={0.6} color="#bcd8ff" />

      <SkyDome time={time} />
      <Pitch quality={quality} sim={sim} wet={time === "noite" ? 0.7 : time === "entardecer" ? 0.3 : 0} />

      <AdBoards homeColor={sim.home.primary} awayColor={sim.away.primary} />
      <Floodlights time={time} quality={quality} />
      <Stands
        homeColor={sim.home.primary}
        awayColor={sim.away.primary}
        quality={quality}
        goalPulse={goalPulse}
        night={time !== "dia"}
      />
      <StadiumProps
        rings={quality === "alta" ? 14 : quality === "media" ? 9 : 5}
        quality={quality}
        homeColor={sim.home.primary}
        awayColor={sim.away.primary}
        ball={sim.ball}
      />
      <Scoreboard sim={sim} />
      <Ball sim={sim} quality={quality} />
      {sim.players.map((p) => (
        <PlayerRig
          key={p.id}
          player={p}
          sim={sim}
          kit={
            p.pos === "GK"
              ? gkKitFor(p.side === "home" ? sim.home.clubId : sim.away.clubId)
              : p.side === "home"
                ? homeKit
                : awayKit
          }
          goalPulse={goalPulse}
          quality={quality}
        />
      ))}
      <GoalFx goalPulse={goalPulse} quality={quality} />
      <Rig sim={sim} mode={mode} goalPulse={goalPulse} />
      <PostFX
        quality={quality}
        replay={replay}
        moment={moment}
        time={time}
      />


    </>
  );
}

function Stadium3DImpl({
  sim,
  mode,
  quality,
}: {
  sim: MatchSim;
  mode: CameraMode;
  quality: Quality;
}) {
  const time = useMemo<TimeOfDay>(() => {
    const t = hash(sim.home.clubId + sim.away.clubId) % 3;
    return t === 0 ? "dia" : t === 1 ? "entardecer" : "noite";
  }, [sim.home.clubId, sim.away.clubId]);

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
  const [eff, setEff] = useState<Quality>(quality);
  useEffect(() => setEff(quality), [quality]);
  const declines = useRef(0);

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows={eff === "alta"}
        frameloop={visible ? "always" : "demand"}
        dpr={dprFor(eff)}
        camera={{ position: [0, 46, FIELD_Z + 44], fov: 42 }}
        gl={{
          antialias: eff === "media",
          powerPreference: "high-performance",
          stencil: false,
        }}
        performance={{ min: 0.5 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = eff === "baixa" ? 0.95 : 1.02;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <PerformanceMonitor
          onDecline={() => {
            declines.current += 1;
            if (declines.current >= 2) {
              declines.current = 0;
              setEff((q) => lowerQuality(q));
            }
          }}
          onIncline={() => {
            declines.current = 0;
            setEff((q) => (higherQuality(q) === quality ? higherQuality(q) : q));
          }}
        />
        <Scene sim={sim} mode={mode} quality={eff} time={time} />
      </Canvas>
      {eff !== quality ? (
        <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/80">
          Qualidade {eff}
        </span>
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


