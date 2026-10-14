import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());

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
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: vi.fn() }));

import { redeemCoupon } from "./coupons.functions";

type CouponContext = {
  data: { code: string };
  context: { supabase: { rpc: typeof rpc } };
};
const redeem = redeemCoupon as unknown as (args: CouponContext) => Promise<{
  ok: boolean;
  message?: string;
  description?: string;
  coins?: number;
  scoutReports?: number;
  trainingBoosts?: number;
}>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("coupon redemption boundary", () => {
  it("trims a valid code before the atomic redemption RPC and returns its rewards", async () => {
    rpc.mockResolvedValue({
      data: {
        ok: true,
        description: "Boas-vindas",
        coins: 250,
        scoutReports: 2,
        trainingBoosts: 1,
      },
      error: null,
    });

    const result = await redeem({
      data: { code: "  BEMVINDO  " },
      context: { supabase: { rpc } },
    });

    expect(rpc).toHaveBeenCalledWith("redeem_game_coupon", { _code: "BEMVINDO" });
    expect(result).toEqual({
      ok: true,
      description: "Boas-vindas",
      coins: 250,
      scoutReports: 2,
      trainingBoosts: 1,
    });
  });

  it.each([
    ["invalid", "Cupom não encontrado."],
    ["expired", "Este cupom não está valendo agora."],
    ["sold_out", "Este cupom já atingiu o limite de usos."],
    ["used", "Você já usou este cupom."],
    ["login", "Entre na sua conta para usar cupons."],
  ])("shows the safe message when the database rejects a coupon as %s", async (reason, message) => {
    rpc.mockResolvedValue({ data: { ok: false, reason }, error: null });

    const result = await redeem({
      data: { code: "BEMVINDO" },
      context: { supabase: { rpc } },
    });

    expect(result).toEqual({ ok: false, message });
  });

  it("rejects malformed coupon input before contacting Supabase", async () => {
    await expect(
      redeem({ data: { code: "<script>" }, context: { supabase: { rpc } } }),
    ).rejects.toThrow();

    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns a generic retry message when the redemption RPC fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    rpc.mockResolvedValue({ data: null, error: { message: "private database detail" } });

    const result = await redeem({
      data: { code: "BEMVINDO" },
      context: { supabase: { rpc } },
    });

    expect(result).toEqual({
      ok: false,
      message: "Não foi possível resgatar agora. Tente de novo.",
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
