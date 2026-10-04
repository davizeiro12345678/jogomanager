/**
 * Métricas de transporte para snapshots ao vivo. A estimativa é deliberadamente
 * estrutural: mede o volume aproximado que o clone estruturado precisa levar
 * sem alocar uma string JSON inteira no caminho de telemetria.
 */
export interface SnapshotTransportMeasurement {
  estimatedSerializedBytes: number;
  intervalMs: number | null;
}

export interface SnapshotTelemetryTracker {
  sample(payload: unknown, receivedAt: number): SnapshotTransportMeasurement;
}

export const LIVE_MATCH_WORKER_TELEMETRY_NAME = "stadium-live-match-telemetry";
export const LIVE_MATCH_WORKER_TELEMETRY_MARK = "stadium.live-match.worker.snapshot";

function utf8ByteLength(value: string) {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

function estimateValue(value: unknown, seen: WeakSet<object>): number {
  if (value === null || value === undefined) return 1;
  switch (typeof value) {
    case "boolean":
      return 1;
    case "number":
      return 8;
    case "bigint":
      return 8 + value.toString().length;
    case "string":
      return 4 + utf8ByteLength(value);
    case "function":
    case "symbol":
      // Esses valores não aparecem nos snapshots, mas manter um tamanho zero
      // deixa a sonda defensiva caso um objeto de depuração seja informado.
      return 0;
  }

  if (ArrayBuffer.isView(value)) return 8 + value.byteLength;
  if (value instanceof ArrayBuffer) return 8 + value.byteLength;
  if (seen.has(value)) return 4;
  seen.add(value);

  if (Array.isArray(value)) {
    let bytes = 8;
    for (const item of value) bytes += estimateValue(item, seen);
    return bytes;
  }

  const record = value as Record<string, unknown>;
  let bytes = 8;
  for (const key of Object.keys(record)) {
    bytes += 4 + utf8ByteLength(key) + estimateValue(record[key], seen);
  }
  return bytes;
}

/** Retorna uma estimativa de bytes do clone estruturado sem serializar em JSON. */
export function estimateSerializedCloneBytes(value: unknown) {
  return estimateValue(value, new WeakSet());
}

/**
 * Cria estado local para um único lado da ponte. Não há estado global ou React
 * no caminho de snapshots; cada Worker/cliente mantém sua própria cadência.
 */
export function createSnapshotTelemetryTracker(): SnapshotTelemetryTracker {
  let previousAt: number | null = null;
  return {
    sample(payload, receivedAt) {
      const at = Number.isFinite(receivedAt) ? receivedAt : (previousAt ?? 0);
      const intervalMs = previousAt === null ? null : Math.max(0, at - previousAt);
      previousAt = at;
      return { estimatedSerializedBytes: estimateSerializedCloneBytes(payload), intervalMs };
    },
  };
}

/** Identifica respostas de snapshot sem ampliar o protocolo do Worker. */
export function isLiveSnapshotResponse(message: unknown): message is {
  type: "snapshot";
  snapshot: unknown;
} {
  if (!message || typeof message !== "object") return false;
  const candidate = message as { type?: unknown; snapshot?: unknown };
  return candidate.type === "snapshot" && candidate.snapshot !== undefined;
}

/** O nome do Worker é a chave opt-in; nenhuma propriedade é adicionada à mensagem. */
export function isLiveTelemetryWorker(name: unknown) {
  return name === LIVE_MATCH_WORKER_TELEMETRY_NAME;
}

/**
 * Publica um ponto User Timing quando suportado. O chamador limita a retenção
 * das marcas, porque uma partida longa pode gerar milhares de snapshots.
 */
export function markLiveWorkerSnapshot(measurement: SnapshotTransportMeasurement) {
  if (typeof performance === "undefined" || typeof performance.mark !== "function") return;
  try {
    performance.mark(LIVE_MATCH_WORKER_TELEMETRY_MARK, { detail: measurement });
  } catch {
    // Browsers antigos ainda recebem a marca, apenas sem o detalhe estruturado.
    try {
      performance.mark(LIVE_MATCH_WORKER_TELEMETRY_MARK);
    } catch {
      // Telemetria é observacional: falhas de User Timing não afetam o Worker.
    }
  }
}
