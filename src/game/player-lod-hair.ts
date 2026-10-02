import * as THREE from "three";
import type { HairStyle } from "./player-model";
import { lookFor } from "./player-model";
import { mergeRigParts, rigPart } from "./rig-geometry";
import { sculptedHair } from "./player-sculpt";

export const LOW_HAIR_FAMILIES = ["cropped", "textured", "tied", "crest"] as const;
export type LowHairFamily = (typeof LOW_HAIR_FAMILIES)[number];

export function lowHairFamily(style: HairStyle): LowHairFamily {
  if (style === "afro" || style === "curly" || style === "dreads") return "textured";
  if (style === "bun" || style === "ponytail" || style === "braids") return "tied";
  return style === "mohawk" ? "crest" : "cropped";
}

/** Four immutable meshes cover the haircut silhouettes of the whole team.
 * Material batching stays independent of the number of players. */
export function lowHairGeometry(family: LowHairFamily) {
  const P = { headR: 0.5, headW: 0.5, headD: 0.5 };
  const style =
    family === "textured"
      ? "curly"
      : family === "tied"
        ? "bun"
        : family === "crest"
          ? "mohawk"
          : "short";
  const look = { ...lookFor("lod-hair", "MF"), hairStyle: style as HairStyle, hairVolume: 1 };
  const material = new THREE.MeshBasicMaterial();
  const parts = [rigPart(sculptedHair(P, look, false), material)];
  if (family === "tied")
    parts.push(
      rigPart(new THREE.SphereGeometry(0.15, 8, 6), material, {
        position: [0, 0.24, -0.47],
        scale: [1, 0.88, 0.8],
      }),
    );
  if (family === "crest")
    parts.push(
      rigPart(new THREE.SphereGeometry(0.375, 10, 8), material, {
        position: [0, 0.455, -0.05],
        scale: [0.18, 0.43, 1.12],
      }),
    );
  const geometry = mergeRigParts(parts)[0]!.geometry;
  material.dispose();
  return geometry;
}
