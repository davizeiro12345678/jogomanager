import { _roots } from "@react-three/fiber";
import type { Mesh, Material, MeshStandardMaterial, WebGLRenderer } from "three";
import {
  subscribeRenderedFrames,
  type RenderedFrameSample,
} from "../src/components/game/graphics-probe";

// Isolated graphics entry only. Never imported by the application bundle.
const renderers = new WeakSet<WebGLRenderer>();
const records = new Map<string, { mesh: Mesh; count: number }>();
const frames: RenderedFrameSample[] = [];
export function readDrawInventory() {
  const active = new Set<Mesh>();
  const staticBatches: Array<{
    sources: number;
    generated: number;
    batches: number;
    eligible: number;
  }> = [];
  for (const root of _roots.values()) {
    const { scene, gl } = root.store.getState();
    const renderer = gl as WebGLRenderer;
    if (!renderers.has(renderer)) {
      renderers.add(renderer);
      subscribeRenderedFrames(renderer, (frame) => {
        if (frames.length < 120000) frames.push(frame);
      });
      const renderBufferDirect = renderer.renderBufferDirect.bind(renderer);
      renderer.renderBufferDirect = (camera, renderScene, geometry, material, object, group) => {
        const mesh = object as Mesh;
        if (mesh.isMesh) {
          let record = records.get(mesh.uuid);
          if (!record) {
            record = { mesh, count: 0 };
            records.set(mesh.uuid, record);
          }
          record.count += 1;
        }
        renderBufferDirect(camera, renderScene, geometry, material, object, group);
      };
    }
    scene.traverseVisible((object) => {
      const batch = object.userData["staticBatch"] as
        | {
            sources?: readonly unknown[];
            generated?: readonly unknown[];
            batches?: number;
            eligible?: number;
          }
        | undefined;
      if (batch)
        staticBatches.push({
          sources: batch.sources?.length ?? 0,
          generated: batch.generated?.length ?? 0,
          batches: batch.batches ?? 0,
          eligible: batch.eligible ?? 0,
        });
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      active.add(mesh);
      if (!records.has(mesh.uuid)) records.set(mesh.uuid, { mesh, count: 0 });
    });
  }
  const result = {
    frames: frames.splice(0),
    staticBatches,
    objects: [...records.values()]
      .filter((record) => record.count > 0)
      .map(({ mesh, count }) => {
        const ancestors: string[] = [];
        for (let node = mesh.parent; node; node = node.parent)
          if (node.name || node.userData["census"])
            ancestors.push(node.name || String(node.userData["census"]));
        const material = (
          Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
        ) as Material & { color?: { getHexString: () => string }; forceSinglePass?: boolean };
        return {
          inScene: active.has(mesh),
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
          staticBatchGenerated: mesh.userData["staticBatchGenerated"] === true,
          roughness: (material as MeshStandardMaterial).roughness,
          metalness: (material as MeshStandardMaterial).metalness,
          map: (material as MeshStandardMaterial).map?.uuid,
          attributes: Object.keys(mesh.geometry.attributes),
        };
      }),
  };
  for (const record of records.values()) record.count = 0;
  return result;
}
