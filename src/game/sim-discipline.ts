/**
 * Cartões e lesões da partida.
 * Extraído de sim.ts sem mudar a ordem dos sorteios: cada função recebe a
 * própria MatchSim, então sementes e replays continuam idênticos.
 */
import type { MatchSim } from "./sim";

export function issueYellow(sim: MatchSim, p: SimPlayer) {
  p.yellows++;
  sim.stats[p.side].yellow++;
  if (p.yellows >= 2) {
    sim.sendOff(p, "segundo amarelo");
    return;
  }
  sim.trigger(p, "protest", 1.2);
  sim.pushEvent({
    minute: sim.minute(),
    type: "yellow",
    side: p.side,
    text: `Cartão amarelo para ${p.name}.`,
  });
  // reclamação: quem parte para cima do árbitro pode tomar o segundo na hora.
  // Fluxo próprio de semente (sem deslocar o rng principal da partida).
  const dissentRnd = makeRng(`dissent-${sim.matchSeed}-${p.id}-${sim.minute()}`);
  if (dissentRnd() < 0.015 + sim.ref.strict * 0.03) {
    sim.pushEvent({
      minute: sim.minute(),
      type: "yellow",
      side: p.side,
      text: `${p.name} reclama demais e toma o segundo amarelo!`,
    });
    sim.issueYellow(p);
  }
}

/** expulsão vale de verdade: o jogador sai de campo e o time fica com 10 */
export function sendOff(sim: MatchSim, p: SimPlayer, why: string) {
  if (p.sentOff) return;
  p.sentOff = true;
  sim.stats[p.side].red++;
  sim.stoppageDebt += 1;
  p.x = Math.sign(p.x || 1) * (FIELD_X + 1);
  p.z = FIELD_Z + 1;
  p.vx = 0;
  p.vz = 0;
  if (sim.ball.holder === p.id) {
    sim.ball.holder = null;
    sim.looseTime = 0.3;
  }
  sim.pushEvent({
    minute: sim.minute(),
    type: "red",
    side: p.side,
    text: `Cartão vermelho para ${p.name} (${why})!`,
  });
}

/** lesão no lance: semanas parado, queda física e (em geral) substituição */
export function injure(sim: MatchSim, p: SimPlayer, cause: string) {
  if (p.injuryWeeks > 0 || p.sentOff) return;
  p.injuryWeeks = 1 + Math.floor(sim.rnd() * 3) + (sim.rnd() < 0.15 ? 3 : 0);
  p.stamina = Math.max(12, p.stamina - 25);
  sim.stoppageDebt += 1;
  sim.trigger(p, "dejected", 2.5);
  sim.pushEvent({
    minute: sim.minute(),
    type: "injury",
    side: p.side,
    text: `${p.name} se machuca ${cause} e preocupa.`,
  });
}
