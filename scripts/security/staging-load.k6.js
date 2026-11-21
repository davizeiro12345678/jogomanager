import http from "k6/http";
import { check } from "k6";
import { Rate } from "k6/metrics";
import { validateStagingTarget, SAFE_PUBLIC_PATHS, LOAD_PEAK_RPS } from "./staging-load-policy.js";

const ORIGIN = validateStagingTarget({
  target: __ENV.STAGING_URL,
  isolation: __ENV.STAGE_ISOLATION_ATTESTATION,
});

const serverErrors = new Rate("stage_http_5xx");
const blockedOrLimited = new Rate("stage_blocked_or_limited");

export const options = {
  discardResponseBodies: true,
  noConnectionReuse: false,
  scenarios: {
    safe_public_reads_only: {
      executor: "ramping-arrival-rate",
      startRate: 50,
      timeUnit: "1s",
      preAllocatedVUs: 300,
      maxVUs: 1800,
      gracefulStop: "15s",
      stages: [
        { duration: "20s", target: 200 },
        { duration: "25s", target: 500 },
        { duration: "25s", target: 1000 },
        { duration: "25s", target: 2000 },
        { duration: "25s", target: LOAD_PEAK_RPS },
        { duration: "30s", target: LOAD_PEAK_RPS },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "12s" }],
    stage_http_5xx: [{ threshold: "rate<0.005", abortOnFail: true, delayAbortEval: "12s" }],
    stage_blocked_or_limited: [
      { threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "12s" },
    ],
    http_req_duration: [
      { threshold: "p(95)<2000", abortOnFail: true, delayAbortEval: "20s" },
    ],
    dropped_iterations: ["count<1"],
  },
};

export default function () {
  // Every request is a public, unauthenticated GET on the independently
  // isolated staging domain. No save, checkout, sign-in or mutation endpoints.
  const route = SAFE_PUBLIC_PATHS[(__VU + __ITER) % SAFE_PUBLIC_PATHS.length];
  const response = http.get(ORIGIN + route, {
    timeout: "8s",
    redirects: 0,
    tags: { route, scope: "isolated-staging" },
    headers: { "User-Agent": "PFM-Authorized-Staging-Load/1.0" },
  });
  serverErrors.add(response.status >= 500);
  blockedOrLimited.add([403, 429].includes(response.status));
  check(response, { "response 2xx": (r) => r.status >= 200 && r.status < 300 });
}
