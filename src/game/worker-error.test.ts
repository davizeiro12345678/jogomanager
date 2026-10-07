import { describe, expect, it } from "vitest";

import { serializeWorkerError } from "./worker-error";

describe("serializeWorkerError", () => {
  it("preserves an ErrorEvent's diagnostic fields", () => {
    const payload = serializeWorkerError({
      type: "error",
      message: "falha no tick",
      filename: "match.worker.js",
      lineno: 12,
      colno: 4,
      error: new Error("falha no tick"),
    } as ErrorEvent);

    expect(payload).toMatchObject({
      kind: "error",
      message: "falha no tick",
      filename: "match.worker.js",
      lineno: 12,
      colno: 4,
    });
    expect(payload.stack).toContain("falha no tick");
  });

  it("makes messageerror and rejected reasons structured-clone safe", () => {
    const messageError = serializeWorkerError({
      type: "messageerror",
      data: { code: "bad-buffer", nested: BigInt(2) },
    } as MessageEvent);
    const rejection = serializeWorkerError({
      type: "unhandledrejection",
      reason: new Error("promise falhou"),
    } as PromiseRejectionEvent);

    expect(messageError).toMatchObject({ kind: "messageerror", message: "messageerror" });
    expect(JSON.stringify(messageError)).toContain("bad-buffer");
    expect(rejection).toMatchObject({ kind: "unhandledrejection", message: "promise falhou" });
    expect(JSON.stringify(rejection)).toContain("promise falhou");
  });
});
