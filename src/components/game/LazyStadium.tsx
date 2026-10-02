import { lazy, Suspense, type ComponentProps } from "react";
import { MatchLoading } from "./MatchLoading";
import type { Stadium3D as StadiumComponent } from "./Stadium3D";

const Stadium = lazy(() => import("./Stadium3D").then((module) => ({ default: module.Stadium3D })));

export type { CameraMode, Quality } from "./Stadium3D";

/** Career preparation and dialogue do not need the stadium renderer yet. */
export function Stadium3D(props: ComponentProps<typeof StadiumComponent>) {
  return (
    <Suspense fallback={<MatchLoading />}>
      <Stadium {...props} />
    </Suspense>
  );
}
