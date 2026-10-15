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
const users = new WeakMap<THREE.Material, number>();
const retired = new WeakSet<THREE.Material>();

function retireSharedMaterial(material: THREE.Material) {
  if ((users.get(material) ?? 0) > 0) retired.add(material);
  else disposeSharedMaterial(material);
}

/** A rig may outlive an LRU entry (studio edits and substitutions). Keep its
 * detail maps alive until its last mounted owner releases them. */
export function retainSharedDetailMaterials(materials: Iterable<THREE.Material>): () => void {
  const unique = new Set(materials);
  for (const material of unique) users.set(material, (users.get(material) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const material of unique) {
      const count = Math.max(0, (users.get(material) ?? 1) - 1);
      users.set(material, count);
      if (count === 0 && retired.has(material)) {
        retired.delete(material);
        disposeSharedMaterial(material);
      }
    }
  };
}

function disposeSharedMaterial(material: THREE.Material) {
  material.dispose();
  const owned = material.userData["ownedTexture"] as THREE.Texture | undefined;
  owned?.dispose();
}

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
      if (victim) retireSharedMaterial(victim);
    }
  }
  return material;
}

/** Esvazia o cache (usado em teste para isolar os casos). */
export function resetSharedDetailMaterials(): void {
  for (const material of cache.values()) retireSharedMaterial(material);
  cache.clear();
}

/** Quantidade de materiais distintos em uso (diagnóstico). */
export function sharedDetailMaterialCount(): number {
  return cache.size;
}

/* -------------------------------------------------- materiais fixos */

/** Esclera do olho. */
export function eyeWhiteMaterial(hi = false): THREE.Material {
  return sharedDetailMaterial(`eye-white:${hi}`, () =>
    hi
      ? new THREE.MeshPhysicalMaterial({
          color: "#c9c3b8",
          vertexColors: true,
          roughness: 0.5,
          clearcoat: 0.12,
          clearcoatRoughness: 0.18,
          ior: 1.376,
        })
      : new THREE.MeshStandardMaterial({ color: "#b8b2a9", vertexColors: true, roughness: 0.52 }),
  );
}

/** The shell and its edge tint must use the same linear albedo. Mixing the
 * saved skin colour into one and the corrected render colour into the other
 * left a pale yellow strip around dark beards in portrait lighting. */
export function beardAlbedo(skin: string, hair: string, style: string): THREE.Color {
  return new THREE.Color(skinAlbedo(skin)).lerp(
    new THREE.Color(hair),
    style === "stubble" ? 0.3 : 0.7,
  );
}

/** Stubble stays close to the skin; full beards retain a warm skin transition. */
export function beardMaterial(skin: string, hair: string, style: string): THREE.Material {
  return sharedDetailMaterial(`beard:${skin}:${hair}:${style}`, () => {
    const tone = beardAlbedo(skin, hair, style);
    const map = beardFiberColor("#" + tone.getHexString());
    return new THREE.MeshStandardMaterial({
      color: map ? "#ffffff" : tone,
      vertexColors: true,
      map,
      roughness: 0.94,
      alphaMap: beardFiberMask(style === "stubble"),
      // Keep the dense central growth, but allow the fibre mask to soften the
      // edge rather than layering an almost opaque dark shell over the jaw.
      alphaTest: style === "stubble" ? 0.04 : 0.075,
      transparent: true,
      // Keep full facial hair dense enough to read on the broadcast camera,
      // while letting the sculpted cheek and jaw planes remain visible in a
      // close portrait instead of forming an opaque mask.
      opacity: style === "stubble" ? 0.62 : 0.8,
      depthWrite: false,
      alphaToCoverage: true,
      normalMap: hairStrandNormal(),
      normalScale: new THREE.Vector2(0.055, 0.085),
      envMapIntensity: 0.14,
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
export function irisMaterial(color: string, hi = false): THREE.Material {
  return sharedDetailMaterial(
    `iris:${color}:${hi}`,
    () =>
      new (hi ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({
        // Tint the procedural atlas down so green and blue eyes preserve
        // their identity without glowing against the sclera in the portrait
        // light rig.
        color: irisColor(color) ? "#8f8f8f" : new THREE.Color(color).multiplyScalar(0.56),
        map: irisColor(color),
        roughness: hi ? 0.42 : 0.48,
        ...(hi ? { clearcoat: 0.3, clearcoatRoughness: 0.16, ior: 1.376 } : {}),
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

type TattooPoint = readonly [number, number];
interface TattooStroke {
  points: TattooPoint[];
  width: number;
}

function tattooStrokes(seed: number): TattooStroke[] {
  let state = (seed % 100003 || 1) >>> 0;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const phase = random() * Math.PI * 2;
  const spine: TattooPoint[] = Array.from({ length: 11 }, (_, index) => {
    const t = index / 10;
    return [32 + Math.sin(t * Math.PI * 2 + phase) * 4 + (random() - 0.5) * 2, 5 + t * 54];
  });
  const strokes: TattooStroke[] = [{ points: spine, width: 1.55 }];
  for (let index = 1; index < 10; index += 2) {
    const [x, y] = spine[index]!;
    for (const side of [-1, 1]) {
      const reach = 7 + random() * 5;
      const bend = (random() - 0.5) * 4;
      strokes.push({
        points: [
          [x, y],
          [x + side * reach * 0.42, y + bend],
          [x + side * reach, y + 3.5 + bend],
        ],
        width: 0.9 + random() * 0.35,
      });
      strokes.push({
        points: [
          [x + side * reach * 0.38, y + bend],
          [x + side * (reach * 0.68), y - 3.5 + bend],
          [x + side * (reach * 0.88), y - 4.8 + bend],
        ],
        width: 0.72,
      });
    }
  }
  return strokes;
}

function pointSegmentDistance(x: number, y: number, a: TattooPoint, b: TattooPoint) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = THREE.MathUtils.clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

/** Seeded feather/branch ink mask. Broken, tapered strokes stay on one patch
 * of skin instead of mapping horizontal bars into a full-circumference cuff. */
export function tattooAlphaMask(seed: number, size = 64): Uint8Array {
  const dimension = Math.max(16, Math.floor(size));
  const mask = new Uint8Array(dimension * dimension);
  const strokes = tattooStrokes(seed);
  const smooth = (value: number) => {
    const t = THREE.MathUtils.clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < dimension; y++)
    for (let x = 0; x < dimension; x++) {
      const px = ((x + 0.5) / dimension) * 64;
      const py = ((y + 0.5) / dimension) * 64;
      let coverage = 0;
      for (const stroke of strokes) {
        let distance = Infinity;
        for (let index = 0; index < stroke.points.length - 1; index++)
          distance = Math.min(
            distance,
            pointSegmentDistance(px, py, stroke.points[index]!, stroke.points[index + 1]!),
          );
        coverage = Math.max(coverage, 1 - smooth((distance - stroke.width * 0.35) / stroke.width));
      }
      const edgeX = smooth(px / 7) * (1 - smooth((px - 57) / 7));
      const edgeY = smooth(py / 5) * (1 - smooth((py - 59) / 5));
      mask[y * dimension + x] = Math.round(220 * coverage * edgeX * edgeY);
    }
  return mask;
}

/** Subtle, seeded ink conforms to a partial forearm decal (one small texture
 * per tattooed athlete), with no extra geometry or material slot. */
export function tattooMaterial(seed: number): THREE.Material {
  return sharedDetailMaterial(`tattoo:${seed % 100003}`, () => {
    const size = 64;
    const alpha = tattooAlphaMask(seed, size);
    const pixels = new Uint8Array(size * size * 4);
    for (let i = 0; i < alpha.length; i++) {
      pixels[i * 4] = 28;
      pixels[i * 4 + 1] = 26;
      pixels[i * 4 + 2] = 29;
      pixels[i * 4 + 3] = alpha[i]!;
    }
    const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
    texture.name = `athlete-tattoo-${seed % 100003}`;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    const material = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map: texture,
      transparent: true,
      depthWrite: false,
      roughness: 0.78,
    });
    material.userData["ownedTexture"] = texture;
    return material;
  });
}
