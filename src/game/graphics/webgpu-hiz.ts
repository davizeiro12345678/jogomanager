import * as THREE from "three";
import { StorageTexture, type WebGPURenderer } from "three/webgpu";
import {
  Fn,
  NodeAccess,
  float,
  instanceIndex,
  int,
  ivec2,
  max,
  min,
  storageTexture,
  textureLoad,
  textureStore,
  vec4,
} from "three/tsl";

type DepthTextureSource = Parameters<typeof textureLoad>[0];

/** Every level is a conservative MAX-depth reduction (near=0, far=1).
 * A distant pixel behind a depth discontinuity must never be discarded
 * merely because an adjacent texel is closer. All texels stay on the GPU. */
export function depthPyramidDimensions(width: number, height: number) {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 || height < 1 || width > 8192 || height > 8192
  ) throw new RangeError("Invalid GPU depth resolution");
  const sizes: Array<readonly [number, number]> = [];
  while (width > 1 || height > 1) {
    width = Math.max(1, Math.ceil(width / 2));
    height = Math.max(1, Math.ceil(height / 2));
    sizes.push([width, height]);
  }
  return sizes;
}

export interface GpuDepthPyramid {
  readonly textures: readonly StorageTexture[];
  compute(): void;
  dispose(): void;
}

/** Native WebGPU compute; consumes the depth target of the *completed*
 * scene render pass. This must run after the depth-producing render pipeline,
 * never while the target is still bound for depth writes. */
export function createWebGpuDepthPyramid(
  renderer: Pick<WebGPURenderer, "compute">,
  sourceDepth: DepthTextureSource,
  width: number,
  height: number,
): GpuDepthPyramid {
  const sizes = depthPyramidDimensions(width, height);
  const textures: StorageTexture[] = [];
  const passes: Array<Parameters<WebGPURenderer["compute"]>[0]> = [];
  let input: DepthTextureSource = sourceDepth;
  let inputWidth = width;
  let inputHeight = height;
  for (const [w, h] of sizes) {
    const texture = new StorageTexture(w, h);
    texture.type = THREE.HalfFloatType;
    texture.format = THREE.RGBAFormat;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    const output = storageTexture(texture).setAccess(NodeAccess.WRITE_ONLY);
    const previous = input;
    const prevWidth = inputWidth;
    const prevHeight = inputHeight;
    const level = Fn(() => {
      const x = instanceIndex.mod(w);
      const y = instanceIndex.div(w);
      const originX = x.mul(2);
      const originY = y.mul(2);
      const load = (dx: number, dy: number) =>
        textureLoad(
          previous,
          ivec2(
            int(min(float(originX).add(dx), prevWidth - 1)),
            int(min(float(originY).add(dy), prevHeight - 1)),
          ),
        ).r;
      const conservative = max(
        max(load(0, 0), load(1, 0)),
        max(load(0, 1), load(1, 1)),
      );
      textureStore(output, ivec2(int(x), int(y)), vec4(conservative, 0, 0, 1));
    })().compute(w * h);
    textures.push(texture);
    passes.push(level);
    input = texture;
    inputWidth = w;
    inputHeight = h;
  }
  let disposed = false;
  return {
    textures,
    compute() {
      if (disposed) return;
      for (const pass of passes) renderer.compute(pass);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      textures.forEach((texture) => texture.dispose());
    },
  };
}
