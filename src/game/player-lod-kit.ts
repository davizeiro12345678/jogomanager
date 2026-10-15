import * as THREE from "three";
import type { KitPattern } from "./kits";

export function lowKitPattern(pattern: KitPattern): number {
  return (
    (
      {
        stripes: 1,
        pin: 1,
        hoops: 2,
        band: 3,
        sash: 4,
        diagonal: 4,
        halves: 5,
        quarters: 6,
        checks: 6,
        chevron: 7,
      } as Partial<Record<KitPattern, number>>
    )[pattern] ?? 0
  );
}

/** Club patterns survive the distant instance path without 22 texture atlases
 * or extra meshes. Derivative filtering suppresses shimmer in wide cameras. */
export function applyLowKitShader(material: THREE.MeshStandardMaterial) {
  material.customProgramCacheKey = () => "instanced-club-kit-v1";
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec4 lowKit; varying vec4 vLowKit; varying vec2 vLowKitUv;",
      )
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvLowKit = lowKit; vLowKitUv = uv;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec4 vLowKit; varying vec2 vLowKitUv;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float pattern = vLowKit.a;
        float stripe = 0.0;
        float coordinate = vLowKitUv.x * 8.0;
        if (pattern > 1.5 && pattern < 2.5) coordinate = vLowKitUv.y * 6.0;
        float wave = sin(coordinate * 6.2831853);
        float filterWidth = max(fwidth(coordinate) * 6.2831853, 0.04);
        if (pattern > 0.5 && pattern < 2.5) stripe = smoothstep(-filterWidth, filterWidth, wave);
        if (pattern > 2.5 && pattern < 3.5) stripe = 1.0 - smoothstep(0.12, 0.15, abs(vLowKitUv.y - 0.58));
        if (pattern > 3.5 && pattern < 4.5) stripe = 1.0 - smoothstep(0.08, 0.11, abs(vLowKitUv.y - vLowKitUv.x));
        if (pattern > 4.5 && pattern < 5.5) stripe = smoothstep(0.49, 0.51, vLowKitUv.x);
        if (pattern > 5.5 && pattern < 6.5) stripe = smoothstep(-filterWidth, filterWidth, sin(vLowKitUv.x * 12.56637) * sin(vLowKitUv.y * 12.56637));
        if (pattern > 6.5) stripe = 1.0 - smoothstep(0.045, 0.075, abs(vLowKitUv.y - (0.48 + abs(vLowKitUv.x - 0.5) * 0.6)));
        diffuseColor.rgb = mix(diffuseColor.rgb, vLowKit.rgb, stripe * 0.88);
      `,
      );
  };
}
