import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const checkout = '11d5960a326750d5838078e36cf38b85af677262';
const artifact = 'ea165f8d65b6e75b540449e92b4886f43607fa02';

for (const name of ['security-staging-4k-rps.yml', 'security-zap-active-staging.yml', 'security-zap-passive.yml']) {
  const filename = new URL('.github/workflows/' + name, root);
  test('security workflow ' + name + ' pins GitHub actions to vetted immutable commits', {
    skip: !existsSync(filename) && 'This workflow belongs to a separate pending security branch',
  }, () => {
    const source = readFileSync(filename, 'utf8');
    assert.doesNotMatch(source, /uses:\s+actions\/(?:checkout|upload-artifact)@v[0-9]+/);
    if (source.includes('actions/checkout@')) {
      assert.ok(source.includes('actions/checkout@' + checkout));
    }
    assert.ok(source.includes('actions/upload-artifact@' + artifact));
  });
}

test('Bun delays newly released npm dependencies for at least 7 days', () => {
  const source = readFileSync(new URL('bunfig.toml', root), 'utf8');
  assert.match(source, /^minimumReleaseAge\s*=\s*604800$/m);
});
