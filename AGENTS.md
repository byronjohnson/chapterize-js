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
| `npm run dev` | live site at http://localhost:8080 (SSE reload, CSS hot swap, error overlay). Leave it running |
| `npm run build:site` | library + site → `site-dist/` |
| `npm run preview` | production-like serve of `site-dist/` (Vercel rules; use for Lighthouse) |
| `npm test` | build + site build + all tests in Chromium (system Chrome) |
| `npm run test:all` | Chromium, Firefox, WebKit. Must be green before you report |
| `npm run test:types` | TypeScript check of `types/` (`test/types`) |
| `node scripts/screens.mjs [path-prefix]` | screenshots of the built site (home desktop/mobile, sheet, plain, markers, frameworks); `SCREENS_BASE=<url>` shoots a running server |

Before a full run: `pkill -f "scripts/(serve|dev).mjs"; fuser -k 8080/tcp` (stray servers on 8080 break the dev test).

## Layout

```
src/            index.js (core), auto.js (auto-init entry), global.js (IIFE window global), marker.css (inlined at build)
types/          index.d.ts, auto.d.ts (hand-written; the docs test checks them against the runtime exports)
dist/           built bundles (generated; shipped to npm)
site/           THE website (static, zero-framework): pages/*.html (front matter), partials/ (layout, bare-layout, frameworks.mjs), assets/, public/
scripts/        brand.mjs (THE name), build.mjs, build-site.mjs, dev.mjs, dev-client.js, serve.mjs, screens.mjs, site/
test/           spy (core behavior), spa (framework/SPA DOM churn), ssr, site (+ docs accuracy), dev; fixtures/; types/
docs/           PROJECT-GOALS.md, ROADMAP.md (native CSS), SITE.md (site build, clean URLs, Vercel, adding pages)
README.md, llms.txt   user docs + compact agent reference (keep in sync; README "## Frameworks" feeds /frameworks)
```

Generated, never edit: `dist/`, `site-dist/`, `.site-dev/`.

## Invariants

- Zero runtime deps, no CSS file, no framework code in the library. Without JS the page and its links still work.
- Importing never touches `window`/`document`; `init()` on the server is a no-op; `slug()` works on the server.
- CSP: the library never injects `<style>` or `style=""` strings; styles go through CSSOM (`adoptedStyleSheets`,
  `style.setProperty`). Site: `script-src 'self'; style-src 'self'`, no inline scripts/styles/handlers (the build fails).
- The site is static HTML + ~5 KB of JS, no framework (a Next.js version was built, measured and rejected on
  2026-10-23; see docs/PROJECT-GOALS.md). Clean URLs only: `/frameworks`, never `/frameworks.html`, in links,
  canonical/og URLs and the sitemap (vercel.json `cleanUrls: true`, `trailingSlash: false`; tested).
- `data-spy*` attributes, `.is-active` / `.is-trail`, `spy:change`, `--spy-*` variables and `@layer spy` are
  independent of the project name and frozen unless Byron says otherwise.
- Every modern feature has a fallback (see README "Browser support"); never require one that isn't in all three engines.
- API change ⇒ update `src/`, `types/`, README, `llms.txt`, the site and tests together (the docs test checks drift).

## Renaming (if the name ever changes again)

The name lives in `package.json`: `name` (npm + import specifier), `displayName` (prose, titles), `globalName`
(script-tag global), `repository.url`. `scripts/brand.mjs` reads it; the build, site (`{{name}}`, `{{display}}`,
`{{global}}`, `{{repo}}` placeholders), banner, dev server and tests use it. To rename:

1. Edit those four fields in `package.json` (and `homepage`/`bugs` if set). Check the npm name is free.
2. Replace the literal name where a file can't read package.json: `README.md` and `llms.txt` (install/import lines),
   `site/assets/site.js` (`import … from 'chapterize-js'`, resolved by an esbuild alias), `test/types/check.ts`
   (self-import), comments in `src/auto.js` and `types/auto.d.ts`. Find them: `rg -i chapterize --glob '!node_modules' --glob '!dist' --glob '!site-dist'`.
3. Set `SITE_URL` (Vercel env var, or the default in `scripts/build-site.mjs`, currently `https://<name>.vercel.app`; the domain is not decided yet).
4. `npm install` (refreshes package-lock + the self-reference), `npm run test:all`, `npm run test:types`.

## Workflow rules

- **Approvals:** never publish to npm, push to GitHub, deploy, or delete/move other folders without Byron's explicit OK. No `git init` (Byron does git).
- **Byron edits files himself.** Re-read a file right before changing it and keep his edits.
- **Design taste:** dark, editorial, distinctive. No icon-above-title card grids. Effects add no load weight (CSS only, no images/fonts).
- **Honesty:** measure or cite sizes, browser support and framework claims; say what was and wasn't run.
- **Tests:** attach listeners before the action, bound every wait, report results per engine.

## Read more

[`docs/PROJECT-GOALS.md`](docs/PROJECT-GOALS.md) (north star, goals, competition, design taste, decisions log) ·
[`docs/ROADMAP.md`](docs/ROADMAP.md) (native CSS scroll markers, next steps) · [`docs/SITE.md`](docs/SITE.md) (site build, clean URLs, Vercel setup, adding pages) ·
[`README.md`](README.md) · [`llms.txt`](llms.txt)
