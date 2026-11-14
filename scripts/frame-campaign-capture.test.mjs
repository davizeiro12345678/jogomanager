import assert from "node:assert/strict";
import { test } from "node:test";
import { installFrameCampaignCapture } from "./frame-campaign-capture.mjs";

function capturedWindow() {
  const browser = new EventTarget();
  const previous = globalThis.window;
  globalThis.window = browser;
  try {
    installFrameCampaignCapture();
    installFrameCampaignCapture();
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
  return browser;
}

function send(browser, type, id, frames, phase = "match") {
  browser.dispatchEvent(
    new CustomEvent(type, {
      detail: { id, context: { phase, quality: "alta", key: `scene:${id}` }, rawFrameMs: frames },
    }),
  );
}

test("captures chronological raw intervals per phase/campaign without averaging quantiles", () => {
  const browser = capturedWindow();
  send(browser, "graphics-campaign", 1, [10, 400]);
  send(browser, "cinematic-campaign", 2, [20, 300], "cutscene");
  const evidence = browser.__PFM_FRAME_CAMPAIGN_EVIDENCE__;
  assert.equal(evidence.campaigns.length, 2);
  assert.deepEqual(
    evidence.campaigns.map((entry) => entry.report.rawFrameMs),
    [
      [10, 400],
      [20, 300],
    ],
  );
  assert.deepEqual(
    evidence.campaigns.map((entry) => entry.report.context.phase),
    ["match", "cutscene"],
  );
  assert.equal(evidence.retainedFrames, 4);
  assert.equal(evidence.droppedFrames, 0);
});

test("replaces a requested snapshot with the final report of the same campaign", () => {
  const browser = capturedWindow();
  send(browser, "cinematic-campaign", 1, [10], "cutscene");
  send(browser, "cinematic-campaign", 1, [10, 500], "cutscene");
  const evidence = browser.__PFM_FRAME_CAMPAIGN_EVIDENCE__;
  assert.equal(evidence.campaigns.length, 1);
  assert.equal(evidence.retainedFrames, 2);
  assert.deepEqual(evidence.campaigns[0].report.rawFrameMs, [10, 500]);
});

test("bounds retained campaign count and declares discarded raw frames", () => {
  const browser = capturedWindow();
  for (let id = 0; id < 20; id += 1) send(browser, "graphics-campaign", id, [10, 20]);
  const evidence = browser.__PFM_FRAME_CAMPAIGN_EVIDENCE__;
  assert.equal(evidence.campaigns.length, 16);
  assert.equal(evidence.droppedCampaigns, 4);
  assert.equal(evidence.droppedFrames, 8);
  assert.equal(evidence.retainedFrames, 32);
});

test("bounds total raw retention even for a long individual report", () => {
  const browser = capturedWindow();
  send(
    browser,
    "graphics-campaign",
    1,
    Array.from({ length: 180_005 }, () => 10),
  );
  const evidence = browser.__PFM_FRAME_CAMPAIGN_EVIDENCE__;
  assert.equal(evidence.retainedFrames, 180_000);
  assert.equal(evidence.droppedFrames, 5);
  assert.equal(evidence.campaigns[0].report.captureDroppedFrames, 5);
});
