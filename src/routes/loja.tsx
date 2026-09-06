import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Coins, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSignedIn } from "@/hooks/useCareer";
import { purchaseProduct } from "@/lib/store.functions";
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

export const Route = createFileRoute("/loja")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Loja · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Compre moedas, relatórios de olheiros, impulsos de treino e itens cosméticos para o seu clube.",
      },
      { property: "og:title", content: "Loja · Pro Football Manager 3D" },
      {
        property: "og:description",
        content: "Moedas, relatórios de olheiros, impulsos de treino e cosméticos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LojaPage,
});

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
}

function formatBRL(cents: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
  }).format(cents / 100);
}

const KIND_LABELS: Record<string, string> = {
  coins: "Moedas",
  scouting: "Olheiros",
  training: "Treino",
  cosmetic: "Cosmético",
  season_pass: "Passe de temporada",
};

function LojaPage() {
  const signedIn = useSignedIn();
  const qc = useQueryClient();
  const purchase = useServerFn(purchaseProduct);
  const [purchasingKey, setPurchasingKey] = useState<string | null>(null);

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
        .select("coins, season_pass")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? { coins: 0, season_pass: false }) as Wallet;
    },
  });

  async function buy(productKey: string) {
    if (!signedIn) return;
    setPurchasingKey(productKey);
    try {
      const result = await purchase({ data: { productKey } });
      qc.setQueryData(["user_wallet", signedIn], {
        coins: result.coins,
        season_pass: result.seasonPass,
      });
      toast.success("Compra concluída! (pagamento em teste)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível concluir a compra.");
    } finally {
      setPurchasingKey(null);
    }
  }

  return (
    <div className="pitch-bg min-h-screen px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4">
          <Link to="/dashboard" className="text-xs uppercase tracking-widest text-primary">
            ← Painel
          </Link>
          <h1 className="font-display text-2xl uppercase tracking-wide">Loja</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Moedas, relatórios de olheiros, impulsos de treino e cosméticos — nada aqui altera o
            resultado das partidas.
          </p>
        </div>

        {signedIn && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card/70 p-4">
            <Coins className="text-primary" size={20} />
            <span className="font-display text-sm uppercase tracking-wide">
              {walletQuery.data?.coins ?? 0} moedas
            </span>
            {walletQuery.data?.season_pass && (
              <Badge className="gap-1">
                <Sparkles size={12} /> Passe de temporada ativo
              </Badge>
            )}
          </div>
        )}

        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          Pagamento em teste: nenhuma cobrança real é feita ainda. As compras já creditam moedas e
          benefícios na sua conta enquanto o processador de cartão não é conectado.
        </div>

        {!signedIn ? (
          <div className="rounded-2xl border border-border/60 bg-card/85 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Entre na sua conta para comprar itens da loja.
            </p>
            <Link
              to="/auth"
              search={{ next: "/loja" }}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-display text-sm uppercase tracking-wider text-primary-foreground"
            >
              Entrar
            </Link>
          </div>
        ) : productsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando produtos…</p>
        ) : productsQuery.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto disponível no momento.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {productsQuery.data?.map((p) => (
              <Card key={p.key} className="flex flex-col bg-card/70">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="font-display text-base uppercase tracking-wide">
                      {p.name}
                    </CardTitle>
                    <Badge variant="secondary">{KIND_LABELS[p.kind] ?? p.kind}</Badge>
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
                    disabled={purchasingKey === p.key}
                    onClick={() => void buy(p.key)}
                  >
                    {purchasingKey === p.key ? "Processando…" : "Comprar"}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
