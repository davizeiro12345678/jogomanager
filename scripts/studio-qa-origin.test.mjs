import assert from "node:assert/strict";
import test from "node:test";
import { studioFixtureUrl } from "./studio-qa-origin.mjs";

test("resolves the isolated player fixture without accepting public URLs", () => {
  assert.equal(
    studioFixtureUrl("http://127.0.0.1:4193").href,
    "http://127.0.0.1:4193/player-studio.html",
  );
  assert.equal(studioFixtureUrl("http://localhost:4193/").pathname, "/player-studio.html");
});

test("rejects remote hosts, HTTPS and URL credentials or query strings", () => {
  for (const origin of [
    "https://jogomanager.com",
    "http://jogomanager.com:4193",
    "https://127.0.0.1:4193",
    "http://user:secret@localhost:4193/",
    "http://127.0.0.1:4193/?token=abc",
    "http://127.0.0.1:4193/#private",
    "http://127.0.0.1:4193/misleading",
  ]) {
    assert.throws(() => studioFixtureUrl(origin), /isolated|loopback/i, origin);
  }
});

test("rejects absent or malformed origins", () => {
  assert.throws(() => studioFixtureUrl(""), /isolated|loopback/i);
  assert.throws(() => studioFixtureUrl("not a url"), /isolated|loopback/i);
});
