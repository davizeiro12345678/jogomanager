// ============================================================================
//  player-materials.ts
//
//  Cache de materiais dos jogadores.
//
//  Cada PlayerRig criava o seu próprio conjunto de materiais (pele, camisa,
//  calção, meião, cabelo, chuteira…). Com 22 atletas em campo isso virava
//  ~200 materiais distintos e, pior, dezenas de programas de shader para o
//  MeshPhysicalMaterial — o que custa compilação no primeiro minuto e memória
//  de GPU o jogo inteiro. Como a aparência só depende de (uniforme, tom de
//  pele, cabelo, chuteira, qualidade), os materiais podem ser compartilhados
//  entre jogadores com a mesma combinação.
//
//  O cache é limitado: uma partida usa poucas dezenas de combinações e as
//  entradas mais antigas são descartadas com dispose() quando o limite estoura.
// ============================================================================

import * as THREE from "three";

import {
  bootGrainNormal,
  jerseyWeaveNormal,
  jerseyRoughness,
  skinPoreNormal,
  skinRoughness,
  sockRibNormal,
} from "@/game/textures/fabric";
import { ktx2, onKtx2Ready, type DetailKtx2Name } from "@/game/textures/ktx2";
import type { Kit } from "@/game/kits";
import {
  applySurface,
  surfaceFromSteps,
  surfaceKey,
  type SurfaceSteps,
} from "@/game/graphics/player-surface";

/** Degrau neutro: sem suor, sem grama, sem chuva. */
const NEUTRAL_STEPS: SurfaceSteps = { sweat: 0, dirt: 0, wet: 0 };
import { SKIN_TONES } from "@/game/kits";
import { shade, skinShadow } from "@/game/player-model";

export type MaterialQuality = "alta" | "media" | "baixa";

export interface PlayerLookLike {
  seed?: number;
  skin: string;
  sweat: number;
  hairColor: string;
  bootColor: string;
  bootAccent: string;
  gloveColor: string;
}

export interface PlayerMaterials {
  skin: THREE.Material;
  skinDark: THREE.Material;
  jersey: THREE.Material;
  shorts: THREE.Material;
  socks: THREE.Material;
  trim: THREE.Material;
  hair: THREE.Material;
  boot: THREE.Material;
  bootAccent: THREE.Material;
  sole: THREE.Material;
  glove: THREE.Material;
  /** caneleira em fibra: usada por baixo do meião */
  shin: THREE.Material;
}

const NORMAL_SCALE = new THREE.Vector2(0.55, 0.55);
const MAX_ENTRIES = 96;
const cache = new Map<string, PlayerMaterials>();

/** arredonda o suor para poucos degraus: evita um material por jogador */
const sweatStep = (s: number) => Math.round(Math.max(0, Math.min(1, s)) * 4) / 4;

export function detailTextureNames(
  look: PlayerLookLike,
  kit: Kit,
): [
  DetailKtx2Name,
  DetailKtx2Name,
  DetailKtx2Name,
  DetailKtx2Name,
  DetailKtx2Name,
  DetailKtx2Name,
] {
  const patterns = ["solid", "stripes", "pin", "hoops", "sash", "halves", "checks"];
  const pattern = patterns.includes(kit.pattern) ? kit.pattern : "solid";
  const skinTone = SKIN_TONES.indexOf(look.skin);
  const skinVariant =
    skinTone < 0
      ? "medium"
      : skinTone === 0 || skinTone === 4
        ? "dark"
        : skinTone === 2 || skinTone === 3
          ? "light"
          : "medium";
  const seed = look.seed ?? 0;
  const shortsVariant = ["plain", "mesh", "stitched"][seed % 3] ?? "plain";
  const socksVariant = ["rib", "fine", "heavy"][Math.floor(seed / 3) % 3] ?? "rib";
  const bootVariant = ["leather", "synthetic", "knit"][Math.floor(seed / 9) % 3] ?? "leather";
  return [
    `jersey_${pattern}_normal`,
    `jersey_${pattern}_rough`,
    `shorts_${shortsVariant}_normal`,
    `socks_${socksVariant}_normal`,
    `boot_${bootVariant}_normal`,
    `skin_${skinVariant}_normal`,
  ] as [
    DetailKtx2Name,
    DetailKtx2Name,
    DetailKtx2Name,
    DetailKtx2Name,
    DetailKtx2Name,
    DetailKtx2Name,
  ];
}

function dispose(set: PlayerMaterials) {
  Object.values(set).forEach((m) => m.dispose());
}

// Quando as texturas KTX2 terminam de baixar, os materiais já criados ficam
// desatualizados: o cache é esvaziado para que os próximos usem o alta definição.
let ktx2Ready = false;
onKtx2Ready(() => {
  ktx2Ready = true;
  // Existing rigs may still reference these materials until their next render.
  // Disposing them mid-frame makes players flicker or lose their uniforms.
  cache.clear();
});

/**
 * Devolve (e memoriza) o conjunto de materiais de um jogador.
 * `tex` é a textura do uniforme, que já vem de um cache próprio em kits.ts.
 */
export function playerMaterials(
  look: PlayerLookLike,
  kit: Kit,
  tex: THREE.Texture | null,
  quality: MaterialQuality,
  surface?: SurfaceSteps,
): PlayerMaterials {
  const sweat = sweatStep(look.sweat);
  const [
    jerseyNormalName,
    jerseyRoughName,
    shortsNormalName,
    socksNormalName,
    bootNormalName,
    skinNormalName,
  ] = detailTextureNames(look, kit);
  const key = [
    quality,
    ktx2Ready ? "hd" : "sd",
    look.skin,
    sweat,
    look.hairColor,
    look.bootColor,
    look.bootAccent,
    look.gloveColor,
    kit.base,
    kit.shorts,
    kit.socks,
    kit.detail,
    tex?.uuid ?? "-",
    // suor/grama/chuva entram na chave: é o que faz a camisa sujar durante a
    // partida sem que nenhum atleta ganhe material próprio (3 × 3 × 2 no máximo)
    surfaceKey(surface ?? NEUTRAL_STEPS),
    ...(quality === "alta"
      ? [
          jerseyNormalName,
          jerseyRoughName,
          shortsNormalName,
          socksNormalName,
          bootNormalName,
          skinNormalName,
        ]
      : []),
  ].join("|");

  const hit = cache.get(key);
  if (hit) {
    // LRU simples: reinsere para marcar como recente
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }

  const hi = quality === "alta";
  // Preferimos sempre o mapa KTX2 (1024², comprimido na GPU); o canvas
  // procedural continua como rede de segurança até o download terminar.
  const weave = hi ? (ktx2(jerseyNormalName) ?? ktx2("fiberNormal") ?? jerseyWeaveNormal()) : null;
  const rib = hi ? (ktx2(socksNormalName) ?? ktx2("sockNormal") ?? sockRibNormal()) : null;
  const pores = hi ? (ktx2(skinNormalName) ?? ktx2("skinNormal") ?? skinPoreNormal()) : null;
  const grain = hi ? (ktx2(bootNormalName) ?? ktx2("bootNormal") ?? bootGrainNormal()) : null;
  const jerseyRough = hi
    ? (ktx2(jerseyRoughName) ?? ktx2("fiberRough") ?? jerseyRoughness())
    : null;
  const skinRough = ktx2("sweatMask") ?? (hi ? skinRoughness() : null);
  const hairNormal = ktx2("hairNormal");
  const hairRough = ktx2("hairRough");
  const bootRough = ktx2("bootRough");
  const shinNormal = ktx2("shinNormal");
  const shinRough = ktx2("shinRough");
  const sweatNormal = ktx2("sweatNormal");

  const set: PlayerMaterials = {
    skin: hi
      ? new THREE.MeshPhysicalMaterial({
          color: look.skin,
          roughness: 0.6 - sweat * 0.16,
          normalMap: pores,
          roughnessMap: skinRough,
          normalScale: NORMAL_SCALE,
          clearcoat: 0.28 + sweat * 0.35,
          clearcoatRoughness: 0.5 - sweat * 0.28,
          // gotas de suor: só o verniz recebe o relevo, a pele continua macia
          clearcoatNormalMap: sweatNormal,
          clearcoatNormalScale: new THREE.Vector2(0.25 + sweat * 0.75, 0.25 + sweat * 0.75),
          envMapIntensity: 0.95,

          sheen: 0.35,
          sheenRoughness: 0.6,
          // tom avermelhado do sangue sob a pele: imita o espalhamento sub-superficial
          // sem o custo de transmissão — a borda do rosto/braço fica "viva".
          sheenColor: new THREE.Color(look.skin).lerp(new THREE.Color("#ff8a6a"), 0.45),
          specularIntensity: 0.45,
          specularColor: new THREE.Color("#fff1e4"),
        })
      : new THREE.MeshStandardMaterial({
          color: look.skin,
          roughness: 0.62,
          envMapIntensity: 0.85,
        }),
    skinDark: new THREE.MeshStandardMaterial({
      color: skinShadow(look.skin),
      roughness: 0.72,
    }),
    jersey: hi
      ? new THREE.MeshPhysicalMaterial({
          color: tex ? 0xffffff : kit.base,
          map: tex,
          normalMap: weave,
          roughnessMap: jerseyRough,
          normalScale: NORMAL_SCALE,
          roughness: 0.76 - sweat * 0.14,
          envMapIntensity: 0.85,
          clearcoat: sweat * 0.3,
          clearcoatRoughness: 0.6,
          sheen: 0.5,
          sheenRoughness: 0.7,
          sheenColor: new THREE.Color(shade(kit.base, 0.4)),
        })
      : new THREE.MeshStandardMaterial({
          color: tex ? 0xffffff : kit.base,
          map: tex,
          roughness: 0.85,
        }),
    shorts: hi
      ? new THREE.MeshPhysicalMaterial({
          color: kit.shorts,
          roughness: 0.84,
          normalMap: ktx2(shortsNormalName) ?? weave,
          roughnessMap: jerseyRough,
          normalScale: NORMAL_SCALE,
          sheen: 0.4,
          sheenColor: new THREE.Color(shade(kit.shorts, 0.35)),
        })
      : new THREE.MeshStandardMaterial({ color: kit.shorts, roughness: 0.86 }),
    socks: hi
      ? new THREE.MeshPhysicalMaterial({
          color: kit.socks,
          roughness: 0.92,
          normalMap: rib,
          normalScale: NORMAL_SCALE,
          sheen: 0.6,
          sheenRoughness: 0.8,
          sheenColor: new THREE.Color(shade(kit.socks, 0.45)),
        })
      : new THREE.MeshStandardMaterial({ color: kit.socks, roughness: 0.9 }),
    trim: hi
      ? new THREE.MeshPhysicalMaterial({
          color: kit.detail,
          roughness: 0.58,
          sheen: 0.32,
          sheenRoughness: 0.72,
          sheenColor: new THREE.Color(shade(kit.detail, 0.35)),
        })
      : new THREE.MeshStandardMaterial({ color: kit.detail, roughness: 0.8 }),
    hair: hi
      ? new THREE.MeshPhysicalMaterial({
          color: look.hairColor,
          roughness: 0.62,
          // fios individuais: o mapa dá direção ao brilho em vez de um capacete liso
          normalMap: hairNormal,
          roughnessMap: hairRough,
          normalScale: new THREE.Vector2(0.8, 0.8),
          metalness: 0.04,
          clearcoat: 0.35,
          clearcoatRoughness: 0.42,
          sheen: 0.85,
          sheenRoughness: 0.55,
          sheenColor: new THREE.Color(shade(look.hairColor, 0.55)),
          anisotropy: 0.7,
          anisotropyRotation: Math.PI / 2,
          envMapIntensity: 0.75,
        })
      : new THREE.MeshStandardMaterial({
          color: look.hairColor,
          roughness: 0.85,
          normalMap: hairNormal,
          metalness: 0.02,
        }),
    boot: hi
      ? new THREE.MeshPhysicalMaterial({
          color: look.bootColor,
          roughness: 0.22,
          normalMap: grain,
          roughnessMap: bootRough,
          normalScale: NORMAL_SCALE,
          metalness: 0.1,
          clearcoat: 0.85,
          clearcoatRoughness: 0.18,
          clearcoatNormalMap: grain,
          clearcoatNormalScale: new THREE.Vector2(0.4, 0.4),
        })
      : new THREE.MeshStandardMaterial({
          color: look.bootColor,
          roughness: 0.34,
          normalMap: grain,
          metalness: 0.22,
        }),
    bootAccent: hi
      ? new THREE.MeshPhysicalMaterial({
          color: look.bootAccent,
          roughness: 0.2,
          clearcoat: 0.7,
          clearcoatRoughness: 0.2,
        })
      : new THREE.MeshStandardMaterial({ color: look.bootAccent, roughness: 0.4 }),
    sole: new THREE.MeshStandardMaterial({
      color: shade(look.bootColor, -0.55),
      roughness: 0.6,
      normalMap: grain,
    }),
    // caneleira: casca rígida com trama de fibra, sempre mais lisa que o meião
    shin: hi
      ? new THREE.MeshPhysicalMaterial({
          color: shade(kit.socks, 0.18),
          roughness: 0.35,
          normalMap: shinNormal,
          roughnessMap: shinRough,
          normalScale: new THREE.Vector2(0.7, 0.7),
          clearcoat: 0.6,
          clearcoatRoughness: 0.25,
          metalness: 0.06,
        })
      : new THREE.MeshStandardMaterial({
          color: shade(kit.socks, 0.18),
          roughness: 0.5,
          normalMap: shinNormal,
        }),
    glove: hi
      ? new THREE.MeshPhysicalMaterial({
          color: look.gloveColor,
          roughness: 0.46,
          normalMap: weave,
          normalScale: new THREE.Vector2(0.35, 0.35),
          clearcoat: 0.24 + sweat * 0.3,
          clearcoatRoughness: 0.45,
          sheen: 0.2,
          sheenRoughness: 0.75,
        })
      : new THREE.MeshStandardMaterial({ color: look.gloveColor, roughness: 0.7 }),
  };

  // Superfície da partida: suor, grama e chuva em cima dos materiais já
  // criados. Só escalares — nenhuma recompilação de shader, nenhum upload.
  if (surface && quality !== "baixa") {
    const state = surfaceFromSteps(surface);
    applySurface(set.skin, { ...state, sweat: Math.min(1, state.sweat * 1.25) });
    applySurface(set.jersey, state);
    applySurface(set.shorts, state);
    applySurface(set.socks, { ...state, dirt: state.dirt * 1.4 });
    applySurface(set.trim, state);
    applySurface(set.shin, state);
  }

  cache.set(key, set);
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) {
      const victim = cache.get(oldest);
      cache.delete(oldest);
      if (victim) dispose(victim);
    }
  }
  return set;
}
