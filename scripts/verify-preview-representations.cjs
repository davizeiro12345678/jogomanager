// LHCI runs this after the real Nitro/Cloudflare preview is ready. A fast
// compressed error/garbage page must never be accepted as a performance result.
module.exports = async () => {
  const routes = ["/", "/guias", "/guia-de-scouting", "/melhores-formacoes", "/partida-rapida"];
  for (const route of routes) {
    for (const encoding of ["identity", "gzip"]) {
      const response = await fetch(`http://127.0.0.1:4173${route}`, {
        headers: { "accept-encoding": encoding },
      });
      const html = await response.text();
      if (
        response.status !== 200 ||
        !/^text\/html\b/i.test(response.headers.get("content-type") ?? "") ||
        !/<html\b[^>]*\blang=["']pt-BR["']/i.test(html) ||
        !/<title>[^<]+<\/title>/i.test(html) ||
        !/<h1\b/i.test(html) ||
        !html.includes("Pro Football Manager")
      ) {
        throw new Error(`Invalid rendered HTML for ${route} with Accept-Encoding ${encoding}`);
      }
      if (route === "/") {
        const style = html.match(/<style\b[^>]*data-tsr-inline-css[^>]*>/i)?.[0];
        const nonce = style?.match(/nonce=["']([^"']+)["']/i)?.[1];
        const csp = [
          response.headers.get("content-security-policy"),
          response.headers.get("content-security-policy-report-only"),
        ].join("; ");
        if (!nonce || !csp.includes(`'nonce-${nonce}'`)) {
          throw new Error("Home inline stylesheet is missing the response's CSP nonce");
        }
      }
      console.log(`Verified decoded HTML: ${route} (${encoding})`);
    }
  }
};
