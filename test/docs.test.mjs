// Docs accuracy for the library repo: every data-spy-* attribute read in src/, every --spy-* input variable in
// marker.css and every runtime export is documented in README, llms.txt and types/. (The website repo,
// chapterize-js-site, re-checks its own pages against these sources.) Pure Node: no browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NAME, GLOBAL } from '../scripts/brand.mjs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('docs accuracy: attributes, CSS variables, exports and install lines are documented in README, llms.txt and types', async () => {
  const src = read('src/index.js'), css = read('src/marker.css'), readme = read('README.md'), llms = read('llms.txt'), dts = read('types/index.d.ts');
  const attrs = [...new Set([...src.matchAll(/attr\('([a-z-]+)'\)/g)].map((m) => 'data-spy-' + m[1]))].concat('data-spy', 'data-spy-label', 'data-spy-ignore');
  assert.ok(attrs.length > 5, attrs.join());
  for (const a of attrs) {
    assert.ok(readme.includes('`' + a), 'README: ' + a);
    assert.ok(llms.includes(a), 'llms.txt: ' + a);
  }
  const out = ['--spy-y', '--spy-h', '--spy-x', '--spy-w'];
  const inputs = [...new Set(css.match(/--spy-[a-z0-9-]+/g))].filter((v) => !out.includes(v));
  for (const v of inputs) for (const [n, doc] of [['README', readme], ['llms.txt', llms]]) assert.ok(doc.includes(v), `${n}: ${v}`);
  for (const v of [...out, '--spy-progress']) assert.ok(readme.includes(v) && llms.includes(v), 'output var ' + v);
  const m = await import('../dist/index.js');
  for (const k of Object.keys(m)) assert.match(dts, new RegExp(`export (declare )?(const|function) ${k}\\b`), 'types: ' + k);
  for (const k of ['spy', 'init', 'refresh', 'destroy', 'slug']) assert.ok(readme.includes(k + '(') && llms.includes(k + '('), 'API doc: ' + k);
  assert.ok(readme.includes(`npm i ${NAME}`) || readme.includes(`npm install ${NAME}`), 'README install line');
  for (const doc of [readme, llms]) assert.ok(doc.includes(`unpkg.com/${NAME}`) && doc.includes('`' + GLOBAL + '`'), 'script tag + global');
  assert.match(readme, /^## Frameworks\n[\s\S]*?^### /m, 'README "## Frameworks" (the site renders it as /frameworks)');
});
