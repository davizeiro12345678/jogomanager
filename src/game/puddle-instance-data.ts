import * as THREE from "three";

export const PUDDLE_COUNT = 12;
export const PUDDLE_HEIGHT = 0.014;

/** Exact seeded placements and ellipse scales from the original match puddles.
 * Keep the original floating-point LCG; replacing it with imul changes the layout. */
export function buildPuddleInstanceMatrices(fieldX: number, fieldZ: number): Float32Array {
  const matrices = new Float32Array(PUDDLE_COUNT * 16);
  const transform = new THREE.Object3D();
  transform.rotation.set(-Math.PI / 2, 0, 0);
  let seed = 0x9e37;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let index = 0; index < PUDDLE_COUNT; index++) {
    const x = (random() * 2 - 1) * fieldX * 0.95;
    const z = (random() * 2 - 1) * fieldZ * 0.95;
    const rx = 0.55 + random() * 1.45;
    const rz = 0.35 + random() * 0.95;
    transform.position.set(x, PUDDLE_HEIGHT, z);
    transform.scale.set(rx, rz, 1);
    transform.updateMatrix();
    matrices.set(transform.matrix.elements, index * 16);
  }
  return matrices;
}
