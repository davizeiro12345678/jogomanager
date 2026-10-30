import * as THREE from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import {
  attribute,
  float,
  instanceIndex,
  mix,
  positionLocal,
  sin,
  abs,
  cos,
  max,
  step,
  uniform,
  vec3,
  texture,
} from "three/tsl";

/** One set of GPU uniforms serves all instances of one crowd tier. The
 * native TSL vertex program is evaluated on the GPU, never by a CPU loop. */
export function createNativeCrowdMotionMaterial(tier: number, card: THREE.Texture) {
  const clock = uniform(0);
  const pulse = uniform(0);
  const wave = uniform(0);
  const agitation = uniform(0);
  const material = new MeshStandardNodeMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.93,
    ...(tier === 2 ? { map: card, alphaTest: 0.4 } : {}),
  });
  const style = attribute("crowdStyle", "vec2");
  const region = attribute("crowdRegion", "float");
  const limb = attribute("crowdLimb", "vec2");
  const skin = attribute("crowdSkin", "vec3");
  const shirt = attribute("instanceColor", "vec3");
  // A seat's pooled slot supplies a stable phase for the current selection.
  const phase = float(instanceIndex).mul(0.6180339);
  const energy = pulse.clamp(0, 1);
  const local = positionLocal;
  const swayX = sin(clock.mul(1.7).add(phase))
    .mul(0.035)
    .mul(max(0, local.y.add(0.6)));
  const swayZ = sin(clock.mul(5.2).add(phase))
    .mul(agitation.mul(0.05))
    .mul(max(0, local.y.add(0.6)));
  const bounce = abs(sin(clock.mul(float(5.8).add(style.x)).add(phase))).mul(energy.mul(0.24));
  const waveLift = sin(wave.add(phase.mul(0.08)))
    .mul(0.04)
    .mul(energy);
  if (tier < 2) {
    const clap = step(0.34, style.y).sub(step(0.68, style.y));
    const raised = energy.mul(float(0.72).add(sin(clock.mul(2).add(phase)).mul(0.28)));
    const turn = limb.x.mul(
      float(0.08)
        .mul(sin(clock.mul(1.1).add(phase)))
        .add(raised.mul(mix(2.55, 0.2, clap))),
    );
    // Two arm sections use separate pivots; tier-2 cards do not.
    const isArm = step(0.5, limb.y);
    const upper = vec3(local.x.sub(limb.x.mul(0.21)), local.y.sub(0.25), local.z);
    const rotatedX = upper.x
      .mul(cos(turn))
      .sub(upper.y.mul(sin(turn)))
      .add(limb.x.mul(0.21));
    const rotatedY = upper.x
      .mul(sin(turn))
      .add(upper.y.mul(cos(turn)))
      .add(0.25);
    const articulated = mix(local, vec3(rotatedX, rotatedY, local.z), isArm);
    material.positionNode = vec3(
      articulated.x.add(swayX),
      articulated.y.add(bounce).add(waveLift),
      articulated.z.add(swayZ),
    );
    const face = step(0.5, region).mul(float(1).sub(step(1.5, region)));
    const hair = step(1.5, region).mul(float(1).sub(step(2.5, region)));
    const shorts = step(2.5, region).mul(float(1).sub(step(3.5, region)));
    const hairColor = mix(vec3(0.021, 0.035, 0.049), vec3(0.15, 0.18, 0.22), style.x);
    material.colorNode = mix(
      mix(mix(shirt, skin, face), hairColor, hair),
      vec3(0.028, 0.043, 0.06),
      shorts,
    );
  } else {
    material.positionNode = vec3(
      local.x.add(swayX),
      local.y.add(bounce).add(waveLift),
      local.z.add(swayZ),
    );
    const head = step(0.7, attribute("uv", "vec2").y);
    // colorNode bypasses the map color; retain billboard alpha explicitly.
    material.opacityNode = texture(card).a;
    material.colorNode = mix(shirt, skin, head);
  }
  return { material, uniforms: { clock, pulse, wave, agitation } };
}
