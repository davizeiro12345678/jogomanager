import { Link } from "@tanstack/react-router";
import { Coins, Crown, Dumbbell, Package, Palette, Search, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PACK_BY_KEY, formatPrice } from "@/game/store-catalog";
import { useStoreCatalog, type StoreCatalogProduct } from "@/hooks/useStoreCatalog";

const ICON_BY_KIND = {
  coins: Coins,
  scout: Search,
  training: Dumbbell,
  cosmetic: Palette,
  pass: Crown,
} as const;

const KIND_LABEL: Record<string, string> = {
  coins: "Moedas para carreira",
  scout: "Relatório de olheiro",
  training: "Impulso de treino",
  cosmetic: "Item visual",
  pass: "Passe de temporada",
};

function ProductCard({ product }: { product: StoreCatalogProduct }) {
  const presentation = PACK_BY_KEY[product.key];
  const Icon = ICON_BY_KIND[product.kind as keyof typeof ICON_BY_KIND] ?? Package;
  const label = KIND_LABEL[product.kind] ?? "Item da loja";
  const accent = presentation?.accent ?? "#57b6ff";
  const accent2 = presentation?.accent2 ?? "#0f3f6b";

  return (
    <article
      className="group relative flex min-h-[17rem] flex-col overflow-hidden rounded-3xl border border-border/60 bg-card/50 p-5 shadow-[0_22px_54px_-42px_rgba(0,0,0,0.8)] transition-transform hover:-translate-y-1 hover:border-primary/45 focus-within:border-primary/55 motion-reduce:transform-none motion-reduce:transition-none"
      style={{
        background: `radial-gradient(100% 90% at 100% 0%, ${accent}2d 0%, transparent 62%), linear-gradient(145deg, ${accent2}34 0%, hsl(var(--card)/0.6) 54%)`,
      }}
    >
      <div aria-hidden="true" className="absolute inset-0 opacity-30 [background-image:linear-gradient(135deg,transparent_45%,rgba(255,255,255,0.16)_46%,transparent_47%)] [background-size:18px_18px]" />
      <div className="relative flex items-start justify-between gap-4">
        <span
          className="grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-background/55 text-foreground shadow-lg backdrop-blur"
          style={{ color: accent }}
        >
          <Icon size={20} aria-hidden="true" />
        </span>
        <span className="rounded-full border border-white/15 bg-background/45 px-2.5 py-1 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
          {label}
        </span>
      </div>
      <div className="relative mt-auto pt-10">
        <h3 className="font-display text-xl uppercase leading-none tracking-wide text-foreground">{product.name}</h3>
        <p className="mt-3 min-h-10 text-sm leading-relaxed text-muted-foreground">{product.description}</p>
        {product.coins > 0 ? (
          <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-background/45 px-2 py-1 text-xs font-medium text-primary backdrop-blur">
            <Coins size={13} aria-hidden="true" /> +{product.coins.toLocaleString("pt-BR")} moedas
          </p>
        ) : null}
        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-2xl tracking-wide text-foreground">
              {formatPrice(product.price_cents, product.currency)}
            </p>
            <p className="mt-1 text-[0.68rem] text-muted-foreground">Preço público atual</p>
          </div>
          <Link
            to="/produtos"
            hash={product.key}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-primary/40 bg-background/55 px-3 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary/12 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            Ver item
          </Link>
        </div>
      </div>
    </article>
  );
}

function StoreRailLoading() {
  return (
    <div aria-label="Carregando catálogo público" className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="min-h-[17rem] animate-pulse rounded-3xl border border-border/50 bg-card/40" aria-hidden="true" />
      ))}
    </div>
  );
}

export function HomeStoreRail() {
  const productsQuery = useStoreCatalog();
  const products = (productsQuery.data ?? []).slice(0, 3);

  return (
    <section id="loja" aria-labelledby="home-store-title" className="mt-12 rounded-[2rem] border border-border/60 bg-card/30 p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="inline-flex items-center gap-2 font-display text-[0.7rem] uppercase tracking-[0.32em] text-primary">
            <ShoppingBag size={15} aria-hidden="true" /> vitrine pública
          </p>
          <h2 id="home-store-title" className="mt-3 font-display text-3xl uppercase leading-none tracking-wide sm:text-4xl">
            Conheça a loja antes de entrar.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Preços e itens ativos aparecem para todos. Entre na sua conta para concluir uma compra
            e vincular o item à sua carreira.
          </p>
        </div>
        <Button className="min-h-11 shrink-0" variant="outline" asChild>
          <Link to="/produtos">
            Ver catálogo completo <ShoppingBag aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <div className="mt-7">
        {productsQuery.isLoading ? (
          <StoreRailLoading />
        ) : productsQuery.isError ? (
          <div role="status" className="rounded-2xl border border-border/60 bg-background/45 p-5 text-sm text-muted-foreground">
            O catálogo está indisponível neste instante. Abra a loja para tentar atualizar os itens
            ativos novamente.
          </div>
        ) : products.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.key} product={product} />
            ))}
          </div>
        ) : (
          <div role="status" className="rounded-2xl border border-border/60 bg-background/45 p-5 text-sm text-muted-foreground">
            O catálogo está sendo atualizado. Volte em breve para ver os itens disponíveis.
          </div>
        )}
      </div>
      <p className="mt-5 text-xs text-muted-foreground">
        O total e a disponibilidade são reconfirmados pelo checkout seguro antes de qualquer
        pagamento.
      </p>
    </section>
  );
}
