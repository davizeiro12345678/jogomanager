import { customPlayersFor, toGamePlayer } from "@/lib/customData";
import { realSquadFor } from "@/lib/realSquads";
import { valueFor, wageFor } from "./economy";
import { defaultStaff } from "./events";
import { makeRng } from "./rng";
import { buildSquad } from "./squad";
import { applyImportedSquad } from "./squad-import";
import type { JobOffer, Player, ScoutReport, TransferOffer } from "./types";

const PERSONALITIES = [
  "líder",
  "profissional",
  "ambicioso",
  "temperamental",
  "caseiro",
  "determinado",
] as const;

/**
 * Elenco pronto para jogo: montado a partir do catálogo e já enriquecido com
 * salário, valor de mercado, potencial e personalidade. Sem esta etapa as telas
 * de partida rápida mostravam `€0` de valor e salário, porque `buildSquad`
 * entrega os campos zerados.
 */
export function buildReadySquad(clubId: string): Player[] {
  return buildSquad(clubId).map(enrichPlayer);
}

export function enrichPlayer(p: Player): Player {
  const rnd = makeRng(`pl-${p.id}`);
  return {
    ...p,
    wage: p.wage > 0 ? p.wage : wageFor(p.ovr),
    value: p.value > 0 ? p.value : valueFor(p.ovr, p.age),
    yellows: p.yellows ?? 0,
    suspended: p.suspended ?? false,
    injuryWeeks: p.injuryWeeks ?? 0,
    potential:
      p.potential ??
      Math.min(
        99,
        p.ovr +
          (p.age <= 20
            ? 6 + Math.floor(rnd() * 8)
            : p.age <= 24
              ? 3 + Math.floor(rnd() * 6)
              : Math.floor(rnd() * 3)),
      ),
    personality: p.personality ?? PERSONALITIES[Math.floor(rnd() * PERSONALITIES.length)]!,
    form: p.form ?? Math.round((p.morale + p.condition) / 2),
    contractYears: p.contractYears ?? 1 + Math.floor(rnd() * 4),
    releaseClause:
      p.releaseClause ?? Math.round(valueFor(p.ovr, p.age) * (1.8 + rnd() * 1.4) * 10) / 10,
    unhappy: p.unhappy ?? false,
  };
}

export function defaultV3(club: { strength: number } | undefined) {
  const s = club?.strength ?? 70;
  return {
    fanApproval: 62,
    pressure: 25,
    staff: defaultStaff(),
    sponsor: Math.round(s * 0.02 * 100) / 100,
    ticketPrice: 45,
    capacity: Math.round(12000 + s * 700),
    streak: 0,
    offers: [] as TransferOffer[],
    jobOffers: [] as JobOffer[],
    scoutReports: [] as ScoutReport[],
    sacked: false,
  };
}

/**
 * Junta os jogadores cadastrados pelo usuário ao elenco gerado.
 * Cada cadastro entra no lugar do jogador mais fraco da mesma posição
 * (ou simplesmente do mais fraco), mantendo o tamanho do plantel.
 */
export function withCustomPlayers(clubId: string, squad: Player[]): Player[] {
  const custom = customPlayersFor(clubId);
  if (custom.length === 0) return squad;
  const list = [...squad];
  const usedNumbers = new Set(list.map((p) => p.number));

  custom.forEach((cp) => {
    let num = 2;
    while (usedNumbers.has(num) && num < 40) num++;
    usedNumbers.add(num);
    const player = enrichPlayer(toGamePlayer(cp, num));

    const samePos = list.filter((p) => p.pos === cp.pos).sort((a, b) => a.ovr - b.ovr)[0];
    const weakest = [...list].sort((a, b) => a.ovr - b.ovr)[0];
    const target = samePos ?? weakest;
    const idx = target ? list.findIndex((p) => p.id === target.id) : -1;
    if (idx >= 0) list[idx] = player;
    else list.push(player);
  });

  return list;
}

/**
 * Aplica os nomes reais importados das APIs por cima do elenco gerado.
 * A força de cada jogador continua vindo do balanceamento do jogo; o que muda
 * é quem veste a camisa: nome, idade, número, nacionalidade e foto.
 */
export function withRealPlayers(clubId: string, squad: Player[]): Player[] {
  return applyImportedSquad(clubId, squad, realSquadFor(clubId)).map(enrichPlayer);
}
