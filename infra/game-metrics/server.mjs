import { createServer } from "node:http";
const upstreams = Object.freeze([
  ["gateway1", "http://pfm-public-cache-gateway:3092/metrics"],
  ["gateway2", "http://pfm-public-cache-gateway-replica-2:3092/metrics"],
  ["gateway3", "http://pfm-public-cache-gateway-replica-3:3092/metrics"],
]);
const counters = Object.freeze([
  "requests",
  "cacheHits",
  "staleHits",
  "refreshes",
  "refreshErrors",
  "prewarmSuccess",
  "prewarmErrors",
  "cacheMisses",
  "collapsed",
  "upstreamRequests",
  "upstreamErrors",
  "evictions",
  "bytesServed",
  "eventsAccepted",
  "eventsRejected",
]);
const eventLabels = Object.freeze([
  "open_club",
  "open_market",
  "open_career",
  "start_match",
  "open_dashboard",
]);
const gauges = Object.freeze([
  "cacheEntries",
  "cacheBytes",
  "cacheLimitBytes",
  "cacheTtlSeconds",
  "cacheHitRatio",
  "uptimeSeconds",
]);
const processGauges = Object.freeze(["rss", "heapUsed", "external", "arrayBuffers"]);
const number = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
const metricName = (name) => name.replace(/[A-Z]/g, (x) => "_" + x.toLowerCase());
const label = (name) => '{gateway="' + name + '"}';
let cachedText = "",
  cacheUntil = 0,
  inFlight = null;
async function collect() {
  const records = await Promise.all(
    upstreams.map(async ([name, url]) => {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(2200), cache: "no-store" });
        if (!response.ok) throw new Error("http_" + response.status);
        const result = await response.json();
        if (result === null || typeof result !== "object" || Array.isArray(result))
          throw Error("invalid_metrics");
        return { name, up: 1, data: result };
      } catch {
        return { name, up: 0, data: {} };
      }
    }),
  );
  const rows = [
    "# HELP pfm_gateway_up Whether this local gateway endpoint is reachable.",
    "# TYPE pfm_gateway_up gauge",
  ];
  for (const r of records) rows.push("pfm_gateway_up" + label(r.name) + " " + r.up);
  for (const key of counters) {
    const n = "pfm_gateway_" + metricName(key) + "_total";
    rows.push("# TYPE " + n + " counter");
    for (const r of records) if (r.up) rows.push(n + label(r.name) + " " + number(r.data[key]));
  }
  for (const key of gauges) {
    const n = "pfm_gateway_" + metricName(key);
    rows.push("# TYPE " + n + " gauge");
    for (const r of records) if (r.up) rows.push(n + label(r.name) + " " + number(r.data[key]));
  }
  for (const key of processGauges) {
    const n = "pfm_gateway_process_" + metricName(key) + "_bytes";
    rows.push("# TYPE " + n + " gauge");
    for (const r of records)
      if (r.up) rows.push(n + label(r.name) + " " + number(r.data.process?.[key]));
  }
  rows.push("# TYPE pfm_gateway_click_events_total counter");
  for (const r of records)
    if (r.up)
      for (const event of eventLabels)
        rows.push(
          'pfm_gateway_click_events_total{gateway="' +
            r.name +
            '",event="' +
            event +
            '"} ' +
            number(r.data.events?.[event]),
        );
  return rows.join("\n") + "\n";
}
const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok\n");
    return;
  }
  if (req.method !== "GET" || req.url !== "/metrics") {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    if (!cachedText || Date.now() > cacheUntil) {
      inFlight ||= collect().finally(() => {
        inFlight = null;
      });
      cachedText = await inFlight;
      cacheUntil = Date.now() + 3500;
    }
    res.writeHead(200, {
      "content-type": "text/plain; version=0.0.4; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(cachedText);
  } catch {
    res.writeHead(503);
    res.end("metrics_unavailable\n");
  }
});
server.requestTimeout = 5000;
server.listen(9199, "0.0.0.0", () => console.log("pfm metrics exporter ready"));
