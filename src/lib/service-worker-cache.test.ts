import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const ORIGIN = "https://jogomanager.com";
const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
type CacheKey = string | Request;
type TestEvent = {
  request: Request;
  data?: { type: string; urls: string[] };
  respondWith: (result: Promise<Response>) => void;
  waitUntil: (work: Promise<unknown>) => void;
};

function worker(fetcher: (request: Request) => Promise<Response>) {
  const stores = new Map<string, Map<string, Response>>();
  const listeners = new Map<string, (event: TestEvent) => void>();
  const key = (value: CacheKey) =>
    new URL(typeof value === "string" ? value : value.url, ORIGIN).href;
  const cacheFor = (name: string) => {
    const rows = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, rows);
    return {
      match: async (request: CacheKey) => rows.get(key(request))?.clone(),
      put: async (request: CacheKey, response: Response) => {
        rows.set(key(request), response.clone());
      },
      keys: async () => [...rows.keys()],
      delete: async (request: CacheKey) => rows.delete(key(request)),
      addAll: async (requests: string[]) => {
        for (const path of requests) {
          const request = new Request(new URL(path, ORIGIN));
          rows.set(request.url, await fetcher(request));
        }
      },
    };
  };
  const storage = {
    open: async (name: string) => cacheFor(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (request: CacheKey) => {
      for (const rows of stores.values()) {
        const response = rows.get(key(request));
        if (response) return response.clone();
      }
      return undefined;
    },
  };
  runInNewContext(source, {
    URL,
    Request,
    Response,
    Blob,
    Headers,
    caches: storage,
    fetch: fetcher,
    self: {
      location: { origin: ORIGIN },
      addEventListener: (name: string, listener: (event: TestEvent) => void) =>
        listeners.set(name, listener),
      skipWaiting: async () => undefined,
      clients: { claim: async () => undefined },
    },
  });
  return {
    stores,
    storage,
    async dispatch(
      path: string,
      options: {
        navigate?: boolean;
        message?: string[];
        event?: string;
        headers?: Record<string, string>;
      } = {},
    ) {
      const request = new Request(
        new URL(path, ORIGIN),
        options.headers ? { headers: options.headers } : undefined,
      );
      if (options.navigate) Object.defineProperty(request, "mode", { value: "navigate" });
      let result: Promise<Response> | undefined;
      const pending: Promise<unknown>[] = [];
      listeners.get(options.event ?? (options.message ? "message" : "fetch"))?.({
        request,
        ...(options.message ? { data: { type: "CACHE_RESOURCES", urls: options.message } } : {}),
        respondWith: (value) => {
          result = value;
        },
        waitUntil: (value) => {
          pending.push(value);
        },
      });
      const response = result ? await result : undefined;
      await Promise.all(pending);
      // Let detached legacy cache work settle too, so a failing baseline cannot
      // pass simply because it forgot to extend the service worker's lifetime.
      await new Promise<void>((resolve) => setImmediate(resolve));
      return { response, retainedWork: pending.length };
    },
    async cached(path: string) {
      const response = await storage.match(path);
      return response ? response.text() : null;
    },
  };
}

function response(body: string, mime: string, headers: Record<string, string> = {}) {
  return new Response(body, {
    headers: { "content-type": mime, "content-length": String(body.length), ...headers },
  });
}

describe("offline service worker cache boundaries", () => {
  it.each(["/dashboard", "/compras", "/carreira"])(
    "never stores private navigation %s as the offline home",
    async (path) => {
      const sw = worker(async () =>
        response("private account", "text/html", { "cache-control": "no-store" }),
      );
      await sw.dispatch(path, { navigate: true });
      expect(await sw.cached("/")).toBeNull();
    },
  );

  it("only stores the actual public homepage and preserves it across other navigations", async () => {
    const sw = worker(async (request) =>
      response(new URL(request.url).pathname, "text/html", {
        "cache-control": "public, max-age=0",
      }),
    );
    const home = await sw.dispatch("/", { navigate: true });
    expect(home.retainedWork).toBeGreaterThan(0);
    await sw.dispatch("/sobre", { navigate: true });
    expect(await sw.cached("/")).toBe("/");
  });

  it.each(["no-store", "private, max-age=60"])(
    "rejects assets with %s even through progressive preload",
    async (directive) => {
      const sw = worker(async () =>
        response("secret", "application/javascript", { "cache-control": directive }),
      );
      await sw.dispatch("/assets/private.js");
      await sw.dispatch("/", { message: [`${ORIGIN}/assets/preloaded.js`] });
      expect(await sw.cached("/assets/private.js")).toBeNull();
      expect(await sw.cached("/assets/preloaded.js")).toBeNull();
    },
  );

  it.each(["/assets/app.js", "/assets/app.css", "/assets/crest.png"])(
    "does not cache an access page as %s",
    async (path) => {
      const sw = worker(async () => response("<html>Sign in</html>", "text/html"));
      await sw.dispatch(path);
      expect(await sw.cached(path)).toBeNull();
    },
  );

  it("rejects redirected assets even when their final response is 200", async () => {
    const sw = worker(async () => {
      const res = response("bad", "application/javascript");
      Object.defineProperties(res, {
        redirected: { value: true },
        url: { value: "https://access.example/login" },
      });
      return res;
    });
    await sw.dispatch("/assets/app.js");
    expect(await sw.cached("/assets/app.js")).toBeNull();
  });

  it("preloads only validated public assets on installation", async () => {
    const sw = worker(async () =>
      response("<html>Access page</html>", "text/html", { "cache-control": "private, no-store" }),
    );
    await sw.dispatch("/", { event: "install" });
    expect(await sw.cached("/")).toBeNull();
    expect(await sw.cached("/favicon.png")).toBeNull();
  });

  it("prepares the public offline home during installation without sending credentials", async () => {
    let online = true;
    const sw = worker(async (request) => {
      if (!online) throw new Error("offline");
      if (new URL(request.url).pathname === "/") {
        expect(request.credentials).toBe("omit");
        return response("first-visit public shell", "text/html", {
          "cache-control": "public, max-age=0",
        });
      }
      return response("asset", "application/javascript");
    });
    await sw.dispatch("/", { event: "install" });
    await sw.dispatch("/", { event: "activate" });
    online = false;
    const result = await sw.dispatch("/partida-rapida", { navigate: true });
    expect(await result.response?.text()).toBe("first-visit public shell");
  });

  it("stores valid public JS and retains cache work until completion", async () => {
    const sw = worker(async () =>
      response("export const ready=true", "application/javascript", {
        "cache-control": "public, max-age=31536000, immutable",
      }),
    );
    const result = await sw.dispatch("/assets/app-abcdefgh.js");
    expect(await sw.cached("/assets/app-abcdefgh.js")).toBe("export const ready=true");
    expect(result.retainedWork).toBeGreaterThan(0);
  });

  it.each(["text/plain", "image/png"])(
    "rejects a %s response at a WebAssembly asset URL",
    async (mime) => {
      const sw = worker(async () => response("wrong physics payload", mime));
      await sw.dispatch("/assets/rapier-abcdefgh.wasm");
      expect(await sw.cached("/assets/rapier-abcdefgh.wasm")).toBeNull();
    },
  );

  it.each(["application/wasm", "application/octet-stream"])(
    "keeps a public %s WebAssembly resource available without another network call",
    async (mime) => {
      let requests = 0;
      const sw = worker(async () => {
        requests++;
        return response("wasm fixture", mime, { "cache-control": "public, immutable" });
      });
      await sw.dispatch("/physics/rapier-abcdefgh.wasm");
      const next = await sw.dispatch("/physics/rapier-abcdefgh.wasm");
      expect(await next.response?.text()).toBe("wasm fixture");
      expect(requests).toBe(1);
    },
  );

  it("serves a previously validated homepage when the network fails", async () => {
    let online = true;
    const sw = worker(async () => {
      if (!online) throw new Error("offline");
      return response("public shell", "text/html", { "cache-control": "public, max-age=0" });
    });
    await sw.dispatch("/", { navigate: true });
    online = false;
    const result = await sw.dispatch("/partida-rapida", { navigate: true });
    expect(await result.response?.text()).toBe("public shell");
  });

  it("does not intercept authentication, payments or server functions", async () => {
    const sw = worker(async () => {
      throw new Error("must not be fetched by the worker");
    });
    for (const path of [
      "/auth",
      "/api/payment",
      "/_serverFn/action",
      "/checkout/return",
      "/mcp",
      "/cadastro",
    ]) {
      const result = await sw.dispatch(path, { navigate: true });
      expect(result.response).toBeUndefined();
    }
  });

  it("does not intercept an authorized asset request", async () => {
    const sw = worker(async () => {
      throw new Error("must not fetch credentials");
    });
    const result = await sw.dispatch("/assets/account.json", {
      headers: { authorization: "Bearer test-only" },
    });
    expect(result.response).toBeUndefined();
    expect(await sw.cached("/assets/account.json")).toBeNull();
  });

  it("does not refetch immutable assets on a second visit", async () => {
    let requests = 0;
    const sw = worker(async () => {
      requests++;
      return response("version 1", "application/javascript", {
        "cache-control": "public, immutable",
      });
    });
    await sw.dispatch("/assets/version-1.js");
    const next = await sw.dispatch("/assets/version-1.js");
    expect(await next.response?.text()).toBe("version 1");
    expect(requests).toBe(1);
  });

  it("bounds assets without a content-length header by their actual streamed bytes", async () => {
    const sw = worker(
      async (request) =>
        new Response(
          new URL(request.url).pathname.includes("large")
            ? "x".repeat(3 * 1024 * 1024 + 1)
            : "small image",
          { headers: { "content-type": "image/png" } },
        ),
    );
    await sw.dispatch("/assets/small.png");
    await sw.dispatch("/assets/large.png");
    expect(await sw.cached("/assets/small.png")).toBe("small image");
    expect(await sw.cached("/assets/large.png")).toBeNull();
  });

  it("bounds decoded bytes even when a compressed response advertises a smaller length", async () => {
    const sw = worker(
      async () =>
        new Response("x".repeat(3 * 1024 * 1024 + 1), {
          headers: {
            "content-type": "application/javascript",
            "content-length": "4096",
            "content-encoding": "gzip",
          },
        }),
    );
    await sw.dispatch("/assets/compressed.js");
    expect(Boolean(await sw.storage.match("/assets/compressed.js"))).toBe(false);
  });

  it("keeps coherent headers when storing an already decoded body", async () => {
    const sw = worker(
      async () =>
        new Response("export{}", {
          headers: {
            "content-type": "application/javascript",
            "content-length": "4",
            "content-encoding": "gzip",
          },
        }),
    );
    await sw.dispatch("/assets/compressed.js");
    const cached = await sw.storage.match("/assets/compressed.js");
    expect(await cached?.text()).toBe("export{}");
    expect(cached?.headers.has("content-encoding")).toBe(false);
    expect(cached?.headers.get("content-length")).toBe("8");
  });

  it("caches CORS sports images and refuses an HTML response from the same public host", async () => {
    const sw = worker(async (request) => {
      const invalid = new URL(request.url).pathname.includes("invalid");
      const res = response(
        invalid ? "access page" : "public crest",
        invalid ? "text/html" : "image/png",
      );
      Object.defineProperty(res, "type", { value: "cors" });
      return res;
    });
    const valid = "https://www.thesportsdb.com/images/crest.png";
    const invalid = "https://www.thesportsdb.com/images/invalid.png";
    await sw.dispatch(valid);
    await sw.dispatch(invalid);
    expect(await sw.cached(valid)).toBe("public crest");
    expect(await sw.cached(invalid)).toBeNull();
  });

  it("keeps network assets available when Cache Storage is unavailable", async () => {
    const sw = worker(async () => response("network asset", "application/javascript"));
    sw.storage.open = async () => {
      throw new Error("cache unavailable");
    };
    const result = await sw.dispatch("/assets/app.js");
    expect(await result.response?.text()).toBe("network asset");
  });

  it("removes obsolete game caches while preserving unrelated Cache Storage", async () => {
    const sw = worker(async () => response("asset", "application/javascript"));
    await sw.storage.open("pfm3d-v9-assets");
    await sw.storage.open("another-app-assets");
    await sw.dispatch("/assets/app.js");
    await sw.dispatch("/", { event: "activate" });
    expect(await sw.storage.keys()).toEqual(
      expect.arrayContaining(["another-app-assets", "pfm3d-v11-assets"]),
    );
    expect(await sw.storage.keys()).not.toContain("pfm3d-v9-assets");
  });
});
