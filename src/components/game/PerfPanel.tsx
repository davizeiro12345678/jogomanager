import { lazy, Suspense, useEffect, useState } from "react";

const Perf = lazy(() => import("r3f-perf").then((m) => ({ default: m.Perf })));

/** Painel de medição (r3f-perf): só na prévia com `?perf=1`; jogadores nunca o veem. */
export function PerfPanel() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(import.meta.env.DEV && new URLSearchParams(window.location.search).get("perf") === "1");
  }, []);
  if (!on) return null;
  return (
    <Suspense fallback={null}>
      <Perf position="top-left" minimal />
    </Suspense>
  );
}
