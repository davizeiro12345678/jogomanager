import * as THREE from "three";

/**
 * Texturas procedurais determinísticas do gramado.
 *
 * Tudo é gerado uma única vez por sessão e compartilhado entre partidas
 * (carreira, partida rápida e multiplayer) — nenhuma textura é recriada ao
 * trocar de tela, o que evita picos de GPU/CPU no celular.
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

const STRIPE_ANGLE = -0.22;
const STRIPES = 40;

function withStripes(
  ctx: CanvasRenderingContext2D,
  size: number,
  draw: (i: number, x: number, w: number) => void,
) {
  const w = (size * 2) / STRIPES;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(STRIPE_ANGLE);
  ctx.translate(-size, -size);
  for (let i = 0; i < STRIPES; i++) draw(i, i * w, w);
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

function buildAlbedo(size = 2048) {
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
  withStripes(ctx, size, (i, x, w) => {
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

function buildNormal(size = 1024) {
  const made = canvas(size);
  if (!made) return null;
  const { c, ctx } = made;
  const rand = rng(0x5eed02);
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);

  // inclinação oposta das faixas ceifadas
  withStripes(ctx, size / 2, (i, x, w) => {
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

function buildRoughness(size = 1024) {
  const made = canvas(size);
  if (!made) return null;
  const { c, ctx } = made;
  const rand = rng(0x5eed03);
  ctx.fillStyle = "#b0b0b0";
  ctx.fillRect(0, 0, size, size);

  // grama penteada para lados opostos reflete diferente: brilho úmido rasante
  withStripes(ctx, size, (i, x, w) => {
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

let _albedo: THREE.Texture | null | undefined;
let _normal: THREE.Texture | null | undefined;
let _rough: THREE.Texture | null | undefined;

export function grassAlbedo() {
  if (_albedo === undefined) _albedo = buildAlbedo();
  return _albedo;
}

export function grassNormal() {
  if (_normal === undefined) _normal = buildNormal();
  return _normal;
}

export function grassRoughness() {
  if (_rough === undefined) _rough = buildRoughness();
  return _rough;
}
