// Fictional data only (eval/fixtures/README.md). Every capture runs the app's rules in the page
// right before the screenshot, then `verify` scans the visible text and refuses the capture if
// anything real-looking is left. The rules (the real values) live in rules.local.mjs, which is
// git-ignored; rules.example.mjs shows the shape.
import { apps, FAKE_PHONE } from './rules.local.mjs';

export { apps, FAKE_PHONE };

const PHONE = String.raw`(\+?\s?387[\s/.-]*\d{2}[\s/.-]*\d{3}[\s/.-]*\d{3,4})|(0\d{2}[\s/.-]?\d{3}[\s/.-]?\d{3,4})`;
const EMAIL = String.raw`[\w.+-]+@[\w-]+(\.[\w-]+)+`;

/** JS to run in the page: applies the app's rules to text nodes, inputs, titles and images. */
export function scrubScript(app) {
  return `(() => {
    document.querySelector('nextjs-portal')?.remove(); // the dev server's own indicator, not part of the app
    const rules = ${JSON.stringify(app.rules)}.map(([src, flags, to]) => [new RegExp(src, flags), to]);
    const apply = (s) => rules.reduce((acc, [re, to]) => acc.replace(re, to), s);
    const brand = ${JSON.stringify(app.brandNodes ?? [])};
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    for (const n of nodes) {
      let s = n.nodeValue;
      for (const [from, to] of brand) if (s.trim() === from) s = s.replace(from, to);
      s = apply(s);
      if (s !== n.nodeValue) n.nodeValue = s;
    }
    for (const el of document.querySelectorAll('input, textarea')) {
      if (el.placeholder) el.placeholder = apply(el.placeholder);
      if (el.value && el.type !== 'checkbox' && el.type !== 'radio') { const v = apply(el.value); if (v !== el.value) el.value = v; }
    }
    for (const el of document.querySelectorAll('[aria-label], [title], [alt]')) {
      for (const a of ['aria-label', 'title', 'alt']) { const v = el.getAttribute(a); if (v) el.setAttribute(a, apply(v)); }
    }
    // Contact links, whatever the markup around them: one text node each.
    for (const a of document.querySelectorAll('a[href^="mailto:"]')) a.textContent = ${JSON.stringify(app.email)};
    for (const a of document.querySelectorAll('a[href^="tel:"]')) a.textContent = ${JSON.stringify(FAKE_PHONE)};
    document.title = apply(document.title);
    // Logos and photos: <img>, inline SVG, and anything drawn with a CSS background or mask
    // (a logo can be a span with mask-image, which no src attribute reveals).
    const hideParts = ${JSON.stringify(app.hideImages)};
    const chrome = 'header, nav, [class*="logo"], [class*="brand"]';
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      const drawn = (cs.maskImage !== 'none' && cs.maskImage) || (cs.backgroundImage !== 'none' && cs.backgroundImage) || '';
      const isImage = el.tagName === 'IMG' || el.tagName === 'SVG' || drawn !== '';
      if (!isImage) continue;
      let src = [el.currentSrc, el.getAttribute?.('src'), el.getAttribute?.('data-logo-src'), drawn].filter(Boolean).join(' ').toLowerCase();
      try { src = decodeURIComponent(src); } catch {}
      const inChrome = el.closest(chrome) !== null;
      if (inChrome || hideParts.some((part) => src.includes(part))) el.style.visibility = 'hidden';
    }
    return nodes.length;
  })()`;
}

/** JS to run after scrubbing: anything real-looking left in the visible text, or null. */
export function verifyScript(app) {
  return `(() => {
    const text = document.body.innerText + ' ' + document.title + ' ' + [...document.querySelectorAll('input, textarea')].map((i) => i.value + ' ' + i.placeholder).join(' ');
    const found = [];
    for (const word of ${JSON.stringify(app.forbidden)}) if (text.toLowerCase().includes(word.toLowerCase())) found.push(word);
    for (const m of text.matchAll(new RegExp(${JSON.stringify(PHONE)}, 'g'))) if (!m[0].replace(/\\s/g, '').endsWith('61000000')) found.push('phone ' + m[0]);
    for (const m of text.matchAll(new RegExp(${JSON.stringify(EMAIL)}, 'g'))) if (!m[0].endsWith('.example')) found.push('email ' + m[0]);
    return found.length ? found : null;
  })()`;
}
