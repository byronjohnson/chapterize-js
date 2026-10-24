// Copy buttons for build-time code blocks (scripts/site/markup.mjs). The buttons ship `hidden` and are
// shown only here, so without JS there's no dead button. Clipboard API first, then execCommand, then select.
// The result is announced through the layout's polite live region #copy-live (in the HTML from the start,
// so screen readers pick up the change; the visible button text alone isn't announced reliably).
const flash = (btn, text) => {
  btn.textContent = text;
  clearTimeout(btn._t);
  btn._t = setTimeout(() => (btn.textContent = 'Copy'), 1600);
};
const legacyCopy = (text) => {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.className = 'sr';
  document.body.append(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  ta.remove();
  return ok;
};
export function setupCopy(root = document) {
  for (const btn of root.querySelectorAll('.code-copy')) {
    const pre = btn.closest('.code').querySelector('pre');
    btn.hidden = false;
    btn.setAttribute('aria-label', 'Copy code: ' + btn.closest('.code').querySelector('.code-label').textContent);
    btn.addEventListener('click', async () => {
      const text = pre.textContent;
      let msg = 'Copied to clipboard';
      try {
        await navigator.clipboard.writeText(text);
        flash(btn, 'Copied');
      } catch {
        if (legacyCopy(text)) flash(btn, 'Copied');
        else (getSelection().selectAllChildren(pre), flash(btn, 'Press Ctrl+C'), (msg = 'Code selected, press Ctrl+C or Cmd+C to copy'));
      }
      const live = document.getElementById('copy-live');
      if (live) (live.textContent = ''), setTimeout(() => (live.textContent = msg), 50);
    });
  }
}
