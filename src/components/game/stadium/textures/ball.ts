import * as THREE from "three";

let cached: { map: THREE.Texture; bumpMap: THREE.Texture; roughnessMap: THREE.Texture } | null =
  null;
/** Spherical panel atlas: 12 dark pentagonal and 20 light hexagonal regions.
 * Sampling on the sphere keeps seams continuous across UV wrap and poles. */
export function footballTextures() {
  if (cached || typeof document === "undefined") return cached;
  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const vertices = geometry.getAttribute("position");
  const centers: { direction: THREE.Vector3; dark: boolean }[] = [];
  for (let i = 0; i < vertices.count; i += 3) {
    const face = new THREE.Vector3();
    for (let j = 0; j < 3; j++) {
      const point = new THREE.Vector3().fromBufferAttribute(vertices, i + j).normalize();
      face.add(point);
      if (!centers.some((c) => c.dark && c.direction.distanceToSquared(point) < 1e-6))
        centers.push({ direction: point, dark: true });
    }
    centers.push({ direction: face.normalize(), dark: false });
  }
  geometry.dispose();
  const width = 512,
    height = 256;
  const canvases = Array.from({ length: 3 }, () => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  });
  const contexts = canvases.map((c) => c.getContext("2d")!);
  if (contexts.some((c) => !c)) return null;
  const images = contexts.map((c) => c.createImageData(width, height));
  for (let y = 0; y < height; y++) {
    const theta = ((y + 0.5) / height) * Math.PI;
    for (let x = 0; x < width; x++) {
      const phi = ((x + 0.5) / width) * Math.PI * 2;
      const px = -Math.cos(phi) * Math.sin(theta),
        py = Math.cos(theta),
        pz = Math.sin(phi) * Math.sin(theta);
      let first = -2,
        second = -2,
        dark = false;
      for (const c of centers) {
        const d = px * c.direction.x + py * c.direction.y + pz * c.direction.z;
        if (d > first) {
          second = first;
          first = d;
          dark = c.dark;
        } else if (d > second) second = d;
      }
      const seam = 1 - THREE.MathUtils.smoothstep(first - second, 0.002, 0.012);
      const grain = (((Math.imul(x + 13, 73856093) ^ Math.imul(y + 7, 19349663)) >>> 0) % 17) / 17;
      const base = dark ? 28 : 237;
      const shade = base - seam * (dark ? 12 : 100) + grain * 6;
      const i = (y * width + x) * 4;
      const values = [shade, 190 - seam * 110 + grain * 18, 175 + seam * 50 + grain * 8];
      images.forEach((image, index) => {
        const value = values[index]!;
        image.data[i] = value;
        image.data[i + 1] = value;
        image.data[i + 2] = value;
        image.data[i + 3] = 255;
      });
    }
  }
  const textures = canvases.map((canvas, index) => {
    contexts[index]!.putImageData(images[index]!, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
  });
  textures[0]!.colorSpace = THREE.SRGBColorSpace;
  return (cached = { map: textures[0]!, bumpMap: textures[1]!, roughnessMap: textures[2]! });
}
