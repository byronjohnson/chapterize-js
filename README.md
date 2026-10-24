# Chapterize JS

**The accessible, attribute-only table of contents.** One attribute turns the headings already on your page into a live outline: it builds the list, gives headings ids, highlights the section being read and glides a marker between links. Zero dependencies, about 5 KB gzip, works in every framework and on plain sites.

```html
<nav data-spy data-spy-build data-spy-marker></nav>
<script src="https://unpkg.com/chapterize-js" defer></script>
```

- **Attribute-only.** No JavaScript config. Ids are generated from heading text, sticky headers are read from your CSS `scroll-padding-top`.
- **Accessible first.** `aria-current="location"`, an automatic landmark name, focus follows clicks, reduced motion is honoured live (even over CSS `scroll-behavior: smooth`).
- **Correct at the edges.** Short final sections each get a turn, the last section wins at the bottom, the first click lands below sticky headers, a smooth scroll does not flicker through the sections it passes.
- **Framework-proof.** It watches the DOM: client-side routes, re-rendered headings and late content just work. Importing it on the server is a no-op.
- **Beautiful by default, opt-in.** `data-spy-marker` draws a gliding line, a pill or a minimal marker from a CSP-safe constructed stylesheet in `@layer spy`.

## Install

```sh
npm install chapterize-js
```

```js
import 'chapterize-js/auto'; // spies every [data-spy] nav, now and later
```

Or with no build step: `<script src="https://unpkg.com/chapterize-js" defer></script>` registers a global `Chapterize` and initialises when the DOM is ready. Add `data-manual` to the script tag to call `Chapterize.init()` yourself.

| Entry | File | Use |
| --- | --- | --- |
| `chapterize-js` | `dist/index.js` (ESM), `dist/index.cjs` | `init`, `spy`, `refresh`, `destroy`, `slug`, no side effects |
| `chapterize-js/auto` | `dist/auto.js` | calls `init()` on import (no-op on the server) |
| `chapterize-js/global` | `dist/global.min.js` | script tag, global `Chapterize`, auto-init |

## Attributes

| Attribute | On | Meaning |
| --- | --- | --- |
| `data-spy` | nav | Spy this element's same-page links. Required. |
| `data-spy-build` | nav | Build a nested `<ol>` from headings. Empty = `main h2, main h3`; a value = your selector. |
| `data-spy-marker` | nav | Built-in marker: `line` (default), `pill`, `minimal`. |
| `data-spy-offset` | nav | Pixels hidden by a sticky header. Default: the scroller's `scroll-padding-top`. |
| `data-spy-hash="false"` | nav | Don't write `#id` on click. Hash routers (`#/…`, `#!…`) are left alone automatically. |
| `data-spy-label` | heading | Outline text for this heading. |
| `data-spy-ignore` | heading or container | Keep out of the built outline. |

Attributes are live: change one and the nav updates.

## JavaScript

```js
import { init, spy, refresh, destroy, slug } from 'chapterize-js';

const toc = init();                  // every [data-spy] nav, now and later; idempotent
const one = spy(nav, { build: 'article h2', marker: 'pill', offset: 64, hash: false });
one.index; one.id; one.links; one.targets;
one.go('install');                   // scroll to a section by id or index
one.marker('minimal');               // switch presets; false removes it
one.refresh();                       // re-measure after a layout change it cannot see
one.destroy();                       // undo everything it added
refresh(); destroy();                // every instance at once; destroy() also stops DOM watching
slug('Café crème');                  // 'café-crème', the id the outline would generate
```

Options mirror the attributes (attributes win): `build`, `offset`, `marker`, `hash`, and `observe` (default `true`: watch the DOM). `init()` also takes `root`.

### Events

```js
document.addEventListener('spy:change', (e) => {
  const { index, id, link, target, previous } = e.detail;
});
```

## The marker

`data-spy-marker` draws a faint rail, a fill up to the active link, a glowing line that eases between links and a soft band behind the active row. `pill` glides a rounded highlight behind the link instead; `minimal` is just the line.

Every visual reads a custom property on the nav: `--spy-color`, `--spy-color-2`, `--spy-width`, `--spy-duration` (`.6s`), `--spy-ease`, `--spy-indent`, `--spy-rail`, `--spy-glow`, `--spy-band`, `--spy-radius`. The styles sit in `@layer spy`, so any rule you write wins.

Drawing your own? Leave the attribute off. The nav still gets `--spy-y`, `--spy-h`, `--spy-x`, `--spy-w` (the active link's box) and `--spy-progress` (0 to 1); the active link gets `.is-active` and `aria-current="location"`, its parent entries `.is-trail`.

## Frameworks

Chapterize JS is plain DOM, so the recipe is the same everywhere: render a nav with `data-spy`, and call `init()` once on the client after the first render. `init()` is idempotent and keeps watching the DOM, so route changes, re-rendered headings and navs that mount later are picked up without more code. When a nav leaves the DOM its instance is destroyed for you.

### Plain HTML

```html
<nav data-spy data-spy-build="article h2, article h3" data-spy-marker></nav>
<article>…</article>
<script src="https://unpkg.com/chapterize-js" defer></script>
```

### React

Call `init()` in an effect, after hydration, so the built list never causes a hydration mismatch. Strict Mode's double effect is harmless.

```jsx
import { useEffect } from 'react';
import { init } from 'chapterize-js';

export function Toc() {
  useEffect(() => { init(); }, []);
  return <nav data-spy data-spy-build="article h2, article h3" data-spy-marker />;
}
```

### Next.js

App Router: put the nav in any Server Component and render one small Client Component that calls `init()`, once, in a layout. Pages stay static, the nav ships no JavaScript of its own, and on client-side navigation (`next/link`) the DOM watching rebuilds the outline from the new page.

```tsx app/spy-init.tsx
'use client';
import { useEffect } from 'react';
import { init } from 'chapterize-js';

export default function SpyInit() {
  useEffect(() => { init(); }, []);
  return null;
}
```

```tsx app/layout.tsx
import SpyInit from './spy-init';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SpyInit />
      </body>
    </html>
  );
}
```

```tsx app/docs/page.tsx
export default function Page() {
  return (
    <>
      <nav data-spy data-spy-build="article h2, article h3" data-spy-marker />
      <article>{/* headings and content */}</article>
    </>
  );
}
```

### Vue

```vue
<script setup>
import { onMounted } from 'vue';
import { init } from 'chapterize-js';
onMounted(() => init());
</script>

<template>
  <nav data-spy data-spy-build="article h2, article h3" data-spy-marker></nav>
</template>
```

### Nuxt

A client plugin that waits for the app to mount (so hydration sees the server markup first).

```js
// plugins/toc.client.js
import { init } from 'chapterize-js';
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => init());
});
```

### Svelte / SvelteKit

```svelte
<script>
  import { onMount } from 'svelte';
  import { init } from 'chapterize-js';
  onMount(() => init());
</script>

<nav data-spy data-spy-build="article h2, article h3" data-spy-marker></nav>
```

### Angular

`afterNextRender` runs only in the browser, after the view is in the DOM. Links work with `<base href>`.

```ts
import { Component, afterNextRender } from '@angular/core';
import { init } from 'chapterize-js';

@Component({
  selector: 'app-toc',
  template: `<nav data-spy data-spy-build="article h2, article h3" data-spy-marker></nav>`,
})
export class TocComponent {
  constructor() { afterNextRender(() => init()); }
}
```

### Astro

A bundled script runs once per page; with `<ClientRouter />` the DOM watching follows each swap.

```astro
<nav data-spy data-spy-build="article h2, article h3" data-spy-marker></nav>
<script>
  import 'chapterize-js/auto';
</script>
```

### Solid

```jsx
import { onMount } from 'solid-js';
import { init } from 'chapterize-js';

export function Toc() {
  onMount(() => init());
  return <nav data-spy data-spy-build="article h2, article h3" data-spy-marker />;
}
```

### WordPress

Enqueue the global build in the theme, and put the nav in a template part or a Custom HTML block.

```php
add_action('wp_enqueue_scripts', function () {
  wp_enqueue_script('chapterize-js', 'https://unpkg.com/chapterize-js', [], null, ['strategy' => 'defer']);
});
```

```html
<nav data-spy data-spy-build=".entry-content h2, .wp-block-post-content h2" data-spy-marker></nav>
```

### Hugo

Hugo's headings already have ids, which are kept. Build the outline, or spy Hugo's own `.TableOfContents`.

```html
<nav data-spy data-spy-build=".content h2, .content h3" data-spy-marker></nav>
<!-- or: <div data-spy data-spy-marker>{{ .TableOfContents }}</div> -->
<script src="https://unpkg.com/chapterize-js" defer></script>
```

### Eleventy

In the layout that wraps your Markdown:

```html
<nav data-spy data-spy-build="main h2, main h3" data-spy-marker></nav>
<main>{{ content | safe }}</main>
<script src="https://unpkg.com/chapterize-js" defer></script>
```

### Drupal

Declare a library in the theme, attach it, and add the nav to the node template.

```yaml
# mytheme.libraries.yml
toc:
  js:
    https://unpkg.com/chapterize-js: { type: external, minified: true, attributes: { defer: true } }
```

```html
{{ attach_library('mytheme/toc') }}
<nav data-spy data-spy-build=".node__content h2, .node__content h3" data-spy-marker></nav>
```

## Browser support

Current Chrome, Edge, Firefox and Safari (Safari 16.4+). Modern features are used where they help, each with a fallback:

| Feature | Used for | Without it |
| --- | --- | --- |
| IntersectionObserver | section crossings, no scroll polling | required (every supported browser has it) |
| `scrollend` | ending a click's hold exactly | a 3 s timer, then the hold ends at the next real scroll |
| constructed stylesheets + `@layer` | CSP-safe marker styles that your CSS overrides | the list still spies, without the marker |
| scroll-driven animations | (site only) the header progress bar | `--spy-progress` / `spy:change` |
| native `scroll-target-group` | not used yet: Chromium-only, see docs/ROADMAP.md | n/a |

## Accessibility

- The active link gets `aria-current="location"`.
- A nav without a name is labelled by its own heading, else "On this page".
- Clicking moves focus to the section (with `tabindex="-1"` if needed, removed on destroy), so the next Tab continues there.
- Reduced motion: clicks jump instantly and the marker does not glide, live.
- A nav that scrolls on its own keeps the active link in view, without moving the page.

## Compared

|  | Setup | Builds the TOC | Ids | aria-current | Reduced motion | Size (gzip) |
| --- | --- | --- | --- | --- | --- | --- |
| **Chapterize JS** | attributes | yes | generated | yes | yes, live | ~5 KB incl. marker CSS |
| Tocbot | JS config | yes | must exist | no | no | 4.3 KB + CSS |
| Gumshoe | JS | no | must exist | no | no | unmaintained since 2019 |
| Bootstrap ScrollSpy | attributes | no | must exist | no | partly | part of Bootstrap |

## License

MIT © Byron Johnson
