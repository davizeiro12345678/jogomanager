import { OrthographicCamera, Vector3 } from "three";
import { FIELD_X, FIELD_Z, GOAL_NET_DEPTH } from "./sim-rules";

/** Fit the existing shadow map in light space, not world-space pitch axes.
 * Called only when the key light changes. Includes nets and jumping athletes;
 * no new lights, render targets, shadow passes or per-frame matrix work. */
export function matchShadowCamera(keyPosition: readonly [number, number, number]) {
  const camera = new OrthographicCamera();
  camera.position.set(...keyPosition);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const point = new Vector3();
  let left = Infinity,
    right = -Infinity,
    bottom = Infinity,
    top = -Infinity;
  let nearest = Infinity,
    farthest = -Infinity;
  for (const x of [-FIELD_X - GOAL_NET_DEPTH - 1.5, FIELD_X + GOAL_NET_DEPTH + 1.5]) {
    for (const z of [-FIELD_Z - 2.5, FIELD_Z + 2.5]) {
      for (const y of [-0.5, 4]) {
        point.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
        left = Math.min(left, point.x);
        right = Math.max(right, point.x);
        bottom = Math.min(bottom, point.y);
        top = Math.max(top, point.y);
        nearest = Math.min(nearest, -point.z);
        farthest = Math.max(farthest, -point.z);
      }
    }
  }
  return {
    left: Math.floor(left - 1),
    right: Math.ceil(right + 1),
    bottom: Math.floor(bottom - 1),
    top: Math.ceil(top + 1),
    near: Math.max(0.1, nearest - 8),
    far: farthest + 12,
  };
}
