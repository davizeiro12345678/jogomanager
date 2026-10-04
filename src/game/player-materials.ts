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
  gloveLatexNormal,
  hairStrandNormal,
  hairFiberColor,
  hairlineMask,
  jerseyWeaveNormal,
  jerseyRoughness,
  skinPoreNormal,
  skinRoughness,
  sockRibNormal,
  shortsPanelNormal,
  garmentRoughness,
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
import { skinAlbedo } from "./player-morphology";

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
  /** Sleeves and shoulder seams use fabric without the torso's number atlas. */
  jerseyPlain: THREE.Material;
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
const textureRefreshers = new Map<PlayerMaterials, () => void>();

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
  textureRefreshers.delete(set);
  Object.values(set).forEach((m) => m.dispose());
}

const users = new WeakMap<PlayerMaterials, number>();
const retired = new WeakSet<PlayerMaterials>();

function retire(set: PlayerMaterials) {
  if ((users.get(set) ?? 0) > 0) retired.add(set);
  else dispose(set);
}

/** Keep shared materials alive while any mounted rig still draws them.
 * Eviction releases GPU resources only after the last owner leaves, so a
 * cache refresh cannot strip a live uniform. */
export function retainPlayerMaterials(set: PlayerMaterials): () => void {
  users.set(set, (users.get(set) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const count = Math.max(0, (users.get(set) ?? 1) - 1);
    users.set(set, count);
    if (count === 0 && retired.has(set)) {
      retired.delete(set);
      dispose(set);
    }
  };
}

// Keep material identities stable as compressed maps arrive. Replacing the
// whole set also rebuilt the rig's skin and skeleton on every texture event,
// including grass and stadium maps that the athlete never uses.
onKtx2Ready(() => {
  for (const refresh of textureRefreshers.values()) refresh();
});

type TextureSlot = "normalMap" | "roughnessMap" | "clearcoatNormalMap";

function constantMap(bytes: [number, number, number, number], name: string) {
  const texture = new THREE.DataTexture(new Uint8Array(bytes), 1, 1);
  texture.name = name;
  texture.needsUpdate = true;
  return texture;
}
// Keep high-quality shader features constant before compressed assets arrive.
// Neutral maps preserve the original roughness and flat surface, and share
// eight bytes of pixel data instead of creating more intermediate programs.
const FLAT_NORMAL = constantMap([128, 128, 255, 255], "player-neutral-normal");
const WHITE_ROUGHNESS = constantMap([255, 255, 255, 255], "player-neutral-roughness");

function updateTexture(material: THREE.Material, slot: TextureSlot, texture: THREE.Texture | null) {
  const target = material as THREE.MeshPhysicalMaterial;
  const previous = target[slot];
  if (previous === texture) return;
  target[slot] = texture;
  // Switching an existing map needs only a uniform update. Shader defines
  // change when a map appears/disappears or uses a different UV channel.
  if (Boolean(previous) !== Boolean(texture) || previous?.channel !== texture?.channel) {
    target.needsUpdate = true;
  }
}

function playerTextureMaps(hi: boolean, names: ReturnType<typeof detailTextureNames>) {
  const [jerseyNormal, jerseyRough, shortsNormal, socksNormal, bootNormal, skinNormal] = names;
  const weave = hi
    ? (ktx2(jerseyNormal) ?? ktx2("fiberNormal") ?? jerseyWeaveNormal() ?? FLAT_NORMAL)
    : null;
  const grain = hi
    ? (ktx2(bootNormal) ?? ktx2("bootNormal") ?? bootGrainNormal() ?? FLAT_NORMAL)
    : null;
  return {
    weave,
    rib: hi ? (ktx2(socksNormal) ?? ktx2("sockNormal") ?? sockRibNormal() ?? FLAT_NORMAL) : null,
    pores: hi ? (ktx2(skinNormal) ?? ktx2("skinNormal") ?? skinPoreNormal() ?? FLAT_NORMAL) : null,
    grain,
    shorts: hi ? (ktx2(shortsNormal) ?? shortsPanelNormal()) : null,
    shortsRough: hi ? garmentRoughness("shorts") : null,
    socksRough: hi ? garmentRoughness("socks") : null,
    jerseyRough: hi
      ? (ktx2(jerseyRough) ?? ktx2("fiberRough") ?? jerseyRoughness() ?? WHITE_ROUGHNESS)
      : null,
    skinRough: hi ? (ktx2("sweatMask") ?? skinRoughness() ?? WHITE_ROUGHNESS) : null,
    hairNormal: hi ? (ktx2("hairNormal") ?? hairStrandNormal() ?? FLAT_NORMAL) : null,
    hairRough: hi ? (ktx2("hairRough") ?? WHITE_ROUGHNESS) : null,
    bootRough: hi ? (ktx2("bootRough") ?? WHITE_ROUGHNESS) : null,
    shinNormal: hi ? (ktx2("shinNormal") ?? FLAT_NORMAL) : null,
    shinRough: hi ? (ktx2("shinRough") ?? WHITE_ROUGHNESS) : null,
    sweatNormal: hi ? (ktx2("sweatNormal") ?? FLAT_NORMAL) : null,
  };
}

function refreshPlayerTextureMaps(
  set: PlayerMaterials,
  hi: boolean,
  maps: ReturnType<typeof playerTextureMaps>,
) {
  updateTexture(set.jerseyPlain, "normalMap", maps.weave);
  updateTexture(set.jerseyPlain, "roughnessMap", maps.jerseyRough);
  updateTexture(set.jerseyPlain, "clearcoatNormalMap", maps.sweatNormal);
  updateTexture(set.hair, "normalMap", maps.hairNormal);
  updateTexture(set.boot, "normalMap", maps.grain);
  updateTexture(set.sole, "normalMap", maps.grain);
  updateTexture(set.shin, "normalMap", maps.shinNormal);
  if (!hi) return;
  updateTexture(set.skin, "normalMap", maps.pores);
  updateTexture(set.skin, "roughnessMap", maps.skinRough);
  updateTexture(set.skin, "clearcoatNormalMap", maps.sweatNormal);
  updateTexture(set.jersey, "normalMap", maps.weave);
  updateTexture(set.jersey, "roughnessMap", maps.jerseyRough);
  updateTexture(set.jersey, "clearcoatNormalMap", maps.sweatNormal);
  updateTexture(set.shorts, "normalMap", maps.shorts);
  updateTexture(set.shorts, "roughnessMap", maps.shortsRough);
  updateTexture(set.socks, "normalMap", maps.rib);
  updateTexture(set.socks, "roughnessMap", maps.socksRough);
  updateTexture(set.hair, "roughnessMap", maps.hairRough);
  updateTexture(set.boot, "roughnessMap", maps.bootRough);
  updateTexture(set.boot, "clearcoatNormalMap", maps.grain);
  updateTexture(set.shin, "roughnessMap", maps.shinRough);
  updateTexture(set.glove, "normalMap", gloveLatexNormal());
}

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
  const detailNames = detailTextureNames(look, kit);
  const [
    jerseyNormalName,
    jerseyRoughName,
    shortsNormalName,
    socksNormalName,
    bootNormalName,
    skinNormalName,
  ] = detailNames;
  const key = [
    quality,
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
  const maps = playerTextureMaps(hi, detailNames);
  const {
    weave,
    rib,
    pores,
    grain,
    jerseyRough,
    skinRough,
    hairNormal,
    hairRough,
    bootRough,
    shinNormal,
    shinRough,
    sweatNormal,
  } = maps;

  const set: PlayerMaterials = {
    skin: hi
      ? new THREE.MeshPhysicalMaterial({
          color: skinAlbedo(look.skin),
          vertexColors: true,
          roughness: 0.82 - sweat * 0.12,
          normalMap: pores,
          roughnessMap: skinRough,
          normalScale: new THREE.Vector2(0.16, 0.16),
          clearcoat: 0.045 + sweat * 0.1,
          clearcoatRoughness: 0.58 - sweat * 0.17,
          // gotas de suor: só o verniz recebe o relevo, a pele continua macia
          clearcoatNormalMap: sweatNormal,
          clearcoatNormalScale: new THREE.Vector2(0.25 + sweat * 0.75, 0.25 + sweat * 0.75),
          envMapIntensity: 0.7,

          sheen: 0.09,
          sheenRoughness: 0.78,
          // tom avermelhado do sangue sob a pele: imita o espalhamento sub-superficial
          // sem o custo de transmissão — a borda do rosto/braço fica "viva".
          sheenColor: new THREE.Color(skinAlbedo(look.skin)).lerp(new THREE.Color("#e8c6c4"), 0.4),
          specularIntensity: 0.32 + sweat * 0.16,
          specularColor: new THREE.Color("#fff1e4"),
        })
      : new THREE.MeshStandardMaterial({
          color: skinAlbedo(look.skin),
          vertexColors: true,
          roughness: 0.85,
          envMapIntensity: 0.85,
        }),
    skinDark: new THREE.MeshStandardMaterial({
      color: skinShadow(look.skin),
      roughness: 0.72,
    }),
    jersey: hi
      ? new THREE.MeshPhysicalMaterial({
          color: tex ? 0xffffff : kit.base,
          vertexColors: true,
          map: tex,
          normalMap: weave,
          roughnessMap: jerseyRough,
          normalScale: new THREE.Vector2(0.34, 0.34),
          roughness: 0.94 - sweat * 0.14,
          envMapIntensity: 0.85,
          clearcoat: sweat * 0.16,
          clearcoatRoughness: 0.6,
          clearcoatNormalMap: sweatNormal,
          clearcoatNormalScale: new THREE.Vector2(0.2 + sweat * 0.55, 0.2 + sweat * 0.55),
          sheen: 0.5,
          sheenRoughness: 0.7,
          sheenColor: new THREE.Color(shade(kit.base, 0.4)),
        })
      : new THREE.MeshStandardMaterial({
          color: tex ? 0xffffff : kit.base,
          vertexColors: true,
          map: tex,
          roughness: 0.85,
        }),
    jerseyPlain: new (hi ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({
      color: kit.pattern === "sleeves" ? kit.detail : kit.base,
      vertexColors: true,
      roughness: 0.98 - sweat * 0.1,
      normalMap: weave,
      roughnessMap: jerseyRough,
      normalScale: new THREE.Vector2(0.34, 0.34),
      envMapIntensity: 0.7,
      ...(hi
        ? {
            clearcoat: sweat * 0.16,
            clearcoatRoughness: 0.6,
            clearcoatNormalMap: sweatNormal,
            clearcoatNormalScale: new THREE.Vector2(0.2 + sweat * 0.55, 0.2 + sweat * 0.55),
            sheen: 0.5,
            sheenRoughness: 0.7,
            sheenColor: new THREE.Color(
              shade(kit.pattern === "sleeves" ? kit.detail : kit.base, 0.4),
            ),
          }
        : {}),
    }),
    shorts: hi
      ? new THREE.MeshPhysicalMaterial({
          color: kit.shorts,
          vertexColors: true,
          roughness: 0.91,
          normalMap: maps.shorts,
          roughnessMap: maps.shortsRough,
          normalScale: NORMAL_SCALE,
          sheen: 0.48,
          sheenRoughness: 0.78,
          sheenColor: new THREE.Color(shade(kit.shorts, 0.35)),
        })
      : new THREE.MeshStandardMaterial({ color: kit.shorts, roughness: 0.86, vertexColors: true }),
    socks: hi
      ? new THREE.MeshPhysicalMaterial({
          color: kit.socks,
          roughness: 0.92,
          normalMap: rib,
          roughnessMap: maps.socksRough,
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
          color: "white",
          map: hairFiberColor(look.hairColor),
          alphaMap: hairlineMask(),
          // Keep the wisps present at the hairline. A high alpha cutoff made
          // the shared shell read as a hard, glossy helmet in portrait views.
          alphaTest: 0.19,
          alphaToCoverage: true,
          roughness: 0.9,
          // Fibres break the highlight into small strands instead of one broad
          // plastic reflection, with no extra material or geometry.
          normalMap: hairNormal,
          roughnessMap: hairRough,
          normalScale: new THREE.Vector2(0.11, 0.18),
          metalness: 0,
          clearcoat: 0,
          clearcoatRoughness: 0.85,
          sheen: 0.08,
          sheenRoughness: 0.82,
          sheenColor: new THREE.Color(shade(look.hairColor, 0.55)),
          anisotropy: 0.18,
          anisotropyRotation: Math.PI / 2,
          specularIntensity: 0.14,
          envMapIntensity: 0.18,
        })
      : new THREE.MeshStandardMaterial({
          color: look.hairColor,
          roughness: 0.9,
          normalMap: hairNormal,
          normalScale: new THREE.Vector2(0.09, 0.15),
          metalness: 0,
          envMapIntensity: 0.14,
        }),
    boot: hi
      ? new THREE.MeshPhysicalMaterial({
          color: look.bootColor,
          roughness: 0.46,
          normalMap: grain,
          roughnessMap: bootRough,
          normalScale: NORMAL_SCALE,
          metalness: 0.02,
          clearcoat: 0.25,
          clearcoatRoughness: 0.35,
          clearcoatNormalMap: grain,
          clearcoatNormalScale: new THREE.Vector2(0.4, 0.4),
        })
      : new THREE.MeshStandardMaterial({
          color: look.bootColor,
          roughness: 0.34,
          normalMap: grain,
          metalness: 0.035,
        }),
    bootAccent: hi
      ? new THREE.MeshPhysicalMaterial({
          color: look.bootAccent,
          roughness: 0.32,
          clearcoat: 0.42,
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
          vertexColors: true,
          roughness: 0.69,
          normalMap: gloveLatexNormal(),
          normalScale: new THREE.Vector2(0.22, 0.22),
          clearcoat: 0.1 + sweat * 0.12,
          clearcoatRoughness: 0.52,
          sheen: 0.08,
          sheenRoughness: 0.8,
        })
      : new THREE.MeshStandardMaterial({
          color: look.gloveColor,
          roughness: 0.7,
          vertexColors: true,
        }),
  };

  // Superfície da partida: suor, grama e chuva em cima dos materiais já
  // criados. Só escalares — nenhuma recompilação de shader, nenhum upload.
  if (surface && quality !== "baixa") {
    const state = surfaceFromSteps(surface);
    applySurface(set.skin, { ...state, sweat: Math.min(1, state.sweat * 1.25) }, "skin");
    applySurface(set.jersey, state);
    applySurface(set.jerseyPlain, state);
    applySurface(set.shorts, state);
    applySurface(set.socks, { ...state, dirt: state.dirt * 1.4 });
    applySurface(set.trim, state);
    applySurface(set.shin, state);
  }

  textureRefreshers.set(set, () =>
    refreshPlayerTextureMaps(set, hi, playerTextureMaps(hi, detailNames)),
  );
  cache.set(key, set);
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) {
      const victim = cache.get(oldest);
      cache.delete(oldest);
      if (victim) retire(victim);
    }
  }
  return set;
}
