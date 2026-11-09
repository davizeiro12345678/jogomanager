import { lazy, Suspense } from "react";
import type { ComponentProps } from "react";
import type { FrameProbe as ProbeComponent } from "./FrameProbe";

const Probe = lazy(() => import("./FrameProbe").then((module) => ({ default: module.FrameProbe })));

/** Diagnostics must not hold the stadium's first render or its startup graph. */
export function FrameProbe(props: ComponentProps<typeof ProbeComponent>) {
  return (
    <Suspense fallback={null}>
      <Probe {...props} />
    </Suspense>
  );
}
