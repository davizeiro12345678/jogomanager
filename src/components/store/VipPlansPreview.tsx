import { Crown, LockKeyhole, Sparkles } from "lucide-react";
import { LOCAL_VIP_OFFERS } from "@/lib/vip-offers";
import { formatPrice } from "@/game/store-catalog";
import { STORE_KIND_IMAGE } from "@/lib/store-product-artwork";

/**
 * Informational preview only: Stripe Prices and product rows are inactive.
 * Do not render a payment action before subscription fulfillment is verified.
 */
export function VipPlansPreview() {
  return (
    <section className="mt-10" aria-labelledby="vip-plan-title">
      <div className="mb-5">
        <h2 id="vip-plan-title" className="font-display text-2xl uppercase tracking-wide">
          Planos VIP em preparação
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Dois planos mensais planejados. Os preços são indicativos e nenhuma assinatura pode ser
          iniciada até a entrega de todos os benefícios ser testada.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {LOCAL_VIP_OFFERS.map((offer) => {
          const premium = offer.tier === "vip_max";
          const title = premium ? "Premium Max" : "VIP";
          return (
            <article
              key={offer.key}
              className="overflow-hidden rounded-2xl border border-primary/25 surface-card"
            >
              <div className="relative h-36 overflow-hidden">
                <img
                  src={STORE_KIND_IMAGE.pass}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={640}
                  height={320}
                  className="h-full w-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                <div className="absolute bottom-3 left-4 flex items-center gap-2 font-display text-xl uppercase">
                  {premium ? <Sparkles size={22} aria-hidden /> : <Crown size={22} aria-hidden />}
                  {title}
                </div>
              </div>
              <div className="p-5">
                <p className="font-display text-2xl">
                  {formatPrice(offer.displayPriceCents, offer.currency)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    /mês (previsto)
                  </span>
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {premium
                    ? "Camada acima do VIP: biblioteca visual ampliada, emblema exclusivo e personalização avançada em desenvolvimento."
                    : "Personalização visual, emblema de perfil e biblioteca de temas em desenvolvimento."}
                </p>
                <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <LockKeyhole size={16} aria-hidden /> Ainda não disponível para contratação
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
