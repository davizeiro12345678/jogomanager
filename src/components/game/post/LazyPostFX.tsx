import { lazy, Suspense, type ComponentProps } from "react";
import type { PostFX as PostEffectsComponent } from "./PostFX";
import { postPath } from "./post-policy";

const PostEffects = lazy(() => import("./PostFX").then((module) => ({ default: module.PostFX })));
const BalancedPostEffects = lazy(() => import("./BalancedPostFX"));

export type { PostMoment, PostQuality, PostTime } from "./PostFX";

/** Low quality and native WebGPU paths do not download WebGL postprocessing. */
export function PostFX(props: ComponentProps<typeof PostEffectsComponent>) {
  const path = postPath(
    props.quality,
    props.moment ?? (props.replay ? "replay" : "match"),
    props.cinematic ?? false,
    props.legacyMatchEffects,
  );
  if (path === "off") return null;
  const Effects = path === "cinema" ? PostEffects : BalancedPostEffects;
  return (
    <Suspense fallback={null}>
      <Effects {...props} />
    </Suspense>
  );
}
