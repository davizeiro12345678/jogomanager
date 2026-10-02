import * as THREE from "three";

type Surface = "tile" | "wood" | "wall";
const surfaces = new Map<Surface, THREE.CanvasTexture>();
const backdrops = new Map<string, THREE.CanvasTexture>();

/** Small, shared authored maps: no downloads and no texture generation per frame. */
export function cinematicSurface(kind: Surface): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const cached = surfaces.get(kind);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = kind === "wood" ? "#bfa17b" : "#d4d7d8";
  ctx.fillRect(0, 0, 256, 256);
  let seed = 139;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 4500; i++) {
    const tone = Math.round(120 + random() * 100);
    ctx.fillStyle = `rgba(${tone},${tone},${tone},0.09)`;
    ctx.fillRect(random() * 256, random() * 256, kind === "wood" ? 35 + random() * 100 : 1, 1);
  }
  if (kind === "tile") {
    ctx.fillStyle = "#929da3";
    ctx.fillRect(0, 0, 256, 2);
    ctx.fillRect(0, 0, 2, 256);
  } else if (kind === "wood") {
    ctx.fillStyle = "#87725b";
    ctx.fillRect(0, 0, 256, 2);
    ctx.fillRect(0, 0, 2, 256);
    ctx.fillRect(128, 0, 1, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === "wall" ? 5 : 9, kind === "wood" ? 5 : 7);
  texture.anisotropy = 4;
  surfaces.set(kind, texture);
  return texture;
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
