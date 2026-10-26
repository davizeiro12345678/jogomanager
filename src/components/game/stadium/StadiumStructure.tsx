/** Stadium architecture, grandstands, crowds and signage.
 * Geometry and resource lifecycles are isolated from match broadcast logic.
 */
import {
  useQualityPressure,
  useRuntimeSceneBudget,
} from "@/components/game/runtime-budget-context";
import type { SupporterMatchday } from "@/game/career-world-types";
import { censusRef } from "@/game/scene-census";
import type { SimView } from "@/game/sim-contracts";
import { FIELD_X, FIELD_Z } from "@/game/sim-rules";
import { stadiumBackgroundMaterial } from "@/game/stadium-background-material";
import {
  STADIUM_AISLE_WIDTH,
  stadiumAisleCenters,
  stadiumRoofStructure,
  stadiumSeatFront,
} from "@/game/stadium-structure";
import { bakeStadiumTierGeometry } from "@/game/stadium-tier-baked";
import { stadiumTierInstances, type StadiumTierInstance } from "@/game/stadium-tier-instances";
import { ktx2, needsKtx2ProceduralFallback, useKtx2Revision } from "@/game/textures/ktx2";
import { useVisual } from "@/game/visual-settings";
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Quality } from "../Stadium3D";
import { ArenaArchitecture } from "./ArenaArchitecture";
import { CrowdLod } from "./CrowdLod";
import { StaticBatch } from "./StaticBatch";
import { concreteAlbedo, concreteRoughness, seatsTexture } from "./textures/concrete";
import { bannerTexture, mosaicTexture } from "./textures/tifo";

function useConcrete(color = "#6d747b", repeat = 6, high = false) {
  const textureRevision = useKtx2Revision();
  const material = useMemo(() => {
    void textureRevision;
    const compressedMap = high ? ktx2("concreteAlbedo") : null;
    const compressedRough = high ? ktx2("concreteRough") : null;
    const map =
      compressedMap ??
      (!high || needsKtx2ProceduralFallback("concreteAlbedo") ? concreteAlbedo() : null);
    const rough =
      compressedRough ??
      (!high || needsKtx2ProceduralFallback("concreteRough") ? concreteRoughness() : null);
    const m = new THREE.MeshStandardMaterial({
      // Albedo already contains concrete pigmentation. Multiplying it by a
      // second dark grey crushed all panel detail, especially on the stairs.
      color: map ? new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.82) : color,
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

/** Three meshes replace the former tiers' hidden source hierarchy. Instances
 * are immutable after layout; bounds are computed once for camera culling. */
function TierInstances({
  geometry,
  material,
  placements,
  receiveShadow = false,
  batching,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  placements: StadiumTierInstance[];
  receiveShadow?: boolean;
  batching: "instanced" | "merged" | "legacy";
}) {
  const baked = useMemo(
    () => (batching === "merged" ? bakeStadiumTierGeometry(geometry, placements) : null),
    [batching, geometry, placements],
  );
  useEffect(() => () => baked?.dispose(), [baked]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    return () => mesh?.dispose();
  }, [geometry, material, placements.length]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const transform = new THREE.Object3D();
    placements.forEach((placement, index) => {
      transform.position.fromArray(placement.position);
      transform.scale.fromArray(placement.scale);
      transform.rotation.set(0, placement.rotationY, 0);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.count = placements.length;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [geometry, material, placements]);
  if (batching === "merged")
    return (
      <mesh geometry={baked!} material={material} receiveShadow={receiveShadow} dispose={null} />
    );
  if (batching === "legacy")
    return (
      <group>
        {placements.map((placement, index) => (
          <mesh
            key={index}
            geometry={geometry}
            material={material}
            position={placement.position}
            scale={placement.scale}
            rotation={[0, placement.rotationY, 0]}
            receiveShadow={receiveShadow}
            dispose={null}
          />
        ))}
      </group>
    );
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, Math.max(1, placements.length)]}
      receiveShadow={receiveShadow}
      dispose={null}
    />
  );
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
  const sceneTier = useRuntimeSceneBudget().tier;
  const physical =
    sceneTier === "cinema" ||
    (typeof location !== "undefined" &&
      location.pathname.endsWith("/graphics-benchmark.html") &&
      new URLSearchParams(location.search).get("backgroundLighting") === "legacy");
  // Match profiles share immutable placements in three draws. A texture
  // revision can otherwise expose 748 authoring meshes while a high-quality
  // legacy batch settles again. Cinema keeps its separate existing path.
  const requestedBatch =
    typeof location !== "undefined" && location.pathname.includes("graphics-benchmark")
      ? new URLSearchParams(location.search).get("tierBatch")
      : null;
  const batching =
    requestedBatch === "instanced" || requestedBatch === "merged" || requestedBatch === "legacy"
      ? requestedBatch
      : sceneTier === "cinema"
        ? "legacy"
        : "instanced";
  const lenX = FIELD_X * 2 + 30;
  const lenZ = FIELD_Z * 2 + 34;
  const physicalConcrete = useConcrete("#5f666d", 10, high);
  const concrete = useMemo(
    () => (physical ? physicalConcrete : stadiumBackgroundMaterial(physicalConcrete)),
    [physical, physicalConcrete],
  );
  useEffect(
    () => () => {
      if (concrete !== physicalConcrete) concrete.dispose();
    },
    [concrete, physicalConcrete],
  );
  const chairFront = useMemo(
    () => stadiumSeatFront(lenX, 1.2, stadiumAisleCenters(FIELD_X)),
    [lenX],
  );
  useEffect(() => () => chairFront.dispose(), [chairFront]);

  const seatMat = useMemo(() => {
    const t = seatsTexture(homeColor, awayColor);
    const m = physical
      ? new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.82 })
      : new THREE.MeshLambertMaterial({ color: "#ffffff" });
    if (t) {
      const c = t.clone();
      c.needsUpdate = true;
      // A dedicated single-row atlas gives ~55cm chairs on this 1.2m riser.
      // Its horizontal repeat is derived from metres, never from tier count.
      c.repeat.set(lenX / (8 * 0.55), 1);
      m.map = c;
    } else {
      m.color = new THREE.Color(homeColor);
    }
    return m;
  }, [homeColor, awayColor, lenX, physical]);
  const seatMatSide = useMemo(() => {
    const c = seatMat.clone();
    if (c.map) {
      const t = c.map.clone();
      t.needsUpdate = true;
      t.repeat.set(lenZ / (8 * 0.55), 1);
      c.map = t;
    }
    return c;
  }, [seatMat, lenZ]);
  useEffect(
    () => () => {
      seatMat.map?.dispose();
      seatMatSide.map?.dispose();
      seatMat.dispose();
      seatMatSide.dispose();
    },
    [seatMat, seatMatSide],
  );

  const placements = useMemo(() => stadiumTierInstances(rings, FIELD_X, FIELD_Z), [rings]);
  const concreteGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const endGeometry = useMemo(() => new THREE.PlaneGeometry(lenZ, 1.2), [lenZ]);
  useEffect(
    () => () => {
      concreteGeometry.dispose();
      endGeometry.dispose();
    },
    [concreteGeometry, endGeometry],
  );

  const buckets = (
    <>
      <TierInstances
        geometry={concreteGeometry}
        material={concrete}
        placements={placements.concrete}
        receiveShadow
        batching={batching}
      />
      <TierInstances
        geometry={chairFront}
        material={seatMat}
        placements={placements.longitudinalSeats}
        batching={batching}
      />
      <TierInstances
        geometry={endGeometry}
        material={seatMatSide}
        placements={placements.endSeats}
        batching={batching}
      />
    </>
  );
  return batching === "legacy" ? (
    <StaticBatch signature={`tiers:${rings}:${concrete.uuid}:${seatMat.uuid}:${seatMatSide.uuid}`}>
      {buckets}
    </StaticBatch>
  ) : (
    <group ref={censusRef("static")}>{buckets}</group>
  );
}

function Roof({ rings }: { rings: number }) {
  const outer = 9 + rings * 1.5;
  const depth = 12;
  const height = 2.0 + rings * 1.45 + 7;
  const structure = useMemo(() => stadiumRoofStructure(rings, FIELD_X, FIELD_Z), [rings]);
  useEffect(() => () => structure.dispose(), [structure]);
  return (
    <StaticBatch signature={`roof:${rings}`}>
      <mesh geometry={structure}>
        <meshStandardMaterial color="#5a6672" roughness={0.7} metalness={0.35} />
      </mesh>
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

const CROWD_BACKDROP_TEXTURE_ASPECT = 1024 / 320;

/**
 * O painel longitudinal é muito mais largo que o canvas de torcedores.
 * Repetir somente o U com base na proporção do painel corrige a leitura dos
 * espectadores em planos abertos, sem criar outro material, textura ou draw.
 */
function crowdBackdropGeometry(width: number, height: number, depth: number) {
  const geometry = new THREE.PlaneGeometry(width, height);
  // Follow the rake of the terraces. A vertical panel at the rear was hidden
  // by nearly every concrete tier, leaving only its top row visible.
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let index = 0; index < position.count; index++)
    position.setZ(index, (position.getY(index) * depth) / height);
  geometry.computeVertexNormals();
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
  const texture = useMemo(
    () => crowdBackdropTexture(homeColor, awayColor, occupancy),
    [homeColor, awayColor, occupancy],
  );
  useEffect(() => () => texture?.dispose(), [texture]);
  const height = Math.max(9, rings * 1.45 + 0.6);
  const depth = rings * 1.5;
  // Dois buffers compartilhados entre quatro painéis: a mesma cobertura de
  // arquibancada, com o mesmo orçamento de quatro draws.
  const longitudinalGeometry = useMemo(
    () => crowdBackdropGeometry(FIELD_X * 2 + 24, height, depth),
    [height, depth],
  );
  const endGeometry = useMemo(
    () => crowdBackdropGeometry(FIELD_Z * 2 + 18, height, depth),
    [height, depth],
  );
  useEffect(
    () => () => {
      longitudinalGeometry.dispose();
      endGeometry.dispose();
    },
    [longitudinalGeometry, endGeometry],
  );
  if (!texture) return null;
  const y = 3.2 + height * 0.5;
  const zEdge = FIELD_Z + 6.5 + depth * 0.5;
  const xEdge = FIELD_X + 9.5 + depth * 0.5;
  return (
    <group renderOrder={1}>
      {[-1, 1].map((z) => (
        <mesh
          key={`crowd-z-${z}`}
          geometry={longitudinalGeometry}
          position={[0, y, z * zEdge]}
          rotation={[0, z > 0 ? 0 : Math.PI, 0]}
        >
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
      ))}
      {[-1, 1].map((x) => (
        <mesh
          key={`crowd-x-${x}`}
          geometry={endGeometry}
          position={[x * xEdge, y, 0]}
          rotation={[0, x > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
        >
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
      ))}
    </group>
  );
}

export function Stands({
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
        if (
          stadiumAisleCenters(FIELD_X).some(
            (aisle) => Math.abs(px - aisle) < STADIUM_AISLE_WIDTH / 2 + 0.45,
          )
        )
          continue;
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
