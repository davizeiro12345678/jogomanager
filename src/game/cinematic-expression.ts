import type { CinematicCue } from "./cinematic-cue";

/** Eyes acquire a new speaker before the cervical chain follows. The residual
 * eye rotation stays small once the head has settled; pause preserves both. */
export class CinematicGaze {
  private acquired = 0;
  private ready = false;
  private readonly state = { headYaw: 0, eyeYaw: 0 };

  sample(target: number, dt: number, instant = false) {
    const yaw = Number.isFinite(target) ? Math.max(-0.9, Math.min(0.9, target)) : 0;
    if (!this.ready || instant) {
      this.acquired = yaw;
      this.state.headYaw = yaw * 0.78;
      this.ready = true;
    } else if (Number.isFinite(dt) && dt > 0) {
      const h = Math.min(dt, 0.25);
      this.acquired += (yaw - this.acquired) * (1 - Math.exp(-34 * h));
      this.state.headYaw += (yaw * 0.78 - this.state.headYaw) * (1 - Math.exp(-8 * h));
    } else return this.state;
    this.state.eyeYaw = Math.max(-0.42, Math.min(0.42, this.acquired - this.state.headYaw));
    return this.state;
  }
}

/** Cosmetic performance in actor-local space. No audio timing is implied:
 * speech groups drive the jaw, while eye contact and blinks keep listeners alive. */
export function cinematicExpressionAt(
  time: number,
  seed: number,
  acting: boolean,
  attentionYaw: number,
  cue: CinematicCue | null | undefined,
  emphasis: number,
) {
  const t = Number.isFinite(time) ? Math.max(0, time) : 0;
  const tension = Math.max(0, Math.min(1, cue?.tension ?? 0));
  const warmth = Math.max(0, Math.min(1, cue?.warmth ?? 0.4));
  // Uneven intervals and short doubles avoid every blink becoming a metronome.
  const phase = (t + Math.abs(seed % 113) * 0.37) % 13.8;
  const blinkAge =
    phase < 0.19
      ? phase
      : phase >= 4.6 && phase < 4.79
        ? phase - 4.6
        : phase >= 4.98 && phase < 5.1
          ? (phase - 4.98) * (0.19 / 0.12)
          : phase >= 10.2 && phase < 10.39
            ? phase - 10.2
            : -1;
  const closure = blinkAge >= 0 ? Math.sin((Math.PI * blinkAge) / 0.19) ** 2 : 0;
  const focus = Math.max(-0.9, Math.min(0.9, Number.isFinite(attentionYaw) ? attentionYaw : 0));
  const delivery = acting ? Math.max(0, Math.min(1, emphasis)) : 0;
  const acknowledgement = acting ? 0 : Math.max(0, Math.sin(t * 1.1 + seed * 0.23)) ** 4;
  // Fixations hold between brief saccades instead of continuously swimming.
  const fixation = Math.floor((t + Math.abs(seed % 7) * 0.19) / 0.83);
  const microGaze = Math.sin(fixation * 2.37 + seed) * 0.00013;
  return {
    blink: 0.08 + closure * 0.9,
    gazeX: Math.sin(focus) * 0.0018 + microGaze,
    gazeY: Math.sin(t * 0.51 + seed * 0.3) * 0.00012 - tension * 0.00012,
    browLift:
      delivery * (0.0018 + warmth * 0.0015) - tension * 0.0005 + acknowledgement * warmth * 0.00065,
    browTilt: (warmth * 0.045 - tension * 0.065) * (0.25 + delivery * 0.75),
    headRoll: Math.sin(t * 0.43 + seed) * (acting ? 0.008 : 0.014),
  };
}
