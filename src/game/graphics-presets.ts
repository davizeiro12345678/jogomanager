import type { VisualSettings } from "./visual-settings";

type QualityKey =
  | "quality"
  | "adaptive"
  | "textureDetail"
  | "playerDetail"
  | "grassDensity"
  | "crowdDensity"
  | "shadows"
  | "postFx"
  | "postIntensity"
  | "particles"
  | "resolutionScale";
type QualityPatch = Pick<VisualSettings, QualityKey>;

export const GRAPHICS_PRESETS = [
  {
    id: "performance",
    label: "Fluidez",
    detail: "Campo leve, menos efeitos e prioridade ao movimento.",
    patch: {
      quality: "baixa",
      adaptive: true,
      textureDetail: "media",
      playerDetail: "padrao",
      grassDensity: 0.25,
      crowdDensity: 0.4,
      shadows: "desligadas",
      postFx: false,
      postIntensity: 0.5,
      particles: 0.3,
      resolutionScale: 0.75,
    },
  },
  {
    id: "balanced",
    label: "Equilíbrio",
    detail: "Boa definição com grama, torcida e efeitos moderados.",
    patch: {
      quality: "media",
      adaptive: true,
      textureDetail: "alta",
      playerDetail: "padrao",
      grassDensity: 0.55,
      crowdDensity: 0.65,
      shadows: "auto",
      postFx: true,
      postIntensity: 0.72,
      particles: 0.6,
      resolutionScale: 0.9,
    },
  },
  {
    id: "broadcast",
    label: "Transmissão",
    detail: "Atletas detalhados, sombras e acabamento de televisão.",
    patch: {
      quality: "alta",
      adaptive: true,
      textureDetail: "alta",
      playerDetail: "detalhado",
      grassDensity: 0.85,
      crowdDensity: 0.9,
      shadows: "auto",
      postFx: true,
      postIntensity: 0.9,
      particles: 1,
      resolutionScale: 1,
    },
  },
  {
    id: "cinema",
    label: "Cinema",
    detail: "Máximo detalhe e resolução maior para aparelhos potentes.",
    patch: {
      quality: "cinema",
      adaptive: false,
      textureDetail: "alta",
      playerDetail: "detalhado",
      grassDensity: 1.15,
      crowdDensity: 1,
      shadows: "ligadas",
      postFx: true,
      postIntensity: 1.1,
      particles: 1,
      resolutionScale: 1.15,
    },
  },
] as const satisfies readonly {
  id: string;
  label: string;
  detail: string;
  patch: QualityPatch;
}[];

export type GraphicsPresetId = (typeof GRAPHICS_PRESETS)[number]["id"];

/** Only rendering preferences change. Club styling, weather and replay
 * camera choices belong to the player and survive every profile switch. */
export function graphicsPresetPatch(id: GraphicsPresetId): QualityPatch {
  return { ...GRAPHICS_PRESETS.find((preset) => preset.id === id)!.patch };
}

export function activeGraphicsPreset(settings: VisualSettings): GraphicsPresetId | null {
  return (
    GRAPHICS_PRESETS.find(({ patch }) =>
      (Object.keys(patch) as QualityKey[]).every((key) => settings[key] === patch[key]),
    )?.id ?? null
  );
}
