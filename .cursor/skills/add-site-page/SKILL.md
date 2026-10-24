---
name: add-site-page
description: Add a new page to the project website (the static site in site/: page HTML + front matter, nav, clean URL, tests, Lighthouse). Use when asked to create a site page such as /examples or /migrate-from-tocbot.
---

# Add a site page (static site, `site/`)

Source of truth: `docs/SITE.md`. No framework, no new dependencies.

1. **Check first.** Re-read `site/partials/layout.html`, `site/assets/site.css` and existing pages (Byron edits them).
   Nav order lives in front matter: Docs 1, Frameworks 2, Markers 3.
2. **Create `site/pages/<name>.html`** (name = URL segment, served at `/<name>`, never `/<name>.html`):
   ```html
   <!--page {
     "title": "Migrate from Tocbot · {{display}}",
     "description": "At least ~50 characters, unique across pages.",
     "nav": "Migrate", "order": 4
   } -->
   <main id="main" class="page" tabindex="-1">
     <div class="page-hero"><p class="eyebrow">Guide</p><h1>Migrate from Tocbot</h1></div>
     …
   </main>
   ```
   Optional keys: `script` (page JS in `site/assets`), `css`, `layout: "bare"`, `noindex`, `sitemap: false`.
   Exactly one `<h1>`, unique ids, every `href="#…"` must resolve (build fails otherwise). Use `{{name}}`/`{{display}}`,
   never the literal name. Code: fenced blocks (```` ```js Label ````), highlighted at build time with Copy buttons.
   Long pages get a TOC for free: copy the homepage's `.layout` + `aside.side > nav.toc[data-spy][data-spy-build][data-spy-marker]`
   (and the `#otp` sheet for mobile). No inline scripts/styles/handlers (CSP); styles in `site/assets/site.css`.
3. **Links:** extensionless (`/frameworks`, `/<name>`), no trailing slash. Canonical, og and sitemap are generated clean.
4. **Preview live:** `npm run dev` → http://localhost:8080/<name> (leave it running).
5. **Tests:** add the path to `PAGES` in `test/site.test.mjs` (200, CSP, no errors, clean URL + `.html` 308, sitemap).
   Add behavior tests if it has JS: listeners before actions, every wait bounded.
6. **Verify:** `npm run test:all` (Chromium, Firefox, WebKit); no overflow at 390px; `node scripts/screens.mjs`;
   Lighthouse on `npm run preview` (100s, CLS 0); report page weight.
7. Update `docs/SITE.md` if structure changed and `docs/PROJECT-GOALS.md` §8 (pages list). Don't deploy.
