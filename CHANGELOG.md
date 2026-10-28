# Changelog

## 0.1.0

First release. Unpublished.

Add `data-chapter` to a nav and Chapterize JS builds a nested outline from the headings already on the page, highlights the section being read, and can glide a marker between links. Zero dependencies. The core `dist/index.min.js` is 5,037 bytes gzip and `dist/global.min.js` is 5,333 bytes gzip (`npm run build`, 2026-10-28).

- Attributes only: `data-chapter`, `data-chapter-build`, `data-chapter-marker`, `data-chapter-offset`, `data-chapter-hash`, `data-chapter-label`, `data-chapter-ignore`. Missing heading ids are generated.
- Active link: `.is-active`, `aria-current="location"`, ancestor `.is-trail`, and a bubbling `chapter:change` event.
- Opt-in marker presets `line`, `pill`, and `minimal`, drawn from a constructed stylesheet in `@layer chapter`. Theme it with `--chapter-*` custom properties.
- `init()` watches the document and is a no-op on the server. `chapterjs(nav)` watches one nav. Inside a shadow root, call `chapterjs(nav)` and `refresh()` after that tree changes.
