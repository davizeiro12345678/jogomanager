/**
 * Disputas de bola: domínio, bloqueios, finalizações, drible e pressão.
 * Extraído de sim.ts sem mudar a ordem dos sorteios: cada função recebe a
 * própria MatchSim, então sementes e replays continuam idênticos.
 */
import type { MatchSim } from "./sim";
import {
  type ShotTechnique,
  blockRestitution,
  fatigueStrikeFactor,
  firstTouchSpill,
  goalkeeperCanReach,
  parryReboundSpeed,
  shotProfile,
  sweptBallPlayerContact,
} from "./match-physics-extras";
import { type Side, type SimPlayer } from "./sim-contracts";
import {
  FIELD_X,
  FIELD_Z,
  type FoulInput,
  GOAL_Z,
  cardForFoul,
  controlFailAdd,
  defensiveLineX,
  duelMult,
  foulMult,
  isOffside,
  shotProbabilities,
  woodworkAt,
  xgForShot,
} from "./sim-rules";

/**
 * Primeiro toque. Bola forte ou alta pode escapar do controle e sobrar viva —
 * o jogador toca nela em vez de a bola simplesmente colar no pé.
 */
export function controlBall(sim: MatchSim, p: SimPlayer, ballSpeed: number, h: number) {
  const isReceiver = sim.pass?.to === p.id;
  // corte no caminho: adversário que chega no passe soma interceptação
  if (sim.pass && !isReceiver && p.side !== sim.pass.side) {
    p.interceptions++;
    sim.stats[p.side].interceptions++;
  }
  // Revision 2 uses the teammate's touch, including another receiver or rebound.
  // Existing matches retain their exact reception-time rule and RNG order.
  const offside =
    sim.rulesRevision === 2
      ? sim.offsideAtContact(p)
      : !!sim.pass &&
        isReceiver &&
        sim.time > sim.exemptUntil &&
        (p.x - sim.pass.fromX) * sim.pass.dir > 1 &&
        isOffside(p.x, defensiveLineX(sim.players, p.side), sim.pass.dir);
  if (offside) {
    p.offsides++;
    sim.stats[p.side].offsides++;
    sim.pass = null;
    sim.ball.vx = 0;
    sim.ball.vz = 0;
    sim.ballVy = 0;
    sim.ball.height = 0.12;
    sim.trigger(p, "protest", 1.2);
    sim.pushEvent({
      minute: sim.minute(),
      type: "offside",
      side: p.side,
      text: `Impedimento de ${p.name}.`,
    });
    // infração: a defesa fica com a bola no local
    sim.restartFor(
      p.side === "home" ? "away" : "home",
      sim.rulesRevision === 2 ? "indirectFK" : "throwIn",
    );
    return;
  }
  const skill = (p.passing * 0.5 + p.physical * 0.3 + p.defending * 0.2) / 100;
  const difficulty = ballSpeed / 34 + (h > 0.9 ? 0.28 : 0) + controlFailAdd(sim.weather);
  const ok = isReceiver
    ? sim.rnd() < 0.62 + skill * 0.42 - difficulty * 0.5
    : sim.rnd() < 0.45 + skill * 0.45 - difficulty * 0.55;

  sim.trigger(p, h > 0.9 ? "header" : "trap", 0.5);
  sim.lastTouch = p.side;
  sim.pass = null;
  sim.ballVy = 0;
  sim.ballSpin = 0;

  if (ok) {
    sim.noteOffsideControl(p);
    sim.ball.holder = p.id;
    sim.possession = p.side;
    sim.ball.vx = 0;
    sim.ball.vz = 0;
    sim.ball.height = 0.12;
    sim.looseTime = 0;
    if (isReceiver) sim.stats[p.side].passesOk++;
    sim.synchronizeBallPhysics();
    return;
  }

  // toque mal dado: a bola sobra à frente, ainda em disputa
  sim.noteOffsideDeflection(p);
  const dirx = sim.attackDir(p.side);
  const spill = firstTouchSpill(2.6 + sim.rnd() * 3.4, ballSpeed, sim.weather);
  const ang = (sim.rnd() - 0.5) * 1.4;
  sim.ball.holder = null;
  sim.ball.vx = Math.cos(ang) * spill * dirx;
  sim.ball.vz = Math.sin(ang) * spill;
  sim.ball.height = h > 0.9 ? 0.9 : 0.12;
  sim.ballVy = h > 0.9 ? 1.4 : 0;
  sim.looseTime = 0.4;
  const pressingSide: Side = p.side === "home" ? "away" : "home";
  sim.pressSurge[pressingSide] = Math.max(sim.pressSurge[pressingSide], 2.5);
  sim.synchronizeBallPhysics();
}

/**
 * Defesa ativa: um adversário no caminho pode bloquear o chute/passe.
 * Devolve verdadeiro quando a jogada foi encerrada aqui.
 */
export function tryBlock(
  sim: MatchSim,
  dt: number,
  previous?: { x: number; z: number; height: number },
): boolean {
  const speed = Math.hypot(sim.ball.vx, sim.ball.vz);
  if (speed < 8 || (sim.contactPhysicsRevision !== 2 && sim.ball.height > 1.9)) return false;
  const attacking = sim.pendingShot?.side ?? (sim.pass ? sim.lastTouch : null);
  if (!attacking) return false;

  for (const p of sim.players) {
    if (p.side === attacking || p.pos === "GK" || p.sentOff) continue;
    const swept =
      sim.contactPhysicsRevision === 2 && previous
        ? sweptBallPlayerContact(previous.x, previous.z, sim.ball.x, sim.ball.z, p.x, p.z, 1.25)
        : null;
    if (sim.contactPhysicsRevision === 2 && previous) {
      if (!swept) continue;
      const height = previous.height + (sim.ball.height - previous.height) * swept.fraction;
      if (height > 1.9 || height < 0) continue;
    } else if (Math.hypot(p.x - sim.ball.x, p.z - sim.ball.z) > 1.25 || sim.ball.height > 1.9)
      continue;
    const chance = (0.35 + (p.defending / 100) * 0.5) * Math.min(1, dt * 30);
    if (sim.rnd() > chance) continue;

    // Move the v2 collision to the actual swept contact point before the
    // rebound. A fast ball cannot jump the defender and then rebound metres
    // ahead of the athlete. Historical revision-1 games stay unchanged.
    if (swept && previous) {
      sim.ball.x = previous.x + (sim.ball.x - previous.x) * swept.fraction;
      sim.ball.z = previous.z + (sim.ball.z - previous.z) * swept.fraction;
      sim.ball.height = previous.height + (sim.ball.height - previous.height) * swept.fraction;
    }
    const slide = sim.rnd() < 0.45;
    sim.trigger(p, slide ? "slide" : "block", 0.7);
    p.tackles++;
    sim.noteOffsideDeflection(p);
    sim.lastTouch = p.side;
    const wasShot = !!sim.pendingShot;
    sim.pendingShot = null;
    sim.pass = null;
    // rebote: a bola volta desviada e perde muita força
    const ang = Math.atan2(sim.ball.vz, sim.ball.vx) + Math.PI + (sim.rnd() - 0.5) * 1.6;
    const back = speed * (0.2 + sim.rnd() * 0.25) * blockRestitution(slide, p.weightKg);
    sim.ball.vx = Math.cos(ang) * back;
    sim.ball.vz = Math.sin(ang) * back;
    sim.ballVy = 1.6 + sim.rnd() * 2.4;
    sim.ballSpin = 0;
    sim.synchronizeBallPhysics();
    if (wasShot) {
      sim.pushEvent({
        minute: sim.minute(),
        type: "shot",
        side: attacking,
        text: `${p.name} se joga e bloqueia a finalização!`,
      });
    }
    return true;
  }
  return false;
}

/**
 * Resolve a finalização quando a bola chega à meta: gol entre as traves,
 * defesa do goleiro no plano da linha, ou segue viva para fora.
 */
export function resolveShot(
  sim: MatchSim,
  previous = { x: sim.ball.x, z: sim.ball.z, height: sim.ball.height },
): boolean {
  const s = sim.pendingShot!;
  const dir = sim.attackDir(s.side);
  const goalX = dir * FIELD_X;
  const gk = sim.goalkeeper(s.side === "home" ? "away" : "home");
  const shooter = sim.players.find((p) => p.id === s.shooter) ?? null;
  const planeX = goalX - dir * 1.6;
  const crossed =
    dir > 0
      ? previous.x < planeX && sim.ball.x >= planeX
      : previous.x > planeX && sim.ball.x <= planeX;
  const reached = crossed || (dir > 0 ? sim.ball.x >= planeX : sim.ball.x <= planeX);
  if (!reached) return false;
  // Resolve no ponto exato em que a trajetória cruza o plano da meta. Assim,
  // avanços rápidos não transformam um gol em tiro de meta por tunneling.
  const segment = sim.ball.x - previous.x;
  const ratio =
    crossed && Math.abs(segment) > 0.0001
      ? Math.max(0, Math.min(1, (planeX - previous.x) / segment))
      : 1;
  const crossingZ = previous.z + (sim.ball.z - previous.z) * ratio;
  const crossingHeight = previous.height + (sim.ball.height - previous.height) * ratio;

  // The legacy saved-outcome rule remains frozen for historical replays.
  // Revised physics checks whether the keeper really arrived at the contact
  // point; a distant dive cannot magically prevent an on-target goal.
  if (
    sim.contactPhysicsRevision === 2 &&
    s.outcome === "saved" &&
    gk &&
    !goalkeeperCanReach(gk.x, gk.z, planeX, crossingZ, crossingHeight, gk.defending, gk.stamina)
  ) {
    if (Math.abs(crossingZ) < GOAL_Z && crossingHeight < 2.44) {
      sim.pendingShot = null;
      sim.scoreGoal(s.side, shooter, s.fromX, s.fromZ, s.xg, s.bigChance, s.bodyPart);
      return true;
    }
    return sim.woodworkOrRelease(s, shooter, crossingZ, crossingHeight, dir);
  }

  // defesa do goleiro
  if (s.outcome === "saved" && gk) {
    const dive = crossingZ - gk.z;
    sim.trigger(
      gk,
      Math.abs(dive) < 1.2
        ? sim.rnd() < 0.5
          ? "catch"
          : "save"
        : dive > 0
          ? "diveRight"
          : "diveLeft",
      1.1,
    );
    gk.saves++;
    sim.noteOffsideDeflection(gk);
    sim.stats[s.side].onTarget++;
    sim.recordShot({
      x: s.fromX,
      z: s.fromZ,
      side: s.side,
      result: "saved",
      minute: sim.minute(),
      name: shooter?.name ?? "",
      xg: s.xg,
      bigChance: s.bigChance,
      bodyPart: s.bodyPart,
    });
    sim.pushEvent({
      minute: sim.minute(),
      type: "save",
      side: s.side,
      text: `${gk.name} faz a defesa em chute de ${shooter?.name ?? "o atacante"}.`,
    });
    sim.pendingShot = null;
    // metade das defesas dá rebote; a outra o goleiro segura
    if (sim.rnd() < 0.45) {
      // Historical replays preserve the old keeper positioning. The revised
      // model keeps the actual dive location: a save cannot teleport a keeper.
      if (sim.contactPhysicsRevision !== 2) {
        gk.x = sim.ball.x - dir * 0.4;
        gk.z = sim.ball.z * 0.6;
      }
      const ang = Math.atan2(sim.ball.z, -dir) + (sim.rnd() - 0.5) * 1.2;
      const back = parryReboundSpeed(
        6 + sim.rnd() * 7,
        Math.hypot(sim.ball.vx, sim.ball.vz),
        gk.physical,
      );
      sim.ball.holder = null;
      sim.ball.vx = -dir * Math.abs(Math.cos(ang) * back);
      sim.ball.vz = Math.sin(ang) * back;
      sim.ballVy = 1.8 + sim.rnd() * 2;
      sim.lastTouch = gk.side;
      sim.looseTime = 0;
    } else {
      sim.scheduleRestart(gk.side, "keeperControl");
    }
    return true;
  }

  if (s.outcome === "goal") {
    if (Math.abs(crossingZ) < GOAL_Z && crossingHeight < 2.44) {
      const shotXg = s.xg;
      const shotBig = s.bigChance;
      const shotBody = s.bodyPart;
      sim.pendingShot = null;
      sim.scoreGoal(s.side, shooter, s.fromX, s.fromZ, shotXg, shotBig, shotBody);
      return true;
    }
    // A curva/altura física pode levar uma finalização nominalmente certeira
    // para fora ou na trave. Checa a trave antes de liberar a bola.
    return sim.woodworkOrRelease(s, shooter, crossingZ, crossingHeight, dir);
  }

  // fora: checa a trave; senão a bola segue viva até a linha de fundo/lateral
  return sim.woodworkOrRelease(s, shooter, crossingZ, crossingHeight, dir);
}

/**
 * Trave viva: chute que cruza o plano da meta raspando poste/travessão vira
 * evento "Na trave!" e segue em jogo. No integrador compatível a reflexão é
 * manual (determinística pelo estado da bola, sem consumir o rng); na
 * autoridade Rapier a colisão física já aconteceu — só registra o evento.
 */
export function woodworkOrRelease(
  sim: MatchSim,
  s: NonNullable<MatchSim["pendingShot"]>,
  shooter: SimPlayer | null,
  crossingZ: number,
  crossingH: number,
  dir: number,
): boolean {
  sim.pendingShot = null;
  const hit = woodworkAt(crossingZ, crossingH);
  if (!hit) return false;
  const where = hit === "post" ? "a trave" : "o travessão";
  sim.pushEvent({
    minute: sim.minute(),
    type: "post",
    side: s.side,
    text: `NA TRAVE! ${shooter?.name ?? "O chute"} explode em ${where}!`,
  });
  sim.trigger(shooter, "protest", 1.4);
  sim.recordShot({
    x: s.fromX,
    z: s.fromZ,
    side: s.side,
    result: "off",
    minute: sim.minute(),
    name: shooter?.name ?? "",
    xg: s.xg,
    bigChance: true,
    bodyPart: s.bodyPart,
  });
  if (!sim.lastAuthoritative) {
    const speed = Math.hypot(sim.ball.vx, sim.ball.vz);
    if (hit === "post") {
      sim.ball.vx = -dir * Math.abs(sim.ball.vx) * 0.5;
      sim.ball.vz += Math.sign(crossingZ || 1) * (1.5 + Math.min(2.5, speed * 0.12));
      sim.ballVy = 1.6 + Math.min(2, speed * 0.06);
    } else {
      sim.ballVy = Math.abs(sim.ballVy) * 0.45 + 1.2;
      sim.ball.vx *= 0.55;
      sim.ball.vz *= 0.55;
    }
    sim.ballSpin = 0;
    sim.looseTime = 0;
  }
  return false;
}

export function dribble(sim: MatchSim, holder: SimPlayer, dt: number) {
  if (sim.restartTimer > 0 || sim.holdsExemptRestart(holder)) {
    const k = Math.exp(-7 * dt);
    holder.vx *= k;
    holder.vz *= k;
    return;
  }
  const dir = sim.attackDir(holder.side);
  const targetX = dir * FIELD_X;
  const dx = targetX - holder.x;
  const dz = -holder.z * 0.25 + Math.sin(sim.time * 0.9 + holder.number) * 4;
  const d = Math.hypot(dx, dz) || 1;
  const speed = (2.35 + (holder.pace / 100) * 3.55) * (0.82 + (holder.stamina / 100) * 0.18);
  const targetVx = (dx / d) * speed;
  const targetVz = (dz / d) * speed;
  const k = 1 - Math.exp(-3.4 * dt);
  holder.vx += (targetVx - holder.vx) * k;
  holder.vz += (targetVz - holder.vz) * k;
  holder.x += holder.vx * dt;
  holder.z += holder.vz * dt;
  holder.x = Math.max(-FIELD_X + 1, Math.min(FIELD_X - 1, holder.x));
  holder.z = Math.max(-FIELD_Z + 1, Math.min(FIELD_Z - 1, holder.z));
}

export function pressure(sim: MatchSim, holder: SimPlayer, dt: number) {
  const { opp, dist } = sim.nearestOpponent(holder);
  // v2 requires body/foot reach before stealing possession; a successful
  // random tackle must not transfer the ball across two metres of open field.
  const contactReach = sim.contactPhysicsRevision === 2 ? 1.08 : 2.2;
  if (!opp || dist > contactReach || sim.restartTimer > 0) return;
  // Body proximity alone is not enough: the defender must reach the actual
  // ball, otherwise a tackle on the carrier's back teleports possession.
  if (
    sim.contactPhysicsRevision === 2 &&
    Math.hypot(opp.x - sim.ball.x, opp.z - sim.ball.z) > contactReach
  )
    return;
  const press = 0.55 + sim.setup(opp.side).tactics.pressing * 0.22;
  let support = 0;
  for (const defender of sim.players) {
    if (defender.side !== opp.side || defender.id === opp.id) continue;
    // V2 counts only teammates still playing; omitted revisions keep historical
    // duel outcomes and their exact random draw order for saved replays.
    if (defender.sentOff && sim.setup(opp.side).tacticalAiRevision === 2) continue;
    if (Math.hypot(defender.x - holder.x, defender.z - holder.z) < 3.2) support += 1;
  }
  const overload = 1 + Math.min(2, support) * 0.28;
  const fatigue = 0.55 + (opp.stamina / 100) * 0.45;
  // mando e moral pesam no duelo: quem está confiante ganha mais divididas
  const ctx =
    duelMult({ home: opp.side === "home", morale: sim.setup(opp.side).morale ?? 70 }) /
    duelMult({ home: holder.side === "home", morale: sim.setup(holder.side).morale ?? 70 });
  const chance =
    ((opp.defending * 0.7 + opp.physical * 0.3) /
      (holder.pace * 0.45 + holder.physical * 0.3 + holder.passing * 0.25 + 60)) *
    press *
    overload *
    fatigue *
    ctx *
    dt *
    1.6;
  if (sim.rnd() < chance) {
    const slide = sim.rnd() < 0.4;
    sim.trigger(opp, slide ? "slide" : "tackle", slide ? 1.0 : 0.6);
    opp.tackles++;
    sim.trigger(holder, "duel", 0.5);
    if (sim.rnd() < 0.22 * foulMult(sim.weather)) {
      sim.trigger(holder, "protest", 1.4);
      sim.stats[opp.side].fouls++;
      holder.foulsWon++;
      const dirH = sim.attackDir(holder.side);
      const goalX = dirH * FIELD_X;
      const distGoal = Math.hypot(goalX - holder.x, holder.z);
      const between = sim.players.filter(
        (o) =>
          o.side === opp.side &&
          !o.sentOff &&
          o.pos !== "GK" &&
          (o.x - holder.x) * dirH > -2 &&
          Math.hypot(goalX - o.x, o.z) < distGoal,
      ).length;
      const foul: FoulInput = {
        slide,
        tactical: holder.x * dirH < -8 && Math.hypot(holder.vx, holder.vz) > 5,
        goalDenied: distGoal < 16 && between <= 1,
        rapSheet: opp.yellows,
        ref: sim.ref,
        rnd: sim.rnd,
      };
      sim.pushEvent({
        minute: sim.minute(),
        type: "foul",
        side: opp.side,
        text: `Falta de ${opp.name} sobre ${holder.name}.`,
      });
      const card = cardForFoul(foul);
      if (card === "red") sim.sendOff(opp, "entrada violenta");
      else if (card === "yellow") sim.issueYellow(opp);
      // lesão no lance: carrinho e fadiga pesam
      const hurtP = (slide ? 0.05 : 0.015) * (holder.stamina < 40 ? 1.8 : 1);
      if (sim.rnd() < hurtP) sim.injure(holder, "na dividida");
      // reinício pela zona da falta
      if (sim.inBox(holder.x, holder.z, opp.side)) sim.setupPenalty(holder.side);
      else if (distGoal < 32) sim.setupDirectFK(holder.side, holder.x, holder.z);
      else sim.restartTimer = 1.4;
      return;
    }
    sim.ball.holder = opp.id;
    sim.possession = opp.side;
    sim.lastTouch = opp.side;
    sim.noteOffsideControl(opp);
    sim.decisionTimer = 0.4;
    sim.trigger(opp, "intercept", 0.5);
    if (sim.contactPhysicsRevision === 2) sim.synchronizeBallPhysics();
    if (sim.rnd() < 0.008) sim.injure(holder, "na dividida");
  }
}

export function shoot(sim: MatchSim, holder: SimPlayer, distGoal: number) {
  sim.noteOffsideKick(holder, sim.ball.x);
  const side = holder.side;
  const dir = sim.attackDir(side);
  sim.stats[side].shots++;
  holder.shots++;
  const gk = sim.goalkeeper(side === "home" ? "away" : "home");
  const gkSkill = gk ? gk.defending * 0.7 + gk.physical * 0.3 : 60;
  const { dist: pressD } = sim.nearestOpponent(holder);
  const xg = xgForShot({
    dist: distGoal,
    wide: Math.abs(holder.z),
    bodyPart: "foot",
    pressDist: pressD,
    onRun: Math.hypot(holder.vx, holder.vz) > 5,
  });
  sim.stats[side].xg += xg;
  holder.xg += xg;

  // 1) decide o desfecho ANTES da trajetória, para que o visual corresponda ao evento
  const probabilities = shotProbabilities({
    xg,
    shooting: holder.shooting - Math.max(0, 55 - holder.stamina) * 0.08,
    goalkeeper: gkSkill,
    distance: distGoal,
  });
  const onTarget = sim.rnd() < probabilities.onTarget;
  const outcome: "goal" | "saved" | "off" = !onTarget
    ? "off"
    : sim.rnd() < probabilities.goalGivenTarget
      ? "goal"
      : "saved";

  const roll = sim.rnd();
  const technique: ShotTechnique =
    distGoal > 22
      ? "shotPower"
      : roll < 0.12
        ? "chip"
        : roll < 0.24
          ? "volley"
          : roll < 0.32
            ? "bicycle"
            : roll < 0.6
              ? "shotPlaced"
              : "shot";
  sim.trigger(holder, technique, 0.8);
  const profile = shotProfile(technique);
  sim.ball.holder = null;
  sim.lastTouch = side;
  // reação ao chute: adversários próximos congelam por uma fração de segundo
  for (const p of sim.players) {
    if (p.side === side || p.pos === "GK") continue;
    if (Math.hypot(p.x - holder.x, p.z - holder.z) < 7) {
      sim.reactionUntil.set(p.id, sim.time + 0.45 + sim.rnd() * 0.2);
    }
  }

  // 2) trajetória física: a bola voa com arco e o desfecho só acontece na meta
  const inside = (sim.rnd() - 0.5) * GOAL_Z * 1.5; // dentro das traves
  const outsideZ = Math.sign(sim.rnd() - 0.5 || 1) * (GOAL_Z + 1.2 + sim.rnd() * GOAL_Z * 1.6);
  const targetZ = outcome === "off" ? outsideZ : inside;
  // altura de chegada: no alvo sempre abaixo do travessão; fora pode ir por cima
  const baseH =
    outcome === "off" && sim.rnd() < 0.42 ? 3.0 + sim.rnd() * 1.8 : 0.25 + sim.rnd() * 1.8;
  // a cavadinha sobe mais, mas no alvo continua abaixo do travessão
  const targetH = outcome === "off" ? baseH + profile.loft : Math.min(2.2, baseH + profile.loft);

  const dx = dir * FIELD_X - holder.x;
  const dz = targetZ - holder.z;
  const d = Math.hypot(dx, dz) || 1;
  const power =
    (24 + (holder.shooting / 100) * 13 + sim.rnd() * 6) *
    profile.power *
    fatigueStrikeFactor(holder.stamina);
  sim.ball.vx = (dx / d) * power;
  sim.ball.vz = (dz / d) * power;
  sim.ball.height = 0.25;
  const flight = Math.max(0.15, d / power);
  // vy resolvido pela balística: sai baixo e chega na altura pretendida
  sim.ballVy = (targetH - 0.25) / flight + 4.905 * flight;
  sim.ballSpin = (sim.rnd() - 0.5) * (distGoal > 20 ? 7 : 3) * profile.spin;

  sim.pendingShot = {
    side,
    shooter: holder.id,
    outcome,
    fromX: holder.x,
    fromZ: holder.z,
    targetZ,
    xg,
    bigChance: xg > 0.25,
    bodyPart: "foot",
  };
  if (gk && outcome === "saved") {
    const dive = targetZ - gk.z;
    sim.trigger(gk, Math.abs(dive) < 1.15 ? "save" : dive > 0 ? "diveRight" : "diveLeft", 1.15);
  }
  sim.restartTimer = 0.35;

  if (outcome === "off") {
    // parte das finalizações erradas desvia na defesa e vira escanteio
    if (sim.rnd() < 0.22) sim.lastTouch = side === "home" ? "away" : "home";
    sim.recordShot({
      x: holder.x,
      z: holder.z,
      side,
      result: "off",
      minute: sim.minute(),
      name: holder.name,
      xg,
      bigChance: xg > 0.25,
      bodyPart: "foot",
    });
    sim.pushEvent({
      minute: sim.minute(),
      type: "shot",
      side,
      text: `${holder.name} finaliza para fora.`,
    });
  }
  sim.synchronizeBallPhysics();
}
