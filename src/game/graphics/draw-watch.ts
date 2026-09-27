// ============================================================================
//  draw-watch.ts
//  Vigia de orçamento de cena por subsistema.
//
//  O `renderer.info` entrega o total de desenhos do quadro, mas não diz quem é
//  o culpado. Este módulo cruza o censo por bucket (`censusScene`) com o
//  contrato de cada tier (`GRAPHICS_PROFILES`) e responde três perguntas que a
//  melhoria gráfica precisa responder antes de existir:
//
//    1. quanto do orçamento ainda sobra?
//    2. de onde vem o custo, em ordem?
//    3. a tendência está subindo (vazamento de malha/textura)?
//
//  É puro: não toca em WebGL nem em React, então roda em teste e no benchmark.
// ============================================================================

import * as THREE from "three";

import { GRAPHICS_PROFILES, type GraphicsTier } from "@/game/contracts/graphics-profile";
import { censusScene, type CensusBucket, type SceneCensus } from "@/game/scene-census";

/** Um bucket e o quanto ele consome do quadro. */
export interface DrawOffender {
  bucket: CensusBucket;
  draws: number;
  /** fração de 0 a 1 dos desenhos totais */
  share: number;
}

export interface DrawWatchSample {
  /** instante da amostra (ms) */
  t: number;
  draws: number;
  triangles: number;
  materials: number;
  /** desenhos permitidos pelo contrato do tier */
  allowed: number;
  /** folga negativa = estourou o orçamento */
  headroom: number;
  overBudget: boolean;
  offenders: DrawOffender[];
}

export interface DrawWatchOptions {
  /** máximo de amostras guardadas no histórico (padrão 120 ≈ 2 min a 1 Hz) */
  maxSamples?: number;
  /** ignora buckets abaixo desta fração na lista de culpados */
  minShare?: number;
}

const EMPTY_SAMPLE: DrawWatchSample = {
  t: 0,
  draws: 0,
  triangles: 0,
  materials: 0,
  allowed: 0,
  headroom: 0,
  overBudget: false,
  offenders: [],
};

export class DrawWatch {
  private readonly samples: DrawWatchSample[] = [];
  private readonly maxSamples: number;
  private readonly minShare: number;
  private tier: GraphicsTier;

  constructor(tier: GraphicsTier = "media", options: DrawWatchOptions = {}) {
    this.tier = tier;
    this.maxSamples = Math.max(2, options.maxSamples ?? 120);
    this.minShare = options.minShare ?? 0.02;
  }

  setTier(tier: GraphicsTier): void {
    this.tier = tier;
  }

  /** Última amostra coletada (ou uma amostra zerada, nunca nulo). */
  get last(): DrawWatchSample {
    return this.samples[this.samples.length - 1] ?? EMPTY_SAMPLE;
  }

  get history(): readonly DrawWatchSample[] {
    return this.samples;
  }

  /**
   * Percorre o grafo uma vez e registra a amostra. Custoso (walk completo), por
   * isso a chamada deve ser ~1 Hz, nunca por quadro.
   */
  sample(scene: THREE.Object3D, now = 0): DrawWatchSample {
    const census = censusScene(scene);
    const entry = this.describe(census, now);
    this.samples.push(entry);
    if (this.samples.length > this.maxSamples) this.samples.shift();
    return entry;
  }

  /** Converte um censo já calculado em uma amostra (usado em teste/benchmark). */
  describe(census: SceneCensus, now = 0): DrawWatchSample {
    const profile = GRAPHICS_PROFILES[this.tier];
    const draws = census.total.draws;
    const offenders: DrawOffender[] = [];
    for (const [bucket, entry] of Object.entries(census.buckets) as [
      CensusBucket,
      { draws: number },
    ][]) {
      const share = draws > 0 ? entry.draws / draws : 0;
      if (share >= this.minShare && entry.draws > 0)
        offenders.push({ bucket, draws: entry.draws, share });
    }
    offenders.sort((a, b) => b.draws - a.draws);
    return {
      t: now,
      draws,
      triangles: census.total.triangles,
      materials: census.materials,
      allowed: profile.maxDrawCalls,
      headroom: profile.maxDrawCalls - draws,
      overBudget: draws > profile.maxDrawCalls,
      offenders,
    };
  }

  /** Bucket que mais pesa no quadro atual. */
  worst(): DrawOffender | null {
    return this.last.offenders[0] ?? null;
  }

  /**
   * Tendência dos desenhos nas últimas amostras. Serve para flagrar vazamento:
   * malha ou textura criada e nunca liberada faz o número subir devagar.
   */
  trend(window = 12): "up" | "flat" | "down" {
    const slice = this.samples.slice(-window);
    if (slice.length < 4) return "flat";
    const half = Math.floor(slice.length / 2);
    const older = slice.slice(0, half);
    const newer = slice.slice(half);
    const mean = (xs: DrawWatchSample[]) => xs.reduce((sum, s) => sum + s.draws, 0) / xs.length;
    const before = mean(older);
    const after = mean(newer);
    if (before <= 0) return after > 0 ? "up" : "flat";
    const delta = (after - before) / before;
    if (delta > 0.06) return "up";
    if (delta < -0.06) return "down";
    return "flat";
  }

  /** Pico de desenhos no histórico. */
  peak(): number {
    return this.samples.reduce((max, s) => Math.max(max, s.draws), 0);
  }

  reset(): void {
    this.samples.length = 0;
  }
}

/** Texto curto para HUD: "412/260 draws · torcida 38%". */
export function formatDrawReport(watch: DrawWatch): string {
  const last = watch.last;
  if (last.draws === 0) return "sem amostra";
  const worst = watch.worst();
  const worstText = worst ? ` · ${worst.bucket} ${Math.round(worst.share * 100)}%` : "";
  const flag = last.overBudget ? " ⚠" : "";
  return `${Math.round(last.draws)}/${last.allowed} draws${worstText}${flag}`;
}

/** Texto longo para o console/benchmark, com os culpados em ordem. */
export function formatDrawAudit(watch: DrawWatch): string {
  const last = watch.last;
  if (last.draws === 0) return "draw-watch: sem amostra";
  const lines = [
    `draw-watch: ${last.draws}/${last.allowed} draws (folga ${last.headroom}) · ${Math.round(last.triangles)} tri · ${last.materials} materiais · tendência ${watch.trend()}`,
  ];
  for (const o of last.offenders) {
    lines.push(
      `  ${o.bucket.padEnd(10)} ${String(o.draws).padStart(5)} draws  ${Math.round(o.share * 100)}%`,
    );
  }
  return lines.join("\n");
}
