import { useEffect, useState, type ComponentProps } from "react";
import type { FrameProbe as Probe } from "./FrameProbe";
import { readConsent } from "@/lib/consent";

/** Diagnostic inventories belong to the benchmark. Ordinary matches collect
 * optional telemetry only while the player has consented, including revocation. */
export function MatchFrameProbe(props: ComponentProps<typeof Probe>) {
  const benchmark =
    typeof location !== "undefined" && location.pathname.endsWith("/graphics-benchmark.html");
  const [consented, setConsented] = useState(() => readConsent().telemetry);
  const [ProbeComponent, setProbeComponent] = useState<typeof Probe | null>(null);
  useEffect(() => {
    if (!benchmark && !consented) return;
    let active = true;
    // Optional diagnostics must not suspend the Canvas while its initial scene
    // is committing. Mount the probe only after the module has fully loaded.
    void import("./FrameProbe")
      .then((module) => {
        if (active) setProbeComponent(() => module.FrameProbe);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [benchmark, consented]);
  useEffect(() => {
    const changed = () => setConsented(readConsent().telemetry);
    window.addEventListener("consent-changed", changed);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("consent-changed", changed);
      window.removeEventListener("storage", changed);
    };
  }, []);
  if ((!benchmark && !consented) || !ProbeComponent) return null;
  return <ProbeComponent {...props} />;
}
