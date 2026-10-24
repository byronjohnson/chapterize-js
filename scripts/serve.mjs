// Minimal zero-dependency static server for the library tests and manual checks of the fixtures.
//   node scripts/serve.mjs [port]      (port also from PORT; default 8080) -> http://localhost:8080/test/fixtures/basic.html
// Serves this repo's root as-is (/test, /dist). The website and its Vercel-like server live in the sibling
// repo chapterize-js-site.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json',
};

// opts: handle(req, res, path) -> true if it answered the request itself; headers -> extra response headers
// (object, or a function of the path; the tests use it for a strict CSP on /test/).
export function serve(port = 0, opts = {}) {
  const root = resolve(projectRoot);
  const file = async (p) => { try { const s = await stat(join(root, p)); return s.isFile() ? p : null; } catch { return null; } };
  const server = createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    let p = normalize(decodeURIComponent(u.pathname)).split(sep).join('/');
    if (opts.handle && (await opts.handle(req, res, p))) return;
    if (!resolve(root, '.' + p).startsWith(root)) return res.writeHead(400).end();
    if (p.endsWith('/')) p += 'index.html';
    const hit = await file(p);
    if (!hit) return res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    const headers = { 'content-type': types[extname(hit)] || 'application/octet-stream' };
    if (opts.headers) Object.assign(headers, typeof opts.headers == 'function' ? opts.headers(p) : opts.headers);
    res.writeHead(200, headers);
    res.end(req.method == 'HEAD' ? undefined : await readFile(join(root, hit)));
  });
  return new Promise((r, j) => server.once('error', j).listen(port, '127.0.0.1', () => r(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = +(process.argv[2] ?? process.env.PORT ?? 8080);
  const s = await serve(port).catch((e) => {
    console.error(e.code == 'EADDRINUSE' ? `Port ${port} is already in use: PORT=8081 npm run serve` : e);
    process.exit(1);
  });
  console.log(`Serving ${projectRoot} at http://localhost:${s.address().port}/test/fixtures/basic.html`);
}
