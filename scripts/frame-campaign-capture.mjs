/** Pass directly to Playwright addInitScript. Browser-only evidence retention
 * is bounded independently of the probe; quantiles are never averaged here. */
export function installFrameCampaignCapture() {
  if (window.__PFM_FRAME_CAMPAIGN_EVIDENCE__) return;
  const evidence = {
    schemaVersion: 1,
    maxCampaigns: 16,
    maxRetainedFrames: 180_000,
    retainedFrames: 0,
    droppedCampaigns: 0,
    droppedFrames: 0,
    campaigns: [],
  };
  window.__PFM_FRAME_CAMPAIGN_EVIDENCE__ = evidence;
  const capture = (event) => {
    const report = event.detail;
    if (!report?.context || !Array.isArray(report.rawFrameMs)) return;
    const priorIndex = evidence.campaigns.findIndex(
      (entry) => entry.event === event.type && entry.report.id === report.id,
    );
    if (priorIndex >= 0) {
      const [prior] = evidence.campaigns.splice(priorIndex, 1);
      evidence.retainedFrames -= prior.report.rawFrameMs.length;
      evidence.droppedFrames -= prior.report.captureDroppedFrames;
    }
    const captureDroppedFrames = Math.max(0, report.rawFrameMs.length - evidence.maxRetainedFrames);
    const retained = {
      ...report,
      rawFrameMs: report.rawFrameMs.slice(-evidence.maxRetainedFrames),
      captureDroppedFrames,
    };
    evidence.droppedFrames += captureDroppedFrames;
    evidence.retainedFrames += retained.rawFrameMs.length;
    evidence.campaigns.push({ event: event.type, report: retained });
    while (
      evidence.campaigns.length > evidence.maxCampaigns ||
      evidence.retainedFrames > evidence.maxRetainedFrames
    ) {
      const discarded = evidence.campaigns.shift();
      evidence.retainedFrames -= discarded.report.rawFrameMs.length;
      evidence.droppedFrames += discarded.report.rawFrameMs.length;
      evidence.droppedCampaigns += 1;
    }
  };
  window.addEventListener("graphics-campaign", capture);
  window.addEventListener("cinematic-campaign", capture);
}
