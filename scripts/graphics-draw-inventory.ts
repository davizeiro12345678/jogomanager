import { _roots } from "@react-three/fiber";
import type { Mesh, Material, WebGLRenderer } from "three";
import {
  subscribeRenderedFrames,
  type RenderedFrameSample,
} from "../src/components/game/graphics-probe";

// Isolated graphics entry only. Never imported by the application bundle.
const wrapped = new WeakSet<Mesh>(),
  renderers = new WeakSet<WebGLRenderer>();
const records = new Map<string, { mesh: Mesh; count: number }>();
const frames: RenderedFrameSample[] = [];
export function readDrawInventory() {
  const active = new Set<Mesh>();
  for (const root of _roots.values()) {
    const { scene, gl } = root.store.getState();
    const renderer = gl as WebGLRenderer;
    if (!renderers.has(renderer)) {
      renderers.add(renderer);
      subscribeRenderedFrames(renderer, (frame) => {
        if (frames.length < 120000) frames.push(frame);
      });
    }
    scene.traverseVisible((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      active.add(mesh);
      if (wrapped.has(mesh)) return;
      wrapped.add(mesh);
      const record = { mesh, count: 0 },
        prior = mesh.onBeforeRender;
      records.set(mesh.uuid, record);
      mesh.onBeforeRender = function (...args) {
        record.count++;
        prior.apply(this, args);
      };
    });
  }
  const result = {
    frames: frames.splice(0),
    objects: [...records.values()]
      .filter((record) => record.count > 0 && active.has(record.mesh))
      .map(({ mesh, count }) => {
        const ancestors: string[] = [];
        for (let node = mesh.parent; node; node = node.parent)
          if (node.name || node.userData["census"])
            ancestors.push(node.name || String(node.userData["census"]));
        const material = (
          Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
        ) as Material & { color?: { getHexString: () => string }; forceSinglePass?: boolean };
        return {
          name: mesh.name,
          ancestors,
          count,
          type: mesh.type,
          geometry: mesh.geometry.type,
          position: [
            mesh.matrixWorld.elements[12],
            mesh.matrixWorld.elements[13],
            mesh.matrixWorld.elements[14],
          ],
          triangles:
            (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position")?.count ?? 0) / 3,
          material: material.type,
          color: material.color?.getHexString(),
          transparent: material.transparent,
          side: material.side,
          forceSinglePass: material.forceSinglePass,
        };
      }),
  };
  for (const record of records.values()) record.count = 0;
  return result;
}
