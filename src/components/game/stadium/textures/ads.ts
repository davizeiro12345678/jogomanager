import * as THREE from "three";

/**
 * Placas de LED da beira do campo: faixa longa com vários anúncios, brilho
 * de painel e leve varredura. A animação é feita deslocando o `offset` da
 * textura, sem redesenhar nada por quadro.
 */

const SPONSORS = [
  "MANAGER 3D",
  "COPA NACIONAL",
  "LIGA OFICIAL",
  "TORCIDA FC",
  "ESTÁDIO ARENA",
  "PATROCÍNIO",
  "FUTEBOL AO VIVO",
  "SUPER LIGA",
];

/**
 * Desenha o logo real de uma marca (Logo.dev) por cima do painel assim que a
 * imagem chega. Enquanto não chega, fica o painel de texto.
 */
function paintLogos(
  ctx: CanvasRenderingContext2D,
  tex: THREE.CanvasTexture,
  domains: string[],
  panel: number,
  h: number,
) {
  const token = import.meta.env["VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY"];
  if (!token) return;
  domains.slice(0, SPONSORS.length).forEach((domain, i) => {
    const clean = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!clean) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const x = i * panel;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + 6, 6, panel - 12, h - 12);
      const ratio = Math.min((panel - 60) / img.width, (h - 60) / img.height);
      const w2 = img.width * ratio;
      const h2 = img.height * ratio;
      ctx.drawImage(img, x + (panel - w2) / 2, (h - h2) / 2, w2, h2);
      tex.needsUpdate = true;
    };
    img.src = `https://img.logo.dev/${encodeURIComponent(clean)}?token=${token}&size=256&format=png`;
  });
}

function build(primary: string, secondary: string, sponsors: string[]) {
  if (typeof document === "undefined") return null;
  const w = 4096;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  const n = SPONSORS.length;
  const panel = w / n;
  for (let i = 0; i < n; i++) {
    const x = i * panel;
    const even = i % 2 === 0;
    const g = ctx.createLinearGradient(x, 0, x + panel, h);
    g.addColorStop(0, even ? primary : "#0d1117");
    g.addColorStop(1, even ? secondary : primary);
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, panel, h);

    ctx.fillStyle = even ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.9)";
    ctx.font = "bold 92px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(SPONSORS[i]!, x + panel / 2, h / 2);

    // moldura do painel
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 6;
    ctx.strokeRect(x + 3, 3, panel - 6, h - 6);
  }

  // grade de pixels do LED + varredura horizontal
  ctx.globalCompositeOperation = "multiply";
  for (let y = 0; y < h; y += 4) {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, y, w, 1.6);
  }
  ctx.globalCompositeOperation = "source-over";

  const tex = new THREE.CanvasTexture(c);
  if (sponsors.length) paintLogos(ctx, tex, sponsors, panel, h);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  return tex;
}

const cache = new Map<string, THREE.Texture | null>();

export function adTexture(primary: string, secondary: string, sponsors: string[] = []) {
  const key = `${primary}|${secondary}|${sponsors.join(",")}`;
  if (!cache.has(key)) cache.set(key, build(primary, secondary, sponsors));
  return cache.get(key) ?? null;
}
