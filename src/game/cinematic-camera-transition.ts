/**
 * A cut is reserved for a meaningful change of cinematic grammar. Keeping the
 * beat out of this signature lets a continuing performance settle into its
 * next line instead of snapping the camera a few centimetres every time text
 * advances.
 */
export interface CinematicCameraTransitionInput {
  /** A new set requires an editorial cut; easing across rooms crosses geometry. */
  scene: string;
  framing: "establishing" | "dialogue";
  subject: string;
  size: "geral" | "medio" | "proximo" | "close";
  reaction: boolean;
  opening: boolean;
}

export function cinematicCameraTransition(
  previous: CinematicCameraTransitionInput | null,
  next: CinematicCameraTransitionInput,
): "cut" | "ease" {
  if (!previous || previous.opening || next.opening) return "cut";
  if (previous.scene !== next.scene) return "cut";
  if (previous.framing !== next.framing) return "cut";
  if (previous.subject !== next.subject) return "cut";
  if (previous.size !== next.size) return "cut";
  if (previous.reaction !== next.reaction) return "cut";
  return "ease";
}

export type CinematicTransitionState = "stable" | "fade-out" | "swap" | "fade-in" | "cancelled";

export interface CinematicTransitionSnapshot {
  state: CinematicTransitionState;
  /** Opaque matte amount. `1` is fully opaque and `0` is fully clear. */
  opacity: 0 | 1;
  /** Monotonic token for the currently requested composition. */
  generation: number;
}

export interface CinematicTransitionControllerOptions {
  fadeOutMs?: number;
  fadeInMs?: number;
  reducedMotion?: boolean;
  onChange?: (snapshot: CinematicTransitionSnapshot) => void;
}

export type CinematicTransitionSwap = (
  signal: AbortSignal,
  generation: number,
) => void | Promise<void>;

type MatteElement = Pick<HTMLElement, "style" | "dataset">;

type ActiveTransition = {
  abort: AbortController;
  generation: number;
  swap: CinematicTransitionSwap;
  resolve: (completed: boolean) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout> | null;
  wake: (() => void) | null;
};

const DEFAULT_FADE_OUT_MS = 180;
const DEFAULT_FADE_IN_MS = 160;

function boundedDuration(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(2000, value ?? fallback));
}

/**
 * Owns the only interruptible camera composition transition.
 *
 * The matte is deliberately driven from JS instead of only from CSS: a cut
 * cannot reveal a half-mounted scene between CSS frames, and reduced motion
 * can skip movement while still preserving the opaque swap boundary. New
 * generations abort old swaps, so an old async completion can never commit a
 * newer camera composition.
 */
export class TransitionController {
  private readonly fadeOutMs: number;
  private readonly fadeInMs: number;
  private reducedMotion: boolean;
  private readonly onChange?: CinematicTransitionControllerOptions["onChange"];
  private invalidator: (() => void) | null = null;
  private matte: MatteElement | null = null;
  private active: ActiveTransition | null = null;
  private disposed = false;
  private generation = 0;
  private current: CinematicTransitionSnapshot = {
    state: "stable",
    opacity: 0,
    generation: 0,
  };

  constructor(options: CinematicTransitionControllerOptions = {}) {
    this.fadeOutMs = boundedDuration(options.fadeOutMs, DEFAULT_FADE_OUT_MS);
    this.fadeInMs = boundedDuration(options.fadeInMs, DEFAULT_FADE_IN_MS);
    this.reducedMotion = options.reducedMotion ?? false;
    this.onChange = options.onChange;
  }

  get snapshot(): CinematicTransitionSnapshot {
    return this.current;
  }

  /** Attach the opaque layer after the controller has been created. */
  attachMatte(matte: MatteElement | null): void {
    this.matte = matte;
    if (!matte) return;
    this.applyMatte(this.current.opacity, 0);
  }

  detachMatte(matte?: MatteElement | null): void {
    if (!matte || matte === this.matte) this.matte = null;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    // Finish the current visual phase immediately. The swap callback still
    // runs at the opaque boundary; only the animated time is removed.
    if (reduced) this.active?.wake?.();
  }

  /** Wake a demand-rendered 3D canvas whenever an async transition publishes. */
  setInvalidator(invalidate: (() => void) | null): void {
    this.invalidator = invalidate;
  }

  /** Start a new generation, cancelling any previous composition. */
  transition(swap: CinematicTransitionSwap): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);

    this.cancelActive(false);
    const generation = ++this.generation;
    const abort = new AbortController();
    let active!: ActiveTransition;
    const completed = new Promise<boolean>((resolve, reject) => {
      active = {
        abort,
        generation,
        swap,
        resolve,
        reject,
        timer: null,
        wake: null,
      };
      this.active = active;
    });

    this.publish("fade-out", 1, this.fadeDuration(this.fadeOutMs), generation);
    void this.run(active);
    return completed;
  }

  /** Alias for callers that model a transition as starting a new request. */
  start(swap: CinematicTransitionSwap): Promise<boolean> {
    return this.transition(swap);
  }

  /** Cancel the active generation and clear the matte for cleanup. */
  cancel(): void {
    this.cancelActive(true);
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancelActive(true);
    this.disposed = true;
    this.detachMatte();
  }

  private async run(active: ActiveTransition): Promise<void> {
    try {
      if (!(await this.wait(active, this.fadeDuration(this.fadeOutMs)))) return;
      if (!this.isCurrent(active)) return;

      this.publish("swap", 1, 0, active.generation);
      if (active.abort.signal.aborted) return;
      await active.swap(active.abort.signal, active.generation);
      if (!this.isCurrent(active) || active.abort.signal.aborted) return;

      this.publish("fade-in", 0, this.fadeDuration(this.fadeInMs), active.generation);
      if (!(await this.wait(active, this.fadeDuration(this.fadeInMs)))) return;
      if (!this.isCurrent(active)) return;

      this.publish("stable", 0, 0, active.generation);
      this.active = null;
      active.resolve(true);
    } catch (error) {
      if (!this.isCurrent(active)) return;
      this.publish("cancelled", 0, 0);
      this.active = null;
      active.reject(error);
    }
  }

  private wait(active: ActiveTransition, duration: number): Promise<boolean> {
    if (duration <= 0 || this.reducedMotion) return Promise.resolve(true);
    return new Promise((resolve) => {
      const finish = (result: boolean) => {
        if (active.timer !== null) {
          clearTimeout(active.timer);
          active.timer = null;
        }
        active.wake = null;
        resolve(result);
      };
      active.wake = () => finish(true);
      active.timer = setTimeout(() => finish(true), duration);
      active.abort.signal.addEventListener("abort", () => finish(false), { once: true });
    });
  }

  private cancelActive(clearMatte: boolean): void {
    const active = this.active;
    if (!active) {
      if (clearMatte && !this.disposed) this.publish("cancelled", 0, 0);
      return;
    }
    active.abort.abort();
    if (active.timer !== null) clearTimeout(active.timer);
    active.timer = null;
    active.wake = null;
    this.active = null;
    this.publish("cancelled", clearMatte ? 0 : this.current.opacity, 0, active.generation);
    active.resolve(false);
  }

  private isCurrent(active: ActiveTransition): boolean {
    return (
      !this.disposed && this.active === active && this.current.generation === active.generation
    );
  }

  private fadeDuration(duration: number): number {
    return this.reducedMotion ? 0 : duration;
  }

  private publish(
    state: CinematicTransitionState,
    opacity: 0 | 1,
    duration: number,
    generation = this.current.generation,
  ): void {
    this.current = Object.freeze({ state, opacity, generation });
    this.applyMatte(opacity, duration);
    this.onChange?.(this.current);
    this.invalidator?.();
  }

  private applyMatte(opacity: 0 | 1, duration: number): void {
    if (!this.matte) return;
    this.matte.style.background = "rgb(0 0 0 / 1)";
    this.matte.style.transition = duration > 0 ? `opacity ${duration}ms linear` : "none";
    this.matte.style.opacity = String(opacity);
    this.matte.dataset["transitionState"] = this.current.state;
    this.matte.dataset["transitionGeneration"] = String(this.current.generation);
  }
}
