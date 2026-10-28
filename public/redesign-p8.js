/* Prompt 8: vault + control-room from 17f-vault-control-ops.html */
(function () {
  function P() { return window.__port || {}; }
  function wrapOf(id) { return P().wrapOf ? P().wrapOf(id) : null; }
  function whenCss(fn) { if (P().whenCss) P().whenCss(fn); else fn(); }
  function mark(id) { var h = document.getElementById(id); if (h) h.setAttribute('data-port-ready', '1'); }
  function loadSnip(url, cb) {
    fetch(url).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; }).then(cb);
  }

  function paintVault() {
    var wrap = wrapOf('vaultDesk');
    if (!wrap) { mark('vaultDesk'); return; }
    if (P().applyPageCss) P().applyPageCss(wrap, 'vault');
    wrap.classList.add('neon');
    loadSnip('/vault-snippet.html?v=3', function (html) {
      wrap.innerHTML = html || '<p>Vault did not load.</p>';
      if (typeof window.bind17fPage === 'function') window.bind17fPage(wrap, 'vault');
      stamp17f(wrap);
      if (P().finishPaint) P().finishPaint(wrap);
      mark('vaultDesk');
    });
  }

  function paintOps() {
    var wrap = wrapOf('opsDesk');
    if (!wrap) { mark('opsDesk'); return; }
    if (P().applyPageCss) P().applyPageCss(wrap, 'ops');
    wrap.classList.add('neon');
    loadSnip('/ops-snippet.html?v=10', function (html) {
      wrap.innerHTML = html || '<p>Control room did not load.</p>';
      if (typeof window.bind17fPage === 'function') window.bind17fPage(wrap, 'ops');
      stamp17f(wrap);
      if (P().finishPaint) P().finishPaint(wrap);
      mark('opsDesk');
    });
  }

  function stamp17f(wrap) {
    if (!wrap || !wrap.querySelectorAll) return;
    wrap.querySelectorAll('button, .lamp, .dial, .sw, .newl, .vs, .cbtn').forEach(function (el) {
      if (!el.getAttribute('data-action')) el.setAttribute('data-action', '17f-live');
    });
  }
  window.paintRedesignVault = function () { whenCss(paintVault); };
  window.paintRedesignOps = function () { whenCss(paintOps); };

  var desk = (window.STATE && window.STATE.desk) || '';
  if (desk === 'vault') window.paintRedesignVault();
  if (desk === 'ops') window.paintRedesignOps();
})();
