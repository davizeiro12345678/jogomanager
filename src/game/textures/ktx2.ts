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
import { BoundedWorkQueue } from "@/game/bounded-work-queue";
import { gpuTexturePolicy, prepareGpuTexture, selectTextureResolution } from "./gpu-texture-policy";
import { TextureRendererOwners } from "./texture-owners";
import {
  canRequestTexture,
  needsProceduralTextureFallback,
  scheduleTextureRetry,
  textureFailureAfter,
  textureHttpStatus,
  type TextureFailure,
} from "./texture-load-policy";

import textureUrls from "@/assets/textures/texture-library-v2.urls.json";
import textureVariants from "@/assets/textures/texture-library-v2.variants.json";
import { TextureRevisions } from "./texture-revisions";

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
  | "grassAlbedo"
  | "grassNormal"
  | "grassRough"
  | "grassDetailRough"
  | "concreteAlbedo"
  | "concreteNormal"
  | "concreteRough"
  | "netMask";
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
  | "grass_wide_albedo"
  | "grass_rings_albedo"
  | "grass_diamond_albedo"
  | "grass_fine_albedo"
  | "grass_spiral_albedo"
  | "grass_bands_albedo";
const EXTRA_TEXTURES = [
  "glove_normal",
  "glove_rough",
  "skin_rough",
  "lip_normal",
  "lip_rough",
  "beard_normal",
  "iris_detail_albedo",
  "sclera_albedo",
  "grass_blade_albedo",
  "net_normal",
  "net_rough",
  "ball_normal",
  "ball_rough",
  "shorts_plain_rough",
  "shorts_mesh_rough",
  "shorts_stitched_rough",
  "socks_rib_rough",
  "socks_fine_rough",
  "socks_heavy_rough",
  "stadium_metal_albedo",
  "stadium_metal_normal",
  "stadium_metal_rough",
  "stadium_seat_albedo",
  "stadium_seat_normal",
  "stadium_seat_rough",
  "stadium_asphalt_albedo",
  "stadium_asphalt_normal",
  "stadium_asphalt_rough",
  "cinema_tile_albedo",
  "cinema_tile_normal",
  "cinema_tile_rough",
  "cinema_wood_albedo",
  "cinema_wood_normal",
  "cinema_wood_rough",
  "cinema_wall_albedo",
  "cinema_wall_normal",
  "cinema_wall_rough",
] as const;
export type ExtraKtx2Name = (typeof EXTRA_TEXTURES)[number];
export type TextureName = Ktx2Name | StadiumKtx2Name | DetailKtx2Name | ExtraKtx2Name;
type TextureSource = { url: string; repeat: number | readonly [number, number]; color?: boolean };

/** repetição de cada mapa sobre a malha do jogador */
const SOURCES: Record<TextureName, TextureSource> = {
  ...(Object.fromEntries(
    EXTRA_TEXTURES.map((name) => [
      name,
      {
        url: textureUrls[name],
        repeat:
          name === "grass_blade_albedo"
            ? [8, 4]
            : name.startsWith("cinema_tile")
              ? [8, 6]
              : name.startsWith("cinema_wood")
                ? [5, 4]
                : name.startsWith("cinema_wall")
                  ? [4, 3]
                  : name.startsWith("stadium_asphalt")
                    ? [7, 5]
                    : name.startsWith("shorts_")
                      ? 6
                      : name.startsWith("socks_") || name === "skin_rough"
                        ? 4
                        : name.startsWith("lip_") || name === "beard_normal"
                          ? 2
                          : 1,
        color: name.endsWith("_albedo"),
      },
    ]),
  ) as Record<ExtraKtx2Name, TextureSource>),
  fiberNormal: { url: textureUrls.fiber_normal, repeat: 6 },
  fiberRough: { url: textureUrls.fiber_rough, repeat: 6 },
  skinNormal: { url: textureUrls.skin_normal, repeat: 4 },
  sweatNormal: { url: textureUrls.sweat_normal, repeat: 3 },
  sweatMask: { url: textureUrls.sweat_mask, repeat: 3 },
  hairNormal: { url: textureUrls.hair_normal, repeat: 2 },
  hairRough: { url: textureUrls.hair_rough, repeat: 3 },
  bootNormal: { url: textureUrls.boot_normal, repeat: 3 },
  bootRough: { url: textureUrls.boot_rough, repeat: 3 },
  shinNormal: { url: textureUrls.shin_normal, repeat: 2 },
  shinRough: { url: textureUrls.shin_rough, repeat: 2 },
  sockNormal: { url: textureUrls.sock_normal, repeat: 4 },
  grassAlbedo: { url: textureUrls.grass_albedo, repeat: 1, color: true },
  grassNormal: { url: textureUrls.grass_normal, repeat: [48, 32] },
  grassRough: { url: textureUrls.grass_rough, repeat: 1 },
  grassDetailRough: { url: textureUrls.grass_detail_rough, repeat: [48, 32] },
  concreteAlbedo: { url: textureUrls.concrete_albedo, repeat: 1, color: true },
  concreteNormal: { url: textureUrls.concrete_normal, repeat: 1 },
  concreteRough: { url: textureUrls.concrete_rough, repeat: 1 },
  netMask: { url: textureUrls.net_mask, repeat: 1 },
  jersey_solid_normal: { url: textureUrls.jersey_solid_normal, repeat: 6 },
  jersey_solid_rough: { url: textureUrls.jersey_solid_rough, repeat: 6 },
  jersey_stripes_normal: { url: textureUrls.jersey_stripes_normal, repeat: 6 },
  jersey_stripes_rough: { url: textureUrls.jersey_stripes_rough, repeat: 6 },
  jersey_pin_normal: { url: textureUrls.jersey_pin_normal, repeat: 6 },
  jersey_pin_rough: { url: textureUrls.jersey_pin_rough, repeat: 6 },
  jersey_hoops_normal: { url: textureUrls.jersey_hoops_normal, repeat: 6 },
  jersey_hoops_rough: { url: textureUrls.jersey_hoops_rough, repeat: 6 },
  jersey_sash_normal: { url: textureUrls.jersey_sash_normal, repeat: 6 },
  jersey_sash_rough: { url: textureUrls.jersey_sash_rough, repeat: 6 },
  jersey_halves_normal: { url: textureUrls.jersey_halves_normal, repeat: 6 },
  jersey_halves_rough: { url: textureUrls.jersey_halves_rough, repeat: 6 },
  jersey_checks_normal: { url: textureUrls.jersey_checks_normal, repeat: 6 },
  jersey_checks_rough: { url: textureUrls.jersey_checks_rough, repeat: 6 },
  shorts_plain_normal: { url: textureUrls.shorts_plain_normal, repeat: 6 },
  shorts_mesh_normal: { url: textureUrls.shorts_mesh_normal, repeat: 6 },
  shorts_stitched_normal: { url: textureUrls.shorts_stitched_normal, repeat: 6 },
  socks_rib_normal: { url: textureUrls.socks_rib_normal, repeat: 6 },
  socks_fine_normal: { url: textureUrls.socks_fine_normal, repeat: 6 },
  socks_heavy_normal: { url: textureUrls.socks_heavy_normal, repeat: 6 },
  boot_leather_normal: { url: textureUrls.boot_leather_normal, repeat: 3 },
  boot_synthetic_normal: { url: textureUrls.boot_synthetic_normal, repeat: 3 },
  boot_knit_normal: { url: textureUrls.boot_knit_normal, repeat: 3 },
  skin_light_normal: { url: textureUrls.skin_light_normal, repeat: 3 },
  skin_medium_normal: { url: textureUrls.skin_medium_normal, repeat: 3 },
  skin_dark_normal: { url: textureUrls.skin_dark_normal, repeat: 3 },
  grass_stripes_albedo: { url: textureUrls.grass_stripes_albedo, repeat: 1, color: true },
  grass_diagonal_albedo: { url: textureUrls.grass_diagonal_albedo, repeat: 1, color: true },
  grass_wide_albedo: { url: textureUrls.grass_wide_albedo, repeat: 1, color: true },
  grass_rings_albedo: { url: textureUrls.grass_rings_albedo, repeat: 1, color: true },
  grass_diamond_albedo: { url: textureUrls.grass_diamond_albedo, repeat: 1, color: true },
  grass_fine_albedo: { url: textureUrls.grass_fine_albedo, repeat: 1, color: true },
  grass_spiral_albedo: { url: textureUrls.grass_spiral_albedo, repeat: 1, color: true },
  grass_bands_albedo: { url: textureUrls.grass_bands_albedo, repeat: 1, color: true },
};
const loaded = new Map<TextureName, THREE.Texture>();
const requested = new Set<TextureName>();
const pending = new Set<TextureName>();
const failures = new Map<TextureName, TextureFailure>();
const retryTimers = new Map<TextureName, () => void>();
let loader: KTX2Loader | null = null;
let loadQueue: BoundedWorkQueue | null = null;
let started = false;
let generation = 0;
let policy = gpuTexturePolicy();
type TextureRenderer = THREE.WebGLRenderer | import("three/webgpu").WebGPURenderer;
const owners = new TextureRendererOwners<TextureRenderer>();
const supportProfiles = new WeakMap<object, string>();
let decoderProfile: string | undefined;
let unavailable = false;
export const gpuTextureStats = {
  residentBytes: 0,
  residentTextures: 0,
  droppedMips: 0,
  rejectedUncompressed: 0,
  rejectedOverBudget: 0,
};
const listeners = new Set<(reset?: boolean) => void>();
let revision = 0;
const assetRevisions = new TextureRevisions<TextureName>();
let disposing = false;
let notificationPending = false;
let pendingReset = false;

function notifyKtx2Change(reset = false, name?: TextureName) {
  assetRevisions.touch(name);
  pendingReset ||= reset;
  if (notificationPending) return;
  notificationPending = true;
  const publish = () => {
    notificationPending = false;
    const reset = pendingReset;
    pendingReset = false;
    revision += 1;
    // A subscriber can unmount while the decoder is waiting for a frame.
    // Deliver only to the consumers still registered at publication time.
    for (const fn of listeners) fn(reset);
  };
  // Several decoded channels can complete together. Notify their consumers
  // once per painted frame while retaining backend ownership/reset semantics.
  if (
    typeof requestAnimationFrame === "function" &&
    typeof document !== "undefined" &&
    !document.hidden
  )
    requestAnimationFrame(publish);
  else queueMicrotask(publish);
}
/** Re-render only when a compressed asset arrives; no per-frame checks. */
export function useKtx2Revision(names?: readonly TextureName[]): number {
  return useSyncExternalStore(
    onKtx2Ready,
    () => (names ? assetRevisions.snapshot(names) : revision),
    () => 0,
  );
}

/** avisa quem depende das texturas (o cache de materiais) que elas chegaram */
export function onKtx2Ready(fn: (reset?: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** textura já disponível, ou null enquanto o download não terminou */
export function ktx2(name: TextureName): THREE.Texture | null {
  if (!owners.compatible) return null;
  const texture = loaded.get(name);
  if (!texture && !disposing) requestKtx2([name]);
  return texture ?? null;
}

/**
 * True only after a compressed request cannot recover on this device. Callers
 * use it to defer expensive canvas fallback generation while KTX2 is loading.
 */
export function needsKtx2ProceduralFallback(name: TextureName): boolean {
  return unavailable || !owners.compatible || needsProceduralTextureFallback(failures.get(name));
}

/** Only fetch new high-quality variants that are actually visible in this match. */
export function requestKtx2(names: readonly TextureName[]): void {
  if (!loader || !owners.compatible) {
    for (const name of names) pending.add(name);
    return;
  }
  for (const name of names) {
    if (
      loaded.has(name) ||
      requested.has(name) ||
      !canRequestTexture(failures.get(name), Date.now())
    )
      continue;
    retryTimers.get(name)?.();
    retryTimers.delete(name);
    requested.add(name);
    const src = SOURCES[name];
    const filename = src.url
      .split("/")
      .at(-1)
      ?.replace(/\.ktx2$/, "") as keyof typeof textureVariants;
    const selected = selectTextureResolution(
      textureVariants[filename],
      src.url,
      src.color ? policy.maxColorSize : policy.maxDataSize,
    );
    const url = /^[a-f0-9]{16}$/.test(selected)
      ? `/textures/v2/${selected}/${filename}.ktx2`
      : selected;
    const activeLoader = loader;
    const activeGeneration = generation;
    loadQueue?.enqueue(
      name,
      () =>
        new Promise<void>((resolve) => {
          if (activeGeneration !== generation || loader !== activeLoader) {
            resolve();
            return;
          }
          activeLoader.load(
            url,
            (tex) => {
              resolve();
              if (activeGeneration !== generation || loader !== activeLoader) {
                tex.dispose();
                return;
              }
              retryTimers.get(name)?.();
              retryTimers.delete(name);
              const prepared = prepareGpuTexture(tex, Boolean(src.color), policy);
              if (
                !prepared.compressed ||
                gpuTextureStats.residentBytes + prepared.bytes > policy.residentBudget
              ) {
                if (!prepared.compressed) gpuTextureStats.rejectedUncompressed += 1;
                else gpuTextureStats.rejectedOverBudget += 1;
                tex.dispose();
                requested.delete(name);
                failures.set(name, {
                  attempts: 3,
                  retryAt: Number.POSITIVE_INFINITY,
                  permanent: true,
                });
                notifyKtx2Change(false, name);
                return;
              }
              tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
              if (typeof src.repeat === "number") tex.repeat.set(src.repeat, src.repeat);
              else tex.repeat.set(src.repeat[0], src.repeat[1]);
              tex.colorSpace = src.color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
              tex.needsUpdate = true;
              loaded.set(name, tex);
              gpuTextureStats.residentBytes += prepared.bytes;
              gpuTextureStats.residentTextures = loaded.size;
              gpuTextureStats.droppedMips += prepared.droppedMips;
              failures.delete(name);
              notifyKtx2Change(false, name);
            },
            undefined,
            (error) => {
              resolve();
              if (activeGeneration !== generation || loader !== activeLoader) return;
              const failure = textureFailureAfter(
                failures.get(name),
                Date.now(),
                textureHttpStatus(error),
              );
              failures.set(name, failure);
              notifyKtx2Change();
              requested.delete(name);
              const cancel = scheduleTextureRetry(failure, Date.now(), () => {
                retryTimers.delete(name);
                if (!loaded.has(name)) requestKtx2([name]);
              });
              if (cancel) retryTimers.set(name, cancel);
            },
          );
        }),
    );
  }
}

/**
 * Inicia o download uma única vez. Precisa do renderer para saber quais
 * formatos comprimidos a GPU aceita (ASTC, BC7, ETC2, …).
 */
export function initKtx2(
  renderer: THREE.WebGLRenderer | import("three/webgpu").WebGPURenderer,
  portrait = false,
): void {
  if (started || typeof window === "undefined") return;
  // Reserve two temporary shared-WASM lanes during stadium preparation.
  const decodeWorkers = Math.min(2, deviceTextureDecodeWorkers());
  if (decodeWorkers === 0) {
    unavailable = true;
    notifyKtx2Change();
    return;
  }
  started = true;
  decoderProfile = supportProfiles.get(renderer);
  loadQueue = new BoundedWorkQueue(decodeWorkers);

  loader = new KTX2Loader()
    .setTranscoderPath("/basis/")
    .setWorkerLimit(decodeWorkers)
    .detectSupport(renderer);
  policy = gpuTexturePolicy(
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    renderer instanceof THREE.WebGLRenderer ? renderer.capabilities.getMaxAnisotropy() : 4,
    portrait,
  );
  requestKtx2([...pending]);
  pending.clear();
}

/** Keep shared textures alive while a scene uses them; release after the last scene leaves. */
export function retainKtx2(
  renderer: THREE.WebGLRenderer | import("three/webgpu").WebGPURenderer,
  portrait = false,
): () => void {
  // Every Canvas detects its own supported formats, including cold studio
  // access and a replacement renderer after context recovery. The shared
  // decoder still owns only one bounded worker pool.
  let profile = supportProfiles.get(renderer);
  if (profile === undefined) {
    const detector = new KTX2Loader().detectSupport(renderer);
    profile =
      JSON.stringify(
        (detector as KTX2Loader & { workerConfig?: Record<string, boolean> }).workerConfig,
      ) ?? "unknown";
    detector.dispose();
    supportProfiles.set(renderer, profile);
  }
  const compatibleBefore = owners.compatible;
  const releaseOwner = owners.acquire(renderer, profile);
  if (started && owners.compatible && decoderProfile !== profile) disposeKtx2();
  initKtx2(renderer, portrait);
  if (compatibleBefore !== owners.compatible) notifyKtx2Change();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const previous = owners.compatible;
    releaseOwner();
    if (previous !== owners.compatible) {
      const remainingRenderer = owners.firstRenderer;
      if (remainingRenderer && owners.profile !== decoderProfile) {
        disposeKtx2();
        initKtx2(remainingRenderer);
      }
      notifyKtx2Change();
      requestKtx2([...pending]);
      pending.clear();
    }
    queueMicrotask(() => {
      if (owners.count === 0) disposeKtx2();
    });
  };
}

/** libera tudo (troca de cena / descarte do renderer) */
export function disposeKtx2(): void {
  generation += 1;
  loadQueue?.clear();
  loadQueue = null;
  for (const cancel of retryTimers.values()) cancel();
  retryTimers.clear();
  for (const tex of loaded.values()) tex.dispose();
  loaded.clear();
  gpuTextureStats.residentBytes = 0;
  gpuTextureStats.residentTextures = 0;
  requested.clear();
  pending.clear();
  loader?.dispose();
  failures.clear();
  loader = null;
  started = false;
  decoderProfile = undefined;
  unavailable = false;
  disposing = true;
  try {
    notifyKtx2Change(true);
  } finally {
    disposing = false;
  }
}
