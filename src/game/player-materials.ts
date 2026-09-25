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
import { ktx2, onKtx2Ready } from "@/game/textures/ktx2";
import type { Kit } from "@/game/kits";
import { shade, skinShadow } from "@/game/player-model";


export type MaterialQuality = "alta" | "media" | "baixa";

export interface PlayerLookLike {
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

function dispose(set: PlayerMaterials) {
  Object.values(set).forEach((m) => m.dispose());
}

// Quando as texturas KTX2 terminam de baixar, os materiais já criados ficam
// desatualizados: o cache é esvaziado para que os próximos usem o alta definição.
let ktx2Ready = false;
onKtx2Ready(() => {
  ktx2Ready = true;
  for (const set of cache.values()) dispose(set);
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
): PlayerMaterials {
  const sweat = sweatStep(look.sweat);
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
  const weave = ktx2("fiberNormal") ?? (hi ? jerseyWeaveNormal() : null);
  const rib = ktx2("sockNormal") ?? (hi ? sockRibNormal() : null);
  const pores = ktx2("skinNormal") ?? (hi ? skinPoreNormal() : null);
  const grain = ktx2("bootNormal") ?? (hi ? bootGrainNormal() : null);
  const jerseyRough = ktx2("fiberRough") ?? (hi ? jerseyRoughness() : null);
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
          clearcoat: 0.28 + sweat * 0.25,
          clearcoatRoughness: 0.5,
          envMapIntensity: 0.95,
          sheen: 0.35,
          sheenRoughness: 0.6,
          // tom avermelhado do sangue sob a pele: imita o espalhamento sub-superficial
          // sem o custo de transmissão — a borda do rosto/braço fica "viva".
          sheenColor: new THREE.Color(look.skin).lerp(new THREE.Color("#ff8a6a"), 0.45),
          specularIntensity: 0.45,
          specularColor: new THREE.Color("#fff1e4"),
        })
      : new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.62, envMapIntensity: 0.85 }),
    skinDark: new THREE.MeshStandardMaterial({
      color: skinShadow(look.skin),
      roughness: 0.72,
    }),
    jersey: hi
      ? new THREE.MeshPhysicalMaterial({
          color: kit.base,
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
      : new THREE.MeshStandardMaterial({ color: kit.base, map: tex, roughness: 0.85 }),
    shorts: hi
      ? new THREE.MeshPhysicalMaterial({
          color: kit.shorts,
          roughness: 0.84,
          normalMap: weave,
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
          metalness: 0.04,
          clearcoat: 0.35,
          clearcoatRoughness: 0.42,
          sheen: 0.85,
          sheenRoughness: 0.55,
          sheenColor: new THREE.Color(shade(look.hairColor, 0.55)),
          anisotropy: 0.55,
          anisotropyRotation: Math.PI / 2,
          envMapIntensity: 0.75,
        })
      : new THREE.MeshStandardMaterial({
          color: look.hairColor,
          roughness: 0.85,
          metalness: 0.02,
        }),
    boot: hi
      ? new THREE.MeshPhysicalMaterial({
          color: look.bootColor,
          roughness: 0.22,
          normalMap: grain,
          normalScale: NORMAL_SCALE,
          metalness: 0.1,
          clearcoat: 0.85,
          clearcoatRoughness: 0.18,
        })
      : new THREE.MeshStandardMaterial({
          color: look.bootColor,
          roughness: 0.34,
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
    }),
    glove: hi
      ? new THREE.MeshPhysicalMaterial({
          color: look.gloveColor,
          roughness: 0.46,
          clearcoat: 0.24,
          clearcoatRoughness: 0.45,
          sheen: 0.2,
          sheenRoughness: 0.75,
        })
      : new THREE.MeshStandardMaterial({ color: look.gloveColor, roughness: 0.7 }),
  };

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
