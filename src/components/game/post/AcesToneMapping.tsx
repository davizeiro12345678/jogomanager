import { useDisposable } from "../useDisposable";
import { createAcesToneMappingEffect } from "./aces-tone-mapping-effect";

/** Fixed ACES uses Three's own curve and renderer exposure. The general-purpose
 * ToneMappingEffect also allocates adaptive luminance targets we never use. */
export function AcesToneMapping() {
  const effect = useDisposable(createAcesToneMappingEffect, []);
  return <primitive object={effect} dispose={null} />;
}
