import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

for (const name of ['security-staging-4k-rps', 'security-zap-active-staging', 'security-zap-passive']) {
  test('immutable GitHub Action refs in ' + name, () => {
    const workflow = readFileSync(new URL('../.github/workflows/' + name + '.yml', import.meta.url), 'utf8');
    assert.doesNotMatch(workflow, /uses:\s+actions\/(?:checkout|upload-artifact)@v\d+/);
    if (workflow.includes('actions/checkout@')) {
      assert.match(workflow, /uses:\s+actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/);
    }
    assert.match(workflow, /uses:\s+actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/);
  });
}
