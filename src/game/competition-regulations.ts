/** Regras versionadas. Não dependem do catálogo nem do estado do renderizador. */
export const REGULATION_EDITION = "2026";
export const REGULATION_BASE_YEAR = 2026;
export type Confederation = "UEFA" | "CONMEBOL" | "CONCACAF" | "CAF" | "AFC" | "OFC";
export type TieCriterion = "wins" | "goalDifference" | "goalsFor" | "headToHead" | "redCards";
export const REGULATION_SOURCES = {
  brazil:
    "https://www.cbf.com.br/a-cbf/noticias/informes-cbf/a/cbf-anuncia-novo-calendario-do-futebol-profissional-masculino",
  serieD:
    "https://stcbfsiteprdimgbrs.blob.core.windows.net/img-site/cdn/REC_Brasileiro_Serie_D_2026_2def4ff8f2.pdf",
  capixaba:
    "https://futebolcapixaba.com/site/wp-content/uploads/2025/12/Regulamento-Serie-A-2026.pdf",
  copaBrasil:
    "https://stcbfsiteprdimgbrs.blob.core.windows.net/img-site/cdn/REC_Copa_do_Brasil_2026_66989a5426.pdf",
  england:
    "https://www.efl.com/news/2026/march/05/efl-statement--sky-bet-championship-play-off-format/",
  germany:
    "https://www.bundesliga.com/en/faq/what-are-the-rules-and-regulations-of-soccer/how-does-promotion-and-relegation-work-in-the-bundesliga-10645",
  spain: "https://www.laliga.com/noticias/quienes-juegan-el-play-off-de-ascenso",
  france: "https://ligue1.com/en/articles/l1_article_5074-",
  portugal:
    "https://www.ligaportugal.pt/backoffice/assets/FC_Porto_B_SL_Benfica_B_Jornada_34_4a7357727b.pdf",
  uefa: "https://www.uefa.com/news-media/news/02a4-2060ea59fbc5-4be94b1fbe5a-1000--access-list-track-which-sides-will-play-in-the-2026-27-uef/",
  libertadores:
    "https://cdn.conmebol.com/wp-content/uploads/2025/12/Manual-de-Clubes-CONMEBOL-Libertadores-2026-ESP.pdf",
  concacaf:
    "https://www.concacaf.com/media/jgvd55qf/2026-concacaf-champions-cup-regulations-english.pdf",
  afc: "https://assets.the-afc.com/downloads/tournament-regulations/AFC-Club-Competitions-2026-27_Slot-Allocation_24-April-2026.pdf",
  caf: "https://www.cafonline.com/competitions/caf-competitions/",
  world:
    "https://inside.fifa.com/news/all-six-fifa-member-confederations-assured-places-at-expanded-2025-fifa-club",
  intercontinental:
    "https://www.fifa.com/en/tournaments/mens/intercontinentalcup/2026/articles/teams-dates-venues-history",
} as const;

const COUNTRIES: Record<Confederation, string[]> = {
  UEFA: [
    "Inglaterra",
    "Espanha",
    "Itália",
    "Alemanha",
    "França",
    "Portugal",
    "Holanda",
    "Bélgica",
    "Turquia",
    "Escócia",
    "Grécia",
    "Suíça",
    "Áustria",
    "Dinamarca",
    "Noruega",
    "Suécia",
    "Polônia",
    "Ucrânia",
    "Croácia",
    "Sérvia",
    "Tchéquia",
    "Romênia",
    "Rússia",
    "Israel",
    "Hungria",
    "Bulgária",
    "Eslováquia",
    "Eslovênia",
    "Chipre",
    "Irlanda",
    "Finlândia",
    "Islândia",
    "País de Gales",
    "Malta",
    "Letônia",
    "Lituânia",
    "Estônia",
    "Geórgia",
    "Armênia",
    "Azerbaijão",
    "Cazaquistão",
    "Belarus",
    "Albânia",
    "Macedônia do Norte",
    "Bósnia e Herzegovina",
    "Montenegro",
    "Ilhas Faroé",
    "Andorra",
  ],
  CONMEBOL: [
    "Brasil",
    "Argentina",
    "Uruguai",
    "Chile",
    "Colômbia",
    "Peru",
    "Equador",
    "Paraguai",
    "Bolívia",
    "Venezuela",
  ],
  CONCACAF: [
    "Estados Unidos",
    "México",
    "Canadá",
    "Costa Rica",
    "Panamá",
    "Guatemala",
    "Honduras",
    "Jamaica",
  ],
  CAF: [
    "Egito",
    "Nigéria",
    "África do Sul",
    "Marrocos",
    "Argélia",
    "Tunísia",
    "Gana",
    "Quênia",
    "Angola",
    "Costa do Marfim",
    "Senegal",
    "Camarões",
    "RD Congo",
    "Zâmbia",
  ],
  AFC: [
    "Arábia Saudita",
    "Japão",
    "Austrália",
    "Coreia do Sul",
    "Catar",
    "Emirados Árabes",
    "Tailândia",
    "Indonésia",
    "Índia",
    "China",
    "Malásia",
    "Vietnã",
    "Uzbequistão",
    "Irã",
    "Iraque",
    "Jordânia",
    "Kuwait",
    "Omã",
    "Singapura",
    "Hong Kong",
    "Filipinas",
  ],
  OFC: ["Nova Zelândia"],
};
export const CONTINENTAL_NAMES: Record<Confederation, string> = {
  UEFA: "Champions League",
  CONMEBOL: "Copa Libertadores",
  CONCACAF: "CONCACAF Champions Cup",
  CAF: "CAF Champions League",
  AFC: "AFC Champions League Elite",
  OFC: "OFC Champions League",
};
export const SECONDARY_NAMES: Partial<Record<Confederation, string>> = {
  UEFA: "Europa League",
  CONMEBOL: "Copa Sul-Americana",
  CAF: "CAF Confederation Cup",
  AFC: "AFC Champions League Two",
};
export function confederationFor(country: string): Confederation | null {
  return (
    (Object.keys(COUNTRIES) as Confederation[]).find((c) => COUNTRIES[c].includes(country)) ?? null
  );
}
export function calendarYear(state: { season: number; calendarYear?: number }): number {
  return (
    state.calendarYear ??
    (state.season >= 1900 ? state.season : REGULATION_BASE_YEAR + state.season - 1)
  );
}

export interface CountryRegulation {
  country: string;
  confederation: Confederation | null;
  primary: number;
  primaryDirect: number;
  secondary: number;
  cupBerths: number;
  domesticCup: string | null;
  tieBreakers: TieCriterion[];
  source: string | null;
  adapted: boolean;
  note: string;
}
const CUPS: Record<string, string> = {
  Brasil: "Copa do Brasil",
  Inglaterra: "FA Cup",
  Espanha: "Copa del Rey",
  Itália: "Coppa Italia",
  Alemanha: "DFB-Pokal",
  França: "Coupe de France",
  Portugal: "Taça de Portugal",
  Holanda: "KNVB Beker",
  Argentina: "Copa Argentina",
  "Estados Unidos": "US Open Cup",
  Canadá: "Canadian Championship",
};
/** Vagas por associação; playoffs locais, licenças e ranking externo ainda são adaptações indicadas na UI. */
export function countryRegulation(country: string, year = REGULATION_BASE_YEAR): CountryRegulation {
  const confederation = confederationFor(country);
  let primary = 1,
    primaryDirect = 0,
    secondary = 0,
    cupBerths = 0;
  const adapted = true;
  let source: string | null = null;
  let note =
    "Vagas adaptadas ao catálogo; fases locais, licenciamento e coeficientes reais não são reproduzidos integralmente.";
  if (confederation === "CONMEBOL") {
    primary = country === "Brasil" ? 7 : country === "Argentina" ? 6 : 4;
    primaryDirect = country === "Brasil" || country === "Argentina" ? 5 : 2;
    secondary = country === "Brasil" || country === "Argentina" ? 6 : 4;
    cupBerths = country === "Brasil" && year >= 2026 ? 2 : 1;
    source = REGULATION_SOURCES.libertadores;
    note =
      "A liga e a copa nacional distribuem as vagas. Campeões continentais acrescentam vagas; acesso exige participação na primeira divisão. Apertura/Clausura e fases nacionais estão adaptados.";
  } else if (confederation === "UEFA") {
    const allocation: Record<string, [number, number, number]> = {
      Inglaterra: [4, 4, 2],
      Espanha: [4, 4, 2],
      Itália: [4, 4, 2],
      Alemanha: [4, 4, 2],
      França: [4, 3, 2],
      Holanda: [3, 2, 2],
      Portugal: [2, 1, 2],
      Bélgica: [2, 1, 1],
      Turquia: [2, 1, 1],
      Tchéquia: [2, 1, 1],
      Escócia: [2, 0, 1],
      Grécia: [2, 0, 1],
      Suíça: [2, 0, 1],
      Áustria: [2, 0, 1],
      Dinamarca: [2, 0, 1],
      Noruega: [2, 0, 1],
    };
    [primary, primaryDirect, secondary] = allocation[country] ?? [1, 0, 1];
    // As EPS são versionadas: depois de 2026, o ranking simulado da carreira decide.
    if (year === 2026 && (country === "Inglaterra" || country === "Espanha")) {
      primary++;
      primaryDirect++;
    }
    cupBerths = 1;
    source = REGULATION_SOURCES.uefa;
    note =
      "Vagas-base da associação, copa para a Europa League e uma vaga na Conference League. EPS futuras usam desempenho continental da carreira; reequilíbrios e licenciamento estão adaptados.";
    if (country === "Rússia") {
      primary = 0;
      primaryDirect = 0;
      secondary = 0;
      cupBerths = 0;
      note = "Participação em torneios UEFA suspensa nesta edição do regulamento.";
    }
  } else if (confederation === "CAF") {
    primary = [
      "Egito",
      "Marrocos",
      "África do Sul",
      "Argélia",
      "Tunísia",
      "RD Congo",
      "Angola",
      "Nigéria",
    ].includes(country)
      ? 2
      : 1;
    secondary = primary;
    primaryDirect = 0;
    cupBerths = 1;
    source = REGULATION_SOURCES.caf;
    note =
      "Campeões nacionais entram na Champions; copa nacional dá vaga na Confederation Cup. A segunda vaga depende do ranking de associações, fixado para esta edição adaptada.";
  } else if (confederation === "AFC") {
    const allocation: Record<string, [number, number, number]> = {
      "Arábia Saudita": [3, 3, 1],
      Japão: [3, 3, 1],
      "Coreia do Sul": [3, 2, 1],
      "Emirados Árabes": [3, 2, 1],
      Catar: [3, 2, 1],
      Irã: [2, 1, 1],
      Tailândia: [2, 1, 1],
      China: [2, 1, 1],
      Austrália: [1, 1, 1],
      Uzbequistão: [1, 1, 1],
      Malásia: [1, 1, 1],
    };
    [primary, primaryDirect, secondary] = allocation[country] ?? [0, 0, 2];
    cupBerths = 1;
    source = REGULATION_SOURCES.afc;
    note =
      "ACL Elite e ACL Two conforme a associação. Zonas Leste/Oeste, licenciamento e vagas extraordinárias do campeão usam formato adaptado.";
  } else if (confederation === "CONCACAF") {
    primary =
      country === "México" ? 6 : country === "Estados Unidos" ? 5 : country === "Canadá" ? 2 : 0;
    primaryDirect = primary;
    cupBerths = country === "Estados Unidos" || country === "Canadá" ? 1 : 0;
    source = REGULATION_SOURCES.concacaf;
    note =
      "MLS/Liga MX e copas dos EUA/Canadá dão vagas. América Central e Caribe disputam torneios regionais classificatórios; Leagues Cup e títulos Apertura/Clausura estão adaptados.";
  } else if (confederation === "OFC") {
    primary = 2;
    primaryDirect = 0;
    source = REGULATION_SOURCES.world;
    note =
      "Representantes disputam a Champions da Oceania. A nova liga profissional OFC e seus critérios de seleção estão adaptados ao catálogo nacional disponível.";
  }
  return {
    country,
    confederation,
    primary,
    primaryDirect,
    secondary,
    cupBerths,
    domesticCup: country === "México" ? null : (CUPS[country] ?? `Copa ${country}`),
    tieBreakers:
      country === "Brasil"
        ? ["wins", "goalDifference", "goalsFor", "headToHead", "redCards"]
        : ["Espanha", "Itália", "Portugal"].includes(country)
          ? ["headToHead", "goalDifference", "goalsFor"]
          : ["goalDifference", "goalsFor"],
    source,
    adapted,
    note,
  };
}

export interface PromotionRule {
  direct: number;
  playoff: number;
  candidates: number;
  againstUpper: boolean;
  source?: string;
  adapted?: boolean;
}
/** Cada chave é a divisão de CIMA de uma ligação explícita em pyramid.ts. */
export function promotionRule(upper: string, year = REGULATION_BASE_YEAR): PromotionRule {
  const rules: Record<string, PromotionRule> = {
    bra: {
      direct: 2,
      playoff: 2,
      candidates: 4,
      againstUpper: false,
      source: REGULATION_SOURCES.brazil,
    },
    bra2: {
      direct: 0,
      playoff: 4,
      candidates: 8,
      againstUpper: false,
      source: REGULATION_SOURCES.brazil,
    },
    bra3: {
      direct: 0,
      playoff: 6,
      candidates: 16,
      againstUpper: false,
      source: REGULATION_SOURCES.serieD,
    },
    eng: {
      direct: 2,
      playoff: 1,
      candidates: year >= 2026 ? 6 : 4,
      againstUpper: false,
      source: REGULATION_SOURCES.england,
    },
    eng2: {
      direct: 2,
      playoff: 1,
      candidates: 4,
      againstUpper: false,
      source: REGULATION_SOURCES.england,
    },
    x4396: {
      direct: 3,
      playoff: 1,
      candidates: 4,
      againstUpper: false,
      source: REGULATION_SOURCES.england,
    },
    x4397: { direct: 1, playoff: 1, candidates: 6, againstUpper: false, adapted: true },
    esp: {
      direct: 2,
      playoff: 1,
      candidates: 4,
      againstUpper: false,
      source: REGULATION_SOURCES.spain,
    },
    esp2: { direct: 2, playoff: 2, candidates: 8, againstUpper: false, adapted: true },
    ita: { direct: 2, playoff: 1, candidates: 6, againstUpper: false, adapted: true },
    ger: {
      direct: 2,
      playoff: 1,
      candidates: 1,
      againstUpper: true,
      source: REGULATION_SOURCES.germany,
    },
    ger2: {
      direct: 2,
      playoff: 1,
      candidates: 1,
      againstUpper: true,
      source: REGULATION_SOURCES.germany,
    },
    fra: {
      direct: 2,
      playoff: 1,
      candidates: 3,
      againstUpper: true,
      source: REGULATION_SOURCES.france,
    },
    por: {
      direct: 2,
      playoff: 1,
      candidates: 1,
      againstUpper: true,
      source: REGULATION_SOURCES.portugal,
    },
    por2: {
      direct: 2,
      playoff: 1,
      candidates: 1,
      againstUpper: true,
      source: REGULATION_SOURCES.portugal,
    },
    mex: { direct: 0, playoff: 0, candidates: 0, againstUpper: false, adapted: true },
    jpn: { direct: 2, playoff: 1, candidates: 4, againstUpper: false, adapted: true },
  };
  return (
    rules[upper] ?? { direct: 2, playoff: 0, candidates: 0, againstUpper: false, adapted: true }
  );
}
