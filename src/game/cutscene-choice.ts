import type { CutsceneLine } from "@/content/cutscenes";

/** Insert a branch once, without replacing later dialogue or changing the
 * authored script. The career caller remains the owner of any consequences. */
export function cutsceneBranch(
  lines: readonly CutsceneLine[],
  lineIndex: number,
  choiceIndex: number,
) {
  const choice = lines[lineIndex]?.choices?.[choiceIndex];
  if (!choice) return null;
  return {
    lines: [...lines.slice(0, lineIndex + 1), ...choice.response, ...lines.slice(lineIndex + 1)],
    effect: choice.effect,
  };
}
