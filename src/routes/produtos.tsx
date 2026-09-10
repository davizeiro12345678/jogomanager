/**
 * Vitrine pública dos pacotes, com render 3D ao vivo de cada item e compra
 * imediata pelo mesmo checkout usado na loja.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { Check, Coins, Crown, Dumbbell, Palette, Search } from "lucide-react";
import { toast } from "sonner";

import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { PublicLinks } from "@/components/PublicLinks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { STORE_PACKS, formatPrice, type PackKind } from "@/game/store-catalog";
import { SITE_NAME, SITE_URL, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PackScene = lazy(() =>
  import("@/components/store/PackScene").then((m) => ({ default: m.PackScene })),
);

const PATH = "/produtos";
const TITLE = "Pacotes e passe de temporada · Pro Football Manager 3D: Jogo de Futebol Manager Online";
const DESC =
  "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.";

function productsLd() {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Pacotes do Pro Football Manager 3D",
      itemListElement: STORE_PACKS.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Product",
          name: p.name,
          description: p.description,
          brand: { "@type": "Brand", name: SITE_NAME },
          url: `${SITE_URL}${PATH}#${p.key}`,
          offers: {
            "@type": "Offer",
            price: (p.priceCents / 100).toFixed(2),
            priceCurrency: p.currency.toUpperCase(),
            availability: "https://schema.org/InStock",
            url: `${SITE_URL}${PATH}#${p.key}`,
          },
        },
      })),
    }),
  };
}

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH }),
    links: canonical(PATH),
    scripts: [
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Pacotes", path: PATH },
      ]),
      productsLd(),
    ],
  }),
  component: ProdutosPage,
});

const ICONS: Record<PackKind, React.ReactNode> = {
  coins: <Coins size={14} />,
  scout: <Search size={14} />,
  training: <Dumbbell size={14} />,
  cosmetic: <Palette size={14} />,
  pass: <Crown size={14} />,
};

const KIND_LABEL: Record<PackKind, string> = {
  coins: "Moedas",
  scout: "Olheiros",
  training: "Treino",
  cosmetic: "Visual",
  pass: "Assinatura",
};

function ProdutosPage() {
  const { openCheckout, checkoutElement, isOpen, closeCheckout } = useStripeCheckout();
  const [opening, setOpening] = useState<string | null>(null);

  function buy(priceId: string, key: string) {
    setOpening(key);
    try {
      openCheckout({
        priceId,
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      });
      queueMicrotask(() =>
        document.getElementById("checkout-area")?.scrollIntoView({ behavior: "smooth" }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível abrir o pagamento.");
    } finally {
      setOpening(null);
    }
  }

  return (
    <div className="pitch-bg min-h-screen">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-6xl px-4 py-14">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Loja oficial</p>
        <h1 className="mt-2 font-display text-4xl uppercase tracking-wide">
          Pacotes e passe de temporada
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Tudo aqui é opcional e não muda o resultado das partidas: são atalhos de tempo,
          informação de olheiros e itens visuais para o seu clube.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {STORE_PACKS.map((p) => (
            <article
              key={p.key}
              id={p.key}
              className="flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card/70 transition-transform hover:-translate-y-1 hover:border-primary/50"
            >
              <div
                className="relative h-52 w-full"
                style={{
                  background: `radial-gradient(120% 100% at 50% 20%, ${p.accent}22, transparent 70%)`,
                }}
              >
                <ClientOnly fallback={<div className="h-full w-full" />}>
                  <Suspense fallback={<div className="h-full w-full" />}>
                    <PackScene kind={p.kind} accent={p.accent} accent2={p.accent2} />
                  </Suspense>
                </ClientOnly>
                <Badge variant="secondary" className="absolute left-3 top-3 gap-1">
                  {ICONS[p.kind]} {KIND_LABEL[p.kind]}
                </Badge>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-display text-lg uppercase tracking-wide">{p.name}</h2>
                <p className="mt-1 text-xs uppercase tracking-widest text-primary">{p.tagline}</p>
                <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>

                <ul className="mt-4 space-y-1.5 text-sm">
                  {p.contents.map((c) => (
                    <li key={c} className="flex items-start gap-2">
                      <Check size={15} className="mt-0.5 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{c}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex items-end justify-between gap-3">
                  <span className="font-display text-2xl">
                    {formatPrice(p.priceCents, p.currency)}
                    {p.recurring ? (
                      <span className="ml-1 text-xs text-muted-foreground">/mês</span>
                    ) : null}
                  </span>
                  <Button onClick={() => buy(p.priceId, p.key)} disabled={opening === p.key}>
                    {opening === p.key ? "Abrindo…" : "Comprar agora"}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div id="checkout-area" className="mt-10">
          {isOpen ? (
            <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-sm uppercase tracking-wide">Pagamento seguro</h2>
                <Button variant="ghost" size="sm" onClick={closeCheckout}>
                  Fechar
                </Button>
              </div>
              {checkoutElement}
            </div>
          ) : null}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Já tem carreira em andamento? Os itens comprados aparecem direto na{" "}
          <Link to="/loja" className="text-primary hover:underline">
            loja dentro do jogo
          </Link>
          .
        </p>

        <PublicLinks exclude={PATH} />
      </div>
    </div>
  );
}
