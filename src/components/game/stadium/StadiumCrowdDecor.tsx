import { crowdBackdropRing } from "@/game/crowd-backdrop-geometry";
import type { SimView } from "@/game/sim-contracts";
import { FIELD_X, FIELD_Z } from "@/game/sim-rules";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { bannerTexture, mosaicTexture } from "./textures/tifo";

/**
 * Faixas de torcida organizada e mosaico de cartolinas dos setores atrás
 * dos gols — o que se vê primeiro numa panorâmica de transmissão.
 */
export function Banners({ color, alt, rings }: { color: string; alt: string; rings: number }) {
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
                forceSinglePass
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
function crowdBackdropTexture(homeColor: string, awayColor: string, occupancy: number) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

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
      if (random() > occupancy || col % 29 < 2) continue;
      const x = 3 + col * 12 + random() * 2;
      const sector = col / columns;
      const shirt =
        sector < 0.3
          ? homeColor
          : sector > 0.82
            ? awayColor
            : neutral[(row * 3 + col) % neutral.length]!;
      const height = 7 + random() * 5;
      const shoulder = 7 + random() * 2;
      // Shoulder slope, neck, arms and occlusion replace the rectangular
      // shirt grid while retaining the same atlas and four background draws.
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 6);
      ctx.lineTo(x - 0.5, y + 8);
      ctx.lineTo(x + 0.7, y + height + 5);
      ctx.lineTo(x + shoulder, y + height + 5);
      ctx.lineTo(x + shoulder + 1, y + 8);
      ctx.lineTo(x + shoulder - 1, y + 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.20)";
      ctx.fillRect(x + 1, y + height + 2, shoulder - 1, 3);
      ctx.fillStyle = "rgba(255,245,225,0.12)";
      ctx.fillRect(x + 1.2, y + 7, shoulder - 1, 1);
      ctx.fillStyle = ["#f0c9a5", "#d79d70", "#9b603a", "#70401f"][Math.floor(random() * 4)]!;
      ctx.fillRect(x + 3.2, y + 4.8, 2.6, 2);
      ctx.beginPath();
      ctx.ellipse(x + 4.5, y + 3.5, 2.7 + random() * 0.5, 3.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ["#29231f", "#44342c", "#1d2023", "#77716a"][Math.floor(random() * 4)]!;
      ctx.beginPath();
      ctx.ellipse(x + 4.5, y + 2, 3, 1.8, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      if ((row + col) % 7 === 0) {
        ctx.strokeStyle = shirt;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, y + 8);
        ctx.lineTo(x - 2, y + 2);
        ctx.lineTo(x - 1, y - 2);
        ctx.stroke();
      }
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

export function CrowdBackdrop({
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
  const texture = useMemo(
    () => crowdBackdropTexture(homeColor, awayColor, occupancy),
    [homeColor, awayColor, occupancy],
  );
  const geometry = useMemo(() => crowdBackdropRing(rings), [rings]);
  useEffect(() => () => texture?.dispose(), [texture]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (!texture) return null;
  return (
    <group renderOrder={1}>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={1}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
          forceSinglePass
        />
      </mesh>
    </group>
  );
}

/**
 * Bandeirões da torcida: planos com ondulação no vertex shader, espalhados
 * pelas arquibancadas nas cores dos dois clubes.
 */
export function CrowdFlags({
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
