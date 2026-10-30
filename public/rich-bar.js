/* Formatting bar for every email editor (30 Oct 2026).
   Text style (Normal, Heading, Subheading, Quote), size by name (Small, Normal, Large, Huge), bold, italic,
   underline, strike, text colour, highlight, bullets, numbers, alignment and Clear.
   It edits the contenteditable that follows it. One document-level listener, so it works inside shadow roots
   and survives repaints. Words only, no icons. */
(function () {
  if (window.richBar) return;
  var SIZES = [['Small', 12], ['Normal', 15], ['Large', 19], ['Huge', 26]];
  var BLOCKS = [['Normal text', 'p'], ['Heading', 'h2'], ['Subheading', 'h3'], ['Quote', 'blockquote']];
  var COLOURS = [['Black', '#1b2333'], ['4orm blue', '#2e6bf2'], ['Navy', '#1b2a5c'], ['Green', '#0f8a6a'], ['Red', '#c8283f'], ['Orange', '#c2610c'], ['Grey', '#6b7488']];
  var MARKS = [['Yellow', '#fff3a3'], ['Light blue', '#dbe7ff'], ['Light green', '#d9f5e6'], ['Pink', '#ffe0e6'], ['None', 'transparent']];

  var CSS = ''
    + '.rb{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:6px 8px;border:1px solid #d9dfea;border-bottom:0;border-radius:10px 10px 0 0;background:#f7f9fc;position:relative;font:600 12.5px/1 Inter,-apple-system,system-ui,sans-serif;color:#1b2333}'
    + '.rb .rb-b{height:28px;min-width:28px;padding:0 8px;border:1px solid transparent;border-radius:7px;background:transparent;color:#1b2333;font:700 12.5px/1 Inter,-apple-system,system-ui,sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}'
    + '.rb .rb-b:hover{background:#fff;border-color:#d9dfea}.rb .rb-b.on{background:#e6eeff;border-color:#b9cdfa;color:#1f4fc4}'
    + '.rb .rb-sep{width:1px;height:20px;background:#d9dfea;margin:0 3px}'
    + '.rb .rb-sw{width:12px;height:12px;border-radius:3px;border:1px solid rgba(0,0,0,.15);display:inline-block}'
    + '.rb .rb-dd{position:relative}.rb .rb-menu{display:none;position:absolute;left:0;top:32px;z-index:50;background:#fff;border:1px solid #d9dfea;border-radius:10px;box-shadow:0 14px 30px rgba(16,32,64,.16);padding:6px;min-width:170px}'
    + '.rb .rb-dd.open .rb-menu{display:block}'
    + '.rb .rb-o{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:7px 9px;border:0;border-radius:7px;background:none;color:#1b2333;font:600 13px/1.2 Inter,-apple-system,system-ui,sans-serif;cursor:pointer}'
    + '.rb .rb-o:hover{background:#f2f5fb}.rb .rb-o.on{background:#e6eeff;color:#1f4fc4}'
    + '.rb .rb-custom{text-transform:none;letter-spacing:0;margin:0;font-weight:600;display:flex;align-items:center;gap:8px;padding:7px 9px;font-size:12.5px;color:#5b6678}.rb .rb-custom input{width:34px;height:24px;border:1px solid #d9dfea;border-radius:6px;padding:0;background:none;cursor:pointer}'
    + '.rte{min-height:260px;border:1px solid #d9dfea;border-radius:0 0 10px 10px;padding:12px 14px;background:#fff;color:#1b2333;font:400 15px/1.55 Arial,Helvetica,sans-serif;outline:none;overflow:auto;white-space:normal;word-wrap:break-word}'
    + '.rte:focus{border-color:#2e6bf2;box-shadow:0 0 0 3px rgba(46,107,242,.15)}'
    + '.rte p{margin:0 0 10px}.rte h2{font-size:22px;margin:6px 0 10px}.rte h3{font-size:18px;margin:6px 0 8px}.rte blockquote{margin:6px 0 10px;padding:4px 12px;border-left:3px solid #c9d4ea;color:#4a5468}.rte ul,.rte ol{margin:0 0 10px;padding-left:22px}.rte a{color:#2e6bf2}';

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function btn(cmd, label, title, extra) { return '<button type="button" class="rb-b" data-rb="' + cmd + '" title="' + esc(title) + '"' + (extra || '') + '>' + label + '</button>'; }
  function menu(key, label, items) { return '<span class="rb-dd" data-rbdd="' + key + '"><button type="button" class="rb-b" data-rbopen="' + key + '">' + label + '</button><span class="rb-menu">' + items + '</span></span>'; }

  function html() {
    return '<div class="rb" data-rbbar>'
      + menu('block', '<span data-rblbl="block">Normal text</span>', BLOCKS.map(function (b) { return '<button type="button" class="rb-o" data-rb="block" data-v="' + b[1] + '">' + b[0] + '</button>'; }).join(''))
      + menu('size', '<span data-rblbl="size">Normal</span>', SIZES.map(function (z) { return '<button type="button" class="rb-o" data-rb="size" data-v="' + z[1] + '" style="font-size:' + Math.min(z[1], 20) + 'px">' + z[0] + '</button>'; }).join(''))
      + '<span class="rb-sep"></span>'
      + btn('bold', '<b>B</b>', 'Bold') + btn('italic', '<i style="font-family:Georgia,serif">I</i>', 'Italic') + btn('underline', '<u>U</u>', 'Underline') + btn('strikeThrough', '<s>S</s>', 'Strike through')
      + '<span class="rb-sep"></span>'
      + menu('colour', '<span class="rb-sw" data-rbsw="colour" style="background:#1b2333"></span>Colour', COLOURS.map(function (c) { return '<button type="button" class="rb-o" data-rb="colour" data-v="' + c[1] + '"><span class="rb-sw" style="background:' + c[1] + '"></span>' + c[0] + '</button>'; }).join('')
        + '<label class="rb-custom">Any colour <input type="color" data-rbpick="colour" value="#2e6bf2"></label>')
      + menu('mark', '<span class="rb-sw" style="background:#fff3a3"></span>Highlight', MARKS.map(function (c) { return '<button type="button" class="rb-o" data-rb="mark" data-v="' + c[1] + '"><span class="rb-sw" style="background:' + c[1] + '"></span>' + c[0] + '</button>'; }).join('')
        + '<label class="rb-custom">Any colour <input type="color" data-rbpick="mark" value="#fff3a3"></label>')
      + '<span class="rb-sep"></span>'
      + btn('insertUnorderedList', 'Bullets', 'Bulleted list') + btn('insertOrderedList', 'Numbers', 'Numbered list')
      + btn('justifyLeft', 'Left', 'Align left') + btn('justifyCenter', 'Centre', 'Centre')
      + '<span class="rb-sep"></span>'
      + btn('removeFormat', 'Clear', 'Remove formatting from the selection')
      + '</div>';
  }

  /* the editable the bar controls: the next contenteditable after it */
  function editorFor(bar) {
    var n = bar.nextElementSibling;
    while (n) { if (n.isContentEditable || n.getAttribute('contenteditable') === 'true') return n; var inner = n.querySelector && n.querySelector('[contenteditable="true"]'); if (inner) return inner; n = n.nextElementSibling; }
    return null;
  }
  function rootOf(node) { var r = node.getRootNode ? node.getRootNode() : document; return r; }
  function selOf(node) { var r = rootOf(node); return (r.getSelection ? r.getSelection() : null) || window.getSelection(); }
  var saved = new WeakMap();
  function remember(ed) {
    var sel = selOf(ed);
    if (sel && sel.rangeCount) { var r = sel.getRangeAt(0); if (ed.contains(r.commonAncestorContainer)) saved.set(ed, r.cloneRange()); }
  }
  function restore(ed) {
    ed.focus();
    var r = saved.get(ed), sel = selOf(ed);
    if (r && sel) { sel.removeAllRanges(); sel.addRange(r); }
  }
  function changed(ed) {
    try { ed.dispatchEvent(new Event('input', { bubbles: true, composed: true })); } catch (e) {}
    if (typeof ed.__rbChange === 'function') ed.__rbChange();
  }
  function exec(cmd, val) { try { document.execCommand('styleWithCSS', false, true); } catch (e) {} try { return document.execCommand(cmd, false, val); } catch (e) { return false; } }

  /* Size: mark the selection with the biggest size, then swap that mark for the exact pixel size. */
  function setSize(ed, px) {
    exec('fontSize', '7');
    ed.querySelectorAll('font[size="7"]').forEach(function (f) { var s = document.createElement('span'); s.style.fontSize = px + 'px'; while (f.firstChild) s.appendChild(f.firstChild); f.parentNode.replaceChild(s, f); });
    ed.querySelectorAll('span').forEach(function (s) { if (s.style.fontSize === 'xxx-large' || s.style.fontSize === '-webkit-xxx-large') s.style.fontSize = px + 'px'; });
  }

  function run(ed, cmd, v) {
    restore(ed);
    if (cmd === 'size') setSize(ed, +v);
    else if (cmd === 'block') exec('formatBlock', v === 'p' ? 'p' : v);
    else if (cmd === 'colour') exec('foreColor', v);
    else if (cmd === 'mark') exec(v === 'transparent' ? 'hiliteColor' : 'hiliteColor', v);
    else if (cmd === 'removeFormat') { exec('removeFormat'); exec('formatBlock', 'p'); }
    else exec(cmd);
    remember(ed);
    changed(ed);
    refresh(ed);
  }

  /* Keep the bar honest: show the style, size and toggles where the cursor is. */
  function barFor(ed) { var p = ed.previousElementSibling; while (p) { if (p.hasAttribute && p.hasAttribute('data-rbbar')) return p; p = p.previousElementSibling; } var host = ed.parentNode; return host && host.querySelector ? host.querySelector('[data-rbbar]') : null; }
  function refresh(ed) {
    var bar = barFor(ed); if (!bar) return;
    ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'].forEach(function (c) {
      var b = bar.querySelector('[data-rb="' + c + '"]'); if (!b) return;
      var on = false; try { on = document.queryCommandState(c); } catch (e) {}
      b.classList.toggle('on', !!on);
    });
    var sel = selOf(ed), node = sel && sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
    if (!node || !ed.contains(node)) return;
    var elx = node.nodeType === 1 ? node : node.parentNode;
    var px = parseFloat(getComputedStyle(elx).fontSize) || 15;
    var name = px <= 13 ? 'Small' : px <= 16.5 ? 'Normal' : px <= 22 ? 'Large' : 'Huge';
    var bl = 'Normal text', x = elx;
    while (x && x !== ed) { var t = (x.tagName || '').toLowerCase(); if (t === 'h2') { bl = 'Heading'; break; } if (t === 'h3') { bl = 'Subheading'; break; } if (t === 'blockquote') { bl = 'Quote'; break; } x = x.parentNode; }
    if (bl !== 'Normal text') name = bl === 'Heading' ? 'Large' : name;
    var a = bar.querySelector('[data-rblbl="size"]'); if (a) a.textContent = name;
    var b2 = bar.querySelector('[data-rblbl="block"]'); if (b2) b2.textContent = bl;
    var sw = bar.querySelector('[data-rbsw="colour"]'); if (sw) sw.style.background = getComputedStyle(elx).color;
  }

  function closeMenus(except) {
    document.querySelectorAll('.rb-dd.open').forEach(function (d) { if (d !== except) d.classList.remove('open'); });
    (window.__rbRoots || []).forEach(function (r) { r.querySelectorAll('.rb-dd.open').forEach(function (d) { if (d !== except) d.classList.remove('open'); }); });
  }
  function track(node) { var r = rootOf(node); if (r !== document) { window.__rbRoots = window.__rbRoots || []; if (window.__rbRoots.indexOf(r) < 0) window.__rbRoots.push(r); } }
  function pathHit(e, test) { var p = e.composedPath ? e.composedPath() : [e.target]; for (var i = 0; i < p.length; i++) { if (p[i] && p[i].nodeType === 1 && test(p[i])) return p[i]; } return null; }

  /* mousedown keeps the cursor in the email; the click does the work */
  document.addEventListener('mousedown', function (e) {
    var b = pathHit(e, function (n) { return n.hasAttribute('data-rb') || n.hasAttribute('data-rbopen'); });
    if (b) { e.preventDefault(); var bar = pathHit(e, function (n) { return n.hasAttribute('data-rbbar'); }); var ed = bar && editorFor(bar); if (ed) remember(ed); return; }
    if (!pathHit(e, function (n) { return n.classList && n.classList.contains('rb-dd'); })) closeMenus(null);
  }, true);
  document.addEventListener('click', function (e) {
    var bar = pathHit(e, function (n) { return n.hasAttribute('data-rbbar'); });
    if (!bar) return;
    track(bar);
    var ed = editorFor(bar); if (!ed) return;
    var open = pathHit(e, function (n) { return n.hasAttribute('data-rbopen'); });
    if (open) { e.preventDefault(); e.stopPropagation(); var dd = open.parentNode; var was = dd.classList.contains('open'); closeMenus(dd); dd.classList.toggle('open', !was); return; }
    var b = pathHit(e, function (n) { return n.hasAttribute('data-rb'); });
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    closeMenus(null);
    run(ed, b.getAttribute('data-rb'), b.getAttribute('data-v'));
  }, true);
  document.addEventListener('input', function (e) {
    var pick = pathHit(e, function (n) { return n.hasAttribute && n.hasAttribute('data-rbpick'); });
    if (!pick) return;
    var bar = pathHit(e, function (n) { return n.hasAttribute('data-rbbar'); });
    var ed = bar && editorFor(bar); if (!ed) return;
    run(ed, pick.getAttribute('data-rbpick'), pick.value);
  }, true);
  /* remember the cursor as it moves, and keep the bar in step */
  function onSel(e) {
    var ed = pathHit(e, function (n) { return n.isContentEditable && n.getAttribute('contenteditable') === 'true'; });
    if (!ed || !barFor(ed)) return;
    remember(ed); refresh(ed);
  }
  document.addEventListener('keyup', onSel, true);
  document.addEventListener('mouseup', onSel, true);

  /* keyboard: Cmd/Ctrl + B, I, U already work in a contenteditable; tell the page it changed */
  document.addEventListener('keydown', function (e) {
    if (!(e.metaKey || e.ctrlKey) || !/^[biu]$/i.test(e.key)) return;
    var ed = pathHit(e, function (n) { return n.isContentEditable && n.getAttribute('contenteditable') === 'true'; });
    if (ed && barFor(ed)) setTimeout(function () { changed(ed); refresh(ed); }, 0);
  }, true);

  function textToHtml(t) { return esc(t).replace(/\r?\n/g, '<br>'); }
  /* the plain text twin of the editor, with paragraphs as blank lines */
  function toText(ed) { return String(ed.innerText || ed.textContent || '').replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, ''); }

  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  window.richBar = { css: CSS, html: html, textToHtml: textToHtml, toText: toText, refresh: refresh };
})();
