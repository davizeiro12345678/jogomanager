// ============================================================================
//  fabric.ts
//  Texturas procedurais de superfície para os jogadores.
//
//  Geramos mapas de normal (relevo) e de rugosidade em canvas, uma única vez
//  por tipo, e reaproveitamos em todos os atletas em campo. Sem download, sem
//  arquivo, sem custo de rede — e o gramado ganha camisas com trama visível,
//  meião canelado e pele com poros em vez de plástico liso.
// ============================================================================

import * as THREE from "three";

const cache = new Map<string, THREE.CanvasTexture | null>();

export function hairFiberColor(color: string): THREE.CanvasTexture | null {
  const texture = make(`hair-color:${color}`, 256, 1, (ctx, size) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    for (let strand = 0; strand < size * 2; strand++) {
      const x = strand * 0.5;
      ctx.strokeStyle = strand % 5 === 0 ? "rgba(255,245,224,0.07)" : "rgba(0,0,0,0.12)";
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      for (let y = 0; y <= size; y += 4) {
        const px = x + Math.sin((y / size) * Math.PI * 2 + strand * 0.37) * 1.4;
        if (y === 0) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
    }
  });
  if (texture) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function hairlineMask(): THREE.CanvasTexture | null {
  const texture = make("hairline-mask", 128, 1, (ctx, size) => {
    const data = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const v = 1 - y / (size - 1),
          edge = 0.012 + 0.006 * (0.5 + 0.5 * Math.sin(x * 1.1));
        const a = THREE.MathUtils.smoothstep(v, edge, edge + 0.055) * 255;
        const i = (y * size + x) * 4;
        data.data[i] = data.data[i + 1] = data.data[i + 2] = a;
        data.data[i + 3] = 255;
      }
    ctx.putImageData(data, 0, 0);
  });
  if (texture) texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function beardFiberMask(stubble = false): THREE.CanvasTexture | null {
  return make(`beard-fiber-mask:${stubble}`, 256, 1, (ctx, size) => {
    ctx.fillStyle = stubble ? "#303030" : "#b9b9b9";
    ctx.fillRect(0, 0, size, size);
    let state = 173;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    // Short, irregular whiskers avoid the regular hatch of the old mask.
    for (let strand = 0; strand < 12000; strand++) {
      const x = random() * size,
        y = random() * size;
      const length = stubble ? 0.4 + random() * 0.9 : 0.8 + random() * 2.1;
      const grey = Math.round(180 + random() * 75);
      ctx.strokeStyle = `rgb(${grey},${grey},${grey})`;
      ctx.lineWidth = 0.35 + random() * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (random() - 0.5) * 1.7, y + length);
      ctx.stroke();
    }
    const data = ctx.getImageData(0, 0, size, size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const v = y / (size - 1);
        const edge = 0.008 + 0.012 * (0.5 + 0.5 * Math.sin(x * 1.7));
        const fade =
          THREE.MathUtils.smoothstep(v, edge, 0.12) *
          (1 - THREE.MathUtils.smoothstep(v, 0.89, 1 - edge));
        const i = (y * size + x) * 4;
        data.data[i] = data.data[i + 1] = data.data[i + 2] = data.data[i]! * fade;
      }
    ctx.putImageData(data, 0, 0);
  });
}

export function beardFiberColor(color: string): THREE.CanvasTexture | null {
  const texture = make(`beard-color:${color}`, 256, 1, (ctx, size) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    let state = 0x91e10;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    for (let i = 0; i < 9000; i++) {
      const x = random() * size,
        y = random() * size;
      ctx.strokeStyle = i % 3 === 0 ? "rgba(240,218,191,0.13)" : "rgba(3,5,4,0.22)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (x / size - 0.5) * 2, y + 1.5 + random() * 2);
      ctx.stroke();
    }
  });
  if (texture) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A shared radial iris atlas, with a dark limbal edge and fine fibres. */
export function irisColor(color: string): THREE.CanvasTexture | null {
  const texture = make(`iris-color:${color}`, 128, 1, (ctx, size) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 240; i++) {
      const angle = (i * Math.PI * 2) / 240;
      const inner = size * (0.17 + 0.04 * Math.sin(i * 1.9));
      const outer = size * (0.47 + 0.025 * Math.sin(i * 2.7));
      ctx.strokeStyle = i % 3 === 0 ? "rgba(230,222,176,0.25)" : "rgba(16,21,16,0.36)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(size / 2 + Math.cos(angle) * inner, size / 2 + Math.sin(angle) * inner);
      ctx.lineTo(size / 2 + Math.cos(angle) * outer, size / 2 + Math.sin(angle) * outer);
      ctx.stroke();
    }
    const shade = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.32,
      size / 2,
      size / 2,
      size * 0.5,
    );
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(6,12,10,0.65)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, size, size);
  });
  if (texture) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Fine directional fibre grooves, available even before HD assets load. */
export function hairStrandNormal(): THREE.CanvasTexture | null {
  return make("hair-strands", 128, 2, (ctx, size) => {
    const data = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const groove =
          Math.sin(x * Math.PI * 0.68 + Math.sin((y * Math.PI) / 64) * 0.45) * 0.42 +
          Math.sin(x * Math.PI * 1.25 + (y * Math.PI) / 64) * 0.12;
        const value = 128 + groove * 32;
        data.data[i] = data.data[i + 1] = data.data[i + 2] = value;
        data.data[i + 3] = 255;
      }
    ctx.putImageData(data, 0, 0);
    heightToNormal(ctx, size, 0.85);
  });
}

function make(
  key: string,
  size: number,
  repeat: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): THREE.CanvasTexture | null {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (typeof document === "undefined") {
    cache.set(key, null);
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    cache.set(key, null);
    return null;
  }
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

/** converte um campo de altura em mapa de normal, no próprio contexto */
function heightToNormal(ctx: CanvasRenderingContext2D, size: number, strength: number) {
  const src = ctx.getImageData(0, 0, size, size);
  const out = ctx.createImageData(size, size);
  const at = (x: number, y: number) => {
    const xi = (x + size) % size;
    const yi = (y + size) % size;
    return src.data[(yi * size + xi) * 4]! / 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      // normaliza (-dx, -dy, 1)
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = (1 / len) * 0.5 * 255 + 127;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}

/** trama de malha esportiva: fios cruzados finos + furinhos de ventilação */
export function jerseyWeaveNormal(): THREE.CanvasTexture | null {
  return make("jersey-weave", 256, 16, (ctx, size) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, size, size);
    const cell = 8;
    for (let y = 0; y < size; y += cell) {
      for (let x = 0; x < size; x += cell) {
        const up = (x / cell + y / cell) % 2 === 0;
        ctx.fillStyle = up ? "#d8d8d8" : "#565656";
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      }
    }
    // furinhos de ventilação da malha
    ctx.fillStyle = "#202020";
    for (let y = cell / 2; y < size; y += cell * 2) {
      for (let x = cell / 2; x < size; x += cell * 2) {
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    heightToNormal(ctx, size, 2.6);
  });
}

/** canelado vertical do meião */
export function sockRibNormal(): THREE.CanvasTexture | null {
  return make("sock-rib", 128, 10, (ctx, size) => {
    for (let x = 0; x < size; x++) {
      const v = 0.5 + 0.5 * Math.sin((x / size) * Math.PI * 2 * 16);
      const g = Math.round(60 + v * 160);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(x, 0, 1, size);
    }
    heightToNormal(ctx, size, 3.2);
  });
}

/** poros e microrrelevo da pele */
export function skinPoreNormal(): THREE.CanvasTexture | null {
  return make("skin-pore", 256, 6, (ctx, size) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, size, size);
    let s = 1234567;
    const rnd = () => {
      s ^= s << 13;
      s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5;
      s >>>= 0;
      return s / 4294967296;
    };
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = 0.6 + rnd() * 1.5;
      const dark = rnd() < 0.6;
      ctx.fillStyle = dark ? "rgba(40,40,40,0.5)" : "rgba(220,220,220,0.45)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    heightToNormal(ctx, size, 1.1);
  });
}

/** couro sintético da chuteira: granulado fino */
export function bootGrainNormal(): THREE.CanvasTexture | null {
  return make("boot-grain", 128, 4, (ctx, size) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, size, size);
    let s = 987654321;
    const rnd = () => {
      s ^= s << 13;
      s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5;
      s >>>= 0;
      return s / 4294967296;
    };
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = rnd() < 0.5 ? "rgba(30,30,30,0.5)" : "rgba(230,230,230,0.4)";
      ctx.fillRect(rnd() * size, rnd() * size, 1.6, 1.6);
    }
    heightToNormal(ctx, size, 1.6);
  });
}

/** variação de brilho do tecido: áreas comprimidas e molhadas deixam de parecer plástico uniforme */
export function jerseyRoughness(): THREE.CanvasTexture | null {
  return make("jersey-roughness", 128, 10, (ctx, size) => {
    const image = ctx.createImageData(size, size);
    let seed = 0x51f15e;
    for (let i = 0; i < image.data.length; i += 4) {
      seed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      const x = (i / 4) % size;
      const weave = Math.sin(x * 0.72) * 8;
      const value = Math.max(96, Math.min(232, 184 + weave + ((seed >>> 24) - 128) * 0.12));
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  });
}

/** rugosidade irregular da pele, compartilhada por todos os jogadores em qualidade alta */
export function skinRoughness(): THREE.CanvasTexture | null {
  return make("skin-roughness", 128, 6, (ctx, size) => {
    const image = ctx.createImageData(size, size);
    let seed = 0x93a11;
    for (let i = 0; i < image.data.length; i += 4) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      const value = 142 + ((seed >>> 25) & 31);
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  });
}
