export type OfficialRole = "ref" | "ar1" | "ar2";
export type OfficialCue = "none" | "yellow" | "red" | "goal" | "offside" | "foul";
export type OfficialCounts = {
  cards: number;
  reds: number;
  goals: number;
  offsides: number;
  fouls: number;
};

/** Presentation consumes counters; it never creates a foul or changes a score. */
export function officialCue(
  previous: OfficialCounts,
  next: OfficialCounts,
  role: OfficialRole,
): OfficialCue {
  if (role === "ref") {
    if (next.reds > previous.reds) return "red";
    if (next.cards > previous.cards) return "yellow";
    if (next.goals > previous.goals) return "goal";
    if (next.fouls > previous.fouls) return "foul";
  } else {
    if (next.offsides > previous.offsides) return "offside";
    if (next.goals > previous.goals) return "goal";
  }
  return "none";
}

/** Avoid a yellow official disappearing into a yellow home/away shirt. */
export function officialShirt(home: string, away: string): string {
  const rgb = (hex: string) =>
    [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) || 0);
  const shirts = ["#e5ca39", "#39cbd5", "#ed729b"];
  const teams = [rgb(home), rgb(away)];
  return shirts
    .map((color) => ({
      color,
      distance: Math.min(
        ...teams.map((team) =>
          rgb(color).reduce((sum, channel, i) => sum + (channel - team[i]!) ** 2, 0),
        ),
      ),
    }))
    .sort((a, b) => b.distance - a.distance)[0]!.color;
}
