import * as THREE from "three";
import { kitStyleFor } from "./customStyle";

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
  | "pin"
  | "quarters"
  | "chevron"
  | "diagonal"
  | "shadow"
  | "argyle"
  | "mesh";

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
  "quarters",
  "chevron",
  "diagonal",
  "shadow",
  "argyle",
  "mesh",
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
  const shorts = pick === 0 ? detail : pick === 1 ? base : dark ? "#f2f2f2" : "#16181c";
  const socks = pick === 2 ? detail : shade(base, 0.75);
  return { shorts, socks };
}

export function kitFor(clubId: string, primary: string, secondary: string, away = false): Kit {
  const custom = kitStyleFor(clubId);
  if (custom) {
    const base = away ? custom.awayBase : custom.base;
    const detail = away ? custom.awayDetail : custom.detail;
    return {
      base,
      detail,
      pattern: custom.pattern,
      shorts: away ? detail : custom.shorts,
      socks: away ? base : custom.socks,
    };
  }
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

/** Ruído fino de tecido — tira o aspecto de plástico liso. */
function fabricNoise(ctx: CanvasRenderingContext2D, size: number, seed: number) {
  let s = seed || 1;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  ctx.save();
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < size * 6; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    ctx.fillStyle = rnd() > 0.5 ? "#ffffff" : "#000000";
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.restore();
}

/** Brasão simples do clube: escudo com faixa diagonal e estrela. */
function drawCrest(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, kit: Kit) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.moveTo(-r, -r * 1.05);
  ctx.lineTo(r, -r * 1.05);
  ctx.lineTo(r, r * 0.35);
  ctx.quadraticCurveTo(r, r * 1.15, 0, r * 1.35);
  ctx.quadraticCurveTo(-r, r * 1.15, -r, r * 0.35);
  ctx.closePath();
  ctx.fillStyle = shade(kit.detail, 0.9);
  ctx.fill();
  ctx.lineWidth = r * 0.16;
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.stroke();

  ctx.save();
  ctx.clip();
  ctx.fillStyle = kit.base;
  ctx.beginPath();
  ctx.moveTo(-r * 1.2, r * 0.2);
  ctx.lineTo(r * 1.2, -r * 0.6);
  ctx.lineTo(r * 1.2, r * 0.1);
  ctx.lineTo(-r * 1.2, r * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // estrela central
  ctx.fillStyle = luminance(kit.detail) > 0.5 ? "#1b1f24" : "#f4d152";
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r * 0.42 : r * 0.18;
    const x = Math.cos(ang) * rad;
    const y = Math.sin(ang) * rad - r * 0.15;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function kitTexture(kit: Kit, number: number, name?: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const key = `${kit.base}|${kit.detail}|${kit.pattern}|${number}|${name ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 512;
  const s = size / 256; // fator sobre o desenho original
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
      for (let i = 0; i < 8; i++) ctx.fillRect((i * 32 + 8) * s, 0, 16 * s, size);
      break;
    case "pin":
      ctx.fillStyle = kit.detail;
      for (let i = 0; i < 16; i++) ctx.fillRect((i * 16 + 6) * s, 0, 3 * s, size);
      break;
    case "hoops":
      ctx.fillStyle = kit.detail;
      for (let i = 0; i < 6; i++) ctx.fillRect(0, (i * 42 + 10) * s, size, 20 * s);
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
          if ((x + y) % 2 === 0) ctx.fillRect(x * 32 * s, y * 32 * s, 32 * s, 32 * s);
      break;
    case "band":
      ctx.fillStyle = kit.detail;
      ctx.fillRect(0, size * 0.28, size, 44 * s);
      ctx.fillRect(0, size * 0.28 - 8 * s, size, 4 * s);
      ctx.fillRect(0, size * 0.28 + 48 * s, size, 4 * s);
      break;
    case "sleeves":
      ctx.fillStyle = kit.detail;
      ctx.fillRect(0, 0, 40 * s, size);
      ctx.fillRect(size - 40 * s, 0, 40 * s, size);
      break;
    case "gradient": {
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0, kit.base);
      grad.addColorStop(1, kit.detail);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      break;
    }
    case "quarters":
      ctx.fillStyle = kit.detail;
      ctx.fillRect(size / 2, 0, size / 2, size / 2);
      ctx.fillRect(0, size / 2, size / 2, size / 2);
      break;
    case "chevron": {
      ctx.fillStyle = kit.detail;
      for (let i = 0; i < 5; i++) {
        const y = size * 0.18 + i * 46 * s;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size / 2, y + 26 * s);
        ctx.lineTo(size, y);
        ctx.lineTo(size, y + 14 * s);
        ctx.lineTo(size / 2, y + 40 * s);
        ctx.lineTo(0, y + 14 * s);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case "diagonal":
      ctx.save();
      ctx.fillStyle = kit.detail;
      ctx.translate(size / 2, size / 2);
      ctx.rotate(Math.PI / 5);
      for (let i = -10; i < 10; i++) ctx.fillRect(i * 34 * s, -size, 17 * s, size * 2);
      ctx.restore();
      break;
    case "shadow":
      // listras "sombra": mesmo tom do corpo, só um degrau mais escuro
      ctx.fillStyle = shade(kit.base, 0.82);
      for (let i = 0; i < 10; i++) ctx.fillRect((i * 26 + 6) * s, 0, 13 * s, size);
      break;
    case "argyle": {
      ctx.fillStyle = kit.detail;
      const step = 64 * s;
      for (let y = 0; y < size + step; y += step) {
        for (let x = 0; x < size + step; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, y - step / 2);
          ctx.lineTo(x + step / 2, y);
          ctx.lineTo(x, y + step / 2);
          ctx.lineTo(x - step / 2, y);
          ctx.closePath();
          ctx.fill();
        }
      }
      break;
    }
    case "mesh": {
      // malha de goleiro: furos finos deixando o tom escuro aparecer
      ctx.fillStyle = shade(kit.base, 0.7);
      for (let y = 0; y < size; y += 10 * s)
        for (let x = 0; x < size; x += 10 * s) ctx.fillRect(x, y, 4 * s, 4 * s);
      ctx.fillStyle = kit.detail;
      ctx.fillRect(0, size * 0.42, size, 10 * s);
      break;
    }
    default:
      break;
  }

  // gola + vivos nos punhos
  ctx.fillStyle = kit.detail;
  ctx.fillRect(0, 0, size, 16 * s);
  ctx.fillStyle = shade(kit.detail, 0.75);
  ctx.fillRect(0, 16 * s, size, 3 * s);
  ctx.fillStyle = kit.detail;
  ctx.fillRect(0, size - 10 * s, size, 10 * s);
  ctx.fillRect(0, size * 0.5 - 2 * s, 8 * s, size * 0.5);
  ctx.fillRect(size - 8 * s, size * 0.5 - 2 * s, 8 * s, size * 0.5);

  fabricNoise(ctx, size, hash(kit.base + kit.pattern));

  // luz de cima e sombra de baixo (volume do torso)
  const topLight = ctx.createLinearGradient(0, 0, 0, size * 0.4);
  topLight.addColorStop(0, "rgba(255,255,255,0.14)");
  topLight.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = topLight;
  ctx.fillRect(0, 0, size, size * 0.4);

  const shadeGrad = ctx.createLinearGradient(0, size * 0.55, 0, size);
  shadeGrad.addColorStop(0, "rgba(0,0,0,0)");
  shadeGrad.addColorStop(1, "rgba(0,0,0,0.24)");
  ctx.fillStyle = shadeGrad;
  ctx.fillRect(0, 0, size, size);

  // escudo do clube (brasão em escudo com faixa e estrela)
  drawCrest(ctx, size * 0.17, size * 0.24, size * 0.11, kit);

  // patrocínio no peito
  const chestInk = luminance(kit.base) > 0.5 ? "rgba(16,20,24,0.85)" : "rgba(255,255,255,0.9)";
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${22 * s}px 'Barlow Condensed', system-ui, sans-serif`;
  ctx.fillStyle = chestInk;
  ctx.fillText("MANAGER 3D", size * 0.5, size * 0.44);
  ctx.restore();

  const ink = luminance(kit.base) > 0.5 ? "#101418" : "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // sobrenome nas costas
  if (name) {
    const short = name.split(" ").pop()!.toUpperCase().slice(0, 12);
    ctx.font = `bold ${34 * s}px 'Barlow Condensed', system-ui, sans-serif`;
    ctx.lineWidth = 5 * s;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.fillStyle = ink;
    ctx.strokeText(short, size * 0.5, size * 0.3);
    ctx.fillText(short, size * 0.5, size * 0.3);
  }

  // número nas costas
  ctx.font = `bold ${96 * s}px 'Barlow Condensed', system-ui, sans-serif`;
  ctx.lineWidth = 8 * s;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.fillStyle = ink;
  ctx.strokeText(String(number), size * 0.5, size * 0.6);
  ctx.fillText(String(number), size * 0.5, size * 0.6);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
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
