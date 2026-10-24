// Website + docs tests: site-dist/ served like Vercel (clean URLs, 404.html, vercel.json headers incl. the strict CSP),
// and docs accuracy: every attribute / CSS variable / export the library has is documented where it should be.
// Run: npm test (builds dist/ and site-dist/ first). Other engines: TEST_BROWSER=firefox|webkit.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright-core';
import { serve } from '../scripts/serve.mjs';
import { NAME, GLOBAL } from '../scripts/brand.mjs';

const name = process.env.TEST_BROWSER || 'chromium';
const exe = name == 'chromium' ? process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync) : undefined;
const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const PAGES = ['/', '/frameworks', '/markers', '/plain'];
let server, browser, base;

before(async () => {
  assert.ok(existsSync(new URL('../site-dist/index.html', import.meta.url)), 'site-dist/ missing: run `npm run build:site`');
  server = await serve(0, 'site-dist');
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await { chromium, firefox, webkit }[name].launch({ executablePath: exe, headless: true });
});
after(async () => (await browser?.close(), server?.close()));

// listeners are attached before navigation; every wait below is bounded
const open = async (path, ctxOpts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...ctxOpts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('requestfailed', (r) => errors.push('failed: ' + r.url()));
  await page.addInitScript(() => addEventListener('securitypolicyviolation', (e) => console.error('CSP violation: ' + e.violatedDirective + ' ' + e.blockedURI)));
  const res = await page.goto(base + path, { timeout: 10000 });
  return { page, ctx, errors, res };
};
const until = (page, fn, arg, ms = 4000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 30 });

test('every page: 200, strict CSP header, no errors or CSP violations while scrolling; unknown paths 404', async () => {
  for (const p of PAGES) {
    const { page, ctx, errors, res } = await open(p);
    assert.equal(res.status(), 200, p);
    assert.match(res.headers()['content-security-policy'], /script-src 'self'; style-src 'self'/, p);
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 700) await page.evaluate((y) => scrollTo(0, y), y), await page.waitForTimeout(30);
    await page.waitForTimeout(300);
    assert.deepEqual(errors, [], p);
    await ctx.close();
  }
  const { page, ctx, res } = await open('/nope');
  assert.equal(res.status(), 404);
  assert.ok(await page.$('main.lost'));
  await ctx.close();
  for (const [from, to] of [['/index.html', '/'], ['/frameworks.html', '/frameworks'], ['/markers/', '/markers']]) {
    const r = await fetch(base + from, { redirect: 'manual' });
    assert.equal(r.status, 308, from);
    assert.equal(r.headers.get('location'), to);
  }
});

test('build output: hashed, immutable assets; sitemap, robots and llms.txt; no unresolved placeholders', async () => {
  const assets = readdirSync(new URL('../site-dist/assets/', import.meta.url));
  assert.ok(assets.length >= 3 && assets.every((f) => /-[A-Z0-9]{8}\.(css|js)$/.test(f)), assets.join());
  const r = await fetch(`${base}/assets/${assets[0]}`);
  assert.match(r.headers.get('cache-control'), /immutable/);
  const sm = await (await fetch(base + '/sitemap.xml')).text();
  for (const p of PAGES) assert.ok(sm.includes(`/${p.slice(1)}</loc>`), 'sitemap ' + p);
  assert.match(await (await fetch(base + '/robots.txt')).text(), /Sitemap: https?:\/\/.+\/sitemap\.xml/);
  assert.equal(await (await fetch(base + '/llms.txt')).text(), read('llms.txt'));
  for (const f of readdirSync(new URL('../site-dist/', import.meta.url)).filter((f) => f.endsWith('.html'))) {
    const html = read('site-dist/' + f);
    assert.doesNotMatch(html, /\{\{[^}]*\}\}/, f);
    assert.doesNotMatch(html.replace(/<pre[\s\S]*?<\/pre>/g, ''), /<style|\sstyle=|\son[a-z]+=|<script(?![^>]*\bsrc=)[^>]*>/, f + ': no inline styles, handlers or scripts (CSP)');
  }
});

test('clean URLs: extensionless pages resolve, .html redirects, no internal link, canonical or sitemap URL ends in .html', async () => {
  const cfg = JSON.parse(read('vercel.json'));
  assert.equal(cfg.cleanUrls, true);
  assert.equal(cfg.trailingSlash, false);
  for (const p of PAGES) {
    assert.equal((await fetch(base + p, { redirect: 'manual' })).status, 200, p);
    const from = p == '/' ? '/index.html' : p + '.html';
    const r = await fetch(base + from + '?q=1', { redirect: 'manual' });
    assert.equal(r.status, 308, from);
    assert.equal(r.headers.get('location'), p + '?q=1', from);
  }
  const sm = await (await fetch(base + '/sitemap.xml')).text();
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length >= PAGES.length, sm);
  for (const l of locs) assert.ok(!/\.html$/.test(l) && (new URL(l).pathname == '/' || !l.endsWith('/')), 'sitemap ' + l);
  const internal = new Set();
  let canon = 0;
  for (const f of readdirSync(new URL('../site-dist/', import.meta.url)).filter((f) => f.endsWith('.html'))) {
    const html = read('site-dist/' + f).replace(/<pre[\s\S]*?<\/pre>/g, ''); // code samples may mention .html files
    for (const [, attr, url] of html.matchAll(/\s(href|content)="([^"]*)"/g)) {
      const own = url.startsWith('/') && !url.startsWith('//') || /^https?:\/\/[^/]*\.vercel\.app|^https?:\/\/(127\.0\.0\.1|localhost)/.test(url);
      if (attr == 'content' && !/^https?:/.test(url)) continue;
      if (!own && !(attr == 'href' && !/^[a-z]+:|^#/.test(url))) continue;
      assert.doesNotMatch(url.split(/[?#]/)[0], /\.html$/, `${f}: ${attr}="${url}"`);
      if (attr == 'href' && url.startsWith('/') && !url.startsWith('//')) internal.add(url.split('#')[0] || '/');
    }
    for (const m of html.matchAll(/<link rel="?canonical"? href="([^"]+)"|<meta property="?og:url"? content="([^"]+)"/g)) canon++, assert.doesNotMatch(m[1] || m[2], /\.html$/, f);
  }
  assert.ok(canon >= PAGES.length && internal.size >= 4, `checked ${canon} canonical/og URLs, ${internal.size} internal links`);
  for (const u of internal) assert.equal((await fetch(base + u, { redirect: 'manual' })).status, 200, 'internal link ' + u);
});

test('copy buttons: copy the code and announce the result in the polite live region', async () => {
  const ctxOpts = name == 'chromium' ? { permissions: ['clipboard-read', 'clipboard-write'] } : {};
  const { page, ctx, errors } = await open('/', ctxOpts);
  assert.equal(await page.$eval('#copy-live', (l) => l.getAttribute('aria-live') + '|' + l.textContent), 'polite|');
  await until(page, () => document.querySelector('.code-copy') && !document.querySelector('.code-copy').hidden);
  const btn = await page.$('.code-copy');
  assert.match(await btn.getAttribute('aria-label'), /^Copy code: /);
  await btn.click();
  await until(page, () => /^(Copied to clipboard|Code selected, press Ctrl\+C or Cmd\+C to copy)$/.test(document.getElementById('copy-live').textContent));
  const msg = await page.$eval('#copy-live', (l) => l.textContent);
  if (name == 'chromium') {
    assert.equal(msg, 'Copied to clipboard');
    const pre = await page.$eval('.code-copy', (b) => b.closest('.code').querySelector('pre').textContent);
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), pre);
  }
  assert.match(await btn.textContent(), /^(Copied|Press Ctrl\+C)$/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('home: both outlines are built by the library, the marker glides, the counters + mobile sheet follow', async () => {
  const { page, ctx, errors } = await open('/');
  await until(page, () => document.querySelectorAll('.side nav a').length > 10 && document.querySelector('.side nav[data-spy-on="line"] spy-rail'));
  const h2 = await page.$$eval('#main h2', (l) => l.map((h) => '#' + h.id));
  const top = await page.$$eval('.side nav > ol > li > a', (l) => l.map((a) => a.hash));
  assert.deepEqual(top, h2);
  assert.equal(await page.$eval('.side nav', (n) => n.getAttribute('aria-label')), 'On this page');
  await page.click('.side nav a[href="#marker"]');
  await until(page, () => location.hash == '#marker' && document.querySelector('.side nav a.is-active')?.hash == '#marker');
  assert.ok(await page.evaluate(() => +parseFloat(getComputedStyle(document.querySelector('.side nav')).getPropertyValue('--spy-y')) > 0));
  assert.deepEqual(errors, []);
  await ctx.close();
  // mobile: the compact sheet is the outline; its summary names the current section
  const m = await open('/#accessibility', { viewport: { width: 390, height: 844 } });
  await until(m.page, () => document.querySelector('#otp nav a.is-active'));
  assert.equal(await m.page.$eval('.side', (s) => getComputedStyle(s).display), 'none');
  assert.match(await m.page.$eval('#otp summary', (s) => s.textContent), /Accessibility/);
  await m.page.click('#otp summary');
  await m.page.click('#otp nav a[href="#faq"]');
  await until(m.page, () => !document.getElementById('otp').open && location.hash == '#faq');
  assert.deepEqual(m.errors, []);
  await m.ctx.close();
});

test('frameworks page is generated from the README: every recipe heading, in order, with code', async () => {
  const readme = read('README.md'), sec = readme.slice(readme.indexOf('## Frameworks'), readme.indexOf('\n## ', readme.indexOf('## Frameworks') + 5));
  const want = [...sec.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
  assert.ok(want.length >= 13, want.join());
  const { page, ctx, errors } = await open('/frameworks');
  assert.deepEqual(await page.$$eval('#main h3', (l) => l.map((h) => h.firstChild.textContent.trim())), want);
  assert.ok((await page.$$('#main pre')).length >= 13);
  // the Next.js recipe (verified in a real Next app): three labelled snippets, highlighted, under its own heading
  const next = await page.$$eval('#main h3', (l) => {
    const h = l.find((x) => x.firstChild.textContent.trim() == 'Next.js'); const out = [];
    for (let n = h.nextElementSibling; n && n.tagName != 'H3' && n.tagName != 'H2'; n = n.nextElementSibling) if (n.matches('.code')) out.push([n.querySelector('.code-label').textContent, n.querySelector('pre').textContent, !!n.querySelector('pre span')]);
    return out;
  });
  assert.deepEqual(next.map((c) => c[0]), ['app/spy-init.tsx', 'app/layout.tsx', 'app/docs/page.tsx']);
  assert.ok(next.every((c) => c[2]), 'highlighted');
  assert.match(next[0][1], /^'use client';[\s\S]*useEffect\(\(\) => \{ init\(\); \}, \[\]\);/);
  assert.match(next[2][1], /<nav data-spy data-spy-build="article h2, article h3" data-spy-marker/);
  // the home page's framework index links resolve
  for (const href of await (await open('/')).page.$$eval('.fw-index a', (l) => l.map((a) => a.getAttribute('href')))) {
    assert.ok(await page.$(`[id="${href.split('#')[1]}"]`), href);
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('markers page: one live demo per preset, each spying its own scroller; plain page uses the global build', async () => {
  const { page, ctx, errors } = await open('/markers');
  await until(page, () => document.querySelectorAll('.demo nav[data-spy-on]').length == 3);
  assert.deepEqual(await page.$$eval('.demo nav', (l) => l.map((n) => n.getAttribute('data-spy-on'))), ['line', 'pill', 'minimal']);
  await page.$eval('#demo-pill', (b) => b.querySelectorAll('h3')[2].scrollIntoView({ block: 'start' }));
  await until(page, () => document.querySelector('#demo-pill').previousElementSibling?.querySelector?.('a.is-active') || [...document.querySelectorAll('.demo nav[data-spy-on=pill] a')].indexOf(document.querySelector('.demo nav[data-spy-on=pill] a.is-active')) == 2);
  assert.equal(await page.evaluate(() => location.hash), '', 'demos never touch the URL');
  assert.deepEqual(errors, []);
  await ctx.close();
  const p = await open('/plain');
  await until(p.page, (g) => window[g] && document.querySelector('nav[data-spy] a.is-active'), GLOBAL);
  assert.ok(await p.page.$('script[src="/dist/global.min.js"]'));
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});

test('docs accuracy: attributes, CSS variables and exports are documented in README, llms.txt, types and the site', async () => {
  const src = read('src/index.js'), css = read('src/marker.css'), readme = read('README.md'), llms = read('llms.txt'), dts = read('types/index.d.ts');
  const home = read('site/pages/index.html'), markers = read('site/pages/markers.html');
  const attrs = [...new Set([...src.matchAll(/attr\('([a-z-]+)'\)/g)].map((m) => 'data-spy-' + m[1]))].concat('data-spy', 'data-spy-label', 'data-spy-ignore');
  for (const a of attrs) {
    assert.ok(readme.includes('`' + a), 'README: ' + a);
    assert.ok(llms.includes(a), 'llms.txt: ' + a);
    assert.ok(home.includes(a), 'home page: ' + a);
  }
  const out = ['--spy-y', '--spy-h', '--spy-x', '--spy-w'];
  const inputs = [...new Set(css.match(/--spy-[a-z0-9-]+/g))].filter((v) => !out.includes(v));
  for (const v of inputs) for (const [n, doc] of [['README', readme], ['llms.txt', llms], ['markers page', markers]]) assert.ok(doc.includes(v), `${n}: ${v}`);
  for (const v of [...out, '--spy-progress']) assert.ok(readme.includes(v) && llms.includes(v), 'output var ' + v);
  const m = await import('../dist/index.js');
  for (const k of Object.keys(m)) assert.match(dts, new RegExp(`export (declare )?(const|function) ${k}\\b`), 'types: ' + k);
  for (const k of ['spy', 'init', 'refresh', 'destroy', 'slug']) assert.ok(readme.includes(k + '(') && llms.includes(k + '('), 'API doc: ' + k);
  assert.ok(readme.includes(`npm i ${NAME}`) || readme.includes(`npm install ${NAME}`));
});
