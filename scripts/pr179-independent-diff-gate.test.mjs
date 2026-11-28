import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
const workflow = readFileSync(
  new URL("../.github/workflows/pr132-independent-diff-review.yml", import.meta.url),
  "utf8",
);
test("independent inventory covers PR 179 and checks exact event count, preserving PR 132 gate", () => {
  assert.match(workflow, /github\.event\.pull_request\.number == 179/);
  assert.match(workflow, /EXPECTED_CHANGED_FILES:.*github\.event\.pull_request\.changed_files/);
  assert.match(workflow, /EXPECTED_BASE:.*github\.event\.pull_request\.base\.sha/);
  assert.match(workflow, /rows\.length !== expectedChangedFiles/);
  assert.match(workflow, /rows\.length < 850/);
});
