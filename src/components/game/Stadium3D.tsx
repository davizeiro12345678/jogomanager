import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, AdaptiveDpr, AdaptiveEvents } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  SMAA,
  DepthOfField,
  BrightnessContrast,
  HueSaturation,
  Noise,
} from "@react-three/postprocessing";
import { easing } from "maath";
import type React from "react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { PlayerRig } from "@/components/game/players/PlayerRig";
import { dprFor } from "@/game/device";
import { kitFor, gkKitFor, kitTexture, skinFor, hairFor, colorClash, type Kit } from "@/game/kits";
import { FIELD_X, FIELD_Z, type MatchSim, type SimPlayer } from "@/game/sim";


export type CameraMode = "broadcast" | "tactical" | "goal" | "fan" | "rail" | "behind";
export type Quality = "alta" | "media" | "baixa";

type TimeOfDay = "dia" | "entardecer" | "noite";

const SKY: Record<TimeOfDay, string> = {
  dia: "#8fbfe8",
  entardecer: "#3a2340",
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

function grassTexture() {
  if (typeof document === "undefined") return null;
  const size = 2048;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  // base com variação de tonalidade (não é verde chapado)
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, "#1a6f3f");
  g.addColorStop(0.5, "#1f8149");
  g.addColorStop(1, "#186a3c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // listras de corte diagonais, com bordas suaves e largura alternada
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-0.22);
  ctx.translate(-size, -size);
  for (let i = 0; i < 40; i++) {
    const light = i % 2 === 0;
    const grad = ctx.createLinearGradient(i * 144, 0, i * 144 + 144, 0);
    const a = light ? "rgba(255,255,255," : "rgba(0,0,0,";
    grad.addColorStop(0, `${a}0.02)`);
    grad.addColorStop(0.5, `${a}0.075)`);
    grad.addColorStop(1, `${a}0.02)`);
    ctx.fillStyle = grad;
    ctx.fillRect(i * 144, 0, 144, size * 2);
  }
  ctx.restore();

  // fibras finas (textura de lâmina) — dá granulação de perto
  for (let i = 0; i < 26000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 3 + Math.random() * 7;
    ctx.strokeStyle = `rgba(${Math.random() > 0.45 ? "210,255,190" : "10,60,30"},${0.03 + Math.random() * 0.07})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 3, y - len);
    ctx.stroke();
  }

  // desgaste / manchas
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "0,0,0"},${0.015 + Math.random() * 0.03})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 6 + Math.random() * 26, 3 + Math.random() * 12, Math.random() * 3, 0, 7);
    ctx.fill();
  }

  // áreas mais gastas: pequenas áreas e círculo central
  const wear = (cx: number, cy: number, rx: number, ry: number, strength: number) => {
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    rg.addColorStop(0, `rgba(150,130,80,${strength})`);
    rg.addColorStop(1, "rgba(150,130,80,0)");
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, 7);
    ctx.fill();
    ctx.restore();
  };
  wear(size * 0.5, size * 0.5, size * 0.1, size * 0.1, 0.1);
  wear(size * 0.05, size * 0.5, size * 0.09, size * 0.16, 0.16);
  wear(size * 0.95, size * 0.5, size * 0.09, size * 0.16, 0.16);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 16;
  return tex;
}

/** Normal map procedural: dá relevo às lâminas e às listras de corte. */
function grassNormal() {
  if (typeof document === "undefined") return null;
  const size = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);
  // inclinação alternada das faixas ceifadas
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-0.22);
  ctx.translate(-size, -size);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(110,128,255,0.55)" : "rgba(150,128,255,0.55)";
    ctx.fillRect(i * 72, 0, 72, size * 2);
  }
  ctx.restore();
  // ruído de lâminas
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.strokeStyle = `rgba(${100 + Math.random() * 60 | 0},${100 + Math.random() * 60 | 0},255,0.25)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 2, y - 2 - Math.random() * 4);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  tex.anisotropy = 8;
  return tex;
}

/** Mapa de rugosidade: as listras de corte refletem a luz de forma diferente
 *  (grama penteada para lados opostos) — dá o brilho úmido da transmissão. */
function grassRoughness() {
  if (typeof document === "undefined") return null;
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#b4b4b4";
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-0.22);
  ctx.translate(-size, -size);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#8c8c8c" : "#d2d2d2";
    ctx.fillRect(i * 36, 0, 36, size * 2);
  }
  ctx.restore();
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * size,
      Math.random() * size,
      4 + Math.random() * 14,
      2 + Math.random() * 7,
      Math.random() * 3,
      0,
      7,
    );
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  return tex;
}

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

function Pitch({ quality, sim }: { quality: Quality; sim: MatchSim }) {
  const tex = useMemo(grassTexture, []);
  const rough = useMemo(grassRoughness, []);
  const norm = useMemo(() => (quality === "baixa" ? null : grassNormal()), [quality]);
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
          {...(norm ? { normalMap: norm, normalScale: new THREE.Vector2(0.55, 0.55) } : {})}
          roughness={0.78}
          metalness={0.0}
          clearcoat={quality === "alta" ? 0.35 : 0}
          clearcoatRoughness={0.7}
          sheen={quality === "alta" ? 0.22 : 0}
          sheenColor="#4f9c6d"
          envMapIntensity={0.35}
        />
      </mesh>
      {quality !== "baixa" && <GrassField sim={sim} quality={quality} />}
      {quality !== "baixa" && <PitchMarks sim={sim} />}
      <Lines />
      <Goal side={1} quality={quality} sim={sim} />
      <Goal side={-1} quality={quality} sim={sim} />
      <CornerFlags />
      <Dugouts />
    </group>
  );
}



function line(points: [number, number][], y = 0.02) {
  return new THREE.BufferGeometry().setFromPoints(
    points.map(([x, z]) => new THREE.Vector3(x, y, z)),
  );
}

function Lines() {
  const geoms = useMemo(() => {
    const g: THREE.BufferGeometry[] = [];
    g.push(
      line([
        [-FIELD_X, -FIELD_Z],
        [FIELD_X, -FIELD_Z],
        [FIELD_X, FIELD_Z],
        [-FIELD_X, FIELD_Z],
        [-FIELD_X, -FIELD_Z],
      ]),
    );
    g.push(
      line([
        [0, -FIELD_Z],
        [0, FIELD_Z],
      ]),
    );
    const circle: [number, number][] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      circle.push([Math.cos(a) * 9.15, Math.sin(a) * 9.15]);
    }
    g.push(line(circle));
    for (const s of [1, -1]) {
      g.push(
        line([
          [s * FIELD_X, -20],
          [s * (FIELD_X - 16.5), -20],
          [s * (FIELD_X - 16.5), 20],
          [s * FIELD_X, 20],
        ]),
      );
      g.push(
        line([
          [s * FIELD_X, -9],
          [s * (FIELD_X - 5.5), -9],
          [s * (FIELD_X - 5.5), 9],
          [s * FIELD_X, 9],
        ]),
      );
    }
    return g;
  }, []);

  return (
    <group>
      {geoms.map((g, i) => (
        <primitive
          key={i}
          object={
            new THREE.Line(
              g,
              new THREE.LineBasicMaterial({ color: "#f2fbf4", transparent: true, opacity: 0.9 }),
            )
          }
        />
      ))}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.35, 12]} />
        <meshBasicMaterial color="#f2fbf4" />
      </mesh>
    </group>
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

function Dugouts() {
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 14, 0, -(FIELD_Z + 7.5)]}>
          <mesh position={[0, 1.1, 0]}>
            <boxGeometry args={[11, 2.2, 3]} />
            <meshStandardMaterial color="#13181d" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.6, 1.45]}>
            <planeGeometry args={[11, 1.4]} />
            <meshStandardMaterial color="#0a0d10" transparent opacity={0.5} />
          </mesh>
        </group>
      ))}
      {/* túnel */}
      <mesh position={[0, 1.6, -(FIELD_Z + 9)]}>
        <boxGeometry args={[6, 3.2, 6]} />
        <meshStandardMaterial color="#0e1216" roughness={1} />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------- estrutura */

function adBoardTexture(text: string, bg: string, fg: string) {
  if (typeof document === "undefined") return null;
  const w = 256;
  const h = 48;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = "bold 30px 'Barlow Condensed', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const ADS = [
  ["FUT+ TV", "#0b2b45", "#7dfcb0"],
  ["AERO BRASIL", "#8a1420", "#ffffff"],
  ["NOVA BET", "#123f2a", "#f5c400"],
  ["PIXEL ENERGY", "#3a2f6b", "#ffffff"],
  ["GOLAÇO FM", "#6b4a12", "#ffe9b0"],
  ["MANAGER 3D", "#101418", "#7dfcb0"],
] as const;

function AdBoards() {
  const boards: React.ReactElement[] = [];
  const count = 18;
  const w = ((FIELD_X + 8) * 2) / count;
  for (let i = 0; i < count; i++) {
    const x = -(FIELD_X + 8) + w / 2 + i * w;
    for (const z of [-1, 1]) {
      boards.push(
        <AdBoard key={`${i}-${z}`} x={x} z={z * (FIELD_Z + 5)} w={w} seed={i + (z > 0 ? 3 : 0)} />,
      );
    }
  }
  return <group>{boards}</group>;
}

function AdBoard({ x, z, w, seed }: { x: number; z: number; w: number; seed: number }) {
  const texes = useMemo(
    () => ADS.map(([text, bg, fg]) => adBoardTexture(text, bg, fg)).filter(Boolean) as THREE.CanvasTexture[],
    [],
  );
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const idx = useRef(-1);
  useFrame(({ clock }) => {
    if (!texes.length) return;
    // troca de anúncio a cada 5s, com defasagem por placa
    const next = (Math.floor(clock.elapsedTime / 5) + seed) % texes.length;
    if (next === idx.current) return;
    idx.current = next;
    const tex = texes[next]!;
    const m = matRef.current;
    if (m) {
      m.map = tex;
      m.emissiveMap = tex;
      m.needsUpdate = true;
    }
  });
  return (
    <mesh position={[x, 0.6, z]} rotation={[0, z > 0 ? Math.PI : 0, 0]}>
      <boxGeometry args={[w * 0.94, 1.2, 0.25]} />
      <meshStandardMaterial
        ref={matRef}
        color="#ffffff"
        emissive="#ffffff"
        emissiveIntensity={0.55}
        roughness={0.4}
        toneMapped={false}
      />
    </mesh>
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
  return (
    <group>
      {spots.map(([sx, sz], i) => (
        <group key={i} position={[sx * (FIELD_X + 20), 0, sz * (FIELD_Z + 22)]}>
          <mesh position={[0, 14, 0]}>
            <cylinderGeometry args={[0.5, 0.9, 28, 8]} />
            <meshStandardMaterial color="#252c33" roughness={0.85} />
          </mesh>
          <mesh position={[0, 28.5, 0]}>
            <boxGeometry args={[8, 3.4, 1]} />
            <meshStandardMaterial
              color="#f5f8ff"
              emissive={on ? "#dceaff" : "#333"}
              emissiveIntensity={on ? 2.2 : 0}
              toneMapped={false}
            />
          </mesh>
          {on && (
            <>
              <sprite position={[0, 28.5, 0]} scale={[26, 26, 1]}>
                <spriteMaterial
                  color="#cfe3ff"
                  opacity={0.16}
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
      ))}
    </group>
  );
}

function Tiers({ rings }: { rings: number }) {
  const steps: React.ReactElement[] = [];
  const lenX = FIELD_X * 2 + 30;
  const lenZ = FIELD_Z * 2 + 34;
  for (let r = 0; r < rings; r++) {
    const y = 2.0 + r * 1.45;
    const shade = r % 2 === 0 ? "#2f3943" : "#39434e";
    for (const z of [-1, 1]) {
      steps.push(
        <mesh key={`sz${r}${z}`} position={[0, y - 0.72, z * (FIELD_Z + 7 + r * 1.5)]} receiveShadow>
          <boxGeometry args={[lenX, 1.45, 1.5]} />
          <meshStandardMaterial color={shade} roughness={1} />
        </mesh>,
      );
    }
    for (const x of [-1, 1]) {
      steps.push(
        <mesh key={`sx${r}${x}`} position={[x * (FIELD_X + 10 + r * 1.5), y - 0.72, 0]} receiveShadow>
          <boxGeometry args={[1.5, 1.45, lenZ]} />
          <meshStandardMaterial color={shade} roughness={1} />
        </mesh>,
      );
    }
  }
  return <group>{steps}</group>;
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


function Banners({ color }: { color: string }) {
  return (
    <group>
      {[-1, 0, 1].map((i) => (
        <mesh key={i} position={[i * 22, 2.2, -(FIELD_Z + 6.4)]}>
          <planeGeometry args={[16, 1.6]} />
          <meshStandardMaterial color={color} roughness={0.9} side={THREE.DoubleSide} />
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
}: {
  homeColor: string;
  awayColor: string;
  quality: Quality;
  goalPulse: React.MutableRefObject<number>;
  night: boolean;
}) {
  const density = quality === "alta" ? 460 : quality === "media" ? 240 : 100;
  const rings = quality === "alta" ? 14 : quality === "media" ? 9 : 5;

  const crowd = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const colors: THREE.Color[] = [];
    const skins: THREE.Color[] = [];
    const home = new THREE.Color(homeColor);
    const away = new THREE.Color(awayColor);
    const neutral = ["#d8d8d8", "#8fa3b8", "#42506b", "#e0c07a", "#b8c4cf", "#6c7a8c"];
    const skinTones = ["#e8b98f", "#d19b6d", "#a9713f", "#7a4b26", "#f2cfa8", "#5c3418"];
    const pick = (i: number, ring: number) =>
      new THREE.Color(skinTones[(i * 5 + ring * 3) % skinTones.length]!);
    for (let ring = 0; ring < rings; ring++) {
      for (let i = 0; i < density; i++) {
        const t = i / density;
        const px = -FIELD_X - 10 + t * (FIELD_X * 2 + 20);
        for (const zSide of [-1, 1]) {
          positions.push(
            new THREE.Vector3(
              px + ((i * 7 + ring * 3) % 5) * 0.06,
              2.6 + ring * 1.45,
              zSide * (FIELD_Z + 7 + ring * 1.5),
            ),
          );
          const zone = t < 0.3 ? home : t > 0.7 ? away : null;
          colors.push(
            zone && (i + ring) % 3 !== 0
              ? zone
              : new THREE.Color(neutral[(i + ring) % neutral.length]!),
          );
          skins.push(pick(i, ring));
        }
      }
    }
    for (let ring = 0; ring < rings; ring++) {
      const n = Math.round(density * 0.6);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const pz = -FIELD_Z - 8 + t * (FIELD_Z * 2 + 16);
        for (const xSide of [-1, 1]) {
          positions.push(
            new THREE.Vector3(xSide * (FIELD_X + 10 + ring * 1.5), 2.6 + ring * 1.45, pz),
          );
          const mosaic = (ring + i) % 5 < 3 ? home : new THREE.Color("#f2f2f2");
          colors.push(xSide === 1 ? mosaic : new THREE.Color(neutral[(i + ring) % neutral.length]!));
          skins.push(pick(i + 3, ring));
        }
      }
    }
    return { positions, colors, skins };
  }, [homeColor, awayColor, density, rings]);

  const ref = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
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
    const head = headRef.current;
    if (head) {
      crowd.skins.forEach((c, i) => head.setColorAt(i, c));
      if (head.instanceColor) head.instanceColor.needsUpdate = true;
    }
    const mat = mesh.material as THREE.Material | THREE.Material[];
    if (Array.isArray(mat)) mat.forEach((m) => (m.needsUpdate = true));
    else mat.needsUpdate = true;
  }, [crowd]);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const head = headRef.current;
    const t = clock.elapsedTime;
    const pulse = goalPulse.current;
    for (let i = 0; i < crowd.positions.length; i++) {
      const p = crowd.positions[i]!;
      const wave = Math.sin(t * 1.1 - p.x * 0.06) > 0.86 ? 0.5 : 0;
      const jump = pulse > 0 ? Math.abs(Math.sin(t * 9 + i)) * 0.75 * pulse : 0;
      const y = p.y + Math.sin(t * 3 + i) * 0.06 + wave + jump;
      const yaw = ((i % 7) - 3) * 0.06;
      dummy.position.set(p.x, y, p.z);
      dummy.scale.set(1, 0.92 + ((i % 5) * 0.04), 1);
      dummy.rotation.set(0, yaw, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (head) {
        dummy.position.set(p.x, y + 0.52, p.z);
        dummy.scale.setScalar(1);
        dummy.rotation.set(Math.sin(t * 2 + i) * 0.05, yaw, 0);
        dummy.updateMatrix();
        head.setMatrixAt(i, dummy.matrix);
      }
      // braços: palmas no ritmo, erguidos na comemoração e na ola
      const arms = armsRef.current;
      if (arms && i < armCount) {
        const raise = Math.min(1, pulse * 1.2 + (wave > 0 ? 0.8 : 0) + (Math.sin(t * 6 + i) > 0.7 ? 0.25 : 0));
        dummy.position.set(p.x, y + 0.42 + raise * 0.3, p.z);
        dummy.rotation.set(-raise * 1.5, yaw, 0);
        dummy.scale.set(1, 0.5 + raise * 0.7, 1);
        dummy.updateMatrix();
        arms.setMatrixAt(i, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (head) head.instanceMatrix.needsUpdate = true;
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
        <mesh key={z} position={[0, 6, z * (FIELD_Z + 9 + rings * 1.5)]}>
          <boxGeometry args={[FIELD_X * 2 + 34, 12, 2]} />
          <meshStandardMaterial color="#28313a" roughness={1} />
        </mesh>
      ))}
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x * (FIELD_X + 12 + rings * 1.5), 6, 0]}>
          <boxGeometry args={[2, 12, FIELD_Z * 2 + 36]} />
          <meshStandardMaterial color="#28313a" roughness={1} />
        </mesh>
      ))}

      <Tiers rings={rings} />
      <Roof rings={rings} />
      <Banners color={homeColor} />
      <CrowdFlags color={homeColor} alt={awayColor} rings={rings} quality={quality} />

      <instancedMesh ref={ref} frustumCulled={false} args={[undefined, undefined, crowd.positions.length]}>
        <capsuleGeometry args={[0.22, 0.42, 3, 6]} />
        <meshStandardMaterial roughness={0.88} />
      </instancedMesh>
      <instancedMesh
        ref={headRef}
        frustumCulled={false}
        args={[undefined, undefined, crowd.positions.length]}
      >
        <sphereGeometry args={[0.16, 6, 5]} />
        <meshStandardMaterial roughness={0.75} />
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

  const materials = useMemo(() => flags.map((f) => {
    const m = new THREE.MeshStandardMaterial({
      color: f.c,
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
  }), [flags]);

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

function Post({ quality, replay = false }: { quality: Quality; replay?: boolean }) {
  if (quality === "baixa") return null;

  // preset "cinema" no replay de gol: contraste, cor mais quente e vinheta forte
  if (replay) {
    return (
      <EffectComposer key="cinema" enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.9} luminanceThreshold={0.6} luminanceSmoothing={0.35} mipmapBlur />
        <HueSaturation saturation={0.22} />
        <BrightnessContrast brightness={-0.02} contrast={0.2} />
        <Noise opacity={0.06} />
        <Vignette offset={0.18} darkness={0.85} />
      </EffectComposer>
    );
  }

  if (quality === "media") {
    return (
      <EffectComposer key="media" enableNormalPass={false}>
        <Bloom intensity={0.35} luminanceThreshold={0.75} luminanceSmoothing={0.25} mipmapBlur />
        <Vignette offset={0.28} darkness={0.55} />
      </EffectComposer>
    );
  }
  return (
    <EffectComposer key="alta" enableNormalPass={false} multisampling={0}>
      <Bloom intensity={0.6} luminanceThreshold={0.68} luminanceSmoothing={0.3} mipmapBlur />
      <HueSaturation saturation={0.12} />
      <BrightnessContrast brightness={0.01} contrast={0.1} />
      <Noise opacity={0.025} />
      <Vignette offset={0.25} darkness={0.6} />
      <SMAA />
    </EffectComposer>
  );
}



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
      entardecer: ["#1c1030", "#7a3560", "#ff9e5c"],
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

  useFrame((_, dt) => {
    const total = sim.stats.home.goals + sim.stats.away.goals;
    if (total !== lastGoals.current) {
      lastGoals.current = total;
      goalPulse.current = 1;
    }
    if (goalPulse.current > 0) goalPulse.current = Math.max(0, goalPulse.current - dt * 0.22);
    const r = goalPulse.current > 0.55;
    setReplay((v) => (v === r ? v : r));
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

  const sun = time === "dia" ? 2.8 : time === "entardecer" ? 2.2 : 1.8;
  const sunColor = time === "entardecer" ? "#ffb27a" : time === "dia" ? "#fff6e0" : "#bcd8ff";

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

      <ambientLight intensity={0.7} />
      <hemisphereLight
        intensity={time === "dia" ? 0.9 : 0.6}
        groundColor="#0d2a18"
        color={time === "entardecer" ? "#ffd0a8" : "#cfe4ff"}
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
      <Pitch quality={quality} sim={sim} />

      <AdBoards />
      <Floodlights time={time} quality={quality} />
      <Stands
        homeColor={sim.home.primary}
        awayColor={sim.away.primary}
        quality={quality}
        goalPulse={goalPulse}
        night={time !== "dia"}
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
      <Post quality={quality} replay={replay} />

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

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows={quality === "alta"}
        frameloop={visible ? "always" : "demand"}
        dpr={dprFor(quality)}
        camera={{ position: [0, 46, FIELD_Z + 44], fov: 42 }}
        gl={{
          antialias: quality === "media",
          powerPreference: "high-performance",
          stencil: false,
        }}
        performance={{ min: 0.5 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = quality === "baixa" ? 1.0 : 1.15;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <Scene sim={sim} mode={mode} quality={quality} time={time} />
      </Canvas>
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


