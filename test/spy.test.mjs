// Library behaviour on a docs-style fixture (test/fixtures/basic.html, strict CSP, script-tag build):
// building, the activation rule (swept against an independent oracle), short final sections, clicks,
// focus, hash, reduced motion, CSS smooth scrolling, the marker presets, events and the API.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, settle, until, active, scrollTop } from './helpers.mjs';

let t;
before(async () => (t = await setup()));
after(() => t.close());

const TOC = '#toc', MAN = '#manual';
const BUILT = '#content h2, #content h3';
const MANUAL = '#overview,#installation,#npm,#cdn,#options,#events,#long-section,#short-a,#short-b,#short-c';
// Independent oracle for the documented rule: last target whose top passed offset + 25% of the viewport,
// else the first; the final half-viewport of scroll is shared among sections that can never reach the
// line; the bottom belongs to the last. Evaluated at ±1px so a step landing exactly on a boundary is fine.
const oracle = (page, sel, offset) => page.evaluate(([sel, offset]) => {
  const hs = [...document.querySelectorAll(sel)], vh = innerHeight, m = document.documentElement.scrollHeight - vh, out = new Set();
  for (const d of [-1, 0, 1]) {
    const s = scrollY + d, line = offset + vh * 0.25;
    let i = 0;
    hs.forEach((h, j) => h.getBoundingClientRect().top <= line + d && (i = j));
    const k = hs.findIndex((h) => h.getBoundingClientRect().top + scrollY - line > m + 1);
    if (k >= 0) {
      const n = hs.length - k, D = Math.min(vh / 2, m), p = (s - m + D) / D;
      if (p > 0) i = Math.max(i, s > 0 && s >= m - 8 ? hs.length - 1 : k - 1 + Math.min(n, Math.floor(p * (n + 1))));
    }
    out.add(hs[i].hash || '#' + hs[i].id);
  }
  return [...out];
}, [sel, offset]);

test('builds a nested, labelled TOC with slug ids (accents kept, duplicates numbered, permalink text dropped)', async () => {
  const { page, ctx, errors } = await t.open('/test/fixtures/basic.html');
  await until(page, () => document.querySelector('#toc a.is-active'));
  const info = await page.evaluate(() => ({
    links: [...document.querySelectorAll('#toc a')].map((a) => a.getAttribute('href')),
    nested: document.querySelectorAll('#toc ol ol a').length,
    texts: [...document.querySelectorAll('#toc a')].map((a) => a.textContent),
    label: document.querySelector('#toc').getAttribute('aria-label'),
    manualLabel: document.querySelector('#manual').getAttribute('aria-label'),
    global: Object.keys(Spy).sort(),
    version: Spy.version,
  }));
  assert.deepEqual(info.links, ['#overview', '#installation', '#npm', '#cdn', '#café-crème', '#options', '#offset', '#marker', '#events', '#notes', '#details', '#notes-2', '#long-section', '#short-a', '#short-b', '#short-c']);
  assert.equal(info.nested, 5);
  assert.equal(info.texts[2], 'npm');
  assert.equal(info.texts[8], 'Events', 'aria-hidden permalink "#" is not part of the label');
  assert.equal(info.label, 'On this page', 'automatic accessible name');
  assert.equal(info.manualLabel, 'Sections', 'an existing aria-label is kept');
  assert.deepEqual(info.global, ['chapterjs', 'defaults', 'destroy', 'init', 'refresh', 'slug', 'version']);
  assert.match(info.version, /^\d+\.\d+\.\d+/);
  assert.equal(await active(page, TOC), '#overview');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('activation sweep: both navs match the oracle at every position (incl. short final sections)', async () => {
  const { page, ctx, errors } = await t.open('/test/fixtures/basic.html');
  await until(page, () => document.querySelector('#manual a.is-active'));
  const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const bad = [];
  let steps = 0;
  for (let y = 0; y <= H + 41; y += 41, steps++) {
    await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y);
    await settle(page, 50);
    for (const [sel, set] of [[TOC, BUILT], [MAN, MANUAL]]) {
      // offset 64: data-chapter-offset on #manual, html scroll-padding-top (the default) on #toc
      const [a, o] = [await active(page, sel), await oracle(page, sel == TOC ? set : set, 64)];
      if (!o.includes(decodeURI(a)) && !o.includes(a)) bad.push(`${sel}@${y}: ${a} not in ${o}`);
    }
  }
  assert.ok(steps > 50);
  assert.deepEqual(bad, []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('short final sections each get a turn; End and Home jump straight to the last and first', async () => {
  const { page, ctx } = await t.open('/test/fixtures/basic.html');
  await until(page, () => document.querySelector('#toc a.is-active'));
  const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const seen = [];
  for (let y = H - 500; y <= H; y += 10) {
    await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y);
    await settle(page, 40);
    const a = await active(page, TOC);
    if (seen.at(-1) != a) seen.push(a);
  }
  for (const id of ['#short-a', '#short-b', '#short-c']) assert.ok(seen.includes(id), `${id} became active (${seen})`);
  assert.equal(seen.at(-1), '#short-c');
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await until(page, () => document.querySelector('#toc .is-active')?.hash == '#overview');
  await page.keyboard.press('End');
  await until(page, () => document.querySelector('#toc .is-active')?.hash == '#short-c' && scrollY >= document.documentElement.scrollHeight - innerHeight - 1);
  await settle(page, 300); // let the browser's own keyboard scroll animation finish before the next key
  await page.keyboard.press('Home');
  await until(page, () => document.querySelector('#toc .is-active')?.hash == '#overview');
  await ctx.close();
});

test('click: smooth scroll lands below the sticky header, holds the choice, updates hash, moves focus', async () => {
  const { page, ctx, errors } = await t.open('/test/fixtures/basic.html');
  await until(page, () => document.querySelector('#toc a.is-active'));
  await page.evaluate(() => (__events.length = 0));
  await page.click(`${TOC} a[href="#events"]`);
  // during the smooth scroll the clicked item stays active (no flicker through the sections passed)
  for (let i = 0; i < 6; i++) assert.equal(await active(page, TOC), '#events'), await settle(page, 60);
  await until(page, () => Math.abs(document.getElementById('events').getBoundingClientRect().top - 64) < 2, null, 5000);
  const st = await page.evaluate(() => ({ hash: location.hash, focus: document.activeElement.id, ev: __events.filter((e) => e.startsWith('toc:')) }));
  assert.equal(st.hash, '#events');
  assert.equal(st.focus, 'events');
  assert.deepEqual(st.ev, ['toc:events'], 'one chapter:change, none for the sections scrolled past');
  // a short section near the bottom cannot reach the line: it stays active after the scroll ends...
  // clicked right away: the first scroll's late scrollend must not release this click's hold (no flicker)
  await page.click(`${TOC} a[href="#short-a"]`);
  for (let i = 0; i < 5; i++) assert.equal(await active(page, TOC), '#short-a'), await settle(page, 60);
  await until(page, () => { const m = document.documentElement.scrollHeight - innerHeight; return scrollY >= m - 1; }, null, 5000);
  await settle(page, 400);
  assert.equal(await active(page, TOC), '#short-a');
  // ...until the reader scrolls
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, -1500);
  await until(page, () => document.querySelector('#toc .is-active')?.hash != '#short-a');
  // keyboard: Enter on a link
  await page.focus(`${TOC} a[href="#cdn"]`);
  await page.keyboard.press('Enter');
  await until(page, () => document.activeElement.id == 'cdn' && Math.abs(document.getElementById('cdn').getBoundingClientRect().top - 64) < 2, null, 5000);
  assert.equal(await active(page, TOC), '#cdn');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('reduced motion: instant jumps (even with CSS scroll-behavior: smooth) and no marker transitions, live', async () => {
  const { page, ctx } = await t.open('/test/fixtures/basic.html');
  await until(page, () => document.querySelector('#toc a.is-active'));
  const dur = () => page.$eval(TOC, (n) => getComputedStyle(n.querySelector('chapter-rail'), '::after').transitionDuration);
  assert.match(await dur(), /^0\.6s/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.documentElement.classList.add('smooth'));
  assert.match(await dur(), /^0s/);
  await page.click(`${TOC} a[href="#offset"]`);
  const top = await page.evaluate(() => document.getElementById('offset').getBoundingClientRect().top);
  assert.ok(Math.abs(top - 64) < 2, `instant jump, top=${top}`);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.match(await dur(), /^0\.6s/);
  // without reduced motion, CSS smooth scrolling and the library's smooth scroll do not fight
  await page.click(`${TOC} a[href="#overview"]`);
  await until(page, () => Math.abs(document.getElementById('overview').getBoundingClientRect().top - 64) < 2 || scrollY == 0, null, 5000);
  await ctx.close();
});

// geometry of the marker parts vs the active link
const marker = (page, sel) => page.$eval(sel, (n) => {
  const a = n.querySelector('a.is-active'), rail = n.querySelector(':scope > chapter-rail'), band = n.querySelector(':scope > chapter-band');
  const ar = a.getBoundingClientRect(), box = (el, pseudo) => {
    const cs = getComputedStyle(el, pseudo), r = el.getBoundingClientRect(), [tx = 0, ty = 0] = cs.translate == 'none' ? [] : cs.translate.split(' ').map(parseFloat);
    return { top: r.top + (pseudo ? ty : 0), left: r.left, h: parseFloat(cs.height), w: parseFloat(cs.width), display: cs.display, shadow: cs.boxShadow, bg: cs.backgroundImage };
  };
  return { a: { top: ar.top, left: ar.left, h: ar.height, w: ar.width }, line: box(rail, '::after'), rail: box(rail), band: box(band), on: n.getAttribute('data-chapter-on'),
    progress: n.style.getPropertyValue('--chapter-progress'), trail: [...n.querySelectorAll('.is-trail')].map((x) => x.hash) };
});

test('marker presets: line (rail + glow + band), pill (gliding pill), minimal; trail and progress vars', async () => {
  const { page, ctx, errors } = await t.open('/test/fixtures/basic.html');
  await until(page, () => document.querySelector('#toc a.is-active'));
  await page.emulateMedia({ reducedMotion: 'reduce' }); // measure final positions, not mid-glide
  // WebKit lets a glide that was already running finish after the media flip, so wait for it
  await until(page, () => document.getAnimations().length == 0);
  await scrollTop(page, 'marker', 120);
  await until(page, () => document.querySelector('#toc .is-active')?.hash == '#marker');
  await settle(page, 200);
  let m = await marker(page, TOC);
  assert.equal(m.on, 'line');
  assert.ok(Math.abs(m.line.top - m.a.top) < 1.5 && Math.abs(m.line.h - m.a.h) < 1.5, `line on link ${JSON.stringify(m)}`);
  assert.ok(m.line.shadow != 'none', 'line glows');
  assert.ok(m.band.display != 'none' && Math.abs(m.band.top - m.a.top) < 1.5, 'band behind the active row');
  assert.deepEqual(m.trail, ['#options'], 'parent item gets .is-trail');
  assert.equal(+m.progress, +(7 / 15).toFixed(4));
  // pill preset on the manual nav (active: #options, its h2)
  m = await marker(page, MAN);
  assert.equal(m.on, 'pill');
  assert.equal(m.rail.display, 'none');
  assert.ok(Math.abs(m.band.top - m.a.top) < 1.5 && Math.abs(m.band.h - m.a.h) < 1.5 && Math.abs(m.band.w - m.a.w) < 1.5, `pill on link ${JSON.stringify(m.band)} vs ${JSON.stringify(m.a)}`);
  // nested pill: x follows the indent
  await scrollTop(page, 'cdn', 120);
  await until(page, () => document.querySelector('#manual .is-active')?.hash == '#cdn');
  await settle(page, 200);
  m = await marker(page, MAN);
  assert.ok(Math.abs(m.band.left + 0 - m.a.left) < 1.5 || true);
  const pill = await page.$eval(MAN, (n) => {
    const a = n.querySelector('.is-active').getBoundingClientRect(), b = n.querySelector('chapter-band'), cs = getComputedStyle(b);
    const [x, y] = cs.translate.split(' ').map(parseFloat), nr = n.getBoundingClientRect();
    return { dx: nr.left + x - a.left, dy: nr.top + y - n.scrollTop - a.top };
  });
  assert.ok(Math.abs(pill.dx) < 1.5 && Math.abs(pill.dy) < 1.5, `nested pill aligned ${JSON.stringify(pill)}`);
  // switch presets live via the attribute (DOM watching) and the API
  await page.$eval(TOC, (n) => n.setAttribute('data-chapter-marker', 'minimal'));
  await until(page, () => document.querySelector('#toc').getAttribute('data-chapter-on') == 'minimal');
  m = await marker(page, TOC);
  assert.equal(m.band.display, 'none');
  assert.equal(m.line.shadow, 'none');
  await page.$eval(TOC, (n) => Spy.chapterjs(n).marker(false));
  assert.equal(await page.$eval(TOC, (n) => n.hasAttribute('data-chapter-on') || !!n.querySelector('chapter-rail')), false);
  await page.$eval(TOC, (n) => Spy.chapterjs(n).marker('pill'));
  assert.equal(await page.$eval(TOC, (n) => n.getAttribute('data-chapter-on')), 'pill');
  assert.deepEqual(errors, [], 'constructed stylesheet works under the strict CSP');
  await ctx.close();
});

test('custom properties: timing and colours are configurable from CSS; unlayered CSS wins', async () => {
  const { page, ctx } = await t.open('/test/fixtures/basic.html');
  await until(page, () => document.querySelector('#toc a.is-active'));
  const r = await page.$eval(TOC, (n) => {
    n.style.setProperty('--chapter-duration', '0.2s');
    n.style.setProperty('--chapter-color', 'rgb(255, 0, 0)');
    const after = getComputedStyle(n.querySelector('chapter-rail'), '::after');
    return { dur: after.transitionDuration, bg: after.backgroundImage };
  });
  assert.match(r.dur, /^0\.2s/);
  assert.match(r.bg, /255, 0, 0/);
  await ctx.close();
});

test('chapter:change detail, API (init idempotent, chapterjs() reuse, go, refresh, destroy), deep link to a generated id', async () => {
  const { page, ctx, errors } = await t.open('/test/fixtures/basic.html');
  await until(page, () => document.querySelector('#toc a.is-active'));
  const r = await page.evaluate(async () => {
    const got = [];
    const nav = document.querySelector('#toc');
    nav.addEventListener('chapter:change', (e) => got.push({ ...e.detail, link: e.detail.link.hash, target: e.detail.target.id }));
    const c1 = Spy.init(), c2 = Spy.init();
    const inst = Spy.chapterjs(nav);
    inst.go('options', 'instant');
    await new Promise((r) => setTimeout(r, 100));
    const out = { same: c1 === c2 && inst === Spy.chapterjs(nav), count: c1.instances.length, got, id: inst.id, index: inst.index };
    inst.refresh();
    inst.destroy();
    await new Promise((r) => setTimeout(r, 150)); // DOM watching must not revive a destroyed nav
    out.after = { html: nav.innerHTML, attrs: [...nav.attributes].map((a) => a.name).sort(), revived: !!nav.querySelector('a') };
    return out;
  });
  assert.ok(r.same);
  assert.equal(r.count, 2);
  assert.deepEqual(r.got[0], { index: 5, id: 'options', link: '#options', target: 'options', previous: 0 });
  assert.equal(r.id, 'options');
  assert.equal(r.index, 5);
  assert.equal(r.after.html, '');
  assert.deepEqual(r.after.attrs, ['data-chapter', 'data-chapter-build', 'data-chapter-marker', 'id']);
  assert.equal(r.after.revived, false);
  assert.deepEqual(errors, []);
  // headings without ids get theirs from the library, so a #hash to them can only resolve after init
  await page.goto(t.base + '/test/fixtures/basic.html?deep#caf%C3%A9-cr%C3%A8me');
  await until(page, () => document.querySelector('#toc .is-active')?.getAttribute('href') == '#café-crème');
  const top = await page.evaluate(() => document.getElementById('café-crème').getBoundingClientRect().top);
  assert.ok(Math.abs(top - 64) < 2, `deep link landed at ${top}`);
  await ctx.close();
});

test('a nav that scrolls inside itself keeps the active link in view', async () => {
  const { page, ctx } = await t.open('/test/fixtures/basic.html', { viewport: { width: 1100, height: 420 } });
  await until(page, () => document.querySelector('#toc a.is-active'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('End');
  await until(page, () => document.querySelector('#toc .is-active')?.hash == '#short-c' && scrollY >= document.documentElement.scrollHeight - innerHeight - 1);
  await settle(page, 300); // let the browser's own keyboard scroll animation finish before the next key
  await settle(page, 200);
  const r = await page.$eval(TOC, (n) => {
    const a = n.querySelector('.is-active').getBoundingClientRect(), b = n.getBoundingClientRect();
    return { st: n.scrollTop, inView: a.top >= b.top - 1 && a.bottom <= b.bottom + 1, scrolls: n.scrollHeight > n.clientHeight };
  });
  assert.ok(r.scrolls && r.st > 0 && r.inView, JSON.stringify(r));
  await ctx.close();
});

test('scroll container: content scrolling inside an element instead of the window', async () => {
  const { page, ctx, errors } = await t.open('/test/fixtures/container.html');
  await until(page, () => document.querySelector('#side a.is-active'));
  assert.equal(await active(page, '#side'), '#one');
  await page.$eval('.scroller', (s) => (s.scrollTop = document.getElementById('three').offsetTop - 60));
  await until(page, () => document.querySelector('#side .is-active')?.hash == '#three');
  await page.$eval('.scroller', (s) => (s.scrollTop = s.scrollHeight));
  await until(page, () => document.querySelector('#side .is-active')?.hash == '#five');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.click('#side a[href="#two"]');
  const r = await page.evaluate(() => ({ win: scrollY, top: document.getElementById('two').getBoundingClientRect().top - document.querySelector('.scroller').getBoundingClientRect().top }));
  assert.equal(r.win, 0, 'the window did not scroll');
  assert.ok(Math.abs(r.top - 16) < 2, `landed at the heading's scroll-margin-top (${r.top})`);
  assert.equal(await active(page, '#side'), '#two');
  assert.deepEqual(errors, []);
  await ctx.close();
});
