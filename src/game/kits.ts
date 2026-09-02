import * as THREE from "three";

export type KitPattern =
  | "solid"
  | "stripes"
  | "hoops"
  | "sash"
  | "halves"
  | "checks"
  | "band"
  | "sleeves"
  | "gradient"
  | "pin";

export interface Kit {
  base: string;
  detail: string;
  pattern: KitPattern;
  shorts: string;
  socks: string;
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const PATTERNS: KitPattern[] = [
  "solid",
  "stripes",
  "hoops",
  "sash",
  "halves",
  "checks",
  "band",
  "sleeves",
  "gradient",
  "pin",
];

function shade(hex: string, f: number): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return `#${c.getHexString()}`;
}

function luminance(hex: string): number {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/** Shorts/meias coerentes: padrão do futebol real conforme luminância. */
function shortsAndSocks(base: string, detail: string, seed: string) {
  const h = hash(seed);
  const pick = h % 3;
  const dark = luminance(base) < 0.18;
  const shorts =
    pick === 0 ? detail : pick === 1 ? base : dark ? "#f2f2f2" : "#16181c";
  const socks = pick === 2 ? detail : shade(base, 0.75);
  return { shorts, socks };
}

export function kitFor(clubId: string, primary: string, secondary: string, away = false): Kit {
  const p = PATTERNS[hash(clubId) % PATTERNS.length]!;
  const [base, detail] = away ? [secondary, primary] : [primary, secondary];
  const { shorts, socks } = shortsAndSocks(base, detail, `${clubId}-ss`);
  return { base, detail, pattern: p, shorts, socks };
}

/** Uniforme de goleiro: cores vibrantes determinísticas. */
export function gkKitFor(clubId: string): Kit {
  const gkColors = ["#2ee66b", "#f2e02e", "#ff7a1a", "#b026ff", "#19d3e6", "#ff3d7f"];
  const base = gkColors[hash(clubId + "-gk") % gkColors.length]!;
  return {
    base,
    detail: "#101418",
    pattern: hash(clubId + "-gkp") % 2 === 0 ? "band" : "sleeves",
    shorts: "#101418",
    socks: shade(base, 0.8),
  };
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

  switch (kit.pattern) {
    case "stripes":
      ctx.fillStyle = kit.detail;
      for (let i = 0; i < 8; i++) ctx.fillRect(i * 32 + 8, 0, 16, size);
      break;
    case "pin":
      ctx.fillStyle = kit.detail;
      for (let i = 0; i < 16; i++) ctx.fillRect(i * 16 + 6, 0, 3, size);
      break;
    case "hoops":
      ctx.fillStyle = kit.detail;
      for (let i = 0; i < 6; i++) ctx.fillRect(0, i * 42 + 10, size, 20);
      break;
    case "sash":
      ctx.fillStyle = kit.detail;
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
      ctx.fillStyle = kit.detail;
      ctx.fillRect(size / 2, 0, size / 2, size);
      break;
    case "checks":
      ctx.fillStyle = kit.detail;
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++)
          if ((x + y) % 2 === 0) ctx.fillRect(x * 32, y * 32, 32, 32);
      break;
    case "band":
      ctx.fillStyle = kit.detail;
      ctx.fillRect(0, size * 0.28, size, 44);
      ctx.fillRect(0, size * 0.28 - 8, size, 4);
      ctx.fillRect(0, size * 0.28 + 48, size, 4);
      break;
    case "sleeves":
      ctx.fillStyle = kit.detail;
      ctx.fillRect(0, 0, 40, size);
      ctx.fillRect(size - 40, 0, 40, size);
      break;
    case "gradient": {
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0, kit.base);
      grad.addColorStop(1, kit.detail);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      break;
    }
    default:
      break;
  }

  // gola
  ctx.fillStyle = kit.detail;
  ctx.fillRect(0, 0, size, 16);

  // sombreamento inferior (volume do torso)
  const shadeGrad = ctx.createLinearGradient(0, size * 0.55, 0, size);
  shadeGrad.addColorStop(0, "rgba(0,0,0,0)");
  shadeGrad.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = shadeGrad;
  ctx.fillRect(0, 0, size, size);

  // número nas costas
  ctx.font = "bold 96px 'Barlow Condensed', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.fillStyle = luminance(kit.base) > 0.5 ? "#101418" : "#ffffff";
  ctx.strokeText(String(number), size * 0.5, size * 0.58);
  ctx.fillText(String(number), size * 0.5, size * 0.58);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

export const SKIN_TONES = ["#8d5524", "#c68642", "#e0ac69", "#f1c27d", "#6b4226", "#a9714b"];
export const HAIR_COLORS = ["#14100c", "#20160f", "#3a2410", "#6b4423", "#0d0d0d", "#c8a24a"];

export function skinFor(id: string) {
  return SKIN_TONES[hash(id) % SKIN_TONES.length]!;
}

export function hairFor(id: string) {
  return HAIR_COLORS[hash(id + "-hair") % HAIR_COLORS.length]!;
}
