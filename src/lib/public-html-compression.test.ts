import { describe, expect, it } from "vitest";
import { compressPublicHtml } from "./public-html-compression";
const html = "<!doctype html><main>Futebol ⚽</main>".repeat(300);
const request = (headers: HeadersInit = {}, pathname = "/") =>
  new Request(`https://example.test${pathname}`, { headers });
const response = (headers: HeadersInit = {}) =>
  new Response(html, { headers: { "content-type": "text/html; charset=utf-8", ...headers } });
describe("anonymous public HTML transport", () => {
  it("delivers the initial SSR shell while a secondary section is still pending", async () => {
    let source!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        source = controller;
      },
    });
    const result = compressPublicHtml(
      new Response(body, { headers: { "content-type": "text/html" } }),
      request({ "accept-encoding": "gzip" }),
    );
    const reader = result.body!.pipeThrough(new DecompressionStream("gzip")).getReader();
    source.enqueue(new TextEncoder().encode("<main>Hero ready</main>"));
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const first = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(Error("SSR shell was buffered")), 1000);
        }),
      ]);
      expect(new TextDecoder().decode(first.value)).toBe("<main>Hero ready</main>");
    } finally {
      clearTimeout(timer);
      source.close();
      await reader.cancel();
    }
  });
  it("streams a lossless gzip body with representation-aware headers", async () => {
    const result = compressPublicHtml(
      response({
        "content-length": "10000",
        etag: '"old"',
        vary: "Origin",
        "content-security-policy": "script-src 'nonce-fixed'",
      }),
      request({ "accept-encoding": "gzip, br" }),
    );
    expect(result.headers.get("content-encoding")).toBe("gzip");
    expect(result.headers.get("vary")).toBe("Origin, Accept-Encoding");
    expect(result.headers.has("content-length")).toBe(false);
    expect(result.headers.has("etag")).toBe(false);
    expect(result.headers.get("content-security-policy")).toContain("nonce-fixed");
    const compressed = await result.arrayBuffer();
    expect(compressed.byteLength).toBeLessThan(html.length / 4);
    const decoded = await new Response(
      new Response(compressed).body!.pipeThrough(new DecompressionStream("gzip")),
    ).text();
    expect(decoded).toBe(html);
  });
  it("honors gzip refusal before a wildcard and preserves identity bodies", async () => {
    for (const accept of ["gzip;q=0, *;q=1", "br", "gzip;q=0.0", ""]) {
      const result = compressPublicHtml(response(), request({ "accept-encoding": accept }));
      expect(result.headers.has("content-encoding")).toBe(false);
      expect(await result.text()).toBe(html);
      expect(result.headers.get("vary")).toContain("Accept-Encoding");
    }
  });
  it("leaves private, cookie, ranged, API and already encoded responses intact", () => {
    for (const req of [
      request({ cookie: "session=private" }),
      request({ authorization: "Bearer private" }),
      request({ range: "bytes=0-9" }),
      request({}, "/perfil"),
      request({}, "/api/health"),
    ]) {
      const original = response();
      expect(compressPublicHtml(original, req)).toBe(original);
    }
    for (const headers of [
      { "content-encoding": "br" },
      { "set-cookie": "session=private" },
      { "content-type": "text/event-stream" },
    ]) {
      const original = response(headers);
      expect(compressPublicHtml(original, request({ "accept-encoding": "gzip" }))).toBe(original);
    }
  });
});
