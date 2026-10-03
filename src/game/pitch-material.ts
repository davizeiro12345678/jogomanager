import * as THREE from "three";

export type PitchSurfaceOptions = {
  albedo: THREE.Texture | null;
  roughness: THREE.Texture | null;
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
    ...(albedo ? { map: albedo, color: tint } : { color: "#1d7a45" }),
    ...(roughness ? { roughnessMap: roughness } : {}),
    ...(normal ? { normalMap: normal, normalScale } : {}),
    roughness: 0.94 - wet * 0.22,
    metalness: 0,
    envMapIntensity: 0.32 + wet * 0.35,
  };
  const material =
    wet > 0.45
      ? new THREE.MeshPhysicalMaterial({
          ...parameters,
          clearcoat: wet * (high ? 0.22 : 0.18),
          clearcoatRoughness: 0.72 - wet * 0.48,
        })
      : new THREE.MeshStandardMaterial(parameters);
  const uniforms = {
    pitchWear: { value: wear },
    pitchWearOpacity: { value: THREE.MathUtils.clamp(wearOpacity, 0, 0.75) },
    pitchMarkings: { value: markings },
    pitchPaintColor: { value: new THREE.Color("#c9cec6") },
  };
  material.customProgramCacheKey = () =>
    `match-pitch-layers-v1:${Boolean(wear)}:${Boolean(markings)}`;
  if (options.mergeLayers !== false && (wear || markings))
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
        uniform vec3 pitchPaintColor;`,
        )
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
        ${
          wear
            ? `vec4 soil = texture2D(pitchWear, vPitchUv);
        diffuseColor.rgb = mix(diffuseColor.rgb, soil.rgb, soil.a * pitchWearOpacity);`
            : ""
        }
        ${
          markings
            ? `vec4 paint = texture2D(pitchMarkings, vPitchUv);
        diffuseColor.rgb = mix(diffuseColor.rgb, paint.rgb * pitchPaintColor, paint.a);`
            : ""
        }`,
        );
    };
  return material;
}
