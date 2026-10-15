/** Deterministic match ratings with no direct MatchSim state dependency. */
import type { MatchStats, PlayerRating, Side, SimPlayer } from "./sim-contracts";

export function calculatePlayerRatings(
  players: readonly SimPlayer[],
  subsOut: readonly SimPlayer[],
  minute: number,
  stats: Readonly<Record<Side, MatchStats>>,
): PlayerRating[] {
    const all = [...players, ...subsOut];
    return all.map((p) => {
      const mins = Math.max(
        1,
        p.minutes + (subsOut.includes(p) ? 0 : minute - p.onSince),
      );
      const scored = stats[p.side].goals;
      const conceded = stats[p.side === "home" ? "away" : "home"].goals;
      let r = 6.1;
      r += p.goals * 1.3 + p.assists * 0.8;
      r += Math.min(0.5, p.passes / 40) + Math.min(0.6, p.tackles * 0.15);
      r += Math.min(0.8, p.interceptions * 0.2) + Math.min(0.6, p.xg * 0.9);
      if (p.shots > 0) r += (p.goals / p.shots) * 0.4;
      if (p.pos === "GK") r += Math.min(1.3, p.saves * 0.3) - conceded * 0.4;
      else if (p.pos === "DF") r += conceded === 0 && mins >= 60 ? 0.5 : -conceded * 0.12;
      r += p.pensScored * 0.5 - p.pensMissed * 0.5;
      r -= p.yellows * 0.35 + (p.sentOff ? 1.2 : 0) + p.offsides * 0.08;
      r += (scored - conceded) * 0.1;
      r *= 0.8 + Math.min(1, mins / 70) * 0.2;
      return {
        pid: p.pid,
        side: p.side,
        name: p.name,
        number: p.number,
        pos: p.pos,
        goals: p.goals,
        assists: p.assists,
        passes: p.passes,
        tackles: p.tackles,
        saves: p.saves,
        minutes: mins,
        yellows: p.yellows,
        red: p.sentOff,
        injuryWeeks: p.injuryWeeks,
        interceptions: p.interceptions,
        xg: Math.round(p.xg * 100) / 100,
        rating: Math.max(3, Math.min(10, Math.round(r * 10) / 10)),
      };
    });
}
