/** UTF-16 boundaries keep accents and joined emoji intact during dialogue. */
export function dialogueBoundaries(text: string): number[] {
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (part) => part.index + part.segment.length);
  }
  let end = 0;
  return Array.from(text, (part) => (end += part.length));
}

export function dialogueRevealLength(boundaries: readonly number[], elapsedMs: number): number {
  const count = Math.min(boundaries.length, Math.max(0, Math.floor(elapsedMs / 24)));
  return count ? boundaries[count - 1]! : 0;
}
