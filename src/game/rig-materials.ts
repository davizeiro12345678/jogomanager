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
    () => new THREE.MeshStandardMaterial({ color: "#f7f7f7", roughness: 0.28 }),
  );
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
    () => new THREE.MeshStandardMaterial({ color, roughness: 0.22, metalness: 0.05 }),
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
    const dark = new THREE.Color(skin).lerp(new THREE.Color("#3a1d12"), 0.45);
    return new THREE.MeshStandardMaterial({ color: dark, roughness: 0.62 });
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
