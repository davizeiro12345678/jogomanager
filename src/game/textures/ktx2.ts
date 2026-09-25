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
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

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
export type StadiumKtx2Name = "grassAlbedo" | "grassNormal" | "grassRough" | "concreteAlbedo" | "concreteRough" | "netMask";
export type TextureName = Ktx2Name | StadiumKtx2Name;

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
};

const loaded = new Map<TextureName, THREE.Texture>();
let loader: KTX2Loader | null = null;
let started = false;
const listeners = new Set<() => void>();

/** avisa quem depende das texturas (o cache de materiais) que elas chegaram */
export function onKtx2Ready(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** textura já disponível, ou null enquanto o download não terminou */
export function ktx2(name: TextureName): THREE.Texture | null {
  return loaded.get(name) ?? null;
}

/**
 * Inicia o download uma única vez. Precisa do renderer para saber quais
 * formatos comprimidos a GPU aceita (ASTC, BC7, ETC2, …).
 */
export function initKtx2(renderer: THREE.WebGLRenderer): void {
  if (started || typeof window === "undefined") return;
  started = true;

  loader = new KTX2Loader().setTranscoderPath("/basis/").detectSupport(renderer);

  // Notify on each arrival so no texture has to wait for an unrelated failed/slow download.
  for (const [name, src] of Object.entries(SOURCES) as [TextureName, (typeof SOURCES)[TextureName]][]) {
    loader.load(
      src.url,
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(src.repeat, src.repeat);
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        tex.colorSpace = src.color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tex.needsUpdate = true;
        loaded.set(name, tex);
        for (const fn of listeners) fn();
      },
      undefined,
      () => {}, // Procedural fallback remains available if the CDN is offline.
    );
  }
}

/** libera tudo (troca de cena / descarte do renderer) */
export function disposeKtx2(): void {
  for (const tex of loaded.values()) tex.dispose();
  loaded.clear();
  loader?.dispose();
  loader = null;
  started = false;
}
