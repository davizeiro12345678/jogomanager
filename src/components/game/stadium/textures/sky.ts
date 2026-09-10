import * as THREE from "three";

/**
 * Céu do estádio: degradê por horário + nuvens desenhadas com blobs suaves,
 * estrelas à noite e um brilho de sol/lua. Cada horário é gerado uma vez e
 * fica em cache — nada é redesenhado por quadro.
 */

export type SkyTime = "dia" | "entardecer" | "noite";

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

const STOPS: Record<SkyTime, [string, string, string]> = {
  dia: ["#2f78c8", "#8cc0ea", "#dcefff"],
  entardecer: ["#1b2a49", "#7a5570", "#ffb277"],
  noite: ["#01030a", "#070d1a", "#152238"],
};

const CLOUD: Record<SkyTime, { light: string; dark: string; alpha: number; count: number }> = {
  dia: { light: "rgba(255,255,255,0.95)", dark: "rgba(176,192,210,0.85)", alpha: 0.9, count: 26 },
  entardecer: { light: "rgba(255,214,186,0.92)", dark: "rgba(112,86,104,0.8)", alpha: 0.85, count: 22 },
  noite: { light: "rgba(120,134,158,0.5)", dark: "rgba(20,28,44,0.7)", alpha: 0.5, count: 16 },
};

/** Um cúmulo: vários círculos sobrepostos com base achatada e topo iluminado. */
function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  rand: () => number,
  time: SkyTime,
) {
  const { light, dark, alpha } = CLOUD[time];
  const puffs = 7 + Math.floor(rand() * 7);
  ctx.save();
  ctx.globalAlpha = alpha * (0.6 + rand() * 0.4);

  // base sombreada
  ctx.fillStyle = dark;
  for (let i = 0; i < puffs; i++) {
    const px = x + (i - puffs / 2) * scale * 0.5 + rand() * scale * 0.3;
    const py = y + rand() * scale * 0.18;
    const r = scale * (0.32 + rand() * 0.4);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // topo iluminado
  ctx.fillStyle = light;
  for (let i = 0; i < puffs; i++) {
    const px = x + (i - puffs / 2) * scale * 0.48 + rand() * scale * 0.25;
    const py = y - scale * (0.12 + rand() * 0.22);
    const r = scale * (0.26 + rand() * 0.34);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function build(time: SkyTime, w = 2048, h = 1024) {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const rand = rng(time === "dia" ? 0x51a1 : time === "entardecer" ? 0x51a2 : 0x51a3);

  const [top, mid, low] = STOPS[time];
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, low);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // estrelas (mais visíveis à noite, algumas no entardecer)
  const stars = time === "noite" ? 900 : time === "entardecer" ? 160 : 0;
  for (let i = 0; i < stars; i++) {
    const y = rand() * h * 0.55;
    const a = (0.25 + rand() * 0.75) * (1 - y / (h * 0.7));
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
    const r = rand() > 0.96 ? 1.8 : 0.9;
    ctx.beginPath();
    ctx.arc(rand() * w, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // sol / lua com halo
  const sx = w * 0.72;
  const sy = time === "dia" ? h * 0.22 : time === "entardecer" ? h * 0.52 : h * 0.2;
  const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, h * (time === "noite" ? 0.16 : 0.3));
  if (time === "dia") {
    halo.addColorStop(0, "rgba(255,252,235,0.95)");
    halo.addColorStop(0.12, "rgba(255,248,214,0.5)");
  } else if (time === "entardecer") {
    halo.addColorStop(0, "rgba(255,197,128,0.98)");
    halo.addColorStop(0.14, "rgba(255,150,90,0.5)");
  } else {
    halo.addColorStop(0, "rgba(226,232,244,0.85)");
    halo.addColorStop(0.1, "rgba(160,180,214,0.28)");
  }
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);

  // camadas de nuvens: altas e finas no topo, cúmulos perto do horizonte
  const { count } = CLOUD[time];
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = h * (0.12 + rand() * 0.5);
    const scale = h * (0.04 + rand() * 0.1) * (1 + (y / h) * 0.8);
    drawCloud(ctx, x, y, scale, rand, time);
    // repete perto da borda para a textura fechar sem emenda visível
    if (x < scale * 3) drawCloud(ctx, x + w, y, scale, rand, time);
    if (x > w - scale * 3) drawCloud(ctx, x - w, y, scale, rand, time);
  }

  // névoa no horizonte
  const haze = ctx.createLinearGradient(0, h * 0.62, 0, h);
  haze.addColorStop(0, "rgba(0,0,0,0)");
  haze.addColorStop(1, time === "noite" ? "rgba(12,18,30,0.85)" : "rgba(226,236,246,0.55)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  return tex;
}

const cache = new Map<SkyTime, THREE.Texture | null>();

export function skyTexture(time: SkyTime) {
  if (!cache.has(time)) cache.set(time, build(time));
  return cache.get(time) ?? null;
}
