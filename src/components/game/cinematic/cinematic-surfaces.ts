import * as THREE from "three";

type Surface = "tile" | "wood" | "wall" | "grass" | "asphalt";
type SurfaceChannel = "color" | "normal" | "roughness";
interface SurfaceMaps {
  color: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
}

const surfaces = new Map<Surface, SurfaceMaps>();
const backdrops = new Map<string, THREE.CanvasTexture>();
const SIZE = 256;
const REPEAT: Record<Surface, [number, number]> = {
  tile: [8, 6],
  wood: [5, 4],
  wall: [4, 3],
  grass: [8, 4],
  asphalt: [7, 5],
};

/** Wrap-aware tangent-space normals from a grayscale height canvas. */
export function cinematicNormalPixels(
  height: ArrayLike<number>,
  width: number,
  heightPixels: number,
  strength = 1,
) {
  const output = new Uint8ClampedArray(width * heightPixels * 4);
  const sample = (x: number, y: number) =>
    height[((y + heightPixels) % heightPixels) * width + ((x + width) % width)]! / 255;
  for (let y = 0; y < heightPixels; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (sample(x + 1, y) - sample(x - 1, y)) * strength;
      const dy = (sample(x, y + 1) - sample(x, y - 1)) * strength;
      const length = Math.hypot(dx, dy, 1);
      const offset = (y * width + x) * 4;
      output[offset] = Math.round((-dx / length) * 127 + 128);
      output[offset + 1] = Math.round((-dy / length) * 127 + 128);
      output[offset + 2] = Math.round((1 / length) * 127 + 128);
      output[offset + 3] = 255;
    }
  }
  return output;
}

function makeSurfaceMaps(kind: Surface): SurfaceMaps | null {
  if (typeof document === "undefined") return null;
  const colorCanvas = document.createElement("canvas");
  const heightCanvas = document.createElement("canvas");
  const roughCanvas = document.createElement("canvas");
  colorCanvas.width = colorCanvas.height = SIZE;
  heightCanvas.width = heightCanvas.height = SIZE;
  roughCanvas.width = roughCanvas.height = SIZE;
  const color = colorCanvas.getContext("2d");
  const height = heightCanvas.getContext("2d");
  const roughness = roughCanvas.getContext("2d");
  if (!color || !height || !roughness) return null;

  let seed = kind.length * 997 + 139;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const noise = (ctx: CanvasRenderingContext2D, count: number, alpha: number, size = 1) => {
    for (let i = 0; i < count; i++) {
      const tone = Math.round(112 + random() * 40);
      ctx.fillStyle = `rgba(${tone},${tone},${tone},${alpha})`;
      ctx.fillRect(random() * SIZE, random() * SIZE, size * (0.4 + random()), size);
    }
  };
  const colors: Record<Surface, string> = {
    tile: "#c6cccf",
    wood: "#b49a77",
    wall: "#c4c9ca",
    grass: "#78996a",
    asphalt: "#737a7e",
  };
  color.fillStyle = colors[kind];
  color.fillRect(0, 0, SIZE, SIZE);
  height.fillStyle = "#808080";
  height.fillRect(0, 0, SIZE, SIZE);
  roughness.fillStyle = "#e0e0e0";
  roughness.fillRect(0, 0, SIZE, SIZE);

  if (kind === "tile") {
    const tile = 64;
    for (let y = 0; y < SIZE; y += tile) {
      for (let x = 0; x < SIZE; x += tile) {
        const shade = Math.round(188 + random() * 18);
        color.fillStyle = `rgb(${shade},${shade + 3},${shade + 4})`;
        color.fillRect(x + 2, y + 2, tile - 4, tile - 4);
        const face = Math.round(130 + random() * 6);
        height.fillStyle = `rgb(${face},${face},${face})`;
        height.fillRect(x + 2, y + 2, tile - 4, tile - 4);
        roughness.fillStyle = `rgb(${205 + Math.round(random() * 28)},${205 + Math.round(random() * 28)},${205 + Math.round(random() * 28)})`;
        roughness.fillRect(x + 2, y + 2, tile - 4, tile - 4);
      }
    }
    // Repeating ceramic grout with a slight bevel catches sidelight.
    for (let edge = 0; edge <= SIZE; edge += tile) {
      color.fillStyle = "rgba(67,79,85,0.34)";
      color.fillRect(edge, 0, 2, SIZE);
      color.fillRect(0, edge, SIZE, 2);
      height.fillStyle = "#5b5b5b";
      height.fillRect(edge, 0, 2, SIZE);
      height.fillRect(0, edge, SIZE, 2);
      height.fillStyle = "#a8a8a8";
      height.fillRect(edge + 2, 0, 1, SIZE);
      height.fillRect(0, edge + 2, SIZE, 1);
    }
    noise(color, 950, 0.045);
  } else if (kind === "wood") {
    for (let y = 0; y <= SIZE; y += 64) {
      color.fillStyle = "rgba(57,39,24,0.3)";
      color.fillRect(0, y, SIZE, 2);
      height.fillStyle = "#686868";
      height.fillRect(0, y, SIZE, 2);
      for (let line = 5; line < 63; line += 8 + Math.round(random() * 7)) {
        const waviness = random() * 1.7;
        color.strokeStyle = `rgba(${70 + Math.round(random() * 40)},48,29,${0.08 + random() * 0.12})`;
        color.lineWidth = 0.5 + random();
        color.beginPath();
        color.moveTo(0, y + line);
        color.bezierCurveTo(76, y + line - waviness, 164, y + line + waviness, SIZE, y + line);
        color.stroke();
        height.strokeStyle = `rgba(128,128,128,${0.05 + random() * 0.09})`;
        height.lineWidth = 1;
        height.beginPath();
        height.moveTo(0, y + line);
        height.bezierCurveTo(76, y + line - waviness, 164, y + line + waviness, SIZE, y + line);
        height.stroke();
      }
      const knotX = 24 + Math.round(random() * (SIZE - 48));
      const knotY = y + 24;
      color.strokeStyle = "rgba(66,44,27,0.24)";
      color.lineWidth = 1;
      color.beginPath();
      color.ellipse(knotX, knotY, 6, 2.5, 0, 0, Math.PI * 2);
      color.stroke();
      height.strokeStyle = "#626262";
      height.beginPath();
      height.ellipse(knotX, knotY, 5, 2, 0, 0, Math.PI * 2);
      height.stroke();
    }
    noise(color, 1300, 0.035, 2);
    noise(roughness, 300, 0.13, 2);
  } else if (kind === "wall") {
    noise(color, 6200, 0.055, 2.2);
    noise(height, 5200, 0.19, 2.2);
    noise(roughness, 4200, 0.12, 2);
    // A barely visible panel joint gives long walls scale without a tiled grid.
    color.fillStyle = "rgba(60,72,78,0.1)";
    color.fillRect(0, 0, 1, SIZE);
    height.fillStyle = "#737373";
    height.fillRect(0, 0, 1, SIZE);
  } else if (kind === "grass") {
    for (let i = 0; i < 3800; i++) {
      const x = random() * SIZE;
      const y = random() * SIZE;
      const length = 2 + random() * 9;
      color.strokeStyle = `rgba(${28 + Math.round(random() * 36)},${62 + Math.round(random() * 65)},${22 + Math.round(random() * 26)},${0.16 + random() * 0.3})`;
      color.lineWidth = 0.35 + random() * 0.8;
      color.beginPath();
      color.moveTo(x, y);
      color.lineTo(x + (random() - 0.5) * 2, y - length);
      color.stroke();
      height.fillStyle = `rgba(128,128,128,${0.08 + random() * 0.12})`;
      height.fillRect(x, y, 1, Math.max(1, length * 0.45));
    }
    noise(roughness, 2800, 0.1);
  } else {
    noise(color, 12000, 0.12, 2.1);
    noise(height, 9000, 0.12, 2.1);
    noise(roughness, 6800, 0.1, 1.6);
    for (let i = 0; i < 90; i++) {
      const x = random() * SIZE;
      const y = random() * SIZE;
      const radius = 1 + random() * 2.5;
      color.fillStyle = `rgba(25,31,35,${0.08 + random() * 0.15})`;
      color.beginPath();
      color.ellipse(x, y, radius, radius * 0.7, random(), 0, Math.PI * 2);
      color.fill();
      height.fillStyle = "#727272";
      height.beginPath();
      height.ellipse(x, y, radius, radius * 0.7, 0, 0, Math.PI * 2);
      height.fill();
    }
  }

  const normalData = cinematicNormalPixels(
    height.getImageData(0, 0, SIZE, SIZE).data.filter((_, index) => index % 4 === 0),
    SIZE,
    SIZE,
    kind === "wall" ? 0.55 : kind === "asphalt" ? 0.8 : 1.05,
  );
  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = normalCanvas.height = SIZE;
  const normal = normalCanvas.getContext("2d");
  if (!normal) return null;
  const normalImage = normal.createImageData(SIZE, SIZE);
  normalImage.data.set(normalData);
  normal.putImageData(normalImage, 0, 0);

  const makeTexture = (canvas: HTMLCanvasElement, colorData: boolean) => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = colorData ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(...REPEAT[kind]);
    texture.anisotropy = 4;
    return texture;
  };
  return {
    color: makeTexture(colorCanvas, true),
    normal: makeTexture(normalCanvas, false),
    roughness: makeTexture(roughCanvas, false),
  };
}

function surfaceMaps(kind: Surface) {
  let maps = surfaces.get(kind);
  if (!maps) {
    const created = makeSurfaceMaps(kind);
    if (!created) return null;
    maps = created;
    surfaces.set(kind, maps);
  }
  return maps;
}

/** Small, shared authored PBR maps: no downloads or per-frame generation. */
export function cinematicSurface(kind: Surface, channel: SurfaceChannel = "color") {
  return surfaceMaps(kind)?.[channel] ?? null;
}

/** A complete sponsor wall replaces 24 blank rectangles with a single surface. */
export function cinematicBackdrop(primary: string, secondary: string) {
  if (typeof document === "undefined") return null;
  const key = `${primary}-${secondary}`;
  const cached = backdrops.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 1536;
  canvas.height = 640;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#18212b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const tint = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  tint.addColorStop(0, primary);
  tint.addColorStop(1, "#16212b");
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
  const names = ["JOGOMANAGER", "FUTEBOL", "CLUBE", "MATCHDAY", "ACADEMIA", "JM SPORTS"];
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 6; col++) {
      const x = col * 256 + 16,
        y = row * 160 + 16;
      ctx.fillStyle = "#e7eced";
      ctx.beginPath();
      ctx.roundRect(x, y, 224, 128, 7);
      ctx.fill();
      ctx.fillStyle = row % 2 ? "#1f2b33" : primary;
      ctx.beginPath();
      ctx.moveTo(x + 101, y + 23);
      ctx.lineTo(x + 123, y + 23);
      ctx.lineTo(x + 122, y + 49);
      ctx.lineTo(x + 112, y + 58);
      ctx.lineTo(x + 102, y + 49);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#21313a";
      ctx.font = "700 17px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(names[(col + row) % names.length]!, x + 112, y + 83);
      ctx.fillStyle = secondary;
      ctx.fillRect(x + 82, y + 97, 60, 3);
    }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  // Bounded previews keep their active texture alive; uncommon club pairs are uncached.
  if (backdrops.size < 24) backdrops.set(key, texture);
  return texture;
}

export function releaseCinematicBackdrop(texture: THREE.CanvasTexture | null) {
  if (texture && !Array.from(backdrops.values()).includes(texture)) texture.dispose();
}
