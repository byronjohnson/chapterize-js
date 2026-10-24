# The website

**`site/` is the site**: static HTML built by `scripts/build-site.mjs` (zero framework, ~5 KB of site JS, the library
itself does the TOC). It's the demo of the library's pitch, so it stays as light as the library: no framework, no
images, no webfonts. (A Next.js App Router version was built and measured on 2026-10-23 and rejected: ~141 KB vs
5.5 KB gzip JS per page, mobile LCP ~2.1 s vs 0.93 s, relaxed CSP. See `docs/PROJECT-GOALS.md` §10.)

```
site/
  pages/*.html        one file per page, <!--page {json} --> front matter (title, description, nav, order,
                      script, css, layout:"bare", noindex, sitemap:false)
  partials/           layout.html (site chrome), bare-layout.html (/plain), frameworks.mjs ({{> frameworks}}:
                      the README "## Frameworks" section → /frameworks)
  assets/             site.css, site.js (+ code.js: Copy buttons), plain.css. Bundled, minified, content-hashed
  public/             copied verbatim (favicon.svg)
scripts/build-site.mjs  → site-dist/ (+ sitemap.xml, robots.txt, llms.txt, dist/ for /plain)
scripts/site/         markup.mjs (fences, anchors, link check), highlight.mjs (build-time highlighting)
scripts/serve.mjs     static server that mirrors Vercel (clean URLs, headers from vercel.json, 404.html, br/gzip)
scripts/dev.mjs       live-reload dev server
vercel.json           Vercel config: build, output dir, cleanUrls, trailingSlash, CSP + security + cache headers
```

Placeholders in pages: `{{name}}` `{{display}}` `{{global}}` `{{repo}}` `{{version}}` (from package.json via
`scripts/brand.mjs`); never the literal project name. The build fails on unresolved placeholders, duplicate ids,
dead `#links`, and inline styles/scripts/handlers (CSP).

## Commands

```bash
npm run dev        # http://localhost:8080, rebuilds on save; CSS hot-swaps, everything else reloads; errors as an overlay
npm run build:site # library + site → site-dist/
npm run preview    # build + serve site-dist/ on :8080 like Vercel (use for Lighthouse)
npm test           # build + all tests in Chromium; npm run test:all for Chromium, Firefox, WebKit
node scripts/screens.mjs /tmp/spy-   # screenshots (SCREENS_BASE=<url> to shoot a running server)
```

Lighthouse on `npm run preview`:
`lighthouse http://127.0.0.1:8080/ --chrome-flags="--headless=new --no-sandbox" --quiet --output=json --output-path=/tmp/lh.json`
(`--preset=desktop` for desktop). Targets: 100 / 100 / 100 / 100, CLS 0.

## Clean URLs (no `.html`)

Pages are built as `site-dist/<name>.html` but are only ever addressed without the extension:

- `vercel.json`: `"cleanUrls": true` (Vercel serves `/frameworks` from `frameworks.html` and 308-redirects
  `/frameworks.html` → `/frameworks`, `/index.html` → `/`) and `"trailingSlash": false` (`/markers/` → `/markers`).
- Every internal link, canonical `<link>`, `og:url` and sitemap `<loc>` is extensionless (`/frameworks`, `/`).
  Write links that way in `site/pages` and partials.
- `scripts/serve.mjs` (preview, dev, tests) mimics both rules, including the 308s and query strings.
- `test/site.test.mjs` "clean URLs" asserts: the vercel.json flags; every page 200 without `.html`; `<page>.html`
  308 to the clean path; no internal `href`, canonical, `og:url` or sitemap URL ending in `.html` (code samples in
  `<pre>` excepted); every internal link resolves 200.

## CSP and headers

From `vercel.json` (mirrored locally by `serve.mjs`): `default-src 'self'; script-src 'self'; style-src 'self'; …;
object-src 'none'; frame-ancestors 'none'`, plus nosniff, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy,
COOP, HSTS. `/assets/*` (hashed) is `immutable`; everything else revalidates. No inline scripts or styles anywhere:
dynamic styles go through CSSOM.

## Accessibility notes

Copy buttons ship `hidden` and appear only with JS. The result ("Copied to clipboard" / "Code selected, press Ctrl+C")
is announced through the layout's polite live region `<p id="copy-live" class="sr" aria-live="polite">`, which is
in the HTML from the start so screen readers notice the change (tested).

## Vercel setup (deploying needs Byron's OK)

- Import the repo; **Root Directory: the repo root** (blank). **Framework Preset: Other** (`vercel.json` sets
  `"framework": null`, install `npm ci`, build `npm run build:site`, output `site-dist`).
- Environment variable **`SITE_URL`** = the production origin (canonical, og, sitemap, robots). Without it the build
  uses `VERCEL_PROJECT_PRODUCTION_URL`, else `https://<name>.vercel.app`.
- Node.js 20+. Nothing else: no serverless functions, everything is served from the CDN.

## Adding a page

See `.cursor/skills/add-site-page/SKILL.md`.
