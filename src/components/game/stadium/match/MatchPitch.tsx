import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Puddles } from "../Puddles";
import { GrassField, PitchMarks } from "./PitchGrass";
import { Goal } from "./PitchGoals";
import { CornerFlags } from "./PitchFlags";
import { createPitchSurfaceMaterial } from "@/game/pitch-material";
import {
  grassAlbedo,
  grassMowPreview,
  grassNormal,
  grassMicroRoughness,
  grassRoughness,
  retainGrassMaps,
  type MowPattern,
} from "../textures/grass";
import { LINES_H, LINES_W, pitchLinesTexture } from "../textures/lines";
import { pitchWearTexture } from "../textures/wear";
import { FIELD_X, FIELD_Z } from "@/game/sim-rules";
import type { SimView } from "@/game/sim-types";
import { useResolvedVisual } from "@/game/visual-settings";
import {
  ktx2,
  needsKtx2ProceduralFallback,
  requestKtx2,
  useKtx2Revision,
} from "@/game/textures/ktx2";
import type { Quality } from "./shared";

export function Pitch({
  quality,
  sim,
  wet,
  mow,
  webgl2,
}: {
  quality: Quality;
  sim: SimView;
  wet: number;
  mow: MowPattern;
  webgl2: boolean;
}) {
  // The precompiled albedo is the default checker cut; retain procedural maps
  // for custom mowing patterns and all low-end/offline devices.
  const compressed = quality !== "baixa";
  const grassVariant = mow === "checker" ? "grassAlbedo" : (`grass_${mow}_albedo` as const);
  const textureRevision = useKtx2Revision([
    grassVariant,
    "grassNormal",
    "grassRough",
    "grassDetailRough",
  ]);
  useEffect(() => {
    if (compressed && grassVariant !== "grassAlbedo") requestKtx2([grassVariant]);
  }, [compressed, grassVariant]);
  const tex = useMemo(() => {
    // A newly decoded map invalidates the procedural fallback.
    void textureRevision;
    const compressedMap = compressed ? ktx2(grassVariant) : null;
    // The 1024px procedural pitch is a main-thread startup spike. The solid
    // material remains readable while an immutable KTX2 request is live.
    return (
      compressedMap ??
      (!compressed || needsKtx2ProceduralFallback(grassVariant)
        ? grassAlbedo(mow)
        : grassMowPreview(mow))
    );
  }, [mow, compressed, grassVariant, textureRevision]);
  const rough = useMemo(() => {
    void textureRevision;
    const compressedMap = compressed ? ktx2("grassRough") : null;
    return (
      compressedMap ??
      (!compressed || needsKtx2ProceduralFallback("grassRough") ? grassRoughness(mow) : null)
    );
  }, [mow, compressed, textureRevision]);
  useEffect(() => retainGrassMaps(tex, rough), [tex, rough]);
  // Authored micro-blades only: no broad relief that tints the broadcast pitch.
  // Avoid spawning a second turf worker while compressed maps are in flight.
  const norm = useMemo(() => {
    void textureRevision;
    if (!compressed) return null;
    return (
      ktx2("grassNormal") ?? (needsKtx2ProceduralFallback("grassNormal") ? grassNormal(mow) : null)
    );
  }, [compressed, mow, textureRevision]);
  const microRoughness = useMemo(() => {
    void textureRevision;
    if (quality !== "alta") return null;
    return (
      ktx2("grassDetailRough") ??
      (needsKtx2ProceduralFallback("grassDetailRough") ? grassMicroRoughness() : null)
    );
  }, [quality, textureRevision]);
  const normalScale = useMemo(
    () => new THREE.Vector2(quality === "alta" ? 0.22 : 0.14, quality === "alta" ? 0.22 : 0.14),
    [quality],
  );
  const wear = useMemo(() => (quality === "baixa" ? null : pitchWearTexture()), [quality]);

  // Tom e desgaste do gramado escolhidos em /visual (global ou por clube).
  const vis = useResolvedVisual(sim.home.clubId);
  const tint = useMemo(() => {
    const k = 1 - vis.grassTint * 0.35; // >1 clareia, <1 escurece
    // Retain the club's tint control while giving the turf a cooler chlorophyll
    // base; daylight no longer washes the mower stripes into a yellow carpet.
    return new THREE.Color(k * 0.91, k * 0.98, k * 0.94);
  }, [vis.grassTint]);
  // A textura de desgaste mantém fibras e zonas de uso, mas nunca deve virar
  // uma camada de lama em uma partida seca vista da transmissão.
  const wearOpacity = 0.012 + vis.grassWear * 0.11;
  const markings = useMemo(pitchLinesTexture, []);
  const surface = useMemo(
    () =>
      createPitchSurfaceMaterial({
        albedo: tex,
        roughness: rough,
        microRoughness,
        normal: norm,
        normalScale,
        markings,
        wear,
        wearOpacity,
        tint,
        wet,
        high: quality === "alta",
        mergeLayers: webgl2,
      }),
    [
      tex,
      rough,
      microRoughness,
      norm,
      normalScale,
      markings,
      wear,
      wearOpacity,
      tint,
      wet,
      quality,
      webgl2,
    ],
  );
  useEffect(() => () => surface.dispose(), [surface]);

  return (
    <group>
      <mesh
        name="pitch-underlay"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.04, 0]}
        receiveShadow
      >
        <planeGeometry args={[FIELD_X * 2 + 34, FIELD_Z * 2 + 30]} />
        <meshStandardMaterial color="#124a2a" roughness={1} />
      </mesh>
      <mesh name="pitch-surface" rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[FIELD_X * 2 + 10, FIELD_Z * 2 + 10]} />
        <primitive object={surface} attach="material" />
      </mesh>
      {/* WebGPU uses standard materials; the stable WebGL2 path merges both
          layers in its opaque PBR shader without two field-sized passes. */}
      {!webgl2 && wear ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} renderOrder={1}>
          <planeGeometry args={[LINES_W, LINES_H]} />
          <meshStandardMaterial
            map={wear}
            transparent
            opacity={wearOpacity}
            roughness={0.95}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      ) : null}
      {!webgl2 && markings ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} renderOrder={2}>
          <planeGeometry args={[LINES_W, LINES_H]} />
          <meshStandardMaterial
            map={markings}
            color="#c9cec6"
            transparent
            roughness={0.92}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      ) : null}
      {quality !== "baixa" && <GrassField sim={sim} quality={quality} webgl2={webgl2} />}
      {quality !== "baixa" && <PitchMarks sim={sim} />}
      {quality !== "baixa" && wet > 0.72 ? <Puddles wet={wet} /> : null}
      <Goal side={1} quality={quality} sim={sim} wet={wet} />
      <Goal side={-1} quality={quality} sim={sim} wet={wet} />
      <CornerFlags sim={sim} webgl2={webgl2} />
    </group>
  );
}
