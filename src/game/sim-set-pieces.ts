/**
 * Bolas paradas da partida (pênalti, falta direta e escanteio).
 * Extraído de sim.ts sem mudar a ordem dos sorteios: cada função recebe a
 * própria MatchSim, então sementes e replays continuam idênticos.
 */
import type { MatchSim } from "./sim";
import type { Side } from "./sim-contracts";

export type SetPieceHost = Pick<
  MatchSim,
  | "attackDir"
  | "ball"
  | "ballSpin"
  | "ballVy"
  | "bestTaker"
  | "exemptUntil"
  | "lastPass"
  | "lastTouch"
  | "looseTime"
  | "minute"
  | "pass"
  | "pendingShot"
  | "players"
  | "pushEvent"
  | "recordShot"
  | "restartFor"
  | "restartTimer"
  | "rnd"
  | "scheduleRestart"
  | "setPiece"
  | "setup"
  | "stats"
  | "synchronizeBallPhysics"
  | "time"
  | "trigger"
>;

export function setupPenalty(sim: SetPieceHost, side: Side) {
  const dir = sim.attackDir(side);
  const goalX = dir * FIELD_X;
  const taker = sim.bestTaker(side, "shooting");
  const gk = sim.players.find((p) => p.side !== side && p.pos === "GK" && !p.sentOff) ?? null;
  if (!taker) return;
  taker.x = goalX - dir * PENALTY_DIST;
  taker.z = 0.6;
  taker.vx = 0;
  taker.vz = 0;
  if (gk) {
    gk.x = goalX - dir * 0.8;
    gk.z = 0;
    gk.vx = 0;
    gk.vz = 0;
  }
  // todo mundo a 9,15 m da marca
  for (const p of sim.players) {
    if (p === taker || p === gk || p.sentOff) continue;
    const d = Math.hypot(p.x - (goalX - dir * PENALTY_DIST), p.z);
    if (d < 9.5) {
      const ang = Math.atan2(p.z, p.x - (goalX - dir * PENALTY_DIST));
      p.x = goalX - dir * PENALTY_DIST + Math.cos(ang) * 10.5;
      p.z = Math.sin(ang) * 10.5;
    }
  }
  sim.ball.x = goalX - dir * PENALTY_DIST;
  sim.ball.z = 0;
  sim.ball.vx = 0;
  sim.ball.vz = 0;
  sim.ball.height = 0.12;
  sim.ballVy = 0;
  sim.ballSpin = 0;
  sim.ball.holder = null;
  sim.pendingShot = null;
  sim.pass = null;
  sim.setPiece = { kind: "penalty", side, takerId: taker.id, timer: 2.2 };
  sim.restartTimer = 2.6;
  sim.exemptUntil = sim.time + 3;
  sim.trigger(taker, "penalty", 2);
  sim.pushEvent({
    minute: sim.minute(),
    type: "penalty",
    side,
    text: `Pênalti para o ${sim.setup(side).short}! ${taker.name} vai para a cobrança.`,
  });
  sim.synchronizeBallPhysics();
}

export function takePenalty(sim: SetPieceHost) {
  const sp = sim.setPiece;
  if (!sp) return;
  const side = sp.side;
  const dir = sim.attackDir(side);
  const taker = sim.players.find((p) => p.id === sp.takerId) ?? null;
  const gk = sim.players.find((p) => p.side !== side && p.pos === "GK" && !p.sentOff) ?? null;
  sim.setPiece = null;
  if (!taker) {
    sim.scheduleRestart(side === "home" ? "away" : "home");
    return;
  }
  const late = sim.minute() >= 75;
  const close = Math.abs(sim.stats.home.goals - sim.stats.away.goals) <= 1;
  const out = solvePenalty({
    taker: taker.shooting,
    gk: gk?.defending ?? 60,
    pressure: late && close ? 0.7 : 0.25,
    rnd: sim.rnd,
  });
  sim.trigger(taker, "shot", 0.8);
  if (gk)
    sim.trigger(gk, out.gkSide === 0 ? "save" : out.gkSide > 0 ? "diveRight" : "diveLeft", 1.15);
  sim.lastPass[side] = null; // pênalti não tem assistência
  sim.stats[side].shots++;
  sim.stats[side].pens++;
  sim.stats[side].xg += XG_PENALTY;
  taker.shots++;
  taker.xg += XG_PENALTY;
  if (out.scored) taker.pensScored++;
  else taker.pensMissed++;
  const targetZ = out.skied
    ? Math.sign(out.takerSide || 1) * (GOAL_Z + 1.5 + sim.rnd() * 2)
    : out.takerSide * GOAL_Z * 0.72;
  const targetH = out.skied ? 3.2 + sim.rnd() * 1.5 : 0.35 + sim.rnd() * 1.3;
  const dx = dir * FIELD_X - sim.ball.x;
  const dz = targetZ - sim.ball.z;
  const d = Math.hypot(dx, dz) || 1;
  const power = 24 + sim.rnd() * 7;
  sim.ball.vx = (dx / d) * power;
  sim.ball.vz = (dz / d) * power;
  sim.ball.height = 0.25;
  const flight = Math.max(0.15, d / power);
  sim.ballVy = (targetH - 0.25) / flight + 4.905 * flight;
  sim.ballSpin = 0;
  sim.lastTouch = side;
  sim.pendingShot = {
    side,
    shooter: taker.id,
    outcome: out.scored ? "goal" : out.skied ? "off" : "saved",
    fromX: sim.ball.x,
    fromZ: sim.ball.z,
    targetZ,
    xg: XG_PENALTY,
    bigChance: true,
    bodyPart: "foot",
  };
  if (!out.scored && out.skied) {
    sim.recordShot({
      x: sim.ball.x,
      z: sim.ball.z,
      side,
      result: "off",
      minute: sim.minute(),
      name: taker.name,
      xg: XG_PENALTY,
      bigChance: true,
      bodyPart: "foot",
    });
    sim.pushEvent({
      minute: sim.minute(),
      type: "penalty",
      side,
      text: `${taker.name} isola o pênalti!`,
    });
  }
  sim.synchronizeBallPhysics();
}

export function setupDirectFK(sim: SetPieceHost, side: Side, fx: number, fz: number) {
  const dir = sim.attackDir(side);
  const goalX = dir * FIELD_X;
  const taker = sim.bestTaker(side, "shooting");
  if (!taker) return;
  taker.x = fx - dir * 1.2;
  taker.z = fz + 0.8;
  taker.vx = 0;
  taker.vz = 0;
  // barreira: 2 a 4 adversários a 9,15 m, entre a bola e o gol
  const foes = sim.players
    .filter((p) => p.side !== side && !p.sentOff && p.pos !== "GK")
    .sort((a, b) => Math.hypot(a.x - fx, a.z - fz) - Math.hypot(b.x - fx, b.z - fz));
  const wall = Math.min(foes.length, 2 + Math.floor(sim.rnd() * 3));
  const ang = Math.atan2(0 - fz, goalX - fx);
  for (let i = 0; i < wall; i++) {
    const w = foes[i]!;
    const off = (i - (wall - 1) / 2) * 0.9;
    w.x = fx + Math.cos(ang) * 9.15 - Math.sin(ang) * off;
    w.z = fz + Math.sin(ang) * 9.15 + Math.cos(ang) * off;
    w.vx = 0;
    w.vz = 0;
    sim.trigger(w, "block", 2.4);
  }
  sim.ball.x = fx;
  sim.ball.z = fz;
  sim.ball.vx = 0;
  sim.ball.vz = 0;
  sim.ball.height = 0.12;
  sim.ballVy = 0;
  sim.ballSpin = 0;
  sim.ball.holder = null;
  sim.pendingShot = null;
  sim.pass = null;
  sim.setPiece = { kind: "directFK", side, takerId: taker.id, timer: 2.4 };
  sim.restartTimer = 2.8;
  sim.exemptUntil = sim.time + 3;
  sim.trigger(taker, "freeKick", 2.2);
  sim.pushEvent({
    minute: sim.minute(),
    type: "freekick",
    side,
    text: `Falta perigosa para o ${sim.setup(side).short}. ${taker.name} na cobrança.`,
  });
  sim.synchronizeBallPhysics();
}

export function takeDirectFK(sim: SetPieceHost) {
  const sp = sim.setPiece;
  if (!sp) return;
  const side = sp.side;
  const dir = sim.attackDir(side);
  const taker = sim.players.find((p) => p.id === sp.takerId) ?? null;
  const gk = sim.players.find((p) => p.side !== side && p.pos === "GK" && !p.sentOff) ?? null;
  sim.setPiece = null;
  if (!taker) {
    sim.restartFor(side, "throwIn");
    return;
  }
  const fx = sim.ball.x;
  const fz = sim.ball.z;
  const dist = Math.hypot(dir * FIELD_X - fx, fz);
  const wall = sim.players.filter(
    (p) => p.side !== side && !p.sentOff && Math.hypot(p.x - fx, p.z - fz) < 12,
  ).length;
  const out = solveDirectFK({
    dist,
    central: Math.abs(fz) < 12,
    taker: taker.shooting,
    wall,
    gk: gk?.defending ?? 60,
    rnd: sim.rnd,
  });
  sim.trigger(taker, "shot", 0.8);
  sim.lastPass[side] = null; // falta direta não tem assistência
  sim.stats[side].shots++;
  sim.stats[side].xg += out.xg;
  taker.shots++;
  taker.xg += out.xg;
  if (out.result === "wall") {
    // explode na barreira e segue viva
    const dx = dir * FIELD_X - fx;
    const dz = out.targetZ - fz;
    const d = Math.hypot(dx, dz) || 1;
    sim.ball.vx = (dx / d) * 12;
    sim.ball.vz = (dz / d) * 12;
    sim.ballVy = 2.5;
    sim.lastTouch = side;
    sim.looseTime = 0;
    sim.pushEvent({
      minute: sim.minute(),
      type: "freekick",
      side,
      text: `A cobrança de ${taker.name} explode na barreira!`,
    });
    sim.recordShot({
      x: fx,
      z: fz,
      side,
      result: "off",
      minute: sim.minute(),
      name: taker.name,
      xg: out.xg,
      bigChance: false,
      bodyPart: "foot",
    });
    sim.synchronizeBallPhysics();
    return;
  }
  const dx = dir * FIELD_X - fx;
  const dz = out.targetZ - fz;
  const d = Math.hypot(dx, dz) || 1;
  const power = 21 + sim.rnd() * 7;
  sim.ball.vx = (dx / d) * power;
  sim.ball.vz = (dz / d) * power;
  sim.ball.height = 0.25;
  const flight = Math.max(0.15, d / power);
  sim.ballVy = (out.targetH - 0.25) / flight + 4.905 * flight;
  sim.ballSpin = (sim.rnd() - 0.5) * 6;
  sim.lastTouch = side;
  sim.pendingShot = {
    side,
    shooter: taker.id,
    outcome: out.result,
    fromX: fx,
    fromZ: fz,
    targetZ: out.targetZ,
    xg: out.xg,
    bigChance: false,
    bodyPart: "foot",
  };
  if (out.result === "off") {
    sim.recordShot({
      x: fx,
      z: fz,
      side,
      result: "off",
      minute: sim.minute(),
      name: taker.name,
      xg: out.xg,
      bigChance: false,
      bodyPart: "foot",
    });
  }
  sim.synchronizeBallPhysics();
}

export function setupCorner(sim: SetPieceHost, side: Side) {
  // batedor vai para a bandeira; área enche dos dois lados
  const dir = sim.attackDir(side);
  const goalX = dir * FIELD_X;
  const cornerZ = Math.sign(sim.ball.z || 1) * (FIELD_Z - 0.8);
  const taker =
    sim.players
      .filter((p) => p.side === side && !p.sentOff && p.pos !== "GK")
      .sort((a, b) => b.passing - a.passing)[0] ?? null;
  if (!taker) return;
  taker.x = goalX - dir * 1.5;
  taker.z = cornerZ;
  taker.vx = 0;
  taker.vz = 0;
  const attack = sim.players
    .filter((p) => p.side === side && !p.sentOff && p !== taker && p.pos !== "GK")
    .sort((a, b) => b.physical - a.physical)
    .slice(0, 5);
  attack.forEach((p, i) => {
    p.x = goalX - dir * (6 + (i % 3) * 3.5) + (sim.rnd() - 0.5) * 2;
    p.z = (i - 2) * 3.4 + (sim.rnd() - 0.5) * 2;
  });
  const defense = sim.players
    .filter((p) => p.side !== side && !p.sentOff && p.pos !== "GK")
    .sort((a, b) => Math.hypot(a.x - goalX, a.z) - Math.hypot(b.x - goalX, b.z))
    .slice(0, 6);
  defense.forEach((p, i) => {
    p.x = goalX - dir * (4.5 + (i % 3) * 3) + (sim.rnd() - 0.5) * 2;
    p.z = (i - 2.5) * 2.8 + (sim.rnd() - 0.5) * 2;
  });
  sim.ball.x = goalX - dir * 1.2;
  sim.ball.z = cornerZ;
  sim.ball.vx = 0;
  sim.ball.vz = 0;
  sim.ball.height = 0.12;
  sim.ballVy = 0;
  sim.ballSpin = 0;
  sim.ball.holder = null;
  sim.pendingShot = null;
  sim.pass = null;
  sim.stats[side].corners++;
  sim.setPiece = { kind: "corner", side, takerId: taker.id, timer: 2.2 };
  sim.restartTimer = 2.6;
  sim.exemptUntil = sim.time + 3.5;
  sim.trigger(taker, "corner", 2);
  sim.pushEvent({
    minute: sim.minute(),
    type: "corner",
    side,
    text: `Escanteio para ${sim.setup(side).short}.`,
  });
  sim.synchronizeBallPhysics();
}

export function takeCorner(sim: SetPieceHost) {
  const sp = sim.setPiece;
  if (!sp) return;
  const side = sp.side;
  const dir = sim.attackDir(side);
  const goalX = dir * FIELD_X;
  // gol de escanteio tem assistência do batedor
  sim.lastPass[side] = { id: sp.takerId, time: sim.time };
  sim.setPiece = null;
  const attack = sim.players.filter(
    (p) => p.side === side && !p.sentOff && p.pos !== "GK" && Math.abs(p.x - goalX) < 22,
  );
  const defense = sim.players.filter(
    (p) => p.side !== side && !p.sentOff && p.pos !== "GK" && Math.abs(p.x - goalX) < 22,
  );
  const gk = sim.players.find((p) => p.side !== side && p.pos === "GK" && !p.sentOff) ?? null;
  const att = attack.reduce((s, p) => s + p.physical + p.shooting * 0.4, 0);
  const dfn = defense.reduce((s, p) => s + p.physical + p.defending * 0.4, 0);
  const duel = solveCornerDuel({
    attack: att,
    defense: dfn,
    gkComes: !!gk && sim.rnd() < 0.5,
    gk: gk?.defending ?? 60,
    rnd: sim.rnd,
  });
  if (duel.winner === "gk" && gk) {
    sim.trigger(gk, "catch", 1);
    sim.pushEvent({
      minute: sim.minute(),
      type: "corner",
      side: gk.side,
      text: `${gk.name} sai do gol e fica com o escanteio.`,
    });
    sim.scheduleRestart(gk.side);
    return;
  }
  if (duel.winner === "defense") {
    const clearer = [...defense].sort((a, b) => b.physical - a.physical)[0] ?? null;
    if (clearer) {
      sim.trigger(clearer, "headClear", 0.9);
      sim.ball.x = clearer.x;
      sim.ball.z = clearer.z;
      sim.ball.vx = -dir * (14 + sim.rnd() * 8);
      sim.ball.vz = (sim.rnd() - 0.5) * 14;
      sim.ballVy = 4 + sim.rnd() * 3;
      sim.ball.height = 1.8;
      sim.lastTouch = clearer.side;
      sim.looseTime = 0;
    }
    sim.pushEvent({
      minute: sim.minute(),
      type: "corner",
      side,
      text: `A zaga afasta o escanteio.`,
    });
    sim.synchronizeBallPhysics();
    return;
  }
  // ataque ganha: cabeçada com o xG sorteado
  const header =
    [...attack].sort((a, b) => b.physical + b.shooting - (a.physical + a.shooting))[0] ?? null;
  if (!header) {
    sim.restartFor(side, "throwIn");
    return;
  }
  sim.trigger(header, "header", 0.9);
  const goalP = duel.headerXg * 1.1;
  const onP = goalP + 0.4;
  const roll = sim.rnd();
  const outcome: "goal" | "saved" | "off" = roll < goalP ? "goal" : roll < onP ? "saved" : "off";
  sim.stats[side].shots++;
  sim.stats[side].xg += duel.headerXg;
  header.shots++;
  header.xg += duel.headerXg;
  const targetZ =
    outcome === "off"
      ? Math.sign(sim.rnd() - 0.5 || 1) * (GOAL_Z + 1 + sim.rnd() * 3)
      : (sim.rnd() - 0.5) * GOAL_Z * 1.5;
  const dx = goalX - header.x;
  const dz = targetZ - header.z;
  const d = Math.hypot(dx, dz) || 1;
  const power = headerPower(
    13 + sim.rnd() * 6,
    Math.hypot(sim.ball.vx, sim.ball.vz),
    header.physical,
  );
  sim.ball.x = header.x;
  sim.ball.z = header.z;
  sim.ball.vx = (dx / d) * power;
  sim.ball.vz = (dz / d) * power;
  sim.ball.height = 1.9;
  sim.ballVy = 0.5 + sim.rnd() * 1.5;
  sim.ballSpin = 0;
  sim.lastTouch = side;
  if (outcome === "goal" && gk) {
    const dive = targetZ - gk.z;
    sim.trigger(gk, Math.abs(dive) < 1.15 ? "save" : dive > 0 ? "diveRight" : "diveLeft", 1.1);
  }
  sim.pendingShot = {
    side,
    shooter: header.id,
    outcome,
    fromX: header.x,
    fromZ: header.z,
    targetZ,
    xg: duel.headerXg,
    bigChance: duel.headerXg > 0.12,
    bodyPart: "head",
  };
  if (outcome === "off") {
    if (sim.rnd() < 0.2) sim.lastTouch = side === "home" ? "away" : "home";
    sim.recordShot({
      x: header.x,
      z: header.z,
      side,
      result: "off",
      minute: sim.minute(),
      name: header.name,
      xg: duel.headerXg,
      bigChance: duel.headerXg > 0.12,
      bodyPart: "head",
    });
    sim.pushEvent({
      minute: sim.minute(),
      type: "shot",
      side,
      text: `${header.name} cabeceia para fora.`,
    });
  } else {
    sim.pushEvent({
      minute: sim.minute(),
      type: "shot",
      side,
      text: `${header.name} cabeceia após o escanteio!`,
    });
  }
  sim.synchronizeBallPhysics();
}
