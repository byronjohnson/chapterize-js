// Shared test helpers: one browser per test file (TEST_BROWSER=chromium|firefox|webkit; Chromium is the
// system Chrome), the project root served over HTTP with a strict CSP on test fixtures, and a page opener
// that collects console errors, page errors, failed requests and CSP violations.
import { existsSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright-core';
import { serve } from '../scripts/serve.mjs';
import { GLOBAL } from '../scripts/brand.mjs';

export const name = process.env.TEST_BROWSER || 'chromium';
export const CSP = "default-src 'self'; script-src 'self'; style-src 'self'";
const exe = name == 'chromium' ? process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync) : undefined;

export async function setup() {
  const server = await serve(0, undefined, { handle: (req, res, p) => p == '/favicon.ico' && !!res.writeHead(204).end(), headers: (p) => (p.startsWith('/test/') ? { 'content-security-policy': CSP, 'cache-control': 'no-store' } : {}) });
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await { chromium, firefox, webkit }[name].launch({ executablePath: exe, headless: true });
  const open = async (path, ctxOpts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...ctxOpts });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('requestfailed', (r) => errors.push('failed: ' + r.url()));
    // `Spy` in page code = the script-tag build's global, whatever the project is called (package.json globalName)
    await page.addInitScript((g) => Object.defineProperty(window, 'Spy', { get: () => window[g], configurable: true }), GLOBAL);
    await page.addInitScript(() => {
      addEventListener('securitypolicyviolation', (e) => console.error('CSP violation: ' + e.violatedDirective + ' ' + e.blockedURI));
      window.__events = [];
      addEventListener('spy:change', (e) => __events.push(e.target.id + ':' + e.detail.id));
    });
    const res = await page.goto(base + path);
    return { page, ctx, errors, res };
  };
  return { server, browser, base, open, close: async () => (await browser.close(), server.close()) };
}

// Bounded waits only: every wait in the suite has a timeout.
export const settle = (page, ms = 120) => page.waitForTimeout(ms);
/** Wait (max `ms`) until fn() in the page is truthy. */
export const until = (page, fn, arg, ms = 4000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 30 });
/** href of the single active link in `sel`, checking class + aria-current agree; 'BAD(n)' otherwise. */
export const active = (page, sel) => page.$eval(sel, (n) => {
  const a = n.querySelectorAll('a.is-active'), c = n.querySelectorAll('[aria-current]');
  return a.length == 1 && c.length == 1 && a[0] == c[0] && a[0].getAttribute('aria-current') == 'location' ? a[0].hash : `BAD(${a.length},${c.length})`;
});
/** Put an element's top at y px below the viewport top (instant). */
export const scrollTop = (page, id, y) => page.evaluate(([id, y]) => {
  const el = document.getElementById(id);
  scrollTo({ top: el.getBoundingClientRect().top + scrollY - y, behavior: 'instant' });
}, [id, y]);
