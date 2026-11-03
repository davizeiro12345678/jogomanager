import { lazy, Suspense, useState, type ComponentProps } from "react";
import { GraphicsBoundary } from "./GraphicsBoundary";
import { MatchLoading } from "./MatchLoading";
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
    <GraphicsBoundary key={attempt} fallback={<StadiumLoadFailed onRetry={retry} />}>
      <Suspense fallback={<MatchLoading />}>
        <Stadium {...props} />
      </Suspense>
    </GraphicsBoundary>
  );
}

function StadiumLoadFailed({ onRetry }: { onRetry: () => void }) {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  return (
    <div
      role="alert"
      className="flex h-full min-h-[70vh] flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground"
    >
      <strong className="font-display text-xl">O estádio não carregou</strong>
      <p className="max-w-sm text-sm text-muted-foreground">
        {offline
          ? "Você está sem internet. Conecte-se e toque em tentar de novo; a partida continua de onde parou."
          : "A conexão caiu no meio do download. Toque em tentar de novo; a partida continua de onde parou."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Tentar de novo
      </button>
    </div>
  );
}
