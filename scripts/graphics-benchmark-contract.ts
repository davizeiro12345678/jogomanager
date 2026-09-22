import { isCameraMode, type CameraMode } from "../src/game/camera-modes";
import type { TimeOfDay, Weather } from "../src/game/matchday";
import { MOW_PATTERNS, type MowPattern } from "../src/components/game/stadium/textures/grass";
import type { QualityPref } from "../src/game/visual-settings";

/** The benchmark always compares scene profiles at this physical render size. */
export const GRAPHICS_BENCHMARK_VIEWPORT = {
  width: 1280,
  height: 720,
  dpr: 1,
} as const;

export type BenchmarkQuality = Exclude<QualityPref, "auto">;

export interface GraphicsBenchmarkScenario {
  label: string;
  seed: string;
  quality: BenchmarkQuality;
  camera: CameraMode;
  time: TimeOfDay;
  weather: Weather;
  mow: MowPattern;
}

/**
 * Fixed scene presets make each class of benchmark repeatable. Query parameters
 * can override the seed, quality, camera and match look without changing the
 * physical render target, so results remain comparable.
 */
export const GRAPHICS_BENCHMARK_SCENARIOS = {
  baseline: {
    label: "Alto · tática · dia",
    seed: "graphics-high-v1",
    quality: "alta",
    camera: "tactical",
    time: "dia",
    weather: "seco",
    mow: "stripes",
  },
  broadcast: {
    label: "Alto · transmissão · dia",
    seed: "graphics-broadcast-v1",
    quality: "alta",
    camera: "broadcast",
    time: "dia",
    weather: "seco",
    mow: "stripes",
  },
  director: {
    label: "Alto · diretor · entardecer",
    seed: "graphics-director-v1",
    quality: "alta",
    camera: "director",
    time: "entardecer",
    weather: "molhado",
    mow: "diagonal",
  },
  cinema: {
    label: "Cinema · grua · noite",
    seed: "graphics-cinema-v1",
    quality: "cinema",
    camera: "cinematic",
    time: "noite",
    weather: "molhado",
    mow: "stripes",
  },
} as const satisfies Record<string, GraphicsBenchmarkScenario>;

export type GraphicsBenchmarkScenarioId = keyof typeof GRAPHICS_BENCHMARK_SCENARIOS;

export interface GraphicsBenchmarkMetadata {
  id: GraphicsBenchmarkScenarioId;
  label: string;
  seed: string;
  quality: BenchmarkQuality;
  /** The scenario's original camera before a user selects another lens. */
  presetCamera: CameraMode;
  /** The camera active when a FrameProbe sample is emitted. */
  camera: CameraMode;
  time: TimeOfDay;
  weather: Weather;
  mow: MowPattern;
  fixture: {
    homeClubId: "fla";
    awayClubId: "pal";
    label: "Flamengo x Palmeiras";
  };
  viewport: typeof GRAPHICS_BENCHMARK_VIEWPORT;
  requested: {
    scenario: string | null;
    seed: string | null;
    quality: string | null;
    camera: string | null;
  };
}

function scenarioIdFor(value: string | null): GraphicsBenchmarkScenarioId {
  return value && value in GRAPHICS_BENCHMARK_SCENARIOS
    ? (value as GraphicsBenchmarkScenarioId)
    : "baseline";
}

function qualityFor(value: string | null): BenchmarkQuality | null {
  return value === "baixa" || value === "media" || value === "alta" || value === "cinema"
    ? value
    : null;
}

function timeFor(value: string | null): TimeOfDay | null {
  return value === "dia" || value === "entardecer" || value === "noite" ? value : null;
}

function weatherFor(value: string | null): Weather | null {
  return value === "seco" || value === "molhado" || value === "chuva" || value === "neve"
    ? value
    : null;
}

function mowFor(value: string | null): MowPattern | null {
  return value && MOW_PATTERNS.includes(value as MowPattern) ? (value as MowPattern) : null;
}

function seedFor(value: string | null, fallback: string): string {
  // A bounded seed remains deterministic while preventing accidental giant
  // query strings from bloating screenshots, snapshots and benchmark output.
  const seed = value?.trim().slice(0, 96);
  return seed || fallback;
}

export function resolveGraphicsBenchmark(search: string): GraphicsBenchmarkMetadata {
  const params = new URLSearchParams(search);
  const id = scenarioIdFor(params.get("scenario"));
  const preset = GRAPHICS_BENCHMARK_SCENARIOS[id];
  const requestedCamera = params.get("camera");
  const camera = isCameraMode(requestedCamera) ? requestedCamera : preset.camera;

  return {
    id,
    label: preset.label,
    seed: seedFor(params.get("seed"), preset.seed),
    quality: qualityFor(params.get("quality")) ?? preset.quality,
    presetCamera: preset.camera,
    camera,
    time: timeFor(params.get("time")) ?? preset.time,
    weather: weatherFor(params.get("weather")) ?? preset.weather,
    mow: mowFor(params.get("mow")) ?? preset.mow,
    fixture: {
      homeClubId: "fla",
      awayClubId: "pal",
      label: "Flamengo x Palmeiras",
    },
    viewport: GRAPHICS_BENCHMARK_VIEWPORT,
    requested: {
      scenario: params.get("scenario"),
      seed: params.get("seed"),
      quality: params.get("quality"),
      camera: requestedCamera,
    },
  };
}
