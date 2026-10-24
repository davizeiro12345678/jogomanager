import * as THREE from "three";

/** Every weather particle shares one basis; only its translation moves each frame. */
export class WeatherInstanceTransforms {
  private attribute: THREE.InstancedBufferAttribute | null = null;
  private rain: boolean | undefined;
  private wind: number | undefined;
  private readonly transform = new THREE.Object3D();

  prepare(mesh: THREE.InstancedMesh, rain: boolean, wind: number): Float32Array {
    const attribute = mesh.instanceMatrix;
    const array = attribute.array as Float32Array;
    if (attribute !== this.attribute || rain !== this.rain || (rain && wind !== this.wind)) {
      this.transform.rotation.set(0, 0, rain ? wind * 0.28 : 0);
      this.transform.scale.set(1, rain ? 1 : 0.5, 1);
      this.transform.updateMatrix();
      const basis = this.transform.matrix.elements;
      for (let index = 0; index < attribute.count; index++) {
        const offset = index * 16;
        // Preserve positions when the wind or weather changes between frames.
        for (let element = 0; element < 12; element++) array[offset + element] = basis[element]!;
        array[offset + 15] = basis[15]!;
      }
      attribute.setUsage(THREE.DynamicDrawUsage);
      attribute.needsUpdate = true;
      this.attribute = attribute;
      this.rain = rain;
      this.wind = wind;
    }
    return array;
  }
}

export function writeWeatherInstancePosition(
  array: Float32Array,
  index: number,
  x: number,
  y: number,
  z: number,
) {
  const offset = index * 16;
  array[offset + 12] = x;
  array[offset + 13] = y;
  array[offset + 14] = z;
}
