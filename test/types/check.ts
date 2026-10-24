import { init, spy, slug, defaults, version, type SpyOptions, type SpyChangeDetail } from 'chapterize-js';
import auto from 'chapterize-js/auto';
const o: SpyOptions = { build: 'article h2', offset: 64, marker: 'pill', hash: false, observe: true };
const ctl = init({ ...o, root: document });
ctl.refresh(); auto.refresh();
const nav = document.querySelector<HTMLElement>('nav')!;
const s = spy(nav, { marker: true });
s.go('intro', 'smooth'); s.go(0); s.marker('minimal'); s.marker(false);
const id: string | null = s.id, n: number = s.index + s.links.length;
const x: string = slug('Café & crème') + version + String(defaults.marker);
nav.addEventListener('spy:change', (e) => { const d: SpyChangeDetail = e.detail; d.link.focus(); });
// @ts-expect-error unknown preset
s.marker('dots');
// @ts-expect-error unknown option
init({ offest: 1 });
void id; void n; void x;
ctl.destroy();
