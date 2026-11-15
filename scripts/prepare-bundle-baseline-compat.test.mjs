import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  assertArchiveIntegrity,
  baselineCompatibility,
} from "./prepare-bundle-baseline-compat.mjs";

const packagePath = "node_modules/@lovable.dev/cloud-auth-js";
const integrity =
  "sha512-BetMp9TvV/QgZ54KBr0yhPNqcB2Z6VqrF3H54sNgsKpKeSQO0CFDtPNtSmtKW9cCsHAp7yXCl04X82Zfdjo0CA==";
const lock = (entry) => ({ packages: { [packagePath]: entry } });

test("requires no compatibility package when the baseline does not have it", () => {
  assert.equal(baselineCompatibility({ packages: {} }), null);
});

test("accepts only the pinned historical package without transitive dependencies", () => {
  assert.equal(baselineCompatibility(lock({ version: "1.2.1", integrity })).version, "1.2.1");
  assert.throws(() => baselineCompatibility(lock({ version: "1.2.2", integrity })));
  assert.throws(() => baselineCompatibility(lock({ version: "1.2.1", integrity: "sha512-wrong" })));
  assert.throws(() =>
    baselineCompatibility(lock({ version: "1.2.1", integrity, dependencies: { unexpected: "1" } })),
  );
});

test("rejects an archive whose bytes differ from the recorded integrity", () => {
  const bytes = Buffer.from("fixture");
  const expected = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  assert.doesNotThrow(() => assertArchiveIntegrity(bytes, expected));
  assert.throws(() => assertArchiveIntegrity(Buffer.from("changed"), expected));
});
