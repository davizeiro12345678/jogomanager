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
      "250 moedas e 1 relatório de olheiro para começar a temporada com vantagem no mercado.",
    priceCents: 490,
    currency: "brl",
    coins: 250,
    kind: "coins",
    contents: ["250 moedas creditadas na hora", "+1 relatório de olheiro de bônus"],
    accent: "#ffe08a",
    accent2: "#8a6a12",
  },
  {
    key: "coins_small",
    priceId: "coins_small",
    name: "Punhado de moedas",
    tagline: "Para dar o primeiro empurrão na temporada",
    description:
      "600 moedas e 2 relatórios de olheiro, 20% a mais por real que o pacote inicial.",
    priceCents: 990,
    currency: "brl",
    coins: 600,
    kind: "coins",
    contents: ["600 moedas creditadas na hora", "+2 relatórios de olheiro", "20% a mais por real que o pacote inicial"],
    accent: "#f5c542",
    accent2: "#8a5a12",
  },
  {
    key: "coins_medium",
    priceId: "coins_medium",
    name: "Baú de moedas",
    tagline: "O melhor custo por moeda",
    description:
      "2.000 moedas, 5 relatórios e 2 impulsos de treino para atravessar a temporada inteira.",
    priceCents: 2990,
    currency: "brl",
    coins: 2000,
    kind: "coins",
    contents: ["2.000 moedas creditadas na hora", "+5 relatórios de olheiro", "+2 impulsos de treino"],
    accent: "#ffd977",
    accent2: "#7a4a08",
  },
  {
    key: "coins_large",
    priceId: "coins_large",
    name: "Cofre de moedas",
    tagline: "Para quem joga várias temporadas",
    description:
      "4.800 moedas, 10 relatórios, 5 impulsos de treino e o tema dourado exclusivo. O melhor custo por real.",
    priceCents: 5990,
    currency: "brl",
    coins: 4800,
    kind: "coins",
    contents: ["4.800 moedas creditadas na hora", "+10 relatórios e +5 impulsos de treino", "Tema dourado exclusivo", "Melhor custo por real da loja"],
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
    coins: 150,
    kind: "cosmetic",
    contents: ["8 comemorações novas em 3D", "Câmera exclusiva no replay", "+150 moedas de bônus"],
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
    coins: 150,
    kind: "cosmetic",
    contents: ["6 cortes de gramado", "Bandeirões e mosaicos da torcida", "+150 moedas de bônus"],
    accent: "#34d399",
    accent2: "#064e3b",
  },
  {
    key: "scout_pack",
    priceId: "scout_pack",
    name: "Pacote de olheiros",
    tagline: "Enxergue o jogador antes dos rivais",
    description:
      "15 relatórios premium com potencial e personalidade revelados, mais 1 impulso de treino.",
    priceCents: 1490,
    currency: "brl",
    coins: 0,
    kind: "scout",
    contents: ["15 relatórios premium", "Cada um mapeia 5 joias de até 23 anos", "+1 impulso de treino"],
    accent: "#57b6ff",
    accent2: "#0f3f6b",
  },
  {
    key: "training_pack",
    priceId: "training_pack",
    name: "Pacote de treino",
    tagline: "Semanas de trabalho concentradas",
    description:
      "10 impulsos de treino que se somam semana a semana, mais 3 relatórios de olheiro.",
    priceCents: 1490,
    currency: "brl",
    coins: 0,
    kind: "training",
    contents: ["10 impulsos de treino", "+25% de evolução e +5 de recuperação por semana", "Impulsos se somam", "+3 relatórios de olheiro"],
    accent: "#4ade80",
    accent2: "#14532d",
  },
  {
    key: "theme_pack",
    priceId: "theme_pack",
    name: "Pacote de temas",
    tagline: "O jogo com a cara do seu clube",
    description:
      "Temas dourado, carbono e neon, corte de gramado exclusivo e 300 moedas de bônus.",
    priceCents: 1990,
    currency: "brl",
    coins: 300,
    kind: "cosmetic",
    contents: ["Temas dourado, carbono e neon", "Corte de gramado exclusivo", "+300 moedas de bônus"],
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
    contents: ["300 moedas toda semana", "Relatórios premium ilimitados", "Cancele quando quiser"],
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
