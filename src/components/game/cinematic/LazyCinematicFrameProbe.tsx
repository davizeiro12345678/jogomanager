import { lazy, Suspense } from "react";
import type { ComponentProps } from "react";
import type { CinematicFrameProbe as ProbeComponent } from "./CinematicFrameProbe";

const Probe = lazy(() =>
  import("./CinematicFrameProbe").then((module) => ({ default: module.CinematicFrameProbe })),
);

/** Diagnostic instrumentation must not block the first cinematic frame. */
export function LazyCinematicFrameProbe(props: ComponentProps<typeof ProbeComponent>) {
  return (
    <Suspense fallback={null}>
      <Probe {...props} />
    </Suspense>
  );
}
