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
