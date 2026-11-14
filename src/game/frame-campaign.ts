import { FrameMetrics } from "./frame-metrics";
import { validMatchRulesRevision, type MatchRulesRevision } from "./match-execution-contract";

export interface FrameCampaignContext {
  phase: "match" | "cutscene";
  key: string;
  quality: string;
  rulesRevision?: MatchRulesRevision | undefined;
}

let campaignSequence = 0;

/** Cumulative statistics are calculated from frame intervals, never by
 * averaging window percentiles/lows. A bounded overflow is explicitly partial. */
export class FrameCampaign {
  private readonly metrics: FrameMetrics;
  private context: Readonly<FrameCampaignContext> | null = null;
  private id = 0;
  private last: number | null = null;
  private suspended = false;
  private interruptions = 0;

  constructor(capacity = 90_000) {
    this.metrics = new FrameMetrics(capacity);
  }

  switchContext(context: FrameCampaignContext) {
    if (context.rulesRevision !== undefined && !validMatchRulesRevision(context.rulesRevision))
      throw new RangeError("Unknown frame campaign rules revision");
    if (
      this.context?.key === context.key &&
      this.context.phase === context.phase &&
      this.context.quality === context.quality &&
      this.context.rulesRevision === context.rulesRevision
    )
      return null;
    const previous = this.context ? this.snapshot(true) : null;
    this.metrics.reset();
    this.context = Object.freeze({ ...context });
    this.id = ++campaignSequence;
    this.last = null;
    this.suspended = false;
    this.interruptions = 0;
    return previous;
  }

  recordInterval(ms: number) {
    if (!this.context) throw new Error("A frame campaign needs a context before sampling");
    this.metrics.add(ms);
    if (Number.isFinite(ms) && ms > 0) this.suspended = false;
  }

  interrupt() {
    if (!this.context) return;
    if (!this.suspended) this.interruptions += 1;
    this.suspended = true;
    this.last = null;
  }

  observeFrame(now: number, context: FrameCampaignContext, suspended = false) {
    const previous = this.switchContext(context);
    if (!Number.isFinite(now)) {
      this.metrics.add(Number.NaN);
      return { previous, intervalMs: 0 };
    }
    if (suspended) {
      this.interrupt();
      return { previous, intervalMs: 0 };
    }
    this.suspended = false;
    const intervalMs = this.last === null ? 0 : now - this.last;
    if (this.last !== null) this.metrics.add(intervalMs);
    this.last = now;
    return { previous, intervalMs: Math.max(0, intervalMs) };
  }

  snapshot(includeRaw = false) {
    const summary = this.metrics.summary();
    return {
      id: this.id,
      context: this.context,
      interruptions: this.interruptions,
      summary,
      quantilesScope: summary.coverage.completeDistribution
        ? ("whole-campaign" as const)
        : ("newest-retained-intervals-only" as const),
      rawScope: "chronological retained frame intervals in milliseconds" as const,
      ...(includeRaw ? { rawFrameMs: this.metrics.rawFrameMs() } : {}),
    };
  }
}
