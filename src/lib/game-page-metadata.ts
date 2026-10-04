import type { Lang } from "@/i18n/locale-catalog";
import { translateBootstrap } from "@/i18n/bootstrap-messages";
import { canonical, noindexMeta, seoMeta, SITE_NAME } from "./seo";

const ROUTE_LABELS: Record<string, string> = {
  "/match": "nav.play",
  "/dashboard": "nav.panel",
  "/club": "nav.central",
  "/squad": "nav.squad",
  "/tactics": "nav.tactics",
  "/training": "nav.training",
  "/league": "nav.league",
  "/cup": "nav.cups",
  "/transfers": "nav.market",
  "/scouting": "nav.scouting",
  "/finances": "nav.finances",
  "/board": "nav.board",
  "/stats": "nav.stats",
  "/news": "nav.news",
  "/history": "nav.history",
  "/carreira": "nav.coach",
  "/temporada-automatica": "nav.auto",
  "/conquistas": "nav.awards",
  "/perfil": "nav.profile",
  "/assistente": "nav.ai",
  "/editor": "nav.editor",
  "/chat": "nav.chat",
  "/loja": "nav.store",
  "/compras": "nav.purchases",
  "/multiplayer": "nav.versus",
  "/replays": "nav.replays",
  "/visual": "nav.visual",
  "/partida-rapida": "quick.title",
};

const DESCRIPTIONS: Record<string, readonly [string, string]> = {
  "/scouting": [
    "Consulte relatórios dos olheiros e compare alvos para reforçar seu elenco.",
    "Review scouting reports and compare transfer targets for your squad.",
  ],
  "/board": [
    "Consulte as metas da diretoria e a confiança no treinador.",
    "Review board objectives and confidence in your manager.",
  ],
  "/stats": [
    "Compare o desempenho dos jogadores e as estatísticas da temporada.",
    "Compare player performance and season statistics.",
  ],
  "/news": [
    "Leia as notícias da rodada e acompanhe os acontecimentos do clube.",
    "Read matchweek news and follow events at your club.",
  ],
  "/history": [
    "Reveja temporadas, resultados e troféus da carreira do treinador.",
    "Review seasons, results and trophies in your manager career.",
  ],
  "/carreira": [
    "Consulte a trajetória do treinador e as propostas para continuar sua carreira.",
    "Review your manager history and offers to continue your career.",
  ],
  "/temporada-automatica": [
    "Configure a simulação automática e acompanhe o avanço das rodadas.",
    "Configure automatic simulation and follow matchweek progress.",
  ],
  "/conquistas": [
    "Acompanhe as conquistas do treinador e os objetivos da carreira.",
    "Follow manager achievements and career objectives.",
  ],
  "/perfil": [
    "Consulte o perfil, a experiência e a trajetória do seu treinador.",
    "Review your manager profile, experience and career history.",
  ],
  "/assistente": [
    "Peça sugestões ao assistente de IA para analisar elenco, contratações e táticas.",
    "Ask the AI assistant for squad, transfer and tactical suggestions.",
  ],
  "/editor": [
    "Personalize clubes, jogadores e competições no editor do jogo.",
    "Customize clubs, players and competitions in the game editor.",
  ],
  "/chat": [
    "Converse com outros treinadores no chat global da comunidade.",
    "Talk to other managers in the global community chat.",
  ],
  "/loja": [
    "Consulte os itens disponíveis para sua carreira e confira os detalhes de compra.",
    "Review items available for your career and purchase details.",
  ],
  "/compras": [
    "Consulte o histórico de compras e acompanhe a entrega dos seus itens.",
    "Review purchase history and follow item delivery.",
  ],
  "/multiplayer": [
    "Crie uma sala, convide um amigo e dispute partidas online 1x1 em 3D.",
    "Create a room, invite a friend and play online 1v1 matches in 3D.",
  ],
  "/replays": [
    "Reveja os lances salvos das partidas em 3D na sua galeria de replays.",
    "Watch saved 3D match highlights in your replay gallery.",
  ],
  "/dashboard": [
    "Organize sua próxima partida, acompanhe o elenco e veja as prioridades da sua carreira de treinador.",
    "Prepare your next match, follow your squad and review your manager career priorities.",
  ],
  "/club": [
    "Acompanhe a identidade do clube, finanças, treinos, notícias e resultados da sua carreira.",
    "Follow your club identity, finances, training, news and career results.",
  ],
  "/squad": [
    "Compare jogadores, condição física e funções para escolher o elenco da próxima partida.",
    "Compare players, fitness and roles to choose the squad for your next match.",
  ],
  "/tactics": [
    "Ajuste formação, escalação e instruções do time antes de entrar em campo.",
    "Adjust formation, lineup and team instructions before kickoff.",
  ],
  "/training": [
    "Planeje os treinos e acompanhe a recuperação e o desenvolvimento dos jogadores.",
    "Plan training and follow player recovery and development.",
  ],
  "/league": [
    "Consulte classificação, calendário, aproveitamento e zonas de classificação, acesso e rebaixamento.",
    "Review standings, fixtures, points efficiency, qualification, promotion and relegation zones.",
  ],
  "/cup": [
    "Acompanhe fases, confrontos e caminhos de classificação das copas da sua carreira.",
    "Follow stages, fixtures and qualification paths in your career cups.",
  ],
  "/transfers": [
    "Busque reforços e avalie jogadores e propostas para construir seu elenco.",
    "Find reinforcements and evaluate players and offers to build your squad.",
  ],
  "/finances": [
    "Acompanhe receitas, despesas, folha salarial e orçamento do clube.",
    "Follow club revenue, expenses, wages and budget.",
  ],
  "/match": [
    "Acompanhe a partida em 3D, alterne câmeras e consulte acontecimentos e estatísticas ao vivo.",
    "Watch the match in 3D, change cameras and review live events and statistics.",
  ],
  "/visual": [
    "Ajuste gráficos, câmeras, leitura e detalhes visuais para o seu dispositivo.",
    "Adjust graphics, cameras, reading preferences and visual detail for your device.",
  ],
  "/partida-rapida": [
    "Escolha dois clubes, configure o confronto e acompanhe uma partida rápida em 3D.",
    "Choose two clubs, configure the matchup and watch a quick match in 3D.",
  ],
};

/** Open Graph uses language_REGION; script variants retain their real region. */
export function socialLocale(lang: Lang): string | null {
  const locale = new Intl.Locale(lang).maximize();
  // Macrolocales such as Esperanto's "001" are valid BCP47, but cannot be
  // represented as an Open Graph territory. HTML lang still carries the language.
  return locale.region && /^[A-Z]{2}$/.test(locale.region)
    ? `${locale.language}_${locale.region}`
    : null;
}

/** Personal gameplay pages use navigation identity, without save or player data. */
export function gamePageMetadata(pathname: string, lang: Lang, translate: (key: string) => string) {
  const path = pathname.split(/[?#]/)[0]!;
  const key = ROUTE_LABELS[path];
  if (!key) return null;
  const text = DESCRIPTIONS[path] ?? [
    "Gerencie seu clube, acompanhe o elenco e prepare a próxima conquista da sua carreira.",
    "Manage your club, follow your squad and prepare your next career achievement.",
  ];
  return {
    title: `${translate(key)} · ${SITE_NAME}`,
    description: text[lang.startsWith("pt") ? 0 : 1]!,
    locale: socialLocale(lang),
  };
}

/** Static route metadata is available before hydration and excludes personal saves. */
export function gamePageHead(path: string) {
  const page = gamePageMetadata(path, "pt-BR", (key) => translateBootstrap("pt-BR", key));
  if (!page) throw new Error(`Unknown gameplay page: ${path}`);
  return {
    meta: [...seoMeta({ title: page.title, description: page.description, path }), ...noindexMeta],
    links: canonical(path),
  };
}
