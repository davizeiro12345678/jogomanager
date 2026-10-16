/* Service worker do Pro Football Manager 3D.
   Objetivo: abrir e jogar sem internet.
   - Documentos: rede primeiro, com a última versão em cache como reserva.
   - Assets (js/css/imagens/escudos): cache primeiro, atualizando em segundo plano.
   - Chamadas de API e do backend nunca são cacheadas. */
const VERSION = "pfm3d-v10";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const SPORTS_IMAGES = `${VERSION}-sports-images`;
const OFFLINE_URL = "/";
const MAX_ASSETS = 240;
const MAX_ASSET_BYTES = 3 * 1024 * 1024;
const MAX_SPORTS_IMAGES = 400;

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

function isPublicSportsImage(url) {
  return (
    url.protocol === "https:" &&
    (url.hostname === "www.thesportsdb.com" || url.hostname === "thesportsdb.com") &&
    url.pathname.startsWith("/images/") &&
    /\.(?:png|jpe?g|webp|avif)$/i.test(url.pathname)
  );
}

async function cacheProgressively(urls) {
  const cache = await caches.open(ASSETS);
  for (const value of urls.slice(0, 24)) {
    if (typeof value !== "string" || !canCache(value)) continue;
    const request = new Request(value, { credentials: "same-origin" });
    try {
      const response = await fetch(request);
      const size = Number(response.headers.get("content-length") || 0);
      if (safePublicAsset(response, request) && (size === 0 || size <= MAX_ASSET_BYTES)) {
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
          // Do not precache HTML: an Access/login/error response must never become the offline homepage.
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
    /\.(?:js|mjs|css|woff2?|png|jpe?g|webp|svg|gif|avif|ico|json|ktx2)$/i.test(url.pathname) ||
    url.pathname.startsWith("/_build/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/__l5e/assets-v1/")
  );
}

// Cache only verified, same-origin asset bytes. Never cache HTML login pages,
// Cloudflare Access redirects, or private/no-store responses as JavaScript.
function safePublicAsset(response, request) {
  if (!response || response.status !== 200 || response.redirected) return false;
  const requested = new URL(request.url);
  const served = new URL(response.url || request.url);
  if (requested.origin !== self.location.origin || served.origin !== requested.origin || served.pathname !== requested.pathname) return false;
  if (response.headers.has("set-cookie") || /\bno-store\b/i.test(response.headers.get("cache-control") || "")) return false;
  const mime = (response.headers.get("content-type") || "").toLowerCase();
  if (mime.includes("text/html")) return false;
  if (/\.(?:js|mjs)$/i.test(requested.pathname) && !/(?:javascript|ecmascript)/.test(mime)) return false;
  if (/\.css$/i.test(requested.pathname) && !mime.includes("text/css")) return false;
  return true;
}

function safeOfflineHomepage(response, request) {
  if (!response || response.status !== 200 || response.redirected) return false;
  const requested = new URL(request.url);
  const served = new URL(response.url || request.url);
  return requested.origin === self.location.origin && requested.pathname === "/" &&
    served.origin === requested.origin && served.pathname === "/" &&
    (response.headers.get("content-type") || "").toLowerCase().includes("text/html") &&
    !response.headers.has("set-cookie") &&
    !/\b(?:no-store|private)\b/i.test(response.headers.get("cache-control") || "");
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
          if (safeOfflineHomepage(res, req)) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(OFFLINE_URL, copy).catch(() => undefined));
          }
          return res;
        })
        .catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
    );
    return;
  }

  if ((sameOrigin && isAsset(url)) || isPublicSportsImage(url)) {
    const sportsImage = isPublicSportsImage(url);
    event.respondWith(
      caches.open(sportsImage ? SPORTS_IMAGES : ASSETS).then(async (cache) => {
        const hit = await cache.match(req);
        // Fotos oficiais e arquivos versionados não mudam de conteúdo: evita
        // uma requisição por imagem a cada visita. Demais assets revalidam.
        if (
          hit &&
          (sportsImage ||
            url.pathname.startsWith("/__l5e/assets-v1/") ||
            url.pathname.startsWith("/_build/"))
        )
          return hit;
        const network = fetch(req)
          .then((res) => {
            const size = Number(res.headers.get("content-length") || 0);
            if (
              res &&
              res.status === 200 &&
              (sportsImage ? res.type === "cors" && !res.redirected : safePublicAsset(res, req)) &&
              size > 0 &&
              size <= MAX_ASSET_BYTES
            ) {
              const copy = res.clone();
              cache
                .put(req, copy)
                .then(() =>
                  trimCache(
                    sportsImage ? SPORTS_IMAGES : ASSETS,
                    sportsImage ? MAX_SPORTS_IMAGES : MAX_ASSETS,
                  ),
                )
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

/**
 * FCM data messages are displayed using the existing offline worker. Never
 * navigate to a URL outside this origin, even when push data is malformed.
 * The server must authenticate who may send notifications to a device token.
 */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = {};
  }
  const details = payload.notification ?? payload.data ?? {};
  const title = String(details.title ?? "Pro Football Manager 3D").slice(0, 90);
  const body = String(details.body ?? "Você tem uma nova atualização no jogo.").slice(0, 220);
  let target = "/";
  try {
    const candidate = new URL(details.url ?? "/", self.location.origin);
    if (candidate.origin === self.location.origin) target = candidate.pathname;
  } catch {
    // Invalid or external notification links always return to the home page.
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { target },
      tag: String(details.eventId ?? "pfm3d").slice(0, 70),
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = event.notification.data?.target ?? "/";
  event.waitUntil(self.clients.openWindow(destination));
});
