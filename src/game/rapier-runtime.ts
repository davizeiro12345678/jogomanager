import { init } from "@dimforge/rapier3d-compat";

let ready: Promise<void> | null = null;

/** All physics consumers share one WASM initialization and retry after failure. */
export function initializeRapier(): Promise<void> {
  ready ??= Promise.resolve()
    .then(() => init())
    .catch((error: unknown) => {
      ready = null;
      throw error;
    });
  return ready;
}
