# Chapterize JS: Project Goals and Context

> **North star: be the best and most modern way to automatically add a table of contents to a preexisting page DOM.**
>
> Modern platform features first (IntersectionObserver, `scrollend`, `adoptedStyleSheets` + `@layer`, CSS
> scroll-driven animations, and native `scroll-target-group` / `:target-current` as progressive enhancement), each
> with a fallback. Works in every framework and on plain sites. Core < 5 KB gzip (soft limit; always report the number).

Read this before changing anything. `AGENTS.md` is the short version; `.cursor/rules/*.mdc` are the always-on rules.
This is the library repo (`chapterize-js`); the website is the sibling repo `chapterize-js-site` (its own `AGENTS.md`, `docs/SITE.md`).

## 1. Summary

A zero-dependency library that turns `<nav data-chapter data-chapter-build>` into a nested table of contents built from
the page's existing headings (missing ids generated), highlights the section being read (`.is-active`,
`aria-current="location"`, `chapter:change`), scrolls correctly under sticky headers, and, opt-in, draws a gliding
marker. Positioning: **the accessible, attribute-only Tocbot alternative**. Gumshoe users (abandoned since 2019)
are the easiest first audience: same "data attribute + nav" mental model, plus TOC generation.

## 2. Owner and family

Byron Johnson. Family style shared with Ghost Reveal, LiteLight, ShuttersJS, HeightHarmony: tiny, no deps,
HTML attributes, built-in accessibility, `llms.txt`, a distinctive one-page-plus site on Vercel.

## 3. Name

**Chapterize JS**: npm package `chapterize-js` (package.json `name`, the import specifier), display name
**Chapterize JS** (titles, prose, OG/meta), script-tag global **`Chapterize`**, repo placeholder
`github.com/byronjohnson/chapterize-js`. Named 2026-10-23 (see the decisions log); the working name until then was
`scrollspy`. The name is centralized (package.json + `scripts/brand.mjs`); see "Renaming" in `AGENTS.md`. The public names use `chapter`: attributes `data-chapter*`, custom properties `--chapter-*`, event `chapter:change`, layer `@layer chapter`, marker elements `chapter-rail` and `chapter-band`. The method that watches one nav is `chapterjs()`. Classes stay `.is-active` and `.is-trail`.

## 4. Goals

1. **Simpler than Tocbot.** Attributes only, zero JS config, auto ids, works on markup you don't control.
2. **Zero dependencies, small.** Core min+gzip < 5 KB soft limit. Now: `index.min.js` 5,037 B, `global.min.js` 5,333 B (`npm run build`, 2026-10-28). The earlier split (≈4.28 KB without the 2.1 KB raw / ≈0.74 KB gzip inlined marker CSS) was measured 2026-10-23 and was not remeasured.
3. **The most beautiful TOC.** Built-in, opt-in gliding marker with three presets (`line`, `pill`, `minimal`),
   themed entirely with CSS custom properties; transitions only under `prefers-reduced-motion: no-preference`.
4. **Accessibility first.** `aria-current="location"`, automatic `aria-label` / `aria-labelledby`, focus moves to
   the section on click (temporary `tabindex=-1`, removed on destroy), reduced motion = instant jumps, no
   keyboard traps, works without JS (plain anchor links).
5. **Correctness where others break.** Last section and short final sections each get a turn; offsets read from
   `scroll-padding-top` by default; the first click works; CSS `scroll-behavior: smooth` doesn't fight the
   library; clicked item held during smooth scroll (no flicker), released by reader input; hash routers left alone.
6. **Every framework and plain sites.** SSR-safe import, auto-init + MutationObserver (route changes, re-renders,
   late content), idempotent `init()`, `destroy()` / `refresh()`, recipes for 13 stacks, SPA tests in 3 engines.

## 5. Non-goals

- No framework adapters/components in the package (recipes instead; one DOM library for all).
- No scroll listener polling, no layout thrashing per scroll frame, no CSS file to load.
- No headings parser for Markdown/HTML strings; it works on the live DOM only.
- No horizontal / carousel scroll markers (native `scroll-marker-group` territory).
- No IE / pre-2023 browsers: IntersectionObserver is required (all supported engines have it).
- No framework (Next.js, Astro, …) for the project website: static HTML + the library, ~5 KB of JS.

## 6. Competition (Byron's research, 2026-10-23)

| Project | Notes |
| --- | --- |
| **Tocbot** | ~399k downloads/week. 4.3 KB gzip JS + a CSS file. Scroll listener. No `aria-current`, no reduced-motion handling. Needs ids on headings; configured in JS. Known offset, first-click and CSS smooth-scroll bugs. The main target. |
| **Gumshoe** | ~3.7k/week. Abandoned since 2019-07. Spy only, no TOC build. Easiest audience to win. |
| **Bootstrap ScrollSpy** | Last-section bugs only fixed in 6.0 alpha; no `aria-current`; no TOC build; needs Bootstrap. |
| **@zag-js/toc** | Framework adapters only; has a CSS-var indicator; no TOC generation. |
| **Native `scroll-target-group`** | Chrome 140+ only (`:target-current`); was rejected for Interop 2026. No events, no geometry, no TOC build. See `docs/ROADMAP.md`. |

## 7. Design principles

- Read the DOM, don't own it: generate only the `<ol>` inside the nav; restore everything on `destroy()`.
- One IntersectionObserver per nav, rootMargin puts the activation line at offset + 25% of the viewport.
- CSP-safe by construction: CSSOM only (`adoptedStyleSheets`, `style.setProperty`).
- `@layer chapter` so any author rule wins; every visual is a custom property.
- Each modern feature has a fallback; the fallback must still be correct, just less fancy.

## 8. Site goals

Dark, editorial homepage that is itself the demo (the left rail TOC with the gliding marker, section counters,
reading progress via scroll-driven animation with a JS fallback). Pages: `/` (docs), `/frameworks` (generated from
README), `/markers` (live presets), `/plain` (the unstyled plain-HTML example using the global build), `/404`.
Lives in the separate repo `chapterize-js-site` (see the 2026-10-23 split below). Static HTML on Vercel (`site/` → `site-dist/`), ~5 KB of site JS, no framework. Clean URLs (`/frameworks`, never
`.html`), CSP `script-src 'self'; style-src 'self'`, hashed assets, sitemap, Lighthouse 100 across the board. No
images or webfonts.

## 9. Design taste (Byron's preferences)

- Modern, distinctive, editorial; no icon-above-title card grids, no generic SaaS template look.
- Effects add no load weight: CSS gradients, custom properties, no images, no fonts, no extra JS.
- Motion is purposeful (the marker glides; nothing else wiggles) and disappears under reduced motion.
- No docs files in the npm package (`files: [dist, types]`).
- Live reload for everything visual (`npm run dev`).
- **No framework for the demo site.** It must stay as light as the library's pitch (Next.js was tried and rejected, 2026-10-23).

## 10. Decisions log

### 2026-10-23

- **Project approved** (from the scrollspy-demo prototype). Lived in `/workspace/scrollspy` (now
  `/workspace/chapterize-js`); the demo and `/workspace/ghost-reveal` stay untouched.
- **Named Chapterize JS** (2026-10-23, Byron). npm package **`chapterize-js`**, display "Chapterize JS" everywhere,
  script-tag global `Chapterize`, repo placeholder `github.com/byronjohnson/chapterize-js`. The working name
  `scrollspy` was taken on npm. Bare `chapterize` was briefly published and then unpublished
  (npm reports "Unpublished on 2025-07-25"), so `chapterize-js` was chosen for clarity and to avoid confusion
  with that package (it was a 404 / free on npm when checked on 2026-10-23). Unchanged by the rename (they describe
  behavior, not the brand): `data-spy*` attributes, `.is-active` / `.is-trail`, `spy:change`, `--spy-*` variables
  and `@layer spy` (no layer ever carried the project name, so there was nothing to rename to `@layer chapterize`).
  The global build files stay `dist/global.js` / `dist/global.min.js` (no name in the filename). Box folder renamed
  to `/workspace/chapterize-js`; the domain / `SITE_URL` is still open.
- **< 5 KB gzip soft budget** for the core (report the number; don't silently exceed it).
- **Framework compatibility is the headline**: SSR-safe, auto-init, DOM watching on by default, idempotent init, auto-destroy when a nav leaves the DOM.
- **Marker built in and opt-in** (`data-spy-marker`), presets `line` / `pill` / `minimal`.
- **IntersectionObserver** for activation (no scroll listener for activation; `scroll` only for marker progress).
- Default offset = the scroller's `scroll-padding-top` (one source of truth with CSS); `data-spy-offset` overrides.
- Slugs keep accents (`café-crème`); duplicates get `-2`, `-3`.
- Hash routes (`#/…`, `#!…`) are detected: no `pushState`, the click still scrolls.
- Native `scroll-target-group` **not adopted** yet (Chromium-only; see ROADMAP). CSS scroll-driven animations used on the site only (Firefox lacks them by default; JS fallback).
- `/frameworks` is generated from README `## Frameworks`, so docs and site can't drift.
- A stale `scrollend` from an earlier scroll must not release a new click's hold (fixed + tested).
- **2026-10-23: Next.js App Router version of the site was built and measured; Byron chose to keep the
  zero-dependency static site.** The Next 16 build (all routes prerendered, two client islands) cost ~141 KB vs 5.5 KB
  gzip JS per page, mobile LCP ~2.1 s vs 0.93 s (Lighthouse perf 98–99 vs 100) and needed a relaxed CSP
  (`script-src 'unsafe-inline'` for the inline RSC payload; nonces would force dynamic rendering). Desktop,
  a11y / best practices / SEO and CLS tied. `web/` was removed. Next compatibility is proven by the tests (SPA DOM
  churn, SSR) + the README Next.js recipe instead, which was rewritten and verified in a real Next 16 app (TOC builds
  and rebuilds after `next/link` navigation in Chromium, Firefox, WebKit). Kept from that work: the Copy buttons'
  screen-reader live region (`#copy-live`). Pages stay on clean URLs (`/frameworks`, no `.html`), tested.
- **2026-10-23: library and website split into two repos** (Byron: "like we did with GhostReveal", for separate git
  tracking). Mirrors `ghost-reveal` / `ghost-reveal-site`: sibling folders **`chapterize-js`** (this repo: `src`, `dist`,
  `types`, the library build, library tests spy/spa/ssr/docs + types, README, LICENSE, llms.txt, AGENTS.md, library
  rules/skills, PROJECT-GOALS, ROADMAP; no site files, no `vercel.json`) and **`chapterize-js-site`** (`site/`,
  build-site/serve/dev/screens, `vercel.json`, site + dev tests, `docs/SITE.md`, its own AGENTS.md/README/rules/skills,
  `private: true`). Like ghost-reveal-site, the site finds the library through `scripts/lib-root.mjs`
  (`$CHAPTERIZE_ROOT` → sibling `../chapterize-js` → `node_modules/chapterize-js` → committed `vendor/chapterize-js`).
  Difference from Ghost Reveal: ghost-reveal is on npm, so its site installs it; `chapterize-js` is not published,
  so every site build copies the library's `dist/`, `types/`, `src/`, README, llms.txt, package.json and LICENSE into
  the site's committed `vendor/chapterize-js/` (`scripts/sync-lib.mjs`) and Vercel builds from that snapshot. `/frameworks`
  reads `../chapterize-js/README.md` when present, else the vendored copy; a site test fails if the snapshot drifts from the
  checkout. Once published, the site can add `"chapterize-js"` as a dependency (lib-root already prefers it over `vendor/`).
  Test count 27 → 29 (library 18: the docs-accuracy checks for README/llms/types became their own library test; site 11:
  + a vendor drift test).

### 2026-10-28

- **Attributes and CSS variables renamed from `spy` to `chapter`** (Byron). `data-spy*` is now `data-chapter*` (`data-chapter`, `data-chapter-build`, `data-chapter-marker`, `data-chapter-offset`, `data-chapter-hash`, `data-chapter-label`, `data-chapter-ignore`, and the runtime `data-chapter-on`). `--spy-*` is now `--chapter-*`. This supersedes the 2026-10-23 decision that those names stayed `spy` because they described behavior.
- **The rest of the `spy` names renamed the same day** (Byron). `spy()` is now `chapterjs()`. `spy:change` is `chapter:change`. `@layer spy` is `@layer chapter`. `<spy-rail>` and `<spy-band>` are `<chapter-rail>` and `<chapter-band>`. Exported types are `ChapterOptions`, `ChapterInstance`, `ChapterController`, `ChapterMarker`, and `ChapterChangeDetail`. Unchanged: `.is-active` / `.is-trail`, and the category words "scroll spy" / `scroll-spy` in the package description and keywords.

## 11. Open questions for Byron

1. Domain / `SITE_URL` (default `https://chapterize-js.vercel.app`, derived from the npm name, until a domain is chosen).
2. Create the two GitHub repos (placeholder `github.com/byronjohnson/chapterize-js` is already in package.json, README, llms.txt;
   the site repo name, e.g. `byronjohnson/chapterize-js-site`, is up to Byron).
3. OG image (none yet; text-only cards).
4. Whether the marker CSS (≈0.74 KB gzip) should move to an opt-in entry (`/marker`) if the core needs headroom.

## 12. Known limitations

- IntersectionObserver has no fallback (every supported browser has it).
- WebKit: if reduced motion is switched on mid-glide, the running transition finishes (new moves are instant).
- Navs/headings inside a shadow root: use `chapterjs(nav)` and call `refresh()` after changes (the MutationObserver watches the document, not shadow trees).
- No `scrollend` (older Safari): the click hold ends after a 3 s timer or on reader input.
