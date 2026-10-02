// ============================================================================
//  rig-materials.ts
//  Materiais de detalhe compartilhados entre todos os atletas.
//
//  Olhos, íris, pupila, boca, travas de chuteira, braçadeira, fita de cabelo e
//  número da camisa eram criados inline no JSX de cada rig: 22 atletas geravam
//  22 materiais idênticos (e mais pressão de compilação de programa). Aqui eles
//  nascem uma vez e são reutilizados; a chave inclui a cor, então aparências
//  diferentes continuam distintas.
//
//  O cache é limitado e descarta as entradas mais antigas com dispose().
// ============================================================================

import * as THREE from "three";
import { beardFiberColor, beardFiberMask, hairStrandNormal, irisColor } from "./textures/fabric";
import { skinAlbedo } from "./player-morphology";

const MAX_ENTRIES = 64;
const cache = new Map<string, THREE.Material>();

/**
 * Devolve (e memoriza) um material de detalhe. `make` só é chamado quando a
 * chave ainda não existe.
 */
export function sharedDetailMaterial(key: string, make: () => THREE.Material): THREE.Material {
  const hit = cache.get(key);
  if (hit) {
    // LRU simples: reinsere para marcar como recente
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const material = make();
  cache.set(key, material);
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) {
      const victim = cache.get(oldest);
      cache.delete(oldest);
      victim?.dispose();
    }
  }
  return material;
}

/** Esvazia o cache (usado em teste para isolar os casos). */
export function resetSharedDetailMaterials(): void {
  for (const material of cache.values()) material.dispose();
  cache.clear();
}

/** Quantidade de materiais distintos em uso (diagnóstico). */
export function sharedDetailMaterialCount(): number {
  return cache.size;
}

/* -------------------------------------------------- materiais fixos */

/** Esclera do olho. */
export function eyeWhiteMaterial(): THREE.Material {
  return sharedDetailMaterial(
    "eye-white",
    () => new THREE.MeshStandardMaterial({ color: "#c9c3b8", roughness: 0.38 }),
  );
}

/** Stubble stays close to the skin; full beards have a softer hair tone. */
export function beardMaterial(skin: string, hair: string, style: string): THREE.Material {
  return sharedDetailMaterial(`beard:${skin}:${hair}:${style}`, () => {
    const tone = new THREE.Color(skinAlbedo(skin)).lerp(
      new THREE.Color(hair),
      style === "stubble" ? 0.3 : 0.8,
    );
    const map = beardFiberColor("#" + tone.getHexString());
    return new THREE.MeshStandardMaterial({
      color: map ? "#ffffff" : tone,
      map,
      roughness: 0.91,
      alphaMap: beardFiberMask(style === "stubble"),
      alphaTest: 0.04,
      transparent: true,
      opacity: style === "stubble" ? 0.65 : 0.96,
      depthWrite: false,
      alphaToCoverage: true,
      normalMap: hairStrandNormal(),
      normalScale: new THREE.Vector2(0.08, 0.12),
      envMapIntensity: 0.35,
    });
  });
}

/** Pupila. */
export function pupilMaterial(): THREE.Material {
  return sharedDetailMaterial(
    "pupil",
    () => new THREE.MeshStandardMaterial({ color: "#0b0b0b", roughness: 0.15 }),
  );
}

/** Íris na cor do atleta. */
export function irisMaterial(color: string): THREE.Material {
  return sharedDetailMaterial(
    `iris:${color}`,
    () =>
      new THREE.MeshStandardMaterial({
        color: irisColor(color) ? "#ffffff" : color,
        map: irisColor(color),
        roughness: 0.36,
      }),
  );
}

/** Travas da chuteira. */
export function studMaterial(): THREE.Material {
  return sharedDetailMaterial(
    "stud",
    () => new THREE.MeshStandardMaterial({ color: "#e6e6e6", roughness: 0.45, metalness: 0.3 }),
  );
}

/** Braçadeira de capitão. */
export function armbandMaterial(): THREE.Material {
  return sharedDetailMaterial(
    "armband",
    () => new THREE.MeshStandardMaterial({ color: "#ffd54a", roughness: 0.6 }),
  );
}

/**
 * Detalhe de pele (narinas, lábio, boca) num material único por tom: três
 * malhas a menos por atleta com a mesma leitura visual.
 */
export function skinDetailMaterial(skin: string): THREE.Material {
  return sharedDetailMaterial(`skin-detail:${skin}`, () => {
    const dark = new THREE.Color(skinAlbedo(skin)).lerp(new THREE.Color("#3a1d12"), 0.45);
    return new THREE.MeshStandardMaterial({ color: dark, vertexColors: true, roughness: 0.62 });
  });
}

/** Segunda campa por baixo da camisa. */
export function undershirtMaterial(color: string): THREE.Material {
  return sharedDetailMaterial(
    `undershirt:${color}`,
    () => new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
  );
}

/** Faixa de cabeça. */
export function headbandMaterial(color: string): THREE.Material {
  return sharedDetailMaterial(
    `headband:${color}`,
    () => new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
  );
}

/** Número/costa da camisa: básico e sem tone mapping, como transmissão. */
export function jerseyInkMaterial(color: string): THREE.Material {
  return sharedDetailMaterial(
    `ink:${color}`,
    () => new THREE.MeshBasicMaterial({ color, toneMapped: false }),
  );
}

/** Fita branca de pulso/meião. */
export function tapeMaterial(): THREE.Material {
  return sharedDetailMaterial(
    "tape",
    () => new THREE.MeshStandardMaterial({ color: "#f2f2ee", roughness: 0.85 }),
  );
}

/** Brinco dourado. */
export function goldMaterial(): THREE.Material {
  return sharedDetailMaterial(
    "gold",
    () => new THREE.MeshStandardMaterial({ color: "#e8b93c", roughness: 0.3, metalness: 0.85 }),
  );
}

/**
 * Tatuagem do antebraço: faixas tribais procedurais por semente, num cilindro
 * um pouco maior que o braço (fundo transparente). Uma textura 64² por atleta
 * tatuado — em campo, meia dúzia no máximo.
 */
export function tattooMaterial(seed: number): THREE.Material {
  return sharedDetailMaterial(`tattoo:${seed % 100003}`, () => {
    // fora do navegador (teste em Node) cai para tinta chapada
    if (typeof document === "undefined") {
      return new THREE.MeshStandardMaterial({ color: "#232126", roughness: 0.7 });
    }
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const c = canvas.getContext("2d")!;
    let s = seed % 100003 || 1;
    const rnd = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
    c.clearRect(0, 0, 64, 64);
    c.fillStyle = "rgba(24,22,26,0.92)";
    // 2 a 4 faixas horizontais irregulares + pontos
    const bands = 2 + Math.floor(rnd() * 3);
    for (let b = 0; b < bands; b++) {
      const y = 6 + b * (52 / bands) + rnd() * 6;
      const h = 3 + rnd() * 7;
      c.fillRect(0, y, 64, h);
      for (let d = 0; d < 8; d++) {
        const x = rnd() * 64;
        c.beginPath();
        c.arc(x, y + h + 3 + rnd() * 5, 1 + rnd() * 1.6, 0, Math.PI * 2);
        c.fill();
      }
    }
    // espinhos verticais ligando as faixas
    for (let t = 0; t < 10; t++) {
      const x = rnd() * 64;
      c.fillRect(x, 4 + rnd() * 10, 2, 20 + rnd() * 30);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7 });
  });
}
