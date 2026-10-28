// Types for the core module. Attributes (data-chapter, data-chapter-build, data-chapter-marker, data-chapter-offset,
// data-chapter-hash, data-chapter-label, data-chapter-ignore) always win over these options.

/** Marker preset: `true` = "line". `false` = no marker. */
export type ChapterMarker = boolean | 'line' | 'pill' | 'minimal';

export interface ChapterOptions {
  /** Heading selector to build the list from (same as data-chapter-build). `''` = `main h2, main h3`. */
  build?: string;
  /** Pixels between the viewport top and a section's "reading line" (sticky headers).
   *  Default: data-chapter-offset, else the scroller's CSS `scroll-padding-top`, else 0. */
  offset?: number;
  /** Draw the built-in gliding marker. Default `false` (opt-in). */
  marker?: ChapterMarker;
  /** Write `#id` to the URL on click (pushState). Default `true`. Skipped for hash routers (`#/`, `#!`). */
  hash?: boolean;
  /** Watch the DOM (SPA routes, re-renders, late content). Default `true`. */
  observe?: boolean;
}

export interface InitOptions extends ChapterOptions {
  /** Where to look for `[data-chapter]` navs. Default `document`. */
  root?: Document | Element | ShadowRoot;
}

export interface ChapterInstance {
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
  marker(preset?: ChapterMarker): void;
  /** Stop watching this nav and undo everything the library added. */
  destroy(): void;
}

export interface ChapterController {
  readonly instances: ChapterInstance[];
  refresh(): void;
  destroy(): void;
}

export interface ChapterChangeDetail {
  index: number;
  id: string;
  link: HTMLAnchorElement;
  target: HTMLElement;
  /** The previous index, -1 on the first activation. */
  previous: number;
}

export const version: string;
export const defaults: { marker: ChapterMarker; hash: boolean; observe: boolean };
/** The slug used for generated ids (accents kept, de-duplicated against `root`). */
export function slug(text: string, root?: Document | ShadowRoot): string;
/** Watch one nav element. Returns the existing instance on repeated calls. */
export function chapterjs(nav: HTMLElement, options?: ChapterOptions): ChapterInstance;
/** Watch every `[data-chapter]` nav and keep watching the DOM. Idempotent; a no-op on the server. */
export function init(options?: InitOptions): ChapterController;
export function refresh(): void;
export function destroy(): void;

declare global {
  interface HTMLElementEventMap {
    'chapter:change': CustomEvent<ChapterChangeDetail>;
  }
  interface DocumentEventMap {
    'chapter:change': CustomEvent<ChapterChangeDetail>;
  }
  interface WindowEventMap {
    'chapter:change': CustomEvent<ChapterChangeDetail>;
  }
}
