// SSR safety: every build imports in plain Node (no window/document) without throwing or touching globals,
// and init() on the server is a harmless no-op. Also checks the package's exports map resolves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('SSR: ESM, auto and CJS builds import in Node without a DOM; init() is a no-op', async () => {
  assert.equal(typeof document, 'undefined');
  const before = Object.keys(globalThis).sort().join();
  for (const f of ['index.js', 'index.min.js', 'auto.js', 'auto.min.js']) assert.ok(await import(`../dist/${f}`), f);
  const m = await import('../dist/index.min.js');
  const ctl = m.init({ marker: true });
  assert.deepEqual(ctl.instances, []);
  ctl.refresh(); ctl.destroy(); m.refresh(); m.destroy();
  assert.equal(m.slug('Café crème, 2026!'), 'café-crème-2026', 'slug() works on the server (for SSR-rendered ids)');
  assert.equal(typeof (await import('../dist/auto.min.js')).default.refresh, 'function');
  const req = createRequire(import.meta.url);
  for (const f of ['../dist/index.cjs', '../dist/auto.cjs']) assert.ok(req(f), f);
  const cjs = req('../dist/index.cjs');
  assert.deepEqual(Object.keys(cjs).sort(), ['chapterjs', 'defaults', 'destroy', 'init', 'refresh', 'slug', 'version']);
  assert.equal(cjs.version, pkg.version);
  assert.deepEqual(cjs.defaults, { marker: false, hash: true, observe: true });
  assert.equal(Object.keys(globalThis).sort().join(), before, 'no globals added on the server');
});

test('package.json: exports resolve by name, files are dist, types and the changelog, sideEffects flags the auto entries', async () => {
  const self = await import(pkg.name);
  assert.equal(typeof self.init, 'function');
  assert.equal(typeof (await import(pkg.name + '/auto')).default.destroy, 'function');
  assert.equal(typeof createRequire(import.meta.url)(pkg.name).chapterjs, 'function');
  assert.deepEqual(pkg.files, ['dist', 'types', 'CHANGELOG.md']);
  assert.ok(pkg.sideEffects.includes('./dist/auto.js') && !pkg.sideEffects.includes('./dist/index.js'));
  assert.deepEqual(pkg.dependencies ?? {}, {}, 'zero dependencies');
});
