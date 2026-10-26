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
      const head = html.split(/<\/head>/i)[0];
      if (
        !/<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["'][^"']*public-styles[^"']*\.css)[^>]*>/i.test(
          head,
        )
      )
        throw new Error(`Missing critical SSR stylesheet for ${route}`);
      console.log(`Verified decoded HTML: ${route} (${encoding})`);
    }
  }
};
