/**
 * Plain-language career value of each store offer, shown before checkout.
 * Rates come from the wallet rules the database enforces, so the shop never
 * promises more than the game actually delivers.
 */
import {
  CAREER_SERVICES,
  COIN_EXCHANGE,
  INJURY_RECOVERY_WEEKS,
  PREMIUM_SCOUT_REPORT_SIZE,
  SEASON_PASS_WEEKLY_COINS,
} from "@/lib/wallet-rules";

export interface OfferContents {
  coins: number;
  scoutReports: number;
  trainingBoosts: number;
  injuryTreatments: number;
  opponentReports: number;
  themes: string[];
}

export interface CareerBenefit {
  kind: "coins" | "scout" | "training" | "cosmetic" | "pass" | "medical" | "tactical";
  title: string;
  detail: string;
}

export interface CareerValue {
  /** One sentence: what changes in the career. */
  headline: string;
  benefits: CareerBenefit[];
  /** Coins the same items would cost through the in-game exchange (0 when not comparable). */
  coinEquivalent: number;
}

/** Training boost effect, kept in sync with the boost activation server function. */
export const TRAINING_BOOST_DAYS = 7;
export const TRAINING_BOOST_EVOLUTION_PCT = 25;
export const TRAINING_BOOST_RECOVERY = 5;

const THEME_LABELS: Record<string, string> = {
  celebration_extra: "comemorações extras",
  stadium_mow: "cortes de gramado",
  stadium_tifo: "mosaicos da torcida",
  premium_gold: "tema dourado",
  premium_carbon: "tema carbono",
  neon_stadium: "estádio neon",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const fmt = (n: number) => n.toLocaleString("pt-BR");

export function parseOfferContents(raw: unknown): OfferContents | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  return {
    coins: num(r["coins"]),
    scoutReports: num(r["scoutReports"]),
    trainingBoosts: num(r["trainingBoosts"]),
    injuryTreatments: num(r["injuryTreatments"]),
    opponentReports: num(r["opponentReports"]),
    themes: Array.isArray(r["themes"])
      ? r["themes"].filter((t): t is string => typeof t === "string")
      : [],
  };
}

/** Annual pass is charged as 10 monthly payments for 12 months of pass. */
export const ANNUAL_PASS_PAID_MONTHS = 10;

export function careerValue(
  kind: string,
  contents: OfferContents | null,
  options: { annual?: boolean } = {},
): CareerValue {
  if (kind === "pass") {
    const monthly = SEASON_PASS_WEEKLY_COINS * 4;
    return {
      headline: options.annual
        ? `12 meses de passe pelo preço de ${ANNUAL_PASS_PAID_MONTHS}.`
        : "Recursos todo mês enquanto a assinatura estiver ativa.",
      benefits: [
        {
          kind: "coins",
          title: `${fmt(SEASON_PASS_WEEKLY_COINS)} moedas por semana`,
          detail: `Cerca de ${fmt(monthly)} por mês para trocar por relatórios ou impulsos de treino.`,
        },
        {
          kind: "scout",
          title: "Relatórios de olheiro sem limite",
          detail: `Cada relatório revela potencial e personalidade de ${PREMIUM_SCOUT_REPORT_SIZE} jovens de até 23 anos.`,
        },
        {
          kind: "pass",
          title: options.annual ? "2 meses grátis" : "Cancele quando quiser",
          detail: options.annual
            ? "Pagamento único por ano; os benefícios valem até o fim do ano pago."
            : "Os benefícios valem até o fim do mês pago.",
        },
      ],
      coinEquivalent: monthly,
    };
  }
  const c = contents ?? {
    coins: 0,
    scoutReports: 0,
    trainingBoosts: 0,
    injuryTreatments: 0,
    opponentReports: 0,
    themes: [],
  };
  const benefits: CareerBenefit[] = [];
  if (c.injuryTreatments > 0) {
    benefits.push({
      kind: "medical",
      title: plural(c.injuryTreatments, "tratamento de lesão", "tratamentos de lesão"),
      detail: `Cada um tira ${INJURY_RECOVERY_WEEKS} semanas da lesão de um jogador. Ficam guardados até você usar.`,
    });
  }
  if (c.opponentReports > 0) {
    benefits.push({
      kind: "tactical",
      title: plural(c.opponentReports, "relatório do adversário", "relatórios do adversário"),
      detail: "Forma, pontos fortes e onde atacar o próximo rival. Ficam guardados até você usar.",
    });
  }
  if (c.trainingBoosts > 0) {
    benefits.push({
      kind: "training",
      title: `${plural(c.trainingBoosts, "semana", "semanas")} de treino turbinado`,
      detail: `+${TRAINING_BOOST_EVOLUTION_PCT}% de evolução do elenco e +${TRAINING_BOOST_RECOVERY} de recuperação física por semana ativa.`,
    });
  }
  if (c.scoutReports > 0) {
    benefits.push({
      kind: "scout",
      title: plural(c.scoutReports, "relatório de olheiro", "relatórios de olheiro"),
      detail: `Até ${fmt(c.scoutReports * PREMIUM_SCOUT_REPORT_SIZE)} jovens com potencial e personalidade revelados antes dos rivais.`,
    });
  }
  if (c.coins > 0) {
    const reports = Math.floor(c.coins / COIN_EXCHANGE.scout_report);
    const boosts = Math.floor(c.coins / COIN_EXCHANGE.training_boost);
    benefits.push({
      kind: "coins",
      title: `${fmt(c.coins)} moedas`,
      detail:
        boosts > 0
          ? `Dá para trocar por até ${plural(boosts, "impulso de treino", "impulsos de treino")} ou ${plural(reports, "relatório", "relatórios")}.`
          : `Dá para trocar por ${plural(reports, "relatório de olheiro", "relatórios de olheiro")}.`,
    });
  }
  if (c.themes.length > 0) {
    benefits.push({
      kind: "cosmetic",
      title: "Visual exclusivo",
      detail: `${c.themes.map((t) => THEME_LABELS[t] ?? t.replace(/_/g, " ")).join(", ")}. Só aparência: não altera resultados.`,
    });
  }
  const coinEquivalent =
    c.coins +
    c.scoutReports * COIN_EXCHANGE.scout_report +
    c.trainingBoosts * COIN_EXCHANGE.training_boost +
    c.injuryTreatments * CAREER_SERVICES.injury_recovery.cost +
    c.opponentReports * CAREER_SERVICES.opponent_report.cost;
  const headline =
    c.injuryTreatments >= 3 && c.coins === 0
      ? "Devolve seus titulares lesionados mais cedo."
      : c.opponentReports >= 3 && c.coins === 0
        ? "Chega a cada jogo sabendo como o rival joga."
        : c.trainingBoosts >= 3
      ? "Acelera a evolução do seu elenco."
      : c.scoutReports >= 10
        ? "Encontra talentos antes dos rivais."
        : c.themes.length > 0 && c.coins <= 300
          ? "Deixa o seu clube com outra cara, sem mexer no equilíbrio do jogo."
          : "Reforça o caixa da sua carreira para usar quando precisar.";
  return { headline, benefits, coinEquivalent };
}
