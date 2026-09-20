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
    bloom: 0.14,
    bloomThreshold: 0.92,
    saturation: 0.045,
    hue: 0,
    brightness: 0.008,
    contrast: 0.055,
    vignette: 0.22,
    grain: 0.008,
    aberration: 0.0002,
    dof: 0,
    tilt: 0,
  },
  replay: {
    bloom: 0.58,
    bloomThreshold: 0.7,
    saturation: 0.14,
    hue: 0.002,
    brightness: -0.012,
    contrast: 0.16,
    vignette: 0.48,
    grain: 0.022,
    aberration: 0.00035,
    dof: 3.2,
    tilt: 0,
  },
  drama: {
    bloom: 0.78,
    bloomThreshold: 0.62,
    saturation: 0.18,
    hue: 0.008,
    brightness: -0.018,
    contrast: 0.2,
    vignette: 0.62,
    grain: 0.03,
    aberration: 0.00065,
    dof: 5.5,
    tilt: 0,
  },
};

/** Correção de cor por horário: manhã fria, entardecer quente, noite contrastada. */
const TIME_TINT: Record<PostTime, Partial<PostPreset>> = {
  dia: { saturation: 0.01, brightness: 0.008, contrast: 0.008 },
  entardecer: { saturation: 0.055, hue: 0.01, contrast: 0.022 },
  noite: { saturation: -0.012, brightness: -0.012, contrast: 0.045, bloom: 0.14 },
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
