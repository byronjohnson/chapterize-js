// Screenshots of the built site for visual review (see .cursor/skills/judge-marker-quality).
//   node scripts/screens.mjs [outPrefix]     default /tmp/spy-   (needs site-dist: npm run build:site)
//   SCREENS_BASE=http://127.0.0.1:8080 node scripts/screens.mjs   shoot an already-running server instead (e.g. npm run preview)
// Writes <prefix>home-desktop.png (mid-page), home-mobile.png, mobile-sheet.png, plain.png, markers.png,
// frameworks.png. TEST_BROWSER picks the engine (Chromium = the system Chrome), like the tests.
import { existsSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright-core';
import { serve } from './serve.mjs';

const prefix = process.argv[2] || '/tmp/spy-';
const name = process.env.TEST_BROWSER || 'chromium';
const exe = name == 'chromium' ? process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync) : undefined;
const server = process.env.SCREENS_BASE ? null : await serve(0, 'site-dist');
const base = process.env.SCREENS_BASE || `http://127.0.0.1:${server.address().port}`;
const browser = await { chromium, firefox, webkit }[name].launch({ executablePath: exe, headless: true });
const wait = (page, ms) => page.waitForTimeout(ms);
const errors = [];
const shot = async (path, file, { viewport = { width: 1440, height: 900 }, mobile = false, act } = {}) => {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile && name != 'firefox', hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() == 'error' && errors.push(`${path}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${path}: ${e}`));
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await wait(page, 300);
  if (act) await act(page);
  await wait(page, 900);
  await page.screenshot({ path: prefix + file });
  await ctx.close();
  console.log('wrote', prefix + file);
};
const to = (sel, extra = 0) => async (page) => {
  await page.evaluate(([s, x]) => scrollTo({ top: document.querySelector(s).getBoundingClientRect().top + scrollY - 90 + x, behavior: 'instant' }), [sel, extra]);
};
await shot('/', 'home-desktop.png', { act: to('#sticky-headers', -40) });
await shot('/', 'home-mobile.png', { viewport: { width: 390, height: 844 }, mobile: true, act: to('#javascript', -20) });
await shot('/', 'mobile-sheet.png', { viewport: { width: 390, height: 844 }, mobile: true, act: async (p) => { await to('#marker')(p); await p.click('#otp summary'); } });
await shot('/plain', 'plain.png', { viewport: { width: 1280, height: 800 }, act: to('h2:nth-of-type(3)') });
await shot('/markers', 'markers.png', { act: async (p) => {
  await p.evaluate(() => { scrollTo(0, document.querySelector('.presets').getBoundingClientRect().top + scrollY - 70); for (const b of document.querySelectorAll('.demo-body')) b.scrollTop = b.querySelectorAll('h3')[2].offsetTop - b.offsetTop - 30; });
} });
await shot('/frameworks', 'frameworks.png', { act: to('#vue', -30) });
await browser.close();
server?.close();
if (errors.length) console.log('errors:\n' + errors.join('\n'));
