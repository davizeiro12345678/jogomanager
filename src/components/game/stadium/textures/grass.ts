import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

/**
 * Texturas procedurais determinísticas do gramado.
 *
 * Tudo é gerado uma única vez por sessão e compartilhado entre partidas
 * (carreira, partida rápida e multiplayer) — nenhuma textura é recriada ao
 * trocar de tela, o que evita picos de GPU/CPU no celular.
 *
 * O padrão de corte mistura três assinaturas de gramado real:
 *  1. faixas diagonais (a passagem do cortador),
 *  2. anéis radiais em volta do círculo central (corte em caracol),
 *  3. um xadrez bem sutil (duas passagens cruzadas), tudo modulado por
 *     ruído simplex para as manchas grandes de solo/irrigação.
 */

/* ------------------------------------------------------------ aleatório fixo */

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

/** Padrões de corte usados pelos clubes. */
export type MowPattern = "stripes" | "checker" | "rings" | "diagonal" | "wide";

export const MOW_PATTERNS: MowPattern[] = ["stripes", "checker", "rings", "diagonal", "wide"];

type MowSpec = { angle: number; count: number; rings: boolean; cross: boolean };

const MOW: Record<MowPattern, MowSpec> = {
  stripes: { angle: 0, count: 40, rings: false, cross: false },
  checker: { angle: -0.22, count: 40, rings: false, cross: true },
  rings: { angle: -0.22, count: 32, rings: true, cross: false },
  diagonal: { angle: -0.62, count: 44, rings: false, cross: true },
  wide: { angle: 0, count: 20, rings: false, cross: false },
};

/** Ruído simplex determinístico (mesma semente da textura). */
const noise2D = createNoise2D(rng(0x51e4a3));

function withStripes(
  ctx: CanvasRenderingContext2D,
  size: number,
  spec: MowSpec,
  draw: (i: number, x: number, w: number) => void,
) {
  const w = (size * 2) / spec.count;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(spec.angle);
  ctx.translate(-size, -size);
  for (let i = 0; i < spec.count; i++) draw(i, i * w, w);
  ctx.restore();
}


function canvas(size: number) {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  return { c, ctx };
}

/* -------------------------------------------------------------------- cor */

function buildAlbedo(pattern: MowPattern = "checker", size = 2048) {
  const spec = MOW[pattern];

  const made = canvas(size);
  if (!made) return null;
  const { c, ctx } = made;
  const rand = rng(0x5eed01);

  // base: variação larga de tonalidade, sem verde chapado
  const g = ctx.createLinearGradient(0, 0, size * 0.35, size);
  g.addColorStop(0, "#125c33");
  g.addColorStop(0.35, "#1a7342");
  g.addColorStop(0.7, "#15663a");
  g.addColorStop(1, "#11542f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // manchas largas de irrigação/solo (baixa frequência)
  for (let i = 0; i < 160; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = size * (0.03 + rand() * 0.09);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = rand() > 0.5;
    rg.addColorStop(0, dark ? "rgba(6,50,26,0.10)" : "rgba(140,205,140,0.08)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // faixas de corte com borda irregular
  withStripes(ctx, size, spec, (i, x, w) => {
    const light = i % 2 === 0;
    const a = light ? "rgba(226,255,214," : "rgba(0,24,10,";
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, `${a}0.04)`);
    grad.addColorStop(0.5, `${a}0.17)`);
    grad.addColorStop(1, `${a}0.04)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, w, size * 2);
    // borda serrilhada da passagem do cortador
    ctx.fillStyle = light ? "rgba(232,255,228,0.05)" : "rgba(0,28,12,0.05)";
    for (let y = 0; y < size * 2; y += 8) {
      const j = (rand() - 0.5) * 7;
      ctx.fillRect(x + j, y, 3, 8);
      ctx.fillRect(x + w + j, y, 3, 8);
    }
  });

  // anéis radiais de corte em volta do círculo central (caracol do cortador)
  if (spec.rings) {
    ctx.save();
    ctx.translate(size / 2, size / 2);
    for (let r = size * 0.04, band = 0; r < size * 0.46; r += size * 0.017, band++) {
      const light = band % 2 === 0;
      ctx.strokeStyle = light ? "rgba(224,255,210,0.07)" : "rgba(0,26,10,0.08)";
      ctx.lineWidth = size * 0.017;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // xadrez: segunda passagem do cortador cruzando as faixas
  if (spec.cross) {
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(spec.angle + Math.PI / 2);
    ctx.translate(-size, -size);
    const cellW = (size * 2) / spec.count;
    const strong = pattern === "checker" ? 2.6 : 1;
    for (let i = 0; i < spec.count; i += 2) {
      ctx.fillStyle =
        i % 4 === 0
          ? `rgba(230,255,220,${0.028 * strong})`
          : `rgba(0,22,9,${0.032 * strong})`;
      ctx.fillRect(i * cellW, 0, cellW, size * 2);
    }
    ctx.restore();
  }



  // manchas grandes de solo/irrigação guiadas por ruído simplex (orgânicas)
  {
    const img = ctx.getImageData(0, 0, size, size);
    const px = img.data;
    const step = 2; // amostra grossa: interpolação visual suficiente
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        const n = noise2D(x / (size * 0.16), y / (size * 0.16));
        if (n < 0.34) continue; // só os topos do ruído viram mancha
        const a = Math.min(0.16, (n - 0.34) * 0.35);
        const warm = noise2D(x / (size * 0.4) + 9, y / (size * 0.4) + 9) > 0;
        const rC = warm ? 150 : 10;
        const gC = warm ? 132 : 52;
        const bC = warm ? 84 : 26;
        for (let dy = 0; dy < step; dy++) {
          for (let dx = 0; dx < step; dx++) {
            const i = ((y + dy) * size + (x + dx)) * 4;
            px[i] = px[i]! * (1 - a) + rC * a;
            px[i + 1] = px[i + 1]! * (1 - a) + gC * a;
            px[i + 2] = px[i + 2]! * (1 - a) + bC * a;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // microfibras: granulação vista de perto
  ctx.lineWidth = 1;
  for (let i = 0; i < 60000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 2 + rand() * 8;
    const bright = rand() > 0.44;
    ctx.strokeStyle = `rgba(${bright ? "205,250,180" : "8,54,26"},${0.025 + rand() * 0.07})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 3, y - len);
    ctx.stroke();
  }

  // desgaste localizado (goleiras, círculo central, laterais)
  const wear = (cx: number, cy: number, rx: number, ry: number, strength: number) => {
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    rg.addColorStop(0, `rgba(158,138,88,${strength})`);
    rg.addColorStop(0.6, `rgba(158,138,88,${strength * 0.4})`);
    rg.addColorStop(1, "rgba(158,138,88,0)");
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, 7);
    ctx.fill();
    ctx.restore();
  };
  wear(size * 0.5, size * 0.5, size * 0.1, size * 0.1, 0.12);
  wear(size * 0.045, size * 0.5, size * 0.085, size * 0.17, 0.2);
  wear(size * 0.955, size * 0.5, size * 0.085, size * 0.17, 0.2);
  wear(size * 0.16, size * 0.5, size * 0.05, size * 0.12, 0.08);
  wear(size * 0.84, size * 0.5, size * 0.05, size * 0.12, 0.08);
  for (let i = 0; i < 26; i++) {
    wear(rand() * size, rand() * size, size * 0.015, size * 0.02, 0.05 + rand() * 0.05);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 16;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/* ----------------------------------------------------------------- relevo */

function buildNormal(pattern: MowPattern = "checker", size = 1024) {
  const spec = MOW[pattern];
  const made = canvas(size);
  if (!made) return null;
  const { c, ctx } = made;
  const rand = rng(0x5eed02);
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);

  // inclinação oposta das faixas ceifadas
  withStripes(ctx, size / 2, spec, (i, x, w) => {
    ctx.fillStyle = i % 2 === 0 ? "rgba(104,128,255,0.6)" : "rgba(156,128,255,0.6)";
    ctx.fillRect(x, 0, w, size * 2);
  });

  // ondulação larga do terreno
  for (let i = 0; i < 90; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = size * (0.04 + rand() * 0.1);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(${110 + rand() * 40 | 0},${110 + rand() * 40 | 0},255,0.22)`);
    rg.addColorStop(1, "rgba(128,128,255,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // lâminas
  ctx.lineWidth = 1;
  for (let i = 0; i < 34000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.strokeStyle = `rgba(${(90 + rand() * 80) | 0},${(90 + rand() * 80) | 0},255,0.3)`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 2, y - 2 - rand() * 5);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  tex.anisotropy = 8;
  return tex;
}

/* ------------------------------------------------------------- rugosidade */

function buildRoughness(pattern: MowPattern = "checker", size = 1024) {
  const spec = MOW[pattern];
  const made = canvas(size);
  if (!made) return null;
  const { c, ctx } = made;
  const rand = rng(0x5eed03);
  ctx.fillStyle = "#b0b0b0";
  ctx.fillRect(0, 0, size, size);

  // grama penteada para lados opostos reflete diferente: brilho úmido rasante
  withStripes(ctx, size, spec, (i, x, w) => {
    ctx.fillStyle = i % 2 === 0 ? "#828282" : "#d6d6d6";
    ctx.fillRect(x, 0, w, size * 2);
  });

  // poças de brilho e áreas gastas (mais ásperas)
  for (let i = 0; i < 700; i++) {
    const gloss = rand() > 0.45;
    ctx.fillStyle = gloss
      ? `rgba(0,0,0,${0.03 + rand() * 0.07})`
      : `rgba(255,255,255,${0.03 + rand() * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(
      rand() * size,
      rand() * size,
      5 + rand() * 22,
      3 + rand() * 10,
      rand() * 3,
      0,
      7,
    );
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  return tex;
}

/* ---------------------------------------------------------------- cache */

const _albedo = new Map<MowPattern, THREE.Texture | null>();
const _normal = new Map<MowPattern, THREE.Texture | null>();
const _rough = new Map<MowPattern, THREE.Texture | null>();

export function grassAlbedo(pattern: MowPattern = "checker") {
  if (!_albedo.has(pattern)) _albedo.set(pattern, buildAlbedo(pattern));
  return _albedo.get(pattern) ?? null;
}

export function grassNormal(pattern: MowPattern = "checker") {
  if (!_normal.has(pattern)) _normal.set(pattern, buildNormal(pattern));
  return _normal.get(pattern) ?? null;
}

export function grassRoughness(pattern: MowPattern = "checker") {
  if (!_rough.has(pattern)) _rough.set(pattern, buildRoughness(pattern));
  return _rough.get(pattern) ?? null;
}
