/**
 * Presets de imagem da "transmissão".
 *
 * Separado do componente para que a calibração de cor, granulado, vinheta e
 * bloom fique num lugar só — e para que o preset mude de forma suave, sem
 * recriar o composer a cada quadro.
 */

export type PostQuality = "alta" | "media" | "baixa";
export type PostMoment = "match" | "replay" | "drama";
export type PostTime = "dia" | "entardecer" | "noite";

export type PostPreset = {
  bloom: number;
  bloomThreshold: number;
  saturation: number;
  hue: number;
  brightness: number;
  contrast: number;
  vignette: number;
  grain: number;
  aberration: number;
  dof: number; // 0 = sem foco seletivo
  tilt: number;
};

const BASE: Record<PostMoment, PostPreset> = {
  match: {
    bloom: 0.55,
    bloomThreshold: 0.7,
    saturation: 0.13,
    hue: 0,
    brightness: 0.012,
    contrast: 0.11,
    vignette: 0.58,
    grain: 0.018,
    aberration: 0.0006,
    dof: 0,
    tilt: 0.09,
  },
  replay: {
    bloom: 0.95,
    bloomThreshold: 0.58,
    saturation: 0.24,
    hue: 0.004,
    brightness: -0.02,
    contrast: 0.22,
    vignette: 0.88,
    grain: 0.055,
    aberration: 0.0009,
    dof: 3.2,
    tilt: 0,
  },
  drama: {
    bloom: 1.25,
    bloomThreshold: 0.5,
    saturation: 0.3,
    hue: 0.02,
    brightness: -0.03,
    contrast: 0.28,
    vignette: 0.95,
    grain: 0.07,
    aberration: 0.0018,
    dof: 5.5,
    tilt: 0,
  },
};

/** Correção de cor por horário: manhã fria, entardecer quente, noite contrastada. */
const TIME_TINT: Record<PostTime, Partial<PostPreset>> = {
  dia: { saturation: 0.02, brightness: 0.01, contrast: 0.01 },
  entardecer: { saturation: 0.08, hue: 0.015, contrast: 0.03 },
  noite: { saturation: -0.02, brightness: -0.015, contrast: 0.06, bloom: 0.25 },
};

/** Preset final combinando momento, horário e nível de qualidade. */
export function postPreset(
  quality: PostQuality,
  moment: PostMoment,
  time: PostTime,
  intensity = 1,
): PostPreset {
  const base = BASE[moment];
  const tint = TIME_TINT[time];
  const p: PostPreset = {
    ...base,
    bloom: base.bloom + (tint.bloom ?? 0),
    saturation: base.saturation + (tint.saturation ?? 0),
    hue: base.hue + (tint.hue ?? 0),
    brightness: base.brightness + (tint.brightness ?? 0),
    contrast: base.contrast + (tint.contrast ?? 0),
  };
  if (quality === "media") {
    // celular: metade dos efeitos, sem foco seletivo nem grão pesado
    p.bloom *= 0.6;
    p.grain *= 0.4;
    p.aberration *= 0.4;
    p.dof = 0;
    p.tilt = 0;
    p.vignette *= 0.85;
  }
  const amount = Math.max(0.2, Math.min(1.4, intensity));
  p.bloom *= amount;
  p.saturation *= amount;
  p.brightness *= amount;
  p.contrast *= amount;
  p.vignette *= amount;
  p.grain *= amount;
  p.aberration *= amount;
  p.dof *= amount;
  p.tilt *= amount;
  return p;
}
