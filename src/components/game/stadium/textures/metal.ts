import * as THREE from "three";

/**
 * Texturas de metal do estádio: treliça da cobertura, grades dos setores,
 * corrimãos e estruturas dos refletores. Tudo procedural, com semente fixa,
 * gerado uma vez por sessão.
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

/* ----------------------------------------------------------- metal escovado */

function makeBrushed() {
  const made = cv(512, 512);
  if (!made) return null;
  const { c, ctx } = made;
  const rand = rng(0x3e7a1);

  ctx.fillStyle = "#8d949b";
  ctx.fillRect(0, 0, 512, 512);

  // riscos horizontais do escovado
  for (let i = 0; i < 2600; i++) {
    const y = rand() * 512;
    const x = rand() * 512;
    const len = 20 + rand() * 160;
    const v = 120 + Math.floor(rand() * 90);
    ctx.strokeStyle = `rgba(${v},${v + 4},${v + 10},${0.05 + rand() * 0.12})`;
    ctx.lineWidth = rand() < 0.85 ? 1 : 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (rand() - 0.5) * 1.5);
    ctx.stroke();
  }

  // oxidação e sujeira acumulada
  for (let i = 0; i < 90; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 6 + rand() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(96,72,48,${0.05 + rand() * 0.16})`);
    g.addColorStop(1, "rgba(96,72,48,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // rebites em linha, dando escala à estrutura
  for (let x = 16; x < 512; x += 64) {
    for (let y = 16; y < 512; y += 64) {
      ctx.fillStyle = "rgba(60,66,72,0.55)";
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(220,226,232,0.28)";
      ctx.beginPath();
      ctx.arc(x - 0.9, y - 0.9, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

let _brushed: THREE.Texture | null | undefined;

/** Metal escovado com rebites e oxidação (treliça, corrimãos, mastros). */
export function metalAlbedo() {
  if (_brushed === undefined) _brushed = makeBrushed();
  return _brushed ?? null;
}

/* ------------------------------------------------------ rugosidade do metal */

function makeMetalRough() {
  const made = cv(512, 512);
  if (!made) return null;
  const { c, ctx } = made;
  const rand = rng(0x3e7b2);
  ctx.fillStyle = "#6a6a6a";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1800; i++) {
    const y = rand() * 512;
    const x = rand() * 512;
    const v = 70 + Math.floor(rand() * 110);
    ctx.strokeStyle = `rgba(${v},${v},${v},0.2)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 30 + rand() * 120, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

let _metalRough: THREE.Texture | null | undefined;

export function metalRoughness() {
  if (_metalRough === undefined) _metalRough = makeMetalRough();
  return _metalRough ?? null;
}

/* --------------------------------------------------------------- grade/tela */

function makeGrid() {
  const made = cv(256, 256);
  if (!made) return null;
  const { c, ctx } = made;
  ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(215,222,228,0.95)";
  ctx.lineWidth = 9;
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
  }
  ctx.lineWidth = 6;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

let _grid: THREE.Texture | null | undefined;

/** Grade vazada dos setores (RGBA com furos transparentes). */
export function grilleTexture() {
  if (_grid === undefined) _grid = makeGrid();
  return _grid ?? null;
}
