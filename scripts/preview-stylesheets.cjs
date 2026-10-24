const attribute = (tag, name) =>
  tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2];

/** Check emitted CSS URLs, including sheets that the current route has not
 * applied yet. An HTML fallback must never stand in for a missing asset.
 */
async function verifyPreviewStylesheets(html, documentUrl, fetchAsset = fetch) {
  const document = new URL(documentUrl);
  const seen = new Set();
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!attribute(tag, "rel")?.split(/\s+/).includes("stylesheet")) continue;
    const href = attribute(tag, "href");
    if (!href) throw new Error(`Missing stylesheet href on ${document.pathname}`);
    const url = new URL(href.replaceAll("&amp;", "&"), document);
    if (url.origin !== document.origin || seen.has(url.href)) continue;
    seen.add(url.href);
    const response = await fetchAsset(url.href);
    if (
      response.status !== 200 ||
      !/^text\/css\b/i.test(response.headers.get("content-type") ?? "") ||
      !(await response.text()).trim()
    ) {
      throw new Error(`Invalid emitted stylesheet ${url.pathname} on ${document.pathname}`);
    }
  }
}

module.exports = { verifyPreviewStylesheets };
