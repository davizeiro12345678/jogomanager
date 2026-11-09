/**
 * Inteligência dos times: leitura do intervalo, gestão da CPU e movimentação sem bola.
 * Extraído de sim.ts sem mudar a ordem dos sorteios: cada função recebe a
 * própria MatchSim, então sementes e replays continuam idênticos.
 */
import type { MatchSim } from "./sim";
import { halfTimePlan } from "./ai-halftime";
import { advanceAthlete } from "./athlete-dynamics";
import { pitchTraction } from "./match-physics-extras";
import { positionalOverall } from "./overall";
import { type Side, type SimPlayer } from "./sim-contracts";
import {
  type AiBenchInput,
  type AiLineupInput,
  FIELD_X,
  FIELD_Z,
  GOAL_Z,
  aiMentalityTweak,
  aiSubPick,
} from "./sim-rules";
import { type Player } from "./types";

/** Intervalo: o time da CPU lê o adversário e ajusta a tática (sem sorteio). */
export function halfTimeRead(sim: MatchSim, side: Side) {
  const setup = sim.setup(side);
  if (setup.cpu === false) return;
  const foe: Side = side === "home" ? "away" : "home";
  const [home, away] = sim.possessionPct();
  const own = side === "home" ? home : away;
  const plan = halfTimePlan(
    { goals: sim.stats[side].goals, shots: sim.stats[side].shots, possession: own },
    { goals: sim.stats[foe].goals, shots: sim.stats[foe].shots, possession: 100 - own },
    setup.tactics,
    sim.setup(foe).tactics,
  );
  setup.tactics = plan.tactics;
  sim.aiTweakMin[side] = 45;
  if (plan.notes.length > 0) {
    sim.pushEvent({
      minute: 45,
      type: "talk",
      side,
      text: `No intervalo, ${setup.name ?? "o adversário"} ${plan.notes.slice(0, 2).join(" e ")}.`,
    });
  }
}

export function aiManage(sim: MatchSim, side: Side) {
  const min = sim.minute();
  // time do usuário: a IA só tira lesionado; o resto é com o treinador
  const userManaged = sim.setup(side).cpu === false;
  const foe: Side = side === "home" ? "away" : "home";
  const diff = sim.stats[side].goals - sim.stats[foe].goals;
  const lineup: AiLineupInput[] = sim.players
    .filter((p) => p.side === side)
    .map((p) => ({
      id: p.id,
      pid: p.pid,
      pos: p.pos,
      stamina: p.stamina,
      injuryWeeks: p.injuryWeeks,
      sentOff: p.sentOff,
      yellows: p.yellows,
      ovr: positionalOverall(p.pos as Player["pos"], p),
    }));
  const setupBench = sim.setup(side).bench ?? [];
  const bench: AiBenchInput[] = setupBench.map((b) => ({
    id: b.id,
    pos: b.pos,
    ovr: b.ovr,
    condition: b.condition,
    injuryWeeks: b.injuryWeeks,
    suspended: b.suspended,
  }));
  const pick = aiSubPick(lineup, bench, diff, min, sim.subsUsed[side], sim.rnd);
  if (pick && (!userManaged || pick.reason === "lesão")) {
    const incoming = setupBench.find((b) => b.id === pick.inId);
    if (incoming && sim.subsUsed[side] < 5) {
      // The successful substitution consumes its reserve atomically.
      sim.substitute(side, pick.outPid, incoming, pick.reason);
    }
  }
  // ajuste de postura no máximo a cada 10' (nunca no time do usuário)
  if (!userManaged && min - sim.aiTweakMin[side] >= 10) {
    const sentOffs = sim.players.filter((p) => p.side === side && p.sentOff).length;
    const onPitch = sim.players.filter((p) => p.side === side && !p.sentOff);
    const teamStamina =
      onPitch.reduce((sum, p) => sum + p.stamina, 0) / Math.max(1, onPitch.length);
    const tweak = aiMentalityTweak(diff, min, sentOffs, teamStamina);
    if (tweak) {
      sim.aiTweakMin[side] = min;
      const t = sim.setup(side).tactics;
      t.mentality = Math.max(0, Math.min(4, t.mentality + tweak.mentality));
      t.pressing = Math.max(0, Math.min(2, t.pressing + tweak.pressing));
    }
  }
}

/** ids dos jogadores designados a perseguir a bola solta */
export function chasers(sim: MatchSim): Set<string> {
  const set = sim.chaseIds;
  set.clear();
  if (sim.ball.holder) return set;
  for (const side of ["home", "away"] as Side[]) {
    let first: SimPlayer | null = null;
    let second: SimPlayer | null = null;
    let firstDistance = Infinity;
    let secondDistance = Infinity;
    for (const player of sim.players) {
      if (player.side !== side || player.pos === "GK" || player.sentOff) continue;
      const dx = player.x - sim.ball.x;
      const dz = player.z - sim.ball.z;
      const distance = dx * dx + dz * dz;
      if (distance < firstDistance) {
        second = first;
        secondDistance = firstDistance;
        first = player;
        firstDistance = distance;
      } else if (distance < secondDistance) {
        second = player;
        secondDistance = distance;
      }
    }
    if (first) set.add(first.id);
    if (second) set.add(second.id);
  }
  return set;
}

export function moveOffBall(sim: MatchSim, dt: number) {
  const bx = sim.ball.x;
  const bz = sim.ball.z;
  const chase = sim.chasers();
  // The holder is skipped below, so its position stays fixed throughout sim pass.
  const holder = sim.ball.holder ? sim.players.find((q) => q.id === sim.ball.holder) : undefined;

  // Urgência pelo placar e pelo relógio: quem está perdendo no fim empurra a
  // equipe para a frente; quem está ganhando recua e segura o resultado.
  const remaining = Math.max(0, 90 - sim.time / 60);
  const lateGame = remaining < 15;
  const goalDiff = sim.stats.home.goals - sim.stats.away.goals;
  const urgency = (side: Side) => {
    if (!lateGame) return 0;
    const diff = side === "home" ? goalDiff : -goalDiff;
    if (diff < 0) return Math.min(1, (15 - remaining) / 15) * (diff <= -2 ? 1 : 0.8);
    if (diff > 0) return -Math.min(1, (15 - remaining) / 15) * 0.6;
    return 0;
  };

  // Linha defensiva conjunta: a referência é o zagueiro mais recuado do lado
  // sem a bola, o que permite subir junto e armar impedimento.
  const lineX: Record<Side, number> = { home: FIELD_X, away: -FIELD_X };
  for (const q of sim.players) {
    if (q.pos === "GK" || q.sentOff) continue;
    if (q.side === "home") {
      if (q.x < lineX.home) lineX.home = q.x;
    } else if (q.x > lineX.away) lineX.away = q.x;
  }

  // Values that are the same for every player of a side are computed once per
  // call instead of 22 times; the arithmetic per player is unchanged.
  const traction = pitchTraction(sim.weather, sim.time);
  const holderId = sim.ball.holder;
  const sideContext = (side: Side) => {
    const setup = sim.setup(side);
    const attacking = sim.possession === side;
    const defendingWide = !attacking && Math.abs(bz) > FIELD_Z * 0.7;
    const surge = !attacking && sim.pressSurge[side] > 0;
    return {
      setup,
      dir: sim.attackDir(side),
      attacking,
      surge,
      widthFactor: (0.62 + setup.tactics.width * 0.14) * (defendingWide ? 0.76 : 1),
      pressLine: attacking
        ? 10 + setup.tactics.mentality * 5
        : -6 + setup.tactics.pressing * 7 + (surge ? 7 : 0),
      shift: sim.mentalityShift(side),
      urgency: urgency(side),
    };
  };
  const contexts = { home: sideContext("home"), away: sideContext("away") };

  for (const p of sim.players) {
    if (p.sentOff) continue;
    if (p.id === holderId) continue;
    const {
      setup,
      dir,
      attacking,
      surge,
      widthFactor,
      pressLine,
      shift,
      urgency: push,
    } = contexts[p.side];

    let tx = p.slotX * FIELD_X * 0.9 + shift + bx * 0.22 + pressLine * dir;
    let tz = p.slotZ * FIELD_Z * widthFactor + bz * 0.28;
    let sprint = 1;

    const ballDist = Math.hypot(bx - p.x, bz - p.z);

    if (p.pos === "GK") {
      // Goleiro acompanha ângulo e profundidade: protege o primeiro pau sem
      // abandonar a linha quando a bola ainda está longe.
      const ownGoalX = dir * -FIELD_X;
      const ballToGoal = Math.abs(bx - ownGoalX);
      const stepOut = Math.max(0, Math.min(9, (24 - ballToGoal) * 0.42));
      tx = ownGoalX + dir * stepOut;
      tz = Math.max(-GOAL_Z + 0.45, Math.min(GOAL_Z - 0.45, bz * (0.12 + stepOut * 0.022)));
      // A leitura do chute começa na batida, não apenas quando a bola cruza a
      // linha. O goleiro fecha o alvo previsto sem teletransportar ou conhecer
      // o resultado sorteado da finalização.
      const incoming = sim.pendingShot?.side !== p.side ? sim.pendingShot : null;
      if (incoming) {
        const reaction = 0.32 + p.defending / 220;
        tz += (Math.max(-GOAL_Z + 0.35, Math.min(GOAL_Z - 0.35, incoming.targetZ)) - tz) * reaction;
        tx += dir * Math.min(1.4, ballDist * 0.04);
        sprint = 1.18;
      }
      // goleiro sai da área para bola solta muito perto
      const sweepRange = 9 + setup.tactics.mentality * 1.35 + p.pace / 35;
      if (
        !sim.ball.holder &&
        !incoming &&
        ballDist < sweepRange &&
        Math.abs(bx - dir * -FIELD_X) < 18
      ) {
        tx = bx;
        tz = bz;
        sprint = 1.25;
      }
    } else if (chase.has(p.id)) {
      // interceptação: mira num ponto à frente da bola
      tx = bx + sim.ball.vx * 0.22;
      tz = bz + sim.ball.vz * 0.22;
      sprint = 1.35;
    } else if (!attacking) {
      // Linha defensiva conjunta: os defensores sobem/descem juntos em vez de
      // cada um seguir a bola por conta própria — é isso que cria a linha reta
      // e permite a armadilha de impedimento.
      if (p.pos === "DF") {
        const line = lineX[p.side];
        const trap =
          setup.tactics.pressing >= (sim.rulesRevision === 2 ? 2 : 3) && Math.abs(bx - line) > 14
            ? dir * 3.5
            : 0;
        tx = tx * 0.35 + (line + trap) * 0.65;
        // marcação por zona: cobre o adversário mais perigoso da sua faixa
        let markZ: number | null = null;
        let best = 9;
        for (const q of sim.players) {
          if (q.side === p.side || q.pos === "GK" || q.sentOff) continue;
          const gap = Math.abs(q.z - tz);
          if (gap < best && Math.abs(q.x - tx) < 16) {
            best = gap;
            markZ = q.z;
          }
        }
        if (markZ !== null) tz = tz * 0.55 + markZ * 0.45;
      }
      if (ballDist < 18) {
        const pull = p.pos === "DF" ? 0.35 : 0.6;
        tx += (bx - tx) * pull;
        tz += (bz - tz) * pull;
        sprint = (surge ? 1.3 : 1.15) * (0.82 + p.stamina / 550);
      }
      // perdendo no fim: a equipe inteira sobe para pressionar
      tx += push * 7 * dir;
    } else {
      // Movimento sem bola de verdade, em vez de balanço aleatório:
      // atacante ataca as costas da linha, ponta corta para dentro,
      // lateral faz a sobreposição e o meia oferece o apoio de recuo.
      const ahead = holder ? (holder.x - p.x) * dir : 0;
      if (p.pos === "FW") {
        const backline = lineX[p.side === "home" ? "away" : "home"];
        tx = tx * 0.4 + (backline + dir * 1.2) * 0.6;
        tz += (p.number % 2 === 0 ? 1 : -1) * 3.2;
      } else if (p.pos === "MF") {
        if (Math.abs(p.slotZ) > 0.45) {
          tz *= 0.55; // ponta cortando para dentro
          tx += dir * 4;
        } else if (ahead > 6) {
          tx -= dir * 3.5; // apoio de recuo atrás da linha da bola
        }
      } else if (p.pos === "DF" && Math.abs(p.slotZ) > 0.5 && ahead > -4) {
        // sobreposição do lateral pela linha de fundo
        tx += dir * 12;
        tz += Math.sign(p.slotZ) * 3.5;
        sprint = 1.2;
      }
      tz += Math.sin(sim.time * 0.4 + p.number) * 0.9;
      tx += push * 5 * dir;
    }

    tx = Math.max(-FIELD_X + 2, Math.min(FIELD_X - 2, tx));
    tz = Math.max(-FIELD_Z + 2, Math.min(FIELD_Z - 2, tz));

    const stam = 0.78 + (p.stamina / 100) * 0.22;
    const baseSpeed = 2.45 + (p.pace / 100) * 3.65;
    const speed = baseSpeed * (p.pos === "GK" ? 0.68 : 1) * Math.min(1.22, sprint) * stam;
    const dx = tx - p.x;
    const dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    let speedEff = speed;
    if (d > 0.001) {
      // curva de corrida: quanto maior a mudança de direção, mais o jogador reduz
      const curSpeed = Math.hypot(p.vx, p.vz);
      if (curSpeed > 2.5) {
        const dot = (dx / d) * (p.vx / curSpeed) + (dz / d) * (p.vz / curSpeed);
        // só penaliza curvas realmente fechadas (> ~100°); o resto mantém o ritmo
        if (dot < 0.2) speedEff = speed * (0.6 + 0.4 * Math.max(0, (dot + 0.2) / 1.2));
      }
      // reação tardia a um chute próximo
      if ((sim.reactionUntil.get(p.id) ?? 0) > sim.time) speedEff *= 0.3;
    }
    advanceAthlete(p, tx, tz, speedEff, dt, traction);
  }
}
