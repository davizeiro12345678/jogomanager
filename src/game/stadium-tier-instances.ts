import {
  stadiumAisleCenters,
  STADIUM_AISLE_WIDTH,
  STADIUM_STAIR_SUBSTEPS,
} from "./stadium-structure";

export interface StadiumTierInstance {
  position: [number, number, number];
  scale: [number, number, number];
  rotationY: number;
}

/** Immutable placements shared by three instanced draws. Unit concrete boxes
 * retain each original box's UVs; chairs retain their authored aisle cutouts.
 * No stadium-sized merged geometry or hidden source hierarchy is required. */
export function stadiumTierInstances(rings: number, fieldX: number, fieldZ: number) {
  const concrete: StadiumTierInstance[] = [];
  const longitudinalSeats: StadiumTierInstance[] = [];
  const endSeats: StadiumTierInstance[] = [];
  const count = Math.max(0, Math.floor(rings));
  for (let row = 0; row < count; row++) {
    const y = 2 + row * 1.45;
    for (const side of [-1, 1]) {
      concrete.push({
        position: [0, y - 0.72, side * (fieldZ + 7 + row * 1.5)],
        scale: [fieldX * 2 + 30, 1.45, 1.5],
        rotationY: 0,
      });
      concrete.push({
        position: [side * (fieldX + 10 + row * 1.5), y - 0.72, 0],
        scale: [1.5, 1.45, fieldZ * 2 + 34],
        rotationY: 0,
      });
      longitudinalSeats.push({
        position: [0, y - 0.6, side * (fieldZ + 7 + row * 1.5 - 0.78)],
        scale: [1, 1, 1],
        rotationY: side > 0 ? Math.PI : 0,
      });
      endSeats.push({
        position: [side * (fieldX + 10 + row * 1.5 - 0.78), y - 0.6, 0],
        scale: [1, 1, 1],
        rotationY: side > 0 ? -Math.PI / 2 : Math.PI / 2,
      });
    }
  }
  const rise = 1.45 / STADIUM_STAIR_SUBSTEPS;
  const run = 1.5 / STADIUM_STAIR_SUBSTEPS;
  for (const center of stadiumAisleCenters(fieldX))
    for (const side of [-1, 1])
      for (let row = 0; row < count; row++)
        for (let tread = 0; tread < STADIUM_STAIR_SUBSTEPS; tread++) {
          const top = 2 + row * 1.45 - 1.45 + (tread + 1) * rise;
          concrete.push({
            position: [
              center,
              top - rise / 2,
              side * (fieldZ + 7 + row * 1.5 - 0.75 + run / 2 + tread * run),
            ],
            scale: [STADIUM_AISLE_WIDTH, rise, run + 0.02],
            rotationY: 0,
          });
        }
  return { concrete, longitudinalSeats, endSeats };
}
