import { FORMATIONS } from "./formations";
import { makeRng } from "./rng";
import type { PlayerAction } from "./animation";
import type { MatchEventLog, Player, Tactics } from "./types";

export const FIELD_X = 52.5;
export const FIELD_Z = 34;
const GOAL_Z = 3.66;

export type Side = "home" | "away";

export interface SimPlayer {
  id: string;
  side: Side;
  name: string;
  number: number;
  pos: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  slotX: number;
  slotZ: number;
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
  stamina: number;
  /** ação de animação em curso (curta duração) */
  action: PlayerAction | null;
  /** tempo restante da ação, em segundos */
  actionT: number;
  /** duração total da ação atual */
  actionDur: number;
  /** id do jogador na carreira (sem prefixo de lado) */
  pid: string;
  goals: number;
  assists: number;
  shots: number;
  passes: number;
  tackles: number;
  saves: number;
  /** minuto em que entrou em campo */
  onSince: number;
  /** minutos jogados acumulados */
  minutes: number;
}

export interface ShotRecord {
  x: number;
  z: number;
  side: Side;
  result: "goal" | "saved" | "off";
  minute: number;
  name: string;
}

export interface PlayerRating {
  pid: string;
  side: Side;
  name: string;
  number: number;
  pos: string;
  goals: number;
  assists: number;
  passes: number;
  tackles: number;
  saves: number;
  rating: number;
}

export interface TeamSetup {
  clubId: string;
  name: string;
  short: string;
  primary: string;
  secondary: string;
  players: Player[]; // 11 titulares na ordem da formação
  tactics: Tactics;
}

export interface MatchStats {
  goals: number;
  shots: number;
  onTarget: number;
  possessionTicks: number;
  fouls: number;
}

export interface Scorer {
  minute: number;
  side: Side;
  name: string;
}

export class MatchSim {
  time = 0; // segundos de jogo
  players: SimPlayer[] = [];
  ball = { x: 0, z: 0, vx: 0, vz: 0, holder: null as string | null, height: 0 };
  possession: Side = "home";
  stats: Record<Side, MatchStats> = {
    home: { goals: 0, shots: 0, onTarget: 0, possessionTicks: 0, fouls: 0 },
    away: { goals: 0, shots: 0, onTarget: 0, possessionTicks: 0, fouls: 0 },
  };
  events: MatchEventLog[] = [];
  scorers: Scorer[] = [];
  /** finalizações registradas para o mapa de chutes */
  shotMap: ShotRecord[] = [];
  /** jogadores que saíram por substituição (mantêm estatísticas) */
  subsOut: SimPlayer[] = [];
  subsUsed: Record<Side, number> = { home: 0, away: 0 };
  /** último passador de cada lado, para creditar assistência */
  private lastPass: Record<Side, { id: string; time: number } | null> = { home: null, away: null };
  finished = false;
  lastEventId = 0;
  private decisionTimer = 0;
  private rnd: () => number;
  private restartTimer = 0;

  constructor(
    public home: TeamSetup,
    public away: TeamSetup,
    seed: string,
  ) {
    this.rnd = makeRng(seed);
    this.reset();
    this.events.push({
      minute: 0,
      type: "kickoff",
      side: "neutral",
      text: `Bola rolando no duelo entre ${home.name} e ${away.name}.`,
    });
  }

  private buildTeam(setup: TeamSetup, side: Side): SimPlayer[] {
    const slots = FORMATIONS[setup.tactics.formation];
    const dir = side === "home" ? 1 : -1;
    return setup.players.slice(0, 11).map((p, i) => {
      const slot = slots[Math.min(i, slots.length - 1)]!;
      const x = slot.x * FIELD_X * 0.92 * dir;
      const z = slot.z * FIELD_Z * 0.8 * dir;
      return {
        id: `${side}-${p.id}`,
        side,
        name: p.name,
        number: p.number,
        pos: p.pos,
        x,
        z,
        vx: 0,
        vz: 0,
        slotX: slot.x * dir,
        slotZ: slot.z * dir,
        pace: p.pace,
        shooting: p.shooting,
        passing: p.passing,
        defending: p.defending,
        physical: p.physical,
        stamina: Math.max(60, p.condition),
        action: null,
        actionT: 0,
        actionDur: 0,
        pid: p.id,
        goals: 0,
        assists: 0,
        shots: 0,
        passes: 0,
        tackles: 0,
        saves: 0,
        onSince: 0,
        minutes: 0,
      };
    });
  }

  /**
   * Troca um titular por um reserva mantendo a posição na formação.
   * Devolve falso quando o jogador que sai não está em campo.
   */
  substitute(side: Side, outPid: string, incoming: Player): boolean {
    const idx = this.players.findIndex((p) => p.side === side && p.pid === outPid);
    if (idx < 0) return false;
    const out = this.players[idx]!;
    out.minutes += this.minute() - out.onSince;
    this.subsOut.push(out);
    const fresh: SimPlayer = {
      ...out,
      id: `${side}-${incoming.id}`,
      pid: incoming.id,
      name: incoming.name,
      number: incoming.number,
      pos: incoming.pos,
      pace: incoming.pace,
      shooting: incoming.shooting,
      passing: incoming.passing,
      defending: incoming.defending,
      physical: incoming.physical,
      stamina: Math.max(70, incoming.condition),
      action: null,
      actionT: 0,
      actionDur: 0,
      goals: 0,
      assists: 0,
      shots: 0,
      passes: 0,
      tackles: 0,
      saves: 0,
      onSince: this.minute(),
      minutes: 0,
    };
    if (this.ball.holder === out.id) this.ball.holder = fresh.id;
    this.players[idx] = fresh;
    this.subsUsed[side]++;
    this.pushEvent({
      minute: this.minute(),
      type: "sub",
      side,
      text: `${this.minute()}' Substituição no ${this.setup(side).short}: entra ${incoming.name}, sai ${out.name}.`,
    });
    return true;
  }

  /** Notas de 0 a 10 de todos os jogadores que atuaram na partida. */
  playerRatings(): PlayerRating[] {
    const all = [...this.players, ...this.subsOut];
    return all.map((p) => {
      const mins = Math.max(1, p.minutes + (this.subsOut.includes(p) ? 0 : this.minute() - p.onSince));
      const conceded = this.stats[p.side === "home" ? "away" : "home"].goals;
      let r = 6;
      r += p.goals * 1.35 + p.assists * 0.85;
      r += Math.min(0.9, p.passes / 28) + Math.min(0.7, p.tackles * 0.18);
      if (p.pos === "GK") r += Math.min(1.2, p.saves * 0.28) - conceded * 0.35;
      r += (this.stats[p.side].goals - conceded) * 0.12;
      r *= 0.75 + Math.min(1, mins / 70) * 0.25;
      return {
        pid: p.pid,
        side: p.side,
        name: p.name,
        number: p.number,
        pos: p.pos,
        goals: p.goals,
        assists: p.assists,
        passes: p.passes,
        tackles: p.tackles,
        saves: p.saves,
        rating: Math.max(3, Math.min(10, Math.round(r * 10) / 10)),
      };
    });
  }

  /** Melhor jogador da partida. */
  manOfTheMatch(): PlayerRating | null {
    const rs = this.playerRatings();
    if (!rs.length) return null;
    return rs.reduce((a, b) => (b.rating > a.rating ? b : a));
  }

  reset() {
    this.players = [...this.buildTeam(this.home, "home"), ...this.buildTeam(this.away, "away")];
    this.kickoff("home");
  }

  private kickoff(side: Side) {
    this.ball.x = 0;
    this.ball.z = 0;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ball.height = 0;
    const team = this.players.filter((p) => p.side === side);
    const starter = team.find((p) => p.pos === "FW") ?? team[team.length - 1]!;
    starter.x = -0.6 * (side === "home" ? 1 : -1);
    starter.z = 0;
    this.ball.holder = starter.id;
    this.possession = side;
    this.restartTimer = 1.2;
  }

  private setup(side: Side) {
    return side === "home" ? this.home : this.away;
  }

  private attackDir(side: Side) {
    return side === "home" ? 1 : -1;
  }

  private mentalityShift(side: Side) {
    const t = this.setup(side).tactics;
    return (t.mentality - 2) * 6 * this.attackDir(side);
  }

  private pushEvent(e: MatchEventLog) {
    this.events.push(e);
    this.lastEventId++;
    if (this.events.length > 80) this.events.shift();
  }

  /** dispara uma animação curta no jogador */
  trigger(p: SimPlayer | null | undefined, action: PlayerAction, dur = 0.7) {
    if (!p) return;
    p.action = action;
    p.actionT = dur;
    p.actionDur = dur;
  }

  private tickActions(dt: number) {
    for (const p of this.players) {
      if (p.actionT > 0) {
        p.actionT -= dt;
        if (p.actionT <= 0) {
          p.actionT = 0;
          p.action = null;
        }
      }
    }
  }

  minute() {
    return Math.min(90, Math.floor(this.time / 60));
  }

  private nearestOpponent(p: SimPlayer) {
    let best: SimPlayer | null = null;
    let bestD = Infinity;
    for (const o of this.players) {
      if (o.side === p.side) continue;
      const d = (o.x - p.x) ** 2 + (o.z - p.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return { opp: best, dist: Math.sqrt(bestD) };
  }

  step(dt: number) {
    if (this.finished) return;
    this.time += dt;

    if (this.time >= 5400) {
      this.finished = true;
      this.pushEvent({
        minute: 90,
        type: "fulltime",
        side: "neutral",
        text: `Fim de jogo: ${this.home.short} ${this.stats.home.goals} x ${this.stats.away.goals} ${this.away.short}`,
      });
      return;
    }

    this.stats[this.possession].possessionTicks += dt;
    if (this.restartTimer > 0) this.restartTimer -= dt;
    this.tickActions(dt);

    this.moveOffBall(dt);
    this.moveBall(dt);

    const holder = this.ball.holder ? this.players.find((p) => p.id === this.ball.holder) : null;
    if (holder) {
      this.dribble(holder, dt);
      this.pressure(holder, dt);
      this.decisionTimer -= dt;
      if (this.decisionTimer <= 0 && this.restartTimer <= 0) {
        this.decide(holder);
        const tempo = this.setup(holder.side).tactics.tempo;
        this.decisionTimer = 1.5 - tempo * 0.35 + this.rnd() * 0.6;
      }
    }
  }

  private moveOffBall(dt: number) {
    const bx = this.ball.x;
    const bz = this.ball.z;
    for (const p of this.players) {
      if (p.id === this.ball.holder) continue;
      const setup = this.setup(p.side);
      const dir = this.attackDir(p.side);
      const attacking = this.possession === p.side;
      const widthFactor = 0.62 + setup.tactics.width * 0.14;
      const pressLine = attacking
        ? 10 + setup.tactics.mentality * 5
        : -6 + setup.tactics.pressing * 7;

      let tx = p.slotX * FIELD_X * 0.9 + this.mentalityShift(p.side) + bx * 0.22 + pressLine * dir;
      let tz = p.slotZ * FIELD_Z * widthFactor + bz * 0.28;

      if (p.pos === "GK") {
        tx = dir * -FIELD_X * 0.95 + bx * 0.04;
        tz = bz * 0.16;
      } else if (!attacking) {
        const { dist } = { dist: Math.hypot(bx - p.x, bz - p.z) };
        if (dist < 16) {
          tx += (bx - tx) * 0.55;
          tz += (bz - tz) * 0.55;
        }
      } else {
        tz += Math.sin(this.time * 0.4 + p.number) * 1.6;
      }

      tx = Math.max(-FIELD_X + 2, Math.min(FIELD_X - 2, tx));
      tz = Math.max(-FIELD_Z + 2, Math.min(FIELD_Z - 2, tz));

      const speed = (2.9 + (p.pace / 100) * 4.2) * (p.pos === "GK" ? 0.55 : 1);
      const dx = tx - p.x;
      const dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.4) {
        const step = Math.min(d, speed * dt);
        p.x += (dx / d) * step;
        p.z += (dz / d) * step;
        p.vx = dx / d;
        p.vz = dz / d;
      } else {
        p.vx *= 0.85;
        p.vz *= 0.85;
      }
    }
  }

  private moveBall(dt: number) {
    const holder = this.ball.holder ? this.players.find((p) => p.id === this.ball.holder) : null;
    if (holder) {
      this.ball.x = holder.x + holder.vx * 1.1;
      this.ball.z = holder.z + holder.vz * 1.1;
      this.ball.height = 0.12;
      return;
    }

    this.ball.x += this.ball.vx * dt;
    this.ball.z += this.ball.vz * dt;
    this.ball.vx *= 1 - 0.9 * dt;
    this.ball.vz *= 1 - 0.9 * dt;
    this.ball.height = Math.max(0.12, this.ball.height - dt * 1.2);

    if (Math.abs(this.ball.z) > FIELD_Z - 0.5) {
      this.ball.z = Math.sign(this.ball.z) * (FIELD_Z - 1);
      this.ball.vz *= -0.2;
      this.giveToNearest(this.possession === "home" ? "away" : "home");
      return;
    }
    if (Math.abs(this.ball.x) > FIELD_X - 0.5) {
      this.ball.x = Math.sign(this.ball.x) * (FIELD_X - 3);
      this.giveToNearest(this.ball.x > 0 ? "away" : "home");
      return;
    }

    // recuperação da bola solta
    let closest: SimPlayer | null = null;
    let bestD = Infinity;
    for (const p of this.players) {
      const d = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      if (d < bestD) {
        bestD = d;
        closest = p;
      }
    }
    if (closest && bestD < 1.6 && Math.hypot(this.ball.vx, this.ball.vz) < 24) {
      this.trigger(closest, this.ball.height > 0.9 ? "header" : "trap", 0.5);
      this.ball.holder = closest.id;
      this.possession = closest.side;
      this.ball.vx = 0;
      this.ball.vz = 0;
    }
  }

  private giveToNearest(side: Side) {
    let best: SimPlayer | null = null;
    let bestD = Infinity;
    for (const p of this.players) {
      if (p.side !== side) continue;
      const d = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best) {
      best.x = this.ball.x;
      best.z = this.ball.z;
      this.ball.holder = best.id;
      this.possession = side;
      this.ball.vx = 0;
      this.ball.vz = 0;
      this.restartTimer = 0.8;
      this.trigger(best, Math.abs(this.ball.z) > FIELD_Z - 2 ? "throwIn" : "corner", 0.9);
    }
  }

  private dribble(holder: SimPlayer, dt: number) {
    const dir = this.attackDir(holder.side);
    const targetX = dir * FIELD_X;
    const dx = targetX - holder.x;
    const dz = -holder.z * 0.25;
    const d = Math.hypot(dx, dz) || 1;
    const speed = 2.4 + (holder.pace / 100) * 4.4;
    holder.x += (dx / d) * speed * dt;
    holder.z += (dz / d) * speed * dt + Math.sin(this.time * 1.7 + holder.number) * dt * 1.2;
    holder.vx = dx / d;
    holder.vz = dz / d;
    holder.x = Math.max(-FIELD_X + 1, Math.min(FIELD_X - 1, holder.x));
    holder.z = Math.max(-FIELD_Z + 1, Math.min(FIELD_Z - 1, holder.z));
  }

  private pressure(holder: SimPlayer, dt: number) {
    const { opp, dist } = this.nearestOpponent(holder);
    if (!opp || dist > 2.2 || this.restartTimer > 0) return;
    const press = 0.55 + this.setup(opp.side).tactics.pressing * 0.22;
    const chance =
      ((opp.defending * 0.7 + opp.physical * 0.3) /
        (holder.pace * 0.45 + holder.physical * 0.3 + holder.passing * 0.25 + 60)) *
      press *
      dt *
      1.6;
    if (this.rnd() < chance) {
      const slide = this.rnd() < 0.4;
      this.trigger(opp, slide ? "slide" : "tackle", slide ? 1.0 : 0.6);
      this.trigger(holder, "duel", 0.5);
      if (this.rnd() < 0.22) {
        this.trigger(holder, "protest", 1.4);
        this.stats[opp.side].fouls++;
        this.pushEvent({
          minute: this.minute(),
          type: "foul",
          side: opp.side,
          text: `${this.minute()}' Falta de ${opp.name} sobre ${holder.name}.`,
        });
        this.restartTimer = 1.4;
        return;
      }
      this.ball.holder = opp.id;
      this.possession = opp.side;
      this.decisionTimer = 0.4;
      this.trigger(opp, "intercept", 0.5);
    }
  }

  private decide(holder: SimPlayer) {
    const dir = this.attackDir(holder.side);
    const goalX = dir * FIELD_X;
    const distGoal = Math.hypot(goalX - holder.x, holder.z);
    const { dist: pressDist } = this.nearestOpponent(holder);
    const mentality = this.setup(holder.side).tactics.mentality;

    const shootUrge =
      distGoal < 30
        ? (holder.shooting / 100) * (1 - distGoal / 34) * (pressDist > 2.5 ? 1.25 : 0.7)
        : 0;

    if (holder.pos !== "GK" && this.rnd() < shootUrge * 0.55) {
      this.shoot(holder, distGoal);
      return;
    }

    const mates = this.players.filter((p) => p.side === holder.side && p.id !== holder.id);
    let best: SimPlayer | null = null;
    let bestScore = -Infinity;
    for (const m of mates) {
      const dist = Math.hypot(m.x - holder.x, m.z - holder.z);
      if (dist < 4 || dist > 42) continue;
      const forward = (m.x - holder.x) * dir;
      const { dist: cover } = this.nearestOpponent(m);
      const score =
        forward * (0.7 + mentality * 0.12) + cover * 1.7 - dist * 0.32 + this.rnd() * 8;
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }

    if (!best) return;
    const dist = Math.hypot(best.x - holder.x, best.z - holder.z);
    const success = Math.min(0.96, (holder.passing / 100) * (1 - dist / 90) + 0.25);
    const dx = best.x - holder.x;
    const dz = best.z - holder.z;
    const d = Math.hypot(dx, dz) || 1;
    const power = Math.min(30, 9 + dist * 0.85);
    const err = success > this.rnd() ? 0 : (this.rnd() - 0.5) * 14;
    const wide = Math.abs(holder.z) > FIELD_Z * 0.55 && Math.abs(best.x - dir * FIELD_X) < 30;
    this.trigger(holder, wide ? "cross" : dist > 24 ? "passLong" : "pass", dist > 24 ? 0.85 : 0.6);
    this.ball.holder = null;
    this.ball.vx = (dx / d) * power + err * 0.2;
    this.ball.vz = (dz / d) * power + err;
    this.ball.height = dist > 22 ? 1.6 : 0.3;
  }

  private shoot(holder: SimPlayer, distGoal: number) {
    const side = holder.side;
    const dir = this.attackDir(side);
    this.stats[side].shots++;
    const gk = this.players.find((p) => p.side !== side && p.pos === "GK");
    const accuracy = (holder.shooting / 100) * (1 - Math.min(0.75, distGoal / 40));
    const onTarget = this.rnd() < 0.34 + accuracy * 0.55;
    const roll = this.rnd();
    this.trigger(
      holder,
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
                : "shot",
      0.8,
    );
    this.ball.holder = null;
    const targetZ = (this.rnd() - 0.5) * (onTarget ? GOAL_Z * 1.4 : GOAL_Z * 4.5);
    const dx = dir * FIELD_X - holder.x;
    const dz = targetZ - holder.z;
    const d = Math.hypot(dx, dz) || 1;
    this.ball.vx = (dx / d) * 34;
    this.ball.vz = (dz / d) * 34;
    this.ball.height = 0.8;

    if (!onTarget) {
      this.pushEvent({
        minute: this.minute(),
        type: "shot",
        side,
        text: `${this.minute()}' ${holder.name} finaliza para fora.`,
      });
      this.scheduleRestart(side === "home" ? "away" : "home");
      return;
    }

    this.stats[side].onTarget++;
    const gkSkill = gk ? gk.defending * 0.7 + gk.physical * 0.3 : 60;
    const goalChance = Math.max(0.06, Math.min(0.72, accuracy * 1.15 - gkSkill / 260));
    if (this.rnd() < goalChance) {
      this.stats[side].goals++;
      this.scorers.push({ minute: this.minute(), side, name: holder.name });
      const celeb = this.rnd();
      this.trigger(holder, celeb < 0.34 ? "kneeSlide" : celeb < 0.67 ? "celebrateRun" : "celebrate", 6);
      for (const m of this.players) {
        if (m.side === side && m.id !== holder.id) this.trigger(m, m.pos === "GK" ? "celebrate" : "hug", 5.2);
        else if (m.side !== side) this.trigger(m, "dejected", 4.4);
      }
      this.pushEvent({
        minute: this.minute(),
        type: "goal",
        side,
        text: `${this.minute()}' GOL! ${holder.name} marca para o ${this.setup(side).short}!`,
      });
      this.kickoff(side === "home" ? "away" : "home");
    } else {
      const dive = targetZ - (gk?.z ?? 0);
      this.trigger(
        gk,
        Math.abs(dive) < 1.2
          ? this.rnd() < 0.5
            ? "catch"
            : "save"
          : dive > 0
            ? "diveRight"
            : "diveLeft",
        1.1,
      );
      this.pushEvent({
        minute: this.minute(),
        type: "save",
        side,
        text: `${this.minute()}' ${gk?.name ?? "O goleiro"} faz a defesa em chute de ${holder.name}.`,
      });
      this.scheduleRestart(side === "home" ? "away" : "home");
    }
  }

  private scheduleRestart(side: Side) {
    const gk = this.players.find((p) => p.side === side && p.pos === "GK");
    if (!gk) return;
    this.ball.holder = gk.id;
    this.possession = side;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.restartTimer = 1.5;
    this.decisionTimer = 1.2;
    this.trigger(gk, this.rnd() < 0.5 ? "goalKick" : "distribute", 1.1);
  }

  possessionPct(): [number, number] {
    const h = this.stats.home.possessionTicks;
    const a = this.stats.away.possessionTicks;
    const total = h + a || 1;
    return [Math.round((h / total) * 100), Math.round((a / total) * 100)];
  }
}
