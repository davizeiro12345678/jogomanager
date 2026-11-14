import { describe, expect, it } from "vitest";
import { FrameCampaign } from "./frame-campaign";
import { FrameMetrics } from "./frame-metrics";

const context = { phase: "cutscene" as const, key: "scene:locker/alta/1280x720", quality: "alta" };

describe("frame campaign evidence", () => {
  it("starts a distinct campaign when only the rules revision changes", () => {
    const campaign = new FrameCampaign();
    campaign.switchContext({ ...context, rulesRevision: 1 });
    campaign.recordInterval(500);
    const previous = campaign.switchContext({ ...context, rulesRevision: 2 });
    expect(previous?.rawFrameMs).toEqual([500]);
    expect(previous?.context?.rulesRevision).toBe(1);
    expect(campaign.snapshot().context?.rulesRevision).toBe(2);
    expect(campaign.snapshot().summary.frames).toBe(0);
  });
  it("rejects unsupported rule context metadata before changing the campaign", () => {
    const campaign = new FrameCampaign();
    campaign.switchContext({ ...context, rulesRevision: 1 });
    campaign.recordInterval(16);
    expect(() => campaign.switchContext({ ...context, rulesRevision: 3 } as never)).toThrow(
      /rules revision/i,
    );
    expect(campaign.snapshot().summary.frames).toBe(1);
    expect(campaign.snapshot().context?.rulesRevision).toBe(1);
  });
  it("computes global tails and FPS from intervals instead of averaging window quantiles", () => {
    const campaign = new FrameCampaign();
    campaign.switchContext(context);
    const first = Array.from({ length: 1000 }, () => 10);
    const second = [...Array.from({ length: 998 }, () => 10), 100, 3000];
    const windows = [first, second].map((samples) => {
      const window = new FrameMetrics();
      samples.forEach((ms) => {
        window.add(ms);
        campaign.recordInterval(ms);
      });
      return window.summary();
    });
    const report = campaign.snapshot(true);
    const raw = report.rawFrameMs!;
    const sorted = raw.slice().sort((a, b) => a - b);
    const slow1 = sorted.slice(-20).reduce((sum, ms) => sum + ms, 0) / 20;
    const slow01 = sorted.slice(-2).reduce((sum, ms) => sum + ms, 0) / 2;
    expect(raw).toEqual([...first, ...second]);
    expect(report.summary.frames).toBe(2000);
    expect(report.summary.fps).toBeCloseTo(2_000_000 / 23_080, 10);
    expect(report.summary.onePercentLow).toBeCloseTo(1000 / slow1, 10);
    expect(report.summary.pointOnePercentLow).toBeCloseTo(1000 / slow01, 10);
    expect(report.summary.onePercentLow).not.toBeCloseTo(
      (windows[0]!.onePercentLow + windows[1]!.onePercentLow) / 2,
    );
    expect(report.summary.pointOnePercentLow).not.toBeCloseTo(
      (windows[0]!.pointOnePercentLow + windows[1]!.pointOnePercentLow) / 2,
    );
    expect(report.quantilesScope).toBe("whole-campaign");
    expect(report.summary.coverage.completeDistribution).toBe(true);
  });

  it("closes the old campaign before switching phase, preset or scene", () => {
    const campaign = new FrameCampaign();
    campaign.observeFrame(0, context);
    campaign.observeFrame(400, context);
    const result = campaign.observeFrame(500, {
      ...context,
      phase: "match",
      key: "fixture:new/media",
      quality: "media",
    });
    expect(result.intervalMs).toBe(0);
    expect(result.previous?.context).toEqual(context);
    expect(result.previous?.rawFrameMs).toEqual([400]);
    const active = campaign.snapshot();
    expect(active.id).not.toBe(result.previous!.id);
    expect(active.context?.phase).toBe("match");
    expect(active.summary.frames).toBe(0);
    expect(active).not.toHaveProperty("rawFrameMs");
    campaign.observeFrame(510, { phase: "match", key: "fixture:new/media", quality: "media" });
    expect(campaign.snapshot(true).rawFrameMs).toEqual([10]);
  });

  it("resets even if a caller changes only the preset while retaining the key", () => {
    const campaign = new FrameCampaign();
    campaign.switchContext(context);
    campaign.recordInterval(500);
    const old = campaign.switchContext({ ...context, quality: "baixa" });
    expect(old?.rawFrameMs).toEqual([500]);
    expect(campaign.snapshot().summary.frames).toBe(0);
  });

  it("keeps active stalls but excludes stopped/hidden gaps with no background frames", () => {
    const campaign = new FrameCampaign();
    campaign.observeFrame(0, context);
    campaign.observeFrame(16, context);
    campaign.interrupt();
    campaign.interrupt();
    campaign.observeFrame(60_016, context);
    campaign.observeFrame(60_032, context);
    campaign.observeFrame(60_432, context);
    const report = campaign.snapshot(true);
    expect(report.interruptions).toBe(1);
    expect(report.rawFrameMs).toEqual([16, 16, 400]);
    expect(report.summary).toMatchObject({ frames: 3, framesOver250Ms: 1, maxMs: 400 });
    expect(report.summary.coverage.observedMs).toBe(432);
  });

  it("excludes demand-rendered paused frames and counts separate interruptions", () => {
    const campaign = new FrameCampaign();
    campaign.observeFrame(0, context);
    campaign.observeFrame(10, context);
    campaign.observeFrame(10_000, context, true);
    campaign.observeFrame(20_000, context, true);
    campaign.observeFrame(30_000, context);
    campaign.observeFrame(30_010, context);
    campaign.interrupt();
    campaign.observeFrame(60_000, context);
    campaign.observeFrame(60_010, context);
    expect(campaign.snapshot(true).rawFrameMs).toEqual([10, 10, 10]);
    expect(campaign.snapshot().interruptions).toBe(2);
  });

  it("declares bounded partial coverage instead of certifying a truncated distribution", () => {
    const campaign = new FrameCampaign(3);
    campaign.switchContext(context);
    [10, 20, 300, 400].forEach((ms) => campaign.recordInterval(ms));
    const report = campaign.snapshot(true);
    expect(report.quantilesScope).toBe("newest-retained-intervals-only");
    expect(report.summary.coverage).toMatchObject({
      capacity: 3,
      observedFrames: 4,
      retainedFrames: 3,
      droppedFrames: 1,
      observedMs: 730,
      retainedMs: 720,
      completeDistribution: false,
    });
    expect(report.rawFrameMs).toEqual([20, 300, 400]);
  });
});
