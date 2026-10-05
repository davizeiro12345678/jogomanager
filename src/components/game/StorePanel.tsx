import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Coins, Sparkles, Crown, Package, Search, Dumbbell, Palette } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { getCheckoutAvailability } from "@/lib/payments-status.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { withPaymentTimeout } from "@/lib/embedded-checkout";
import { salePrice, useStoreCatalog } from "@/hooks/useStoreCatalog";
import { CouponRedeem } from "@/components/store/CouponRedeem";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useSubscription, isSubscriptionActive } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import {
  GuestCheckoutDialog,
  type GuestCheckoutProduct,
} from "@/components/store/GuestCheckoutDialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { recordAdMetric } from "@/features/ads/ad-manager";

interface Wallet {
  coins: number;
  season_pass: boolean;
  season_pass_until: string | null;
  scout_reports: number;
  training_boosts: number;
  unlocked_themes: string[];
}

function formatBRL(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency || "BRL",
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toLocaleString("pt-BR")} ${currency || "BRL"}`;
  }
}

const KIND_LABELS: Record<string, string> = {
  coins: "Moedas",
  scout: "Olheiros",
  training: "Treino",
  cosmetic: "Cosmético",
  pass: "Passe de temporada",
};

const KIND_ICONS: Record<string, ReactNode> = {
  coins: <Coins size={16} />,
  scout: <Search size={16} />,
  training: <Dumbbell size={16} />,
  cosmetic: <Palette size={16} />,
  pass: <Crown size={16} />,
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * Vitrine da loja reutilizável: usada na página /loja e dentro da partida.
 * `columns` deixa o layout de uma coluna quando aparece numa gaveta estreita.
 */
export function StorePanel({ next = "/loja", columns = 2 }: { next?: string; columns?: 1 | 2 }) {
  const userId = useAuthUserId();
  const signedIn = userId === undefined ? null : userId !== null;
  const fetchAvailability = useServerFn(getCheckoutAvailability);
  const availability = useQuery({
    queryKey: ["checkout-availability"],
    queryFn: () => withPaymentTimeout(fetchAvailability()),
    staleTime: 30_000,
    retry: 1,
  });
  let matchingEnvironment = false;
  try {
    matchingEnvironment = availability.data?.environment === getStripeEnvironment();
  } catch {
    /* unavailable */
  }
  const checkoutEnabled =
    matchingEnvironment &&
    (signedIn ? availability.data?.account.enabled : availability.data?.guest.enabled);
  const checkoutMessage = availability.isLoading
    ? "Verificando a disponibilidade dos pagamentos…"
    : ((signedIn ? availability.data?.account.message : availability.data?.guest.message) ??
      "Não foi possível confirmar os pagamentos agora. Tente novamente.");
  const search = useLocation({ select: (location) => location.searchStr });
  const selectedProduct = new URLSearchParams(search).get("produto");
  const { openCheckout, checkoutElement, isOpen, closeCheckout } = useStripeCheckout();
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [guestProduct, setGuestProduct] = useState<GuestCheckoutProduct | null>(null);

  // A leitura é publicamente permitida por RLS; usar a mesma consulta para
  // visitantes e contas evita que a oferta mude depois do login.
  const productsQuery = useStoreCatalog();

  const walletQuery = useQuery({
    queryKey: ["user_wallet", userId],
    enabled: signedIn === true,
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("user_wallet")
        .select(
          "coins, season_pass, season_pass_until, scout_reports, training_boosts, unlocked_themes",
        )
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? {
        coins: 0,
        season_pass: false,
        season_pass_until: null,
        scout_reports: 0,
        training_boosts: 0,
        unlocked_themes: [],
      }) as Wallet;
    },
  });

  const subscriptionQuery = useSubscription();
  const subscriptionActive = isSubscriptionActive(subscriptionQuery.data);
  const isGuest = signedIn === false;
  const isSessionLoading = signedIn === null;
  const products = productsQuery.data ?? [];

  // Destaca o pacote de moedas com mais moedas por real, para o jogador
  // comparar sem fazer conta de cabeça.
  const bestValueKey = products
    .filter((p) => p.coins > 0 && p.price_cents > 0)
    .reduce<{ key: string; ratio: number } | null>((best, p) => {
      const ratio = p.coins / p.price_cents;
      return !best || ratio > best.ratio ? { key: p.key, ratio } : best;
    }, null)?.key;

  function buy(productKey: string) {
    // The public catalog is available to everyone; payment requires a session.
    if (signedIn !== true || !checkoutEnabled) return;
    setOpeningKey(productKey);
    void import("@/lib/analytics").then((m) =>
      m.track("checkout_iniciado", { produto: productKey }),
    );
    try {
      openCheckout({
        productKey,
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível abrir o checkout.");
    } finally {
      setOpeningKey(null);
    }
  }

  return (
    <div>
      {signedIn === true && <CouponRedeem onRedeemed={() => void walletQuery.refetch()} />}
      <div className="mb-4 rounded-2xl border border-border/60 surface-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Coins className="text-primary" size={20} />
          <span className="font-display text-sm uppercase tracking-wide">
            {isGuest || isSessionLoading
              ? "Vitrine da loja"
              : `${walletQuery.data?.coins ?? 0} moedas`}
          </span>
          {walletQuery.data && walletQuery.data.scout_reports > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Search size={12} /> {walletQuery.data.scout_reports} relatórios
            </Badge>
          )}
          {walletQuery.data && walletQuery.data.training_boosts > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Dumbbell size={12} /> {walletQuery.data.training_boosts} treinos
            </Badge>
          )}
          {subscriptionActive && (
            <Badge className="gap-1">
              <Sparkles size={12} /> Passe ativo até{" "}
              {formatDate(walletQuery.data?.season_pass_until)}
            </Badge>
          )}
        </div>
        {isSessionLoading ? (
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            Verificando sua conta para mostrar a ação de compra segura…
          </p>
        ) : isGuest ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>
              Veja os pacotes e preços. Compre por e-mail ou entre para vincular o item direto à
              carreira.
            </p>
            <Link
              to="/auth"
              search={{ next }}
              className="font-medium text-primary underline underline-offset-4"
            >
              Já tenho conta
            </Link>
          </div>
        ) : (
          <>
            {walletQuery.data && walletQuery.data.unlocked_themes.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Temas desbloqueados: {walletQuery.data.unlocked_themes.join(", ")}
              </p>
            ) : null}
            {selectedProduct ? (
              <p role="status" className="mt-2 text-xs text-primary">
                Seu pacote escolhido está destacado abaixo. Revise os detalhes antes de abrir o
                pagamento seguro.
              </p>
            ) : null}
          </>
        )}
      </div>

      {!checkoutEnabled ? (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/40 p-4 text-sm text-muted-foreground"
        >
          <p>{checkoutMessage}</p>
          {!availability.isLoading ? (
            <Button
              variant="outline"
              size="sm"
              disabled={availability.isFetching}
              onClick={() => void availability.refetch()}
            >
              Verificar pagamentos
            </Button>
          ) : null}
        </div>
      ) : null}

      {productsQuery.isLoading ? (
        <div className={`grid gap-4 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-xl border border-border/60 bg-card/60"
              aria-hidden
            />
          ))}
          <span className="sr-only">Carregando produtos…</span>
        </div>
      ) : productsQuery.isError ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/40 p-4 text-sm text-muted-foreground"
        >
          <p>Não foi possível carregar o catálogo oficial. Nenhum preço foi exibido.</p>
          <Button variant="outline" size="sm" onClick={() => void productsQuery.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : products.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum produto disponível no momento.</p>
      ) : (
        <>
          <p className="mb-4 text-xs text-muted-foreground">
            Catálogo atual. O checkout seguro confirma o total e a disponibilidade antes do
            pagamento.
          </p>
          <div className={`grid gap-4 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
            {products.map((p) => (
              <Card
                key={p.key}
                id={`store-product-${p.key}`}
                onMouseEnter={() => {
                  if (p.key === bestValueKey)
                    recordAdMetric(`store-${p.key}`, "inventory", "impression");
                }}
                className={`relative flex flex-col surface-card transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)] motion-reduce:transform-none motion-reduce:transition-none ${
                  selectedProduct === p.key
                    ? "border-primary/80 bg-primary/5 ring-1 ring-primary/40"
                    : p.key === bestValueKey
                      ? "border-primary/70"
                      : ""
                }`}
              >
                {p.key === bestValueKey && (
                  <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 font-display text-[10px] uppercase tracking-wider text-primary-foreground">
                    Destaque · melhor valor
                  </span>
                )}
                <div className="mx-5 mt-5 grid h-20 place-items-center overflow-hidden rounded-lg border border-primary/25 bg-[radial-gradient(circle_at_50%_120%,color-mix(in_oklab,var(--primary)_35%,transparent),transparent_70%)]">
                  <div className="grid h-14 w-14 place-items-center rounded-full border border-primary/40 bg-primary/15 text-primary shadow-lg [&>svg]:h-7 [&>svg]:w-7">
                    {KIND_ICONS[p.kind] ?? <Package />}
                  </div>
                </div>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="font-display text-base uppercase tracking-wide">
                      {p.name}
                    </CardTitle>
                    <Badge variant="secondary" className="gap-1">
                      {KIND_ICONS[p.kind] ?? <Package size={16} />}
                      {KIND_LABELS[p.kind] ?? p.kind}
                    </Badge>
                  </div>
                  <CardDescription>{p.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex flex-wrap items-baseline gap-2">
                  {salePrice(p).percent > 0 ? (
                    <>
                      <span className="font-display text-2xl leading-none">
                        {formatBRL(salePrice(p).cents, p.currency)}
                      </span>
                      <s className="text-sm text-muted-foreground">
                        {formatBRL(p.price_cents, p.currency)}
                      </s>
                      <Badge variant="destructive">-{salePrice(p).percent}%</Badge>
                    </>
                  ) : (
                    <span className="font-display text-2xl leading-none">
                      {formatBRL(p.price_cents, p.currency)}
                    </span>
                  )}
                  {p.coins > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                      <Coins size={12} /> +{p.coins} moedas
                    </span>
                  )}
                </CardContent>
                <CardFooter>
                  <div className="w-full space-y-2">
                    {isSessionLoading ? (
                      <Button className="w-full" disabled>
                        Verificando conta…
                      </Button>
                    ) : isGuest ? (
                      <Button
                        className="w-full"
                        data-testid="guest-checkout-start"
                        disabled={!checkoutEnabled}
                        onClick={() =>
                          setGuestProduct({
                            key: p.key,
                            name: p.name,
                            priceCents: salePrice(p).cents,
                            currency: p.currency,
                          })
                        }
                      >
                        Comprar como visitante
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        disabled={
                          !checkoutEnabled ||
                          openingKey === p.key ||
                          (p.kind === "pass" && subscriptionActive)
                        }
                        onClick={() => buy(p.key)}
                        onPointerDown={() => {
                          if (p.key === bestValueKey)
                            recordAdMetric(`store-${p.key}`, "inventory", "click");
                        }}
                      >
                        {openingKey === p.key
                          ? "Abrindo checkout…"
                          : p.kind === "pass" && subscriptionActive
                            ? "Assinatura ativa"
                            : "Comprar com segurança"}
                      </Button>
                    )}
                    <p className="text-center text-[11px] text-muted-foreground">
                      {isSessionLoading
                        ? "Aguarde a verificação da conta"
                        : isGuest
                          ? "Compra segura por e-mail; entre se já tiver uma conta"
                          : "Entrega automática na sua conta"}
                    </p>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>

          {isOpen && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-display text-sm uppercase tracking-wide">Checkout seguro</h2>
                <Button variant="ghost" size="sm" onClick={closeCheckout}>
                  Fechar
                </Button>
              </div>
              <Separator className="mb-4" />
              {checkoutElement}
            </div>
          )}
        </>
      )}

      <GuestCheckoutDialog
        product={guestProduct}
        open={guestProduct !== null}
        onOpenChange={(open) => {
          if (!open) setGuestProduct(null);
        }}
      />
    </div>
  );
}
