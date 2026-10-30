/* Pinch / ctrl-wheel / +/- on a grid: column count 3-9, saved per user per grid. */
(function () {
  function prefs() {
    var S = window.STATE || (window.STATE = {});
    S.prefs = S.prefs || {};
    S.prefs.grid_zoom = S.prefs.grid_zoom || {};
    return S.prefs.grid_zoom;
  }
  function clamp(n) {
    n = Math.round(Number(n) || 4);
    return Math.max(2, Math.min(9, n));
  }
  function save(key, n) {
    prefs()[key] = n;
    if (typeof window.authFetch === 'function') {
      window.authFetch('/api/prefs', {
        method: 'PATCH',
        credentials: 'same-origin',
        quiet: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ grid_zoom: prefs() })
      }).catch(function () {});
    }
  }
  window.gridCols = function (key, fallback) {
    var n = prefs()[key];
    return clamp(n != null ? n : (fallback || 4));
  };
  window.applyGridCols = function (el, key, fallback) {
    if (!el) return;
    var n = window.gridCols(key, fallback);
    el.style.setProperty('--cols', String(n));
    el.setAttribute('data-cols', String(n));
  };
  /* Buttons: one step wider (dir 1, more columns) or closer (dir -1), applied to every grid with that key. */
  window.gridZoomStep = function (key, dir, fallback, els) {
    var cur = window.gridCols(key, fallback);
    var next = clamp(cur + dir);
    if (next !== cur) save(key, next);
    (els || []).forEach(function (el) { window.applyGridCols(el, key, fallback); });
    return next;
  };
  window.bindGridZoom = function (root, el, key, fallback) {
    if (!el || el._gridZoom) return;
    el._gridZoom = 1;
    el.setAttribute('data-zoom-key', key);
    window.applyGridCols(el, key, fallback);
    var acc = 0;
    function step(dir) {
      var cur = window.gridCols(key, fallback);
      var next = clamp(cur + dir);
      if (next === cur) return;
      save(key, next);
      var host = el.getRootNode ? el.getRootNode() : document;
      (host.querySelectorAll ? Array.prototype.slice.call(host.querySelectorAll('[data-zoom-key="' + key + '"]')) : []).concat([el]).forEach(function (g) { window.applyGridCols(g, key, fallback); });
      if (typeof window.onGridZoom === 'function') window.onGridZoom(key, next);
    }
    el.addEventListener('wheel', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      acc += e.deltaY;
      if (Math.abs(acc) < 40) return;
      step(acc > 0 ? 1 : -1);
      acc = 0;
    }, { passive: false });
    el.addEventListener('gesturechange', function (e) {
      e.preventDefault();
      if (e.scale > 1.08) { step(1); }
      else if (e.scale < 0.92) { step(-1); }
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === '+' || e.key === '=') { e.preventDefault(); step(-1); }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); step(1); }
    });
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  };
})();
