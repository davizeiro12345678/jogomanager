// ============================================================================
//  ktx2.ts
//  Texturas de alta definição pré-compiladas em KTX2 (Basis/ETC1S).
//
//  Os mapas de microfibra, suor, pele, cabelo, chuteira, caneleira e meião são
//  gerados fora do jogo em 1024², comprimidos para o formato nativo da GPU e
//  servidos pela CDN. Vantagem sobre as texturas desenhadas em canvas:
//   • muito mais detalhe (1024² com mipmaps) sem custo de CPU no carregamento;
//   • ocupam pouca memória de vídeo (blocos comprimidos, não RGBA);
//   • um único download em cache para todos os 22 atletas.
//
//  Enquanto os arquivos não chegam, os materiais continuam usando as texturas
//  procedurais antigas: nada trava e nada fica sem relevo.
// ============================================================================

import * as THREE from "three";
import { useSyncExternalStore } from "react";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { deviceTextureDecodeWorkers } from "@/game/device-workload";
import {
  canRequestTexture,
  textureFailureAfter,
  textureHttpStatus,
  type TextureFailure,
} from "./texture-load-policy";

import bootNormalAsset from "@/assets/textures/boot_normal.ktx2.asset.json";
import bootRoughAsset from "@/assets/textures/boot_rough.ktx2.asset.json";
import fiberNormalAsset from "@/assets/textures/fiber_normal.ktx2.asset.json";
import fiberRoughAsset from "@/assets/textures/fiber_rough.ktx2.asset.json";
import hairNormalAsset from "@/assets/textures/hair_normal.ktx2.asset.json";
import hairRoughAsset from "@/assets/textures/hair_rough.ktx2.asset.json";
import shinNormalAsset from "@/assets/textures/shin_normal.ktx2.asset.json";
import shinRoughAsset from "@/assets/textures/shin_rough.ktx2.asset.json";
import skinNormalAsset from "@/assets/textures/skin_normal.ktx2.asset.json";
import sockNormalAsset from "@/assets/textures/sock_normal.ktx2.asset.json";
import sweatMaskAsset from "@/assets/textures/sweat_mask.ktx2.asset.json";
import sweatNormalAsset from "@/assets/textures/sweat_normal.ktx2.asset.json";
import grassAlbedoAsset from "@/assets/textures/grass_albedo.ktx2.asset.json";
import grassNormalAsset from "@/assets/textures/grass_normal.ktx2.asset.json";
import grassRoughAsset from "@/assets/textures/grass_rough.ktx2.asset.json";
import concreteAlbedoAsset from "@/assets/textures/concrete_albedo.ktx2.asset.json";
import concreteRoughAsset from "@/assets/textures/concrete_rough.ktx2.asset.json";
import netMaskAsset from "@/assets/textures/net_mask.ktx2.asset.json";

import asset0 from "@/assets/textures/jersey_solid_normal.ktx2.asset.json";
import asset1 from "@/assets/textures/jersey_solid_rough.ktx2.asset.json";
import asset2 from "@/assets/textures/jersey_stripes_normal.ktx2.asset.json";
import asset3 from "@/assets/textures/jersey_stripes_rough.ktx2.asset.json";
import asset4 from "@/assets/textures/jersey_pin_normal.ktx2.asset.json";
import asset5 from "@/assets/textures/jersey_pin_rough.ktx2.asset.json";
import asset6 from "@/assets/textures/jersey_hoops_normal.ktx2.asset.json";
import asset7 from "@/assets/textures/jersey_hoops_rough.ktx2.asset.json";
import asset8 from "@/assets/textures/jersey_sash_normal.ktx2.asset.json";
import asset9 from "@/assets/textures/jersey_sash_rough.ktx2.asset.json";
import asset10 from "@/assets/textures/jersey_halves_normal.ktx2.asset.json";
import asset11 from "@/assets/textures/jersey_halves_rough.ktx2.asset.json";
import asset12 from "@/assets/textures/jersey_checks_normal.ktx2.asset.json";
import asset13 from "@/assets/textures/jersey_checks_rough.ktx2.asset.json";
import asset14 from "@/assets/textures/shorts_plain_normal.ktx2.asset.json";
import asset15 from "@/assets/textures/shorts_mesh_normal.ktx2.asset.json";
import asset16 from "@/assets/textures/shorts_stitched_normal.ktx2.asset.json";
import asset17 from "@/assets/textures/socks_rib_normal.ktx2.asset.json";
import asset18 from "@/assets/textures/socks_fine_normal.ktx2.asset.json";
import asset19 from "@/assets/textures/socks_heavy_normal.ktx2.asset.json";
import asset20 from "@/assets/textures/boot_leather_normal.ktx2.asset.json";
import asset21 from "@/assets/textures/boot_synthetic_normal.ktx2.asset.json";
import asset22 from "@/assets/textures/boot_knit_normal.ktx2.asset.json";
import asset23 from "@/assets/textures/skin_light_normal.ktx2.asset.json";
import asset24 from "@/assets/textures/skin_medium_normal.ktx2.asset.json";
import asset25 from "@/assets/textures/skin_dark_normal.ktx2.asset.json";
import asset26 from "@/assets/textures/grass_stripes_albedo.ktx2.asset.json";
import asset27 from "@/assets/textures/grass_diagonal_albedo.ktx2.asset.json";
import asset28 from "@/assets/textures/grass_wide_albedo.ktx2.asset.json";

export type Ktx2Name =
  | "fiberNormal"
  | "fiberRough"
  | "skinNormal"
  | "sweatNormal"
  | "sweatMask"
  | "hairNormal"
  | "hairRough"
  | "bootNormal"
  | "bootRough"
  | "shinNormal"
  | "shinRough"
  | "sockNormal";
export type StadiumKtx2Name =
  "grassAlbedo" | "grassNormal" | "grassRough" | "concreteAlbedo" | "concreteRough" | "netMask";
export type DetailKtx2Name =
  | "jersey_solid_normal"
  | "jersey_solid_rough"
  | "jersey_stripes_normal"
  | "jersey_stripes_rough"
  | "jersey_pin_normal"
  | "jersey_pin_rough"
  | "jersey_hoops_normal"
  | "jersey_hoops_rough"
  | "jersey_sash_normal"
  | "jersey_sash_rough"
  | "jersey_halves_normal"
  | "jersey_halves_rough"
  | "jersey_checks_normal"
  | "jersey_checks_rough"
  | "shorts_plain_normal"
  | "shorts_mesh_normal"
  | "shorts_stitched_normal"
  | "socks_rib_normal"
  | "socks_fine_normal"
  | "socks_heavy_normal"
  | "boot_leather_normal"
  | "boot_synthetic_normal"
  | "boot_knit_normal"
  | "skin_light_normal"
  | "skin_medium_normal"
  | "skin_dark_normal"
  | "grass_stripes_albedo"
  | "grass_diagonal_albedo"
  | "grass_wide_albedo";
export type TextureName = Ktx2Name | StadiumKtx2Name | DetailKtx2Name;

/** repetição de cada mapa sobre a malha do jogador */
const SOURCES: Record<TextureName, { url: string; repeat: number; color?: boolean }> = {
  fiberNormal: { url: fiberNormalAsset.url, repeat: 6 },
  fiberRough: { url: fiberRoughAsset.url, repeat: 6 },
  skinNormal: { url: skinNormalAsset.url, repeat: 4 },
  sweatNormal: { url: sweatNormalAsset.url, repeat: 3 },
  sweatMask: { url: sweatMaskAsset.url, repeat: 3 },
  hairNormal: { url: hairNormalAsset.url, repeat: 3 },
  hairRough: { url: hairRoughAsset.url, repeat: 3 },
  bootNormal: { url: bootNormalAsset.url, repeat: 3 },
  bootRough: { url: bootRoughAsset.url, repeat: 3 },
  shinNormal: { url: shinNormalAsset.url, repeat: 2 },
  shinRough: { url: shinRoughAsset.url, repeat: 2 },
  sockNormal: { url: sockNormalAsset.url, repeat: 4 },
  grassAlbedo: { url: grassAlbedoAsset.url, repeat: 1, color: true },
  grassNormal: { url: grassNormalAsset.url, repeat: 6 },
  grassRough: { url: grassRoughAsset.url, repeat: 6 },
  concreteAlbedo: { url: concreteAlbedoAsset.url, repeat: 1, color: true },
  concreteRough: { url: concreteRoughAsset.url, repeat: 1 },
  netMask: { url: netMaskAsset.url, repeat: 1 },
  jersey_solid_normal: { url: asset0.url, repeat: 6 },
  jersey_solid_rough: { url: asset1.url, repeat: 6 },
  jersey_stripes_normal: { url: asset2.url, repeat: 6 },
  jersey_stripes_rough: { url: asset3.url, repeat: 6 },
  jersey_pin_normal: { url: asset4.url, repeat: 6 },
  jersey_pin_rough: { url: asset5.url, repeat: 6 },
  jersey_hoops_normal: { url: asset6.url, repeat: 6 },
  jersey_hoops_rough: { url: asset7.url, repeat: 6 },
  jersey_sash_normal: { url: asset8.url, repeat: 6 },
  jersey_sash_rough: { url: asset9.url, repeat: 6 },
  jersey_halves_normal: { url: asset10.url, repeat: 6 },
  jersey_halves_rough: { url: asset11.url, repeat: 6 },
  jersey_checks_normal: { url: asset12.url, repeat: 6 },
  jersey_checks_rough: { url: asset13.url, repeat: 6 },
  shorts_plain_normal: { url: asset14.url, repeat: 6 },
  shorts_mesh_normal: { url: asset15.url, repeat: 6 },
  shorts_stitched_normal: { url: asset16.url, repeat: 6 },
  socks_rib_normal: { url: asset17.url, repeat: 6 },
  socks_fine_normal: { url: asset18.url, repeat: 6 },
  socks_heavy_normal: { url: asset19.url, repeat: 6 },
  boot_leather_normal: { url: asset20.url, repeat: 3 },
  boot_synthetic_normal: { url: asset21.url, repeat: 3 },
  boot_knit_normal: { url: asset22.url, repeat: 3 },
  skin_light_normal: { url: asset23.url, repeat: 3 },
  skin_medium_normal: { url: asset24.url, repeat: 3 },
  skin_dark_normal: { url: asset25.url, repeat: 3 },
  grass_stripes_albedo: { url: asset26.url, repeat: 1, color: true },
  grass_diagonal_albedo: { url: asset27.url, repeat: 1, color: true },
  grass_wide_albedo: { url: asset28.url, repeat: 1, color: true },
};

const loaded = new Map<TextureName, THREE.Texture>();
const requested = new Set<TextureName>();
const pending = new Set<TextureName>();
const failures = new Map<TextureName, TextureFailure>();
let loader: KTX2Loader | null = null;
let started = false;
let anisotropy = 8;
const listeners = new Set<() => void>();
let revision = 0;
/** Re-render only when a compressed asset arrives; no per-frame checks. */
export function useKtx2Revision(): number {
  return useSyncExternalStore(
    onKtx2Ready,
    () => revision,
    () => 0,
  );
}

/** avisa quem depende das texturas (o cache de materiais) que elas chegaram */
export function onKtx2Ready(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** textura já disponível, ou null enquanto o download não terminou */
export function ktx2(name: TextureName): THREE.Texture | null {
  return loaded.get(name) ?? null;
}

/** Only fetch new high-quality variants that are actually visible in this match. */
export function requestKtx2(names: readonly TextureName[]): void {
  if (!loader) {
    for (const name of names) pending.add(name);
    return;
  }
  for (const name of names) {
    if (requested.has(name) || !canRequestTexture(failures.get(name), Date.now())) continue;
    requested.add(name);
    const src = SOURCES[name];
    loader.load(
      src.url,
      (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(src.repeat, src.repeat);
        tex.anisotropy = anisotropy;
        tex.colorSpace = src.color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tex.needsUpdate = true;
        loaded.set(name, tex);
        failures.delete(name);
        revision += 1;
        for (const fn of listeners) fn();
      },
      undefined,
      (error) => {
        failures.set(
          name,
          textureFailureAfter(failures.get(name), Date.now(), textureHttpStatus(error)),
        );
        requested.delete(name);
      },
    );
  }
}

/**
 * Inicia o download uma única vez. Precisa do renderer para saber quais
 * formatos comprimidos a GPU aceita (ASTC, BC7, ETC2, …).
 */
export function initKtx2(
  renderer: THREE.WebGLRenderer | import("three/webgpu").WebGPURenderer,
): void {
  if (started || typeof window === "undefined") return;
  started = true;

  loader = new KTX2Loader()
    .setTranscoderPath("/basis/")
    .setWorkerLimit(deviceTextureDecodeWorkers())
    .detectSupport(renderer);
  anisotropy =
    renderer instanceof THREE.WebGLRenderer
      ? Math.min(8, renderer.capabilities.getMaxAnisotropy())
      : 8;
  requestKtx2([
    "fiberNormal",
    "fiberRough",
    "skinNormal",
    "sweatNormal",
    "sweatMask",
    "hairNormal",
    "hairRough",
    "bootNormal",
    "bootRough",
    "shinNormal",
    "shinRough",
    "sockNormal",
    "grassAlbedo",
    "grassNormal",
    "grassRough",
    "concreteAlbedo",
    "concreteRough",
    "netMask",
  ]);
  requestKtx2([...pending]);
  pending.clear();
}

/** libera tudo (troca de cena / descarte do renderer) */
export function disposeKtx2(): void {
  for (const tex of loaded.values()) tex.dispose();
  loaded.clear();
  requested.clear();
  pending.clear();
  loader?.dispose();
  failures.clear();
  loader = null;
  started = false;
  revision += 1;
  for (const fn of listeners) fn();
}
