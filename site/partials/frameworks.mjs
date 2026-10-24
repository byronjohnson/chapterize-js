// The /frameworks page body, generated from the README's "## Frameworks" section, so the recipes on the site
// and on npm/GitHub can never drift apart. Edit the README, not this file.
// Supports what that section uses: ### headings, paragraphs with `code`, **bold** and [links](url), ``` fences.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
export const slug = (s) => s.toLowerCase().replace(/\./g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function section(readme) {
  const m = readme.match(/^## Frameworks\n([\s\S]*?)(?=^## )/m);
  if (!m) throw new Error('README.md: "## Frameworks" section not found');
  return m[1];
}

export function render(md) {
  const out = [], heads = [];
  const blocks = md.split(/(^```[\s\S]*?^```$)/m);
  blocks.forEach((b, i) => {
    if (i % 2) return out.push(b); // fence: left for scripts/site/markup.mjs to highlight
    for (const para of b.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
      const h = para.match(/^### (.+)$/);
      if (h) heads.push(h[1]), out.push(`<h3 id="${slug(h[1])}">${inline(h[1])}</h3>`);
      else out.push(`<p>${inline(para.replace(/\n/g, ' '))}</p>`);
    }
  });
  return { html: out.join('\n'), heads };
}

export default ({ root }) => render(section(readFileSync(join(root, 'README.md'), 'utf8'))).html;
