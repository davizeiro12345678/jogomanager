import { createFileRoute, Link } from "@tanstack/react-router";

import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { StorePanel } from "@/components/game/StorePanel";

export const Route = createFileRoute("/loja")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Loja · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      { property: "og:title", content: "Loja · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        property: "og:description",
        content: "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LojaPage,
});

function LojaPage() {
  return (
    <div className="pitch-bg min-h-screen px-4 py-6">
      <PaymentTestModeBanner />
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
        <StorePanel next="/loja" columns={2} />
      </div>
    </div>
  );
}
