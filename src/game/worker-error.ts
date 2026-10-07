export type WorkerErrorKind = "error" | "messageerror" | "unhandledrejection";

export type SerializableWorkerValue =
  | null
  | boolean
  | number
  | string
  | SerializableWorkerValue[]
  | { [key: string]: SerializableWorkerValue };

export type WorkerErrorPayload = {
  kind: WorkerErrorKind;
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  reason?: SerializableWorkerValue;
};

function serializable(value: unknown): SerializableWorkerValue {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(value.stack ? { stack: value.stack } : {}),
    };
  }
  try {
    const encoded = JSON.stringify(value, (_key, entry) =>
      typeof entry === "bigint" ? `${entry}n` : entry,
    );
    return encoded === undefined ? String(value) : (JSON.parse(encoded) as SerializableWorkerValue);
  } catch {
    return String(value);
  }
}

function errorMessage(value: unknown, fallback: string) {
  if (value instanceof Error) return value.message || fallback;
  return typeof value === "string" && value ? value : fallback;
}

export function serializeWorkerError(
  event: ErrorEvent | MessageEvent | PromiseRejectionEvent,
): WorkerErrorPayload {
  if (event.type === "error") {
    const errorEvent = event as ErrorEvent;
    const error = errorEvent.error;
    return {
      kind: "error",
      message: errorMessage(error, errorEvent.message || "Worker error"),
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
      ...(errorEvent.filename ? { filename: errorEvent.filename } : {}),
      ...(errorEvent.lineno ? { lineno: errorEvent.lineno } : {}),
      ...(errorEvent.colno ? { colno: errorEvent.colno } : {}),
    };
  }
  if (event.type === "messageerror") {
    const messageEvent = event as MessageEvent;
    return {
      kind: "messageerror",
      message: "messageerror",
      ...(messageEvent.data !== undefined ? { reason: serializable(messageEvent.data) } : {}),
    };
  }
  const rejection = event as PromiseRejectionEvent;
  const reason = serializable(rejection.reason);
  return {
    kind: "unhandledrejection",
    message: errorMessage(rejection.reason, "Unhandled worker rejection"),
    ...(rejection.reason instanceof Error && rejection.reason.stack
      ? { stack: rejection.reason.stack }
      : {}),
    reason,
  };
}
