// Builds the static website into site-dist/ (dev-only; zero runtime dependencies).
//   site/pages/*.html     one file per page, with a <!--page {json} --> front-matter block
//                         keys: title, description (required); nav, order (header link); script (page JS in
//                         site/assets); css (page stylesheet, default site.css); layout ("bare" = no site chrome);
//                         noindex, sitemap:false
//   site/partials/        layout.html, bare-layout.html and {{> name}} includes (.html or .mjs)
//   site/assets/          stylesheets and scripts (bundled, minified, content-hashed)
//   site/public/          copied verbatim to the site root
// Usage: SITE_URL=https://example.com node scripts/build-site.mjs
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, cpSync, existsSync, renameSync } from 'node:fs';
import { join, dirname, basename, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fences, anchors, checkLinks } from './site/markup.mjs';
import { pkg, NAME, DISPLAY, GLOBAL, REPO } from './brand.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'site');
// SITE_OUT: output folder (default site-dist; the dev server uses .site-dev/<pid>). The build writes to a staging
// folder and swaps it in at the end, so a server never sees a half-written site and a failed build keeps the old one.
const final = join(root, process.env.SITE_OUT || 'site-dist');
const out = `${final}.tmp-${process.pid}`;
process.on('exit', () => rmSync(out, { recursive: true, force: true }));
// One config value for absolute URLs (canonical, sitemap). Placeholder until the name and domain are final.
const SITE = (process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL && 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL) || `https://${NAME}.vercel.app`).replace(/\/+$/, '');
const QUIET = !!process.env.QUIET;

if (!existsSync(join(root, 'dist/index.js'))) throw new Error('dist/ missing: run `npm run build` first');
mkdirSync(out, { recursive: true });

// ---- pages + front matter ----
const pages = readdirSync(join(src, 'pages')).filter((f) => f.endsWith('.html')).sort().map((file) => {
  const raw = readFileSync(join(src, 'pages', file), 'utf8');
  const m = raw.match(/^<!--page\s*([\s\S]*?)-->\s*/);
  if (!m) throw new Error(`${file}: missing <!--page {…} --> front matter`);
  let meta;
  try { meta = JSON.parse(m[1]); } catch (e) { throw new Error(`site/pages/${file}: front matter is not valid JSON (${e.message})`); }
  for (const k of ['title', 'description']) if (!meta[k]) throw new Error(`${file}: front matter needs "${k}"`);
  const name = basename(file, '.html');
  const path = name == 'index' ? '/' : '/' + name; // cleanUrls + trailingSlash:false
  return { file, name, path, meta, body: raw.slice(m[0].length), is404: name == '404' };
});

// ---- assets: stylesheets + scripts, minified and content-hashed, shared chunks split out ----
// site.js (the library + site glue) runs on every page with the site layout; pages may add their own script.
const SHARED = 'site.js';
const scripts = [...new Set([SHARED, ...pages.map((p) => p.meta.script).filter(Boolean)])];
const styles = [...new Set(['site.css', ...pages.map((p) => p.meta.css).filter(Boolean)])];
const res = await build({
  entryPoints: [...styles, ...scripts].map((s) => join(src, 'assets', s)),
  bundle: true, splitting: true, format: 'esm', minify: true, target: ['es2020'],
  outdir: join(out, 'assets'), entryNames: '[name]-[hash]', chunkNames: '[name]-[hash]',
  // the site imports the library by its package name, resolved to the freshly built dist/
  alias: { [NAME]: './dist/index.js' }, absWorkingDir: root,
  metafile: true, legalComments: 'none', logLevel: 'warning',
});
const outputs = res.metafile.outputs;
const url = (f) => '/' + relative(out, join(root, f)).split('\\').join('/');
const entryOf = (srcRel) => Object.keys(outputs).find((o) => outputs[o].entryPoint == srcRel);
const cssFor = (name) => url(entryOf('site/assets/' + name));
const jsFor = (script) => {
  const entry = entryOf('site/assets/' + script);
  if (!entry) throw new Error(`script ${script} not found in site/assets`);
  const deps = [], walk = (o) => outputs[o].imports.filter((i) => i.kind == 'import-statement').forEach((i) => !deps.includes(i.path) && (deps.push(i.path), walk(i.path)));
  walk(entry);
  return { entry: url(entry), deps: deps.map(url) };
};

// ---- templating ----
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const layouts = { site: readFileSync(join(src, 'partials/layout.html'), 'utf8'), bare: readFileSync(join(src, 'partials/bare-layout.html'), 'utf8') };
const ctx = { SITE, pkg, NAME, DISPLAY, GLOBAL, REPO, root };
const partial = async (name) => {
  const mjs = join(src, 'partials', name + '.mjs'), html = join(src, 'partials', name + '.html');
  if (existsSync(mjs)) return (await import(pathToFileURL(mjs) + '?' + Date.now())).default(ctx);
  if (existsSync(html)) return readFileSync(html, 'utf8');
  throw new Error(`partial ${name} not found`);
};
const fill = async (s) => {
  for (const [m, name] of [...s.matchAll(/\{\{>\s*([\w-]+)\s*\}\}/g)]) { const html = await partial(name); s = s.replace(m, () => html); }
  return s;
};
const navPages = pages.filter((p) => p.meta.nav).sort((a, b) => (a.meta.order ?? 99) - (b.meta.order ?? 99));
// Safe HTML minifier: drops comments, trims indentation and blank lines; <pre>/<textarea>/<script> left intact.
const minifyHtml = (h) => h.split(/(<(pre|textarea|script)\b[\s\S]*?<\/\2>)/i).map((part, i) => i % 3 == 1 ? part : i % 3 == 2 ? '' :
  part.replace(/<!--(?!\[)[\s\S]*?-->/g, '').replace(/\n\s+/g, '\n').replace(/\n{2,}/g, '\n')).join('').trim() + '\n';

const shared = jsFor(SHARED);
for (const p of pages) {
  const bare = p.meta.layout == 'bare';
  const js = p.meta.script ? jsFor(p.meta.script) : null;
  const all = [...(bare ? [] : [shared]), ...(js ? [js] : [])];
  // brand placeholders work in page bodies too: {{name}} {{display}} {{global}} {{repo}} {{version}}
  const brand = { site: SITE, version: pkg.version, name: NAME, display: DISPLAY, global: GLOBAL, repo: REPO };
  const b = (s) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in brand ? brand[k] : m));
  const vars = {
    ...brand, title: esc(b(p.meta.title)), description: esc(b(p.meta.description)),
    url: SITE + (p.path == '/' ? '/' : p.path),
    robots: p.is404 || p.meta.noindex ? '<meta name="robots" content="noindex">\n' : '',
    css: cssFor(p.meta.css || 'site.css'),
    head: [...new Set(all.flatMap((j) => j.deps))].map((d) => `<link rel="modulepreload" href="${d}">\n`).join(''),
    scripts: all.map((j) => `<script type="module" src="${j.entry}"></script>\n`).join(''),
    nav: navPages.map((n) => `<a href="${n.path}"${n === p ? ' aria-current="page"' : ''}>${esc(b(n.meta.nav))}</a>`).join('\n      '),
  };
  const sub = (s) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
  vars.content = anchors(fences(sub(await fill(p.body)))); // see scripts/site/markup.mjs
  let html = sub(layouts[bare ? 'bare' : 'site']);
  if (/\{\{[\w>]/.test(html.replace(/<pre\b[\s\S]*?<\/pre>/g, ''))) throw new Error(`${p.file}: unresolved placeholder ${html.match(/\{\{[^}]*\}\}/)[0]}`);
  if (/\sstyle=|<style|<script(?![^>]*\ssrc=)/i.test(html.replace(/<pre\b[\s\S]*?<\/pre>/g, ''))) throw new Error(`${p.file}: inline style/script would violate the CSP`);
  checkLinks(html, p.file);
  writeFileSync(join(out, p.name + '.html'), minifyHtml(html));
}

// ---- static files, library copy, llms.txt, sitemap, robots ----
if (existsSync(join(src, 'public'))) cpSync(join(src, 'public'), out, { recursive: true });
cpSync(join(root, 'dist'), join(out, 'dist'), { recursive: true }); // the plain example loads dist/global.min.js
cpSync(join(root, 'llms.txt'), join(out, 'llms.txt'));
const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.filter((p) => !p.is404 && p.meta.sitemap !== false && !p.meta.noindex).sort((a, b) => (a.meta.order ?? 99) - (b.meta.order ?? 99)).map((p) => `  <url><loc>${SITE}${p.path}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);
writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

// ---- swap the finished build into place ----
const old = `${final}.old-${process.pid}`;
if (existsSync(final)) renameSync(final, old);
renameSync(out, final);
rmSync(old, { recursive: true, force: true });

if (!QUIET) {
  const files = Object.keys(outputs).map((o) => `  ${relative(out, join(root, o)).padEnd(32)} ${outputs[o].bytes} B`);
  console.log(`${relative(root, final)}/ built for ${SITE}\n  pages: ${pages.map((p) => p.path).join(', ')}\n${files.join('\n')}`);
}
