import * as THREE from "three";

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
    roughness: 0.94 - wet * 0.16,
    metalness: 0,
    envMapIntensity: 0.32 + wet * 0.35,
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
    pitchPaintColor: { value: new THREE.Color("#d7ddd2") },
    pitchDetailRoughness: { value: options.microRoughness ?? null },
    pitchWet: { value: wet },
  };
  material.customProgramCacheKey = () =>
    `match-pitch-layers-v5:${options.mergeLayers !== false}:${Boolean(wear)}:${Boolean(markings)}:${Boolean(options.microRoughness)}`;
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
        uniform float pitchWet;`,
        )
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
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
          roughnessFactor = clamp(roughnessFactor + (1.0 - pitchWet) * 0.16, 0.48, 1.0);
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
