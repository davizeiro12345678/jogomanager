import assert from "node:assert/strict";
import test from "node:test";

import Worker from "./index.js";

const IMPORT_SECRET = "test-import-secret";

function env(overrides = {}) {
  return {
    SPORTS_DB: {
      async batch() {
        return [];
      },
      prepare() {
        return {
          async all() {
            return { results: [] };
          },
        };
      },
    },
    THESPORTSDB_API_KEY: "test-provider-key",
    THESPORTSDB_IMPORT_SECRET: IMPORT_SECRET,
    ...overrides,
  };
}

function request(path, init = {}) {
  return new Request(`https://worker.test${path}`, init);
}

function assertCorsMatches(actual, expected) {
  for (const name of [
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Methods",
    "Access-Control-Allow-Headers",
  ]) {
    assert.equal(actual.headers.get(name), expected.headers.get(name), name);
  }
}

test("does not accept importer secrets in query strings", async () => {
  const response = await Worker.fetch(request("/init?secret=test-import-secret"), env(), {});

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.doesNotMatch(await response.text(), /test-import-secret/);
});

test("accepts Bearer authorization for private importer routes", async () => {
  const response = await Worker.fetch(
    request("/init", {
      headers: { Authorization: `Bearer ${IMPORT_SECRET}` },
    }),
    env(),
    {},
  );

  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("keeps the legacy importer secret header working without a query secret", async () => {
  const response = await Worker.fetch(
    request("/init", {
      headers: { "X-Import-Secret": IMPORT_SECRET },
    }),
    env(),
    {},
  );

  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("requires authorization for operational status", async () => {
  const unauthenticated = await Worker.fetch(request("/api/status"), env(), {});
  const querySecret = await Worker.fetch(
    request("/api/status?secret=test-import-secret"),
    env(),
    {},
  );

  assert.equal(unauthenticated.status, 401);
  assert.equal(querySecret.status, 401);
  assert.equal(unauthenticated.headers.get("Cache-Control"), "no-store");
  assert.equal(querySecret.headers.get("Cache-Control"), "no-store");
});

test("uses the same CORS contract for preflight and public responses", async () => {
  const preflight = await Worker.fetch(
    request("/api/leagues", {
      method: "OPTIONS",
      headers: {
        Origin: "https://client.example",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
      },
    }),
    env(),
    {},
  );
  const publicResponse = await Worker.fetch(request("/api/leagues"), env(), {});

  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Cache-Control"), "no-store");
  assertCorsMatches(preflight, publicResponse);
});

test("marks not-found and worker errors as non-cacheable", async () => {
  const notFound = await Worker.fetch(request("/missing"), env(), {});
  const failingDb = {
    prepare() {
      throw new Error("fixture database failure");
    },
  };
  const error = await Worker.fetch(request("/api/leagues"), env({ SPORTS_DB: failingDb }), {});

  assert.equal(notFound.status, 404);
  assert.equal(notFound.headers.get("Cache-Control"), "no-store");
  assert.equal(error.status, 500);
  assert.equal(error.headers.get("Cache-Control"), "no-store");
});
