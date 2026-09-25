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

/** repetição de cada mapa sobre a malha do jogador */
const SOURCES: Record<Ktx2Name, { url: string; repeat: number }> = {
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
};

const loaded = new Map<Ktx2Name, THREE.Texture>();
let loader: KTX2Loader | null = null;
let started = false;
const listeners = new Set<() => void>();

/** avisa quem depende das texturas (o cache de materiais) que elas chegaram */
export function onKtx2Ready(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** textura já disponível, ou null enquanto o download não terminou */
export function ktx2(name: Ktx2Name): THREE.Texture | null {
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

  let pending = 0;
  const done = () => {
    pending -= 1;
    if (pending > 0) return;
    for (const fn of listeners) fn();
  };

  for (const [name, src] of Object.entries(SOURCES) as [Ktx2Name, { url: string; repeat: number }][]) {
    pending += 1;
    loader.load(
      src.url,
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(src.repeat, src.repeat);
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        tex.colorSpace = THREE.NoColorSpace;
        tex.needsUpdate = true;
        loaded.set(name, tex);
        done();
      },
      undefined,
      () => done(),
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
