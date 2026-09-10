import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Coins, Sparkles, Crown, Package, Search, Dumbbell, Palette } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSignedIn } from "@/hooks/useCareer";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useSubscription, isSubscriptionActive } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
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

interface StoreProduct {
  key: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  coins: number;
  kind: string;
  active: boolean;
}

interface Wallet {
  coins: number;
  season_pass: boolean;
  season_pass_until: string | null;
  scout_reports: number;
  training_boosts: number;
  unlocked_themes: string[];
}

function formatBRL(cents: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
  }).format(cents / 100);
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

const PRICE_IDS: Record<string, string> = {
  coins_starter: "coins_starter",
  coins_small: "coins_small",
  coins_large: "coins_large",
  celebration_pack: "celebration_pack",
  stadium_pack: "stadium_pack",
  coins_medium: "coins_medium",
  scout_pack: "scout_pack",
  training_pack: "training_pack",
  theme_pack: "theme_pack",
  season_pass: "season_pass_monthly",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * Vitrine da loja reutilizável: usada na página /loja e dentro da partida.
 * `columns` deixa o layout de uma coluna quando aparece numa gaveta estreita.
 */
export function StorePanel({
  next = "/loja",
  columns = 2,
}: {
  next?: string;
  columns?: 1 | 2;
}) {
  const signedIn = useSignedIn();
  const { openCheckout, checkoutElement, isOpen, closeCheckout } = useStripeCheckout();
  const [openingKey, setOpeningKey] = useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: ["store_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_products")
        .select("key, name, description, price_cents, currency, coins, kind, active")
        .eq("active", true)
        .order("price_cents", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as StoreProduct[];
    },
  });

  const walletQuery = useQuery({
    queryKey: ["user_wallet", signedIn],
    enabled: signedIn === true,
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
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

  function buy(productKey: string) {
    if (!signedIn) return;
    setOpeningKey(productKey);
    void import("@/lib/analytics").then((m) => m.track("checkout_iniciado", { produto: productKey }));
    try {
      const priceId = PRICE_IDS[productKey];
      if (!priceId) throw new Error("Produto não configurado para checkout.");
      openCheckout({
        priceId,
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível abrir o checkout.");
    } finally {
      setOpeningKey(null);
    }
  }

  if (!signedIn) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/85 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Entre na sua conta para comprar itens da loja.
        </p>
        <Link
          to="/auth"
          search={{ next }}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-display text-sm uppercase tracking-wider text-primary-foreground"
        >
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 rounded-2xl border border-border/60 bg-card/70 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Coins className="text-primary" size={20} />
          <span className="font-display text-sm uppercase tracking-wide">
            {walletQuery.data?.coins ?? 0} moedas
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
        {walletQuery.data && walletQuery.data.unlocked_themes.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Temas desbloqueados: {walletQuery.data.unlocked_themes.join(", ")}
          </p>
        )}
      </div>

      {productsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando produtos…</p>
      ) : productsQuery.isError ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar os produtos. Tente novamente em instantes.
        </p>
      ) : productsQuery.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum produto disponível no momento.</p>
      ) : (
        <>
          <div className={`grid gap-4 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
            {productsQuery.data?.map((p) => (
              <Card key={p.key} className="flex flex-col bg-card/70">
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
                <CardContent className="mt-auto flex flex-col gap-1">
                  <span className="font-display text-lg">
                    {formatBRL(p.price_cents, p.currency)}
                  </span>
                  {p.coins > 0 && (
                    <span className="text-xs text-muted-foreground">+{p.coins} moedas</span>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    disabled={openingKey === p.key || (p.kind === "pass" && subscriptionActive)}
                    onClick={() => buy(p.key)}
                  >
                    {openingKey === p.key
                      ? "Abrindo checkout…"
                      : p.kind === "pass" && subscriptionActive
                        ? "Assinatura ativa"
                        : "Comprar"}
                  </Button>
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
    </div>
  );
}
