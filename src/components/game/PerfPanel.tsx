import { lazy, Suspense, useEffect, useState } from "react";

const Perf = lazy(() => import("./PerformanceStats"));

/** Local opt-in diagnostics; player-facing performance probes remain unchanged. */
export function PerfPanel() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(import.meta.env.DEV && new URLSearchParams(window.location.search).get("perf") === "1");
  }, []);
  if (!on) return null;
  return (
    <Suspense fallback={null}>
      <Perf />
    </Suspense>
  );
}
