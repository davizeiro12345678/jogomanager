import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GoalNetPanel } from "../GoalNet";
import { censusRef } from "@/game/scene-census";
import { FIELD_X, FIELD_Z } from "@/game/sim-rules";
import type { SimView } from "@/game/sim-types";
import { ktx2, useKtx2Revision } from "@/game/textures/ktx2";
import { presentationBall, type Quality } from "./shared";

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
  const textureRevision = useKtx2Revision(["netMask", "net_normal", "net_rough"]);
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

export function Goal({
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
