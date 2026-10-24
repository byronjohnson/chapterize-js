// Build-time page features (any page can use them):
//   ```lang [label]          fenced code block -> highlighted <pre> with a label and a Copy button
//   ...code...               (Copy is enabled by site/assets/code.js; without JS the button stays hidden)
//   ```
//   <h2 id="x">              h2/h3 with an id get a "#" anchor link
//   <!--toc:side--> <!--toc:top-->   replaced with a table of contents of the page's h2 headings
import { highlight } from './highlight.mjs';

const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function fences(html) {
  return html.replace(/^([ \t]*)```([\w-]+)(?:[ \t]+([^\n]+))?\n([\s\S]*?)\n[ \t]*```[ \t]*$/gm, (_, indent, lang, label, code) => {
    code = code.split('\n').map((l) => (l.startsWith(indent) ? l.slice(indent.length) : l)).join('\n');
    const name = label || { sh: 'Terminal', bash: 'Terminal', html: 'HTML', js: 'JavaScript', ts: 'TypeScript', tsx: 'TSX', jsx: 'JSX', css: 'CSS', php: 'PHP', json: 'JSON', vue: 'Vue', svelte: 'Svelte', astro: 'Astro', text: 'Output' }[lang] || lang;
    return `<div class="code"><div class="code-bar"><span class="code-label">${escAttr(name)}</span><button type="button" class="code-copy" hidden>Copy</button></div>` +
      `<pre class="lang-${lang}" tabindex="0" aria-label="${escAttr(name)} code"><code>${highlight(code, lang)}</code></pre></div>`;
  });
}

export function anchors(html) {
  return html.replace(/<(h[23])([^>]*\sid="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g, (m, tag, attrs, id, inner) =>
    /class="[^"]*\bno-anchor\b/.test(attrs) ? m : `<${tag}${attrs}>${inner} <a class="anchor" href="#${id}" aria-label="Link to this section: ${escAttr(strip(inner))}">#</a></${tag}>`);
}

export function toc(html) {
  if (!html.includes('<!--toc:')) return html;
  const items = [...html.matchAll(/<h2[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)].map(([, id, inner]) => [id, strip(inner.replace(/<a class="anchor"[\s\S]*?<\/a>/, ''))]);
  const list = `<ol class="toc-list">${items.map(([id, t]) => `<li><a href="#${id}">${t}</a></li>`).join('')}</ol>`;
  return html
    .replace('<!--toc:side-->', `<nav class="toc toc-side" aria-label="On this page"><p class="toc-title">On this page</p>${list}</nav>`)
    .replace('<!--toc:top-->', `<details class="toc toc-top"><summary>On this page</summary><nav aria-label="On this page">${list}</nav></details>`);
}

// ids must be unique and every in-page #link must resolve
export function checkLinks(html, file) {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.find((id, i) => ids.indexOf(id) != i);
  if (dup) throw new Error(`${file}: duplicate id "${dup}"`);
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) if (!ids.includes(id)) throw new Error(`${file}: link to #${id} has no target`);
}
