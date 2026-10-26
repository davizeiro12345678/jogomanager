import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { redactDiagnosticText } from "./error-redaction";

let capture: typeof import("./error-capture");
let originalConsoleError: typeof console.error;
const output = vi.fn();

beforeAll(async () => {
  originalConsoleError = console.error;
  console.error = output;
  capture = await import("./error-capture");
});
afterEach(() => {
  output.mockClear();
  capture.consumeLastCapturedError();
});
afterAll(() => {
  console.error = originalConsoleError;
});

describe("server error diagnostics", () => {
  it("redacts URL secrets, authorization and nested causes while retaining stacks and status", () => {
    const clientSecret = "qa-synthetic-client-secret-stack";
    const bearer = "qa-synthetic-bearer-stack+punctuation/value";
    const cause = new Error(`Authorization: Bearer ${bearer}`);
    cause.stack = `Error: Authorization: Bearer ${bearer}\n    at fetchProvider (/src/provider.ts:12:7)`;
    const error = Object.assign(
      new Error(`https://api.example.test/?client_secret=${clientSecret}`, { cause }),
      { status: 502 },
    );
    error.stack = `Error: https://api.example.test/?client_secret=${clientSecret}\n    at startCheckout (/src/checkout.ts:42:9)`;

    const result = capture.describeError(error);

    expect(result).not.toContain(clientSecret);
    expect(result).not.toContain(bearer);
    expect(result).toContain("at startCheckout (/src/checkout.ts:42:9)");
    expect(result).toContain("at fetchProvider (/src/provider.ts:12:7)");
    expect(result).toContain("caused by: ");
    expect(result).toContain("(status 502)");
    expect(error.stack).toContain(clientSecret);
    expect(cause.stack).toContain(bearer);
    expect(error.status).toBe(502);
  });

  it("sanitizes Error, string and structured context before forwarding console output", () => {
    const clientSecret = "qa-synthetic-console-secret";
    const basic = "qa-synthetic-basic-credential==";
    const apiKey = "qa-synthetic-api-key-value";
    const error = Object.assign(new Error(`client_secret=${clientSecret}`), { statusCode: 503 });
    console.error(error, `Authorization: Basic ${basic}`, {
      api_key: apiKey,
      password: "qa synthetic password with spaces",
      attempt: 2,
    });

    const serialized = JSON.stringify(output.mock.calls);
    for (const secret of [clientSecret, basic, apiKey, "qa synthetic password with spaces"])
      expect(serialized).not.toContain(secret);
    expect(serialized).toContain("status 503");
    expect(serialized).toContain("attempt");
    expect(capture.consumeLastCapturedError()).toBe(error);
    expect(capture.consumeLastCapturedError()).toBeUndefined();
  });

  it("applies both diagnostic limits and preserves harmless names containing destroy", () => {
    const text = "Destroy United\n" + "a".repeat(9_000);
    expect(redactDiagnosticText(text)).toHaveLength(320);
    expect(capture.describeError(text)).toHaveLength(8_000);
    expect(capture.describeError(text)).toContain("Destroy United");
  });

  it("redacts the whole quoted password when the limit cuts its value or an escape sequence", () => {
    for (const quote of ["'", '"']) {
      const prefix = `diagnostic password=${quote}`;
      const escapedPrefix = "synthetic multi word \\";
      const source = `${prefix}${escapedPrefix}${quote} quoted tail ${"more words ".repeat(100)}${quote} public`;
      for (const maximumLength of [
        prefix.length + escapedPrefix.length + 10,
        prefix.length + escapedPrefix.length,
        prefix.length + escapedPrefix.length + 1,
      ]) {
        const result = redactDiagnosticText(source, maximumLength);
        expect(result).toBe(`${prefix}[redacted]${quote}`);
        expect(result).not.toContain("synthetic");
        expect(result).not.toContain("multi word");
        expect(result).not.toContain("quoted tail");
      }
    }
  });

  it("keeps cyclic or hostile error causes from throwing in the console wrapper", () => {
    const cycle = new Error("Cycle");
    cycle.cause = cycle;
    expect(capture.describeError(cycle).length).toBeLessThanOrEqual(8_000);
    const hostile = new Error("Hostile");
    Object.defineProperty(hostile, "stack", {
      get() {
        throw new Error("synthetic getter failure");
      },
    });
    expect(() => console.error(hostile)).not.toThrow();
    expect(output).toHaveBeenCalled();
  });
});
