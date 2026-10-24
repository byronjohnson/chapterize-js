// Library build: src/ -> dist/ (ESM, CJS, auto-init, script-tag IIFE, minified variants).
//   node scripts/build.mjs          build
//   node scripts/build.mjs --size   build and print min+gzip sizes
import { build, transform } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { NAME, GLOBAL, VERSION } from './brand.mjs';

const root = new URL('..', import.meta.url).pathname;
const out = root + 'dist/';
const banner = `/*! ${NAME} v${VERSION} | MIT */`;
const target = ['chrome111', 'firefox113', 'safari16.4'];

// marker.css is minified and inlined as a string (the library adopts it as a constructed stylesheet)
const cssText = {
  name: 'css-text',
  setup(b) {
    b.onLoad({ filter: /\.css$/ }, async (a) => ({
      contents: (await transform(readFileSync(a.path, 'utf8'), { loader: 'css', minify: true, target })).code.trim()
        // esbuild keeps the whitespace inside custom-property values; it is not significant here
        .replace(/,\s+/g, ',').replace(/(--[\w-]+):\s+/g, '$1:').replace(/\(\s+/g, '('),
      loader: 'text',
    }));
  },
};
const common = { bundle: true, write: false, target, legalComments: 'none', banner: { js: banner }, define: { __VERSION__: JSON.stringify(VERSION) }, plugins: [cssText] };
const files = {
  'index.js': { entryPoints: [root + 'src/index.js'], format: 'esm' },
  'index.min.js': { entryPoints: [root + 'src/index.js'], format: 'esm', minify: true },
  'index.cjs': { entryPoints: [root + 'src/index.js'], format: 'cjs' },
  'auto.js': { entryPoints: [root + 'src/auto.js'], format: 'esm' },
  'auto.min.js': { entryPoints: [root + 'src/auto.js'], format: 'esm', minify: true },
  'auto.cjs': { entryPoints: [root + 'src/auto.js'], format: 'cjs' },
  'global.js': { entryPoints: [root + 'src/global.js'], format: 'iife', globalName: GLOBAL },
  'global.min.js': { entryPoints: [root + 'src/global.js'], format: 'iife', globalName: GLOBAL, minify: true },
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const sizes = [];
for (const [file, opts] of Object.entries(files)) {
  const r = await build({ ...common, ...opts });
  const code = r.outputFiles[0].contents;
  writeFileSync(out + file, code);
  sizes.push([file, code.length, gzipSync(code, { level: 9 }).length]);
}
if (process.argv.includes('--size') || !process.env.QUIET)
  console.log(sizes.map(([f, b, g]) => `  dist/${f.padEnd(15)} ${String(b).padStart(6)} B   ${String(g).padStart(5)} B gzip`).join('\n'));
