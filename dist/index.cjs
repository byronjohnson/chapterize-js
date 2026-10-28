/*! chapterize-js v0.1.0 | MIT */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.js
var index_exports = {};
__export(index_exports, {
  chapterjs: () => chapterjs,
  defaults: () => defaults,
  destroy: () => destroy,
  init: () => init,
  refresh: () => refresh,
  slug: () => slug,
  version: () => version
});
module.exports = __toCommonJS(index_exports);

// src/marker.css
var marker_default = '@layer chapter{[data-chapter-on]{--_c:var(--chapter-color,#8b7cf6);--_c2:var(--chapter-color-2,var(--_c));--_w:var(--chapter-width,2px);--_t:var(--chapter-duration,.6s) var(--chapter-ease,cubic-bezier(.16,1,.3,1));position:relative;isolation:isolate;padding-left:calc(var(--_w) + 1em)}[data-chapter-on] :is(ol,ul){list-style:none;margin:0;padding:0}[data-chapter-on] li li{padding-left:var(--chapter-indent,1em)}[data-chapter-on] li li a{font-size:.94em}[data-chapter-on] a{display:block;padding:.3em 0;color:inherit;text-decoration:none;opacity:.62}[data-chapter-on] :is(a:hover,.is-trail){opacity:.85}[data-chapter-on] .is-active{opacity:1}chapter-rail,chapter-band{position:absolute;left:0;top:0;pointer-events:none}chapter-rail{width:var(--_w);height:var(--_l);background:linear-gradient(#0000,color-mix(in srgb,var(--_c) 70%,#0000)) 50% 0 / 1px calc(var(--chapter-y) + var(--chapter-h)) no-repeat,linear-gradient(var(--chapter-rail,color-mix(in srgb,currentColor 16%,#0000)) 0 0) 50% 0 / 1px 100% no-repeat}chapter-rail:after{content:"";position:absolute;inset:0 0 auto;height:var(--chapter-h);translate:0 var(--chapter-y);border-radius:9px;background:linear-gradient(var(--_c),var(--_c2));box-shadow:var(--chapter-glow,0 0 12px color-mix(in srgb,var(--_c) 80%,#0000))}chapter-band{z-index:-1;right:0;height:var(--chapter-h);translate:0 var(--chapter-y);border-radius:0 .5em .5em 0;background:var(--chapter-band,linear-gradient(90deg,color-mix(in srgb,var(--_c) 15%,#0000),#0000 80%))}[data-chapter-on=pill]{padding-left:0}[data-chapter-on=pill] a{padding:.35em .75em}[data-chapter-on=pill] chapter-rail{display:none}[data-chapter-on=pill] chapter-band{width:var(--chapter-w);translate:var(--chapter-x) var(--chapter-y);border-radius:var(--chapter-radius,.55em);background:var(--chapter-band,color-mix(in srgb,var(--_c) 14%,#0000));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--_c) 26%,#0000)}[data-chapter-on=minimal] chapter-band{display:none}[data-chapter-on=minimal] chapter-rail{background:none}[data-chapter-on=minimal] chapter-rail:after{box-shadow:none;background:var(--_c)}@media(prefers-reduced-motion:no-preference){[data-chapter-on] a{transition:opacity .25s}chapter-rail{transition:background-size var(--_t)}chapter-rail:after,chapter-band{transition:translate var(--_t),height var(--_t),width var(--_t)}}}';

// src/index.js
var version = "0.1.0";
var defaults = { marker: false, hash: true, observe: true };
var SEL = "[data-chapter]";
var KEY = /* @__PURE__ */ Symbol.for("data-chapter");
var ACTIVE = "is-active";
var TRAIL = "is-trail";
var PRESETS = { line: 1, pill: 1, minimal: 1 };
var LINE = 0.25;
var WATCHED = ["id", "href", "data-chapter", "data-chapter-build", "data-chapter-offset", "data-chapter-marker", "data-chapter-hash", "data-chapter-label", "data-chapter-ignore"];
var PROPS = ["chapter-y", "chapter-h", "chapter-x", "chapter-w", "chapter-progress", "_l"];
var instances = /* @__PURE__ */ new Set();
var off = /* @__PURE__ */ new WeakSet();
var scanned = /* @__PURE__ */ new WeakSet();
var sheets = /* @__PURE__ */ new WeakMap();
var env = null;
var ctl = null;
var uid = 0;
var now = () => performance.now();
var num = (v) => v == null || v === "" || isNaN(v) ? null : +v;
var no = (v) => v === false || v === "false" || v === "none";
var hashId = () => {
  try {
    return decodeURIComponent(location.hash.slice(1));
  } catch {
    return location.hash.slice(1);
  }
};
var ours = (n) => n.localName == "chapter-rail" || n.localName == "chapter-band";
var relevant = (r) => r.type != "childList" || [...r.addedNodes, ...r.removedNodes].some((n) => !ours(n));
function setup() {
  const frame = (fn) => {
    let f = 0;
    return () => f ||= requestAnimationFrame(() => (f = 0, fn()));
  };
  const each = (k) => frame(() => instances.forEach((i) => i[k]()));
  addEventListener("scroll", each("_s"), { capture: true, passive: true });
  addEventListener("resize", each("_r"), { passive: true });
  const input = (e2) => (e2.type != "keydown" || /^(Page|Arrow|Home$|End$| $)/.test(e2.key)) && instances.forEach((i) => i._u());
  for (const t of ["wheel", "touchstart", "keydown"]) addEventListener(t, input, { capture: true, passive: true });
  const e = {
    motion: matchMedia("(prefers-reduced-motion: reduce)"),
    mo: new MutationObserver((rs) => rs.some(relevant) && schedule()),
    on: 0,
    t: 0
  };
  return e;
}
var schedule = () => (clearTimeout(env.t), env.t = setTimeout(sync, 40));
var sync = () => {
  for (const i of [...instances]) i._soft();
  ctl?._scan();
  env.mo.takeRecords();
};
var watch = (doc) => {
  if (env.on) return;
  env.on = 1;
  env.mo.observe(doc.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: WATCHED });
};
var quiet = (fn) => {
  const p = env.mo.takeRecords();
  fn();
  env.mo.takeRecords();
  p.some(relevant) && schedule();
};
var adopt = (root) => {
  let s = sheets.get(root);
  try {
    if (!s) (s = new (root.ownerDocument || root).defaultView.CSSStyleSheet()).replaceSync(marker_default), sheets.set(root, s);
    if (!root.adoptedStyleSheets.includes(s)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, s];
  } catch {
  }
};
var slug = (text, root = globalThis.document) => {
  const base = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}_]+/gu, "-").replace(/^-+|-+$/g, "") || "section";
  let id = base, n = 1;
  while (root?.getElementById(id)) id = base + "-" + ++n;
  return id;
};
function chapterjs(nav, o = {}) {
  if (nav[KEY]) return o.marker != null && nav[KEY].marker(o.marker), nav[KEY];
  off.delete(nav);
  const E = env ||= setup();
  const doc = nav.ownerDocument, root = nav.getRootNode(), win = doc.defaultView;
  const el = (t) => doc.createElement(t);
  const attr = (k2) => nav.getAttribute("data-chapter-" + k2);
  const css = (x) => win.getComputedStyle(x);
  let links = [], targets = [], passed = [], cur = -1, ready = 0, lock = 0, held = -1, heldAt = null;
  let io, list, sig, scroller = null, preset = null, forced, rail, band, k = -1, tail = 0, lastOff, labelled;
  const tabbed = /* @__PURE__ */ new Set(), made = /* @__PURE__ */ new Set();
  const se = () => scroller || doc.scrollingElement || doc.documentElement;
  const vTop = () => scroller ? scroller.getBoundingClientRect().top + scroller.clientTop : 0;
  const vH = () => scroller ? scroller.clientHeight : win.innerHeight;
  const pos = () => se().scrollTop;
  const max = () => se().scrollHeight - vH();
  const findScroller = (t) => {
    for (let p = t?.parentElement; p && p != doc.body && p != doc.documentElement; p = p.parentElement)
      if (/auto|scroll|overlay/.test(css(p).overflowY) && p.scrollHeight > p.clientHeight) return p;
    return null;
  };
  const offset = () => num(attr("offset")) ?? num(o.offset) ?? (parseFloat(css(se()).scrollPaddingTop) || 0);
  const label = (h) => h.getAttribute("data-chapter-label") || [...h.childNodes].map((n) => n.nodeType == 1 && (n.getAttribute("aria-hidden") == "true" || n.matches('a[href^="#"]')) ? "" : n.textContent).join("").replace(/\s+/g, " ").trim() || h.textContent.replace(/\s+/g, " ").trim();
  const build = () => {
    let s = attr("build") ?? o.build;
    if (s == null || s === false) return;
    s ||= root.querySelector("main,[role=main]") ? "main h2,main h3,[role=main] h2,[role=main] h3" : "h2,h3";
    const hs = [...root.querySelectorAll(s)].filter((h) => !nav.contains(h) && !h.closest("[data-chapter-ignore]") && label(h));
    const next = hs.map((h) => h.localName + "" + h.id + "" + label(h)).join("");
    if (next == sig && list?.isConnected) return;
    quiet(() => {
      list?.remove();
      const stack = [{ l: 0, ol: list = el("ol") }];
      for (const h of hs) {
        const l = +h.localName[1] || 7, li = el("li"), a = el("a");
        while (stack[0].l >= l) stack.shift();
        const top = stack[0];
        if (!top.ol) top.li.append(top.ol = el("ol"));
        if (!h.id) made.add(h.id = slug(label(h), root));
        a.setAttribute("href", "#" + h.id);
        a.textContent = label(h);
        li.append(a);
        top.ol.append(li);
        stack.unshift({ l, li });
      }
      nav.insertBefore(list, rail?.parentNode == nav ? rail : null);
      sig = hs.map((h) => h.localName + "" + h.id + "" + label(h)).join("");
    });
  };
  const page = (u) => u.split("#")[0];
  const collect = () => {
    const here = page(doc.URL);
    links = [];
    targets = [];
    for (const a of nav.querySelectorAll('a[href*="#"]')) {
      if (a.getAttribute("href")[0] != "#" && page(a.href) != here) continue;
      let id = a.hash.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
      }
      const t = id && root.getElementById(id);
      if (t && !nav.contains(t) && !targets.includes(t)) links.push(a), targets.push(t);
    }
  };
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
  const measure = () => {
    const m = max(), line = offset() + vH() * LINE, b = vTop() - pos();
    k = m > 0 ? targets.findIndex((t) => t.getBoundingClientRect().top - b - line > m + 1) : -1;
    tail = k < 0 ? 0 : targets.length - k;
  };
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
  const prop = (n, v) => nav.style.setProperty("--" + n, v);
  const mark = () => {
    const a = links[cur];
    if (!a) return;
    const n = nav.getBoundingClientRect();
    if (!n.height) return;
    const top = n.top + nav.clientTop - nav.scrollTop, left = n.left + nav.clientLeft - nav.scrollLeft, r = a.getBoundingClientRect();
    if (nav.scrollHeight > nav.clientHeight + 1 && (r.top < n.top || r.bottom > n.bottom))
      nav.scrollTo({ top: r.top - top - (nav.clientHeight - r.height) / 2, behavior: E.motion.matches ? "instant" : "smooth" });
    prop("chapter-y", r.top - top + "px");
    prop("chapter-h", r.height + "px");
    prop("chapter-x", r.left - left + "px");
    prop("chapter-w", r.width + "px");
    prop("chapter-progress", links.length > 1 ? +(cur / (links.length - 1)).toFixed(4) : 1);
    prop("_l", links.at(-1).getBoundingClientRect().bottom - top + "px");
  };
  const trail = (a) => {
    const t = [];
    for (let li = a.closest("li"); (li = li?.parentElement?.closest("li")) && nav.contains(li); ) {
      const p = li.querySelector(":scope > a");
      p && t.push(p);
    }
    return t;
  };
  const flag = (on, a = links[cur]) => {
    if (!a) return;
    a.classList.toggle(ACTIVE, on);
    on ? a.setAttribute("aria-current", "location") : a.removeAttribute("aria-current");
    for (const p of trail(a)) p.classList.toggle(TRAIL, on);
  };
  const set = (i) => {
    if (i == cur || !links[i]) return;
    const previous = cur;
    flag(0);
    flag(1, links[cur = i]);
    mark();
    nav.dispatchEvent(new win.CustomEvent("chapter:change", { bubbles: true, detail: { index: i, id: targets[i].id, link: links[i], target: targets[i], previous } }));
  };
  const wanted = () => {
    const v = forced !== void 0 ? forced : attr("marker") ?? o.marker ?? defaults.marker;
    return v == null || no(v) ? null : PRESETS[v] ? v : "line";
  };
  const apply = (p) => {
    preset = p;
    if (!p) {
      rail?.remove();
      band?.remove();
      rail = band = null;
      return nav.removeAttribute("data-chapter-on");
    }
    adopt(root);
    nav.setAttribute("data-chapter-on", p);
    if (!rail) rail = el("chapter-rail"), band = el("chapter-band");
    rail.parentNode != nav && nav.append(rail, band);
    mark();
  };
  let dest = 0;
  const sc = () => scroller || win;
  const ended = () => lock && (Math.abs(pos() - dest) > 2 ? sc().addEventListener("scrollend", ended, { once: true }) : (lock = 0, heldAt = pos()));
  const go = (i, behavior, silent) => {
    if (typeof i == "string") i = targets.findIndex((t2) => t2.id == i);
    const t = targets[i];
    if (!t) return;
    set(i);
    const gap = Math.max(offset(), parseFloat(css(t).scrollMarginTop) || 0, parseFloat(css(se()).scrollPaddingTop) || 0);
    const y = Math.max(0, Math.min(max(), t.getBoundingClientRect().top - vTop() + pos() - gap));
    const b = behavior || (E.motion.matches ? "instant" : "smooth");
    held = i;
    heldAt = null;
    if (Math.abs(y - pos()) > 1) {
      dest = y;
      sc().removeEventListener("scrollend", ended);
      if (b == "smooth") lock = now() + 3e3, sc().addEventListener("scrollend", ended, { once: true });
      sc().scrollTo({ top: y, behavior: b });
    }
    if (b != "smooth") heldAt = pos();
    const h = attr("hash") ?? o.hash ?? defaults.hash;
    if (!silent && !no(h) && hashId() != t.id && !/^#[!/]/.test(location.hash))
      try {
        history.pushState(history.state, "", "#" + t.id);
      } catch {
      }
    if (silent) return;
    if (!t.matches("a[href],button,input,select,textarea,summary,[tabindex]")) t.setAttribute("tabindex", "-1"), tabbed.add(t);
    t.focus({ preventScroll: true });
  };
  const click = (e) => {
    const i = links.indexOf(e.target.closest?.("a"));
    if (i < 0 || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(i);
  };
  const ro = new win.ResizeObserver(() => (measure(), pick(), mark()));
  const soft = () => {
    if (!nav.isConnected || scanned.has(nav) && !nav.hasAttribute("data-chapter")) return destroy2();
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
  const refresh2 = () => {
    build();
    collect();
    flag(0);
    cur = -1;
    observe();
    apply(wanted());
  };
  const destroy2 = () => {
    io?.disconnect();
    ro.disconnect();
    nav.removeEventListener("click", click);
    sc().removeEventListener("scrollend", ended);
    flag(0);
    apply(null);
    if (list) quiet(() => list.remove());
    PROPS.forEach((p) => nav.style.removeProperty("--" + p));
    nav.getAttribute("style") === "" && nav.removeAttribute("style");
    labelled && nav.removeAttribute(labelled);
    tabbed.forEach((t) => t.removeAttribute("tabindex"));
    instances.delete(api);
    delete nav[KEY];
  };
  const api = {
    nav,
    get links() {
      return links;
    },
    get targets() {
      return targets;
    },
    get index() {
      return cur;
    },
    get id() {
      return targets[cur]?.id ?? null;
    },
    go: (i, behavior) => go(i, behavior),
    refresh: refresh2,
    marker(p = true) {
      forced = p;
      apply(wanted());
    },
    destroy() {
      off.add(nav);
      destroy2();
    },
    _s: pick,
    _r: () => (observe(), mark()),
    _u: () => (lock = 0, held = -1, pick()),
    _soft: soft,
    _kill: destroy2
  };
  nav[KEY] = api;
  instances.add(api);
  if ((nav.localName == "nav" || nav.getAttribute("role") == "navigation") && !nav.hasAttribute("aria-label") && !nav.hasAttribute("aria-labelledby")) {
    const h = nav.querySelector("h1,h2,h3,h4,h5,h6");
    if (h) h.id ||= "chapter-label-" + ++uid, nav.setAttribute(labelled = "aria-labelledby", h.id);
    else nav.setAttribute(labelled = "aria-label", "On this page");
  }
  nav.addEventListener("click", click);
  refresh2();
  (o.observe ?? defaults.observe) && watch(doc);
  if (made.has(hashId())) go(hashId(), "instant", 1);
  return api;
}
var NOOP = { instances: [], refresh() {
}, destroy() {
} };
function init(o = {}) {
  if (typeof document == "undefined") return NOOP;
  env ||= setup();
  if (ctl) return Object.assign(ctl._o, o), instances.forEach((i) => i._soft()), ctl._scan(), ctl;
  const opts = { ...o };
  ctl = {
    get instances() {
      return [...instances];
    },
    refresh,
    destroy,
    _o: opts,
    _scan() {
      for (const n of (opts.root || document).querySelectorAll(SEL))
        if (!n[KEY] && !off.has(n)) scanned.add(n), chapterjs(n, opts);
    }
  };
  (opts.observe ?? defaults.observe) && watch(document);
  ctl._scan();
  return ctl;
}
function refresh() {
  if (!env) return;
  instances.forEach((i) => i.refresh());
  ctl?._scan();
}
function destroy() {
  if (!env) return;
  ctl = null;
  [...instances].forEach((i) => i._kill());
  env.mo.disconnect();
  env.on = 0;
  clearTimeout(env.t);
}
