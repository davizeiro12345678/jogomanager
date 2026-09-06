import * as THREE from "three";

/**
 * Bandeirões, faixas e mosaicos da torcida.
 *
 * As cores vêm dos clubes em jogo, então há um pequeno cache por par de
 * cores (no máximo alguns itens por partida).
 */

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

function cv(w: number, h: number) {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  return { c, ctx };
}

function finish(c: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/* ------------------------------------------------------------ mosaico setor */

const _mosaic = new Map<string, THREE.Texture | null>();

/**
 * Mosaico de cartolinas: milhares de quadradinhos formando faixas
 * diagonais nas cores do clube, com falhas (torcedor que não levantou
 * a cartolina) para não parecer impresso.
 */
export function mosaicTexture(a: string, b: string) {
  const key = `${a}|${b}`;
  const hit = _mosaic.get(key);
  if (hit !== undefined) return hit;
  const made = cv(512, 256);
  if (!made) {
    _mosaic.set(key, null);
    return null;
  }
  const { c, ctx } = made;
  const rand = rng(0x70f0);
  const cell = 8;
  ctx.fillStyle = "#1b1f24";
  ctx.fillRect(0, 0, 512, 256);
  for (let y = 0; y < 256; y += cell) {
    for (let x = 0; x < 512; x += cell) {
      const band = Math.floor((x + y * 1.4) / 46) % 2 === 0;
      let col = band ? a : b;
      const r = rand();
      if (r < 0.07) col = "#20252b"; // cartolina não levantada
      else if (r < 0.1) col = "#e8e8e8";
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.82 + rand() * 0.18;
      ctx.fillRect(x, y, cell - 1, cell - 1);
    }
  }
  ctx.globalAlpha = 1;
  const tex = finish(c);
  _mosaic.set(key, tex);
  return tex;
}

/* ------------------------------------------------------------------- faixa */

const _banner = new Map<string, THREE.Texture | null>();

/** Faixa horizontal de torcida organizada, com texto e barra de cor. */
export function bannerTexture(text: string, bg: string, fg: string) {
  const key = `${text}|${bg}|${fg}`;
  const hit = _banner.get(key);
  if (hit !== undefined) return hit;
  const made = cv(1024, 128);
  if (!made) {
    _banner.set(key, null);
    return null;
  }
  const { c, ctx } = made;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = fg;
  ctx.fillRect(0, 0, 1024, 8);
  ctx.fillRect(0, 120, 1024, 8);
  ctx.font = "bold 68px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = fg;
  ctx.fillText(text.toUpperCase().slice(0, 26), 512, 68);
  // sujeira e vinco do pano
  const rand = rng(0xba71);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.03 + rand() * 0.06})`;
    ctx.fillRect(rand() * 1024, 0, 1 + rand() * 3, 128);
  }
  const tex = finish(c);
  _banner.set(key, tex);
  return tex;
}

/* -------------------------------------------------------------- bandeirão */

const _flag = new Map<string, THREE.Texture | null>();

/** Bandeirão grande atrás do gol: listras, escudo abstrato e desgaste. */
export function bigFlagTexture(a: string, b: string) {
  const key = `${a}|${b}`;
  const hit = _flag.get(key);
  if (hit !== undefined) return hit;
  const made = cv(512, 320);
  if (!made) {
    _flag.set(key, null);
    return null;
  }
  const { c, ctx } = made;
  const rand = rng(0xf1a9);
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, 512, 320);
  ctx.fillStyle = b;
  for (let i = 0; i < 512; i += 96) ctx.fillRect(i, 0, 48, 320);
  // "escudo" simplificado no centro
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.moveTo(256, 70);
  ctx.lineTo(340, 110);
  ctx.lineTo(340, 190);
  ctx.quadraticCurveTo(256, 262, 172, 190);
  ctx.lineTo(172, 110);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = b;
  ctx.beginPath();
  ctx.arc(256, 158, 34, 0, Math.PI * 2);
  ctx.fill();
  // desgaste do pano
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.02 + rand() * 0.06})`;
    ctx.beginPath();
    ctx.arc(rand() * 512, rand() * 320, 4 + rand() * 26, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = finish(c);
  _flag.set(key, tex);
  return tex;
}
