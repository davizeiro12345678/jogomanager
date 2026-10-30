import { Link } from "@tanstack/react-router";

import { ShieldCheck, Trophy, Zap } from "lucide-react";

import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

import { StorePanel } from "@/components/game/StorePanel";

import storeHero from "@/assets/hero-stadium.jpg?format=webp&w=1600&quality=60&as=url";

import "@/components/auth-store.css";

export function LojaPage() {
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
            Moedas, olheiros, treinos, visuais e o passe de temporada. Todo pacote vem com bônus
            extras, e quanto maior o pacote, mais você ganha por real.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="store-chip">
              <ShieldCheck size={14} /> Pagamento seguro
            </span>
            <span className="store-chip">
              <Zap size={14} /> Entrega imediata
            </span>
            <span className="store-chip">
              <Trophy size={14} /> Bônus em todo pacote
            </span>
          </div>
        </header>
        <StorePanel next="/loja" columns={2} />
      </div>
    </div>
  );
}
