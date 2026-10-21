/* Service worker do Pro Football Manager 3D.
   Objetivo: abrir e jogar sem internet.
   - Documentos: rede primeiro, com a última versão em cache como reserva.
   - Assets (js/css/imagens/escudos): cache primeiro, atualizando em segundo plano.
   - Chamadas de API e do backend nunca são cacheadas. */
const VERSION = "pfm3d-v11";
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
  return url.origin === self.location.origin && !isPrivateRequest(url) && isAsset(url);
}

function isPrivateRequest(url) {
  return (
    /^\/(?:api(?:\/|$)|~oauth|auth(?:\/|$)|cadastro(?:\/|$)|checkout(?:\/|$)|mcp(?:\/|$)|_serverFn(?:\/|$)|lovable(?:\/|$))/.test(
      url.pathname,
    ) ||
    url.hostname.endsWith("supabase.co") ||
    url.hostname.includes("stripe")
  );
}

function isPublicResponse(response, request) {
  if (!response || response.status !== 200 || response.redirected) return false;
  if (request.headers.has("authorization") || response.headers.has("set-cookie")) return false;
  if (/\b(?:no-store|private)\b/i.test(response.headers.get("cache-control") || "")) return false;
  const requested = new URL(request.url);
  const served = new URL(response.url || request.url);
  return (
    served.origin === requested.origin &&
    served.pathname === requested.pathname &&
    served.search === requested.search
  );
}

function safePublicAsset(response, request) {
  if (!isPublicResponse(response, request)) return false;
  const url = new URL(request.url);
  if (
    url.origin !== self.location.origin &&
    (!isPublicSportsImage(url) || response.type !== "cors")
  )
    return false;
  const mime = (response.headers.get("content-type") || "").toLowerCase().split(";")[0].trim();
  if (!mime || mime === "text/html" || mime === "application/xhtml+xml") return false;
  if (/\.(?:js|mjs)$/i.test(url.pathname))
    return /^(?:text|application)\/(?:javascript|ecmascript)$/.test(mime);
  if (/\.css$/i.test(url.pathname)) return mime === "text/css";
  if (/\.(?:png|jpe?g|webp|svg|gif|avif|ico)$/i.test(url.pathname))
    return mime.startsWith("image/");
  if (/\.(?:json|webmanifest)$/i.test(url.pathname))
    return mime === "application/json" || mime === "application/manifest+json";
  if (/\.(?:ttf|woff2?)$/i.test(url.pathname))
    return (
      mime.startsWith("font/") ||
      /^(?:application\/font-woff|application\/x-font-ttf|application\/octet-stream)$/.test(mime)
    );
  if (/\.ktx2$/i.test(url.pathname))
    return mime === "image/ktx2" || mime === "application/octet-stream";
  if (/\.wasm$/i.test(url.pathname))
    return mime === "application/wasm" || mime === "application/octet-stream";
  return true;
}

function safeOfflineHomepage(response, request) {
  const url = new URL(request.url);
  return (
    isPublicResponse(response, request) &&
    url.origin === self.location.origin &&
    url.pathname === OFFLINE_URL &&
    !url.search &&
    (response.headers.get("content-type") || "").toLowerCase().split(";")[0].trim() === "text/html"
  );
}

async function putBoundedAsset(cache, request, response) {
  if (!safePublicAsset(response, request)) return;
  const size = Number(response.headers.get("content-length") || 0);
  if (size > MAX_ASSET_BYTES || size < 0 || !Number.isFinite(size)) return;
  const copy = response.clone();
  // Content-Length may describe compressed bytes. Always bound the decoded
  // stream so a small transfer cannot retain a much larger resource in cache.
  const reader = copy.body?.getReader();
  if (!reader) return;
  let total = 0;
  const chunks = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_ASSET_BYTES) {
      void reader.cancel().catch(() => undefined);
      return;
    }
    chunks.push(value);
  }
  const headers = new Headers(copy.headers);
  headers.delete("content-encoding");
  headers.set("content-length", String(total));
  await cache.put(request, new Response(new Blob(chunks), { headers }));
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
    const request = new Request(new URL(value, self.location.origin), {
      credentials: "same-origin",
    });
    try {
      const response = await fetch(request);
      await putBoundedAsset(cache, request, response);
    } catch {
      // O recurso continua disponível pela rede quando a conexão voltar.
    }
  }
  await trimCache(ASSETS, MAX_ASSETS);
}

async function cachePublicHomepage() {
  // The page installing a new worker is not controlled by it yet. Seed the
  // offline shell now, without an account cookie, so first-session offline use
  // still works after obsolete worker caches are removed during activation.
  const request = new Request(new URL(OFFLINE_URL, self.location.origin), { credentials: "omit" });
  const response = await fetch(request);
  if (!safeOfflineHomepage(response, request)) return;
  const cache = await caches.open(SHELL);
  await cache.put(OFFLINE_URL, response);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      cacheProgressively([
        `${self.location.origin}/manifest.webmanifest`,
        `${self.location.origin}/favicon.png`,
        `${self.location.origin}/icon-192.png`,
        `${self.location.origin}/fonts/BarlowCondensed-Bold.ttf`,
      ]),
      cachePublicHomepage().catch(() => undefined),
    ])
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("pfm3d-") && !k.startsWith(`${VERSION}-`))
            .map((k) => caches.delete(k)),
        ),
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
    /\.(?:js|mjs|css|ttf|woff2?|png|jpe?g|webp|svg|gif|avif|ico|json|webmanifest|ktx2|wasm)$/i.test(
      url.pathname,
    ) ||
    url.pathname.startsWith("/_build/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/__l5e/assets-v1/")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Nunca interceptar backend, pagamentos, autenticação ou APIs.
  if (isPrivateRequest(url) || req.headers.has("authorization")) {
    return;
  }

  if (req.mode === "navigate") {
    const network = fetch(req);
    event.waitUntil(
      network
        .then(async (res) => {
          if (!safeOfflineHomepage(res, req)) return;
          const copy = res.clone();
          const cache = await caches.open(SHELL);
          await cache.put(OFFLINE_URL, copy);
        })
        .catch(() => undefined),
    );
    event.respondWith(
      network.catch(
        async () => (await (await caches.open(SHELL)).match(OFFLINE_URL)) ?? Response.error(),
      ),
    );
    return;
  }

  if ((sameOrigin && isAsset(url)) || isPublicSportsImage(url)) {
    const sportsImage = isPublicSportsImage(url);
    const cached = caches.open(sportsImage ? SPORTS_IMAGES : ASSETS).then(async (cache) => {
      const hit = await cache.match(req);
      // Fotos oficiais e arquivos versionados não mudam de conteúdo: evita
      // uma requisição por imagem a cada visita. Demais assets revalidam.
      if (
        hit &&
        (sportsImage ||
          /\bimmutable\b/i.test(hit.headers.get("cache-control") || "") ||
          url.pathname.startsWith("/__l5e/assets-v1/") ||
          url.pathname.startsWith("/_build/"))
      )
        return { response: Promise.resolve(hit), maintenance: Promise.resolve() };
      const network = fetch(req);
      const maintenance = network
        .then(async (res) => {
          await putBoundedAsset(cache, req, res);
          await trimCache(
            sportsImage ? SPORTS_IMAGES : ASSETS,
            sportsImage ? MAX_SPORTS_IMAGES : MAX_ASSETS,
          );
        })
        .catch(() => undefined);
      return {
        response: hit ? Promise.resolve(hit) : network.catch(() => Response.error()),
        maintenance,
      };
    });
    event.waitUntil(cached.then((work) => work.maintenance).catch(() => undefined));
    event.respondWith(
      cached.then((work) => work.response).catch(() => fetch(req).catch(() => Response.error())),
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
