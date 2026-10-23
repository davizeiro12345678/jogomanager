import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";
import type { FrameProbe as Probe } from "./FrameProbe";
import { readConsent } from "@/lib/consent";
const FrameProbe = lazy(() => import("./FrameProbe").then((m) => ({ default: m.FrameProbe })));

/** Diagnostic inventories belong to the benchmark. Ordinary matches collect
 * optional telemetry only while the player has consented, including revocation. */
export function MatchFrameProbe(props: ComponentProps<typeof Probe>) {
  const benchmark =
    typeof location !== "undefined" && location.pathname.endsWith("/graphics-benchmark.html");
  const [consented, setConsented] = useState(() => readConsent().telemetry);
  useEffect(() => {
    const changed = () => setConsented(readConsent().telemetry);
    window.addEventListener("consent-changed", changed);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("consent-changed", changed);
      window.removeEventListener("storage", changed);
    };
  }, []);
  if (!benchmark && !consented) return null;
  return (
    <Suspense fallback={null}>
      <FrameProbe {...props} />
    </Suspense>
  );
}
