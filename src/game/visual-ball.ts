/**
 * Dados de física expostos exclusivamente para a apresentação da bola.
 *
 * `MatchSim` continua sendo a autoridade de regras, resultado, posse e replay.
 * O adaptador Rapier recebe uma cópia deste estado e jamais a escreve de volta.
 */
export interface CanonicalBallPhysicsState {
  x: number;
  z: number;
  height: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  attached: boolean;
  holder: string | null;
}

/** Pose serializável usada pelo Canvas, câmera e VFX quando Rapier estiver disponível. */
export interface VisualBallState {
  x: number;
  z: number;
  height: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
}

export function visualBallFromCanonical(ball: CanonicalBallPhysicsState): VisualBallState {
  return {
    x: ball.x,
    z: ball.z,
    height: ball.height,
    vx: ball.vx,
    vy: ball.vy,
    vz: ball.vz,
    spin: ball.spin,
  };
}
