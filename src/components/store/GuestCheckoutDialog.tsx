import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { startGuestCheckout } from "@/lib/guest-checkout.functions";
import { getStripe, getStripeEnvironment, type StripeEnv } from "@/lib/stripe";

export interface GuestCheckoutProduct {
  key: string;
  name: string;
  priceCents: number;
  currency: string;
}

function priceLabel(priceCents: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
  }).format(priceCents / 100);
}

function GuestEmbeddedCheckout({ clientSecret }: { clientSecret: string }) {
  const stripe = useMemo(() => getStripe(), []);
  const options = useMemo(() => ({ fetchClientSecret: async () => clientSecret }), [clientSecret]);

  return (
    <EmbeddedCheckoutProvider stripe={stripe} options={options}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}

/**
 * A checkout visitor supplies an email once. The browser keeps that email only
 * in session storage long enough to prefill the post-payment magic-link form;
 * the server persists a salted hash, never the raw address.
 */
export function GuestCheckoutDialog({
  product,
  open,
  onOpenChange,
}: {
  product: GuestCheckoutProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const start = useServerFn(startGuestCheckout);
  const [email, setEmail] = useState("");
  const [hasPurchaseConsent, setHasPurchaseConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const clientEnvironment = useMemo<StripeEnv | null>(() => {
    try {
      return getStripeEnvironment();
    } catch {
      return null;
    }
  }, []);
  const environmentLabel =
    clientEnvironment === "live" ? "pagamentos configurados" : "modo de teste";

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setError(null);
      setClientSecret(null);
      setHasPurchaseConsent(false);
    }
  }, [open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) return;
    if (!clientEnvironment) {
      setError("Esta versão não tem uma chave pública de pagamentos configurada.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await start({
        data: {
          productKey: product.key,
          email,
          hasPurchaseConsent,
          clientEnvironment,
        },
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (result.environment !== clientEnvironment) {
        setError("O ambiente da chave pública não corresponde ao checkout liberado pelo servidor.");
        return;
      }
      window.sessionStorage.setItem(`pfm3d.guest-checkout.${result.intentId}.email`, email.trim());
      setClientSecret(result.clientSecret);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir o checkout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={clientSecret ? "max-h-[92vh] max-w-3xl overflow-y-auto p-3 sm:p-5" : "max-w-lg"}
      >
        {clientSecret ? (
          <>
            <DialogHeader className="px-2 pt-2">
              <DialogTitle>Pagamento seguro em {environmentLabel}</DialogTitle>
              <DialogDescription>
                Depois do pagamento, envie o link de e-mail para vincular o item à sua conta.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-[28rem] overflow-hidden rounded-xl border border-border/60 bg-card">
              <GuestEmbeddedCheckout clientSecret={clientSecret} />
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Comprar como visitante</DialogTitle>
              <DialogDescription>
                {product
                  ? `${product.name} · ${priceLabel(product.priceCents, product.currency)}`
                  : "Confira a oferta antes de pagar."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Use um e-mail que você consiga abrir agora. Depois do pagamento, ele recebe um link
                seguro para criar ou vincular sua conta e entregar o item uma única vez.
              </p>
              <label className="block text-sm font-medium" htmlFor="guest-checkout-email">
                E-mail para receber a compra
              </label>
              <input
                id="guest-checkout-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@email.com"
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-secondary/25 p-3 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={hasPurchaseConsent}
                  onChange={(event) => setHasPurchaseConsent(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span>
                  Confirmo que tenho autorização para esta compra e aceito que ela seja vinculada ao
                  e-mail informado.
                </span>
              </label>
              {error ? (
                <p role="alert" aria-live="assertive" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                className="w-full"
                disabled={!product || busy || !hasPurchaseConsent || !clientEnvironment}
              >
                {busy ? "Preparando checkout…" : "Continuar para pagamento seguro"}
              </Button>
              {!clientEnvironment ? (
                <p role="status" className="text-center text-xs text-muted-foreground">
                  Esta versão não está configurada com uma chave pública da Stripe.
                </p>
              ) : null}
              <p className="text-center text-[11px] text-muted-foreground">
                A disponibilidade e o ambiente do checkout são confirmados pelo servidor antes de
                qualquer pagamento.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
