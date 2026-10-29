/* Side panels that open and close. Any page laid out as a grid with a narrow panel on the left and/or right
   (Documents folders and Drop into a Space, Lists, Links categories...) gets two small switches above it.
   Closing both gives the middle the whole width. The choice is kept per page. */
(function () {
  var KEY = 'sideToggles';
  function prefs() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function savePrefs(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  var CSS = '.st-bar{display:flex;justify-content:flex-end;gap:6px;margin:0 0 8px}'
    + '.st-bar button{border:1px solid #23252c;background:#111216;color:#c9d4f2;border-radius:999px;padding:3px 11px;font:700 11.5px/1.4 Inter,system-ui,sans-serif;cursor:pointer}'
    + '.st-bar button:hover{border-color:#4d7cff;color:#fff}.st-bar button.off{background:#4d7cff;border-color:#4d7cff;color:#fff}'
    + '.st-hide{display:none!important}';
  function narrow(el) { return el && el.offsetWidth > 120 && el.offsetWidth <= 340; }
  function wire(root, deskId) {
    if (!root.querySelector('style[data-st]')) {
      var st = document.createElement('style'); st.setAttribute('data-st', '1'); st.textContent = CSS;
      (root.querySelector('.port-body') || root).appendChild(st);
    }
    var grids = root.querySelectorAll('.lay, .lists, .wrap3, .lk-lay, .grid3');
    grids.forEach(function (g, gi) {
      if (g.__st || !g.offsetParent) return;
      var kids = Array.prototype.filter.call(g.children, function (c) { return c.offsetParent !== null && c.tagName !== 'STYLE'; });
      if (kids.length < 2 || kids.length > 3) return;
      var cols = getComputedStyle(g).gridTemplateColumns.split(' ').length;
      if (cols < 2 || cols > 3) return;
      var left = narrow(kids[0]) ? kids[0] : null;
      var right = kids.length === 3 && narrow(kids[2]) ? kids[2] : (kids.length === 2 && !left && narrow(kids[1]) ? kids[1] : null);
      if (!left && !right) return;
      g.__st = 1;
      var key = deskId + ':' + gi;
      var bar = document.createElement('div');
      bar.className = 'st-bar';
      var orig = g.style.gridTemplateColumns;
      function apply() {
        var p = prefs()[key] || {};
        if (left) left.classList.toggle('st-hide', !!p.l);
        if (right) right.classList.toggle('st-hide', !!p.r);
        var shown = Array.prototype.filter.call(g.children, function (c) { return c.tagName !== 'STYLE' && !c.classList.contains('st-hide') && c !== bar; });
        if (p.l || p.r) {
          g.style.gridTemplateColumns = shown.map(function (c) { return c === left || c === right ? (c.__w || c.offsetWidth) + 'px' : 'minmax(0,1fr)'; }).join(' ');
        } else g.style.gridTemplateColumns = orig;
        bar.innerHTML = (left ? '<button type="button" data-st="l" class="' + (p.l ? 'off' : '') + '">' + (p.l ? 'Show left panel' : 'Hide left panel') + '</button>' : '')
          + (right ? '<button type="button" data-st="r" class="' + (p.r ? 'off' : '') + '">' + (p.r ? 'Show right panel' : 'Hide right panel') + '</button>' : '');
      }
      if (left) left.__w = left.offsetWidth;
      if (right) right.__w = right.offsetWidth;
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-st]'); if (!b) return;
        var all = prefs(); var p = all[key] || {}; p[b.getAttribute('data-st')] = !p[b.getAttribute('data-st')]; all[key] = p; savePrefs(all); apply();
      });
      var prev = g.previousElementSibling; if (prev && prev.classList.contains('st-bar')) prev.remove();
      g.parentNode.insertBefore(bar, g);
      apply();
    });
  }
  function scan() {
    document.querySelectorAll('[id$="Desk"]').forEach(function (h) {
      if (h.shadowRoot && h.offsetParent !== null) wire(h.shadowRoot, h.id);
    });
  }
  setInterval(scan, 1200);
  window.addEventListener('load', scan);
})();
