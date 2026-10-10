// ============================================================================
//  ClubIdentity.tsx
//  Identidade do clube na arquibancada: bandeirão com nome/escudo-texto e
//  bandeira tremulando no mastro. A textura é gerada em canvas com as cores
//  reais do clube; o tremular é vértice a vértice no useFrame (sem shader).
// ============================================================================

import { memo, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface ClubColors {
  name: string;
  short: string;
  primary: string;
  secondary: string;
}

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}

function tifoTexture(club: ClubColors): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 256;
  const ctx = cv.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 1024, 256);
  grad.addColorStop(0, shade(club.primary, -0.08));
  grad.addColorStop(0.5, club.primary);
  grad.addColorStop(1, shade(club.primary, 0.06));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 256);
  // faixas diagonais da cor secundária
  ctx.fillStyle = club.secondary;
  ctx.globalAlpha = 0.9;
  for (let k = -2; k < 9; k++) {
    ctx.beginPath();
    ctx.moveTo(k * 140, 256);
    ctx.lineTo(k * 140 + 90, 256);
    ctx.lineTo(k * 140 + 190, 0);
    ctx.lineTo(k * 140 + 100, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // sigla gigante vazada
  ctx.font = "900 150px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.strokeText(club.short, 512, 108);
  ctx.fillStyle = club.primary;
  ctx.fillText(club.short, 512, 108);
  // nome por extenso
  ctx.font = "700 44px Arial, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(club.name.toUpperCase(), 512, 205);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Tecido que ondula: desloca z por coluna a cada frame. */
function useWave(ref: RefObject<THREE.Mesh | null>, amp: number, speed: number, len: number) {
  const base = useRef<Float32Array | null>(null);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const geo = mesh.geometry as THREE.PlaneGeometry;
    const pos = geo.getAttribute("position");
    if (!base.current) base.current = (pos.array as Float32Array).slice();
    const t = clock.elapsedTime * speed;
    for (let i = 0; i < pos.count; i++) {
      const x = base.current[i * 3]!;
      const y = base.current[i * 3 + 1]!;
      pos.setZ(i, Math.sin(t + x * 0.55 + y * 0.3) * amp * (0.35 + (x / len + 0.5) * 0.65));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });
}

/** Bandeirão esticado na torcida, com o nome do clube. */
export const TifoBanner = memo(function TifoBanner({
  club,
  width = 13,
  height = 3.2,
  position = [0, 0, 0],
}: {
  club: ClubColors;
  width?: number;
  height?: number;
  position?: [number, number, number];
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => tifoTexture(club), [club]);
  useWave(mesh, 0.16, 2.2, width);
  return (
    <group position={position}>
      <mesh ref={mesh}>
        <planeGeometry args={[width, height, 40, 6]} />
        <meshStandardMaterial map={tex} side={THREE.DoubleSide} roughness={0.85} />
      </mesh>
      {/* mastros laterais segurando o pano */}
      {[-width / 2, width / 2].map((x) => (
        <mesh key={x} position={[x, -height / 2 - 0.8, 0]}>
          <cylinderGeometry args={[0.035, 0.035, height + 1.6, 6]} />
          <meshStandardMaterial color="#8a939e" roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
});

/** Bandeira de mastro com as cores do clube. */
export const ClubFlag = memo(function ClubFlag({
  club,
  position = [0, 0, 0],
  scale = 1,
}: {
  club: ClubColors;
  position?: [number, number, number];
  scale?: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 160;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = club.primary;
    ctx.fillRect(0, 0, 256, 160);
    ctx.fillStyle = club.secondary;
    ctx.fillRect(0, 118, 256, 42);
    ctx.font = "900 84px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(club.short.slice(0, 3), 128, 62);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [club]);
  useWave(mesh, 0.12, 3.4, 2.4 * scale);
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 2.2, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 4.4, 8]} />
        <meshStandardMaterial color="#aab2bc" roughness={0.45} metalness={0.55} />
      </mesh>
      <mesh position={[0, 4.45, 0]}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshStandardMaterial color="#e8b93c" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh ref={mesh} position={[1.22, 3.6, 0]}>
        <planeGeometry args={[2.4, 1.5, 24, 6]} />
        <meshStandardMaterial map={tex} side={THREE.DoubleSide} roughness={0.85} />
      </mesh>
    </group>
  );
});
