/* Service worker do Pro Football Manager 3D.
   Objetivo: abrir e jogar sem internet.
   - Documentos: rede primeiro, com a última versão em cache como reserva.
   - Assets (js/css/imagens/escudos): cache primeiro, atualizando em segundo plano.
   - Chamadas de API e do backend nunca são cacheadas. */
const VERSION = "pfm3d-v7";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const OFFLINE_URL = "/";
const MAX_ASSETS = 180;
const MAX_ASSET_BYTES = 3 * 1024 * 1024;

async function trimCache(name, maxEntries) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

function canCache(requestUrl) {
  const url = new URL(requestUrl, self.location.origin);
  return url.origin === self.location.origin && isAsset(url);
}

async function cacheProgressively(urls) {
  const cache = await caches.open(ASSETS);
  for (const value of urls.slice(0, 24)) {
    if (typeof value !== "string" || !canCache(value)) continue;
    const request = new Request(value, { credentials: "same-origin" });
    try {
      const response = await fetch(request);
      const size = Number(response.headers.get("content-length") || 0);
      if (response.ok && (size === 0 || size <= MAX_ASSET_BYTES)) {
        await cache.put(request, response);
      }
    } catch {
      // O recurso continua disponível pela rede quando a conexão voltar.
    }
  }
  await trimCache(ASSETS, MAX_ASSETS);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) =>
        c.addAll([
          OFFLINE_URL,
          "/manifest.webmanifest",
          "/favicon.png",
          "/icon-192.png",
          "/fonts/BarlowCondensed-Bold.ttf",
        ]),
      )
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_RESOURCES" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(cacheProgressively(event.data.urls));
});

function isAsset(url) {
  return (
    /\.(?:js|mjs|css|woff2?|png|jpe?g|webp|svg|gif|avif|ico|json)$/i.test(url.pathname) ||
    url.pathname.startsWith("/_build/") ||
    url.pathname.startsWith("/assets/")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Nunca interceptar backend, pagamentos, autenticação ou APIs.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/~oauth") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/_serverFn") ||
    url.hostname.endsWith("supabase.co") ||
    url.hostname.includes("stripe")
  ) {
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(OFFLINE_URL, copy).catch(() => undefined));
          return res;
        })
        .catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
    );
    return;
  }

  if (isAsset(url)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const network = fetch(req)
          .then((res) => {
            const size = Number(res.headers.get("content-length") || 0);
            if (
              res &&
              res.status === 200 &&
              (sameOrigin || res.type === "cors") &&
              (size === 0 || size <= MAX_ASSET_BYTES)
            ) {
              const copy = res.clone();
              caches
                .open(ASSETS)
                .then((c) => c.put(req, copy))
                .then(() => trimCache(ASSETS, MAX_ASSETS))
                .catch(() => undefined);
            }
            return res;
          })
          .catch(() => hit);
        return hit ?? network;
      }),
    );
  }
});
