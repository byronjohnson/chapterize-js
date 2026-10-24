// Dev server (npm run dev) end to end, on a throwaway copy of the project so no edits are left behind:
// CSS hot swap, HTML reload, src/ -> dist rebuild, build-error overlay + recovery, reconnect after restart.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright-core';

const name = process.env.TEST_BROWSER || 'chromium';
const exe = name == 'chromium' ? process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync) : undefined;
const repo = fileURLToPath(new URL('..', import.meta.url));
const SKIP = new Set(['node_modules', 'site-dist', '.site-dev', '.git', 'frames', '.vercel']);
let dir, proc, port, browser, logs = '';

const startDev = (p = 0) => new Promise((resolve, reject) => {
  proc = spawn(process.execPath, ['scripts/dev.mjs'], { cwd: dir, env: { ...process.env, PORT: String(p) } });
  const onData = (d) => {
    logs += d;
    const m = logs.match(/http:\/\/localhost:(\d+)\//g);
    if (m && m.length > startDev.count) startDev.count = m.length, resolve(+m.at(-1).match(/\d+/)[0]);
  };
  proc.stdout.on('data', onData);
  proc.stderr.on('data', (d) => (logs += d));
  proc.on('exit', (c) => reject(new Error('dev server exited ' + c + '\n' + logs)));
});
startDev.count = 0;
const stopDev = () => new Promise((r) => (proc.exitCode !== null ? r() : (proc.removeAllListeners('exit'), proc.once('exit', r), proc.kill('SIGTERM'))));
const file = (rel) => join(dir, rel);
const edit = (rel, fn) => writeFileSync(file(rel), fn(readFileSync(file(rel), 'utf8')));

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'chapterize-dev-'));
  for (const f of readdirSync(repo)) if (!SKIP.has(f)) cpSync(join(repo, f), join(dir, f), { recursive: true });
  symlinkSync(join(repo, 'node_modules'), join(dir, 'node_modules'), 'dir');
  port = await startDev(0);
  browser = await { chromium, firefox, webkit }[name].launch({ executablePath: exe, headless: true });
});
after(async () => {
  await browser?.close();
  if (proc) await stopDev();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

test('dev server: live CSS swap, HTML reload, src/ rebuild, error overlay, reconnect after restart', async () => {
  const base = `http://127.0.0.1:${port}`;
  // dev responses: client injected, no caching, CSP unchanged; the client never ends up in the build output
  const res = await fetch(base + '/');
  const html = await res.text();
  assert.match(html, /<script type="module" src="\/__dev\/client\.js"><\/script>/);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(res.headers.get('content-security-policy'), /script-src 'self'.*connect-src 'self'/);
  assert.equal((await fetch(base + '/assets/' + html.match(/\/assets\/(site-[^"]+\.css)/)[1])).headers.get('cache-control'), 'no-store');
  const devOut = readdirSync(file('.site-dev'));
  assert.equal(devOut.length, 1);
  assert.equal(JSON.stringify(readdirSync(file('.site-dev/' + devOut[0]), { recursive: true })).includes('client'), false, 'client not written to the build');
  assert.equal(readFileSync(file(`.site-dev/${devOut[0]}/index.html`), 'utf8').includes('__dev'), false);

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const csp = [], errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => addEventListener('securitypolicyviolation', (e) => (window.__csp = (window.__csp || []).concat(e.violatedDirective))));
  page.on('console', (m) => /CSP|Content Security/i.test(m.text()) && csp.push(m.text()));
  await page.goto(base + '/');
  await page.waitForFunction(() => window.__dev?.id);
  const loads = () => page.waitForEvent('load', { timeout: 15000 });

  // (a) CSS-only change: stylesheet hot-swapped, no reload, scroll position kept
  await page.evaluate(() => { window.__marker = 1; scrollTo(0, 900); });
  const y = await page.evaluate(() => scrollY);
  edit('site/assets/site.css', (s) => s + '\n.foot { border-top-color: rgb(1, 2, 3) }\n');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.foot')).borderTopColor == 'rgb(1, 2, 3)', null, { timeout: 15000 });
  const a = await page.evaluate(() => ({ marker: window.__marker, y: scrollY, links: document.querySelectorAll('link[rel=stylesheet]').length, ev: __dev.events.map((e) => e.type) }));
  assert.equal(a.marker, 1, 'no full reload for a CSS change');
  assert.equal(a.y, y, 'scroll position kept');
  assert.equal(a.links, 1, 'old stylesheet removed');
  assert.ok(a.ev.includes('css') && a.ev.includes('css-applied') && !a.ev.includes('reload'), a.ev.join());
  // the library still runs after the swap (marker present, an active link)
  assert.ok(await page.$('.side nav[data-spy-on] a.is-active'));

  // (b) page HTML change: full reload, new content
  let l = loads();
  edit('site/pages/index.html', (s) => s.replace('<h2 id="overview">Overview</h2>', '<h2 id="overview">Overview, edited live</h2>'));
  await l;
  assert.equal(await page.evaluate(() => window.__marker), undefined, 'page reloaded');
  assert.match(await page.textContent('#overview'), /edited live/);
  await page.waitForFunction(() => document.querySelector('.side nav a')?.textContent == 'Overview, edited live', null, { timeout: 5000 });

  // (c) library source change: dist/ rebuilt first, then the site, then reload
  l = loads();
  edit('src/index.js', (s) => s + '\nexport const __devProbe = 1;\n');
  await l;
  assert.match(readFileSync(file('dist/index.js'), 'utf8'), /__devProbe/, 'dist rebuilt from src/');
  assert.match(await (await fetch(base + '/dist/index.js')).text(), /__devProbe/, 'site serves the new dist');
  assert.match(await page.evaluate(async () => Object.keys(await import('/dist/index.min.js')).join()), /__devProbe/);

  // (d) build error: overlay shown, server stays up with the last good build; recovers on the next good save
  const good = readFileSync(file('site/assets/site.js'), 'utf8');
  await page.evaluate(() => (window.__marker = 2));
  writeFileSync(file('site/assets/site.js'), good + '\nconst = ;\n');
  await page.waitForSelector('#__dev-overlay', { timeout: 15000 });
  assert.match(await page.textContent('#__dev-overlay'), /Build failed \(site\)[\s\S]*site\.js/);
  assert.match(logs, /✖ site build failed/);
  assert.equal((await fetch(base + '/')).status, 200, 'server still up');
  assert.equal(await page.evaluate(() => window.__marker), 2, 'no reload on a failed build');
  await page.click('#__dev-overlay button');
  assert.equal(await page.$('#__dev-overlay'), null, 'overlay dismissible');
  // a page loaded while the build is broken shows the overlay straight away
  const p2 = await ctx.newPage();
  await p2.goto(base + '/markers');
  await p2.waitForSelector('#__dev-overlay', { timeout: 15000 });
  await p2.close();
  l = loads();
  writeFileSync(file('site/assets/site.js'), good);
  await l;
  assert.equal(await page.$('#__dev-overlay'), null);
  assert.match(logs, /error cleared/);

  // (e) dev server restarts on the same port: the open tab reconnects and reloads by itself
  await page.evaluate(() => (window.__marker = 3));
  await stopDev();
  l = loads();
  await startDev(port);
  await l;
  assert.equal(await page.evaluate(() => window.__marker), undefined, 'reloaded after reconnect');
  await page.waitForFunction(() => window.__dev?.id);

  assert.deepEqual(await page.evaluate(() => window.__csp || []), [], 'no CSP violations from the dev client');
  assert.deepEqual(csp, []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('dev watcher ignores editor temp files and build output', async () => {
  const { classify } = await import(join(dir, 'scripts/dev.mjs').replace(/^/, 'file://'));
  for (const f of ['site/pages/.index.html.swp', 'site/assets/site.css~', 'site/.DS_Store', 'site/pages/4913', 'site/pages/#index.html#', 'site-dist/index.html', 'dist/index.js', '.site-dev/1/index.html', 'node_modules/x/y.js', '.git/HEAD'])
    assert.equal(classify(f), null, f);
  assert.deepEqual(['site/assets/site.css', 'site/pages/index.html', 'site/partials/layout.html', 'site/public/favicon.svg', 'src/index.js', 'src/marker.css', 'llms.txt', 'scripts/build-site.mjs', 'scripts/build.mjs', 'scripts/brand.mjs', 'scripts/site/highlight.mjs', 'README.md', 'types/index.d.ts', 'site/partials/frameworks.mjs'].map(classify), ['css', 'site', 'site', 'site', 'lib', 'lib', 'site', 'site', 'lib', 'lib', 'site', 'site', 'site', 'site']);
});
