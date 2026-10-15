// ============================================================================
//  SidelineLife.tsx
//  Vida na lateral do gramado: fotógrafos ajoelhados atrás dos gols (com
//  flashes que disparam sozinhos e enlouquecem no gol), gandulas, seguranças
//  de colete e o 4º árbitro com o placar de substituição.
//
//  Custo: 4 malhas mescladas + 1 instanciada (flashes). Nada é criado por
//  quadro — os flashes reciclam 6 instâncias com envelope de decaimento.
// ============================================================================

import { useFrame } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import type React from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { censusRef } from "@/game/scene-census";
import { SidelineFlashBatch } from "@/game/sideline-flash-batch";
import { FIELD_X, FIELD_Z } from "@/game/sim";

type FigureOpts = {
  /** altura total aproximada */
  h: number;
  /** cores: torso, pernas, cabeça/câmara extra */
  torso: string;
  legs: string;
  skin?: string;
  /** agachado (fotógrafo) ou em pé */
  kneel?: boolean;
  /** com câmera na frente do rosto */
  camera?: boolean;
};

/** Enfileira as peças de um boneco simples com cor por vértice. */
function pushFigure(geos: THREE.BufferGeometry[], x: number, z: number, ry: number, o: FigureOpts) {
  const tmp = new THREE.Color();
  const paint = (g: THREE.BufferGeometry, color: string) => {
    tmp.set(color);
    const n = g.getAttribute("position").count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) tmp.toArray(colors, i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  };
  const put = (g: THREE.BufferGeometry, y: number, sx = 1, sy = 1, sz = 1) => {
    g.scale(sx, sy, sz);
    g.rotateY(ry);
    g.translate(x, y, z);
    geos.push(g);
  };
  const s = o.h / 1.8;
  const skin = o.skin ?? "#c98f62";
  if (o.kneel) {
    // torso inclinado à frente, pernas dobradas (só o volume aparece)
    put(paint(new THREE.CapsuleGeometry(0.21 * s, 0.3 * s, 3, 8), o.torso), 0.62 * s, 1, 1, 0.9);
    put(paint(new THREE.BoxGeometry(0.34 * s, 0.22 * s, 0.3 * s), o.legs), 0.2 * s);
    put(paint(new THREE.SphereGeometry(0.14 * s, 8, 8), skin), 1.02 * s);
  } else {
    put(paint(new THREE.CapsuleGeometry(0.2 * s, 0.52 * s, 3, 8), o.torso), 1.05 * s);
    put(paint(new THREE.BoxGeometry(0.3 * s, 0.5 * s, 0.24 * s), o.legs), 0.32 * s);
    put(paint(new THREE.SphereGeometry(0.15 * s, 8, 8), skin), 1.62 * s);
  }
  if (o.camera) {
    // corpo da câmera + teleobjetiva apontando para o campo
    const camY = (o.kneel ? 0.92 : 1.5) * s;
    const lens = new THREE.CylinderGeometry(0.07 * s, 0.09 * s, 0.34 * s, 8);
    lens.rotateX(Math.PI / 2);
    lens.rotateY(ry);
    const fx = x - Math.sin(ry) * 0.3 * s;
    const fz = z - Math.cos(ry) * 0.3 * s;
    lens.translate(fx, camY, fz);
    geos.push(paint(lens, "#15181c"));
    const body = new THREE.BoxGeometry(0.22 * s, 0.16 * s, 0.18 * s);
    body.rotateY(ry);
    body.translate(x - Math.sin(ry) * 0.12 * s, camY, z - Math.cos(ry) * 0.12 * s);
    geos.push(paint(body, "#22262b"));
  }
}

function mergeFigures(geos: THREE.BufferGeometry[]) {
  const merged = mergeGeometries(geos, false)!;
  geos.forEach((g) => g.dispose());
  return merged;
}

/** Placa de substituição do 4º árbitro (entra 7, sai 10). */
function subBoardTexture() {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 160;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#101114";
  c.fillRect(0, 0, 128, 160);
  c.strokeStyle = "#3a3d42";
  c.lineWidth = 6;
  c.strokeRect(4, 4, 120, 152);
  c.textAlign = "center";
  c.font = "700 52px sans-serif";
  c.fillStyle = "#37d67a";
  c.fillText("7 ▲", 64, 66);
  c.fillStyle = "#ff5a5a";
  c.fillText("10 ▼", 64, 130);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const skinMaterial = () =>
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });

export const SidelineLife = memo(function SidelineLife({
  goalPulse,
}: {
  goalPulse: React.MutableRefObject<number>;
}) {
  const photographers = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      for (const z of [-4.2, 0, 4.2]) {
        pushFigure(geos, side * (FIELD_X + 3.6), z, side > 0 ? -Math.PI / 2 : Math.PI / 2, {
          h: 1.7,
          torso: "#2b3038",
          legs: "#1d2126",
          kneel: true,
          camera: true,
        });
      }
    }
    return mergeFigures(geos);
  }, []);

  const ballBoys = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];
    const spots: [number, number, number][] = [
      [FIELD_X + 2.6, FIELD_Z * 0.55, -Math.PI / 2],
      [-(FIELD_X + 2.6), -FIELD_Z * 0.55, Math.PI / 2],
      [FIELD_X * 0.5, FIELD_Z + 2.6, Math.PI],
      [-FIELD_X * 0.5, -(FIELD_Z + 2.6), 0],
      [-(FIELD_X * 0.55), FIELD_Z + 2.6, Math.PI],
      [FIELD_X * 0.55, -(FIELD_Z + 2.6), 0],
    ];
    for (const [x, z, ry] of spots) {
      pushFigure(geos, x, z, ry, { h: 1.35, torso: "#f2c20d", legs: "#23262b" });
    }
    return mergeFigures(geos);
  }, []);

  const stewards = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];
    // anel de seguranças entre o gramado e a arquibancada
    for (let i = 0; i < 6; i++) {
      const t = -0.8 + (i / 5) * 1.6;
      pushFigure(geos, t * FIELD_X, FIELD_Z + 4.4, Math.PI, {
        h: 1.8,
        torso: "#ff7a1a",
        legs: "#23262b",
      });
      pushFigure(geos, t * FIELD_X, -(FIELD_Z + 4.4), 0, {
        h: 1.8,
        torso: "#ff7a1a",
        legs: "#23262b",
      });
    }
    for (const side of [-1, 1]) {
      pushFigure(geos, side * (FIELD_X + 6.2), 0, side > 0 ? -Math.PI / 2 : Math.PI / 2, {
        h: 1.8,
        torso: "#ff7a1a",
        legs: "#23262b",
      });
    }
    // 4º árbitro com a placa, na altura do meio-campo
    pushFigure(geos, 2.2, FIELD_Z + 3.1, Math.PI, { h: 1.78, torso: "#14161a", legs: "#14161a" });
    return mergeFigures(geos);
  }, []);

  const board = useMemo(() => subBoardTexture(), []);
  const cloth = useMemo(() => skinMaterial(), []);
  useEffect(
    () => () => {
      photographers.dispose();
      ballBoys.dispose();
      stewards.dispose();
      board.dispose();
      cloth.dispose();
    },
    [photographers, ballBoys, stewards, board, cloth],
  );

  // ---- flashes: 6 fotógrafos, cada um com ciclo próprio; no gol, rajada
  const flashes = useRef<THREE.InstancedMesh>(null);
  const flashState = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        x: (i < 3 ? 1 : -1) * (FIELD_X + 3.1),
        z: [-4.2, 0, 4.2][i % 3]!,
        next: Math.random() * 3,
        heat: 0,
      })),
    [],
  );
  const flashBatch = useMemo(() => new SidelineFlashBatch(6), []);
  useFrame((_, rawDt) => {
    const mesh = flashes.current;
    if (!mesh) return;
    const dt = Math.min(rawDt, 0.05);
    const frenzy = goalPulse.current > 0.4 ? 5 : 1;
    for (let i = 0; i < flashState.length; i++) {
      const f = flashState[i]!;
      f.next -= dt * frenzy;
      if (f.next <= 0) {
        f.next = 0.4 + Math.random() * 3.2;
        f.heat = 1;
      }
      f.heat = Math.max(0, f.heat - dt * 9);
    }
    flashBatch.paint(mesh, flashState);
  });

  return (
    <group ref={censusRef("props")} name="sideline-life">
      <mesh geometry={photographers} material={cloth} />
      <mesh geometry={ballBoys} material={cloth} />
      <mesh geometry={stewards} material={cloth} />
      {/* placa de substituição na mão do 4º árbitro */}
      <mesh position={[2.2, 1.75, FIELD_Z + 2.85]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.52, 0.65]} />
        <meshBasicMaterial map={board} toneMapped={false} />
      </mesh>
      <instancedMesh
        ref={flashes}
        args={[undefined, undefined, 6]}
        frustumCulled={false}
        visible={false}
      >
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
});
