/**
 * Formatted email text from the editors (30 Oct 2026).
 * Only what an email needs survives: bold, italic, underline, strike, colour, highlight, size, headings,
 * quotes, lists, links and line breaks. Scripts, images, frames, event handlers and every other attribute are dropped.
 */
const ALLOWED = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'span', 'font', 'a', 'ul', 'ol', 'li', 'br', 'p', 'div', 'h2', 'h3', 'blockquote']);
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|svg|math|template|noscript|textarea|select|head|title)\b[\s\S]*?<\/\1\s*>/gi;
const STYLE_OK = new Set(['color', 'background-color', 'font-size', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'text-align']);
const SIZE_OK = /^(x-small|small|medium|large|x-large|xx-large|\d{1,2}(\.\d)?(px|pt))$/;
const COLOUR_OK = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)|[a-z]{3,20})$/i;

function esc(v: string) {
  return v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

function cleanStyle(style: string) {
  const out: string[] = [];
  for (const part of style.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).trim().toLowerCase();
    const v = part.slice(i + 1).trim().replace(/\s*!important\s*$/i, '');
    if (!STYLE_OK.has(k) || /url\(|expression|javascript:|[<>"]/i.test(v)) continue;
    if ((k === 'color' || k === 'background-color') && !COLOUR_OK.test(v)) continue;
    if (k === 'font-size' && !SIZE_OK.test(v)) continue;
    if (k === 'font-weight' && !/^(bold|normal|[1-9]00)$/.test(v)) continue;
    if (k === 'font-style' && !/^(italic|normal)$/.test(v)) continue;
    if ((k === 'text-decoration' || k === 'text-decoration-line') && !/^(underline|line-through|none)( (underline|line-through))?$/.test(v)) continue;
    if (k === 'text-align' && !/^(left|center|right)$/.test(v)) continue;
    out.push(`${k}:${v}`);
  }
  return out.join(';');
}

function attr(attrs: string, name: string) {
  const m = attrs.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4] ?? '') : '';
}

function decodeEntities(v: string) {
  return v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** Keep only safe formatting. Text between tags is kept as written (it is already escaped by the browser). */
export function sanitizeRich(input: unknown, max = 30000): string {
  let html = String(input || '').slice(0, max * 2);
  html = html.replace(/<!--[\s\S]*?-->/g, '').replace(DROP_WITH_CONTENT, '');
  const out = html.replace(/<\s*(\/?)\s*([a-z0-9]+)([^>]*)>/gi, (_m, close: string, tagRaw: string, attrs: string) => {
    const tag = tagRaw.toLowerCase();
    if (!ALLOWED.has(tag)) return '';
    if (close) return tag === 'br' ? '' : `</${tag}>`;
    if (tag === 'br') return '<br>';
    const keep: string[] = [];
    const style = cleanStyle(decodeEntities(attr(attrs, 'style')));
    if (style) keep.push(`style="${esc(style)}"`);
    if (tag === 'a') {
      const href = decodeEntities(attr(attrs, 'href')).trim();
      if (/^(https?:\/\/|mailto:)[^\s"<>]+$/i.test(href)) keep.push(`href="${esc(href)}"`);
    }
    if (tag === 'font') {
      const color = attr(attrs, 'color');
      if (COLOUR_OK.test(color)) keep.push(`color="${esc(color)}"`);
      const size = attr(attrs, 'size');
      if (/^[1-7]$/.test(size)) keep.push(`size="${size}"`);
    }
    return `<${tag}${keep.length ? ' ' + keep.join(' ') : ''}>`;
  });
  return out.slice(0, max);
}

/** True when the editor HTML carries any formatting beyond plain lines (otherwise the plain text is used). */
export function hasFormatting(html: string) {
  return /<(b|strong|i|em|u|s|strike|font|a|ul|ol|h2|h3|blockquote)\b|style="/i.test(html);
}

/** Fill {{first_name}}, {{company}} and {{name}} inside formatted HTML, escaping the values. */
export function fillRich(html: string, first: string, company: string, name: string) {
  return html.replaceAll('{{first_name}}', esc(first)).replaceAll('{{company}}', esc(company)).replaceAll('{{name}}', esc(name));
}

/** Cut the typed sign-off ("With Gratitude, ...") so an info pack can add its own styled signature. */
export function cutSignOff(html: string) {
  return html.replace(/(?:<[^>]+>|\s|&nbsp;)*With Gratitude,[\s\S]*$/i, '').trim();
}
