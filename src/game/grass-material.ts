import * as THREE from "three";

export type GrassBladeMaterialOptions = Readonly<{
  /** WebGPURenderer does not execute GLSL `onBeforeCompile` hooks. */
  webgl2?: boolean;
}>;

/** One material for all field chunks. World-space wind is converted into each
 * blade's local orientation; root shading and distance fade need no textures. */
export function createGrassBladeMaterial(
  color = "#46824b",
  { webgl2 = true }: GrassBladeMaterialOptions = {},
) {
  const uniforms = {
    uTime: { value: 0 },
    uBall: { value: new THREE.Vector3() },
    uWind: { value: 1 },
    uWindDirection: { value: new THREE.Vector2(0.83, 0.55) },
    uPlayers: { value: Array.from({ length: 22 }, () => new THREE.Vector3(1000, 0, 1000)) },
    uPlayerCount: { value: 0 },
  };
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  material.customProgramCacheKey = () =>
    `match-grass-contact-wind-v3:${webgl2 ? "webgl2" : "webgpu-standard"}`;
  if (webgl2)
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
        uniform float uTime; uniform float uWind; uniform vec3 uBall;
        uniform vec2 uWindDirection; varying float vGrassHeight;`,
        )
        .replace(
          "varying float vGrassHeight;",
          "varying float vGrassHeight; uniform vec3 uPlayers[22]; uniform int uPlayerCount;",
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
        vec3 wp = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float h = clamp(position.y / 0.035, 0.0, 1.0);
        vGrassHeight = h;
        float fade = 1.0 - smoothstep(16.0, 29.0, distance(cameraPosition, wp));
        float travel = dot(wp.xz, uWindDirection);
        float gust = 0.65 + 0.25 * sin(uTime * 0.43 - travel * 0.055)
                         + 0.10 * sin(uTime * 0.91 + wp.z * 0.09);
        float w = sin(uTime * 1.7 - travel * 0.35)
                + 0.35 * sin(uTime * 3.1 - travel * 0.9);
        vec2 d = wp.xz - uBall.xz;
        float near = (1.0 - smoothstep(0.15, 1.25, length(d))) *
          (1.0 - smoothstep(0.25, 0.85, uBall.y));
        vec3 bend = vec3(uWindDirection.x, 0.0, uWindDirection.y) * w * gust * 0.007 * h * h * uWind;
        bend += vec3(normalize(d + vec2(0.0001)).x, 0.0, normalize(d + vec2(0.0001)).y) * near * 0.028 * h;
        float trample = 0.0;
        for (int i = 0; i < 22; i++) {
          if (i >= uPlayerCount) break;
          vec2 offset = wp.xz - uPlayers[i].xz;
          float contact = 1.0 - smoothstep(0.12, 0.56, length(offset));
          trample = max(trample, contact);
          bend.xz += normalize(offset + vec2(0.001)) * contact * 0.033 * h * h;
        }
        transformed += vec3(dot(bend, normalize(instanceMatrix[0].xyz)), 0.0,
                            dot(bend, normalize(instanceMatrix[2].xyz)));
        transformed.y = max(0.0, transformed.y - (near * 0.012 + trample * 0.025) * h) * fade;
        transformed.xz *= fade;`,
        )
        .replace(
          "#include <color_vertex>",
          `#include <color_vertex>
        vColor.rgb *= mix(vec3(0.48, 0.57, 0.42), vec3(1.08, 1.12, 0.91), clamp(position.y / 0.035, 0.0, 1.0));`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vGrassHeight;")
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * vGrassHeight * (gl_FrontFacing ? 0.025 : 0.14);`,
        );
    };
  return { material, uniforms };
}
