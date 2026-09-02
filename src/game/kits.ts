import * as THREE from "three";

export type KitPattern = "solid" | "stripes" | "hoops" | "sash" | "halves" | "checks";

export interface Kit {
  base: string;
  detail: string;
  pattern: KitPattern;
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const PATTERNS: KitPattern[] = ["solid", "stripes", "hoops", "sash", "halves", "checks"];

export function kitFor(clubId: string, primary: string, secondary: string, away = false): Kit {
  const p = PATTERNS[hash(clubId) % PATTERNS.length]!;
  return away
    ? { base: secondary, detail: primary, pattern: p }
    : { base: primary, detail: secondary, pattern: p };
}

function toRgb(hex: string) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b] as const;
}

/** Distância perceptual simples entre duas cores (0..1). */
export function colorClash(a: string, b: string) {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  const d = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) / Math.sqrt(3);
  return d < 0.28;
}

const cache = new Map<string, THREE.CanvasTexture>();

export function kitTexture(kit: Kit, number: number): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const key = `${kit.base}|${kit.detail}|${kit.pattern}|${number}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = kit.base;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = kit.detail;

  switch (kit.pattern) {
    case "stripes":
      for (let i = 0; i < 8; i++) ctx.fillRect(i * 32 + 8, 0, 16, size);
      break;
    case "hoops":
      for (let i = 0; i < 6; i++) ctx.fillRect(0, i * 42 + 10, size, 20);
      break;
    case "sash":
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, size * 0.35);
      ctx.lineTo(size * 0.65, 0);
      ctx.lineTo(size, size * 0.2);
      ctx.lineTo(size * 0.35, size);
      ctx.lineTo(0, size);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    case "halves":
      ctx.fillRect(size / 2, 0, size / 2, size);
      break;
    case "checks":
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++)
          if ((x + y) % 2 === 0) ctx.fillRect(x * 32, y * 32, 32, 32);
      break;
    default:
      break;
  }

  // gola + mangas
  ctx.fillStyle = kit.detail;
  ctx.fillRect(0, 0, size, 18);

  // número nas costas
  ctx.font = "bold 96px 'Barlow Condensed', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.fillStyle = "#ffffff";
  ctx.strokeText(String(number), size * 0.5, size * 0.58);
  ctx.fillText(String(number), size * 0.5, size * 0.58);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

export const SKIN_TONES = ["#8d5524", "#c68642", "#e0ac69", "#f1c27d", "#6b4226", "#a9714b"];

export function skinFor(id: string) {
  return SKIN_TONES[hash(id) % SKIN_TONES.length]!;
}
