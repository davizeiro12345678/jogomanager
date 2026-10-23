/** A bounded shuffle bag per event. Cosmetic randomness never touches MatchSim. */
export class NarrationRotation {
  private readonly bags = new Map<
    string,
    { remaining: number[]; last: number | undefined; size: number }
  >();
  clear() {
    this.bags.clear();
  }
  next(event: string, size: number, random: () => number = Math.random): number {
    if (!Number.isSafeInteger(size) || size < 1 || size > 10000) return 0;
    let bag = this.bags.get(event);
    if (!bag || bag.size !== size) {
      bag = { remaining: [], last: undefined, size };
      this.bags.set(event, bag);
    }
    if (!bag.remaining.length) {
      bag.remaining = Array.from({ length: size }, (_, i) => i);
      for (let i = size - 1; i > 0; i--) {
        const sample = random();
        const j = Math.min(
          i,
          Math.max(0, Math.floor((Number.isFinite(sample) ? sample : 0) * (i + 1))),
        );
        [bag.remaining[i], bag.remaining[j]] = [bag.remaining[j]!, bag.remaining[i]!];
      }
      if (size > 1 && bag.remaining.at(-1) === bag.last)
        [bag.remaining[0], bag.remaining[size - 1]] = [bag.remaining[size - 1]!, bag.remaining[0]!];
    }
    const next = bag.remaining.pop()!;
    bag.last = next;
    return next;
  }
}
