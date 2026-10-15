/** Deterministic, reusable visual-only context kernel.
 * Kept out of the authoritative gameplay simulation source.
 * The reused object avoids allocating a new context computer per snapshot.
 */
import type { SimPlayer, SimView } from "./sim-contracts";
import { FIELD_X } from "./sim-rules";
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

export class MatchVisualContextComputer {
  private players!: SimPlayer[];
  private ball!: SimView["ball"];
  private time = 0;
  private matchSeed = "";

  compute(players: SimPlayer[], ball: SimView["ball"], time: number, matchSeed: string) {
    this.players = players;
    this.ball = ball;
    this.time = time;
    this.matchSeed = matchSeed;
    return this.generateVisualContext();
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
        return (this.hashString(`${this.matchSeed}:${p.pid}`) & 1) === 0 ? "handLeft" : "handRight";
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
