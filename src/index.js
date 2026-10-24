// Core library (ESM). SSR-safe: nothing here touches window or document until init() or spy() is called.
// The build replaces __VERSION__ and inlines ./marker.css (minified) as a string.
import CSS from './marker.css';

export const version = __VERSION__;

/** Option defaults. Per-nav data-spy-* attributes win over options, options win over these. */
export const defaults = { marker: false, hash: true, observe: true };

const SEL = '[data-spy]';
const KEY = Symbol.for('data-spy');
const ACTIVE = 'is-active';
const TRAIL = 'is-trail';
const PRESETS = { line: 1, pill: 1, minimal: 1 };
const LINE = 0.25; // the activation line sits `offset` + 25% down the viewport
const WATCHED = ['id', 'href', 'data-spy', 'data-spy-build', 'data-spy-offset', 'data-spy-marker', 'data-spy-hash', 'data-spy-label', 'data-spy-ignore'];
const PROPS = ['spy-y', 'spy-h', 'spy-x', 'spy-w', 'spy-progress', '_l'];

const instances = new Set();
const off = new WeakSet(); // navs destroyed on purpose: DOM watching must not bring them back
const scanned = new WeakSet(); // navs found by init() (vs. spy(nav) calls)
const sheets = new WeakMap(); // Document | ShadowRoot -> adopted marker sheet
let env = null; // shared browser state, created on first use
let ctl = null; // the init() controller
let uid = 0;

const now = () => performance.now();
const num = (v) => (v == null || v === '' || isNaN(v) ? null : +v);
const no = (v) => v === false || v === 'false' || v === 'none';
const hashId = () => {
  try { return decodeURIComponent(location.hash.slice(1)); } catch { return location.hash.slice(1); }
};
const ours = (n) => n.localName == 'spy-rail' || n.localName == 'spy-band';
const relevant = (r) => r.type != 'childList' || [...r.addedNodes, ...r.removedNodes].some((n) => !ours(n));

// One set of global listeners for every instance, created lazily (so importing is free and SSR-safe).
function setup() {
  const frame = (fn) => {
    let f = 0;
    return () => (f ||= requestAnimationFrame(() => ((f = 0), fn())));
  };
  const each = (k) => frame(() => instances.forEach((i) => i[k]()));
  // capture: element scrollers (scroll does not bubble) are caught by the same listener as the window
  addEventListener('scroll', each('_s'), { capture: true, passive: true });
  addEventListener('resize', each('_r'), { passive: true });
  // The reader takes over (wheel, touch, scrolling keys): release a click's hold immediately.
  const input = (e) => (e.type != 'keydown' || /^(Page|Arrow|Home$|End$| $)/.test(e.key)) && instances.forEach((i) => i._u());
  for (const t of ['wheel', 'touchstart', 'keydown']) addEventListener(t, input, { capture: true, passive: true });
  const e = {
    motion: matchMedia('(prefers-reduced-motion: reduce)'),
    mo: new MutationObserver((rs) => rs.some(relevant) && schedule()),
    on: 0,
    t: 0,
  };
  return e;
}

// DOM watching: one MutationObserver for the document, debounced. Covers SPA route changes, late-rendered
// content, headings re-rendered by a framework, navs added/removed, and data-spy-* attribute edits.
const schedule = () => (clearTimeout(env.t), (env.t = setTimeout(sync, 40)));
const sync = () => {
  for (const i of [...instances]) i._soft();
  ctl?._scan();
  env.mo.takeRecords();
};
const watch = (doc) => {
  if (env.on) return;
  env.on = 1;
  env.mo.observe(doc.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: WATCHED });
};
// Run our own DOM writes without waking the observer (records that were already pending still count).
const quiet = (fn) => {
  const p = env.mo.takeRecords();
  fn();
  env.mo.takeRecords();
  p.some(relevant) && schedule();
};

const adopt = (root) => {
  let s = sheets.get(root);
  try {
    if (!s) (s = new (root.ownerDocument || root).defaultView.CSSStyleSheet()).replaceSync(CSS), sheets.set(root, s);
    // re-adopt if an app replaced the whole adoptedStyleSheets array
    if (!root.adoptedStyleSheets.includes(s)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, s];
  } catch {
    /* no constructable stylesheets: the plain list still spies */
  }
};

// "Getting Started!" -> "getting-started". Letters, marks and digits in any script are kept (accents
// included: "Café" -> "café"), de-duplicated against ids already in the document ("faq", "faq-2").
export const slug = (text, root = globalThis.document) => {
  const base = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}_]+/gu, '-').replace(/^-+|-+$/g, '') || 'section';
  let id = base, n = 1;
  while (root?.getElementById(id)) id = base + '-' + ++n;
  return id;
};

/**
 * Spy one nav: build its list (data-spy-build), track the section being read, mark the active link,
 * draw the marker (data-spy-marker). Returns the instance (the same one on repeated calls).
 */
export function spy(nav, o = {}) {
  if (nav[KEY]) return o.marker != null && nav[KEY].marker(o.marker), nav[KEY];
  off.delete(nav);
  const E = (env ||= setup());
  const doc = nav.ownerDocument, root = nav.getRootNode(), win = doc.defaultView;
  const el = (t) => doc.createElement(t);
  const attr = (k) => nav.getAttribute('data-spy-' + k);
  const css = (x) => win.getComputedStyle(x);
  let links = [], targets = [], passed = [], cur = -1, ready = 0, lock = 0, held = -1, heldAt = null;
  let io, list, sig, scroller = null, preset = null, forced, rail, band, k = -1, tail = 0, lastOff, labelled;
  const tabbed = new Set(), made = new Set();

  // ---- geometry of the scroller (the window, or the nearest scrollable ancestor of the content)
  const se = () => scroller || doc.scrollingElement || doc.documentElement;
  const vTop = () => (scroller ? scroller.getBoundingClientRect().top + scroller.clientTop : 0);
  const vH = () => (scroller ? scroller.clientHeight : win.innerHeight);
  const pos = () => se().scrollTop;
  const max = () => se().scrollHeight - vH();
  const findScroller = (t) => {
    for (let p = t?.parentElement; p && p != doc.body && p != doc.documentElement; p = p.parentElement)
      if (/auto|scroll|overlay/.test(css(p).overflowY) && p.scrollHeight > p.clientHeight) return p;
    return null;
  };
  // offset: data-spy-offset, else the option, else the scroller's CSS scroll-padding-top (sticky headers)
  const offset = () => num(attr('offset')) ?? num(o.offset) ?? (parseFloat(css(se()).scrollPaddingTop) || 0);

  // ---- build: a nested <ol> from the page's headings
  const label = (h) =>
    h.getAttribute('data-spy-label') ||
    [...h.childNodes].map((n) => (n.nodeType == 1 && (n.getAttribute('aria-hidden') == 'true' || n.matches('a[href^="#"]')) ? '' : n.textContent)).join('').replace(/\s+/g, ' ').trim() ||
    h.textContent.replace(/\s+/g, ' ').trim();
  const build = () => {
    let s = attr('build') ?? o.build;
    if (s == null || s === false) return;
    s ||= root.querySelector('main,[role=main]') ? 'main h2,main h3,[role=main] h2,[role=main] h3' : 'h2,h3';
    const hs = [...root.querySelectorAll(s)].filter((h) => !nav.contains(h) && !h.closest('[data-spy-ignore]') && label(h));
    const next = hs.map((h) => h.localName + '\u0001' + h.id + '\u0001' + label(h)).join('\u0002');
    if (next == sig && list?.isConnected) return;
    quiet(() => {
      list?.remove();
      const stack = [{ l: 0, ol: (list = el('ol')) }];
      for (const h of hs) {
        const l = +h.localName[1] || 7, li = el('li'), a = el('a');
        while (stack[0].l >= l) stack.shift();
        const top = stack[0];
        if (!top.ol) top.li.append((top.ol = el('ol')));
        if (!h.id) made.add((h.id = slug(label(h), root)));
        a.setAttribute('href', '#' + h.id);
        a.textContent = label(h);
        li.append(a);
        top.ol.append(li);
        stack.unshift({ l, li });
      }
      nav.insertBefore(list, rail?.parentNode == nav ? rail : null);
      sig = hs.map((h) => h.localName + '\u0001' + h.id + '\u0001' + label(h)).join('\u0002');
    });
  };

  // ---- links -> targets (same-page links only; also "/page#id" links that routers render)
  const page = (u) => u.split('#')[0];
  const collect = () => {
    const here = page(doc.URL);
    links = [];
    targets = [];
    for (const a of nav.querySelectorAll('a[href*="#"]')) {
      if (a.getAttribute('href')[0] != '#' && page(a.href) != here) continue;
      let id = a.hash.slice(1);
      try { id = decodeURIComponent(id); } catch { /* keep the raw hash */ }
      const t = id && root.getElementById(id);
      if (t && !nav.contains(t) && !targets.includes(t)) links.push(a), targets.push(t);
    }
  };

  // ---- observe: the IntersectionObserver root box runs from far above the viewport down to the
  // activation line, so a target "intersects" exactly when its top has passed the line. Every crossing
  // flips that state, so fast jumps (PageDown, End, #hash, scrollbar drags) are never missed.
  const observe = () => {
    io?.disconnect();
    passed = [];
    ready = 0;
    scroller = findScroller(targets[0]);
    const h = vH();
    lastOff = offset();
    io = new IntersectionObserver((es) => {
      for (const e of es) passed[targets.indexOf(e.target)] = e.isIntersecting;
      ready = 1;
      pick();
    }, { root: scroller, rootMargin: `99999px 0px ${lastOff + h * LINE - h}px` });
    targets.forEach((t) => io.observe(t));
    ro.disconnect();
    ro.observe(nav);
    ro.observe(doc.body);
    targets[0]?.parentElement && ro.observe(targets[0].parentElement);
    measure();
  };

  // Sections near the end that can never reach the line (too short, page ends): k = first of them.
  const measure = () => {
    const m = max(), line = offset() + vH() * LINE, b = vTop() - pos();
    k = m > 0 ? targets.findIndex((t) => t.getBoundingClientRect().top - b - line > m + 1) : -1;
    tail = k < 0 ? 0 : targets.length - k;
  };

  // Active = the last target whose top passed the line, else the first. The final stretch of scroll
  // (half a viewport) is shared out among the unreachable short sections, so each one gets its turn,
  // and the very bottom always belongs to the last section.
  const pick = () => {
    if (!ready || lock > now()) return;
    if (held >= 0) {
      if (heldAt == null) heldAt = pos();
      if (Math.abs(pos() - heldAt) < 3) return;
      held = -1;
    }
    let i = Math.max(passed.lastIndexOf(true), 0);
    if (tail) {
      const s = pos(), m = max(), D = Math.min(vH() / 2, m), p = (s - m + D) / D;
      if (p > 0) i = Math.max(i, s > 0 && s >= m - 8 ? targets.length - 1 : k - 1 + Math.min(tail, Math.floor(p * (tail + 1))));
    }
    set(i);
  };

  // ---- output: classes, aria-current, CSS variables, event
  const prop = (n, v) => nav.style.setProperty('--' + n, v); // CSSOM: CSP-safe
  const mark = () => {
    const a = links[cur];
    if (!a) return;
    const n = nav.getBoundingClientRect();
    if (!n.height) return; // hidden (e.g. a closed <details>): the ResizeObserver calls again when shown
    const top = n.top + nav.clientTop - nav.scrollTop, left = n.left + nav.clientLeft - nav.scrollLeft, r = a.getBoundingClientRect();
    // a nav that scrolls on its own keeps the active link in view
    if (nav.scrollHeight > nav.clientHeight + 1 && (r.top < n.top || r.bottom > n.bottom))
      nav.scrollTo({ top: r.top - top - (nav.clientHeight - r.height) / 2, behavior: E.motion.matches ? 'instant' : 'smooth' });
    prop('spy-y', r.top - top + 'px');
    prop('spy-h', r.height + 'px');
    prop('spy-x', r.left - left + 'px');
    prop('spy-w', r.width + 'px');
    prop('spy-progress', links.length > 1 ? +(cur / (links.length - 1)).toFixed(4) : 1);
    prop('_l', links.at(-1).getBoundingClientRect().bottom - top + 'px'); // rail length
  };
  // parent items of the active one (nested lists): li > a of every ancestor li inside the nav
  const trail = (a) => {
    const t = [];
    for (let li = a.closest('li'); (li = li?.parentElement?.closest('li')) && nav.contains(li); ) {
      const p = li.querySelector(':scope > a');
      p && t.push(p);
    }
    return t;
  };
  const flag = (on, a = links[cur]) => {
    if (!a) return;
    a.classList.toggle(ACTIVE, on);
    on ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current');
    for (const p of trail(a)) p.classList.toggle(TRAIL, on);
  };
  const set = (i) => {
    if (i == cur || !links[i]) return;
    const previous = cur;
    flag(0);
    flag(1, links[(cur = i)]);
    mark();
    nav.dispatchEvent(new win.CustomEvent('spy:change', { bubbles: true, detail: { index: i, id: targets[i].id, link: links[i], target: targets[i], previous } }));
  };

  // ---- marker: <spy-rail> (track + fill + glowing line) and <spy-band> (highlight / pill)
  const wanted = () => {
    const v = forced !== undefined ? forced : attr('marker') ?? o.marker ?? defaults.marker;
    return v == null || no(v) ? null : PRESETS[v] ? v : 'line';
  };
  const apply = (p) => {
    preset = p;
    if (!p) {
      rail?.remove();
      band?.remove();
      rail = band = null;
      return nav.removeAttribute('data-spy-on');
    }
    adopt(root);
    nav.setAttribute('data-spy-on', p);
    if (!rail) (rail = el('spy-rail')), (band = el('spy-band'));
    rail.parentNode != nav && nav.append(rail, band);
    mark();
  };

  // ---- clicks: smooth scroll (instant under reduced motion), offset, hash, focus, hold the choice
  // a scrollend from an earlier scroll can arrive after a new click: only the one that lands on this click's
  // destination releases the lock (the 3 s lock and the reader's own input still release it otherwise)
  let dest = 0;
  const sc = () => scroller || win;
  const ended = () => lock && (Math.abs(pos() - dest) > 2 ? sc().addEventListener('scrollend', ended, { once: true }) : ((lock = 0), (heldAt = pos())));
  const go = (i, behavior, silent) => {
    if (typeof i == 'string') i = targets.findIndex((t) => t.id == i);
    const t = targets[i];
    if (!t) return;
    set(i);
    const gap = Math.max(offset(), parseFloat(css(t).scrollMarginTop) || 0, parseFloat(css(se()).scrollPaddingTop) || 0);
    const y = Math.max(0, Math.min(max(), t.getBoundingClientRect().top - vTop() + pos() - gap));
    const b = behavior || (E.motion.matches ? 'instant' : 'smooth');
    held = i;
    heldAt = null;
    if (Math.abs(y - pos()) > 1) {
      // hold the clicked item while the scroll passes others: until scrollend (max 3 s), then until the reader scrolls
      dest = y;
      sc().removeEventListener('scrollend', ended);
      if (b == 'smooth') (lock = now() + 3e3), sc().addEventListener('scrollend', ended, { once: true });
      sc().scrollTo({ top: y, behavior: b });
    }
    if (b != 'smooth') heldAt = pos();
    const h = attr('hash') ?? o.hash ?? defaults.hash;
    // hash routers (#/route, #!/route) keep their URL; so does data-spy-hash="false"
    if (!silent && !no(h) && hashId() != t.id && !/^#[!/]/.test(location.hash))
      try { history.pushState(history.state, '', '#' + t.id); } catch { /* sandboxed or file:// contexts may refuse */ }
    if (silent) return;
    // move focus with the reader, so the next Tab continues from the section
    if (!t.matches('a[href],button,input,select,textarea,summary,[tabindex]')) t.setAttribute('tabindex', '-1'), tabbed.add(t);
    t.focus({ preventScroll: true });
  };
  const click = (e) => {
    const i = links.indexOf(e.target.closest?.('a'));
    if (i < 0 || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(i);
  };

  // ---- lifecycle
  const ro = new win.ResizeObserver(() => (measure(), pick(), mark()));
  const soft = () => {
    if (!nav.isConnected || (scanned.has(nav) && !nav.hasAttribute('data-spy'))) return destroy();
    build();
    const ol = links, ot = targets;
    collect();
    if (ol.length != links.length || ol.some((a, j) => a != links[j] || ot[j] != targets[j]) || offset() != lastOff) {
      flag(0, ol[cur]);
      cur = -1;
      observe();
    } else measure(), pick();
    wanted() != preset ? apply(wanted()) : preset && (adopt(root), mark());
  };
  const refresh = () => {
    build();
    collect();
    flag(0);
    cur = -1;
    observe();
    apply(wanted());
  };
  const destroy = () => {
    io?.disconnect();
    ro.disconnect();
    nav.removeEventListener('click', click);
    sc().removeEventListener('scrollend', ended);
    flag(0);
    apply(null);
    if (list) quiet(() => list.remove());
    PROPS.forEach((p) => nav.style.removeProperty('--' + p));
    nav.getAttribute('style') === '' && nav.removeAttribute('style');
    labelled && nav.removeAttribute(labelled);
    tabbed.forEach((t) => t.removeAttribute('tabindex'));
    instances.delete(api);
    delete nav[KEY];
  };

  const api = {
    nav,
    get links() { return links; },
    get targets() { return targets; },
    get index() { return cur; },
    get id() { return targets[cur]?.id ?? null; },
    go: (i, behavior) => go(i, behavior),
    refresh,
    marker(p = true) {
      forced = p;
      apply(wanted());
    },
    destroy() {
      off.add(nav);
      destroy();
    },
    _s: pick,
    _r: () => (observe(), mark()),
    _u: () => ((lock = 0), (held = -1), pick()),
    _soft: soft,
    _kill: destroy,
  };
  nav[KEY] = api;
  instances.add(api);

  // accessible name: an existing label wins; else the nav's own heading; else "On this page"
  if ((nav.localName == 'nav' || nav.getAttribute('role') == 'navigation') && !nav.hasAttribute('aria-label') && !nav.hasAttribute('aria-labelledby')) {
    const h = nav.querySelector('h1,h2,h3,h4,h5,h6');
    if (h) h.id ||= 'spy-label-' + ++uid, nav.setAttribute((labelled = 'aria-labelledby'), h.id);
    else nav.setAttribute((labelled = 'aria-label'), 'On this page');
  }
  nav.addEventListener('click', click);
  refresh();
  (o.observe ?? defaults.observe) && watch(doc);
  // a #hash for a heading that only got its id from us: the browser could not scroll there at load
  if (made.has(hashId())) go(hashId(), 'instant', 1);
  return api;
}

const NOOP = { instances: [], refresh() {}, destroy() {} };

/**
 * Spy every [data-spy] nav in the document, and keep doing it as the DOM changes (SPA routes,
 * late content, re-rendered navs). Idempotent: repeated calls return the same controller.
 * On the server (no document) it is a harmless no-op.
 */
export function init(o = {}) {
  if (typeof document == 'undefined') return NOOP;
  env ||= setup();
  if (ctl) return Object.assign(ctl._o, o), instances.forEach((i) => i._soft()), ctl._scan(), ctl;
  const opts = { ...o };
  ctl = {
    get instances() { return [...instances]; },
    refresh,
    destroy,
    _o: opts,
    _scan() {
      for (const n of (opts.root || document).querySelectorAll(SEL))
        if (!n[KEY] && !off.has(n)) scanned.add(n), spy(n, opts);
    },
  };
  (opts.observe ?? defaults.observe) && watch(document);
  ctl._scan();
  return ctl;
}

/** Re-scan and re-measure everything (after layout changes the library cannot see). */
export function refresh() {
  if (!env) return;
  instances.forEach((i) => i.refresh());
  ctl?._scan();
}

/** Stop everything: every instance is destroyed and DOM watching ends. */
export function destroy() {
  if (!env) return;
  ctl = null;
  [...instances].forEach((i) => i._kill());
  env.mo.disconnect();
  env.on = 0;
  clearTimeout(env.t);
}
