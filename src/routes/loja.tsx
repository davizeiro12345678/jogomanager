import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Trophy, Zap } from "lucide-react";

import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { StorePanel } from "@/components/game/StorePanel";
import storeHero from "@/assets/hero-stadium.jpg?format=webp&w=1600&quality=60&as=url";
import "@/components/auth-store.css";

export const Route = createFileRoute("/loja")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Loja · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Consulte os itens disponíveis na loja da sua carreira e confira os detalhes antes de comprar.",
      },
      {
        property: "og:title",
        content: "Loja · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Consulte os itens disponíveis na loja da sua carreira e confira os detalhes antes de comprar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LojaPage,
});

function LojaPage() {
  return (
    <div className="store-stage min-h-screen px-4 py-6">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-5xl">
        <header
          className="store-hero mb-6 p-6 sm:p-10"
          style={{ backgroundImage: `url(${storeHero})` }}
        >
          <Link
            to="/dashboard"
            className="inline-flex min-h-11 items-center text-xs uppercase tracking-widest text-primary"
          >
            ← Painel
          </Link>
          <h1 className="mt-2 font-display text-4xl uppercase tracking-wide sm:text-5xl">Loja</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            Moedas, relatórios de olheiros, impulsos de treino e cosméticos — nada aqui altera o
            resultado das partidas.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="store-chip">
              <ShieldCheck size={14} /> Pagamento seguro
            </span>
            <span className="store-chip">
              <Zap size={14} /> Entrega imediata
            </span>
            <span className="store-chip">
              <Trophy size={14} /> Sem vantagem nas partidas
            </span>
          </div>
        </header>
        <StorePanel next="/loja" columns={2} />
      </div>
    </div>
  );
}
