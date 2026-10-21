import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const { verified, insert, from } = vi.hoisted(() => ({
  verified: vi.fn(),
  insert: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: vi.fn(),
}));
vi.mock("./verified-identity.server", () => ({
  verifiedAccount: verified,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware: () => ({
      validator: (validate: (data: unknown) => unknown) => ({
        handler:
          (handle: (args: { data: unknown; context: unknown }) => unknown) =>
          async (args: { data: unknown; context: unknown }) =>
            handle({ ...args, data: validate(args.data) }),
      }),
    }),
  }),
}));

import { sendTechTelemetry } from "./telemetry.functions";

const sample = {
  fpsAvg: 60,
  frameTimeP95Ms: 16.6,
  browser: "chrome",
  gpuTier: 2,
  graphicsPreset: "auto",
  loadTimeMs: 1200,
  errorCode: null,
  appVersion: "1.0.0",
};
const telemetry = sendTechTelemetry as unknown as (args: {
  data: typeof sample;
  context: {
    supabase: { from: typeof from };
    userId: string;
  };
}) => Promise<{ ok: boolean; reason?: string; origin?: string }>;
const uid = "33c60d0e-2d21-4b98-9895-7dca36a5ca46";

beforeEach(() => {
  vi.resetAllMocks();
  from.mockReturnValue({ insert });
  insert.mockResolvedValue({ error: null });
});

describe("untrusted telemetry ingestion security", () => {
  it("does not insert data for unverified or missing identities", async () => {
    verified.mockResolvedValue(null);
    const response = await telemetry({
      data: sample,
      context: { supabase: { from }, userId: uid },
    });
    expect(response).toEqual({ ok: false, reason: "verification_required" });
    expect(from).not.toHaveBeenCalled();
  });

  it("uses the user's RLS-scoped client and labels metrics non-authoritative", async () => {
    verified.mockResolvedValue({ id: uid });
    const response = await telemetry({
      data: sample,
      context: { supabase: { from }, userId: uid },
    });
    expect(from).toHaveBeenCalledWith("tech_telemetry");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: uid, fps_avg: 60, frame_time_p95_ms: 16.6 }),
    );
    expect(response).toEqual({ ok: true, origin: "client_unverified" });
  });

  it("does not ignore the database per-hour quota", async () => {
    verified.mockResolvedValue({ id: uid });
    insert.mockResolvedValue({ error: { code: "23505" } });
    const response = await telemetry({
      data: sample,
      context: { supabase: { from }, userId: uid },
    });
    expect(response).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("rejects malformed performance values", async () => {
    verified.mockResolvedValue({ id: uid });
    await expect(
      telemetry({
        data: { ...sample, fpsAvg: 10_000 },
        context: { supabase: { from }, userId: uid },
      }),
    ).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });

  it("keeps the database restricted to untrusted self-owned hourly samples", () => {
    const migration = readFileSync(
      new URL(
        "../../supabase/migrations/20261020101601_restore_missing_security_contracts.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(migration).toContain("tech_telemetry_user_utc_hour");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("measurement_origin = 'client_unverified'");
    const source = readFileSync(new URL("./telemetry.functions.ts", import.meta.url), "utf8");
    expect(source).not.toContain('supabaseAdmin.from("tech_telemetry")');
    expect(source).toContain("requireSupabaseAuth");
  });
});
