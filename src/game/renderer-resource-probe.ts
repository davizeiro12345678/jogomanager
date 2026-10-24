/** Opt-in benchmark diagnostics. No timer or work until the harness requests it. */
export const RESOURCE_PROBE_REQUEST = "graphics-resource-request";
export const RESOURCE_PROBE_SNAPSHOT = "graphics-resource-snapshot";
export function installRendererResourceProbe(
  target: EventTarget,
  capture: () => Record<string, unknown>,
) {
  const sample = () => {
    target.dispatchEvent(new CustomEvent(RESOURCE_PROBE_SNAPSHOT, { detail: capture() }));
  };
  target.addEventListener(RESOURCE_PROBE_REQUEST, sample);
  return () => target.removeEventListener(RESOURCE_PROBE_REQUEST, sample);
}
