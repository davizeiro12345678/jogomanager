import { pathToFileURL } from "node:url";

const ORIGIN = "https://jogomanager.com";
// The anonymous crawler never follows transactional, callback, API or tool links.
const PRIVATE_PATH =
  /^\/(?:api(?:\/|$)|_serverFn(?:\/|$)|auth(?:\/|$)|cadastro(?:\/|$)|checkout(?:\/|$)|\.lovable(?:\/|\.)|lovable(?:\/|$)|mcp(?:\/|$))/;
const MAX_BODY_BYTES = 2_000_000;

function entities(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#(?:\d+|x[\da-f]+));/gi, (entity) => {
    const named = { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">" };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const hex = entity[2]?.toLowerCase() === "x";
    const code = Number.parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "\ufffd";
  });
}

function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)].map((match) => [
      match[1].toLowerCase(),
      entities(match[2] ?? match[3] ?? match[4]),
    ]),
  );
}

function tags(body, name) {
  const markup = body.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  return [...markup.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map(([tag]) =>
    attributes(tag),
  );
}

function blockedRobots(value = "") {
  return /(?:^|[\s,:])(?:noindex|none)(?:$|[\s,;])/i.test(value);
}

async function boundedBody(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return body + decoder.decode();
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw new Error("Response exceeds the 2 MB crawl body limit");
      body += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }
}

/** Read-only, anonymous release check. A failed audit exposes its sanitized result. */
export async function verifyPublicSeo({
  fetchImpl = fetch,
  report = console.log,
  maxPages = 120,
} = {}) {
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 200)
    throw new Error("The crawl page limit must be an integer from 1 to 200");
  const result = { sitemapPages: 0, linkedPages: 0, skippedLinks: 0, records: [], failures: [] };
  const fail = (url, message) => result.failures.push({ url, message });
  const load = async (url) => {
    const response = await fetchImpl(url, {
      redirect: "manual",
      headers: { "cache-control": "no-cache", "user-agent": "JogoManager-Public-SEO/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    return { response, body: await boundedBody(response) };
  };
  const sitemapUrl = `${ORIGIN}/sitemap.xml`;
  const sitemap = await load(sitemapUrl);
  if (
    sitemap.response.status !== 200 ||
    !/xml/i.test(sitemap.response.headers.get("content-type") ?? "")
  )
    throw new Error(
      `${sitemapUrl}: expected HTTP 200 XML sitemap; got HTTP ${sitemap.response.status}`,
    );
  const sitemapUrls = [...sitemap.body.matchAll(/<loc\b[^>]*>([^<]+)<\/loc\s*>/gi)].map((match) =>
    entities(match[1].trim()),
  );
  if (!sitemapUrls.length) throw new Error(`${sitemapUrl}: no canonical page entries`);
  if (sitemapUrls.length > maxPages) throw new Error("Sitemap exceeds the crawl page limit");
  for (const value of sitemapUrls) {
    const url = new URL(value);
    if (url.origin !== ORIGIN || url.username || url.password || url.hash || url.search)
      throw new Error(`Noncanonical sitemap destination: ${value}`);
    if (PRIVATE_PATH.test(url.pathname))
      throw new Error(`Private or transactional sitemap destination: ${value}`);
  }
  if (new Set(sitemapUrls).size !== sitemapUrls.length)
    throw new Error("Duplicate canonical sitemap entries");
  result.sitemapPages = sitemapUrls.length;
  const seen = new Set(sitemapUrls);
  const linked = new Set();

  const check = async (url, inSitemap) => {
    try {
      let destination = url;
      let loaded;
      for (let redirect = 0; redirect <= 4; redirect++) {
        loaded = await load(destination);
        const status = loaded.response.status;
        if (status < 300 || status >= 400 || inSitemap) break;
        const location = loaded.response.headers.get("location");
        if (!location) break;
        const next = new URL(location, destination);
        if (
          next.origin !== ORIGIN ||
          next.username ||
          next.password ||
          PRIVATE_PATH.test(next.pathname)
        )
          throw new Error(
            "Internal link redirects outside the canonical origin or into a private endpoint",
          );
        if (redirect === 4) throw new Error("Internal link exceeds the four-redirect limit");
        destination = next.href;
      }
      const { response, body } = loaded;
      const contentType = response.headers.get("content-type") ?? "";
      const robots = response.headers.get("x-robots-tag");
      result.records.push({ url, destination, status: response.status, robots });
      if (response.status !== 200) {
        fail(
          url,
          `${inSitemap ? "sitemap page" : "internal link"} returned HTTP ${response.status}`,
        );
        return;
      }
      if (!inSitemap) return;
      if (!contentType.includes("text/html")) {
        fail(url, `sitemap page is not HTML (${contentType || "missing Content-Type"})`);
        return;
      }
      const metas = tags(body, "meta");
      if (
        blockedRobots(robots ?? "") ||
        metas.some(
          (meta) =>
            /^(?:robots|googlebot|bingbot)$/i.test(meta.name ?? "") && blockedRobots(meta.content),
        )
      )
        fail(url, "sitemap page is blocked by noindex");
      const canonicals = tags(body, "link").filter((link) =>
        /(?:^|\s)canonical(?:\s|$)/i.test(link.rel ?? ""),
      );
      if (canonicals.length !== 1 || canonicals[0].href !== url)
        fail(url, "sitemap page has a missing, duplicate or noncanonical canonical URL");
      for (const anchor of tags(body, "a")) {
        if (!anchor.href || anchor.href.startsWith("#")) continue;
        let target;
        try {
          target = new URL(anchor.href, url);
        } catch {
          continue;
        }
        if (target.origin !== ORIGIN || target.username || target.password) continue;
        if (PRIVATE_PATH.test(target.pathname)) {
          result.skippedLinks++;
          continue;
        }
        target.hash = "";
        if (!seen.has(target.href)) {
          seen.add(target.href);
          if (seen.size > maxPages)
            throw new Error("Internal link inventory exceeds the crawl page limit");
          linked.add(target.href);
        }
      }
    } catch (error) {
      fail(url, error instanceof Error ? error.message : "Public page request failed");
    }
  };
  const batch = async (urls, inSitemap) => {
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, urls.length) }, async () => {
        while (next < urls.length) await check(urls[next++], inSitemap);
      }),
    );
  };
  await batch(sitemapUrls, true);
  result.linkedPages = linked.size;
  await batch([...linked], false);
  result.records.sort((a, b) => a.url.localeCompare(b.url));
  result.failures.sort((a, b) => a.url.localeCompare(b.url));
  for (const failure of result.failures)
    report(`FAIL public SEO: ${failure.url}: ${failure.message}`);
  if (result.failures.length) {
    const error = new Error(
      result.failures.map(({ url, message }) => `${url}: ${message}`).join("\n"),
    );
    error.result = result;
    throw error;
  }
  report(
    `PASS public SEO: ${result.sitemapPages} sitemap pages and ${result.linkedPages} linked pages`,
  );
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await verifyPublicSeo();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Public SEO verification failed");
    process.exitCode = 1;
  }
}
