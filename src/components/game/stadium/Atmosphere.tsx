// ============================================================================
//  Atmosphere.tsx
//  Atmosfera do estádio: feixe volumétrico dos refletores, poeira em suspensão
//  e discos de brilho nas lâmpadas.
//
//  Regras que este arquivo segue (as mesmas do plano de gráficos do projeto):
//   - o custo é fixo e pequeno: 4 cones + 1 nuvem de pontos + N sprites. Nada
//     aqui cresce com a torcida, com o número de atletas ou com o replay;
//   - nada é desenhado em qualidade baixa;
//   - todo o resto é escalado pelo orçamento de cena (`useRuntimeSceneBudget`),
//     então o governor desliga os detalhes antes de derrubar o quadro;
//   - shader próprio (ShaderMaterial) só roda no caminho WebGL2. No caminho
//     WebGPU experimental os feixes saem, mas o resto continua — nada quebra.
// ============================================================================

import { useDisposable } from "../useDisposable";
import { useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef } from "react";
import * as THREE from "three";

import { censusRef } from "@/game/scene-census";
import { useRuntimeSceneBudget } from "@/components/game/RuntimeBudget";
import { FIELD_X, FIELD_Z } from "@/game/sim";
import type { Weather } from "@/game/matchday";

export type AtmosQuality = "alta" | "media" | "baixa";
export type AtmosTime = "dia" | "entardecer" | "noite";

/** Quanto cada clima multiplica a névoa que revela o feixe dos refletores. */
const HAZE_BY_WEATHER: Record<Weather, number> = {
  seco: 1,
  molhado: 0.95,
  chuva: 1.35,
  neve: 1.15,
};

/** Altura dos refletores, igual à das torres do estádio. */
const TOWER_Y = 34;
/** Onde ficam as torres: quatro cantos, um pouco fora do campo. */
const TOWERS: [number, number][] = [
  [-FIELD_X * 0.92, -FIELD_Z * 1.05],
  [FIELD_X * 0.92, -FIELD_Z * 1.05],
  [-FIELD_X * 0.92, FIELD_Z * 1.05],
  [FIELD_X * 0.92, FIELD_Z * 1.05],
];

const BEAM_VERT = /* glsl */ `
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BEAM_FRAG = /* glsl */ `
  precision mediump float;
  varying vec3 vLocal;
  uniform vec3 uColor;
  uniform float uHeight;
  uniform float uRadius;
  uniform float uIntensity;
  uniform float uHaze;
  uniform float uTime;
  uniform float uSeed;

  void main() {
    // 0 na lâmpada (ápice), 1 no gramado (base)
    float h = clamp(0.5 - vLocal.y / uHeight, 0.0, 1.0);
    float radial = length(vLocal.xz) / max(0.0001, uRadius * (0.08 + h * 1.05));
    // borda macia: o feixe não pode terminar em linha reta
    float edge = 1.0 - smoothstep(0.35, 1.0, radial);
    // a luz perde força com a distância e ganha um pouco no meio do caminho
    float fall = pow(1.0 - h, 1.35) * (0.55 + 0.45 * sin(h * 3.14159));
    // cintilação de lâmpada: imperceptível, mas tira o "plástico" do feixe
    float flicker = 1.0 + 0.035 * sin(uTime * 6.3 + uSeed) + 0.02 * sin(uTime * 11.7 + uSeed * 2.1);
    float a = edge * fall * uIntensity * uHaze * flicker;
    if (a <= 0.001) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

function useBeamMaterial(
  color: string,
  height: number,
  radius: number,
  haze: number,
  seed: number,
) {
  return useDisposable(() => {
    const material = new THREE.ShaderMaterial({
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uHeight: { value: height },
        uRadius: { value: radius },
        uIntensity: { value: 0 },
        uHaze: { value: haze },
        uTime: { value: 0 },
        uSeed: { value: seed },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    return material;
  }, [color, height, radius, haze, seed]);
}

/** Textura radial usada pelos discos de brilho e pela poeira. */
function radialSprite(
  inner = "rgba(255,255,255,1)",
  outer = "rgba(255,255,255,0)",
): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.45, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, outer);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let sharedGlow: THREE.Texture | null | undefined;
function glowTexture(): THREE.Texture | null {
  if (sharedGlow === undefined) sharedGlow = radialSprite();
  return sharedGlow;
}

let sharedMote: THREE.Texture | null | undefined;
function moteTexture(): THREE.Texture | null {
  if (sharedMote === undefined)
    sharedMote = radialSprite("rgba(255,255,255,0.9)", "rgba(255,255,255,0)");
  return sharedMote;
}

/**
 * Feixe de um refletor: um cone aberto, com o ápice na lâmpada e a base no
 * gramado. Um desenho cada; o "volume" vem do shader, não de geometria extra.
 */
function Beam({
  position,
  color,
  intensity,
  haze,
  seed,
  radius,
}: {
  position: [number, number];
  color: string;
  intensity: number;
  haze: number;
  seed: number;
  radius: number;
}) {
  const material = useBeamMaterial(color, TOWER_Y, radius, haze, seed);
  const geometry = useDisposable(() => new THREE.ConeGeometry(radius, TOWER_Y, 14, 1, true), [radius]);
  useFrame((state) => {
    material.uniforms["uTime"]!.value = state.clock.elapsedTime;
    const u = material.uniforms["uIntensity"]!;
    // rampa suave: ligar/desligar o feixe não pode "piscar" na tela
    u.value += (intensity - u.value) * 0.08;
  });
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[position[0], TOWER_Y / 2, position[1]]}
      frustumCulled={false}
      renderOrder={3}
    />
  );
}

/** Disco de brilho na lâmpada: alimenta o bloom com uma forma reconhecível. */
function LampGlow({
  position,
  color,
  size,
  opacity,
}: {
  position: [number, number];
  color: string;
  size: number;
  opacity: number;
}) {
  const tex = glowTexture();
  const ref = useRef<THREE.Sprite>(null);
  useFrame((state) => {
    const sprite = ref.current;
    if (!sprite) return;
    // quanto mais longe, maior o disco: mantém o brilho legível na arquibancada
    const d = state.camera.position.distanceTo(sprite.position);
    const scale = size * (1 + Math.min(2.4, d / 90));
    sprite.scale.set(scale, scale, 1);
  });
  if (!tex) return null;
  return (
    <sprite ref={ref} position={[position[0], TOWER_Y - 1.5, position[1]]} renderOrder={4}>
      <spriteMaterial
        map={tex}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </sprite>
  );
}

/**
 * Poeira em suspensão. Uma única nuvem de pontos que deriva com o vento e
 * embrulha no eixo X: um desenho só para centenas de partículas.
 */
function DustMotes({
  count,
  color,
  wind,
  opacity,
}: {
  count: number;
  color: string;
  wind: number;
  opacity: number;
}) {
  const points = useRef<THREE.Points>(null);
  const tex = moteTexture();
  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * FIELD_X * 1.1;
      positions[i * 3 + 1] = Math.random() * 16 + 0.4;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * FIELD_Z * 1.15;
      speeds[i] = 0.25 + Math.random() * 0.85;
    }
    return { positions, speeds };
  }, [count]);

  const geometry = useDisposable(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  useFrame((state, dt) => {
    const mesh = points.current;
    if (!mesh) return;
    const attr = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = state.clock.elapsedTime;
    const step = Math.min(0.05, dt);
    for (let i = 0; i < speeds.length; i++) {
      const s = speeds[i]!;
      const ix = i * 3;
      const iy = ix + 1;
      arr[ix] = arr[ix]! + wind * s * step * 6;
      arr[iy] = arr[iy]! + Math.sin(t * 0.6 + i) * 0.004;
      // embrulha no eixo X para a nuvem nunca "acabar"
      if (arr[ix]! > FIELD_X * 1.1) arr[ix] = -FIELD_X * 1.1;
      if (arr[ix]! < -FIELD_X * 1.1) arr[ix] = FIELD_X * 1.1;
    }
    attr.needsUpdate = true;
  });

  if (!tex || count <= 0) return null;
  return (
    <points ref={points} geometry={geometry} frustumCulled={false} renderOrder={2}>
      <pointsMaterial
        map={tex}
        color={color}
        size={0.16}
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

/**
 * Atmosfera completa. `webgl2` desliga só os feixes no caminho WebGPU; poeira
 * e brilho seguem porque usam materiais padrão do three.js.
 */
export const Atmosphere = memo(function Atmosphere({
  time,
  quality,
  weather = "seco",
  webgl2 = true,
}: {
  time: AtmosTime;
  quality: AtmosQuality;
  /** clima da partida (`matchday.ts`) */
  weather?: Weather;
  webgl2?: boolean;
}) {
  const budget = useRuntimeSceneBudget();

  const night = time === "noite";
  const dusk = time === "entardecer";
  // O feixe só existe quando há luz artificial e algo no ar para revelá-lo.
  const hazeBase = night ? 1 : dusk ? 0.55 : 0.12;
  const haze = hazeBase * (HAZE_BY_WEATHER[weather] ?? 1);
  const intensity = (night ? 0.5 : dusk ? 0.3 : 0.09) * (quality === "alta" ? 1 : 0.7);
  const color = night ? "#dcebff" : dusk ? "#ffd7ac" : "#eaf2ff";
  const beamsOn = quality !== "baixa" && webgl2 && intensity > 0.04 && budget.stage < 6;

  const motes = quality === "alta" ? 420 : quality === "media" ? 180 : 0;
  const moteCount = Math.round(motes * Math.min(1, budget.textureScale + 0.25));
  const moteOpacity = (night ? 0.5 : dusk ? 0.42 : 0.28) * (weather === "chuva" ? 0.5 : 1);
  const wind = weather === "chuva" ? 1.2 : weather === "neve" ? 0.8 : 0.5;

  const glowSize = night ? 7.5 : dusk ? 6 : 3.4;
  const glowOpacity = night ? 0.85 : dusk ? 0.6 : 0.28;

  return (
    <group ref={censusRef("props")} name="atmosphere">
      {beamsOn
        ? TOWERS.map((tower, i) => (
            <Beam
              key={`beam-${i}`}
              position={tower}
              color={color}
              intensity={intensity}
              haze={haze}
              seed={i * 3.77}
              radius={16 + i * 0.5}
            />
          ))
        : null}
      {quality !== "baixa"
        ? TOWERS.map((tower, i) => (
            <LampGlow
              key={`glow-${i}`}
              position={tower}
              color={color}
              size={glowSize}
              opacity={glowOpacity}
            />
          ))
        : null}
      {moteCount > 0 ? (
        <DustMotes
          count={moteCount}
          color={night ? "#cfe0ff" : "#fff6e6"}
          wind={wind}
          opacity={moteOpacity}
        />
      ) : null}
    </group>
  );
});

export default Atmosphere;
