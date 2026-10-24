// Types for the core module. Attributes (data-spy, data-spy-build, data-spy-marker, data-spy-offset,
// data-spy-hash, data-spy-label, data-spy-ignore) always win over these options.

/** Marker preset: `true` = "line". `false` = no marker. */
export type SpyMarker = boolean | 'line' | 'pill' | 'minimal';

export interface SpyOptions {
  /** Heading selector to build the list from (same as data-spy-build). `''` = `main h2, main h3`. */
  build?: string;
  /** Pixels between the viewport top and a section's "reading line" (sticky headers).
   *  Default: data-spy-offset, else the scroller's CSS `scroll-padding-top`, else 0. */
  offset?: number;
  /** Draw the built-in gliding marker. Default `false` (opt-in). */
  marker?: SpyMarker;
  /** Write `#id` to the URL on click (pushState). Default `true`. Skipped for hash routers (`#/`, `#!`). */
  hash?: boolean;
  /** Watch the DOM (SPA routes, re-renders, late content). Default `true`. */
  observe?: boolean;
}

export interface InitOptions extends SpyOptions {
  /** Where to look for `[data-spy]` navs. Default `document`. */
  root?: Document | Element | ShadowRoot;
}

export interface SpyInstance {
  readonly nav: HTMLElement;
  readonly links: HTMLAnchorElement[];
  readonly targets: HTMLElement[];
  /** Index of the active link, -1 before the first measure. */
  readonly index: number;
  /** id of the active section, or null. */
  readonly id: string | null;
  /** Scroll to a section by index or id (respects offset, scroll-margin and reduced motion). */
  go(target: number | string, behavior?: ScrollBehavior): void;
  /** Rebuild, re-collect and re-measure this nav. */
  refresh(): void;
  /** Switch the marker preset at runtime (`false` removes it). */
  marker(preset?: SpyMarker): void;
  /** Stop spying this nav and undo everything the library added. */
  destroy(): void;
}

export interface SpyController {
  readonly instances: SpyInstance[];
  refresh(): void;
  destroy(): void;
}

export interface SpyChangeDetail {
  index: number;
  id: string;
  link: HTMLAnchorElement;
  target: HTMLElement;
  /** The previous index, -1 on the first activation. */
  previous: number;
}

export const version: string;
export const defaults: { marker: SpyMarker; hash: boolean; observe: boolean };
/** The slug used for generated ids (accents kept, de-duplicated against `root`). */
export function slug(text: string, root?: Document | ShadowRoot): string;
/** Spy one nav element. Returns the existing instance on repeated calls. */
export function spy(nav: HTMLElement, options?: SpyOptions): SpyInstance;
/** Spy every `[data-spy]` nav and keep watching the DOM. Idempotent; a no-op on the server. */
export function init(options?: InitOptions): SpyController;
export function refresh(): void;
export function destroy(): void;

declare global {
  interface HTMLElementEventMap {
    'spy:change': CustomEvent<SpyChangeDetail>;
  }
  interface DocumentEventMap {
    'spy:change': CustomEvent<SpyChangeDetail>;
  }
  interface WindowEventMap {
    'spy:change': CustomEvent<SpyChangeDetail>;
  }
}
