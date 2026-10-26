import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { CINEMATIC_PITCH_CENTRE_Z } from "@/game/cinematic-pitch";
import { createPitchSurfaceMaterial } from "@/game/pitch-material";
import { useKtx2Revision } from "@/game/textures/ktx2";
import { grassMowPreview } from "../stadium/textures/grass";
import { LINES_H, LINES_W, pitchLinesTexture } from "../stadium/textures/lines";
import { cinematicSurface } from "./cinematic-surfaces";

/** One opaque ground draw, including mowing and paint. The cache owns all
 * shared textures; this component disposes only its private material. */
export function CinematicPitchSurface() {
  const revision = useKtx2Revision();
  const material = useMemo(() => {
    void revision;
    return createPitchSurfaceMaterial({
      albedo: grassMowPreview("stripes"),
      roughness: cinematicSurface("grass", "roughness"),
      normal: cinematicSurface("grass", "normal"),
      normalScale: new THREE.Vector2(0.12, 0.12),
      markings: pitchLinesTexture(),
      wear: null,
      wearOpacity: 0,
      tint: new THREE.Color("#dce5db"),
      wet: 0,
      high: false,
    });
  }, [revision]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group position={[0, 0, CINEMATIC_PITCH_CENTRE_Z]} rotation-y={Math.PI / 2}>
      <mesh rotation-x={-Math.PI / 2} material={material} receiveShadow>
        <planeGeometry args={[LINES_W, LINES_H]} />
      </mesh>
    </group>
  );
}
