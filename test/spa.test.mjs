// Framework compatibility: the library must survive what SPAs do to the DOM. test/fixtures/spa.js is a tiny
// stand-in for a framework + router (re-rendered views and navs, router-intercepted links, late content,
// pushState routes, hash routes, shadow DOM). The library is only init()-ed once; everything else is DOM watching.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, until, settle, active, scrollTop } from './helpers.mjs';

let t;
before(async () => (t = await setup()));
after(() => t.close());

const toc = (page) => page.$$eval('#toc a', (as) => as.map((a) => a.textContent));
const count = (page) => page.evaluate(() => window.app && document.querySelectorAll('[data-spy-on]').length);
const open = async () => {
  const o = await t.open('/test/fixtures/spa.html');
  await until(o.page, () => document.querySelectorAll('#toc a').length == 4 && document.querySelectorAll('#manual a').length == 4);
  return o;
};

test('route change: the outline rebuilds from the new view, ids regenerate, the active link stays valid', async () => {
  const { page, ctx, errors } = await open();
  assert.deepEqual(await toc(page), ['Alpha one', 'Alpha two', 'Alpha three', 'Alpha four']);
  await scrollTop(page, 'alpha-three', 120);
  await until(page, () => document.querySelector('#toc .is-active')?.hash == '#alpha-three');
  await page.click('header a[data-route="b"]'); // router link: intercepted with preventDefault
  await until(page, () => document.querySelectorAll('#toc a').length == 3);
  assert.deepEqual(await toc(page), ['Beta one', 'Beta two', 'Beta three']);
  assert.equal(await page.evaluate(() => location.pathname), '/test/fixtures/spa.html');
  assert.deepEqual(await page.$$eval('#view h2', (hs) => hs.map((h) => h.id)), ['beta-one', 'beta-two', 'beta-three']);
  await page.evaluate(() => scrollTo(0, 0));
  await until(page, () => document.querySelector('#toc .is-active')?.hash == '#beta-one');
  assert.match(await active(page, '#toc'), /^#beta-/);
  // the hand-written nav (re-rendered by the "framework", /path#id links) follows too
  await until(page, () => [...document.querySelectorAll('#manual a')].map((a) => a.hash).join() == '#beta-one,#beta-two,#beta-three');
  await scrollTop(page, 'beta-two', 120);
  await until(page, () => document.querySelector('#manual .is-active')?.hash == '#beta-two' && document.querySelector('#toc .is-active')?.hash == '#beta-two');
  // back to route A via history
  await page.evaluate(() => app.route('a'));
  await until(page, () => document.querySelectorAll('#toc a').length == 4);
  assert.equal(await page.evaluate(() => app.init().instances.length), 2, 'still exactly two instances');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('re-rendered and remounted navs: replaced, removed and re-added navs get exactly one live instance', async () => {
  const { page, ctx, errors } = await open();
  await page.evaluate(() => app.rerenderNav());
  await until(page, () => document.querySelectorAll('#toc a').length == 4 && document.querySelector('#toc[data-spy-on] a.is-active'));
  assert.equal(await page.evaluate(() => app.init().instances.length), 2);
  await page.evaluate(() => app.removeNav());
  await until(page, () => app.init().instances.length == 1);
  assert.equal(await page.evaluate(() => app.saved.querySelector('spy-rail')), null, 'a removed nav is cleaned up');
  await page.evaluate(() => app.addNav());
  await until(page, () => app.init().instances.length == 2 && document.querySelector('#toc a.is-active'));
  assert.equal(await page.$$eval('#toc > ol', (l) => l.length), 1, 'one list, never two');
  assert.equal(await page.$$eval('#toc spy-rail', (l) => l.length), 1, 'one marker');
  assert.equal(await count(page), 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('live DOM edits: late headings, heading text changes and attribute changes are picked up', async () => {
  const { page, ctx, errors } = await open();
  await page.evaluate(() => app.late());
  await until(page, () => document.querySelector('#toc li:last-child a')?.textContent == 'Late arrival');
  await page.evaluate(() => (document.querySelector('#view h2').firstChild.data = 'Alpha uno'));
  await until(page, () => document.querySelector('#toc a').textContent == 'Alpha uno');
  assert.equal(await page.$eval('#toc a', (a) => a.hash), '#alpha-one', 'existing ids stay stable when text changes');
  await page.evaluate(() => document.getElementById('toc').setAttribute('data-spy-marker', 'pill'));
  await until(page, () => document.getElementById('toc').getAttribute('data-spy-on') == 'pill');
  await page.evaluate(() => document.getElementById('toc').removeAttribute('data-spy-marker'));
  await until(page, () => !document.getElementById('toc').hasAttribute('data-spy-on') && !document.querySelector('#toc spy-rail'));
  // the library's own writes never trigger a rebuild loop
  const n = await page.evaluate(() => new Promise((r) => {
    let k = 0;
    const mo = new MutationObserver((rs) => (k += rs.length));
    mo.observe(document.getElementById('toc'), { childList: true, subtree: true });
    setTimeout(() => (mo.disconnect(), r(k)), 400);
  }));
  assert.equal(n, 0, 'quiet when nothing changes');
  // removing data-spy stops spying that nav (attributes off the nav, classes gone)
  await page.evaluate(() => document.getElementById('toc').removeAttribute('data-spy'));
  await until(page, () => !document.querySelector('#toc .is-active') && app.init().instances.length == 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('routers: intercepted clicks are left alone, hash routes keep their URL, router state is preserved', async () => {
  const { page, ctx, errors } = await open();
  // a link whose own handler calls preventDefault (an app taking over) is not hijacked
  await page.evaluate(() => document.querySelector('#toc a[href="#alpha-three"]').addEventListener('click', (e) => e.preventDefault()));
  const y0 = await page.evaluate(() => scrollY);
  await page.click('#toc a[href="#alpha-three"]');
  await settle(page, 300);
  assert.equal(await page.evaluate(() => scrollY), y0, 'defaultPrevented click: no scroll');
  // pushState keeps the router's history.state
  await page.evaluate(() => history.replaceState({ route: 'a', key: 7 }, ''));
  await page.click('#toc a[href="#alpha-two"]');
  await until(page, () => location.hash == '#alpha-two');
  assert.deepEqual(await page.evaluate(() => history.state), { route: 'a', key: 7 });
  // hash router: #/docs stays, the click still scrolls
  await page.evaluate(() => history.replaceState(null, '', '#/docs'));
  await page.click('#toc a[href="#alpha-four"]');
  // alpha-four is the last section: the page bottoms out, and the tail rule still makes it active
  await until(page, () => innerHeight + scrollY >= document.documentElement.scrollHeight - 2 && document.querySelector('#toc .is-active')?.hash == '#alpha-four');
  assert.equal(await page.evaluate(() => location.hash), '#/docs');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('global destroy() stops everything and init() starts again; shadow DOM navs work with spy()', async () => {
  const { page, ctx, errors } = await open();
  await page.evaluate(() => app.destroy());
  assert.deepEqual(await page.evaluate(() => [document.querySelectorAll('#toc a').length, document.querySelectorAll('[data-spy-on], .is-active, [aria-current]').length, document.getElementById('toc').hasAttribute('aria-label')]), [0, 0, false]);
  await page.evaluate(() => app.late());
  await settle(page, 200);
  assert.equal(await page.$$eval('#toc a', (l) => l.length), 0, 'no DOM watching after destroy');
  await page.evaluate(() => app.init());
  await until(page, () => document.querySelectorAll('#toc a').length == 5 && document.querySelector('#toc a.is-active'));
  // shadow DOM: the marker sheet is adopted into the shadow root, ids resolve inside it
  const s = await page.evaluate(() => {
    const i = app.shadow(), r = document.getElementById('host').shadowRoot;
    return { links: i.links.length, ids: [...r.querySelectorAll('h3')].map((h) => h.id), sheet: r.adoptedStyleSheets.length, on: r.querySelector('nav').getAttribute('data-spy-on') };
  });
  assert.deepEqual(s, { links: 2, ids: ['shadow-one', 'shadow-two'], sheet: 1, on: 'pill' });
  await page.evaluate(() => document.getElementById('host').shadowRoot.getElementById('shadow-two').scrollIntoView());
  await until(page, () => document.getElementById('host').shadowRoot.querySelector('nav a.is-active')?.hash == '#shadow-two');
  assert.deepEqual(errors, []);
  await ctx.close();
});
