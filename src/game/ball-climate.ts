// ============================================================================
//  ball-climate.ts
//  Clima físico da bola: vento determinístico por partida e resposta do
//  gramado por clima.
//
//  O vento é um vetor constante por partida (rajadas entram na força, não na
//  direção) sorteado num fluxo próprio (`${seed}|wind`) para não deslocar
//  nenhuma outra rolagem da simulação. Aplica-se só com a bola no ar, nos
//  dois integradores (compatível e autoridade Rapier).
//
//  Unidades: aceleração em u/s² (campo 105x68u, chute forte ~30u/s). Mesmo o
//  vento forte (~2.2) só desvia cruzamentos longos alguns decímetros.
// ============================================================================

import { makeRng } from "./rng";
import type { WeatherKind } from "./sim-rules";

export interface WindVector {
  x: number;
  z: number;
  /** força normalizada 0..1 (visuais: bandeiras, chuva inclinada, rede) */
  strength01: number;
}

/** Vento da partida: 65% calmo, 25% brisa, 10% rajadas. Determinístico. */
export function windFor(seed: string): WindVector {
  const rng = makeRng(`${seed}|wind`);
  const angle = rng() * Math.PI * 2;
  const roll = rng();
  const speed = roll < 0.65 ? rng() * 0.5 : roll < 0.9 ? 0.5 + rng() * 0.7 : 1.2 + rng() * 1.0;
  return {
    x: Math.cos(angle) * speed,
    z: Math.sin(angle) * speed,
    strength01: Math.min(1, speed / 2.2),
  };
}

export interface PitchCondition {
  /** arrasto com a bola no ar (1/s) */
  airDrag: number;
  /** arrasto com a bola rolando (1/s) */
  rollDrag: number;
  /** restituição do quique (fração da vy devolvida) */
  bounce: number;
  /** fração da velocidade horizontal mantida no quique */
  skid: number;
  /** atrito do gramado no colisor Rapier */
  rapierFriction: number;
  /** restituição do gramado no colisor Rapier */
  rapierRestitution: number;
  /** restituição da bola no colisor Rapier */
  rapierBallRestitution: number;
}

/**
 * Resposta do gramado. Chuva: quique morto mas bola escorregadia que corre
 * (menos atrito); calor: gramado seco e vivo, quique alto, rolamento freado.
 * Os valores de "clear" reproduzem exatamente a física anterior.
 */
export function pitchCondition(weather: WeatherKind): PitchCondition {
  switch (weather) {
    case "rain":
      return {
        airDrag: 0.32,
        rollDrag: 0.9,
        bounce: 0.38,
        skid: 0.92,
        rapierFriction: 0.55,
        rapierRestitution: 0.34,
        rapierBallRestitution: 0.42,
      };
    case "heat":
      return {
        airDrag: 0.26,
        rollDrag: 1.9,
        bounce: 0.58,
        skid: 0.74,
        rapierFriction: 0.95,
        rapierRestitution: 0.55,
        rapierBallRestitution: 0.58,
      };
    case "clear":
    default:
      return {
        airDrag: 0.28,
        rollDrag: 1.5,
        bounce: 0.52,
        skid: 0.82,
        rapierFriction: 0.84,
        rapierRestitution: 0.48,
        rapierBallRestitution: 0.54,
      };
  }
}
