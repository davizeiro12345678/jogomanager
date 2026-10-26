// LHCI runs this after the real Nitro/Cloudflare preview is ready. A fast
// compressed error/garbage page must never be accepted as a performance result.
const { verifyPreviewStylesheets } = require("./preview-stylesheets.cjs");
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
      if (encoding === "identity")
        await verifyPreviewStylesheets(html, `http://127.0.0.1:4173${route}`);
      console.log(`Verified decoded HTML: ${route} (${encoding})`);
    }
  }
  // Private screens use the shared app sheet while public CSS is inlined.
  const career = await fetch("http://127.0.0.1:4173/new");
  if (career.status !== 200) throw new Error("Career preview did not render");
  await verifyPreviewStylesheets(await career.text(), career.url);
  console.log("Verified private app stylesheet: /new");
};
