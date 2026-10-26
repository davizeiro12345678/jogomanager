import * as THREE from "three";

let maps: { normal: THREE.DataTexture; roughness: THREE.DataTexture } | undefined;

/** Eight KiB of shared, linear detail for all concrete batches; no extra draws. */
export function stadiumSurfaceDetail() {
  if (maps) return maps;
  const size = 32;
  const normal = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  let seed = 0x51ad1a;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const heights = new Float32Array(size * size);
  for (let pixel = 0; pixel < heights.length; pixel++) {
    // Most aggregate is shallow, with occasional darker pinholes. The
    // normal and roughness come from the same surface, rather than two
    // unrelated noise fields that made concrete look like stippled plastic.
    const grain = random();
    heights[pixel] = grain < 0.1 ? -0.4 - grain : grain * 0.16;
  }
  const heightAt = (x: number, y: number) =>
    heights[((y + size) % size) * size + ((x + size) % size)]!;
  for (let pixel = 0; pixel < size * size; pixel++) {
    const offset = pixel * 4;
    const px = pixel % size;
    const py = Math.floor(pixel / size);
    const x = (heightAt(px - 1, py) - heightAt(px + 1, py)) * 0.42;
    const y = (heightAt(px, py - 1) - heightAt(px, py + 1)) * 0.42;
    const length = Math.hypot(x, y, 1);
    normal.set(
      [
        Math.round(128 + (x / length) * 127),
        Math.round(128 + (y / length) * 127),
        Math.round(128 + 127 / length),
        255,
      ],
      offset,
    );
    const value = Math.round(231 - heights[pixel]! * 32);
    roughness.set([value, value, value, 255], offset);
  }
  const texture = (pixels: Uint8Array, name: string) => {
    const map = new THREE.DataTexture(pixels, size, size);
    map.name = name;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(8, 4);
    map.generateMipmaps = true;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.needsUpdate = true;
    return map;
  };
  maps = {
    normal: texture(normal, "stadium-concrete-pores"),
    roughness: texture(roughness, "stadium-concrete-roughness"),
  };
  return maps;
}
