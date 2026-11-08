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
  stadiumSeatFront,
} from "@/game/stadium-structure";
import { bakeStadiumTierGeometry } from "@/game/stadium-tier-baked";
import { stadiumTierInstances, type StadiumTierInstance } from "@/game/stadium-tier-instances";
import { ktx2, needsKtx2ProceduralFallback, useKtx2Revision } from "@/game/textures/ktx2";
import { useVisual } from "@/game/visual-settings";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Quality } from "../Stadium3D";
import { ArenaArchitecture } from "./ArenaArchitecture";
import { CrowdLod } from "./CrowdLod";
import { StaticBatch } from "./StaticBatch";
import { concreteAlbedo, concreteRoughness, seatsTexture } from "./textures/concrete";
import { Banners, CrowdBackdrop, CrowdFlags } from "./StadiumCrowdDecor";
import { StadiumRoof } from "./StadiumRoof";

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
      <StadiumRoof rings={rings} />
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
