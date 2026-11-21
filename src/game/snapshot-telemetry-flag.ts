export const LIVE_MATCH_WORKER_TELEMETRY_NAME = "stadium-live-match-telemetry";

/** O nome do Worker ativa a sonda sem alterar o protocolo. */
export function isLiveTelemetryWorker(name: unknown) {
  return name === LIVE_MATCH_WORKER_TELEMETRY_NAME;
}
