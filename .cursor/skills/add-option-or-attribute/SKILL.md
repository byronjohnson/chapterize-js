---
name: add-option-or-attribute
description: Add or change a data-chapter-* attribute, JS option, method, event field or CSS variable, keeping source, types, docs, site and tests in sync. Use for any public API change.
---

# Add an option or attribute

1. **Justify it** against the north star and "simpler than Tocbot": can an existing attribute or CSS do it? Ask Byron before renaming/removing anything public.
2. **Source:** `src/index.js`. Attributes win over options: `attr('name') ?? o.name ?? defaults.name`. Read it lazily so attribute
   changes are picked up by the MutationObserver soft refresh (it watches `data-chapter*` attributes). Keep SSR safety and `destroy()` restoring state.
3. **Size:** `npm run size` before/after; note the delta. Core min+gzip soft limit 5 KB.
4. **Types:** `types/index.d.ts` (`ChapterOptions`, `ChapterInstance`, `ChapterChangeDetail`, `ChapterMarker`), with JSDoc + `@default`; extend `test/types/check.ts`
   (including a `@ts-expect-error` for misuse); `npm run test:types`.
5. **Docs (all of them):** README tables and `llms.txt` here (`test/docs.test.mjs` fails if one is missing); in the sibling
   `../chapterize-js-site`: the homepage attributes/API section and the markers page for CSS variables (its `test/site.test.mjs`
   "site docs accuracy" fails if one is missing), then its `npm run test:all` and commit its refreshed `vendor/`.
6. **Tests:** behavior in `test/spy.test.mjs` (and `test/spa.test.mjs` if it interacts with DOM changes). Attach listeners before actions; bound waits.
7. `npm run test:all` green in all three engines; add a dated decisions-log line in `docs/PROJECT-GOALS.md`.
