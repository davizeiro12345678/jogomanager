import { FORMATIONS } from "./formations";
import { makeRng } from "./rng";
import type { PlayerAction } from "./animation";
import type { MatchEventLog, Player, Tactics } from "./types";
import {
  type ActionContext,
  type BodyContactPoint,
  type ContactContext,
  type ContactType,
  type DominantFoot,
  emptyActionContext,
  emptyContactContext,
  getActionPhase,
  getDominantFoot,
  type VisualResult,
  type ReactionType,
  VISUAL_CONTEXT_VERSION,
  type VersionedVisualData,
} from "./visual-context";
import type { CanonicalBallPhysicsState, VisualBallState } from "./visual-ball";
import type {
  BallPhysicsAuthority,
  RapierBallHolder,
  RapierBallState,
} from "./rapier-ball-authority";

export const FIELD_X = 52.5;
export const FIELD_Z = 34;
const GOAL_Z = 3.66;
export const LIVE_MATCH_CLOCK_SCALE = 6;
export const MAX_LIVE_MOTION_SCALE = 2;

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
  /** passes tentados */
  passes: number;
  /** passes que chegaram ao destinatário pretendido */
  passesOk: number;
  corners: number;
  yellow: number;
  red: number;
}

/** estatísticas zeradas — usado pela partida ao vivo e pela repetição */
export function emptyStats(): MatchStats {
  return {
    goals: 0,
    shots: 0,
    onTarget: 0,
    possessionTicks: 0,
    fouls: 0,
    passes: 0,
    passesOk: 0,
    corners: 0,
    yellow: 0,
    red: 0,
  };
}

export interface Scorer {
  minute: number;
  side: Side;
  name: string;
}

/**
 * Superfície de leitura usada pela cena 3D. Tanto a partida ao vivo
 * (`MatchSim`) quanto a repetição gravada (`ReplaySim`) a implementam.
 */
export interface SimView {
  time: number;
  players: SimPlayer[];
  ball: { x: number; z: number; vx: number; vz: number; holder: string | null; height: number };
  /** Pose opcional produzida pelo adaptador Rapier, usada apenas pelo render. */
  visualBall?: VisualBallState | undefined;
  possession: Side;
  stats: Record<Side, MatchStats>;
  home: TeamSetup;
  away: TeamSetup;
  minute(): number;
  /**
   * Gera contexto visual deterministico para todos os jogadores.
   * Opcional: so implementado em MatchSim, ReplaySim usa dados gravados.
   */
  generateVisualContext?(): VersionedVisualData;
}

export class MatchSim {
  time = 0; // segundos de jogo
  players: SimPlayer[] = [];
  ball = { x: 0, z: 0, vx: 0, vz: 0, holder: null as string | null, height: 0 };
  possession: Side = "home";
  stats: Record<Side, MatchStats> = {
    home: emptyStats(),
    away: emptyStats(),
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
  /** jogadores em "freeze" curto após um chute próximo */
  private reactionUntil = new Map<string, number>();
  private mentalityCache: Record<Side, number> | null = null;
  /** Reused every tick to avoid allocating/sorting temporary chase arrays. */
  private chaseIds = new Set<string>();
  finished = false;
  lastEventId = 0;
  private decisionTimer = 0;
  private rnd: () => number;
  private restartTimer = 0;
  /** tempo com a bola solta, usado para destravar a jogada */
  private looseTime = 0;
  /** Pressão coletiva curta disparada por erro técnico ou passe para trás. */
  private pressSurge: Record<Side, number> = { home: 0, away: 0 };
  /** último lado que tocou na bola — define lateral, escanteio e tiro de meta */
  private lastTouch: Side = "home";
  /** velocidade vertical da bola (m/s) — a altura passa a ser física de verdade */
  private ballVy = 0;
  /** curva lateral (efeito Magnus) aplicada enquanto a bola voa */
  private ballSpin = 0;
  /**
   * Autoridade física opcional da bola, injetada apenas pela partida ao vivo.
   * A simulação ainda decide posse, regras e eventos; o Rapier integra a
   * trajetória entre essas decisões.
   */
  private ballPhysics: BallPhysicsAuthority | null = null;
  /** finalização em voo: só vira gol/defesa quando a bola chega lá */
  private pendingShot: {
    side: Side;
    shooter: string;
    outcome: "goal" | "saved" | "off";
    fromX: number;
    fromZ: number;
    targetZ: number;
  } | null = null;
  /** passe em voo: quem deve receber e até quando o passador não retoma a bola */
  private pass: { to: string; from: string; until: number } | null = null;

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

  /** Entrega uma cópia serializável da bola para apresentação ou física ao vivo. */
  physicsBallState(): CanonicalBallPhysicsState {
    return {
      x: this.ball.x,
      z: this.ball.z,
      height: this.ball.height,
      vx: this.ball.vx,
      vy: this.ballVy,
      vz: this.ball.vz,
      spin: this.ballSpin,
      attached: this.ball.holder !== null,
      holder: this.ball.holder,
    };
  }

  /** Liga ou desliga a autoridade física sem acoplar MatchSim ao WASM. */
  setBallPhysicsAuthority(authority: BallPhysicsAuthority | null) {
    if (this.ballPhysics === authority) return;
    this.ballPhysics?.dispose();
    this.ballPhysics = authority;
    this.synchronizeBallPhysics();
  }

  /** Permite ao Worker detectar uma falha WASM e cair para a rota compatível. */
  hasBallPhysicsAuthority() {
    return this.ballPhysics !== null;
  }

  /** Rebaseia Rapier depois de um reinício, chute, troca ou salto de partida. */
  synchronizeBallPhysics() {
    const physics = this.ballPhysics;
    if (!physics) return;
    try {
      const state = this.mutableBallPhysicsState();
      physics.reset(state, this.ballPhysicsHolder());
      this.applyMutableBallPhysicsState(state);
    } catch {
      physics.dispose();
      if (this.ballPhysics === physics) this.ballPhysics = null;
    }
  }

  dispose() {
    this.ballPhysics?.dispose();
    this.ballPhysics = null;
  }

  private mutableBallPhysicsState(): RapierBallState {
    return {
      x: this.ball.x,
      z: this.ball.z,
      height: this.ball.height,
      vx: this.ball.vx,
      vy: this.ballVy,
      vz: this.ball.vz,
      spin: this.ballSpin,
      holder: this.ball.holder,
    };
  }

  private ballPhysicsHolder(): RapierBallHolder | null {
    const holderId = this.ball.holder;
    if (!holderId) return null;
    const holder = this.players.find((player) => player.id === holderId);
    if (!holder) return null;
    return {
      id: holder.id,
      x: holder.x,
      z: holder.z,
      vx: holder.vx,
      vz: holder.vz,
    };
  }

  private applyMutableBallPhysicsState(state: RapierBallState) {
    this.ball.x = state.x;
    this.ball.z = state.z;
    this.ball.height = state.height;
    this.ball.vx = state.vx;
    this.ball.vz = state.vz;
    this.ballVy = state.vy;
    this.ballSpin = state.spin;
  }

  private stepAuthoritativeBall(dt: number, holder: SimPlayer | null): boolean {
    const physics = this.ballPhysics;
    if (!physics) return false;
    try {
      const state = this.mutableBallPhysicsState();
      const holderState = holder
        ? { id: holder.id, x: holder.x, z: holder.z, vx: holder.vx, vz: holder.vz }
        : null;
      physics.step(dt, state, holderState);
      this.applyMutableBallPhysicsState(state);
      return true;
    } catch {
      // WASM é um aprimoramento da trajetória. Uma falha não pode interromper
      // uma carreira, então este tick segue pela integração compatível abaixo.
      physics.dispose();
      if (this.ballPhysics === physics) this.ballPhysics = null;
      return false;
    }
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
    this.synchronizeBallPhysics();
    this.subsUsed[side]++;
    this.pushEvent({
      minute: this.minute(),
      type: "sub",
      side,
      text: `Substituição no ${this.setup(side).short}: entra ${incoming.name}, sai ${out.name}.`,
    });
    return true;
  }

  /** Notas de 0 a 10 de todos os jogadores que atuaram na partida. */
  playerRatings(): PlayerRating[] {
    const all = [...this.players, ...this.subsOut];
    return all.map((p) => {
      const mins = Math.max(
        1,
        p.minutes + (this.subsOut.includes(p) ? 0 : this.minute() - p.onSince),
      );
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
    this.ballVy = 0;
    this.ballSpin = 0;
    this.pendingShot = null;
    this.pass = null;
    const team = this.players.filter((p) => p.side === side);
    const starter = team.find((p) => p.pos === "FW") ?? team[team.length - 1]!;
    starter.x = -0.6 * (side === "home" ? 1 : -1);
    starter.z = 0;
    this.ball.holder = starter.id;
    this.possession = side;
    this.lastTouch = side;
    this.restartTimer = 1.2;
    this.synchronizeBallPhysics();
  }

  private setup(side: Side) {
    return side === "home" ? this.home : this.away;
  }

  private attackDir(side: Side) {
    return side === "home" ? 1 : -1;
  }

  private mentalityShift(side: Side) {
    if (this.mentalityCache) return this.mentalityCache[side];
    const h = (this.home.tactics.mentality - 2) * 6 * 1;
    const a = (this.away.tactics.mentality - 2) * 6 * -1;
    this.mentalityCache = { home: h, away: a };
    return this.mentalityCache[side];
  }

  private pushEvent(e: MatchEventLog) {
    this.events.push(e);
    this.lastEventId++;
    if (this.events.length > 80) this.events.shift();
  }

  private recordShot(shot: ShotRecord) {
    this.shotMap.push(shot);
    if (this.shotMap.length > 120) this.shotMap.shift();
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
    if (this.reactionUntil.size) {
      for (const [id, until] of this.reactionUntil) {
        if (until <= this.time) this.reactionUntil.delete(id);
      }
    }
  }

  minute() {
    return Math.min(90, Math.floor(this.time / 60));
  }

  private nearestOpponent(p: SimPlayer) {
    let best: SimPlayer | null = null;
    let bestD2 = Infinity;
    for (const o of this.players) {
      if (o.side === p.side) continue;
      const d2 = (o.x - p.x) ** 2 + (o.z - p.z) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = o;
      }
    }
    return { opp: best, dist: Math.sqrt(bestD2) };
  }

  step(dt: number, clockScale = 1, useBallPhysics = true) {
    if (this.finished) return;
    const clockDt = dt * Math.max(1, clockScale);
    this.time += clockDt;
    this.pressSurge.home = Math.max(0, this.pressSurge.home - dt);
    this.pressSurge.away = Math.max(0, this.pressSurge.away - dt);
    this.mentalityCache = null;

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

    this.stats[this.possession].possessionTicks += clockDt;
    if (this.restartTimer > 0) this.restartTimer -= dt;
    this.tickActions(dt);

    this.moveOffBall(dt);
    this.separate();
    this.drainStamina(clockDt);
    this.moveBall(dt, useBallPhysics);
    this.sanitize();

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
    // segunda passada: o condutor também não pode terminar dentro de outro jogador
    this.separate();
    this.sanitize();
  }

  /** ids dos jogadores designados a perseguir a bola solta */
  private chasers(): Set<string> {
    const set = this.chaseIds;
    set.clear();
    if (this.ball.holder) return set;
    for (const side of ["home", "away"] as Side[]) {
      let first: SimPlayer | null = null;
      let second: SimPlayer | null = null;
      let firstDistance = Infinity;
      let secondDistance = Infinity;
      for (const player of this.players) {
        if (player.side !== side || player.pos === "GK") continue;
        const dx = player.x - this.ball.x;
        const dz = player.z - this.ball.z;
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

  private moveOffBall(dt: number) {
    const bx = this.ball.x;
    const bz = this.ball.z;
    const chase = this.chasers();

    // Urgência pelo placar e pelo relógio: quem está perdendo no fim empurra a
    // equipe para a frente; quem está ganhando recua e segura o resultado.
    const remaining = Math.max(0, 90 - this.time / 60);
    const lateGame = remaining < 15;
    const goalDiff = this.stats.home.goals - this.stats.away.goals;
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
    for (const q of this.players) {
      if (q.pos === "GK") continue;
      if (q.side === "home") {
        if (q.x < lineX.home) lineX.home = q.x;
      } else if (q.x > lineX.away) lineX.away = q.x;
    }

    for (const p of this.players) {
      if (p.id === this.ball.holder) continue;
      const setup = this.setup(p.side);
      const dir = this.attackDir(p.side);
      const attacking = this.possession === p.side;
      const defendingWide = !attacking && Math.abs(bz) > FIELD_Z * 0.7;
      const widthFactor = (0.62 + setup.tactics.width * 0.14) * (defendingWide ? 0.76 : 1);
      const surge = !attacking && this.pressSurge[p.side] > 0;
      const pressLine = attacking
        ? 10 + setup.tactics.mentality * 5
        : -6 + setup.tactics.pressing * 7 + (surge ? 7 : 0);

      let tx = p.slotX * FIELD_X * 0.9 + this.mentalityShift(p.side) + bx * 0.22 + pressLine * dir;
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
        const incoming = this.pendingShot?.side !== p.side ? this.pendingShot : null;
        if (incoming) {
          const reaction = 0.32 + p.defending / 220;
          tz +=
            (Math.max(-GOAL_Z + 0.35, Math.min(GOAL_Z - 0.35, incoming.targetZ)) - tz) * reaction;
          tx += dir * Math.min(1.4, ballDist * 0.04);
          sprint = 1.18;
        }
        // goleiro sai da área para bola solta muito perto
        const sweepRange = 9 + setup.tactics.mentality * 1.35 + p.pace / 35;
        if (
          !this.ball.holder &&
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
        tx = bx + this.ball.vx * 0.22;
        tz = bz + this.ball.vz * 0.22;
        sprint = 1.35;
      } else if (!attacking) {
        // Linha defensiva conjunta: os defensores sobem/descem juntos em vez de
        // cada um seguir a bola por conta própria — é isso que cria a linha reta
        // e permite a armadilha de impedimento.
        if (p.pos === "DF") {
          const line = lineX[p.side];
          const trap = setup.tactics.pressing >= 3 && Math.abs(bx - line) > 14 ? dir * 3.5 : 0;
          tx = tx * 0.35 + (line + trap) * 0.65;
          // marcação por zona: cobre o adversário mais perigoso da sua faixa
          let markZ: number | null = null;
          let best = 9;
          for (const q of this.players) {
            if (q.side === p.side || q.pos === "GK") continue;
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
        tx += urgency(p.side) * 7 * dir;
      } else {
        // Movimento sem bola de verdade, em vez de balanço aleatório:
        // atacante ataca as costas da linha, ponta corta para dentro,
        // lateral faz a sobreposição e o meia oferece o apoio de recuo.
        const holder = this.players.find((q) => q.id === this.ball.holder);
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
        tz += Math.sin(this.time * 0.4 + p.number) * 0.9;
        tx += urgency(p.side) * 5 * dir;
      }

      tx = Math.max(-FIELD_X + 2, Math.min(FIELD_X - 2, tx));
      tz = Math.max(-FIELD_Z + 2, Math.min(FIELD_Z - 2, tz));

      const stam = 0.78 + (p.stamina / 100) * 0.22;
      const baseSpeed = 2.45 + (p.pace / 100) * 3.65;
      const speed = baseSpeed * (p.pos === "GK" ? 0.68 : 1) * Math.min(1.22, sprint) * stam;
      const dx = tx - p.x;
      const dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.3) {
        // curva de corrida: quanto maior a mudança de direção, mais o jogador reduz
        let speedEff = speed;
        const curSpeed = Math.hypot(p.vx, p.vz);
        if (curSpeed > 2.5) {
          const dot = (dx / d) * (p.vx / curSpeed) + (dz / d) * (p.vz / curSpeed);
          // só penaliza curvas realmente fechadas (> ~100°); o resto mantém o ritmo
          if (dot < 0.2) speedEff = speed * (0.6 + 0.4 * Math.max(0, (dot + 0.2) / 1.2));
        }
        // reação tardia a um chute próximo
        if ((this.reactionUntil.get(p.id) ?? 0) > this.time) speedEff *= 0.3;
        // A velocidade armazenada é a autoridade do deslocamento. Antes a
        // posição saltava direto na velocidade-alvo e apenas o vetor era
        // suavizado, criando arrancadas instantâneas e pés deslizando.
        const tvx = (dx / d) * speedEff;
        const tvz = (dz / d) * speedEff;
        const accelerating = tvx * p.vx + tvz * p.vz >= 0;
        const response = accelerating ? 3.2 : 5.4;
        const k = 1 - Math.exp(-response * dt);
        p.vx += (tvx - p.vx) * k;
        p.vz += (tvz - p.vz) * k;
        const currentSpeed = Math.hypot(p.vx, p.vz);
        if (currentSpeed > speedEff) {
          p.vx *= speedEff / currentSpeed;
          p.vz *= speedEff / currentSpeed;
        }
        const step = Math.min(d, Math.hypot(p.vx, p.vz) * dt);
        p.x += (p.vx / Math.max(0.001, Math.hypot(p.vx, p.vz))) * step;
        p.z += (p.vz / Math.max(0.001, Math.hypot(p.vx, p.vz))) * step;
      } else {
        const k = Math.exp(-7 * dt);
        p.vx *= k;
        p.vz *= k;
      }
    }
  }

  /** empurra jogadores sobrepostos para que não se atravessem */
  private separate() {
    const R = 0.85; // raio do corpo
    const list = this.players;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        let dx = b.x - a.x;
        let dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > 2.89) continue; // (0.85 * 2)^2
        let d = Math.sqrt(d2);
        if (d > R * 2) continue;
        if (d < 1e-4) {
          dx = (this.rnd() - 0.5) * 0.02;
          dz = (this.rnd() - 0.5) * 0.02;
          d = Math.hypot(dx, dz) || 1e-4;
        }
        const overlap = R * 2 - d;
        // Quem conduz a bola cede menos, mas a soma dos deslocamentos sempre
        // resolve toda a sobreposição para não deixar atletas grudados.
        const aWeight = a.id === this.ball.holder ? 0.25 : 1;
        const bWeight = b.id === this.ball.holder ? 0.25 : 1;
        const totalWeight = aWeight + bWeight;
        const nx = dx / d;
        const nz = dz / d;
        a.x -= nx * overlap * (aWeight / totalWeight);
        a.z -= nz * overlap * (aWeight / totalWeight);
        b.x += nx * overlap * (bWeight / totalWeight);
        b.z += nz * overlap * (bWeight / totalWeight);
      }
    }
    for (const p of list) {
      p.x = Math.max(-FIELD_X - 1, Math.min(FIELD_X + 1, p.x));
      p.z = Math.max(-FIELD_Z - 1, Math.min(FIELD_Z + 1, p.z));
    }
  }

  /** desgaste físico ao longo dos 90 minutos */
  private drainStamina(dt: number) {
    for (const p of this.players) {
      const speed = Math.hypot(p.vx, p.vz);
      const effort = 0.0015 + (speed / 9) * 0.008 * (p.pos === "GK" ? 0.25 : 1);
      const resist = 0.6 + (p.physical / 100) * 0.6;
      p.stamina = Math.max(12, p.stamina - (effort / resist) * dt);
    }
  }

  /** blindagem contra NaN/Infinity vindos de dados ruins */
  private sanitize() {
    const fix = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);
    for (const p of this.players) {
      p.x = Math.max(-FIELD_X - 1, Math.min(FIELD_X + 1, fix(p.x, 0)));
      p.z = Math.max(-FIELD_Z - 1, Math.min(FIELD_Z + 1, fix(p.z, 0)));
      p.vx = Math.max(-14, Math.min(14, fix(p.vx, 0)));
      p.vz = Math.max(-14, Math.min(14, fix(p.vz, 0)));
      p.stamina = Math.max(0, Math.min(100, fix(p.stamina, 70)));
    }
    const b = this.ball;
    b.x = Math.max(-FIELD_X - 2, Math.min(FIELD_X + 2, fix(b.x, 0)));
    b.z = Math.max(-FIELD_Z - 2, Math.min(FIELD_Z + 2, fix(b.z, 0)));
    b.vx = Math.max(-45, Math.min(45, fix(b.vx, 0)));
    b.vz = Math.max(-45, Math.min(45, fix(b.vz, 0)));
    b.height = Math.max(0.1, Math.min(12, fix(b.height, 0.12)));
    this.ballVy = Math.max(-30, Math.min(30, fix(this.ballVy, 0)));
    this.ballSpin = Math.max(-12, Math.min(12, fix(this.ballSpin, 0)));
  }

  private moveBall(dt: number, useBallPhysics = true) {
    const holder = this.ball.holder ? this.players.find((p) => p.id === this.ball.holder) : null;
    if (holder) {
      this.looseTime = 0;
      this.ballVy = 0;
      this.ballSpin = 0;
      this.pendingShot = null;
      this.pass = null;
      if (useBallPhysics && this.stepAuthoritativeBall(dt, holder)) return;
      const hs = Math.hypot(holder.vx, holder.vz) || 1;
      this.ball.x = holder.x + (holder.vx / hs) * 0.9;
      this.ball.z = holder.z + (holder.vz / hs) * 0.9;
      this.ball.height = 0.12;
      return;
    }

    this.looseTime += dt;
    const previousBall = { x: this.ball.x, z: this.ball.z, height: this.ball.height };

    if (!(useBallPhysics && this.stepAuthoritativeBall(dt, null))) {
      // Compatibilidade para replays legados, simulação rápida e navegadores
      // em que a inicialização WASM não estiver disponível.
      const airborne = this.ball.height > 0.14;
      if (this.ballSpin !== 0 && airborne) {
        const vx = this.ball.vx;
        const vz = this.ball.vz;
        const sp = Math.hypot(vx, vz) || 1;
        this.ball.vx += (-vz / sp) * this.ballSpin * dt;
        this.ball.vz += (vx / sp) * this.ballSpin * dt;
        this.ballSpin *= Math.exp(-0.8 * dt);
      }
      const drag = airborne ? 0.28 : 1.5;
      const kd = Math.exp(-drag * dt);
      this.ball.vx *= kd;
      this.ball.vz *= kd;

      this.ball.x += this.ball.vx * dt;
      this.ball.z += this.ball.vz * dt;

      this.ballVy -= 9.81 * dt;
      this.ball.height += this.ballVy * dt;
      if (this.ball.height <= 0.12) {
        this.ball.height = 0.12;
        if (this.ballVy < -0.6) {
          this.ballVy = -this.ballVy * 0.52;
          this.ball.vx *= 0.82;
          this.ball.vz *= 0.82;
        } else {
          this.ballVy = 0;
        }
      }
    }

    // --- bloqueio da defesa e interceptação no caminho da bola ---
    if (this.tryBlock(dt)) return;

    // --- finalização em voo: resolve quando a bola chega na área do gol ---
    if (this.pendingShot && this.resolveShot(previousBall)) return;

    // lateral: sai pela linha lateral, reposição do time que não tocou por último
    if (Math.abs(this.ball.z) > FIELD_Z - 0.5) {
      this.ball.z = Math.sign(this.ball.z) * (FIELD_Z - 1);
      this.ball.vz = 0;
      this.ball.height = 0.12;
      this.ballVy = 0;
      this.pendingShot = null;
      this.restartFor(this.lastTouch === "home" ? "away" : "home", "throwIn");
      return;
    }
    // linha de fundo: escanteio se o último toque foi do time que defende aquele lado
    if (Math.abs(this.ball.x) > FIELD_X - 0.5) {
      const endSide: Side = this.ball.x > 0 ? "away" : "home"; // dono daquela meta
      this.ball.x = Math.sign(this.ball.x) * (FIELD_X - 0.6);
      this.ball.height = 0.12;
      this.ballVy = 0;
      this.pendingShot = null;
      if (this.lastTouch === endSide) {
        // desviou na defesa → escanteio para o adversário
        this.ball.z = Math.sign(this.ball.z || 1) * (FIELD_Z - 1);
        this.restartFor(endSide === "home" ? "away" : "home", "corner");
      } else {
        this.ball.z = 0;
        this.scheduleRestart(endSide);
      }
      return;
    }

    // --- domínio: quem chega perto tenta o primeiro toque ---
    let closest: SimPlayer | null = null;
    let bestD = Infinity;
    for (const p of this.players) {
      if (this.pass && p.id === this.pass.from && this.time < this.pass.until) continue;
      const d = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      if (d < bestD) {
        bestD = d;
        closest = p;
      }
    }
    const ballSpeed = Math.hypot(this.ball.vx, this.ball.vz);
    const h = this.ball.height;
    // bola muito alta não pode ser dominada; entre 0.9 e 2.4 é cabeceio
    const reachable = h <= 2.4;
    if (closest && bestD < 1.9 && ballSpeed < 30 && reachable) {
      this.controlBall(closest, ballSpeed, h);
      return;
    }
    // destravamento: bola parada sem dono por muito tempo
    if (this.looseTime > 3.5 && ballSpeed < 4 && closest) {
      closest.x = this.ball.x;
      closest.z = this.ball.z;
      this.ball.holder = closest.id;
      this.possession = closest.side;
      this.lastTouch = closest.side;
      this.ball.height = 0.12;
      this.ballVy = 0;
      this.ball.vx = 0;
      this.ball.vz = 0;
      this.pass = null;
      this.looseTime = 0;
      this.decisionTimer = 0.5;
      this.synchronizeBallPhysics();
    }
  }

  /**
   * Primeiro toque. Bola forte ou alta pode escapar do controle e sobrar viva —
   * o jogador toca nela em vez de a bola simplesmente colar no pé.
   */
  private controlBall(p: SimPlayer, ballSpeed: number, h: number) {
    const isReceiver = this.pass?.to === p.id;
    const skill = (p.passing * 0.5 + p.physical * 0.3 + p.defending * 0.2) / 100;
    const difficulty = ballSpeed / 34 + (h > 0.9 ? 0.28 : 0);
    const ok = isReceiver
      ? this.rnd() < 0.62 + skill * 0.42 - difficulty * 0.5
      : this.rnd() < 0.45 + skill * 0.45 - difficulty * 0.55;

    this.trigger(p, h > 0.9 ? "header" : "trap", 0.5);
    this.lastTouch = p.side;
    this.pass = null;
    this.ballVy = 0;
    this.ballSpin = 0;

    if (ok) {
      this.ball.holder = p.id;
      this.possession = p.side;
      this.ball.vx = 0;
      this.ball.vz = 0;
      this.ball.height = 0.12;
      this.looseTime = 0;
      if (isReceiver) this.stats[p.side].passesOk++;
      this.synchronizeBallPhysics();
      return;
    }

    // toque mal dado: a bola sobra à frente, ainda em disputa
    const dirx = this.attackDir(p.side);
    const spill = 2.6 + this.rnd() * 3.4;
    const ang = (this.rnd() - 0.5) * 1.4;
    this.ball.holder = null;
    this.ball.vx = Math.cos(ang) * spill * dirx;
    this.ball.vz = Math.sin(ang) * spill;
    this.ball.height = h > 0.9 ? 0.9 : 0.12;
    this.ballVy = h > 0.9 ? 1.4 : 0;
    this.looseTime = 0.4;
    const pressingSide: Side = p.side === "home" ? "away" : "home";
    this.pressSurge[pressingSide] = Math.max(this.pressSurge[pressingSide], 2.5);
    this.synchronizeBallPhysics();
  }

  /**
   * Defesa ativa: um adversário no caminho pode bloquear o chute/passe.
   * Devolve verdadeiro quando a jogada foi encerrada aqui.
   */
  private tryBlock(dt: number): boolean {
    const speed = Math.hypot(this.ball.vx, this.ball.vz);
    if (speed < 8 || this.ball.height > 1.9) return false;
    const attacking = this.pendingShot?.side ?? (this.pass ? this.lastTouch : null);
    if (!attacking) return false;

    for (const p of this.players) {
      if (p.side === attacking || p.pos === "GK") continue;
      const d = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      if (d > 1.25) continue;
      const chance = (0.35 + (p.defending / 100) * 0.5) * Math.min(1, dt * 30);
      if (this.rnd() > chance) continue;

      this.trigger(p, this.rnd() < 0.45 ? "slide" : "block", 0.7);
      p.tackles++;
      this.lastTouch = p.side;
      const wasShot = !!this.pendingShot;
      this.pendingShot = null;
      this.pass = null;
      // rebote: a bola volta desviada e perde muita força
      const ang = Math.atan2(this.ball.vz, this.ball.vx) + Math.PI + (this.rnd() - 0.5) * 1.6;
      const back = speed * (0.2 + this.rnd() * 0.25);
      this.ball.vx = Math.cos(ang) * back;
      this.ball.vz = Math.sin(ang) * back;
      this.ballVy = 1.6 + this.rnd() * 2.4;
      this.ballSpin = 0;
      this.synchronizeBallPhysics();
      if (wasShot) {
        this.pushEvent({
          minute: this.minute(),
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
  private resolveShot(
    previous = { x: this.ball.x, z: this.ball.z, height: this.ball.height },
  ): boolean {
    const s = this.pendingShot!;
    const dir = this.attackDir(s.side);
    const goalX = dir * FIELD_X;
    const gk = this.players.find((p) => p.side !== s.side && p.pos === "GK") ?? null;
    const shooter = this.players.find((p) => p.id === s.shooter) ?? null;
    const planeX = goalX - dir * 1.6;
    const crossed =
      dir > 0
        ? previous.x < planeX && this.ball.x >= planeX
        : previous.x > planeX && this.ball.x <= planeX;
    const reached = crossed || (dir > 0 ? this.ball.x >= planeX : this.ball.x <= planeX);
    if (!reached) return false;
    // Resolve no ponto exato em que a trajetória cruza o plano da meta. Assim,
    // avanços rápidos não transformam um gol em tiro de meta por tunneling.
    const segment = this.ball.x - previous.x;
    const ratio =
      crossed && Math.abs(segment) > 0.0001
        ? Math.max(0, Math.min(1, (planeX - previous.x) / segment))
        : 1;
    const crossingZ = previous.z + (this.ball.z - previous.z) * ratio;
    const crossingHeight = previous.height + (this.ball.height - previous.height) * ratio;

    // defesa do goleiro
    if (s.outcome === "saved" && gk) {
      const dive = crossingZ - gk.z;
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
      gk.saves++;
      this.stats[s.side].onTarget++;
      this.recordShot({
        x: s.fromX,
        z: s.fromZ,
        side: s.side,
        result: "saved",
        minute: this.minute(),
        name: shooter?.name ?? "",
      });
      this.pushEvent({
        minute: this.minute(),
        type: "save",
        side: s.side,
        text: `${gk.name} faz a defesa em chute de ${shooter?.name ?? "o atacante"}.`,
      });
      this.pendingShot = null;
      // metade das defesas dá rebote; a outra o goleiro segura
      if (this.rnd() < 0.45) {
        gk.x = this.ball.x - dir * 0.4;
        gk.z = this.ball.z * 0.6;
        const ang = Math.atan2(this.ball.z, -dir) + (this.rnd() - 0.5) * 1.2;
        const back = 6 + this.rnd() * 7;
        this.ball.holder = null;
        this.ball.vx = -dir * Math.abs(Math.cos(ang) * back);
        this.ball.vz = Math.sin(ang) * back;
        this.ballVy = 1.8 + this.rnd() * 2;
        this.lastTouch = gk.side;
        this.looseTime = 0;
      } else {
        this.scheduleRestart(gk.side);
      }
      return true;
    }

    if (s.outcome === "goal") {
      if (Math.abs(crossingZ) < GOAL_Z && crossingHeight < 2.44) {
        this.pendingShot = null;
        this.scoreGoal(s.side, shooter, s.fromX, s.fromZ);
        return true;
      }
      // A curva/altura física pode levar uma finalização nominalmente certeira
      // para fora ou na trave. Libera a bola para a reposição em vez de manter
      // pendingShot ativo e bloquear para sempre o restante da jogada.
      this.pendingShot = null;
      return false;
    }

    // fora: a bola segue viva e o lance termina pela linha de fundo/lateral
    this.pendingShot = null;
    return false;
  }

  /** Registra o gol, celebrações e reinício. */
  private scoreGoal(side: Side, shooter: SimPlayer | null, fromX: number, fromZ: number) {
    this.stats[side].onTarget++;
    this.stats[side].goals++;
    if (shooter) shooter.goals++;
    const assist = this.lastPass[side];
    if (assist && this.time - assist.time < 12 && assist.id !== shooter?.id) {
      const provider = this.players.find((p) => p.id === assist.id);
      if (provider) provider.assists++;
    }
    this.lastPass[side] = null;
    this.recordShot({
      x: fromX,
      z: fromZ,
      side,
      result: "goal",
      minute: this.minute(),
      name: shooter?.name ?? "",
    });
    this.scorers.push({ minute: this.minute(), side, name: shooter?.name ?? "" });
    const celeb = this.rnd();
    this.trigger(
      shooter,
      celeb < 0.34 ? "kneeSlide" : celeb < 0.67 ? "celebrateRun" : "celebrate",
      6,
    );
    for (const m of this.players) {
      if (m.side === side && m.id !== shooter?.id)
        this.trigger(m, m.pos === "GK" ? "celebrate" : "hug", 5.2);
      else if (m.side !== side) this.trigger(m, "dejected", 4.4);
    }
    this.pushEvent({
      minute: this.minute(),
      type: "goal",
      side,
      text: `GOL! ${shooter?.name ?? "O atacante"} marca para o ${this.setup(side).short}!`,
    });
    this.kickoff(side === "home" ? "away" : "home");
  }

  /** entrega a bola parada ao jogador mais próximo do lado indicado */
  private restartFor(side: Side, kind: "throwIn" | "corner") {
    let best: SimPlayer | null = null;
    let bestD = Infinity;
    for (const p of this.players) {
      if (p.side !== side || p.pos === "GK") continue;
      const d = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return;
    best.x = this.ball.x;
    best.z = this.ball.z;
    best.vx = 0;
    best.vz = 0;
    this.ball.holder = best.id;
    this.possession = side;
    this.lastTouch = side;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ballVy = 0;
    this.ballSpin = 0;
    this.pendingShot = null;
    this.pass = null;
    this.looseTime = 0;
    this.restartTimer = 0.8;
    this.trigger(best, kind, 0.9);
    if (kind === "corner") {
      this.stats[side].corners++;
      this.pushEvent({
        minute: this.minute(),
        type: "corner",
        side,
        text: `Escanteio para ${this.setup(side).short}.`,
      });
    }
    this.synchronizeBallPhysics();
  }

  private dribble(holder: SimPlayer, dt: number) {
    if (this.restartTimer > 0) {
      const k = Math.exp(-7 * dt);
      holder.vx *= k;
      holder.vz *= k;
      return;
    }
    const dir = this.attackDir(holder.side);
    const targetX = dir * FIELD_X;
    const dx = targetX - holder.x;
    const dz = -holder.z * 0.25 + Math.sin(this.time * 0.9 + holder.number) * 4;
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

  private pressure(holder: SimPlayer, dt: number) {
    const { opp, dist } = this.nearestOpponent(holder);
    if (!opp || dist > 2.2 || this.restartTimer > 0) return;
    const press = 0.55 + this.setup(opp.side).tactics.pressing * 0.22;
    let support = 0;
    for (const defender of this.players) {
      if (defender.side !== opp.side || defender.id === opp.id) continue;
      if (Math.hypot(defender.x - holder.x, defender.z - holder.z) < 3.2) support += 1;
    }
    const overload = 1 + Math.min(2, support) * 0.28;
    const fatigue = 0.55 + (opp.stamina / 100) * 0.45;
    const chance =
      ((opp.defending * 0.7 + opp.physical * 0.3) /
        (holder.pace * 0.45 + holder.physical * 0.3 + holder.passing * 0.25 + 60)) *
      press *
      overload *
      fatigue *
      dt *
      1.6;
    if (this.rnd() < chance) {
      const slide = this.rnd() < 0.4;
      this.trigger(opp, slide ? "slide" : "tackle", slide ? 1.0 : 0.6);
      opp.tackles++;
      this.trigger(holder, "duel", 0.5);
      if (this.rnd() < 0.22) {
        this.trigger(holder, "protest", 1.4);
        this.stats[opp.side].fouls++;
        this.pushEvent({
          minute: this.minute(),
          type: "foul",
          side: opp.side,
          text: `Falta de ${opp.name} sobre ${holder.name}.`,
        });
        // cartão: falta dura (carrinho) pune mais; vermelho é raro
        const cardRoll = this.rnd();
        const yellowChance = slide ? 0.3 : 0.16;
        if (cardRoll < 0.012) {
          this.stats[opp.side].red++;
          this.pushEvent({
            minute: this.minute(),
            type: "red",
            side: opp.side,
            text: `Cartão vermelho para ${opp.name}!`,
          });
        } else if (cardRoll < yellowChance) {
          this.stats[opp.side].yellow++;
          this.pushEvent({
            minute: this.minute(),
            type: "yellow",
            side: opp.side,
            text: `Cartão amarelo para ${opp.name}.`,
          });
        }
        this.restartTimer = 1.4;
        return;
      }
      this.ball.holder = opp.id;
      this.possession = opp.side;
      this.lastTouch = opp.side;
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
        ? (holder.shooting / 100) * (1 - distGoal / 34) * (pressDist > 2.5 ? 1.2 : 0.7)
        : 0;

    if (holder.pos !== "GK" && this.rnd() < shootUrge * 0.08) {
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
      // Evita passes atravessando um marcador alinhado ao corredor da bola.
      let laneRisk = 0;
      const mdx = m.x - holder.x;
      const mdz = m.z - holder.z;
      const len2 = mdx * mdx + mdz * mdz || 1;
      for (const opponent of this.players) {
        if (opponent.side === holder.side) continue;
        const t = Math.max(
          0,
          Math.min(1, ((opponent.x - holder.x) * mdx + (opponent.z - holder.z) * mdz) / len2),
        );
        const laneX = holder.x + mdx * t;
        const laneZ = holder.z + mdz * t;
        const laneDistance = Math.hypot(opponent.x - laneX, opponent.z - laneZ);
        if (laneDistance < 2.2) laneRisk += (2.2 - laneDistance) * 2.8;
      }
      const score =
        forward * (0.7 + mentality * 0.12) + cover * 1.7 - dist * 0.32 - laneRisk + this.rnd() * 8;
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }

    if (!best) return;
    const rawDist = Math.hypot(best.x - holder.x, best.z - holder.z);
    const isBackPass = (best.x - holder.x) * dir < -2;
    if (isBackPass) {
      const pressingSide: Side = holder.side === "home" ? "away" : "home";
      this.pressSurge[pressingSide] = Math.max(this.pressSurge[pressingSide], 1.6);
    }
    const power = Math.min(31, 10 + rawDist * 0.8);
    // passe na frente: mira onde o companheiro estará quando a bola chegar
    const flight = rawDist / power;
    const aimX = best.x + best.vx * flight * 0.8;
    const aimZ = best.z + best.vz * flight * 0.8;

    const success = Math.min(0.96, (holder.passing / 100) * (1 - rawDist / 90) + 0.25);
    const err = success > this.rnd() ? 0 : (this.rnd() - 0.5) * 12;
    const dx = aimX - holder.x;
    const dz = aimZ - holder.z;
    const d = Math.hypot(dx, dz) || 1;
    const wide = Math.abs(holder.z) > FIELD_Z * 0.55 && Math.abs(best.x - dir * FIELD_X) < 30;
    const lofted = wide || rawDist > 22;
    this.trigger(
      holder,
      wide ? "cross" : rawDist > 24 ? "passLong" : "pass",
      rawDist > 24 ? 0.85 : 0.6,
    );
    holder.passes++;
    this.stats[holder.side].passes++;
    this.lastPass[holder.side] = { id: holder.id, time: this.time };
    this.ball.holder = null;
    this.lastTouch = holder.side;
    this.pass = { to: best.id, from: holder.id, until: this.time + 0.45 };
    this.ball.vx = (dx / d) * power + err * 0.18;
    this.ball.vz = (dz / d) * power + err;
    if (lofted) {
      // bola alçada: sobe e cai perto do destino
      const t = Math.max(0.4, d / power);
      this.ball.height = 0.35;
      this.ballVy = 4.905 * t;
      this.ballSpin = wide ? (this.rnd() - 0.5) * 5 : 0;
    } else {
      this.ball.height = 0.12;
      this.ballVy = 0;
      this.ballSpin = 0;
    }
    this.synchronizeBallPhysics();
  }

  private shoot(holder: SimPlayer, distGoal: number) {
    const side = holder.side;
    const dir = this.attackDir(side);
    this.stats[side].shots++;
    holder.shots++;
    const gk = this.players.find((p) => p.side !== side && p.pos === "GK");
    const accuracy = (holder.shooting / 100) * (1 - Math.min(0.75, distGoal / 40));
    const gkSkill = gk ? gk.defending * 0.7 + gk.physical * 0.3 : 60;

    // 1) decide o desfecho ANTES da trajetória, para que o visual corresponda ao evento
    const onTarget = this.rnd() < 0.34 + accuracy * 0.55;
    const goalChance = Math.max(0.06, Math.min(0.55, accuracy * 0.62 - gkSkill / 340));
    const outcome: "goal" | "saved" | "off" = !onTarget
      ? "off"
      : this.rnd() < goalChance
        ? "goal"
        : "saved";

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
    this.lastTouch = side;
    // reação ao chute: adversários próximos congelam por uma fração de segundo
    for (const p of this.players) {
      if (p.side === side || p.pos === "GK") continue;
      if (Math.hypot(p.x - holder.x, p.z - holder.z) < 7) {
        this.reactionUntil.set(p.id, this.time + 0.45 + this.rnd() * 0.2);
      }
    }

    // 2) trajetória física: a bola voa com arco e o desfecho só acontece na meta
    const inside = (this.rnd() - 0.5) * GOAL_Z * 1.5; // dentro das traves
    const outsideZ = Math.sign(this.rnd() - 0.5 || 1) * (GOAL_Z + 1.2 + this.rnd() * GOAL_Z * 1.6);
    const targetZ = outcome === "off" ? outsideZ : inside;
    // altura de chegada: no alvo sempre abaixo do travessão; fora pode ir por cima
    const targetH =
      outcome === "off" && this.rnd() < 0.42 ? 3.0 + this.rnd() * 1.8 : 0.25 + this.rnd() * 1.8;

    const dx = dir * FIELD_X - holder.x;
    const dz = targetZ - holder.z;
    const d = Math.hypot(dx, dz) || 1;
    const power = 24 + (holder.shooting / 100) * 13 + this.rnd() * 6;
    this.ball.vx = (dx / d) * power;
    this.ball.vz = (dz / d) * power;
    this.ball.height = 0.25;
    const flight = Math.max(0.15, d / power);
    // vy resolvido pela balística: sai baixo e chega na altura pretendida
    this.ballVy = (targetH - 0.25) / flight + 4.905 * flight;
    this.ballSpin = (this.rnd() - 0.5) * (distGoal > 20 ? 7 : 3);

    this.pendingShot = {
      side,
      shooter: holder.id,
      outcome,
      fromX: holder.x,
      fromZ: holder.z,
      targetZ,
    };
    if (gk && outcome === "saved") {
      const dive = targetZ - gk.z;
      this.trigger(gk, Math.abs(dive) < 1.15 ? "save" : dive > 0 ? "diveRight" : "diveLeft", 1.15);
    }
    this.restartTimer = 0.35;

    if (outcome === "off") {
      // parte das finalizações erradas desvia na defesa e vira escanteio
      if (this.rnd() < 0.22) this.lastTouch = side === "home" ? "away" : "home";
      this.recordShot({
        x: holder.x,
        z: holder.z,
        side,
        result: "off",
        minute: this.minute(),
        name: holder.name,
      });
      this.pushEvent({
        minute: this.minute(),
        type: "shot",
        side,
        text: `${holder.name} finaliza para fora.`,
      });
    }
    this.synchronizeBallPhysics();
  }

  private scheduleRestart(side: Side) {
    const gk = this.players.find((p) => p.side === side && p.pos === "GK");
    if (!gk) return;
    this.ball.holder = gk.id;
    this.possession = side;
    this.lastTouch = side;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ball.height = 0.12;
    this.ballVy = 0;
    this.ballSpin = 0;
    this.pendingShot = null;
    this.pass = null;
    this.looseTime = 0;
    this.restartTimer = 1.5;
    this.decisionTimer = 1.2;
    this.trigger(gk, this.rnd() < 0.5 ? "goalKick" : "distribute", 1.1);
    this.synchronizeBallPhysics();
  }

  possessionPct(): [number, number] {
    const h = this.stats.home.possessionTicks;
    const a = this.stats.away.possessionTicks;
    const total = h + a || 1;
    return [Math.round((h / total) * 100), Math.round((a / total) * 100)];
  }

  /**
   * Gera contexto visual deterministico para todos os jogadores.
   *
   * Esta funcao nao afeta o estado da simulacao (placar, estatisticas, etc.)
   * e e usada apenas para alimentar o sistema visual com dados realistas.
   *
   * @returns Dados visuais versionados para gravar em replays
   */
  generateVisualContext(): VersionedVisualData {
    const actionContexts: (ActionContext | null)[] = [];
    const contactContexts: (ContactContext | null)[] = [];

    for (const p of this.players) {
      // Gera ActionContext
      const actionCtx = this.generatePlayerActionContext(p);
      actionContexts.push(actionCtx);

      // Gera ContactContext
      const contactCtx = this.generatePlayerContactContext(p);
      contactContexts.push(contactCtx);
    }

    return {
      version: VISUAL_CONTEXT_VERSION,
      actionContexts,
      contactContexts,
      metadata: {
        simTime: this.time,
      },
    };
  }

  /**
   * Gera ActionContext para um jogador.
   * Deterministico: mesmas entradas produzem mesmas saidas.
   */
  private generatePlayerActionContext(p: SimPlayer): ActionContext {
    // Se nao tem acao, retorna contexto vazio
    if (!p.action) {
      return emptyActionContext();
    }

    // Calcula progresso da acao
    const u = p.actionDur > 0 ? Math.min(1, p.actionT / p.actionDur) : 0;
    const phase = getActionPhase(1 - u); // Inverte para ir de anticipation -> recovery

    // Determina pe dominante com base no pid (deterministico)
    const dominantFoot = getDominantFoot(p.pid);

    // Para acoes de chute, determine qual pe usar
    // Regra: se for acao de chute e o jogador estiver se movendo para a direita,
    // usa o pe esquerdo, senao o dominante
    const usedFoot = this.determineUsedFoot(p, dominantFoot);

    // Determina alvo da acao
    const target = this.determineActionTarget(p);

    // Determina ponto de contato
    const contactPoint = this.determineContactPoint(p);

    // Direcao do movimento (radianos)
    const direction = Math.atan2(p.vz, p.vx);

    // Intensidade baseada na acao e stamina
    const intensity = this.calculateActionIntensity(p);

    // Resultado visual (por enquanto sempre "success" para acoes ativas)
    const result: VisualResult = p.actionT > 0 ? "success" : "none";

    // Reacao baseada na fase
    const reaction: ReactionType = this.determineReaction(p, phase);

    return {
      action: p.action,
      actionT: p.actionT,
      actionDur: p.actionDur,
      phase,
      dominantFoot,
      usedFoot,
      target,
      contactPoint,
      direction,
      intensity,
      result,
      reaction,
    };
  }

  /**
   * Determina qual pe usar para a acao.
   */
  private determineUsedFoot(p: SimPlayer, dominantFoot: DominantFoot): DominantFoot {
    // Para goleiros, sempre usa o pe mais proximo da bola
    if (p.pos === "GK") {
      const ballDx = this.ball.x - p.x;
      return ballDx < 0 ? "left" : "right";
    }

    // Para acoes de chute, usa o pe nao-dominante se estiver virando para esse lado
    if (
      p.action &&
      ["shot", "shotPower", "shotPlaced", "pass", "passLong", "cross"].includes(p.action)
    ) {
      // Se o jogador estiver se movendo para a esquerda, usa pe direito, e vice-versa
      if (p.vx < -0.1) {
        return dominantFoot === "left" ? "right" : "left";
      }
      if (p.vx > 0.1) {
        return dominantFoot === "right" ? "left" : "right";
      }
    }

    return dominantFoot;
  }

  /**
   * Determina o alvo da acao.
   */
  private determineActionTarget(p: SimPlayer): { x: number; z: number } | null {
    // Se tem a bola, o alvo depende da acao
    if (p.id === this.ball.holder) {
      // Para chutes, o alvo e o gol
      if (p.action && ["shot", "shotPower", "shotPlaced"].includes(p.action)) {
        const sideDir = p.side === "home" ? 1 : -1;
        return { x: FIELD_X * sideDir, z: 0 };
      }

      // Para passes, o alvo e um jogador do mesmo time
      if (p.action && ["pass", "passLong", "cross"].includes(p.action)) {
        const teammate = this.players.find(
          (t) => t.side === p.side && t.id !== p.id && t.pos !== "GK",
        );
        if (teammate) {
          return { x: teammate.x, z: teammate.z };
        }
      }

      // Para dribles, o alvo e na direcao do movimento
      if (p.vx !== 0 || p.vz !== 0) {
        return { x: p.x + p.vx * 2, z: p.z + p.vz * 2 };
      }
    }

    // Se nao tem alvo especifico, usa a bola
    if (this.ball.holder) {
      const holder = this.players.find((pl) => pl.id === this.ball.holder);
      if (holder) {
        return { x: holder.x, z: holder.z };
      }
    }

    // Ultimo caso: a posicao da bola
    return { x: this.ball.x, z: this.ball.z };
  }

  /**
   * Determina o ponto de contato.
   */
  private determineContactPoint(p: SimPlayer): { x: number; z: number; height: number } | null {
    // Se a acao envolve contato com a bola
    if (p.action && ["trap", "header", "volley", "firstTime"].includes(p.action)) {
      return { x: this.ball.x, z: this.ball.z, height: this.ball.height };
    }

    // Se e uma acao de chute
    if (p.action && ["shot", "shotPower", "shotPlaced", "pass", "cross"].includes(p.action)) {
      // Ponto de contato e slightly a frente do pe
      const footOffset = p.action && p.action.includes("shot") ? 0.3 : 0.15;
      const usedFoot = this.determineUsedFoot(p, getDominantFoot(p.pid));
      const footSign = usedFoot === "left" ? -1 : 1;
      return {
        x: p.x + footSign * footOffset,
        z: p.z,
        height: 0.1,
      };
    }

    // Se e uma acao de defesa
    if (p.action && ["tackle", "slide", "block", "intercept"].includes(p.action)) {
      // Ponto de contato e o adversario ou a bola
      if (this.ball.holder) {
        const holder = this.players.find((pl) => pl.id === this.ball.holder);
        if (holder) {
          return { x: holder.x, z: holder.z, height: 0.5 };
        }
      }
      return { x: this.ball.x, z: this.ball.z, height: 0 };
    }

    return null;
  }

  /**
   * Calcula intensidade da acao.
   */
  private calculateActionIntensity(p: SimPlayer): number {
    // Baseada no tipo de acao
    if (!p.action) return 0;

    // Acoes de chute tem alta intensidade
    if (["shot", "shotPower", "shotPlaced"].includes(p.action)) {
      return 0.8 + (p.shooting / 100) * 0.2;
    }

    // Acoes de defesa
    if (["tackle", "slide", "block"].includes(p.action)) {
      return 0.7 + (p.defending / 100) * 0.2;
    }

    // Acoes de passe
    if (["pass", "passLong", "cross"].includes(p.action)) {
      return 0.6 + (p.passing / 100) * 0.2;
    }

    // Acoes de goleiro
    if (["save", "saveHigh", "diveLeft", "diveRight"].includes(p.action)) {
      return 0.9;
    }

    // Outras acoes
    return 0.5;
  }

  /**
   * Determina reacao baseada na fase.
   */
  private determineReaction(p: SimPlayer, phase: string): ReactionType {
    // Durante a acao
    if (phase === "action") {
      // Se estah se movendo rápido, pode precisar de balance
      const speed = Math.hypot(p.vx, p.vz);
      if (speed > 5) return "balance";
      return "none";
    }

    // No contato
    if (phase === "contact") {
      // Se e uma acao de defesa
      if (p.action && ["tackle", "slide", "block", "intercept"].includes(p.action)) {
        return "push";
      }
      return "none";
    }

    // Follow-through
    if (phase === "followThrough") {
      return "recovery";
    }

    // Recovery
    if (phase === "recovery") {
      return "balance";
    }

    return "none";
  }

  /**
   * Gera ContactContext para um jogador.
   * Deterministico: mesmas entradas produzem mesmas saidas.
   */
  private generatePlayerContactContext(p: SimPlayer): ContactContext {
    // Determina tipo de contato
    const contactType = this.determineContactType(p);

    // Se nao tem contato
    if (contactType === "none") {
      return emptyContactContext();
    }

    // Determina qual pe esta em contato com o chao
    const groundFoot = this.determineGroundFoot(p);

    // Forca do contato (0-1)
    const force = this.calculateContactForce(p, contactType);

    // Ponto do corpo em contato
    const bodyPoint = this.determineBodyPoint(p, contactType);

    // Jogador em contato (se aplicavel)
    const contactPlayerId = this.determineContactPlayer(p);

    // Velocidade relativa
    const relativeVelocity = this.calculateRelativeVelocity(p, contactPlayerId);

    return {
      type: contactType,
      groundFoot,
      force,
      bodyPoint,
      contactPlayerId,
      relativeVelocity,
    };
  }

  /**
   * Determina tipo de contato.
   */
  private determineContactType(p: SimPlayer): ContactType {
    // Se tem a bola
    if (p.id === this.ball.holder) {
      return "ball";
    }

    // Se a bola esta no ar e o jogador esta olhando para ela
    if (this.ball.height > 0.5) {
      const distToBall = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      if (distToBall < 3) {
        return "airBall";
      }
      return "none";
    }

    // Se a bola esta no chao e proxima
    if (this.ball.height <= 0.5) {
      const distToBall = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      if (distToBall < 1.5) {
        // Se o jogador estiver em acao de contato
        if (p.action && ["trap", "tackle", "intercept"].includes(p.action)) {
          return "groundBall";
        }
        return "ball";
      }
    }

    // Se tem acao de slide/tackle, assume contato com jogador
    if (p.action && ["tackle", "slide"].includes(p.action)) {
      return "player";
    }

    // Contato com o chao
    return "ground";
  }

  /**
   * Determina qual pe esta em contato com o chao.
   */
  private determineGroundFoot(p: SimPlayer): DominantFoot | null {
    // Durante locomocao, alternar os pes com base no tempo
    // Usa o pid como seed para determinismo
    const seed = this.hashString(p.pid);
    const timeFactor = Math.floor(this.time * 10) % 100;
    const combined = (seed + timeFactor) % 100;

    // Se o valor for par, pe direito no chao, senao pe esquerdo
    // (simplificacao: nao estamos Fazendo IK completo aqui)
    if (p.vx !== 0 || p.vz !== 0) {
      // Em movimento: alternar
      return combined % 2 === 0 ? "right" : "left";
    }

    // Parado: ambos os pes no chao
    return null;
  }

  /**
   * Funcao hash simples para strings.
   */
  private hashString(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = (hash * 31 + s.charCodeAt(i)) | 0;
    }
    return hash;
  }

  /**
   * Calcula forca do contato.
   */
  private calculateContactForce(p: SimPlayer, contactType: ContactType): number {
    // Contato com a bola
    if (contactType === "ball" || contactType === "groundBall") {
      const speed = Math.hypot(p.vx, p.vz);
      return Math.min(1, speed / 8);
    }

    // Contato com jogador
    if (contactType === "player") {
      return 0.8;
    }

    // Contato com o chao
    if (contactType === "ground") {
      const speed = Math.hypot(p.vx, p.vz);
      return Math.min(1, speed / 5);
    }

    return 0;
  }

  /**
   * Determina ponto do corpo em contato.
   */
  private determineBodyPoint(p: SimPlayer, contactType: ContactType): BodyContactPoint | null {
    if (contactType === "ball" || contactType === "groundBall") {
      if (p.pos === "GK") {
        return Math.random() < 0.5 ? "handLeft" : "handRight";
      }
      return this.determineUsedFoot(p, getDominantFoot(p.pid)) === "left"
        ? "footLeft"
        : "footRight";
    }

    if (contactType === "player") {
      if (p.action === "tackle") {
        return "shoulderRight";
      }
      if (p.action === "slide") {
        return "kneeRight";
      }
    }

    if (contactType === "ground") {
      const groundFoot = this.determineGroundFoot(p);
      if (groundFoot) {
        return groundFoot === "left" ? "footLeft" : "footRight";
      }
    }

    return null;
  }

  /**
   * Determina jogador em contato.
   */
  private determineContactPlayer(p: SimPlayer): string | null {
    if (p.pos === "GK" && this.ball.height < 1) {
      // Goleiro em contato com atacante
      const attacker = this.players.find(
        (t) => t.side !== p.side && Math.hypot(t.x - p.x, t.z - p.z) < 2,
      );
      if (attacker) return attacker.id;
    }

    if (p.action && ["tackle", "slide"].includes(p.action)) {
      const opponent = this.players.find(
        (t) => t.side !== p.side && Math.hypot(t.x - p.x, t.z - p.z) < 2,
      );
      if (opponent) return opponent.id;
    }

    return null;
  }

  /**
   * Calcula velocidade relativa.
   */
  private calculateRelativeVelocity(
    p: SimPlayer,
    contactPlayerId: string | null,
  ): { vx: number; vz: number } | null {
    if (!contactPlayerId) return null;

    const other = this.players.find((t) => t.id === contactPlayerId);
    if (!other) return null;

    return {
      vx: p.vx - other.vx,
      vz: p.vz - other.vz,
    };
  }
}
