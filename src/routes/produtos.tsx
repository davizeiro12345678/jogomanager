/**
 * Vitrine pública dos itens atualmente ativos no catálogo oficial.
 * A vitrine e a compra por e-mail também funcionam antes da autenticação.
 */
import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { Coins, Crown, Dumbbell, Package, Palette, Search } from "lucide-react";
import { toast } from "sonner";

import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { PublicLinks } from "@/components/PublicLinks";
import {
  GuestCheckoutDialog,
  type GuestCheckoutProduct,
} from "@/components/store/GuestCheckoutDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSignedIn } from "@/hooks/useCareer";
import { useStoreCatalog } from "@/hooks/useStoreCatalog";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { PACK_BY_KEY, formatPrice, type PackKind } from "@/game/store-catalog";
import { breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PackScene = lazy(() =>
  import("@/components/store/PackScene").then((m) => ({ default: m.PackScene })),
);

const PATH = "/produtos";
const TITLE = "Pacotes e passe de temporada | Pro Football Manager 3D";
const DESC =
  "Catálogo atual de itens para a carreira no Pro Football Manager 3D. Consulte os detalhes e compre com e-mail ou entre para sua carreira.";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH }),
    links: canonical(PATH),
    scripts: [
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Pacotes", path: PATH },
      ]),
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

const PACK_KINDS: readonly PackKind[] = ["coins", "scout", "training", "cosmetic", "pass"];

function asPackKind(kind: string): PackKind | null {
  return PACK_KINDS.includes(kind as PackKind) ? (kind as PackKind) : null;
}

function ProdutosPage() {
  const signedIn = useSignedIn();
  const productsQuery = useStoreCatalog();
  const products = productsQuery.data ?? [];
  const { openCheckout, checkoutElement, isOpen, closeCheckout } = useStripeCheckout();
  const [opening, setOpening] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [guestProduct, setGuestProduct] = useState<GuestCheckoutProduct | null>(null);

  function buy(productKey: string) {
    // A sessão autenticada preserva o fluxo de conta já existente.
    if (signedIn !== true) return;
    setOpening(productKey);
    try {
      openCheckout({
        productKey,
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

  const previewProduct = products.find((product) => product.key === previewKey) ?? null;
  const previewPresentation = previewProduct ? PACK_BY_KEY[previewProduct.key] : undefined;
  const previewKind = previewProduct
    ? (asPackKind(previewProduct.kind) ?? previewPresentation?.kind ?? "coins")
    : "coins";

  return (
    <div className="pitch-bg min-h-screen">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-6xl px-4 py-14">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Loja oficial</p>
        <h1 className="mt-2 font-display text-4xl uppercase tracking-wide">
          Pacotes e passe de temporada
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Consulte o catálogo atual antes de entrar. O checkout seguro confirma o total e a
          disponibilidade antes do pagamento.
        </p>
        {signedIn === false ? (
          <div
            role="status"
            className="mt-5 flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-muted-foreground">
              Compare os itens e preços à vontade. Você pode comprar com e-mail ou entrar para
              vincular a compra diretamente à sua carreira.
            </p>
            <Button asChild variant="outline" className="shrink-0">
              <Link to="/auth" search={{ next: PATH }}>
                Entrar ou criar conta
              </Link>
            </Button>
          </div>
        ) : signedIn === null ? (
          <p role="status" className="mt-5 text-sm text-muted-foreground">
            Verificando sua conta para mostrar a ação de compra segura…
          </p>
        ) : null}

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {productsQuery.isLoading ? (
            Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="h-[29rem] animate-pulse rounded-3xl border border-border/60 bg-card/60"
                aria-hidden
              />
            ))
          ) : productsQuery.isError ? (
            <div
              role="status"
              className="rounded-3xl border border-border/60 bg-secondary/40 p-5 text-sm text-muted-foreground md:col-span-2 xl:col-span-3"
            >
              <p>
                Não foi possível carregar o catálogo oficial. Para evitar informações
                desatualizadas, nenhum preço ou benefício foi exibido.
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => void productsQuery.refetch()}
              >
                Tentar novamente
              </Button>
            </div>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
              Nenhum item está disponível no momento.
            </p>
          ) : (
            products.map((product) => {
              const kind = asPackKind(product.kind);
              const presentation = PACK_BY_KEY[product.key];

              return (
                <article
                  key={product.key}
                  id={product.key}
                  className="flex flex-col overflow-hidden rounded-3xl border border-border/60 surface-card transition-transform hover:-translate-y-1 hover:border-primary/50"
                >
                  <div
                    className="relative h-52 w-full"
                    style={{
                      background: `radial-gradient(120% 100% at 50% 20%, ${presentation?.accent ?? "#60a5fa"}22, transparent 70%)`,
                    }}
                  >
                    <div className="grid h-full place-items-center">
                      <div className="grid h-24 w-24 place-items-center rounded-[2rem] border border-primary/30 bg-background/30 text-primary shadow-[0_0_50px_color-mix(in_srgb,var(--primary)_20%,transparent)]">
                        {kind ? ICONS[kind] : <Package size={32} />}
                      </div>
                      <span className="-mt-9 text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                        Visual do pacote
                      </span>
                    </div>
                    <Badge variant="secondary" className="absolute left-3 top-3 gap-1">
                      {kind ? ICONS[kind] : <Package size={14} />}
                      {kind ? KIND_LABEL[kind] : "Item da loja"}
                    </Badge>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <h2 className="font-display text-lg uppercase tracking-wide">{product.name}</h2>
                    <p className="mt-3 text-sm text-muted-foreground">{product.description}</p>

                    {product.coins > 0 ? (
                      <span className="mt-4 inline-flex w-fit items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                        <Coins size={12} /> +{product.coins} moedas
                      </span>
                    ) : null}

                    <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <span className="font-display text-2xl">
                          {formatPrice(product.price_cents, product.currency)}
                        </span>
                        <p className="mt-1 max-w-[14rem] text-[11px] text-muted-foreground">
                          Preço de catálogo; o checkout confirma total e disponibilidade.
                        </p>
                      </div>
                      {signedIn === true ? (
                        <Button onClick={() => buy(product.key)} disabled={opening === product.key}>
                          {opening === product.key ? "Abrindo…" : "Comprar agora"}
                        </Button>
                      ) : signedIn === false ? (
                        <Button
                          data-testid="guest-checkout-start"
                          onClick={() =>
                            setGuestProduct({
                              key: product.key,
                              name: product.name,
                              priceCents: product.price_cents,
                              currency: product.currency,
                            })
                          }
                        >
                          Comprar como visitante
                        </Button>
                      ) : (
                        <Button disabled>Verificando conta…</Button>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-4 w-full text-xs"
                      onClick={() => setPreviewKey(product.key)}
                    >
                      Ver visual do pacote
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {previewProduct ? (
          <section
            aria-labelledby="product-preview-title"
            className="mt-8 overflow-hidden rounded-3xl border border-primary/25 surface-card md:grid md:grid-cols-[minmax(0,1fr)_20rem]"
          >
            <div className="p-6">
              <p className="font-display text-xs uppercase tracking-[0.28em] text-primary">
                Prévia opcional
              </p>
              <h2
                id="product-preview-title"
                className="mt-2 font-display text-2xl uppercase tracking-wide"
              >
                {previewProduct.name}
              </h2>
              <p className="mt-3 max-w-xl text-sm text-muted-foreground">
                {previewProduct.description}
              </p>
              <p className="mt-5 text-sm text-muted-foreground">
                Esta é a única cena 3D da vitrine. Os cards usam posters leves para que a loja
                continue rápida mesmo em aparelhos sem WebGL.
              </p>
              <Button className="mt-5" variant="outline" onClick={() => setPreviewKey(null)}>
                Fechar prévia
              </Button>
            </div>
            <div className="h-64 border-t border-border/60 md:h-auto md:border-l md:border-t-0">
              <ClientOnly fallback={<div className="h-full w-full" />}>
                <Suspense fallback={<div className="h-full w-full" />}>
                  <PackScene
                    kind={previewKind}
                    accent={previewPresentation?.accent ?? "#60a5fa"}
                    accent2={previewPresentation?.accent2 ?? "#1d4ed8"}
                  />
                </Suspense>
              </ClientOnly>
            </div>
          </section>
        ) : null}

        <section
          aria-labelledby="catalog-help-title"
          className="mt-8 max-w-3xl space-y-3 text-sm leading-relaxed text-muted-foreground"
        >
          <h2 id="catalog-help-title" className="font-display text-xl text-foreground">
            Como consultar e comprar um item
          </h2>
          <p>
            Cada item disponível apresenta seu nome, sua descrição e o preço de catálogo. Leia os
            detalhes para entender o que será entregue e escolha a opção adequada à sua carreira. A
            lista pode mudar: ofertas, disponibilidade e valores são confirmados no checkout antes
            de concluir o pagamento.
          </p>
          <p>
            Se você já tem uma conta, entre antes da compra para vincular o pedido à sua carreira.
            Também é possível iniciar uma compra como visitante com e-mail. Use um endereço ao qual
            tenha acesso e guarde a confirmação recebida para acompanhar o pedido e vincular os
            itens quando necessário.
          </p>
          <p>
            Após o pagamento, aguarde a confirmação e consulte o resultado apresentado na tela.
            Evite repetir uma compra enquanto o pedido estiver em confirmação. Se houver uma dúvida
            sobre cobrança ou entrega, consulte o histórico em
            <Link to="/compras" className="text-primary hover:underline">
              {" "}
              minhas compras
            </Link>{" "}
            ou veja as orientações de{" "}
            <Link to="/contato" className="text-primary hover:underline">
              contato e suporte
            </Link>
            .
          </p>
          <p>
            As condições de uso e de pagamento estão nos{" "}
            <Link to="/termos" className="text-primary hover:underline">
              termos de uso
            </Link>
            . Confira também a{" "}
            <Link to="/privacidade" className="text-primary hover:underline">
              política de privacidade
            </Link>{" "}
            para saber como os dados da conta e da compra são tratados.
          </p>
        </section>

        <div id="checkout-area" className="mt-10">
          {isOpen ? (
            <div className="rounded-3xl border border-border/60 surface-card p-5">
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

        <GuestCheckoutDialog
          product={guestProduct}
          open={guestProduct !== null}
          onOpenChange={(open) => {
            if (!open) setGuestProduct(null);
          }}
        />

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
