import { lazy, Suspense, useState, type ComponentProps } from "react";
import { GraphicsBoundary } from "./GraphicsBoundary";
import { MatchLoading } from "./MatchLoading";
import { MatchPitchFallback } from "./MatchMinimap";
import type { Stadium3D as StadiumComponent } from "./Stadium3D";
import { preloadStadium } from "./stadium-loading";

export type { CameraMode, Quality } from "./Stadium3D";

/**
 * React.lazy keeps a rejected download forever, so a retry needs a fresh lazy
 * component; preloadStadium already forgets the failed request.
 */
function makeStadium() {
  return lazy(() => preloadStadium().then((module) => ({ default: module.Stadium3D })));
}

/** Career preparation and dialogue do not need the stadium renderer yet. */
export function Stadium3D(props: ComponentProps<typeof StadiumComponent>) {
  const [attempt, setAttempt] = useState(0);
  const [Stadium, setStadium] = useState(makeStadium);
  const retry = () => {
    setStadium(makeStadium);
    setAttempt((n) => n + 1);
  };
  return (
    <GraphicsBoundary
      key={attempt}
      fallback={
        <MatchPitchFallback view={props.sim} paused={props.paused ?? false} onRetry={retry} />
      }
    >
      <Suspense fallback={<MatchLoading />}>
        <Stadium {...props} />
      </Suspense>
    </GraphicsBoundary>
  );
}
