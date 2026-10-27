/* Prompt 8 pages: vault, ops board, space panel hook. */
(function () {
  function P() { return window.__port || {}; }
  function wrapOf(id) { return P().wrapOf ? P().wrapOf(id) : null; }
  function whenCss(fn) { if (P().whenCss) P().whenCss(fn); else fn(); }
  function mark(id) { var h = document.getElementById(id); if (h) h.setAttribute('data-port-ready', '1'); }
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  window.__openSpacePanel = function (el, root) {
    var id = el && (el.getAttribute('data-id') || el.getAttribute('data-space'));
    if (window.deskActions && window.deskActions['space-open'] && id) {
      window.deskActions['space-open'](el, root);
      return;
    }
    var host = document.getElementById('spacesDesk');
    var sr = host && host.shadowRoot;
    if (sr && typeof window.paintRedesignSpaces === 'function') {
      /* cards view already opens its panel via its own listener */
    }
  };

  function paintVault() {
    var wrap = wrapOf('vaultDesk');
    if (!wrap) { mark('vaultDesk'); return; }
    if (P().applyPageCss) P().applyPageCss(wrap, 'vault');
    wrap.innerHTML = '<div class="vaultx neon"><div class="bar"><h1>Vault</h1><span class="s">register of audits and documents</span></div><div id="vaultBody">Loading the register...</div></div>';
    var body = wrap.querySelector('#vaultBody');
    var fx = /fixture=mockup/.test(location.search || '');
    function rows(list) {
      return (list || []).map(function (d) {
        return '<tr data-action="vault-open" data-id="' + esc(d.id) + '"><td>' + esc(d.doc_id || d.id) + '</td><td>' + esc(d.name) + '</td><td>' + esc(d.version || '') + '</td><td>' + esc(d.status || '') + '</td><td>' + esc(d.verified_at || '') + '</td><td class="' + (d.owner ? '' : 'un') + '">' + esc(d.owner || 'Unassigned') + '</td><td>' + esc(d.note || '') + '</td></tr>';
      }).join('') || '<tr><td colspan="7">No documents yet.</td></tr>';
    }
    function draw(list) {
      body.innerHTML = '<table class="vt"><thead><tr><th>ID</th><th>Document</th><th>Version</th><th>Status</th><th>Verified</th><th>Owner</th><th>Note</th></tr></thead><tbody>' + rows(list) + '</tbody></table>';
    }
    if (fx) draw([{ id: 'v1', doc_id: 'CR-001', name: 'Control room rebuild', version: '1.0', status: 'Live', owner: 'Chad' }]);
    else if (typeof authFetch === 'function') {
      authFetch('/api/vault').then(function (r) { return r && r.ok ? r.json() : { docs: [] }; }).then(function (d) { draw(d.docs || []); }).catch(function () { draw([]); });
    } else draw([]);
    if (P().finishPaint) P().finishPaint(wrap);
    mark('vaultDesk');
  }

  function paintOps() {
    var wrap = wrapOf('opsDesk');
    if (!wrap) { mark('opsDesk'); return; }
    if (P().applyPageCss) P().applyPageCss(wrap, 'ops');
    wrap.innerHTML = '<div class="opsx neon"><div class="bar"><h1>Control room</h1><div class="seg"><button class="on" data-action="ops-tab" data-t="sys">4ormop system</button><button data-action="ops-tab" data-t="iq">4ormIQ</button><button data-action="ops-tab" data-t="map">+ Map another</button></div><button data-action="ops-sweep">Sweep now</button></div>'
      + '<div class="lamp-rail" id="lampRail">Loading lamps...</div>'
      + '<div class="dials" id="opsDials"></div>'
      + '<div class="engages" id="opsEng"></div>'
      + '<div class="send-stop"><button data-action="ops-stop-sends">Stop all sends</button><button data-action="ops-resume-sends">Resume</button></div>'
      + '<div class="api-board" id="opsApis"></div>'
      + '<div class="sys-map" id="opsMap"></div>'
      + '<div class="ops-bot"><div id="opsTests"></div><div id="opsItems"></div><div id="opsTape"></div></div></div>';
    function load() {
      if (typeof authFetch !== 'function') return;
      authFetch('/api/ops/dials').then(function (r) { return r && r.json(); }).then(function (d) {
        var el = wrap.querySelector('#opsDials');
        if (!el) return;
        var dials = (d && d.dials) || [];
        el.innerHTML = dials.map(function (x) {
          return '<button class="dial" data-action="ops-dial" data-k="' + esc(x.key) + '"><b>' + (x.value == null ? '-' : x.value) + '</b><small>' + esc(x.unit || '') + '</small><span>' + esc(x.label) + '</span><em>' + esc(x.note || '') + '</em></button>';
        }).join('') || '<p>No dial readings yet.</p>';
      }).catch(function () {});
      authFetch('/api/ops/switches').then(function (r) { return r && r.json(); }).then(function (d) {
        var el = wrap.querySelector('#opsEng');
        if (!el) return;
        el.innerHTML = ((d && d.switches) || []).map(function (s) {
          return '<div class="sw"><div><b>' + esc(s.label) + '</b><small>' + esc(s.sub || '') + '</small></div><button data-action="ops-switch" data-k="' + esc(s.key) + '" class="' + (s.on ? 'on' : '') + '">' + (s.on ? 'ON' : 'OFF') + '</button></div>';
        }).join('');
      }).catch(function () {});
      authFetch('/api/ops/apis').then(function (r) { return r && r.json(); }).then(function (d) {
        var el = wrap.querySelector('#opsApis');
        if (!el) return;
        el.innerHTML = ((d && d.apis) || []).map(function (a) {
          return '<div class="apic"><span class="lamp ' + esc(a.status || '') + '"></span><b>' + esc(a.name) + '</b><code>' + esc(a.endpoint || '') + '</code><em>' + (a.ms == null ? '-' : a.ms + ' ms') + '</em>'
            + '<button data-action="ops-ping" data-k="' + esc(a.key) + '">Ping</button><button data-action="ops-api-logs" data-k="' + esc(a.key) + '">Logs</button><button data-action="ops-api-pause" data-k="' + esc(a.key) + '">Pause</button></div>';
        }).join('');
      }).catch(function () {});
      authFetch('/api/ops/board').then(function (r) { return r && r.json(); }).then(function (d) {
        var rail = wrap.querySelector('#lampRail');
        if (rail && d && d.master) rail.innerHTML = '<div class="master ' + esc(d.master.state) + '">' + esc(d.master.label) + ' · ' + esc(d.master.since || '') + '</div>'
          + (d.lamps || []).map(function (l) { return '<button class="lamp ' + esc(l.color) + '" data-action="ops-lamp" data-k="' + esc(l.key) + '">' + esc(l.name) + '<small>' + esc(l.reading) + '</small></button>'; }).join('');
      }).catch(function () {});
    }
    load();
    if (P().finishPaint) P().finishPaint(wrap);
    mark('opsDesk');
  }

  window.paintRedesignVault = function () { whenCss(paintVault); };
  window.paintRedesignOps = function () { whenCss(paintOps); };
})();
