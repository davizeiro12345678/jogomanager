import * as THREE from "three";
import { buildTurfDetail } from "@/game/turf-detail";

const SIZE = 512;
let cached: { normal: THREE.DataTexture; roughness: THREE.DataTexture } | undefined;

/** Session-owned tile: shared by every mowing pattern and match, never per frame. */
export function turfDetailTextures() {
  if (cached) return cached;
  const texture = (rgba: number[]) => {
    const map = new THREE.DataTexture(Uint8Array.from(rgba), 1, 1, THREE.RGBAFormat);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(48, 32);
    map.colorSpace = THREE.NoColorSpace;
    map.generateMipmaps = true;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.needsUpdate = true;
    return map;
  };
  const maps = (cached = {
    normal: texture([128, 128, 255, 255]),
    roughness: texture([210, 210, 210, 255]),
  });
  if (typeof window === "undefined") return maps;
  let finished = false;
  let worker: Worker | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const finish = (bytes: Uint8Array, backend: string) => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    worker?.terminate();
    const length = SIZE * SIZE * 4;
    if (!(bytes instanceof Uint8Array) || bytes.length !== length * 2) {
      bytes = buildTurfDetail(SIZE, 0x5eed02);
      backend = "typescript";
    }
    maps.normal.image = { data: bytes.slice(0, length), width: SIZE, height: SIZE };
    maps.roughness.image = { data: bytes.slice(length), width: SIZE, height: SIZE };
    for (const map of Object.values(maps)) {
      map.userData["generationBackend"] = backend;
      map.needsUpdate = true;
    }
  };
  const fallback = () => finish(buildTurfDetail(SIZE, 0x5eed02), "typescript");
  try {
    worker = new Worker(new URL("../../../../game/turf-detail.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }: MessageEvent<{ bytes: Uint8Array; backend: string }>) =>
      finish(data.bytes, data.backend);
    worker.onerror = fallback;
    timeout = setTimeout(fallback, 10_000);
    worker.postMessage({ size: SIZE, seed: 0x5eed02 });
  } catch {
    fallback();
  }
  return maps;
}
