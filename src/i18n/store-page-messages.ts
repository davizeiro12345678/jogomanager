import { featureMessages, type FeatureMessages } from "./feature-messages";
import type { Lang } from "./locale-catalog";

const pt = {
  backToPanel: "Painel",
  title: "Loja",
  subtitle:
    "Moedas, olheiros, treinos, visuais e o passe de temporada. Todo pacote vem com bônus extras, e quanto maior o pacote, mais você ganha por real.",
  securePayment: "Pagamento seguro",
  instantDelivery: "Entrega imediata",
  bonusAllPackages: "Bônus em todo pacote",
};

const messages: FeatureMessages<keyof typeof pt> = {
  pt,
  en: {
    backToPanel: "Dashboard",
    title: "Store",
    subtitle:
      "Coins, scouting, training, cosmetics and the season pass. Every bundle includes extras, and larger bundles give you more value for your money.",
    securePayment: "Secure payments",
    instantDelivery: "Instant delivery",
    bonusAllPackages: "Bonus in every bundle",
  },
  es: {
    backToPanel: "Panel",
    title: "Tienda",
    subtitle:
      "Monedas, ojeadores, entrenamientos, artículos visuales y el pase de temporada. Todos los paquetes incluyen extras; los más grandes ofrecen más por tu dinero.",
    securePayment: "Pago seguro",
    instantDelivery: "Entrega inmediata",
    bonusAllPackages: "Bonificación en cada paquete",
  },
};

export const storePageMessages = (lang: Lang) => featureMessages(lang, messages);
