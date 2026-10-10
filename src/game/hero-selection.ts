/** Stable bounded insertion: retain only the highest-coverage eligible heroes.
 * Equal coverage keeps roster order, matching the previous stable Array.sort.
 * The storage is reused and never contains player objects or string keys. */
export class HeroSelectionBuffer {
  readonly indices: Int32Array;
  private readonly scores: Float64Array;
  count = 0;
  constructor(readonly capacity = 22) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError("Invalid hero capacity");
    this.indices = new Int32Array(capacity);
    this.scores = new Float64Array(capacity);
  }
  reset(): void {
    this.count = 0;
  }
  add(index: number, coverage: number, limit: number): void {
    const cap = Math.min(this.capacity, Math.max(0, Math.floor(limit)));
    if (!cap || !Number.isFinite(coverage)) return;
    let slot = Math.min(this.count, cap);
    while (slot > 0 && coverage > this.scores[slot - 1]!) slot -= 1;
    if (slot >= cap) return;
    const end = Math.min(this.count, cap - 1);
    for (let cursor = end; cursor > slot; cursor -= 1) {
      this.indices[cursor] = this.indices[cursor - 1]!;
      this.scores[cursor] = this.scores[cursor - 1]!;
    }
    this.indices[slot] = index;
    this.scores[slot] = coverage;
    this.count = Math.min(this.count + 1, cap);
  }
}

/** Retain eligible rigs and introduce one expensive mesh per selection cycle.
 * Demotions are immediate, so camera cuts and substitutions never keep an
 * invisible or departed athlete in the hero budget. */
export function stageHeroMembership(
  current: ReadonlySet<string>,
  desired: readonly string[],
): Set<string> {
  const next = new Set(desired.filter((id) => current.has(id)));
  const added = desired.find((id) => !current.has(id));
  if (added !== undefined) next.add(added);
  return next;
}

/** Screen coverage remains the eligibility gate. A readable ball carrier,
 * contact beat, keeper save or scorer wins a close tie without promoting
 * tiny or offscreen actors. Retained membership avoids rig churn. */
export function heroPriorityScore(
  coverage: number,
  moment: {
    retained: boolean;
    ballHolder: boolean;
    contact: boolean;
    keeperSave: boolean;
    scorer: boolean;
  },
): number | null {
  if (!Number.isFinite(coverage) || coverage <= 0) return null;
  const salient = moment.ballHolder || moment.contact || moment.keeperSave || moment.scorer;
  const threshold = moment.retained ? 0.035 : salient ? 0.032 : 0.052;
  if (coverage < threshold) return null;
  return (
    coverage * (moment.retained ? 1.12 : 1) +
    (moment.ballHolder ? 0.022 : 0) +
    (moment.contact ? 0.018 : 0) +
    (moment.keeperSave ? 0.045 : 0) +
    (moment.scorer ? 0.04 : 0)
  );
}
