import { Link } from "@tanstack/react-router";

import { ShieldCheck, Trophy, Zap } from "lucide-react";

import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useT } from "@/i18n/context";
import { storePageMessages } from "@/i18n/store-page-messages";

import { StorePanel } from "@/components/game/StorePanel";

import storeHero from "@/assets/hero-stadium.jpg?format=webp&w=1600&quality=60&as=url";

import "@/components/auth-store.css";

export function LojaPage() {
  const { lang } = useT();
  const copy = storePageMessages(lang);
  return (
    <main className="store-stage min-h-dvh px-4 py-6">
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
            ← {copy.backToPanel}
          </Link>
          <h1 className="mt-2 font-display text-4xl uppercase tracking-wide sm:text-5xl">{copy.title}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            {copy.subtitle}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="store-chip">
              <ShieldCheck size={14} /> {copy.securePayment}
            </span>
            <span className="store-chip">
              <Zap size={14} /> {copy.instantDelivery}
            </span>
            <span className="store-chip">
              <Trophy size={14} /> {copy.bonusAllPackages}
            </span>
          </div>
        </header>
        <StorePanel next="/loja" columns={2} />
      </div>
    </main>
  );
}
