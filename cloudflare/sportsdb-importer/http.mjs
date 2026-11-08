const PUBLIC_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function responseHeaders(cacheControl, { publicResponse = false } = {}) {
  const headers = new Headers(publicResponse ? PUBLIC_CORS_HEADERS : undefined);
  headers.set("Cache-Control", cacheControl);
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

export function jsonResponse(
  data,
  status = 200,
  { privateResponse = false, publicResponse = false, headers: extraHeaders = {} } = {},
) {
  const cacheControl =
    privateResponse || !publicResponse || status >= 400 ? "no-store" : "public, max-age=60";
  const headers = responseHeaders(cacheControl, {
    publicResponse: publicResponse && !privateResponse,
  });
  headers.set("Content-Type", "application/json");
  for (const [name, value] of Object.entries(extraHeaders)) {
    if (value !== undefined && value !== null) headers.set(name, String(value));
  }
  return new Response(JSON.stringify(data, null, 2), { status, headers });
}

export function optionsResponse({ publicResponse = false } = {}) {
  const headers = responseHeaders("no-store", { publicResponse });
  if (publicResponse) headers.set("Access-Control-Max-Age", "600");
  return new Response(null, { status: 204, headers });
}
