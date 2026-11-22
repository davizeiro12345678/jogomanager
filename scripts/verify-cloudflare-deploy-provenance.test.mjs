import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(
  new URL('../.github/workflows/cloudflare-production.yml', import.meta.url),
  'utf8',
);

test('privileged workflow_run publication only accepts a successful push on this repository main', () => {
  assert.match(workflow, /github\.event\.workflow_run\.event == 'push'/);
  assert.match(workflow, /github\.event\.workflow_run\.head_branch == 'main'/);
  assert.match(workflow, /github\.event\.workflow_run\.head_repository\.full_name == github\.repository/);
  assert.match(workflow, /github\.event\.workflow_run\.repository\.full_name == github\.repository/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
});

test('the privileged workflow never checks out an arbitrary event ref', () => {
  assert.match(workflow, /\n          ref: main\n/);
  assert.doesNotMatch(workflow, /ref: \$\{\{\s*github\.event\.workflow_run\.head_sha\s*\}\}/);
  assert.match(workflow, /persist-credentials: false/);
});

test('checkout SHA is verified before credentials and dependency scripts', () => {
  const verified = workflow.indexOf('- name: Verify checked-out main SHA');
  const credentials = workflow.indexOf('- name: Verify production credentials are connected');
  const install = workflow.indexOf('- run: npm ci');
  const publish = workflow.indexOf('- name: Build and publish Worker with Wrangler');
  assert.ok(verified > 0 && credentials > verified && install > verified && publish > verified);
  assert.match(workflow, /actual_sha="\$\(git rev-parse HEAD\)"/);
  assert.match(workflow, /test "\$actual_sha" = "\$EXPECTED_COMMIT_SHA"/);
});
