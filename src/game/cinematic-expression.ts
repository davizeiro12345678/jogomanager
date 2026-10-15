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
  const gesture = cue?.gesture ?? "explain";
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
  const turn = cue?.turn;
  // The gesture envelope is shared with listeners, so an answering actor can
  // acknowledge a particular spoken beat without a second animation clock.
  const listenerBeat =
    !acting && turn ? Math.max(0, Math.min(1, emphasis)) * turn.listenerReaction : 0;
  // A listener answers the line with occasional, held acknowledgement rather
  // than a metronomic nod. A conversation handoff adds a small, synchronized
  // reaction; warmth makes it readable while tension keeps the face guarded.
  const idleAcknowledgement = acting
    ? 0
    : Math.max(0, Math.sin(t * 0.73 + seed * 0.23 + 0.9)) ** 6 * (0.45 + warmth * 0.55);
  const acknowledgement = acting
    ? 0
    : Math.max(
        idleAcknowledgement,
        listenerBeat * (turn?.kind === "challenge" ? 0.72 : turn?.kind === "question" ? 0.82 : 1),
      );
  // Fixations hold between brief saccades instead of continuously swimming.
  const fixation = Math.floor((t + Math.abs(seed % 7) * 0.19) / 0.83);
  const microGaze =
    (Math.sin(fixation * 2.37 + seed) * 0.72 + Math.sin(fixation * 0.91 + seed * 0.4) * 0.28) *
    0.00016;
  const intentLift =
    gesture === "question"
      ? 0.00055
      : gesture === "rally"
        ? 0.00032
        : gesture === "reassure"
          ? 0.00042
          : gesture === "confront"
            ? -0.00018
            : gesture === "celebrate"
              ? 0.00068
              : 0.00016;
  const intentTilt =
    gesture === "confront"
      ? -0.032
      : gesture === "question"
        ? 0.026
        : gesture === "reassure"
          ? 0.022
          : gesture === "celebrate"
            ? 0.034
            : 0.008;
  const gazeX = Math.max(-0.00195, Math.min(0.00195, Math.sin(focus) * 0.00172 + microGaze));
  const gazeY = Math.max(
    -0.00042,
    Math.min(
      0.00042,
      Math.sin(fixation * 1.71 + seed * 0.3) * 0.00014 -
        tension * 0.00012 +
        delivery * 0.00006 +
        listenerBeat * (turn?.kind === "challenge" ? -0.00004 : 0.000035),
    ),
  );
  return {
    blink: 0.08 + closure * 0.9,
    gazeX,
    gazeY,
    browLift: Math.max(
      -0.00185,
      Math.min(
        0.00185,
        delivery * (0.0008 + warmth * 0.00075 + intentLift) -
          tension * 0.00042 +
          acknowledgement * warmth * 0.00048,
      ),
    ),
    browTilt: (warmth * 0.04 - tension * 0.058 + intentTilt) * (0.25 + delivery * 0.75),
    headRoll:
      Math.sin(fixation * 0.73 + seed) * (acting ? 0.0065 : 0.011) +
      delivery * (gesture === "question" ? 0.005 : gesture === "confront" ? -0.004 : 0) +
      (!acting
        ? listenerBeat *
          (turn?.kind === "challenge" ? -0.008 : turn?.kind === "question" ? 0.01 : 0.006)
        : 0),
    // A listener acknowledges the meaning of a beat through the neck, with a
    // small held dip instead of continuous speech-like bobbing.
    headPitch: acting ? 0 : acknowledgement * (0.014 + warmth * 0.026) * (1 - tension * 0.45),
  };
}
