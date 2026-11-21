#!/usr/bin/env python3
"""Read-only, loopback-only public club catalog cache. No service_role/JWT forwarding."""
import json
import os
import ssl
import threading
import time
from concurrent.futures import ThreadPoolExecutor
import urllib.error
import urllib.parse
import urllib.request
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SUPABASE_URL = "https://lguqnwvsfeefxamzeyos.supabase.co"
PUBLISHABLE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
BIND_ADDR, BIND_PORT = "127.0.0.1", 3093
MAX_LIMIT, MAX_PAGE = 1000, 127
TTL_SECONDS, MAX_CACHE_BYTES = 900, 32 * 1024 * 1024
MAX_STALE_SECONDS = 3600
CACHE = OrderedDict()
CACHE_LOCK = threading.Lock()
FETCH_SEMAPHORE = threading.BoundedSemaphore(6)
STATS = {"hit": 0, "miss": 0, "error": 0, "origin_requests": 0}
CACHE_SIZE = 0
REFRESHING = set()
REFRESH_POOL = ThreadPoolExecutor(max_workers=6, thread_name_prefix="catalog-refresh")

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

OPENER = urllib.request.build_opener(
    urllib.request.HTTPSHandler(context=ssl.create_default_context()),
    NoRedirect(),
)

def _fetch_page(limit: int, page: int) -> bytes:
    if not PUBLISHABLE_KEY.startswith("sb_publishable_"):
        raise RuntimeError("missing publishable-only key")
    params = urllib.parse.urlencode({
        "select": "id,crest_url",
        "order": "id.asc",
        "limit": str(limit),
        "offset": str(limit * page),
    })
    req = urllib.request.Request(
        SUPABASE_URL + "/rest/v1/clubs?" + params,
        headers={
            "apikey": PUBLISHABLE_KEY,
            "accept": "application/json",
            "accept-encoding": "identity",
            "user-agent": "JogoManagerPublicCatalog/1.0",
        },
        method="GET",
    )
    with FETCH_SEMAPHORE:
        with OPENER.open(req, timeout=5.0) as response:
            if response.status != 200:
                raise RuntimeError("origin status " + str(response.status))
            blob = response.read(512 * 1024 + 1)
    if len(blob) > 512 * 1024:
        raise ValueError("oversized origin response")
    rows = json.loads(blob)
    if not isinstance(rows, list) or len(rows) > limit:
        raise ValueError("invalid origin page")
    result = []
    seen = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("non-object row")
        rid = row.get("id")
        crest = row.get("crest_url")
        if (not isinstance(rid, str) or not 1 <= len(rid) <= 120 or rid in seen
                or (crest is not None and (not isinstance(crest, str) or len(crest) > 2048))):
            raise ValueError("invalid club row")
        seen.add(rid)
        result.append({"id": rid, "crest_url": crest})
    return json.dumps(result, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

def _store_page(key, payload):
    global CACHE_SIZE
    with CACHE_LOCK:
        STATS["origin_requests"] += 1
        old = CACHE.pop(key, None)
        if old:
            CACHE_SIZE -= len(old[1])
        while CACHE and CACHE_SIZE + len(payload) > MAX_CACHE_BYTES:
            _, evicted = CACHE.popitem(last=False)
            CACHE_SIZE -= len(evicted[1])
        if len(payload) <= MAX_CACHE_BYTES:
            CACHE[key] = (time.monotonic() + TTL_SECONDS, payload)
            CACHE_SIZE += len(payload)

def _refresh_background(key):
    try:
        _store_page(key, _fetch_page(*key))
    except Exception:
        with CACHE_LOCK:
            STATS["error"] += 1
    finally:
        with CACHE_LOCK:
            REFRESHING.discard(key)

def cached_page(limit: int, page: int):
    global CACHE_SIZE
    key = (limit, page)
    now = time.monotonic()
    with CACHE_LOCK:
        entry = CACHE.get(key)
        if entry and entry[0] + MAX_STALE_SECONDS > now:
            CACHE.move_to_end(key)
            STATS["hit"] += 1
            if entry[0] <= now and key not in REFRESHING:
                REFRESHING.add(key)
                REFRESH_POOL.submit(_refresh_background, key)
            return entry[1], True
        if entry:
            old = CACHE.pop(key)
            CACHE_SIZE -= len(old[1])
        STATS["miss"] += 1
    try:
        payload = _fetch_page(limit, page)
    except Exception:
        with CACHE_LOCK:
            STATS["error"] += 1
        raise
    _store_page(key, payload)
    return payload, False

def _prime_catalog():
    try:
        for start in range(0, MAX_PAGE + 1, 6):
            tasks = [REFRESH_POOL.submit(cached_page, 1000, page)
                     for page in range(start, min(start + 6, MAX_PAGE + 1))]
            answers = [task.result(timeout=15) for task in tasks]
            if any(len(json.loads(blob)) < 1000 for blob, _ in answers):
                break
    except Exception:
        # Serving begins immediately; a later real request may recover.
        return

class Handler(BaseHTTPRequestHandler):
    server_version = "JogoManagerCatalog/1.0"
    sys_version = ""
    def _reply(self, status, payload, cache="no-store", hit=None):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        if hit is not None:
            self.send_header("X-Catalog-Cache", "HIT" if hit else "MISS")
        self.end_headers()
        self.wfile.write(payload)
    def do_GET(self):
        if len(self.path) > 250:
            return self._reply(414, b'{"error":"invalid_request"}')
        parts = urllib.parse.urlsplit(self.path)
        if parts.path == "/healthz" and not parts.query:
            return self._reply(200, b'{"status":"ok","component":"public-catalog","production_api":false}')
        if parts.path != "/v1/public/clubs":
            return self._reply(404, b'{"error":"not_found"}')
        try:
            args = urllib.parse.parse_qs(parts.query, keep_blank_values=True, strict_parsing=True)
            if set(args) != {"limit", "page"} or any(len(v) != 1 for v in args.values()):
                raise ValueError("invalid query")
            limit, page = int(args["limit"][0]), int(args["page"][0])
            if not 1 <= limit <= MAX_LIMIT or not 0 <= page <= MAX_PAGE:
                raise ValueError("out of bounds")
            data, hit = cached_page(limit, page)
        except ValueError:
            return self._reply(400, b'{"error":"invalid_pagination"}')
        except Exception:
            return self._reply(503, b'{"error":"origin_unavailable"}')
        self._reply(200, data, cache="public, max-age=15, s-maxage=60", hit=hit)
    def do_POST(self):
        self._reply(405, b'{"error":"method_not_allowed"}')
    do_PUT = do_POST
    do_DELETE = do_POST
    do_PATCH = do_POST
    def log_message(self, fmt, *args):
        return

if __name__ == "__main__":
    if not PUBLISHABLE_KEY.startswith("sb_publishable_"):
        raise SystemExit("Refusing startup: require a modern publishable Supabase API key")
    server = ThreadingHTTPServer((BIND_ADDR, BIND_PORT), Handler)
    server.daemon_threads = True
    threading.Thread(target=_prime_catalog, name="catalog-prewarm", daemon=True).start()
    server.serve_forever(poll_interval=0.5)