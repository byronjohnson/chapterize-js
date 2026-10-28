# Native CSS scroll markers: evaluation and roadmap

Evaluated 2026-10-23 against the test engines (Chrome 156.0.8078.47, Playwright Firefox 157.0, Playwright WebKit 27.2):

| Feature | Chromium | Firefox | WebKit | Used? |
| --- | --- | --- | --- | --- |
| `scroll-target-group: auto` + `:target-current` | yes | no | no | **No** (roadmap) |
| CSS scroll-driven animations (`animation-timeline: scroll()`) | yes | no | yes | Site only (reading bar), JS `--read` fallback |
| `scrollend` | yes | yes | yes | Yes; 3 s timer fallback |
| `adoptedStyleSheets` + `@layer` | yes | yes | yes | Yes; no marker if missing (list still spies) |
| IntersectionObserver | yes | yes | yes | Required |

## Why not adopt `scroll-target-group` now

- Chromium-only, and it was not accepted for Interop 2026, so there is no cross-browser date.
- It only styles the current link (`:target-current`): no `aria-current`, no event, no geometry for a gliding
  marker, no TOC generation, no offset/short-section rules. We would still need all of the JS.
- Two activation engines (native in Chrome, ours elsewhere) would disagree at boundaries; consistency wins.

## Plan (candidates, not promises)

1. When a second engine ships it: optional `data-chapter-native` that sets `scroll-target-group: auto` on the nav and
   lets `:target-current` style links, while the library keeps `aria-current`, events and the marker.
2. Cross-check our activation against `:target-current` in Chrome in a test, and document differences.
3. Marker motion via scroll-driven animations where available (no JS per frame), keeping the transition fallback.
4. Optional separate `/marker` entry if the core needs bytes back.
5. Shadow-root DOM watching (observe shadow roots that contain spied navs).
