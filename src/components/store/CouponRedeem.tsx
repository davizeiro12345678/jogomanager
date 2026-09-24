import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Ticket } from "lucide-react";
import { toast } from "sonner";

import { redeemCoupon } from "@/lib/coupons.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Campo de cupom: o servidor valida e credita, uma vez por conta. */
export function CouponRedeem({ onRedeemed }: { onRedeemed: () => void }) {
  const redeem = useServerFn(redeemCoupon);
  const [code, setCode] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isBusy || code.trim().length < 3) return;
    setIsBusy(true);
    try {
      const r = await redeem({ data: { code } });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      const parts = [
        r.coins && `${r.coins} moedas`,
        r.scoutReports && `${r.scoutReports} relatórios`,
        r.trainingBoosts && `${r.trainingBoosts} treinos`,
      ].filter(Boolean);
      toast.success(`${r.description}: ${parts.join(", ")}`);
      setCode("");
      onRedeemed();
    } catch {
      toast.error("Não foi possível resgatar agora. Tente de novo.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 surface-card p-4"
    >
      <Ticket className="text-primary" size={18} aria-hidden />
      <label htmlFor="coupon-code" className="font-display text-sm uppercase tracking-wide">
        Cupom
      </label>
      <Input
        id="coupon-code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Ex.: BEMVINDO"
        maxLength={24}
        autoComplete="off"
        className="h-9 min-w-0 flex-1 uppercase"
      />
      <Button type="submit" size="sm" disabled={isBusy || code.trim().length < 3}>
        {isBusy ? "Resgatando…" : "Resgatar"}
      </Button>
    </form>
  );
}
