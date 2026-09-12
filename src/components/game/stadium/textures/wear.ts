import * as THREE from "three";

/**
 * Camada de desgaste do gramado.
 *
 * O gramado de um estádio de verdade nunca é uniforme: a grande área, o
 * círculo central, a marca do pênalti e os corredores das laterais recebem
 * muito mais pisada e ficam mais claros, mais secos e, em alguns pontos,
 * com terra exposta.
 *
 * Esta textura é um RGBA transparente que fica *por cima* do gramado, e é
 * gerada uma única vez por sessão (semente fixa: o mesmo campo em todas as
 * recargas).
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

const SIZE = 2048;

/** Proporção do campo dentro da textura (com a mesma folga da textura de cal). */
const FIELD_W = 105;
const FIELD_H = 68;

function toPx(mx: number, mz: number) {
  // metros (centro do campo na origem) -> pixels da textura
  return [((mx + FIELD_W / 2) / FIELD_W) * SIZE, ((mz + FIELD_H / 2) / FIELD_H) * SIZE] as const;
}

function blob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
  color: string,
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace("ALPHA", String(alpha)));
  g.addColorStop(0.6, color.replace("ALPHA", String(alpha * 0.55)));
  g.addColorStop(1, color.replace("ALPHA", "0"));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Nuvem irregular de desgaste em volta de um ponto (em metros). */
function wearZone(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  mx: number,
  mz: number,
  radiusM: number,
  strength: number,
) {
  const [cx, cy] = toPx(mx, mz);
  const rPx = (radiusM / FIELD_W) * SIZE;
  const puffs = 14 + Math.floor(rand() * 10);
  for (let i = 0; i < puffs; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.pow(rand(), 0.6) * rPx;
    const r = rPx * (0.25 + rand() * 0.45);
    blob(
      ctx,
      cx + Math.cos(a) * d,
      cy + Math.sin(a) * d * 0.9,
      r,
      strength * (0.35 + rand() * 0.65),
      "rgba(176,168,120,ALPHA)",
    );
  }
}

/** Terra exposta: manchas menores, mais escuras e mais saturadas. */
function dirtPatch(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  mx: number,
  mz: number,
  radiusM: number,
  strength: number,
) {
  const [cx, cy] = toPx(mx, mz);
  const rPx = (radiusM / FIELD_W) * SIZE;
  for (let i = 0; i < 8; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.pow(rand(), 0.7) * rPx;
    blob(
      ctx,
      cx + Math.cos(a) * d,
      cy + Math.sin(a) * d,
      rPx * (0.18 + rand() * 0.3),
      strength * (0.4 + rand() * 0.6),
      "rgba(122,94,58,ALPHA)",
    );
  }
}

function make() {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const rand = rng(0xdea41);

  ctx.clearRect(0, 0, SIZE, SIZE);

  // ---- pequenas áreas (as duas grandes áreas sofrem o dobro)
  for (const side of [-1, 1]) {
    const gx = side * (FIELD_W / 2 - 8);
    // boca da pequena área
    wearZone(ctx, rand, gx, 0, 9, 0.5);
    // linha do gol / dentro da meta
    wearZone(ctx, rand, side * (FIELD_W / 2 - 1.5), 0, 5.5, 0.62);
    dirtPatch(ctx, rand, side * (FIELD_W / 2 - 2.2), 0, 4.5, 0.5);
    // marca do pênalti
    wearZone(ctx, rand, side * (FIELD_W / 2 - 11), 0, 2.4, 0.7);
    dirtPatch(ctx, rand, side * (FIELD_W / 2 - 11), 0, 1.6, 0.65);
  }

  // ---- círculo central e meio de campo
  wearZone(ctx, rand, 0, 0, 6.5, 0.34);
  dirtPatch(ctx, rand, 0, 0, 1.8, 0.45);
  for (let i = -3; i <= 3; i++) wearZone(ctx, rand, 0, i * 7, 4, 0.16);

  // ---- corredores das laterais (onde os pontas correm o jogo todo)
  for (const z of [-1, 1]) {
    for (let i = -6; i <= 6; i++) {
      wearZone(ctx, rand, i * 8, z * (FIELD_H / 2 - 4), 5.5, 0.14 + rand() * 0.08);
    }
  }

  // ---- desgaste difuso geral, para nada ficar perfeito (bem sutil)
  for (let i = 0; i < 220; i++) {
    const mx = (rand() - 0.5) * FIELD_W;
    const mz = (rand() - 0.5) * FIELD_H;
    const [x, y] = toPx(mx, mz);
    blob(ctx, x, y, 8 + rand() * 26, 0.012 + rand() * 0.02, "rgba(190,182,140,ALPHA)");
  }

  // ---- lama: manchas escuras e úmidas nos cantos e atrás das metas
  for (let i = 0; i < 40; i++) {
    const mx = (rand() - 0.5) * FIELD_W * 0.98;
    const mz = (rand() - 0.5) * FIELD_H * 0.98;
    const edge = Math.max(Math.abs(mx) / (FIELD_W / 2), Math.abs(mz) / (FIELD_H / 2));
    if (edge < 0.55) continue;
    const [x, y] = toPx(mx, mz);
    blob(ctx, x, y, 24 + rand() * 60, 0.06 + rand() * 0.12, "rgba(58,46,28,ALPHA)");
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

let _wear: THREE.Texture | null | undefined;

/** Camada de desgaste/lama do gramado (RGBA transparente, cache por sessão). */
export function pitchWearTexture() {
  if (_wear === undefined) _wear = make();
  return _wear ?? null;
}

/* ------------------------------------------------------- rugosidade do desgaste */

function makeRough() {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const rand = rng(0x5c9f1);

  // base: grama levemente áspera
  ctx.fillStyle = "#b4b4b4";
  ctx.fillRect(0, 0, 1024, 1024);

  // zonas pisadas ficam mais lisas (refletem mais quando molhadas)
  for (let i = 0; i < 900; i++) {
    const x = rand() * 1024;
    const y = rand() * 1024;
    const r = 8 + rand() * 60;
    const v = Math.floor(120 + rand() * 90);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${v},${v},${v},0.35)`);
    g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

let _wr: THREE.Texture | null | undefined;

/** Mapa de rugosidade que acompanha o desgaste (usado no gramado). */
export function wearRoughness() {
  if (_wr === undefined) _wr = makeRough();
  return _wr ?? null;
}
