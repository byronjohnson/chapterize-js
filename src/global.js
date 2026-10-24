// Script-tag entry (IIFE): exposes the API as a global (name from package.json "globalName") and
// auto-inits when the DOM is ready. Opt out with <script src="…" data-manual>.
import { init } from './index.js';
export * from './index.js';

const s = document.currentScript;
if (!(s && s.hasAttribute('data-manual')))
  document.readyState == 'loading' ? document.addEventListener('DOMContentLoaded', () => init()) : init();
