import * as THREE from "three";
import {
  anatomicalLimb,
  anatomicalSection,
  athleticTorsoSurface,
  fittedLimbCover,
  footballBoot,
} from "./rig-geometry";
import { sculptedHead } from "./player-sculpt";
import { lowShortsGeometry } from "./player-lod-shorts";
import { LOW_HAIR_FAMILIES, lowHairGeometry } from "./player-lod-hair";
import { articulateLowTorso } from "./player-lod-torso";

/** Distant bodies use the same anatomical landmarks with one sample per span.
 * At match-camera scale extra intermediate rings add vertices without detail. */
export function createLowPlayerGeometries(): Record<string, THREE.BufferGeometry> {
  const geometries: Record<string, THREE.BufferGeometry> = {
    torso: articulateLowTorso(
      athleticTorsoSurface(
        anatomicalSection(
          [
            { y: -0.5, width: 0.38, depth: 0.42 },
            { y: -0.15, width: 0.44, depth: 0.47 },
            { y: 0.22, width: 0.5, depth: 0.5 },
            { y: 0.38, width: 0.46, depth: 0.45 },
            { y: 0.5, width: 0.22, depth: 0.25 },
          ],
          10,
          1,
          true,
          1,
        ).translate(0, 0.5, 0),
        0.5,
        1,
      ).translate(0, -0.5, 0),
    ),
    hips: lowShortsGeometry(),
    head: sculptedHead({ headR: 0.5, headW: 0.5, headD: 0.5 }, 0, false, false, {
      columns: 12,
      rows: 14,
    }),
    boots: footballBoot(1, 0.5, 8, false, 1),
    arms: anatomicalLimb("upperArm", 1, 0.5, 8, true, 1).translate(0, 0.5, 0),
    forearms: anatomicalLimb("forearm", 1, 0.5, 8, true, 1).translate(0, 0.5, 0),
    thighs: fittedLimbCover("thigh", 1, 0.5, 8, 0.43, 0, 1.035, 1).translate(0, 0.5, 0),
    shins: anatomicalLimb("calf", 1, 0.5, 8, true, 1).translate(0, 0.5, 0),
    hands: new THREE.SphereGeometry(0.5, 8, 6),
    sleeves: new THREE.CylinderGeometry(0.46, 0.5, 1, 8, 1),
    neck: new THREE.CylinderGeometry(0.4, 0.5, 1, 8),
    shadow: new THREE.CircleGeometry(1, 12),
  };
  for (const family of LOW_HAIR_FAMILIES) geometries[family] = lowHairGeometry(family);
  for (const [name, top] of Object.entries({ socksLow: 0.62, socksMid: 0.38, socksHigh: 0.15 }))
    geometries[name] = fittedLimbCover("calf", 1, 0.5, 8, top, 0.014, 1.035, 1);
  return geometries;
}
