// Site script (every page with the site layout). The library is imported by its package name; the site build
// aliases that to the freshly built dist/, so the site always dogfoods the real build.
import { init } from 'chapterize-js';
import { setupCopy } from './code.js';

init();
setupCopy();

// Homepage / frameworks glue (not part of the library): section counters, the mobile bar label and the
// header progress fallback, all from the bubbling spy:change event.
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const otp = $('otp');
document.addEventListener('spy:change', (e) => {
  const nav = e.target, { link, index } = e.detail;
  const items = [...nav.querySelectorAll(':scope > ol > li')];
  const n = pad(items.indexOf(link.closest('nav > ol > li')) + 1), total = pad(items.length);
  const last = nav.querySelectorAll('a').length - 1;
  document.documentElement.style.setProperty('--read', last > 0 ? index / last : 1);
  if (otp?.contains(nav)) {
    $('otp-count').textContent = `${n}/${total}`;
    const cur = $('otp-current');
    if (cur.textContent != link.textContent) {
      cur.textContent = link.textContent;
      cur.classList.remove('swap'), cur.offsetWidth, cur.classList.add('swap');
    }
  } else if ($('side-count')) $('side-count').textContent = `${n} / ${total}`;
});

if (otp) {
  // Close the mobile sheet on choosing a section (capture phase: before the library measures the scroll target,
  // so it measures the collapsed layout), on Escape, and on an outside click.
  otp.addEventListener('click', (e) => e.target.closest('nav a') && (otp.open = false), true);
  document.addEventListener('keydown', (e) => e.key == 'Escape' && otp.open && ((otp.open = false), otp.querySelector('summary').focus()));
  document.addEventListener('click', (e) => otp.open && !otp.contains(e.target) && (otp.open = false));
}
