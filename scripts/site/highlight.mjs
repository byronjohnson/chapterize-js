// Tiny build-time syntax highlighter (zero dependencies). Output is escaped HTML with
// <span class="tk-*"> tokens; the site ships no highlighter at runtime.
// Languages: html (+ vue/svelte/astro, with <script>/<style>/front matter highlighted inside), js/jsx/ts/tsx,
// css, sh/bash, php, json, text. Token classes: c comment, s string, k keyword, n number, t tag,
// a attribute, p property, f function, v variable, o punctuation/operator.
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
const span = (cls, s) => (cls ? `<span class="tk-${cls}">${esc(s)}</span>` : esc(s));

const JS_KW = 'import|from|export|default|const|let|var|function|return|if|else|for|of|in|new|async|await|class|extends|type|interface|true|false|null|undefined|typeof|this|try|catch|throw|while|do|switch|case|break|continue|as|satisfies|void';
const RULES = {
  js: [
    ['c', /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
    ['s', /`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/y],
    ['k', new RegExp(`\\b(?:${JS_KW})\\b`, 'y')],
    ['n', /\b\d[\d_.]*(?:e[+-]?\d+)?\b/y],
    ['f', /[A-Za-z_$][\w$]*(?=\s*\()/y],
    ['t', /<\/?[A-Z][\w.]*|<\/?[a-z][\w-]*(?=[\s>/])/y], // JSX tags
    ['', /[A-Za-z_$][\w$]*/y],
  ],
  css: [
    ['c', /\/\*[\s\S]*?\*\//y],
    ['s', /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/y],
    ['k', /@[\w-]+/y],
    ['p', /[\w-]+(?=\s*:(?!:))/y],
    ['n', /-?\d*\.?\d+(?:px|ms|s|%|em|rem|vh|vw|deg|ch|fr)?\b/y],
    ['', /[\w-]+/y],
  ],
  sh: [
    ['c', /#[^\n]*/y],
    ['s', /'[^']*'|"(?:\\.|[^"\\])*"/y],
    ['f', /(?<=^|\n|&&\s?|\|\s?)\s*[\w./-]+/y],
    ['a', /\s--?[\w-]+/y],
    ['', /[^\s'"#]+/y],
  ],
  php: [
    ['c', /\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\//y],
    ['s', /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/y],
    ['v', /\$\w+/y],
    ['k', /\b(?:function|return|array|true|false|null|echo|use|fn)\b/y],
    ['f', /\w+(?=\s*\()/y],
    ['', /\w+/y],
  ],
  json: [
    ['p', /"(?:\\.|[^"\\])*"(?=\s*:)/y],
    ['s', /"(?:\\.|[^"\\])*"/y],
    ['k', /\b(?:true|false|null)\b/y],
    ['n', /-?\d+\.?\d*/y],
  ],
};
const lex = (code, rules) => {
  let out = '', i = 0, plain = '';
  const flush = () => ((out += esc(plain)), (plain = ''));
  outer: while (i < code.length) {
    for (const [cls, re] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m && m[0].length) {
        flush();
        out += span(cls, m[0]);
        i += m[0].length;
        continue outer;
      }
    }
    plain += code[i++];
  }
  return flush(), out;
};

function html(code, inner = 'js') {
  let out = '', i = 0;
  // Astro/Svelte-style front matter fence at the top: highlight as JS
  const fm = code.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) out += span('o', '---') + '\n' + lex(fm[1], RULES.js) + '\n' + span('o', '---') + '\n', (i = fm[0].length);
  const re = /<!--[\s\S]*?-->|<(\/?)([A-Za-z][\w:.-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)(\s*)(\/?)>/g;
  re.lastIndex = i;
  let m, last = i;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    if (m[0].startsWith('<!--')) out += span('c', m[0]);
    else {
      const [, close, tag, attrs, gap, self] = m;
      out += span('o', '<' + close) + span('t', tag);
      out += attrs.replace(/(\s+)([^\s=>/]+)(?:(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+))?/g, (_, ws, name, eq, val) =>
        '\u0000' + ws + '\u0001' + name + '\u0002' + (eq ? eq + '\u0003' + val + '\u0004' : ''))
        .split(/(\u0000|\u0001[^\u0002]*\u0002|\u0003[^\u0004]*\u0004)/).map((p) =>
          p == '\u0000' ? '' : p.startsWith('\u0001') ? span('a', p.slice(1, -1)) : p.startsWith('\u0003') ? span('s', p.slice(1, -1)) : esc(p)).join('');
      out += esc(gap) + span('o', self + '>');
      // highlight embedded <script> / <style> bodies
      const body = !close && !self && /^(script|style)$/i.test(tag) && code.slice(re.lastIndex).match(new RegExp(`^([\\s\\S]*?)(?=</${tag}>)`, 'i'));
      if (body) {
        out += lex(body[1], tag.toLowerCase() == 'style' ? RULES.css : RULES[inner] || RULES.js);
        re.lastIndex += body[1].length;
      }
    }
    last = re.lastIndex;
  }
  return out + esc(code.slice(last));
}

const ALIAS = { javascript: 'js', mjs: 'js', jsx: 'js', ts: 'js', tsx: 'js', typescript: 'js', bash: 'sh', shell: 'sh', zsh: 'sh', vue: 'html', svelte: 'html', astro: 'html', xml: 'html' };
const unesc = (s) => s.replace(/<[^>]+>/g, '').replace(/&#123;/g, '{').replace(/&#125;/g, '}').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
export function highlight(code, lang = 'text') {
  const l = ALIAS[lang] || lang;
  const out = l == 'html' ? html(code) : RULES[l] ? lex(code, RULES[l]) : esc(code);
  // invariant: highlighting only wraps text in spans; it must never change a character of the code
  if (unesc(out) !== code) {
    const a = unesc(out); let i = 0; while (a[i] === code[i]) i++;
    throw new Error(`highlight(${lang}) altered the code at ${i}: ${JSON.stringify(code.slice(i - 20, i + 20))} -> ${JSON.stringify(a.slice(i - 20, i + 20))}`);
  }
  return out;
}
