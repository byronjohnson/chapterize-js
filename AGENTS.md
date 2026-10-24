# AGENTS.md: Chapterize JS

> **North star: be the best and most modern way to automatically add a table of contents to a preexisting page DOM.**

Onboarding for AI agents (Cursor, Codex, Claude Code, etc.). Short on purpose; the full context is in
[`docs/PROJECT-GOALS.md`](docs/PROJECT-GOALS.md). Cursor also loads `.cursor/rules/*.mdc` and `.cursor/skills/*/SKILL.md`.

## What it is

A zero-dependency table-of-contents + scrollspy library by Byron Johnson. One attribute on a `<nav>`
(`data-spy`, `data-spy-build`, `data-spy-marker`) builds a nested outline from the page's headings (ids generated),
tracks the section being read with IntersectionObserver, marks it with `.is-active` + `aria-current="location"`,
and optionally draws a gliding marker from a constructed stylesheet (CSP-safe, `@layer spy`).
Positioning: **the accessible, attribute-only Tocbot alternative** (Gumshoe users are the easy first audience).
Name: **Chapterize JS** (npm `chapterize-js`, script-tag global `Chapterize`; named 2026-10-23, see the decisions log).
v0.1.0, **unpublished**, no git repo yet (Byron does git).
The npm `files` allowlist is `dist` + `types` only (Byron: no docs files in the package).

## Goals (never regress one to help another)

1. **Simpler than Tocbot:** attributes only, zero JS config, auto ids, works on any existing page.
2. **Tiny, zero deps:** core `dist/index.min.js` < **5 KB gzip soft limit** (now 5,022 B with the `chapterize-js` banner; ≈4.28 KB without the inlined marker CSS). Report the number on every `src/` change.
3. **Most beautiful:** the built-in, opt-in gliding marker (`line` | `pill` | `minimal`).
4. **Accessibility first:** `aria-current`, auto `aria-label`, focus moves to the section, reduced motion = instant.
5. **Correct where others break:** last + short final sections, sticky offsets, first click, CSS `scroll-behavior: smooth`, hash routers.
6. **Every framework + plain sites:** SSR-safe import, auto-init + MutationObserver, idempotent, tested SPA behavior.

## Commands

| Command | What it does |
| --- | --- |
| `npm run build` | library → `dist/` (ESM, CJS, IIFE global, minified; prints raw + gzip sizes) |
| `npm run size` | gzip -9 size of every `dist/*.js` |
| `npm test` | build + all library tests in Chromium (system Chrome) |
| `npm run test:all` | Chromium, Firefox, WebKit. Must be green before you report |
| `npm run test:types` | TypeScript check of `types/` (`test/types`) |
| `npm run serve` | serves this repo on :8080 for poking at the test fixtures (`/test/fixtures/basic.html`) |

Before a full run: `pkill -f "scripts/(serve|dev).mjs"; fuser -k 8080/tcp`.

## Two repos: this library and the website

This repo is **only the library** that goes to GitHub (`byronjohnson/chapterize-js`) and npm (`chapterize-js`). The
website is the sibling repo **`chapterize-js-site`** (split on 2026-10-23, the same way as `ghost-reveal` /
`ghost-reveal-site`). Check them out next to each other:

```
projects/
  chapterize-js/        this library (src, dist, types, README, llms.txt)
  chapterize-js-site/   the website (site/, build + dev server, vercel.json, site tests, docs/SITE.md)
```

The site reads this checkout through its `scripts/lib-root.mjs` (`../chapterize-js`, or `$CHAPTERIZE_ROOT`):
`dist/` (bundled into the pages and served at `/dist`), `README.md` `## Frameworks` (rendered as `/frameworks`),
`llms.txt` (served at `/llms.txt`), `package.json` (the name), `src/` + `types/` (its docs-accuracy test). Each site build
copies those into the site repo's committed `vendor/chapterize-js/`, which is what Vercel builds from (this package
is not on npm yet). `npm run dev` there watches this repo's `src/`, `README.md`, `llms.txt`, `types/` and `package.json`
and runs this repo's `npm run build` on a `src/` change. After a library change that the site shows, run the site's
`npm test` (it re-syncs and checks the snapshot) and commit `vendor/` there too.

## Layout

```
src/            index.js (core), auto.js (auto-init entry), global.js (IIFE window global), marker.css (inlined at build)
types/          index.d.ts, auto.d.ts (hand-written; test/docs.test.mjs checks them against the runtime exports)
dist/           built bundles (generated, committed; shipped to npm; the site vendors them)
scripts/        brand.mjs (THE name), build.mjs, serve.mjs (test server)
test/           spy (core behavior), spa (framework/SPA DOM churn), ssr (+ package exports), docs (README/llms/types accuracy);
                fixtures/ (the test pages, served with a strict CSP); types/
docs/           PROJECT-GOALS.md, ROADMAP.md (native CSS)
README.md, llms.txt   user docs + compact agent reference (keep in sync; README "## Frameworks" feeds the site's /frameworks)
```

Generated, never edit: `dist/`. The site guide (pages, clean URLs, Vercel) is `docs/SITE.md` in `chapterize-js-site`.

## Invariants

- Zero runtime deps, no CSS file, no framework code in the library. Without JS the page and its links still work.
- Importing never touches `window`/`document`; `init()` on the server is a no-op; `slug()` works on the server.
- CSP: the library never injects `<style>` or `style=""` strings; styles go through CSSOM (`adoptedStyleSheets`,
  `style.setProperty`). The site (in `chapterize-js-site`) runs under `script-src 'self'; style-src 'self'`.
- `data-spy*` attributes, `.is-active` / `.is-trail`, `spy:change`, `--spy-*` variables and `@layer spy` are
  independent of the project name and frozen unless Byron says otherwise.
- Every modern feature has a fallback (see README "Browser support"); never require one that isn't in all three engines.
- API change ⇒ update `src/`, `types/`, README, `llms.txt` and tests here (`test/docs.test.mjs` checks drift), then the
  homepage attributes/API and `/markers` CSS variables in `chapterize-js-site` (its docs test checks them against this repo).

## Renaming (if the name ever changes again)

The name lives in `package.json`: `name` (npm + import specifier), `displayName` (prose, titles), `globalName`
(script-tag global), `repository.url`. `scripts/brand.mjs` reads it for the build banner, the global and the tests; the
site repo reads this same `package.json` (its `scripts/brand.mjs`, `{{name}}` `{{display}}` `{{global}}` `{{repo}}`). To rename:

1. Edit those four fields in `package.json` (and `homepage`/`bugs`). Check the npm name is free.
2. Replace the literal name where a file can't read package.json: `README.md` and `llms.txt` (install/import lines),
   `test/types/check.ts` (self-import), comments in `src/auto.js` and `types/auto.d.ts`; in `chapterize-js-site`:
   `site/assets/site.js` (`import … from 'chapterize-js'`, resolved by an esbuild alias), `scripts/lib-root.mjs` and
   `scripts/sync-lib.mjs` (sibling folder + vendor folder names). Find them: `rg -i chapterize --glob '!node_modules' --glob '!dist' --glob '!vendor'`.
3. Set `SITE_URL` for the site (Vercel env var; see the site's `docs/SITE.md`; the domain is not decided yet).
4. `npm install` here (refreshes package-lock + the self-reference), `npm run test:all`, `npm run test:types`; then the site's `npm run test:all`.

## Workflow rules

- **Approvals:** never publish to npm, push to GitHub, deploy, or delete/move other folders without Byron's explicit OK. No `git init` (Byron does git; this repo and `chapterize-js-site` are separate git repos).
- **Byron edits files himself.** Re-read a file right before changing it and keep his edits.
- **Design taste** (mostly for the site repo): dark, editorial, distinctive. No icon-above-title card grids. Effects add no load weight (CSS only, no images/fonts).
- **Honesty:** measure or cite sizes, browser support and framework claims; say what was and wasn't run.
- **Tests:** attach listeners before the action, bound every wait, report results per engine.

## Read more

[`docs/PROJECT-GOALS.md`](docs/PROJECT-GOALS.md) (north star, goals, competition, design taste, decisions log) ·
[`docs/ROADMAP.md`](docs/ROADMAP.md) (native CSS scroll markers, next steps) · `../chapterize-js-site/AGENTS.md` and its `docs/SITE.md` (site build, clean URLs, Vercel setup, adding pages) ·
[`README.md`](README.md) · [`llms.txt`](llms.txt)
