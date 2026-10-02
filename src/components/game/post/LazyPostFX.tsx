import { lazy, Suspense, type ComponentProps } from "react";
import type { PostFX as PostEffectsComponent } from "./PostFX";

const PostEffects = lazy(() => import("./PostFX").then((module) => ({ default: module.PostFX })));

export type { PostMoment, PostQuality, PostTime } from "./PostFX";

/** Low quality and native WebGPU paths do not download WebGL postprocessing. */
export function PostFX(props: ComponentProps<typeof PostEffectsComponent>) {
  if (props.quality === "baixa") return null;
  return (
    <Suspense fallback={null}>
      <PostEffects {...props} />
    </Suspense>
  );
}
