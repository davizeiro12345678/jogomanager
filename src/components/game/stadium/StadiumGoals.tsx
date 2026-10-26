import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FIELD_X, FIELD_Z } from "@/game/sim-rules";
import type { SimView } from "@/game/sim-contracts";
import type { Quality } from "../Stadium3D";
import { censusRef } from "@/game/scene-census";
import { GoalNetPanel } from "./GoalNet";
import { ktx2, useKtx2Revision } from "@/game/textures/ktx2";
import { presentationBall } from "./stadium-ball";
import { StaticBatch } from "./StaticBatch";

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
      forceSinglePass: true,
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

export function Goal({ side, quality, sim }: { side: number; quality: Quality; sim: SimView }) {
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
        <StaticBatch signature={`goal-frame:${side}:${quality}`}>
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
        </StaticBatch>
        {/* rede: fundo (com barriga), laterais e teto */}
        <GoalNetPanel side={side} sim={sim} material={backMat} quality={quality} />
        <GoalNetPanel side={side} sim={sim} material={sideMat} quality={quality} face="left" />
        <GoalNetPanel side={side} sim={sim} material={sideMat} quality={quality} face="right" />
        <GoalNetPanel side={side} sim={sim} material={topMat} quality={quality} face="roof" />
      </group>
    </group>
  );
}

export function CornerFlags({ sim, webgl2 }: { sim: SimView; webgl2: boolean }) {
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
