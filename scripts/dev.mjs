// Live dev server for the website: npm run dev (and npm run demo).
// Watches the site sources, the library sources and the build scripts. On every save it rebuilds
// (src/ changes rebuild dist/ with the library build first), then tells open tabs over Server-Sent Events:
// CSS-only edits hot-swap the stylesheet, anything else reloads the page. Build errors are printed here and
// shown as an overlay in the browser, and the server keeps running.
// Zero dependencies: Node built-ins plus the scripts that already use esbuild.
//   PORT=8080 node scripts/dev.mjs     or     node scripts/dev.mjs 8080
import { watch, existsSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
import { DISPLAY } from './brand.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
// dev build output: one folder per running dev server (git-ignored, removed on exit); production builds go to site-dist/
const OUT = `.site-dev/${process.pid}`;
const outDir = join(root, OUT);
const clientFile = join(root, 'scripts/dev-client.js');
const serverId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const t0 = () => new Date().toLocaleTimeString([], { hour12: false });
const log = (...a) => console.log(`[dev ${t0()}]`, ...a);

// ---------------------------------------------------------------- what is watched, and what a change means
// kind: 'lib' = rebuild dist/ then the site, 'site' = rebuild the site, 'css' = rebuild site + hot-swap CSS,
// 'restart' = the dev server itself changed (needs a manual restart), null = ignored.
const IGNORE = /(^|\/)(node_modules|\.git|dist|site-dist|\.site-dev[^/]*|site-dist\.[^/]*)(\/|$)|(^|\/)(\.DS_Store|4913|\.#[^/]*|#[^/]*#)$|\.(sw[a-z]|tmp|bak|orig)$|~$/;
export function classify(rel) {
  rel = rel.split(sep).join('/');
  if (IGNORE.test(rel)) return null;
  if (rel.startsWith('src/') || rel == 'scripts/build.mjs' || rel == 'scripts/brand.mjs' || rel == 'package.json') return 'lib';
  if (/^site\/assets\/[^/]+\.css$/.test(rel)) return 'css';
  if (rel.startsWith('site/') || rel == 'scripts/build-site.mjs' || rel == 'llms.txt' || rel == 'vercel.json') return 'site';
  // the docs page is generated from these (scripts/site/source.mjs), so they rebuild the site too
  if (rel.startsWith('scripts/site/') || rel == 'README.md' || rel.startsWith('types/')) return 'site';
  if (rel == 'scripts/dev-client.js') return 'site'; // served from disk; a reload picks it up
  if (rel == 'scripts/dev.mjs' || rel == 'scripts/serve.mjs') return 'restart';
  return null;
}
const RANK = { css: 1, site: 2, lib: 3 };

// ---------------------------------------------------------------- builds (fresh Node process each time,
// so edited .mjs partials and data modules are never served from a stale module cache)
const run = (script, env = {}) => new Promise((resolve) => {
  const p = spawn(process.execPath, [join(root, script)], { cwd: root, env: { ...process.env, QUIET: '1', ...env } });
  let out = '';
  p.stdout.on('data', (d) => (out += d));
  p.stderr.on('data', (d) => (out += d));
  p.on('close', (code) => resolve({ ok: code === 0, out: tidy(out) }));
});
// Keep the useful part of a failure: esbuild's own diagnostics if present, else the error without stack frames.
function tidy(out) {
  out = out.replace(/\x1b\[[0-9;]*m/g, '');
  const esb = out.indexOf('✘ [ERROR]');
  if (esb >= 0) {
    out = out.slice(esb);
    const end = out.search(/\n\S*node_modules\/esbuild\/|\nError: Build failed/);
    if (end > 0) out = out.slice(0, end);
  }
  return out.split('\n').filter((l) => !/^\s+at |^Node\.js v\d|^\s*\^\s*$|^\S+:\d+$/.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
let lastError = null, building = false, queued = null;
const clients = new Set();
const send = (event, data) => { for (const c of clients) c.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
const cssHrefs = () => {
  try { return [...readFileSync(join(outDir, 'index.html'), 'utf8').matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]); }
  catch { return []; }
};

async function rebuild(kind, files = []) {
  if (building) {
    // a save landed mid-build: run once more afterwards, with the strongest kind and all files
    queued = queued ? { kind: RANK[kind] > RANK[queued.kind] ? kind : queued.kind, files: [...new Set([...queued.files, ...files])] } : { kind, files };
    return;
  }
  building = true;
  const started = Date.now();
  const steps = kind == 'lib' ? [['library', 'scripts/build.mjs'], ['site', 'scripts/build-site.mjs']] : [['site', 'scripts/build-site.mjs']];
  let failed = null;
  for (const [label, script] of steps) {
    const r = await run(script, label == 'site' ? { SITE_OUT: OUT } : {});
    if (!r.ok) { failed = { step: label, message: r.out || 'build failed (no output)' }; break; }
  }
  const what = files.length ? files.slice(0, 3).join(', ') + (files.length > 3 ? ` +${files.length - 3}` : '') : 'initial build';
  if (failed) {
    lastError = { ...failed, files };
    console.error(`\n[dev ${t0()}] ✖ ${failed.step} build failed (${what}). The server keeps running and serves the last good build.\n${failed.message}\n`);
    send('build-error', lastError);
  } else {
    const recovered = !!lastError;
    lastError = null;
    log(`✓ ${kind == 'lib' ? 'library + site' : 'site'} built in ${Date.now() - started} ms (${what})${recovered ? ', error cleared' : ''}${files.length ? (kind == 'css' ? ' → CSS hot swap' : ' → reload') : ''}`);
    if (recovered) send('build-ok', {});
    if (kind == 'css') send('css', { hrefs: cssHrefs() });
    else send('reload', { kind });
  }
  building = false;
  if (queued) { const q = queued; queued = null; rebuild(q.kind, q.files); }
}

// ---------------------------------------------------------------- watcher with debounce
let timer = null, pendingKind = null, pendingFiles = new Set();
function changed(rel) {
  const kind = classify(rel);
  if (!kind) return;
  if (kind == 'restart') return log(`${rel} changed: restart the dev server (Ctrl+C, then npm run dev) to apply it.`);
  pendingFiles.add(rel);
  if (!pendingKind || RANK[kind] > RANK[pendingKind]) pendingKind = kind;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const k = pendingKind, f = [...pendingFiles];
    pendingKind = null, pendingFiles = new Set();
    rebuild(k, f);
  }, 80);
}
const watchers = [];
function startWatching() {
  const add = (dir, recursive) => {
    const abs = join(root, dir);
    if (!existsSync(abs)) return;
    const w = watch(abs, { recursive }, (_e, name) => changed(name ? join(dir, name.toString()) : dir + '/'));
    w.on('error', (e) => log(`watcher error on ${dir}: ${e.message}`));
    watchers.push(w);
  };
  add('site', true); // pages, partials, assets, public
  add('src', true); // library sources
  add('scripts', true); // build scripts, scripts/site/* (markup, highlighter, docs sources)
  add('types', true); // type definitions (docs source)
  add('.', false); // llms.txt, package.json, vercel.json, README.md (docs sources)
}

// ---------------------------------------------------------------- dev routes + HTML injection
const CLIENT_TAG = '<script type="module" src="/__dev/client.js"></script>';
const inject = (html) => (html.includes('</head>') ? html.replace('</head>', CLIENT_TAG + '\n</head>') : html + CLIENT_TAG);
async function handle(req, res, path) {
  if (path == '/__dev/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(`retry: 500\nevent: hello\ndata: ${JSON.stringify({ id: serverId, error: lastError })}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => (clearInterval(ping), clients.delete(res)));
    return true;
  }
  if (path == '/__dev/client.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
    res.end(readFileSync(clientFile));
    return true;
  }
  if (!existsSync(join(outDir, 'index.html')) && !/\.\w+$/.test(path)) {
    // no successful build yet: a placeholder page that still gets the overlay and reloads when the build succeeds
    res.writeHead(503, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Building…</title>${CLIENT_TAG}<p>No successful build yet. Fix the error shown in the terminal; this page reloads by itself.</p></html>`);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- start
export async function start({ port = +(process.argv[2] ?? process.env.PORT ?? 8080), tries = 10 } = {}) {
  log('building…');
  await rebuild('lib');
  let server;
  for (let i = 0, p = port; ; i++, p++) {
    try {
      server = await serve(p, OUT, { handle, html: inject, noStore: true });
      break;
    } catch (e) {
      if (e.code != 'EADDRINUSE' || port === 0 || i >= tries) throw e;
      console.warn(`[dev ${t0()}] Port ${p} is already in use (another dev server or preview?). Trying ${p + 1}…`);
    }
  }
  const actual = server.address().port;
  // also answer on IPv6 loopback, so http://localhost/ works whichever address the OS resolves first (macOS: ::1)
  const v6 = createServer(server.listeners('request')[0]);
  v6.on('error', () => {});
  v6.listen(actual, '::1');
  startWatching();
  console.log(`\n  ${DISPLAY} dev server: http://localhost:${actual}/\n  Live reload on: edits to site/, src/, llms.txt, README.md, types/ and the build scripts show up instantly (CSS hot-swaps).\n  Ctrl+C to stop. Production-like preview: npm run preview\n`);
  return { server, port: actual, close: () => { watchers.forEach((w) => w.close()); for (const c of clients) c.end(); server.close(); v6.close(); } };
}

const cleanup = () => {
  rmSync(outDir, { recursive: true, force: true });
  try { rmdirSync(join(root, '.site-dev')); } catch {} // only succeeds when no other dev server is running
};
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => process.exit(0));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start().catch((e) => {
    console.error(`[dev] could not start: ${e.message}`);
    process.exit(1);
  });
}
