import type { MatchStats, ShotRecord, Side, SimPlayer } from "./sim-types";
import type { CareerState } from "./types";
import type { TacticalChangeEvent } from "./tactical-plan";
export interface AnalyticsPoint {
  minute: number;
  homeXg: number;
  awayXg: number;
  homePossession: number;
  awayPossession: number;
  homePasses: number;
  awayPasses: number;
  homeRecoveries: number;
  awayRecoveries: number;
}
export interface PassConnection {
  from: string;
  to: string;
  fromName?: string;
  toName?: string;
  side: Side;
  attempts: number;
  completed: number;
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
}
export interface MatchAnalyticsV1 {
  version: 1;
  source: "spatial" | "quick";
  timeline: AnalyticsPoint[];
  occupancy: Record<Side, number[]>;
  connections: PassConnection[];
  /** Fifteen-minute measured aggregates; absent in earlier replay versions. */
  periods?: {
    from: number;
    occupancy: Record<Side, number[]>;
    passes: [number, number, number][];
  }[];
  changes: TacticalChangeEvent[];
  shots: ShotRecord[];
  samples: number;
  lastSample: number;
  lastPossession: Record<Side, number>;
}
export interface CareerMatchAnalytics {
  id: string;
  season: number;
  round: number;
  home: string;
  away: string;
  source: "spatial" | "quick";
  score: [number, number];
  xg: [number, number];
  possession: [number, number];
  passes: [number, number];
  changes: TacticalChangeEvent[];
}
export function createMatchAnalytics(
  source: MatchAnalyticsV1["source"] = "spatial",
): MatchAnalyticsV1 {
  return {
    version: 1,
    source,
    timeline: [],
    occupancy: { home: Array<number>(96).fill(0), away: Array<number>(96).fill(0) },
    connections: [],
    periods: [],
    changes: [],
    shots: [],
    samples: 0,
    lastSample: -1,
    lastPossession: { home: 0, away: 0 },
  };
}
function spatialPeriod(a: MatchAnalyticsV1) {
  const from = Math.max(0, Math.min(135, Math.floor(a.lastSample / 900) * 15));
  const periods = (a.periods ??= []);
  let period = periods.find((p) => p.from === from);
  if (!period) {
    period = {
      from,
      occupancy: { home: Array<number>(96).fill(0), away: Array<number>(96).fill(0) },
      passes: [],
    };
    periods.push(period);
  }
  return period;
}
/** Measured positions only; plain state is compatible with checkpoint recovery. */
export function sampleAnalytics(
  a: MatchAnalyticsV1,
  time: number,
  players: readonly SimPlayer[],
  stats: Record<Side, MatchStats>,
) {
  if (time - a.lastSample < 1) return;
  a.lastSample = time;
  a.samples++;
  const period = spatialPeriod(a);
  for (const p of players) {
    if (p.sentOff) continue;
    const x = Math.max(0, Math.min(11, Math.floor(((p.x + 52.5) / 105) * 12)));
    const zAxis = Math.max(0, Math.min(7, Math.floor(((p.z + 34) / 68) * 8)));
    a.occupancy[p.side][zAxis * 12 + x]!++;
    period.occupancy[p.side][zAxis * 12 + x]!++;
  }
  const minute = Math.min(149, Math.floor(time / 60));
  if (a.timeline.at(-1)?.minute === minute) return;
  const h = stats.home.possessionTicks - a.lastPossession.home,
    v = stats.away.possessionTicks - a.lastPossession.away;
  a.timeline.push({
    minute,
    homeXg: stats.home.xg,
    awayXg: stats.away.xg,
    homePossession: h + v ? (h / (h + v)) * 100 : 50,
    awayPossession: h + v ? (v / (h + v)) * 100 : 50,
    homePasses: stats.home.passesOk,
    awayPasses: stats.away.passesOk,
    homeRecoveries: stats.home.interceptions,
    awayRecoveries: stats.away.interceptions,
  });
  a.lastPossession = { home: stats.home.possessionTicks, away: stats.away.possessionTicks };
}
export function recordPass(a: MatchAnalyticsV1, from: SimPlayer, to: SimPlayer, completed = false) {
  let edge = a.connections.find(
    (p) => p.from === from.pid && p.to === to.pid && p.side === from.side,
  );
  if (!edge) {
    if (a.connections.length >= 484) return;
    edge = {
      from: from.pid,
      to: to.pid,
      fromName: from.name,
      toName: to.name,
      side: from.side,
      attempts: 0,
      completed: 0,
      x: from.x,
      z: from.z,
      targetX: to.x,
      targetZ: to.z,
    };
    a.connections.push(edge);
  }
  const index = a.connections.indexOf(edge);
  let period = spatialPeriod(a);
  if (completed) {
    // A completed pass belongs to the period in which it was attempted.
    period =
      [...(a.periods ?? [])]
        .reverse()
        .find((p) => p.passes.some((count) => count[0] === index && count[1] > count[2])) ?? period;
    edge.completed++;
  } else {
    edge.attempts++;
    edge.x += (from.x - edge.x) / edge.attempts;
    edge.z += (from.z - edge.z) / edge.attempts;
    edge.targetX += (to.x - edge.targetX) / edge.attempts;
    edge.targetZ += (to.z - edge.targetZ) / edge.attempts;
  }
  let counts = period.passes.find((p) => p[0] === index);
  if (!counts) {
    counts = [index, 0, 0];
    period.passes.push(counts);
  }
  counts[completed ? 2 : 1]++;
}
/**
 * Resolve the one recorded attempt against the teammate who actually received
 * it. Keep its original period and stable edge indices across checkpoint load.
 * A missing attempt or a full graph cannot manufacture a completion.
 */
export function recordPassReception(
  a: MatchAnalyticsV1,
  from: SimPlayer,
  intended: SimPlayer,
  actual: SimPlayer,
): boolean {
  if (from.side !== actual.side || from.side !== intended.side || from.pid === actual.pid)
    return false;
  const sourceIndex = a.connections.findIndex(
    (edge) => edge.from === from.pid && edge.to === intended.pid && edge.side === from.side,
  );
  const source = a.connections[sourceIndex];
  if (!source || source.attempts <= source.completed) return false;
  let targetIndex = a.connections.findIndex(
    (edge) => edge.from === from.pid && edge.to === actual.pid && edge.side === from.side,
  );
  if (targetIndex < 0 && a.connections.length >= 484) return false;
  const period =
    [...(a.periods ?? [])]
      .reverse()
      .find((entry) =>
        entry.passes.some(
          ([index, attempts, completed]) => index === sourceIndex && attempts > completed,
        ),
      ) ?? spatialPeriod(a);
  let sourceCounts = period.passes.find(([index]) => index === sourceIndex);
  // Older analytics may have global counts without measured periods. Recover
  // only this known pending attempt, without inventing historical samples.
  if (!sourceCounts) {
    sourceCounts = [sourceIndex, 1, 0];
    period.passes.push(sourceCounts);
  } else if (sourceCounts[1] <= sourceCounts[2]) {
    sourceCounts[1]++;
  }
  if (targetIndex === sourceIndex) {
    source.completed++;
    sourceCounts[2]++;
    return true;
  }
  if (targetIndex < 0) {
    targetIndex = a.connections.length;
    a.connections.push({
      from: from.pid,
      to: actual.pid,
      fromName: from.name,
      toName: actual.name,
      side: from.side,
      attempts: 0,
      completed: 0,
      x: from.x,
      z: from.z,
      targetX: actual.x,
      targetZ: actual.z,
    });
  }
  const target = a.connections[targetIndex]!;
  source.attempts--;
  sourceCounts[1]--;
  target.attempts++;
  target.completed++;
  target.x += (from.x - target.x) / target.attempts;
  target.z += (from.z - target.z) / target.attempts;
  target.targetX += (actual.x - target.targetX) / target.attempts;
  target.targetZ += (actual.z - target.targetZ) / target.attempts;
  let targetCounts = period.passes.find(([index]) => index === targetIndex);
  if (!targetCounts) {
    targetCounts = [targetIndex, 0, 0];
    period.passes.push(targetCounts);
  }
  targetCounts[1]++;
  targetCounts[2]++;
  return true;
}
/** Presentation copy includes current totals without mutating deterministic state. */
export function analyticsSnapshot(
  a: MatchAnalyticsV1,
  time: number,
  stats: Record<Side, MatchStats>,
  shots: readonly ShotRecord[],
): MatchAnalyticsV1 {
  const out = structuredClone(a);
  out.shots = shots.map((shot) => ({ ...shot }));
  const minute = Math.min(149, Math.floor(time / 60));
  const h = stats.home.possessionTicks - a.lastPossession.home;
  const v = stats.away.possessionTicks - a.lastPossession.away;
  const previous = out.timeline.at(-1);
  const point: AnalyticsPoint = {
    minute,
    homeXg: stats.home.xg,
    awayXg: stats.away.xg,
    homePossession: h + v ? (h / (h + v)) * 100 : (previous?.homePossession ?? 50),
    awayPossession: h + v ? (v / (h + v)) * 100 : (previous?.awayPossession ?? 50),
    homePasses: stats.home.passesOk,
    awayPasses: stats.away.passesOk,
    homeRecoveries: stats.home.interceptions,
    awayRecoveries: stats.away.interceptions,
  };
  if (previous?.minute === minute) out.timeline[out.timeline.length - 1] = point;
  else out.timeline.push(point);
  return out;
}
export function summarizeMatch(
  a: MatchAnalyticsV1,
  career: CareerState,
  home: string,
  away: string,
  stats: Record<Side, MatchStats>,
): CareerMatchAnalytics {
  const total = stats.home.possessionTicks + stats.away.possessionTicks;
  return {
    id: `${career.season}:${career.round}:${home}:${away}`,
    season: career.season,
    round: career.round,
    home,
    away,
    source: a.source,
    score: [stats.home.goals, stats.away.goals],
    xg: [stats.home.xg, stats.away.xg],
    possession: total
      ? [(stats.home.possessionTicks / total) * 100, (stats.away.possessionTicks / total) * 100]
      : [50, 50],
    passes: [stats.home.passesOk, stats.away.passesOk],
    changes: a.changes.slice(-40),
  };
}
export function appendMatchAnalytics(state: CareerState, entry: CareerMatchAnalytics): CareerState {
  return {
    ...state,
    matchAnalytics: [entry, ...(state.matchAnalytics ?? []).filter((p) => p.id !== entry.id)].slice(
      0,
      100,
    ),
  };
}
