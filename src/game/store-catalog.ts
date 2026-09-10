/**
 * Catálogo dos pacotes da loja.
 *
 * É a mesma lista que está na tabela `store_products`; aqui ela existe em
 * código para a vitrine pública (/produtos) funcionar sem login e sem
 * esperar o banco responder. Os `priceId` são exatamente os mesmos usados
 * no checkout da loja.
 */

export type PackKind = "coins" | "scout" | "training" | "cosmetic" | "pass";

export interface StorePack {
  key: string;
  priceId: string;
  name: string;
  tagline: string;
  description: string;
  priceCents: number;
  currency: string;
  coins: number;
  kind: PackKind;
  recurring?: "month";
  contents: string[];
  /** cores usadas no render 3D do pacote */
  accent: string;
  accent2: string;
}

export const STORE_PACKS: StorePack[] = [
  {
    key: "coins_starter",
    priceId: "coins_starter",
    name: "Moedas iniciais",
    tagline: "O jeito mais barato de experimentar",
    description:
      "Um punhado pequeno de moedas para testar relatórios, impulsos de treino e temas sem gastar quase nada.",
    priceCents: 490,
    currency: "brl",
    coins: 200,
    kind: "coins",
    contents: ["200 moedas creditadas na hora", "Vale para qualquer item do jogo"],
    accent: "#ffe08a",
    accent2: "#8a6a12",
  },
  {

    key: "coins_small",
    priceId: "coins_small",
    name: "Punhado de moedas",
    tagline: "Para dar o primeiro empurrão na temporada",
    description:
      "Um bolso de moedas para liberar relatórios, impulsos e temas sem esperar as receitas do clube.",
    priceCents: 990,
    currency: "brl",
    coins: 500,
    kind: "coins",
    contents: ["500 moedas creditadas na hora", "Vale para qualquer item do jogo"],
    accent: "#f5c542",
    accent2: "#8a5a12",
  },
  {
    key: "coins_medium",
    priceId: "coins_medium",
    name: "Baú de moedas",
    tagline: "O melhor custo por moeda",
    description:
      "Baú cheio para atravessar a temporada inteira contratando, treinando e mudando o visual do clube.",
    priceCents: 2990,
    currency: "brl",
    coins: 1800,
    kind: "coins",
    contents: ["1.800 moedas creditadas na hora", "Bônus de 20% sobre o pacote menor"],
    accent: "#ffd977",
    accent2: "#7a4a08",
  },
  {
    key: "coins_large",
    priceId: "coins_large",
    name: "Cofre de moedas",
    tagline: "Para quem joga várias temporadas",
    description:
      "O maior volume de moedas do jogo, com o melhor bônus por real, para contratar e customizar sem contar centavos.",
    priceCents: 5990,
    currency: "brl",
    coins: 4000,
    kind: "coins",
    contents: ["4.000 moedas creditadas na hora", "Maior bônus da loja", "Vale para qualquer item"],
    accent: "#ffe9a8",
    accent2: "#6a3d05",
  },
  {
    key: "celebration_pack",
    priceId: "celebration_pack",
    name: "Pacote de comemorações",
    tagline: "Comemore o gol do seu jeito",
    description:
      "Novas comemorações dos jogadores no 3D, com câmeras próprias para o replay do gol.",
    priceCents: 990,
    currency: "brl",
    coins: 0,
    kind: "cosmetic",
    contents: ["8 comemorações novas em 3D", "Câmera exclusiva no replay", "Vale para todo o elenco"],
    accent: "#fb7185",
    accent2: "#651224",
  },
  {
    key: "stadium_pack",
    priceId: "stadium_pack",
    name: "Pacote de estádio",
    tagline: "A casa do seu clube mais bonita",
    description:
      "Cortes de gramado, bandeirões e mosaicos da torcida para deixar o estádio com a cara do seu clube.",
    priceCents: 1290,
    currency: "brl",
    coins: 0,
    kind: "cosmetic",
    contents: ["6 cortes de gramado", "Bandeirões da torcida", "Mosaicos na arquibancada"],
    accent: "#34d399",
    accent2: "#064e3b",
  },
  {

    key: "scout_pack",
    priceId: "scout_pack",
    name: "Pacote de olheiros",
    tagline: "Enxergue o jogador antes dos rivais",
    description:
      "Relatórios completos com potencial, personalidade e risco de lesão dos alvos do mercado.",
    priceCents: 1490,
    currency: "brl",
    coins: 0,
    kind: "scout",
    contents: ["10 relatórios completos", "Potencial e personalidade revelados", "Alerta de joias da base"],
    accent: "#57b6ff",
    accent2: "#0f3f6b",
  },
  {
    key: "training_pack",
    priceId: "training_pack",
    name: "Pacote de treino",
    tagline: "Semanas de trabalho concentradas",
    description:
      "Impulsos de treino que aceleram a evolução do elenco e recuperam a condição física mais rápido.",
    priceCents: 1490,
    currency: "brl",
    coins: 0,
    kind: "training",
    contents: ["10 impulsos de treino", "Evolução acelerada por semana", "Recuperação física extra"],
    accent: "#4ade80",
    accent2: "#14532d",
  },
  {
    key: "theme_pack",
    priceId: "theme_pack",
    name: "Pacote de temas",
    tagline: "O jogo com a cara do seu clube",
    description:
      "Temas visuais, cortes de gramado e estilos de escudo para deixar a experiência do seu jeito.",
    priceCents: 1990,
    currency: "brl",
    coins: 0,
    kind: "cosmetic",
    contents: ["6 temas de interface", "Cortes de gramado exclusivos", "Estilos extras de escudo"],
    accent: "#c084fc",
    accent2: "#3b1170",
  },
  {
    key: "season_pass",
    priceId: "season_pass_monthly",
    name: "Passe de temporada",
    tagline: "Tudo aberto, mês a mês",
    description:
      "Assinatura mensal com moedas semanais, relatórios ilimitados de olheiros e todos os cosméticos liberados.",
    priceCents: 2490,
    currency: "brl",
    coins: 0,
    kind: "pass",
    recurring: "month",
    contents: [
      "300 moedas toda semana",
      "Relatórios de olheiros ilimitados",
      "Todos os temas e cortes liberados",
      "Cancele quando quiser",
    ],
    accent: "#ffb547",
    accent2: "#5a2c00",
  },
];

export const PACK_BY_KEY: Record<string, StorePack> = Object.fromEntries(
  STORE_PACKS.map((p) => [p.key, p]),
);

export function formatPrice(cents: number, currency = "brl"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}
