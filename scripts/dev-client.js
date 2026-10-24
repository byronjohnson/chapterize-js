// Dev-only browser client, served by scripts/dev.mjs at /__dev/client.js and injected into HTML responses
// in dev mode only (never part of the site build). External file, so the page CSP (script-src 'self';
// connect-src 'self') still applies unchanged. Styles are set through the CSSOM, which CSP allows.
const state = (window.__dev = { events: [], id: null });
let overlay = null;

function showError(err) {
  hideError();
  overlay = document.createElement('div');
  overlay.id = '__dev-overlay';
  overlay.setAttribute('role', 'alert');
  Object.assign(overlay.style, {
    position: 'fixed', left: '1rem', right: '1rem', bottom: '1rem', zIndex: 2147483647, maxHeight: '60vh', overflow: 'auto',
    padding: '1rem 1.25rem', borderRadius: '12px', background: '#1a0b0f', color: '#ffd7dc', border: '1px solid #ff5a6e',
    boxShadow: '0 20px 60px rgba(0,0,0,.6)', font: '13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
  });
  const title = document.createElement('strong');
  title.textContent = `Build failed (${err.step}). Showing the last good build. Fix and save to recover.`;
  Object.assign(title.style, { display: 'block', color: '#ff8a98', marginBottom: '.5rem', paddingRight: '5rem' });
  const pre = document.createElement('pre');
  pre.textContent = err.message;
  Object.assign(pre.style, { margin: 0, whiteSpace: 'pre-wrap', background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit' });
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Dismiss';
  close.setAttribute('aria-label', 'Dismiss build error');
  Object.assign(close.style, { position: 'absolute', top: '.75rem', right: '.75rem', cursor: 'pointer', font: 'inherit', padding: '.25rem .6rem', borderRadius: '8px', border: '1px solid #ff5a6e', background: 'transparent', color: 'inherit' });
  close.onclick = hideError;
  overlay.append(close, title, pre);
  document.documentElement.append(overlay);
}
function hideError() {
  overlay?.remove();
  overlay = null;
}

// Swap stylesheets in place: load the new hashed file, then drop the old one (no flash, scroll position kept).
function swapCss(hrefs) {
  const base = (h) => new URL(h, location.href).pathname.replace(/-[A-Za-z0-9]{8}\.css$/, '');
  for (const href of hrefs) {
    const old = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => base(l.href) == base(href));
    if (!old) { location.reload(); return; }
    if (new URL(old.href).pathname == href) continue;
    const next = old.cloneNode();
    next.href = href;
    next.onload = () => { old.remove(); state.events.push({ type: 'css-applied', href }); };
    next.onerror = () => location.reload();
    old.after(next);
  }
}

function connect() {
  const es = new EventSource('/__dev/events');
  const on = (type, fn) => es.addEventListener(type, (e) => {
    const data = JSON.parse(e.data);
    state.events.push({ type, data });
    fn(data);
  });
  on('hello', (d) => {
    if (state.id && state.id != d.id) return location.reload(); // the dev server restarted: get fresh files
    state.id = d.id;
    d.error ? showError(d.error) : hideError();
  });
  on('reload', () => location.reload());
  on('css', (d) => swapCss(d.hrefs));
  on('build-error', showError);
  on('build-ok', hideError);
  es.onerror = () => {
    // EventSource retries on its own while the connection is merely interrupted. If the browser gave up
    // (server down long enough), keep trying until the dev server is back.
    if (es.readyState == EventSource.CLOSED) setTimeout(connect, 1000);
  };
}
connect();
