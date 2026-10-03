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

/** Preparation, held signal and recovery use a smooth envelope. */
export function officialGestureWeight(remaining: number, duration: number): number {
  const smooth = (t: number) => {
    const u = Math.max(0, Math.min(1, t));
    return u * u * (3 - 2 * u);
  };
  return smooth((duration - remaining) / 0.32) * smooth(remaining / 0.45);
}

type TrackingPlayer = { x: number; z: number; side: "home" | "away"; sentOff?: boolean };
/** Presentation follows the second-last defender/ball. It never adjudicates
 * an offside or modifies the simulation, and reuses the supplied output. */
export function officialTrackingTarget(
  role: OfficialRole,
  ball: { x: number; z: number },
  players: readonly TrackingPlayer[],
  fieldX: number,
  fieldZ: number,
  output: { x: number; z: number },
) {
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  if (role !== "ref") {
    const direction = role === "ar1" ? 1 : -1;
    const defending = role === "ar1" ? "away" : "home";
    let first = -Infinity,
      second = -Infinity;
    for (const player of players) {
      if (player.side !== defending || player.sentOff) continue;
      const x = player.x * direction;
      if (x >= first) {
        second = first;
        first = x;
      } else if (x > second) second = x;
    }
    const line = Math.max(0, ball.x * direction, Number.isFinite(second) ? second : 0);
    output.x = direction * clamp(line, 0, fieldX - 0.8);
    output.z = direction * (fieldZ + 1.6);
  } else {
    output.x = clamp(ball.x * 0.9 - 5, -fieldX + 2, fieldX - 2);
    output.z = clamp(ball.z * 0.52 + 6 + ball.x * 0.1, -fieldZ + 2, fieldZ - 2);
    // A small local detour prevents the referee standing inside an athlete.
    let nearest: TrackingPlayer | undefined,
      nearestDistance = 2.3;
    for (const player of players) {
      if (player.sentOff) continue;
      const distance = Math.hypot(output.x - player.x, output.z - player.z);
      if (distance < nearestDistance) {
        nearest = player;
        nearestDistance = distance;
      }
    }
    if (nearest) {
      const dx = output.x - nearest.x,
        dz = output.z - nearest.z;
      const length = Math.hypot(dx, dz);
      output.x = clamp(
        nearest.x + (length > 0.01 ? dx / length : 0) * 2.3,
        -fieldX + 2,
        fieldX - 2,
      );
      output.z = clamp(
        nearest.z + (length > 0.01 ? dz / length : 1) * 2.3,
        -fieldZ + 2,
        fieldZ - 2,
      );
    }
  }
  return output;
}
