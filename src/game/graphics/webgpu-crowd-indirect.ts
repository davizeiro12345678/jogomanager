import * as THREE from "three";
import { IndirectStorageBufferAttribute, type WebGPURenderer } from "three/webgpu";
import { Fn, atomicStore, storage, struct, uint, uniform } from "three/tsl";

/**
 * Native WebGPU drawIndexedIndirect command words:
 * [indexCount, instanceCount, firstIndex, baseVertex, firstInstance].
 * The arguments are written by a GPU compute shader, not a CPU buffer
 * upload. Three r186 uses the same five-word command layout.
 */
export function createCrowdGpuIndirectCommands(
  renderer: Pick<WebGPURenderer, "compute">,
  geometries: readonly THREE.BufferGeometry[],
) {
  const commands: Array<{
    geometry: THREE.BufferGeometry;
    buffer: IndirectStorageBufferAttribute;
    count: ReturnType<typeof uniform>;
    shader: Parameters<WebGPURenderer["compute"]>[0];
  }> = [];
  for (const geometry of geometries) {
    if (geometry.indirect) throw new Error("Geometry already owns an indirect command buffer");
    const wordCount = geometry.index?.count ?? geometry.getAttribute("position").count;
    const count = uniform(0, "uint");
    const buffer = new IndirectStorageBufferAttribute(new Uint32Array(5), 5);
    const drawStruct = struct(
      {
        vertexCount: "uint",
        instanceCount: { type: "uint", atomic: true },
        firstVertex: "uint",
        firstInstance: "uint",
        offset: "uint",
      },
      "CrowdIndirectArgs",
    );
    const args = storage(buffer, drawStruct, buffer.count);
    const shader = Fn(() => {
      args.get("vertexCount").assign(uint(wordCount));
      atomicStore(args.get("instanceCount"), count);
      args.get("firstVertex").assign(uint(0));
      args.get("firstInstance").assign(uint(0));
      args.get("offset").assign(uint(0));
    })().compute(1);
    geometry.setIndirect(buffer);
    commands.push({ geometry, buffer, count, shader });
  }
  let disposed = false;
  return {
    dispatch(visibleCounts: readonly number[]) {
      if (disposed) return;
      for (let tier = 0; tier < commands.length; tier++) {
        const cmd = commands[tier]!;
        const requested = visibleCounts[tier] ?? 0;
        cmd.count.value = Math.max(0, Math.floor(Number.isFinite(requested) ? requested : 0));
        renderer.compute(cmd.shader);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const cmd of commands) {
        if (cmd.geometry.indirect === cmd.buffer) cmd.geometry.indirect = null;
      }
    },
  };
}
