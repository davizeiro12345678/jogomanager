import { valueFor } from "./economy";
import { makeRng } from "./rng";
import { developedPlayer, profileFor } from "./attributes";
import type { AttrDeltas } from "./attributes";
import { developmentResponse, effectivePlayer, FOCUS_ATTRIBUTES, limitedDevelopmentDelta } from "./player-development";
import { operatingPlanFor } from "./finance-forecast";
import type { CareerState, NewsItem, Player, TrainingFocus } from "./types";

export function trainingAttr(focus: TrainingFocus): keyof Player {
  switch (focus) {
    case "ataque":
      return "shooting";
    case "defesa":
      return "defending";
    case "fisico":
      return "physical";
    case "tecnica":
      return "passing";
    default:
      return "pace";
  }
}

export function applyWeeklyDevelopment(
  players: Record<string, Player>,
  state: CareerState,
  won: boolean | null,
  seed: string,
  livePids: Set<string> = new Set(),
  matchPlayed = true,
  evaluatedAt: number | string = Date.now(),
): { players: Record<string, Player>; news: NewsItem[]; attrDeltas: AttrDeltas } {
  const rnd = makeRng(seed);
  const news: NewsItem[] = [];
  const attr = trainingAttr(state.training);
  const intensity = state.trainingIntensity ?? 1;
  const operatingPlan = operatingPlanFor(state);
  const baseRegen = state.training === "fisico" ? 16 : state.training === "equilibrado" ? 12 : 9;
  // treino leve recupera mais e evolui menos; treino intenso é o contrário
  // Impulso semanal comprado na loja: +25% de treino e +5 de recuperação.
  const boosted =
    !!state.boostUntil && new Date(state.boostUntil).getTime() > new Date(evaluatedAt).getTime();
  const condRegen =
    baseRegen +
    (intensity === 0 ? 5 : intensity === 2 ? -5 : 0) +
    (boosted ? 5 : 0) +
    operatingPlan.medical * 0.8;
  const growthMult =
    (0.75 + intensity * 0.3) * (boosted ? 1.25 : 1) * (1 + operatingPlan.academy * 0.035);
  const injuryMult = (0.7 + intensity * 0.4) * (1 - operatingPlan.medical * 0.055);

  const next: Record<string, Player> = {};
  const attrDeltas: AttrDeltas = { ...(state.attrDeltas ?? {}) };
  for (const [id, p] of Object.entries(players)) {
    if (p.clubId !== state.clubId) {
      next[id] = p;
      continue;
    }
    const q = { ...withDevelopmentBase(p, state.developmentRulesVersion === 2 ? 2 : 1) };
    const detailed = profileFor(q, state).attrs;
    const fitnessRecovery = Math.max(-1.5, Math.min(1.5, (detailed.naturalFitness - 65) * 0.04));
    const resilience = Math.max(0.85, Math.min(1.15, 1 - (detailed.injuryResistance - 65) * 0.006));

    // recuperação de lesão e suspensão cumprida
    if (q.injuryWeeks > 0) {
      q.injuryWeeks = Math.max(0, q.injuryWeeks - 1);
      if (q.injuryWeeks === 0) {
        news.push({
          id: `heal-${id}-${state.round}`,
          season: state.season,
          round: state.round,
          kind: "lesao",
          title: `${q.name} recuperado`,
          body: `${q.name} está liberado pelo departamento médico e volta aos treinos.`,
        });
      }
    }
    if (q.suspended) q.suspended = false;

    // condição e moral
    q.condition = Math.max(
      45,
      Math.min(100, q.condition + condRegen + fitnessRecovery - 4 + Math.floor(rnd() * 6)),
    );
    q.morale = Math.max(
      30,
      Math.min(99, q.morale + (won === null ? 0 : won ? 3 : -2) + Math.floor(rnd() * 5) - 2),
    );

    // desenvolvimento por idade
    if (state.developmentRulesVersion === 2) {
      // Keep the established weekly chance; only the successful skill gain changes.
      if (q.age <= 23 && rnd() < 0.16 * growthMult) {
        const response = developmentResponse(
          effectivePlayer(q, state),
          intensity,
          profileFor(q, state),
        );
        const keys =
          q.pos === "GK" && state.training === "defesa"
            ? (["reflexes", "handling", "oneOnOnes", "commandOfArea"] as const)
            : FOCUS_ATTRIBUTES[state.training];
        const changes = Object.fromEntries(
          keys.map((key, index) => [key, (index === 0 ? 0.2 : 0.1) * response]),
        );
        attrDeltas[id] = limitedDevelopmentDelta(q, { ...state, attrDeltas }, changes);
      }
    } else if (q.age <= 23 && rnd() < 0.16 * growthMult) {
      (q as unknown as Record<string, number>)[attr] = Math.min(99, (q[attr] as number) + 1);
      if (rnd() < 0.35) {
        q.ovr = Math.min(99, Math.max(p.ovr, p.potential ?? 99), q.ovr + 1);
        news.push({
          id: `grow-${id}-${state.round}`,
          season: state.season,
          round: state.round,
          kind: "sistema",
          title: `${q.name} evolui para ${q.ovr}`,
          body: `O jovem talento respondeu bem ao treino focado em ${state.training}.`,
        });
      }
    } else if (q.age >= 33 && rnd() < 0.1) {
      q.ovr = Math.max(50, q.ovr - 1);
    }

    // cartões e lesões da rodada (somente quem jogou; ao vivo já trouxe os dados)
    const played = state.lineup.includes(id) || state.bench.slice(0, 3).includes(id);
    const fromLive = livePids.has(id);
    if (matchPlayed && played && !fromLive) {
      if (rnd() < 0.11) {
        q.yellows += 1;
        if (q.yellows >= 3) {
          q.yellows = 0;
          q.suspended = true;
          news.push({
            id: `susp-${id}-${state.round}`,
            season: state.season,
            round: state.round,
            kind: "cartao",
            title: `${q.name} suspenso`,
            body: `Terceiro cartão amarelo: ${q.name} desfalca o time na próxima rodada.`,
          });
        }
      }
      if (rnd() < 0.045 * injuryMult * resilience) {
        q.injuryWeeks = 1 + Math.floor(rnd() * 4);
        news.push({
          id: `inj-${id}-${state.round}`,
          season: state.season,
          round: state.round,
          kind: "lesao",
          title: `${q.name} se lesiona`,
          body: `${q.name} será desfalque por aproximadamente ${q.injuryWeeks} rodada(s).`,
        });
      }
    }
    // desgaste físico vale para todo mundo que jogou, inclusive ao vivo
    if (played) {
      q.condition = Math.max(40, q.condition - 8 - Math.floor(rnd() * 8));
    }

    const effective = developedPlayer(q, { ...state, attrDeltas });
    effective.value = valueFor(effective.ovr, effective.age, {
      economyRulesVersion: state.economyRulesVersion,
      potential: effective.potential,
      contractYears: effective.contractYears,
    });
    next[id] = effective;
  }
  return { players: next, news, attrDeltas };
}
