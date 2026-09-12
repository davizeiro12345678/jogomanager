import * as THREE from "three";

import { FIELD_X, FIELD_Z } from "@/game/sim";

/**
 * Marcação do campo pintada como textura (em vez de linhas de 1 pixel).
 *
 * A tinta tem borda irregular, falhas por desgaste e leve sangramento no
 * gramado — de perto parece cal aplicada de verdade, e de longe some
 * suavemente com o mipmap em vez de brilhar/serrilhar.
 */

/** meia-largura extra do plano de linhas (o mesmo do gramado principal) */
export const LINES_PAD = 5;
export const LINES_W = FIELD_X * 2 + LINES_PAD * 2;
export const LINES_H = FIELD_Z * 2 + LINES_PAD * 2;

const PX_PER_M = 18;

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

function build() {
  if (typeof document === "undefined") return null;
  const w = Math.round(LINES_W * PX_PER_M);
  const h = Math.round(LINES_H * PX_PER_M);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const rand = rng(0xa11e5);

  const cx = w / 2;
  const cy = h / 2;
  const X = (m: number) => cx + m * PX_PER_M;
  const Y = (m: number) => cy + m * PX_PER_M;

  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";

  const paint = (draw: () => void, width = 0.12) => {
    // três passadas: sangramento largo e fraco, corpo da tinta e miolo claro
    ctx.save();
    ctx.strokeStyle = "rgba(236,244,238,0.16)";
    ctx.lineWidth = width * PX_PER_M * 2.6;
    ctx.filter = "blur(2px)";
    draw();
    ctx.filter = "none";
    ctx.strokeStyle = "rgba(240,248,242,0.86)";
    ctx.lineWidth = width * PX_PER_M * 1.45;
    draw();
    ctx.strokeStyle = "rgba(255,255,255,0.97)";
    ctx.lineWidth = width * PX_PER_M;
    draw();
    ctx.restore();
  };

  const rect = (x0: number, z0: number, x1: number, z1: number) => () => {
    ctx.beginPath();
    ctx.rect(X(x0), Y(z0), (x1 - x0) * PX_PER_M, (z1 - z0) * PX_PER_M);
    ctx.stroke();
  };
  const seg = (x0: number, z0: number, x1: number, z1: number) => () => {
    ctx.beginPath();
    ctx.moveTo(X(x0), Y(z0));
    ctx.lineTo(X(x1), Y(z1));
    ctx.stroke();
  };
  const arc = (x: number, z: number, r: number, a0: number, a1: number) => () => {
    ctx.beginPath();
    ctx.arc(X(x), Y(z), r * PX_PER_M, a0, a1);
    ctx.stroke();
  };

  // contorno, meio-campo e círculo central
  paint(rect(-FIELD_X, -FIELD_Z, FIELD_X, FIELD_Z));
  paint(seg(0, -FIELD_Z, 0, FIELD_Z));
  paint(arc(0, 0, 9.15, 0, Math.PI * 2));

  for (const s of [1, -1]) {
    // grande área e pequena área
    paint(rect(s * FIELD_X, -20.16, s * (FIELD_X - 16.5), 20.16));
    paint(rect(s * FIELD_X, -9.16, s * (FIELD_X - 5.5), 9.16));
    // meia-lua
    const px = s * (FIELD_X - 11);
    const a = Math.acos(5.5 / 9.15);
    paint(
      arc(
        px,
        0,
        9.15,
        s > 0 ? Math.PI / 2 + a : -Math.PI / 2 + a,
        s > 0 ? (3 * Math.PI) / 2 - a : Math.PI / 2 - a,
      ),
    );
    // marca do pênalti
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(X(px), Y(0), 0.16 * PX_PER_M, 0, 7);
    ctx.fill();
    // cantos
    for (const z of [1, -1]) {
      paint(arc(s * FIELD_X, z * FIELD_Z, 1, 0, Math.PI * 2), 0.1);
    }
  }
  // ponto central
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(cx, cy, 0.16 * PX_PER_M, 0, 7);
  ctx.fill();

  // desgaste: a cal descasca em manchas pequenas
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 5200; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.fillStyle = `rgba(0,0,0,${0.25 + rand() * 0.6})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 1 + rand() * 5, 1 + rand() * 3, rand() * 3, 0, 7);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  // respingos de cal fora da linha
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(240,246,240,${0.05 + rand() * 0.16})`;
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, 0.6 + rand() * 1.8, 0, 7);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

let _lines: THREE.Texture | null | undefined;

export function pitchLinesTexture() {
  if (_lines === undefined) _lines = build();
  return _lines;
}
