---
name: add-framework-example
description: Add or update a framework/CMS integration recipe (README "## Frameworks" → /frameworks page), with a smoke check. Use when asked to support or document a framework such as Qwik, Remix or Ghost CMS.
---

# Add a framework example

1. **Pattern (don't invent a new one):** the library is framework-agnostic. Either import `'<name>/auto'` once on the client, or call
   `init()` in the framework's client-only mount hook (after hydration). DOM watching handles route changes, re-renders and late
   content; a nav removed from the DOM destroys its own instance. Never call `init()` during SSR (it's a no-op anyway).
2. **Write the recipe** as a `### <Framework>` subsection in README `## Frameworks` (keep alphabetical order of the existing list's style):
   one sentence on where the call goes, then a fenced code block with the real file name in the label. Markup = the nav with `data-spy`
   attributes; no framework component wrapper. Use the package name (`chapterize-js`) via the literal import specifier (it is listed in the rename procedure).
3. **Check facts** against the framework's current docs (hook names, client-only directives, plugin APIs); cite in the PR/report if unsure.
4. In the sibling site repo `../chapterize-js-site`: `npm test`. `/frameworks` regenerates from this README (and the site's
   `vendor/chapterize-js/README.md` is re-synced; commit it there); its site test checks every `###` heading appears with code.
   If the homepage `.fw-index` should link it, add `<a href="/frameworks#<slug>">` in that repo's `site/pages/index.html`.
5. **Smoke it if feasible:** scaffold the framework in `/tmp` (not in the repo), `npm i` this project via `npm pack`, build, serve, and run a
   quick Playwright check that links get `.is-active` after a client-side route change. Say clearly if you skipped it and why.
6. If it needs library behavior (e.g. a new hook), use the `add-option-or-attribute` skill instead of a workaround in the recipe.
