import * as THREE from "three";
import { FIELD_X, FIELD_Z } from "./sim-rules";

export type PitchSurfaceOptions = {
  albedo: THREE.Texture | null;
  roughness: THREE.Texture | null;
  microRoughness?: THREE.Texture | null;
  normal: THREE.Texture | null;
  normalScale: THREE.Vector2;
  markings: THREE.Texture | null;
  wear: THREE.Texture | null;
  wearOpacity: number;
  tint: THREE.Color;
  wet: number;
  high: boolean;
  /** Native WebGPU ignores GLSL onBeforeCompile; retain separate layers there. */
  mergeLayers?: boolean;
};

/** Soil wear, paint and turf share one opaque, shadow-receiving surface.
 * The old two transparent PBR overlays shaded the full pitch again for each
 * layer and produced depth conflicts in close views. Cached maps stay owned
 * by the texture cache; disposing this material never disposes those maps. */
export function createPitchSurfaceMaterial(options: PitchSurfaceOptions) {
  const { albedo, roughness, normal, normalScale, markings, wear, wearOpacity, tint, high } =
    options;
  const wet = THREE.MathUtils.clamp(options.wet, 0, 1);
  const parameters: THREE.MeshStandardMaterialParameters = {
    ...(albedo ? { map: albedo, color: tint } : { color: "#2a5c32" }),
    ...(roughness ? { roughnessMap: roughness } : {}),
    ...(normal ? { normalMap: normal, normalScale } : {}),
    roughness: 0.98 - wet * 0.16,
    metalness: 0,
    envMapIntensity: 0.24 + wet * 0.35,
  };
  const material =
    wet > 0.45
      ? new THREE.MeshPhysicalMaterial({
          ...parameters,
          clearcoat: wet * (high ? 0.22 : 0.18),
          clearcoatRoughness: 0.76 - wet * 0.32,
        })
      : new THREE.MeshStandardMaterial(parameters);
  const uniforms = {
    pitchWear: { value: wear },
    pitchWearOpacity: { value: THREE.MathUtils.clamp(wearOpacity, 0, 0.75) },
    pitchMarkings: { value: markings },
    pitchPaintColor: { value: new THREE.Color("#e1e5d9") },
    pitchSize: { value: new THREE.Vector2(FIELD_X * 2 + 10, FIELD_Z * 2 + 10) },
    pitchDetailRoughness: { value: options.microRoughness ?? null },
    pitchWet: { value: wet },
  };
  material.customProgramCacheKey = () =>
    `match-pitch-layers-v9:${options.mergeLayers !== false}:${Boolean(wear)}:${Boolean(markings)}:${Boolean(options.microRoughness)}`;
  if (options.mergeLayers !== false && (wear || markings || options.microRoughness))
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vPitchUv;")
        .replace("#include <uv_vertex>", "#include <uv_vertex>\nvPitchUv = uv;");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
        varying vec2 vPitchUv; uniform sampler2D pitchWear;
        uniform float pitchWearOpacity; uniform sampler2D pitchMarkings;
        uniform vec3 pitchPaintColor; uniform sampler2D pitchDetailRoughness;
        uniform float pitchWet; uniform vec2 pitchSize;
        // Smooth value noise, shared across pigment and fibre response. No
        // screen-space randomness: patches stay fixed as the camera moves.
        float pitchHash(vec2 p) {
          vec3 h = fract(vec3(p.xyx) * 0.1031);
          h += dot(h, h.yzx + 33.33);
          return fract((h.x + h.y) * h.z);
        }
        float pitchNoise(vec2 p) {
          vec2 cell = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(pitchHash(cell), pitchHash(cell + vec2(1.0, 0.0)), f.x),
                     mix(pitchHash(cell + vec2(0.0, 1.0)), pitchHash(cell + 1.0), f.x), f.y);
        }`,
        )
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
        // Broad turf variation survives the TV camera; fibre detail stays in
        // the existing normal/roughness maps instead of another render pass.
        // Preserve the authored mower pattern and its club tint. A small
        // pigment separation restores chlorophyll under the stadium's IBL.
        float turfLuminance = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb = max(vec3(0.0), mix(vec3(turfLuminance), diffuseColor.rgb, 1.08));
        vec2 turfMetres = (vPitchUv - 0.5) * pitchSize;
        float turfMacro = pitchNoise(turfMetres * 0.24) * 2.0 - 1.0;
        float turfMeso = pitchNoise(turfMetres * vec2(1.7, 2.9) + 13.4) * 2.0 - 1.0;
        diffuseColor.rgb *= 1.0 + turfMacro * 0.075 + turfMeso * 0.038;
        // Fibres resolve in a close camera and fade before becoming subpixel.
        // Analytical filtering prevents a sparkling carpet during camera cuts.
        // Irregular tufts replace the old sine lattice, which appeared as a
        // woven checker carpet in broadcast views. A derivative fade stops
        // the centimetre grain becoming moire in the far half of the pitch.
        vec2 fibreUv = turfMetres * vec2(19.0, 26.0);
        float fibreVisibility = 1.0 - smoothstep(0.25, 0.85, max(fwidth(fibreUv.x), fwidth(fibreUv.y)));
        float fibreGrain = pitchHash(floor(fibreUv)) * 2.0 - 1.0;
        diffuseColor.rgb *= 1.0 + fibreGrain * fibreVisibility * 0.095;
        // A narrow darker maintenance margin makes the actual 105 x 68 m
        // playing rectangle read at TV distance without widening its paint.
        vec2 fieldHalf = pitchSize * 0.5 - 5.0;
        float runoff = smoothstep(-0.18, 0.3, max(abs(turfMetres.x) - fieldHalf.x, abs(turfMetres.y) - fieldHalf.y));
        diffuseColor.rgb *= 1.0 - runoff * 0.16;
        ${
          wear
            ? `vec4 soil = texture2D(pitchWear, vPitchUv);
        // WebGL2 sRGB texture formats already decode soil/paint into linear light.
        diffuseColor.rgb = mix(diffuseColor.rgb, soil.rgb, soil.a * pitchWearOpacity);`
            : ""
        }
        ${
          markings
            ? `vec4 paint = texture2D(pitchMarkings, vPitchUv);
        float pitchPaintCoverage = paint.a;
        diffuseColor.rgb = mix(diffuseColor.rgb, paint.rgb * pitchPaintColor, pitchPaintCoverage);`
            : ""
        }`,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
          // A dry sports pitch has a broad fibre response, never a varnished
          // green floor. Retain the mower map; soil only affects worn patches.
          roughnessFactor = clamp(roughnessFactor + (1.0 - pitchWet) * 0.16 + turfMacro * pitchWet * 0.025, 0.48, 1.0);
          ${options.microRoughness ? "roughnessFactor *= 0.88 + 0.12 * texture2D(pitchDetailRoughness, vPitchUv * vec2(48.0, 32.0)).g;" : ""}
          ${wear ? "roughnessFactor = mix(roughnessFactor, 0.98 - pitchWet * 0.28, soil.a * pitchWearOpacity);" : ""}
          ${markings ? "roughnessFactor = mix(roughnessFactor, 0.94 - pitchWet * 0.08, pitchPaintCoverage);" : ""}`,
        )
        .replace(
          "#include <lights_physical_fragment>",
          `#include <lights_physical_fragment>
          #ifdef USE_CLEARCOAT
          // Water collects in worn soil. Grass fibres retain a broad response,
          // instead of coating the whole pitch like a varnished green floor.
          // Reuse soil and paint already sampled above: no extra texture fetch.
          material.clearcoat *= ${wear ? "mix(0.28, 0.9, clamp(soil.a * pitchWearOpacity * 2.0, 0.0, 1.0))" : "0.28"};
          ${markings ? "material.clearcoat *= 1.0 - pitchPaintCoverage * 0.45;" : ""}
          #endif`,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
          ${markings ? "normal = normalize(mix(normal, nonPerturbedNormal, pitchPaintCoverage * 0.6));" : ""}`,
        );
    };
  return material;
}
