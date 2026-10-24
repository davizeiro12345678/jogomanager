import * as THREE from "three";

export type LowClothKind = "torso" | "shorts";
const CAPACITY = 22;

/** Prefer the retained path where local native-GPU trials showed no gain.
 * Attribute capacity alone does not prove that the affine path is faster. */
export function supportsAffinePlayerCloth(renderer: string, attributes: number) {
  return (
    attributes >= 16 &&
    renderer.length > 0 &&
    !/Intel.*Iris.*Xe|SwiftShader|llvmpipe|Software Rasterizer/i.test(renderer)
  );
}

/** The old morph bases describe affine joint transforms. Three vec4 columns
 * per joint carry those same coefficients without a texture fetch per target
 * and vertex. Six attributes plus ordinary instancing fit WebGL2's 16 slots. */
export function prepareLowClothGeometry(geometry: THREE.BufferGeometry, kind: LowClothKind) {
  const columns = kind === "torso" ? 3 : 6;
  for (let column = 0; column < columns; column++) {
    const attribute = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(`lowCloth${column}`, attribute);
  }
  geometry.userData["lowClothKind"] = kind;
  return geometry;
}

export function writeLowClothPose(
  geometry: THREE.BufferGeometry,
  instance: number,
  weights: ArrayLike<number>,
  kind: LowClothKind,
) {
  const columns = kind === "torso" ? 3 : 6;
  for (let column = 0; column < columns; column++) {
    const attribute = geometry.getAttribute(`lowCloth${column}`) as THREE.InstancedBufferAttribute;
    attribute.setXYZW(
      instance,
      weights[column * 3]!,
      weights[column * 3 + 1]!,
      weights[column * 3 + 2]!,
      kind === "torso" ? weights[9 + column]! : 0,
    );
    // Each attribute is only 352 bytes at squad capacity. Uploading that fixed
    // buffer avoids per-player range objects and a merge/sort every frame.
    attribute.needsUpdate = true;
  }
}

/** Compose after kit pattern injection; the public Three.js shader chunks
 * retain their light, fog, tone mapping and backend ownership. */
export function applyLowClothShader(material: THREE.MeshStandardMaterial, kind: LowClothKind) {
  const original = material.onBeforeCompile;
  const originalKey = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${originalKey.call(material)}:affine-cloth-${kind}-v1`;
  const scale = kind === "torso" ? [0.5, 0.55, 0.3] : [0.255, 0.14, 0.255];
  const normalColumns = scale.map(
    (source) =>
      `vec3(${scale.map((destination) => ((destination / source) ** 2).toFixed(10)).join(",")})`,
  );
  const columns = kind === "torso" ? 3 : 6;
  material.onBeforeCompile = (shader, renderer) => {
    original.call(material, shader, renderer);
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
      ${Array.from({ length: columns }, (_, i) => `attribute vec4 lowCloth${i};`).join("\n")}
      mat3 lowClothNormal(mat3 d) {
        return mat3(d[0] * ${normalColumns[0]}, d[1] * ${normalColumns[1]}, d[2] * ${normalColumns[2]});
      }
    `,
    );
    const matrices = `mat3 clothL = mat3(lowCloth0.xyz, lowCloth1.xyz, lowCloth2.xyz);`;
    if (kind === "torso") {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <beginnormal_vertex>",
          `#include <beginnormal_vertex>
          ${matrices}
          float clothWeight = smoothstep(-0.12, 0.32, position.y);
          objectNormal += clothWeight * lowClothNormal(clothL) * normal;
        `,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          transformed += clothWeight * (clothL * position + vec3(lowCloth0.w, lowCloth1.w, lowCloth2.w));
        `,
        );
    } else {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <beginnormal_vertex>",
          `#include <beginnormal_vertex>
          ${matrices}
          mat3 clothR = mat3(lowCloth3.xyz, lowCloth4.xyz, lowCloth5.xyz);
          float clothWeight = 1.0 - smoothstep(-0.85, 0.1, position.y);
          float clothLeft = smoothstep(-0.12, 0.12, position.x);
          objectNormal += clothWeight * (clothLeft * lowClothNormal(clothL) * normal +
            (1.0 - clothLeft) * lowClothNormal(clothR) * normal);
        `,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          transformed += clothWeight * (clothLeft * clothL * (position - vec3(0.36, -0.4, 0.0)) +
            (1.0 - clothLeft) * clothR * (position - vec3(-0.36, -0.4, 0.0)));
        `,
        );
    }
  };
}
