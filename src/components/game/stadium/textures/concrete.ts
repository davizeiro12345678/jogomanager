import * as THREE from "three";

/**
 * Concreto do estádio: painéis com juntas, manchas de chuva escorrida,
 * poeira acumulada e pequenas falhas. Gerado uma vez por sessão.
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

function make(size: number) {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  return { c, ctx };
}

function buildAlbedo(size = 512) {
  const made = make(size);
  if (!made) return null;
  const { c, ctx } = made;
  const rand = rng(0xc0c0de);

  ctx.fillStyle = "#6a7178";
  ctx.fillRect(0, 0, size, size);

  // variação de placa
  for (let i = 0; i < 220; i++) {
    const r = size * (0.04 + rand() * 0.14);
    const x = rand() * size;
    const y = rand() * size;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = rand() > 0.5;
    g.addColorStop(0, dark ? "rgba(30,36,42,0.14)" : "rgba(200,206,212,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // juntas dos painéis
  ctx.strokeStyle = "rgba(24,28,33,0.4)";
  ctx.lineWidth = 3;
  const cells = 4;
  for (let i = 1; i < cells; i++) {
    ctx.beginPath();
    ctx.moveTo((i * size) / cells, 0);
    ctx.lineTo((i * size) / cells, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, (i * size) / cells);
    ctx.lineTo(size, (i * size) / cells);
    ctx.stroke();
  }

  // escorrido de chuva
  for (let i = 0; i < 260; i++) {
    const x = rand() * size;
    const y = rand() * size * 0.7;
    const len = size * (0.05 + rand() * 0.3);
    const g = ctx.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, "rgba(28,32,36,0.22)");
    g.addColorStop(1, "rgba(28,32,36,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, 1 + rand() * 5, len);
  }

  // poeira e chiado fino
  for (let i = 0; i < 26000; i++) {
    ctx.fillStyle = `rgba(${rand() > 0.5 ? "255,255,255" : "0,0,0"},${0.02 + rand() * 0.05})`;
    ctx.fillRect(rand() * size, rand() * size, 1.4, 1.4);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function buildRoughness(size = 256) {
  const made = make(size);
  if (!made) return null;
  const { c, ctx } = made;
  const rand = rng(0x5171);
  ctx.fillStyle = "#c8c8c8";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(${rand() > 0.5 ? "255,255,255" : "60,60,60"},${0.05 + rand() * 0.18})`;
    ctx.beginPath();
    ctx.ellipse(rand() * size, rand() * size, 3 + rand() * 26, 2 + rand() * 12, rand() * 3, 0, 7);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** One row of moulded plastic seats at physical scale. The old twelve-row
 * atlas was cropped on every riser, producing oversized dark bands. Real
 * aisle cutouts live in the geometry; this tile must not invent extra aisles.
 * Baked seat depth, hinges and tread shadows need no seat meshes or normals. */
function buildSeats(a: string, b: string) {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const rand = rng(0x5ea75);
  const width = 64;
  const tread = ctx.createLinearGradient(0, 0, 0, c.height);
  tread.addColorStop(0, "#31383d");
  tread.addColorStop(0.35, "#41484b");
  tread.addColorStop(1, "#242a2d");
  ctx.fillStyle = tread;
  ctx.fillRect(0, 0, c.width, c.height);
  for (let seat = 0; seat < 8; seat++) {
    const x = seat * width + 7;
    const w = width - 14;
    // All colour variation is deterministic; club colours retain identity.
    ctx.fillStyle = "rgba(8,12,14,0.52)";
    ctx.fillRect(x - 3, 16, w + 6, 95);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, 77);
    ctx.lineTo(x, 24);
    ctx.quadraticCurveTo(x, 12, x + 12, 12);
    ctx.lineTo(x + w - 12, 12);
    ctx.quadraticCurveTo(x + w, 12, x + w, 24);
    ctx.lineTo(x + w, 77);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = seat === 2 || seat === 6 ? b : a;
    ctx.fillRect(x, 12, w, 65);
    const shell = ctx.createLinearGradient(x, 0, x + w, 0);
    shell.addColorStop(0, "rgba(0,0,0,0.29)");
    shell.addColorStop(0.18, "rgba(255,255,255,0.09)");
    shell.addColorStop(0.52, "rgba(255,255,255,0.015)");
    shell.addColorStop(1, "rgba(0,0,0,0.24)");
    ctx.fillStyle = shell;
    ctx.fillRect(x, 12, w, 65);
    const fade = ctx.createLinearGradient(0, 12, 0, 77);
    fade.addColorStop(0, "rgba(255,255,255,0.16)");
    fade.addColorStop(0.17, "rgba(255,255,255,0)");
    fade.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = fade;
    ctx.fillRect(x, 12, w, 65);
    ctx.fillStyle = `rgba(50,44,35,${0.025 + rand() * 0.07})`;
    ctx.fillRect(x, 12, w, 65);
    ctx.restore();
    // Two hinges and a folded seat pan, painted into the same opaque tile.
    ctx.fillStyle = "#24292b";
    ctx.fillRect(x + 3, 73, 5, 22);
    ctx.fillRect(x + w - 8, 73, 5, 22);
    ctx.fillStyle = seat === 2 || seat === 6 ? b : a;
    ctx.fillRect(x + 2, 81, w - 4, 13);
    ctx.fillStyle = "rgba(255,255,255,0.13)";
    ctx.fillRect(x + 3, 81, w - 6, 2);
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(x + 2, 92, w - 4, 4);
    ctx.fillStyle = "rgba(9,12,13,0.36)";
    ctx.fillRect(x + 5, 103, w - 10, 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.name = "stadium-seat-row";
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

let _albedo: THREE.Texture | null | undefined;
let _rough: THREE.Texture | null | undefined;
const _seats = new Map<string, THREE.Texture | null>();

export function concreteAlbedo() {
  if (_albedo === undefined) _albedo = buildAlbedo();
  return _albedo;
}

export function concreteRoughness() {
  if (_rough === undefined) _rough = buildRoughness();
  return _rough;
}

export function seatsTexture(a: string, b: string) {
  const key = `${a}|${b}`;
  if (!_seats.has(key)) _seats.set(key, buildSeats(a, b));
  return _seats.get(key) ?? null;
}
