const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Import-Secret",
};

function responseHeaders(cacheControl) {
  const headers = new Headers(CORS_HEADERS);
  headers.set("Cache-Control", cacheControl);
  return headers;
}

export function jsonResponse(data, status = 200, { privateResponse = false } = {}) {
  const cacheControl = privateResponse || status >= 400 ? "no-store" : "public, max-age=60";
  const headers = responseHeaders(cacheControl);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data, null, 2), { status, headers });
}

export function optionsResponse() {
  const headers = responseHeaders("no-store");
  headers.set("Access-Control-Max-Age", "600");
  return new Response(null, { status: 204, headers });
}
