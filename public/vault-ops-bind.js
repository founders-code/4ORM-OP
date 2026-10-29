/* Live Vault + Control room. Snippet HTML is chrome only — numbers come from /api. */
(function () {
  /* Library entries are markdown: escaped first, then headings, lists, bold, code and links. */
  function mdEsc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mdInline(t) {
    return t.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function mdRender(src) {
    var out = [], inCode = false, inList = false;
    String(src).split(/\r?\n/).forEach(function (line) {
      if (/^```/.test(line)) { if (inList) { out.push('</ul>'); inList = false; } out.push(inCode ? '</pre>' : '<pre>'); inCode = !inCode; return; }
      if (inCode) { out.push(mdEsc(line) + '\n'); return; }
      var e = mdEsc(line), m;
      if ((m = e.match(/^\s*[-*] (.*)$/))) { if (!inList) { out.push('<ul>'); inList = true; } out.push('<li>' + mdInline(m[1]) + '</li>'); return; }
      if (inList) { out.push('</ul>'); inList = false; }
      if ((m = e.match(/^(#{1,4}) (.*)$/))) { out.push('<h' + (m[1].length + 2) + '>' + mdInline(m[2]) + '</h' + (m[1].length + 2) + '>'); return; }
      if (/^---+$/.test(line.trim())) { out.push('<hr>'); return; }
      out.push(e.trim() ? '<p>' + mdInline(e) + '</p>' : '');
    });
    if (inList) out.push('</ul>'); if (inCode) out.push('</pre>');
    return out.join('');
  }

  function $(root, s) { return root.querySelector(s); }
  function $$(root, s) { return Array.prototype.slice.call(root.querySelectorAll(s)); }
  function api(url, opts) {
    var fn = window.authFetch || fetch;
    opts = opts || {};
    var headers = Object.assign({ 'content-type': 'application/json' }, opts.headers || {});
    return fn(url, Object.assign({ credentials: 'same-origin', quiet: true, headers: headers }, opts));
  }
  function dash(v, reason) {
    if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) return { text: '-', reason: reason || 'no sample yet' };
    return { text: String(v), reason: '' };
  }
  function toast(root, m) {
    var t = $(root, '#toast'); var msg = $(root, '#tmsg');
    if (!msg || !t) return;
    msg.textContent = m;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 3500);
  }
  function modal(root, h) {
    var box = $(root, '#mbox'); var m = $(root, '#modal');
    if (!box || !m) return;
    box.innerHTML = h;
    m.classList.add('open');
  }
  function closeModal(root) {
    var m = $(root, '#modal');
    if (m) m.classList.remove('open');
  }
  function nowVan() {
    return new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  }
  function showPages(root, mode, tab) {
    var vault = mode !== 'ops';
    var el;
    el = $(root, '#barVault'); if (el) el.style.display = vault ? '' : 'none';
    el = $(root, '#barControl'); if (el) el.style.display = vault ? 'none' : '';
    var pgV = $(root, '#pg-vault');
    var pgM = $(root, '#pg-map');
    var pgL = $(root, '#pg-ledger');
    if (pgV) { pgV.classList.toggle('show', vault); pgV.style.display = vault ? 'block' : 'none'; }
    var wantMap = !vault && tab !== 'ledger';
    var wantLed = !vault && tab === 'ledger';
    if (pgM) { pgM.classList.toggle('show', wantMap); pgM.style.display = wantMap ? 'block' : 'none'; }
    if (pgL) { pgL.classList.toggle('show', wantLed); pgL.style.display = wantLed ? 'block' : 'none'; }
    $$(root, '#iseg span').forEach(function (x) {
      x.classList.toggle('on', (tab === 'ledger' && x.getAttribute('data-v') === 'ledger') || (tab !== 'ledger' && x.getAttribute('data-v') === 'map'));
    });
    el = $(root, '#crumb');
    if (el) el.textContent = vault ? 'Vault' : 'Control room';
  }
  function openDrawer(root) {
    var d = $(root, '#drawer'); var s = $(root, '#scrim');
    if (d) {
      d.style.width = 'min(760px, 96vw)';
      d.style.minWidth = 'min(760px, 96vw)';
      d.classList.add('open');
    }
    if (s) s.classList.add('open');
  }
  function closeDrawer(root) {
    var d = $(root, '#drawer'); var s = $(root, '#scrim');
    if (d) d.classList.remove('open');
    if (s) s.classList.remove('open');
  }

  function bindVault(root) {
    var org = 'all', kind = 'all', q = '', docs = [], reason = 'no documents in the vault yet';
    var ORGS = ['Library', '4ormIQ', '4ormop', '4orm Finance', 'Important documents'];
    function rowOf(d) {
      return {
        org: d.org || 'Important documents',
        kind: d.kind || 'Registers',
        id: d.doc_id || d.id || '-',
        n: d.name || '-',
        v: d.version || '',
        st: d.status || '-',
        dt: d.verified_at ? String(d.verified_at).slice(0, 10) : '',
        own: d.owner || '-',
        note: d.note || '',
        uuid: d.id
      };
    }
    function stp(s) {
      return s === 'Current' ? 'p-cur' : s === 'Draft' ? 'p-dr' : s === 'Live' ? 'p-live' : /due|Scheduled/i.test(s) ? 'p-due' : 'p-sch';
    }
    function edgeClass(s) {
      if (s === 'Current' || s === 'Live' || s === 'Written') return 'cur';
      if (s === 'Draft') return 'dr';
      if (/due|Scheduled|Rebuild/i.test(s || '')) return 'due';
      return 'dr';
    }
    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function previewOf(x) {
      var note = String(x.note || '').trim();
      if (note) return note.replace(/\s*needs\s+[A-Z0-9-]+\s*$/i, '').trim() || note;
      return x.n || '';
    }
    function depOf(x) {
      var m = String(x.note || '').match(/\bneeds\s+([A-Z0-9-]+)/i);
      return m ? m[0] : '';
    }
    function verStrip(v) {
      var m = String(v || '').match(/(\d+)/);
      var filled = m ? Math.min(6, Math.max(1, parseInt(m[1], 10))) : (v ? 1 : 0);
      var total = Math.max(4, filled);
      var h = '';
      var i;
      for (i = 0; i < total; i++) h += '<i' + (i < filled ? ' class="f"' : '') + '></i>';
      return '<div class="ver">' + h + '</div>';
    }
    function cardHTML(x) {
      var own = (!x.own || x.own === '-' || x.own === 'Unassigned') ? 'Unassigned' : x.own;
      var none = own === 'Unassigned';
      var dep = depOf(x);
      var meta = '';
      if (x.dt) meta += '<span>verified ' + esc(x.dt) + '</span>';
      else if (/due|Rebuild/i.test(x.st || '')) meta += '<span>' + esc(String(x.st).toLowerCase()) + '</span>';
      else if (/Draft/i.test(x.st || '')) meta += '<span>draft</span>';
      if (dep) meta += '<span class="dep">' + esc(dep) + '</span>';
      return '<div class="dc ' + edgeClass(x.st) + '" data-id="' + esc(x.id) + '">'
        + '<div class="id">' + esc(x.id) + '</div>'
        + '<b>' + esc(x.n) + '</b>'
        + '<div class="pv">' + esc(previewOf(x)) + '</div>'
        + verStrip(x.v)
        + (meta ? '<div class="meta2">' + meta + '</div>' : '')
        + '<div class="m"><span class="ow' + (none ? ' none' : '') + '">' + esc(own) + '</span>'
        + '<span class="v">' + esc(x.v || '-') + '</span></div></div>';
    }
    function nav() {
      var h = '<div class="vs' + (org === 'all' ? ' on' : '') + '" data-o="all">Everything<span class="c">' + docs.length + '</span></div>';
      ORGS.forEach(function (o) {
        var n = docs.filter(function (r) { return r.org === o; });
        h += '<div class="vs' + (org === o && kind === 'all' ? ' on' : '') + '" data-o="' + o + '">' + o + '<span class="c">' + n.length + '</span></div>';
        ['Audits', 'Registers', 'Corporate', 'Agreements', 'Capital'].forEach(function (k) {
          var m = n.filter(function (r) { return r.kind === k; });
          if (!m.length) return;
          h += '<div class="vs sub' + (org === o && kind === k ? ' on' : '') + '" data-o="' + o + '" data-k="' + k + '">' + k + '<span class="c">' + m.length + '</span></div>';
        });
      });
      var box = $(root, '#vnav'); if (box) box.innerHTML = h;
      $$(root, '.vs').forEach(function (e) {
        e.onclick = function () { org = e.getAttribute('data-o'); kind = e.getAttribute('data-k') || 'all'; nav(); render(); };
      });
    }
    function render() {
      var rows = docs.filter(function (r) { return (org === 'all' || r.org === org) && (kind === 'all' || r.kind === kind); });
      if (q) rows = rows.filter(function (r) { return (r.id + ' ' + r.n + ' ' + r.note).toLowerCase().indexOf(q) >= 0; });
      var vt = $(root, '#vt'); if (vt) vt.textContent = (org === 'all' ? 'Everything' : org) + (kind === 'all' ? '' : ' · ' + kind);
      var vst = $(root, '#vst'); if (vst) vst.textContent = rows.length ? (rows.length + ' documents') : reason;
      var cur = rows.filter(function (r) { return r.st === 'Current' || r.st === 'Live'; }).length;
      var dr = rows.filter(function (r) { return r.st === 'Draft'; }).length;
      var due = rows.filter(function (r) { return /due|Scheduled/i.test(r.st); }).length;
      var un = rows.filter(function (r) { return r.own === 'Unassigned' || r.own === '-'; }).length;
      var kp = $(root, '#vkp');
      if (kp) kp.innerHTML = '<div class="kt g"><b>' + (docs.length ? cur : '-') + '</b><span>current or live</span></div><div class="kt a"><b>' + (docs.length ? dr : '-') + '</b><span>drafts</span></div><div class="kt r"><b>' + (docs.length ? due : '-') + '</b><span>due or scheduled</span></div><div class="kt r"><b>' + (docs.length ? un : '-') + '</b><span>with no owner</span></div>';
      var KIND_ORDER = ['Index', '4orm skills', 'House rules', 'Design and build rules', 'Processes', 'CEO brain', 'Design skills', 'Business advisory skills', 'Audits', 'Registers', 'Corporate', 'Agreements', 'Capital'];
      var groups = [];
      var seen = {};
      rows.forEach(function (r) {
        var key = r.org + '\0' + r.kind;
        if (!seen[key]) {
          seen[key] = { org: r.org, kind: r.kind, items: [] };
          groups.push(seen[key]);
        }
        seen[key].items.push(r);
      });
      groups.sort(function (a, b) {
        var oa = ORGS.indexOf(a.org); var ob = ORGS.indexOf(b.org);
        if (oa < 0) oa = 99; if (ob < 0) ob = 99;
        if (oa !== ob) return oa - ob;
        var ka = KIND_ORDER.indexOf(a.kind); var kb = KIND_ORDER.indexOf(b.kind);
        if (ka < 0) ka = 99; if (kb < 0) kb = 99;
        return ka - kb;
      });
      var h = '';
      if (!rows.length) {
        h = '<div class="col"><div class="ch"><div><b>Vault</b></div><span class="c">0</span></div><div class="cb"><div class="pv" style="padding:8px">' + esc(reason) + '</div><div class="addc" data-add="1">+ Add</div></div></div>';
      } else {
        groups.forEach(function (g) {
          var missing = g.items.some(function (x) { return !x.own || x.own === '-' || x.own === 'Unassigned'; });
          h += '<div class="col"><div class="ch"><div><div class="o">' + esc(g.org) + '</div><b>' + esc(g.kind) + '</b></div>'
            + '<span class="c' + (missing ? ' r' : '') + '">' + g.items.length + '</span></div><div class="cb">';
          g.items.forEach(function (x) { h += cardHTML(x); });
          h += '<div class="addc" data-o="' + esc(g.org) + '" data-k="' + esc(g.kind) + '">+ Add</div></div></div>';
        });
      }
      var board = $(root, '#vboard'); if (board) board.innerHTML = h;
      $$(root, '#vboard .dc').forEach(function (e) {
        e.onclick = function () { openDoc(e.getAttribute('data-id')); };
      });
    }
    function openDoc(id) {
      var x = docs.filter(function (r) { return r.id === id; })[0];
      if (!x) return;
      var dbc = $(root, '#dbc'); if (dbc) dbc.innerHTML = 'Vault / ' + x.org + ' / ' + x.kind + ' / <b>' + x.id + '</b>';
      var body = $(root, '#dbody');
      if (body) body.innerHTML = '<div class="vdoc"><div class="paper" id="vpaper">Loading the document…</div><div><div class="box"><h4>This document</h4><div class="vfacts"><div><small>ID</small><span>' + x.id + '</span></div><div><small>Version</small><span>' + (x.v || '-') + '</span></div><div><small>Status</small><span class="pill ' + stp(x.st) + '">' + x.st + '</span></div><div><small>Verified</small><span>' + (x.dt || '-') + '</span></div><div><small>Owner</small><span>' + x.own + '</span></div></div><button class="btn" type="button" data-action="vault-source">Open the source</button></div><div class="box" id="vvers"><h4>Versions</h4></div><div class="box" id="vdep"><h4>Depends on</h4></div></div></div>';
      var foot = $(root, '#dfoot');
      if (foot) foot.innerHTML = '<span class="msg">' + x.id + ' · ' + x.n + '</span><button class="btn" type="button" data-action="vault-assign">Assign an owner</button><label class="btn pri">Upload a new version<input type="file" id="vup" hidden></label>';
      openDrawer(root);
      var key = x.uuid || x.id;
      var asg = foot && foot.querySelector('[data-action="vault-assign"]');
      if (asg) asg.onclick = function () {
        var box = document.createElement('span');
        box.innerHTML = '<input type="text" placeholder="Owner name" value="' + String(x.own || '').replace(/"/g, '&quot;') + '" style="height:32px;border-radius:8px;border:1px solid #2a2c35;background:#18191f;color:#fff;padding:0 10px;font:inherit;margin-right:6px"><button class="btn pri" type="button">Save owner</button>';
        asg.replaceWith(box);
        var inp = box.querySelector('input'); inp.focus();
        function save() {
          var v = inp.value.trim(); if (!v) return;
          var fn = window.authFetch || fetch;
          fn('/api/vault', { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: key, owner: v }) })
            .then(function (r) { return r && r.ok ? r.json() : null; })
            .then(function (j) { if (!j || !j.saved) throw 0; x.own = v; toast(root, 'Owner set: ' + v); openDoc(id); })
            .catch(function () { toast(root, 'Could not save the owner. Try again.'); });
        }
        box.querySelector('button').onclick = save;
        inp.onkeydown = function (e) { if (e.key === 'Enter') save(); };
      };
      api('/api/vault/' + encodeURIComponent(key)).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (d) {
        var paper = $(root, '#vpaper');
        if (!paper) return;
        var b = (d && d.body) || {};
        if (b.kind === 'pdf' && b.url) paper.innerHTML = '<iframe src="' + b.url + '" title="' + x.n + '" style="width:100%;height:70vh;border:0;background:#fff"></iframe>';
        else if (b.kind === 'drive' && b.url) paper.innerHTML = '<iframe src="' + b.url + '" title="' + x.n + '" style="width:100%;height:70vh;border:0;background:#fff"></iframe>';
        else if (b.kind === 'json') {
          api(b.path || '/data/vault_seed.json').then(function (r) { return r && r.ok ? r.json() : null; }).then(function (j) {
            var rows = Array.isArray(j) ? j : (j && (j.docs || j.documents || j.register)) || [];
            var keys = rows[0] ? Object.keys(rows[0]) : [];
            paper.innerHTML = '<h5>' + x.n + '</h5><table class="t"><tr>' + keys.map(function (k) { return '<th>' + k + '</th>'; }).join('') + '</tr>' + rows.slice(0, 80).map(function (row) {
              return '<tr>' + keys.map(function (k) { return '<td>' + String(row[k] == null ? '' : row[k]) + '</td>'; }).join('') + '</tr>';
            }).join('') + '</table>';
          }).catch(function () { paper.textContent = x.n; });
        } else if (b.kind === 'md' || b.text) {
          paper.innerHTML = '<h5>' + mdEsc(x.n) + '</h5><div class="vmd">' + mdRender(String(b.text || x.note || '')) + '</div>';
        } else paper.innerHTML = '<h5>' + x.n + '</h5><p>' + (x.note || 'No stored copy to preview yet.') + '</p>';
        var srcBtn = body && body.querySelector('[data-action="vault-source"]');
        if (srcBtn) {
          var srcUrl = b.url || (d && (d.url || d.driveUrl)) || '';
          if (srcUrl) srcBtn.onclick = function () { window.open(srcUrl, '_blank', 'noopener'); };
          else { srcBtn.disabled = true; srcBtn.textContent = 'No source file yet'; }
        }
        var vers = $(root, '#vvers');
        if (vers) {
          var vs = (d && d.versions) || [];
          vers.innerHTML = '<h4>Versions</h4>' + (vs.length ? vs.map(function (v) {
            return '<div>' + (v.version || '-') + ' · ' + (v.superseded_at ? 'superseded' : 'current') + ' · ' + (v.file || '') + '</div>';
          }).join('') : '<div>Current ' + (x.v || '-') + '</div>') + '<label for="vup" style="cursor:pointer;color:#9db9ff;display:block;margin-top:4px">Upload a new version</label>';
        }
        var dep = $(root, '#vdep');
        if (dep) {
          var ds = (d && d.depends) || [];
          dep.innerHTML = '<h4>Depends on</h4>' + (ds.length ? ds.map(function (c) { return '<span class="chip2">' + (c.name || c.doc_id) + '</span>'; }).join('') : '<span>none</span>');
        }
      });
      var up = $(root, '#vup');
      if (up) up.onchange = function () {
        if (!up.files || !up.files[0]) return;
        var fd = new FormData();
        fd.append('file', up.files[0]);
        fd.append('version', 'v-test');
        var fn = window.authFetch || fetch;
        fn('/api/vault/' + encodeURIComponent(key), { method: 'POST', credentials: 'same-origin', body: fd }).then(function (r) { return r && r.ok ? r.json() : null; }).then(function () { openDoc(id); toast(root, 'Version stored; the previous copy is kept as superseded'); });
      };
    }
    window.openVaultDoc = openDoc;
    var vq = $(root, '#vq');
    if (vq) vq.oninput = function (e) { q = String(e.target.value || '').toLowerCase(); render(); };
    var dc = $(root, '#dclose'); if (dc) dc.onclick = function () { closeDrawer(root); };
    var sc = $(root, '#scrim'); if (sc) sc.onclick = function () { closeDrawer(root); };
    /* Locked: Register behind glass. The vault's shape shows (categories, counts, health flags, a safe audit log)
       from /api/vault/summary, which never sends a document name, ID or content. The register opens with the code. */
    function esc2(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function vanStamp(iso) {
      var d = new Date(iso); if (isNaN(d.getTime())) return '';
      var day = d.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver', weekday: 'short', day: '2-digit', month: 'short' }).replace(/,/g, '');
      var hm = d.toLocaleTimeString('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      return day + ' ' + hm;
    }
    function paintGate(msg) {
      var host = $(root, '#pg-vault') || root;
      window.__vaultOpen = false;
      host.innerHTML = '<div class="vg">'
        + '<div class="vg-head" id="gbox"><div class="vg-t"><b>Vault</b><span class="vg-lock">Locked</span></div>'
        + '<div class="vg-note">Structure and health are shown. Names and contents stay behind the code.</div>'
        + '<div class="vg-pin" id="vpin" aria-label="Four-digit code"><i class="f"></i><i></i><i></i><i></i></div>'
        + '<button type="button" class="vg-go" id="vgGo">Unlock</button></div>'
        + '<div class="vg-msg" id="ver" role="status">' + esc2(msg || '') + '</div>'
        + '<div class="vg-stats" id="vgStats"><div class="vg-st"><b>-</b><span>documents in the register</span></div><div class="vg-st"><b>-</b><span>drafts, not final</span></div><div class="vg-st"><b>-</b><span>due or set for rebuild</span></div><div class="vg-st"><b>-</b><span>not verified in 90 days</span></div></div>'
        + '<div class="vg-cats" id="vgCats"><div class="vg-empty">Loading the register shape…</div></div>'
        + '<div class="vg-low"><div class="vg-box"><h4>Audit log, safe view</h4><div id="vgAudit" class="vg-audit"><div class="vg-dim">Loading…</div></div></div>'
        + '<div class="vg-box"><h4>How the lock works</h4><p>Four-digit code, <b>separate from Financials</b>. Type the digits on your keyboard; the vault opens at the fourth. It stays open on this browser until you close it. Three wrong codes in 30 seconds start a <b>30-second wait</b>. Every unlock, lock and wrong code is written to the log on the left.</p></div></div>'
        + '</div>';
      api('/api/vault/summary').then(function (r) { return r && r.ok ? r.json() : null; }).then(function (s) {
        var cats = $(host, '#vgCats'), st = $(host, '#vgStats'), au = $(host, '#vgAudit');
        if (!s || s.total == null) {
          if (cats) cats.innerHTML = '<div class="vg-empty">The register shape is not available right now. The code still opens the vault.</div>';
          if (au) au.innerHTML = '<div class="vg-dim">No log available.</div>';
          return;
        }
        var f = s.flags || {};
        if (st) st.innerHTML = [[s.total, 'documents in the register', ''], [f.drafts, 'drafts, not final', f.drafts ? 'amb' : ''], [f.due, 'due or set for rebuild', f.due ? 'amb' : ''], [f.stale, 'not verified in 90 days', f.stale ? 'amb' : '']]
          .map(function (x) { return '<div class="vg-st ' + x[2] + '"><b>' + esc2(x[0] == null ? '-' : x[0]) + '</b><span>' + esc2(x[1]) + '</span></div>'; }).join('');
        if (cats) cats.innerHTML = (s.categories || []).length ? s.categories.map(function (c) {
          var chips = Object.keys(c.statuses || {}).sort(function (a, b) { return c.statuses[b] - c.statuses[a]; }).map(function (k) {
            var warn = /draft|due|rebuild|scheduled/i.test(k);
            return '<span class="vg-chip' + (warn ? ' amb' : '') + '">' + esc2(c.statuses[k]) + ' ' + esc2(k.toLowerCase()) + '</span>';
          }).join('');
          var lines = ''; for (var i = 0; i < Math.min(3, c.n); i++) lines += '<i style="width:' + [78, 62, 70][i] + '%"></i>';
          return '<div class="vg-cat"><div class="vg-ch"><b>' + esc2(c.kind) + '</b><span>' + esc2(c.n) + ' doc' + (c.n === 1 ? '' : 's') + '</span></div><div class="vg-chips">' + chips + '</div><div class="vg-glass" aria-hidden="true">' + lines + '</div><div class="vg-un">Unlock to read</div></div>';
        }).join('') : '<div class="vg-empty">No documents in the register yet.</div>';
        if (au) au.innerHTML = (s.audit || []).length ? s.audit.map(function (e) { return '<div><span>' + esc2(vanStamp(e.at)) + '</span>' + esc2(e.what) + '</div>'; }).join('') : '<div class="vg-dim">Nothing logged yet. Unlocks, locks and wrong codes will show here.</div>';
      }).catch(function () {
        var cats = $(host, '#vgCats'); if (cats) cats.innerHTML = '<div class="vg-empty">The register shape is not available right now. The code still opens the vault.</div>';
      });
      var digits = [];
      var fails = 0;
      var lockedUntil = 0;
      function draw() {
        var cells = host.querySelectorAll('#vpin i');
        cells.forEach(function (c, i) {
          c.textContent = digits[i] ? '·' : '';
          c.classList.toggle('f', i === digits.length);
          c.classList.toggle('on', !!digits[i]);
        });
      }
      function submit() {
        if (Date.now() < lockedUntil) { shake('Wait 30 seconds'); return; }
        api('/api/vault', { method: 'POST', body: JSON.stringify({ code: digits.join('') }), headers: { 'content-type': 'application/json' } }).then(function (r) {
          if (r && r.status === 429) { fails = 3; lockedUntil = Date.now() + 30000; shake('Wait 30 seconds'); return null; }
          if (!r || !r.ok) { fails += 1; if (fails >= 3) lockedUntil = Date.now() + 30000; shake(fails >= 3 ? 'Wait 30 seconds' : 'That code did not match.'); return null; }
          window.__vaultOpen = true;
          if (typeof window.paintShellNav === 'function') window.paintShellNav();
          if (typeof window.paintRedesignVault === 'function') window.paintRedesignVault();
          return null;
        }).catch(function () { shake('Vault is unavailable'); });
        digits = [];
      }
      function shake(m) {
        var box = $(host, '#gbox');
        if (box) { box.classList.add('shake'); setTimeout(function () { box.classList.remove('shake'); }, 400); }
        var er = $(host, '#ver'); if (er) er.textContent = m || '';
        digits = [];
        draw();
      }
      var go = $(host, '#vgGo');
      if (go) go.onclick = function () { if (digits.length === 4) submit(); else { var er = $(host, '#ver'); if (er) er.textContent = 'Type the four digits on your keyboard.'; } };
      if (window.__vaultGateKey) document.removeEventListener('keydown', window.__vaultGateKey);
      window.__vaultGateKey = function onKey(e) {
        if (!(window.STATE && window.STATE.desk === 'vault')) return;
        if (window.__vaultOpen) return;
        if (e.key === 'Backspace') { digits.pop(); draw(); return; }
        if (e.key === 'Enter' && digits.length === 4) { submit(); return; }
        if (/^\d$/.test(e.key)) {
          if (digits.length < 4) digits.push(e.key);
          draw();
          if (digits.length === 4) submit();
        }
      };
      document.addEventListener('keydown', window.__vaultGateKey);
      draw();
    }
    api('/api/vault').then(function (r) {
      if (r && r.status === 403 && !window.fixtureMockup) { paintGate(); return { locked: true }; }
      return r && r.ok ? r.json() : api('/api/vault/documents').then(function (r2) { return r2 && r2.ok ? r2.json() : { docs: [], reason: 'vault unavailable' }; });
    }).then(function (d) {
      if (!d || d.locked) return;
      window.__vaultOpen = true;
      if (typeof window.paintShellNav === 'function') window.paintShellNav();
      docs = ((d && d.docs) || []).map(rowOf);
      reason = (d && d.reason) || (docs.length ? '' : 'no documents in the vault yet');
      nav(); render();
    }).catch(function () {
      docs = [];
      reason = 'vault unavailable';
      nav(); render();
    });
  }

  function bindOps(root) {
    var frozen = false;
    var tab = 'map';
    function tapeLine(lv, src, msg, at) {
      var tp = $(root, '#tape'); if (!tp) return;
      var d = document.createElement('div');
      d.className = 'lv-' + (lv || 'info');
      var t = at ? String(at).slice(11, 16) : nowVan().slice(0, 5);
      d.innerHTML = '<span class="t">' + t + '</span><span class="s">' + String(src || '').toUpperCase() + '</span><span class="i">' + msg + '</span>';
      tp.insertBefore(d, tp.firstChild);
      while (tp.children.length > 200) tp.removeChild(tp.lastChild);
    }
    function paintTape(events, reason) {
      var tp = $(root, '#tape'); if (!tp) return;
      tp.innerHTML = '';
      if (!events || !events.length) {
        tapeLine('info', 'tape', reason || 'no events in the live tape yet');
        return;
      }
      events.slice().reverse().forEach(function (e) {
        tapeLine(e.level || 'info', e.source || 'ops', e.message || '-', e.at);
      });
    }
    function paintLamps(board) {
      var lamps = (board && board.lamps) || [];
      var box = $(root, '#lamps');
      if (!box) return;
      if (!lamps.length) { box.innerHTML = '<div class="lamp"><i></i><div><b>-</b><small>no sample yet</small></div></div>'; return; }
      var color = { green: 'ok', amber: 'warn', red: 'down', grey: 'ok' };
      box.innerHTML = lamps.map(function (l) {
        return '<div class="lamp ' + (color[l.color] || 'ok') + '" data-l="' + (l.name || '') + '"><i></i><div><b>' + (l.name || '-') + '</b><small>' + (l.reading || '-') + '</small></div></div>';
      }).join('');
      var master = $(root, '#master');
      if (master && board.master) {
        master.className = 'master ' + (board.master.state === 'down' ? 'down' : board.master.state === 'degraded' ? 'warn' : 'ok');
        var b = master.querySelector('b'); if (b) b.textContent = board.master.label || '-';
        var sm = $(root, '#msub'); if (sm) sm.textContent = 'since ' + (board.master.since || '-');
      }
    }
    function arc(cx, cy, r, a0, a1) {
      function p(a) { return [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)]; }
      var s = p(a0), e = p(a1);
      return 'M' + s[0].toFixed(1) + ' ' + s[1].toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + ((a1 - a0) > 180 ? 1 : 0) + ' 1 ' + e[0].toFixed(1) + ' ' + e[1].toFixed(1);
    }
    function dialHTML(d) {
      var BASE = { api_latency: 'b', error_rate: 'g', db_pool: 'g', jobs_waiting: 'b', sends_today: 'v', ai_spend: 'a', fn_load: 'g', fact_drift: 'a' };
      var PAL = { b: '#3b82ff', g: '#19d38a', a: '#ffb547', r: '#ff4d6d', v: '#a173ff' };
      var v = d.value;
      var max = d.red != null ? Number(d.red) * 1.3 : 100;
      if (!max) max = 100;
      var has = v != null && isFinite(Number(v));
      var num = has ? Number(v) : 0;
      var f = Math.max(0, Math.min(1, num / max));
      var a = 180 + f * 180;
      var ambT = d.amber != null ? Number(d.amber) : max * 0.7;
      var redT = d.red != null ? Number(d.red) : max * 0.88;
      var amb = 180 + (ambT / max) * 180;
      var red = 180 + (redT / max) * 180;
      var nx = 80 + 40 * Math.cos(a * Math.PI / 180), ny = 84 + 40 * Math.sin(a * Math.PI / 180);
      var col = BASE[d.key] || 'b';
      if (has && num >= redT) col = 'r';
      else if (has && num >= ambT) col = 'a';
      var C = PAL[col] || '#3b82ff';
      var ticks = '';
      var i;
      for (i = 0; i <= 10; i++) {
        var t = 180 + i * 18;
        var r1 = 58, r2 = i % 5 === 0 ? 48 : 53;
        ticks += '<line x1="' + (80 + r1 * Math.cos(t * Math.PI / 180)).toFixed(1) + '" y1="' + (84 + r1 * Math.sin(t * Math.PI / 180)).toFixed(1) + '" x2="' + (80 + r2 * Math.cos(t * Math.PI / 180)).toFixed(1) + '" y2="' + (84 + r2 * Math.sin(t * Math.PI / 180)).toFixed(1) + '" stroke="#2a2c35" stroke-width="' + (i % 5 === 0 ? 1.6 : 1) + '"/>';
      }
      var shown = has ? (num % 1 ? num.toFixed(2) : String(num)) : '-';
      var note = d.note || (has ? '' : 'no sample yet');
      return '<div class="dial ' + col + '" data-k="' + d.key + '" data-note="' + String(note).replace(/"/g, '') + '" title="' + note + '"><span class="rl">0–' + (d.red != null ? d.red : '-') + '</span><svg viewBox="0 0 160 100">'
        + '<path d="' + arc(80, 84, 58, 180, 360) + '" stroke="#23252c" stroke-width="9" fill="none" stroke-linecap="round"/>'
        + '<path d="' + arc(80, 84, 58, amb, red) + '" stroke="#3a2a12" stroke-width="9" fill="none"/>'
        + '<path d="' + arc(80, 84, 58, red, 360) + '" stroke="#3a1420" stroke-width="9" fill="none" stroke-linecap="round"/>'
        + '<path class="fill" d="' + arc(80, 84, 58, 180, a) + '" stroke="' + C + '" stroke-width="9" fill="none" stroke-linecap="round" style="filter:drop-shadow(0 0 8px ' + C + 'aa)"/>'
        + ticks
        + '<line class="ndl" x1="80" y1="84" x2="' + nx.toFixed(1) + '" y2="' + ny.toFixed(1) + '" stroke="#e9eefa" stroke-width="2.2" stroke-linecap="round"/>'
        + '<circle cx="80" cy="84" r="4" fill="#111216" stroke="' + C + '" stroke-width="2"/></svg>'
        + '<div class="val" style="color:' + C + ';text-shadow:0 0 12px ' + C + '">' + shown + '<span>' + (d.unit || '') + '</span></div><div class="lab">' + (d.label || d.key) + '</div></div>';
    }
    function paintDials(dials) {
      var box = $(root, '#dials'); if (!box) return;
      box.innerHTML = (dials || []).map(dialHTML).join('') || '<div class="dial"><div class="val">-</div><div class="lab">no sample yet</div></div>';
    }
    function sparkSVG(vals, st) {
      var h = (vals || []).map(Number).filter(function (n) { return isFinite(n); });
      var mx = 1;
      h.forEach(function (v) { if (v > mx) mx = v; });
      var pts = '';
      if (h.length) {
        pts = h.map(function (v, i) {
          var x = h.length === 1 ? 110 : i * (220 / (h.length - 1));
          var y = 36 - (v / mx) * 30;
          return x.toFixed(1) + ',' + y.toFixed(1);
        }).join(' ');
      }
      var c = st === 'DOWN' ? '#ff4d6d' : (st === 'SLOW' ? '#ffb547' : '#3b82ff');
      var g = '';
      for (var i = 1; i < 4; i++) g += '<line x1="0" y1="' + (i * 9) + '" x2="220" y2="' + (i * 9) + '" stroke="#23252c" stroke-width="1"/>';
      return '<svg class="spark" viewBox="0 0 220 38" preserveAspectRatio="none">' + g
        + (pts ? '<polyline points="' + pts + '" fill="none" stroke="' + c + '" stroke-width="1.8"></polyline>' : '')
        + '</svg>';
    }
    function apiHTML(a) {
      var ms = dash(a.ms, a.reason || 'no sample yet');
      var calls = a.callsToday != null ? a.callsToday : 0;
      var err = a.errors24h != null ? a.errors24h : 0;
      var chip = a.status === 'DOWN' ? 'DOWN' : (a.ms == null ? 'NO SAMPLE' : 'LIVE');
      return '<div class="api" data-a="' + a.key + '">'
        + '<div class="apih"><i class="lmp"></i><b>' + a.name + '</b><span class="ep">' + (a.endpoint || '') + '</span><span class="ch">' + chip + '</span></div>'
        + '<div class="apim">' + sparkSVG(a.spark || [], chip) + '<div class="rd"><b>' + ms.text + '</b><small>MS</small></div></div>'
        + '<div class="met"><span>Calls today</span><div class="vv"><span class="mono">' + calls + '</span></div></div>'
        + '<div class="met"><span>Errors 24 h</span><div class="vv"><span class="mono">' + err + '</span></div></div>'
        + '<div class="met"><span>Key</span><div class="vv"><span>' + (a.keyValid === false ? 'NOT SET' : 'present') + '</span></div></div>'
        + '<div class="apib"><button type="button" data-x="ping" data-action="ops-ping">Ping</button><button type="button" data-x="logs" data-action="ops-logs">Logs</button><button type="button" data-x="keys" data-action="ops-keys">Rotate key</button><button type="button" data-x="retry" data-action="ops-retry">Retry failed</button><button type="button" data-x="pause" data-action="ops-pause" class="dg">Pause</button></div></div>';
    }
    function paintAPIs(apis) {
      var box = $(root, '#apis'); if (!box) return;
      box.innerHTML = (apis || []).map(apiHTML).join('');
      var spend = $(root, '#spend');
      if (spend) spend.textContent = '-';
      $$(root, '.api .apib button').forEach(function (b) {
        b.onclick = function () { apiAct(b.closest('.api').getAttribute('data-a'), b.getAttribute('data-x')); };
      });
    }
    function showLogs(k, name) {
      api('/api/ops/apis?logs=1&key=' + encodeURIComponent(k)).then(function (r) { return r && r.ok ? r.json() : { calls: [], reason: 'logs unavailable' }; }).then(function (d) {
        var calls = (d && d.calls) || [];
        var reason = (d && d.reason) || '';
        var body = calls.length
          ? calls.map(function (c) {
            var t = c.at ? new Date(c.at).toLocaleTimeString('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }) : '-';
            return t + '  ' + (c.path || '-') + '  ' + (c.code || '-') + '  ' + (c.ms != null ? c.ms + ' ms' : '-');
          }).join('<br>')
          : (reason || 'no calls logged for this service yet');
        modal(root, '<h3>' + name + ' · last calls</h3><div style="font-family:ui-monospace,Menlo,monospace;font-size:11.5px;line-height:1.8;max-height:300px;overflow:auto">' + body + '</div><div class="row"><button class="btn" type="button" data-close="1">Close</button></div>');
        var btn = $(root, '#mbox [data-close]');
        if (btn) btn.onclick = function () { closeModal(root); };
      });
    }
    function pingOne(k, name, el) {
      var b = el || $(root, '[data-a="' + k + '"] .rd b');
      if (b) b.textContent = '...';
      return api('/api/ops/apis', { method: 'POST', body: JSON.stringify({ key: k, act: 'ping' }) }).then(function (r) { return r && r.json ? r.json() : {}; }).then(function (d) {
        var ms = d && d.ok ? d.ms : null;
        if (b) b.textContent = ms != null ? String(ms) : '-';
        toast(root, name + (ms != null ? ' answered in ' + ms + ' ms' : ': no answer'));
        return d;
      }).catch(function () {
        if (b) b.textContent = '-';
        toast(root, name + ': ping failed');
      });
    }
    function apiAct(k, x) {
      var card = $(root, '[data-a="' + k + '"]');
      var name = card && card.querySelector('b') ? card.querySelector('b').textContent : k;
      if (x === 'ping') { pingOne(k, name); return; }
      if (x === 'logs') { showLogs(k, name); return; }
      if (x === 'keys') { toast(root, 'Rotate key is not wired to Vercel from this desk'); return; }
      if (x === 'retry') { toast(root, 'Nothing failed on ' + name); return; }
      if (x === 'pause') {
        api('/api/ops/apis', { method: 'POST', body: JSON.stringify({ key: k, act: 'pause' }) }).then(function () { toast(root, name + ' paused'); });
      }
    }
    function bindTabs() {
      $$(root, '#iseg span').forEach(function (s) {
        s.onclick = function (ev) {
          ev.preventDefault();
          var v = s.getAttribute('data-v');
          if (v === 'more') {
            modal(root, '<h3>Map another control room</h3><p>Give the endpoint that returns rooms, alerts and documents.</p><div class="row"><button class="btn" type="button" data-close="1">Cancel</button></div>');
            var c = $(root, '#mbox [data-close]'); if (c) c.onclick = function () { closeModal(root); };
            return;
          }
          tab = v === 'ledger' ? 'ledger' : 'map';
          showPages(root, 'ops', tab);
          if (tab === 'map') loadAll();
          if (tab === 'ledger') paintLedger();
        };
      });
    }
    function paintLedger() {
      var fr = $(root, '#iqFrame');
      if (fr && !fr.getAttribute('src')) fr.setAttribute('src', 'https://www.4ormiq.com/real-run-live-go/room');
      var rl = $(root, '#iqReload');
      if (rl && !rl._b) { rl._b = 1; rl.onclick = function () { var f = $(root, '#iqFrame'); if (f) f.setAttribute('src', 'https://www.4ormiq.com/real-run-live-go/room?r=' + Date.now()); }; }
    }
    function dropCovers() {
      $$(root, '.sw.lifted').forEach(function (x) { x.classList.remove('lifted'); });
    }
    function paintSwitches(sw) {
      var box = $(root, '#engs'); if (!box) return;
      box.innerHTML = (sw || []).map(function (s) {
        var danger = s.key === 'readonly' || s.key === 'test_mode';
        var word = danger ? 'GUARDED' : 'LIFT';
        var armed = s.key === 'send_rail' ? (s.on ? 'ARMED' : 'SAFE') : (s.on ? 'ON' : 'OFF');
        return '<div class="sw' + (s.on ? ' on' : '') + (danger ? ' danger' : '') + '" data-s="' + s.key + '"><div><b>' + s.label + '</b><small>' + (s.sub || '') + '</small></div>'
          + '<div class="bay"><button class="tog" type="button" tabindex="-1" aria-pressed="' + (s.on ? 'true' : 'false') + '" data-action="ops-flip"><i></i></button>'
          + '<button class="cover" type="button" data-action="ops-cover"><span>' + word + '</span></button></div>'
          + '<span class="swst">' + armed + '</span></div>';
      }).join('');
      var dropTimer = null;
      function scheduleDrop(row) {
        clearTimeout(dropTimer);
        dropTimer = setTimeout(function () { if (row) row.classList.remove('lifted'); }, 3000);
      }
      $$(root, '.sw .cover').forEach(function (c) {
        c.onclick = function (ev) {
          ev.preventDefault();
          var row = c.closest('.sw');
          $$(root, '.sw').forEach(function (x) { if (x !== row) x.classList.remove('lifted'); });
          row.classList.toggle('lifted');
          if (row.classList.contains('lifted')) {
            var tog = row.querySelector('.tog');
            if (tog) tog.removeAttribute('tabindex');
          }
        };
      });
      $$(root, '.sw .tog').forEach(function (b) {
        b.onclick = function (ev) {
          var row = b.closest('.sw');
          if (!row.classList.contains('lifted')) { ev.preventDefault(); return; }
          var id = row.getAttribute('data-s');
          var on = b.getAttribute('aria-pressed') !== 'true';
          var danger = row.classList.contains('danger');
          if (danger && !window.confirm('Turn ' + (row.querySelector('b') ? row.querySelector('b').textContent : id) + ' ' + (on ? 'on' : 'off') + '?')) return;
          api('/api/ops/switches', { method: 'POST', body: JSON.stringify({ key: id, on: on }) }).then(function (r) { return r && r.json ? r.json() : {}; }).then(function (d) {
            if (d && d.saved) { scheduleDrop(row); loadAll(); }
            else toast(root, (d && d.error) || 'Not saved');
          });
        };
      });
      if (!root._coverEsc) {
        root._coverEsc = 1;
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') dropCovers();
        });
        document.addEventListener('pointerdown', function (e) {
          if (e.target && e.target.closest && e.target.closest('.sw')) return;
          dropCovers();
        });
      }
    }
    /* Spend: hidden until Show is pressed (same idea as the calendar $). Loaded once, then every 10 minutes while open. */
    var spendOpen = false, spendT = null;
    function money2(n) { return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function escS(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function paintSpend(d) {
      var box = $(root, '#spendw'); if (!box) return;
      var rows = (d && d.rows) || [];
      if (!rows.length) { box.innerHTML = '<div class="spempty">No spend yet. Add bills under Financials &rsaquo; Monthly expenses.</div>'; return; }
      box.innerHTML = '<div class="spk"><div><small>THIS MONTH</small><b>' + money2(d.monthTotal) + '</b><i>' + money2(d.soFar) + ' out so far</i></div><div><small>EVERY MONTH</small><b>' + money2(d.monthly) + '</b><i>from the SaaS sheet</i></div><div><small>YEARLY RENEWALS</small><b>' + money2(d.yearly) + '</b><i>spread over the year</i></div></div>'
        + '<table class="sptab"><thead><tr><th>SERVICE</th><th>HOW IT BILLS</th><th>COMES OUT</th><th>AMOUNT</th><th>THIS MONTH</th></tr></thead><tbody>'
        + rows.map(function (r) {
          var cls = r.basis === 'Per use' ? 'u' : (r.basis === 'Yearly' ? 'y' : 'm');
          return '<tr><td><b>' + escS(r.name) + '</b>' + (r.what ? '<small>' + escS(r.what) + '</small>' : '') + '</td><td><span class="bs ' + cls + '">' + escS(r.basis) + '</span><small>' + escS(r.source) + '</small></td><td>' + escS(r.when) + '</td><td class="am">' + (r.amount == null ? '&ndash;' : money2(r.amount)) + '</td><td><small>' + escS(r.reading || '') + '</small></td></tr>';
        }).join('') + '</tbody></table>';
    }
    function loadSpend() { api('/api/ops/spend').then(function (r) { return r && r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(paintSpend); }
    var spendBtn = $(root, '#spendToggle');
    if (spendBtn) spendBtn.onclick = function () {
      spendOpen = !spendOpen;
      var w = $(root, '#spendw'); if (w) w.hidden = !spendOpen;
      spendBtn.textContent = spendOpen ? 'Hide' : 'Show';
      clearInterval(spendT);
      if (spendOpen) { loadSpend(); spendT = setInterval(loadSpend, 600000); }
    };
    /* Scrape: three lamps for today, an alert when a slot is missed, a 7-day audit, Run now. */
    function vanHM(iso) { try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)); } catch (e) { return ''; } }
    var scrOpen = false;
    function paintScrape(d) {
      var slots = (d && d.slots) || [];
      var today = slots.slice(0, 3).slice().sort(function (a, b) { return a.hour - b.hour; });
      var lamps = $(root, '#scrLamps');
      var word = { ok: 'ran', partial: 'part ran', missed: 'missed', running: 'running', upcoming: 'due' };
      var lastTxt = d && d.last ? '<i class="' + (d.last.status === 'ok' ? 'ok' : 'partial') + '" title="' + escS(d.last.detail || '') + '">last ' + (d.last.trigger === 'manual' ? 'run now ' : '') + vanHM(d.last.at) + '</i>' : '';
      if (lamps) lamps.innerHTML = (today.map(function (s) { return '<i class="' + s.state + '" title="' + escS(s.detail || '') + '">' + String(s.hour).padStart(2, '0') + ':00 ' + (word[s.state] || s.state) + '</i>'; }).join('') + lastTxt) || '<i>no runs yet</i>';
      var al = $(root, '#scrAlert');
      if (al) { al.hidden = !(d && d.alert); al.textContent = (d && d.alert) ? d.alert + '. Press Run now, then check the Vercel cron.' : ''; }
      var w = $(root, '#scrw');
      if (!w) return;
      var days = {};
      slots.forEach(function (s) { (days[s.day] = days[s.day] || {})[s.hour] = s; });
      var keys = Object.keys(days).sort().reverse();
      w.innerHTML = '<div class="scrg"><span class="scrh" style="border:0;background:none">DAY</span><span class="scrh" style="border:0;background:none">06:00</span><span class="scrh" style="border:0;background:none">12:00</span><span class="scrh" style="border:0;background:none">18:00</span>'
        + keys.map(function (k) {
          return '<b>' + escS(k.slice(5)) + '</b>' + [6, 12, 18].map(function (h) {
            var s = days[k][h];
            if (!s) return '<span>not tracked</span>';
            return '<span class="' + s.state + '" title="' + escS(s.detail || '') + '">' + (s.state === 'ok' ? 'ran ' + vanHM(s.at) : s.state === 'partial' ? 'part ' + vanHM(s.at) : s.state) + (s.detail ? ' &middot; ' + escS(s.detail) : '') + '</span>';
          }).join('');
        }).join('') + '</div><div style="margin-top:8px;color:#a3b0d2;font-size:12px">' + ((d && d.missed) ? d.missed + ' missed in 7 days' : 'Nothing missed') + ' &middot; expected ' + ((d && d.perDay) || 3) + ' a day</div>';
    }
    function loadScrape() { api('/api/ops/scrape').then(function (r) { return r && r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(paintScrape); }
    var scrBtn = $(root, '#scrToggle');
    if (scrBtn) scrBtn.onclick = function () { scrOpen = !scrOpen; var w = $(root, '#scrw'); if (w) w.hidden = !scrOpen; scrBtn.textContent = scrOpen ? 'Hide' : 'Audit'; };
    var scrRun = $(root, '#scrRun');
    if (scrRun) scrRun.onclick = function () {
      if (scrRun.disabled) return;
      scrRun.disabled = true; scrRun.textContent = 'Running';
      api('/api/ops/scrape', { method: 'POST' }).then(function (r) { return r && r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (d) {
        scrRun.disabled = false; scrRun.textContent = 'Run now';
        toast(root, d ? 'Scrape ran: ' + (d.detail || 'done') : 'Scrape failed. Try again.');
        loadScrape();
      });
    };
    loadScrape();
    var scrT = setInterval(function () { if (!root.isConnected && root.host && !root.host.isConnected) { clearInterval(scrT); return; } loadScrape(); }, 300000);

    /* Production log */
    var plOpen = false;
    function paintProd(d) {
      var w = $(root, '#plw'); if (!w) return;
      var days = (d && d.days) || [];
      var st = $(root, '#plSt');
      if (st && days[0]) st.textContent = 'what got done and what was made · today ' + days[0].entries.length + ' entries';
      w.innerHTML = (d && d.summary ? '<div class="plai">' + escS(d.summary) + '</div>' : '<div class="plai">' + (d && d.aiOn ? 'No summary yet for today.' : 'Written summary switches on when the OpenAI key is added in Vercel (OPENAI_API_KEY). The log below is live now.') + '</div>')
        + (days.map(function (day) {
          var c = Object.keys(day.counts).map(function (k) { return '<span>' + day.counts[k] + ' ' + escS(k.toLowerCase()) + '</span>'; }).join('');
          return '<div class="pld"><h4>' + escS(day.day) + '<small>' + day.entries.length + ' entries</small></h4><div class="pc">' + c + '</div><ul>'
            + day.entries.slice(0, 25).map(function (e) { return '<li><i>' + vanHM(e.at) + ' ' + escS(e.kind) + '</i>' + escS(e.title) + '</li>'; }).join('')
            + (day.entries.length > 25 ? '<li><i></i>and ' + (day.entries.length - 25) + ' more</li>' : '') + '</ul></div>';
        }).join('') || '<div style="color:#a3b0d2">Nothing logged in the last 7 days.</div>');
    }
    function loadProd() { api('/api/ops/production').then(function (r) { return r && r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(paintProd); }
    var plBtn = $(root, '#plToggle');
    if (plBtn) plBtn.onclick = function () { plOpen = !plOpen; var w = $(root, '#plw'); if (w) w.hidden = !plOpen; plBtn.textContent = plOpen ? 'Hide' : 'Show'; if (plOpen) loadProd(); };

    /* Sites and social */
    var ssOpen = false;
    function paintSites(d) {
      var w = $(root, '#ssw'); if (!w) return;
      var cards = (d && d.cards) || [];
      var log = (d && d.drLog) || [];
      w.innerHTML = '<div class="ssg">' + cards.map(function (c) {
        return '<div class="ssc' + (c.connected ? '' : ' off') + '"><small>' + escS(c.label) + '</small><b>' + escS(c.connected ? c.value : 'Not connected') + '</b><i>' + escS(c.note || '') + '</i></div>';
      }).join('') + '</div>'
        + '<div class="sslog"><table class="sptab"><thead><tr><th>DATA ROOM VISITOR</th><th>SIGNED IN</th><th>STAYED</th><th>PAGES</th></tr></thead><tbody>'
        + (log.map(function (v) { return '<tr><td><b>' + escS(v.who) + '</b><small>' + escS(v.email || '') + '</small></td><td>' + escS(v.when) + '</td><td>' + escS(v.stayed || '-') + '</td><td>' + escS(String(v.pages || 0)) + '</td></tr>'; }).join('')
          || '<tr><td colspan="4"><small>No data room sign-ins logged yet. Each sign-in shows here and in Signals.</small></td></tr>') + '</tbody></table></div>';
    }
    function loadSites() { api('/api/ops/sites').then(function (r) { return r && r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(paintSites); }
    var ssBtn = $(root, '#ssToggle');
    if (ssBtn) ssBtn.onclick = function () { ssOpen = !ssOpen; var w = $(root, '#ssw'); if (w) w.hidden = !ssOpen; ssBtn.textContent = ssOpen ? 'Hide' : 'Show'; if (ssOpen) loadSites(); };

    function loadAll() {
      if (frozen) return;
      var last = $(root, '#lastsweep'); if (last) last.textContent = nowVan();
      Promise.all([
        api('/api/ops/board').then(function (r) { return r && r.ok ? r.json() : {}; }).catch(function () { return {}; }),
        api('/api/ops/dials').then(function (r) { return r && r.ok ? r.json() : {}; }).catch(function () { return {}; }),
        api('/api/ops/apis').then(function (r) { return r && r.ok ? r.json() : {}; }).catch(function () { return {}; }),
        api('/api/ops/events').then(function (r) { return r && r.ok ? r.json() : {}; }).catch(function () { return {}; }),
        api('/api/ops/switches').then(function (r) { return r && r.ok ? r.json() : {}; }).catch(function () { return {}; }),
        api('/api/ops/metrics').then(function (r) { return r && r.ok ? r.json() : {}; }).catch(function () { return {}; })
      ]).then(function (pack) {
        paintLamps(pack[0]);
        paintDials((pack[1] && pack[1].dials) || []);
        paintAPIs((pack[2] && pack[2].apis) || []);
        paintTape((pack[3] && pack[3].events) || [], (pack[3] && pack[3].reason) || '');
        paintSwitches((pack[4] && pack[4].switches) || []);
        var upt = $(root, '#upt'); if (upt) upt.textContent = '-';
      });
    }
    /* Four tiles across the top: Spend, Scrape, Production log, Sites and social. A click opens that panel in a pop-up. */
    var TILE = { spend: ['Spend', '#spendToggle', '#spendw'], scrape: ['Scrape', '#scrToggle', '#scrw'], prod: ['Production log', '#plToggle', '#plw'], sites: ['Sites and social', '#ssToggle', '#ssw'] };
    var tpop = $(root, '#tpop'), tpbody = $(root, '#tpbody'), hold = $(root, '#tileHold'), tpOpen = null;
    function tileClose() {
      if (!tpOpen) return;
      var sec = tpbody && tpbody.firstElementChild;
      if (sec && hold) hold.appendChild(sec);
      if (tpop) tpop.hidden = true;
      tpOpen = null;
    }
    function tileOpen(k) {
      var t = TILE[k]; if (!t || !tpop || !hold) return;
      tileClose();
      var wrapEl = $(root, t[2]);
      var sec = wrapEl && wrapEl.closest('.con');
      if (!sec) return;
      tpbody.appendChild(sec);
      var tt = $(root, '#tpt'); if (tt) tt.textContent = t[0];
      if (wrapEl.hidden) { var btn = $(root, t[1]); if (btn) btn.click(); }
      tpop.hidden = false;
      tpOpen = k;
    }
    $$(root, '[data-tile]').forEach(function (b) { b.onclick = function () { tileOpen(b.getAttribute('data-tile')); }; });
    var tpx = $(root, '#tpx'); if (tpx) tpx.onclick = tileClose;
    if (tpop) tpop.addEventListener('click', function (e) { if (e.target === tpop) tileClose(); });
    root.addEventListener('keydown', function (e) { if (e.key === 'Escape') tileClose(); });
    /* Tile readings */
    api('/api/ops/spend').then(function (r) { return r && r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (d) {
      var el = $(root, '#t4spend'); if (!el || !d) return;
      if (d.monthTotal != null) el.textContent = money2(d.monthTotal) + ' this month';
    });
    api('/api/ops/scrape').then(function (r) { return r && r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (d) {
      var el = $(root, '#t4scr'), i = $(root, '#t4scri'); if (!el || !d) return;
      el.textContent = d.last ? 'Last run ' + vanHM(d.last.at) : 'No run yet';
      if (i) i.textContent = d.alert ? d.alert : ((d.missed || 0) + ' missed in 7 days');
      var tile = el.closest('.tile4'); if (tile) tile.classList.toggle('bad', !!d.alert);
    });
    api('/api/ops/production').then(function (r) { return r && r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (d) {
      var el = $(root, '#t4pl'); if (!el || !d || !d.days) return;
      var c = d.days[0] ? d.days[0].entries.length : 0; el.textContent = c + (c === 1 ? ' entry' : ' entries') + ' today';
    });
    api('/api/ops/sites').then(function (r) { return r && r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (d) {
      var el = $(root, '#t4ss'); if (!el || !d) return;
      var n = (d.drLog || []).length;
      el.textContent = n + ' data room sign-in' + (n === 1 ? '' : 's');
    });

    /* Process map: lanes read top to bottom, data flows down. Each box has a lamp from a real reading.
       A box that feeds several others drops one trunk onto its own bus, which branches to each of them,
       so a fan-out (one chat feeding three places) reads at a glance. */
    var MAP = { nodes: [], edges: [], lanes: [] }, mapSel = null, onlyBadMap = false, GEO = {};
    var NW = 146, NH = 50, SLOT = 160, X0 = 150, RW = 1700;
    var LAMP = { ok: '#19d38a', warn: '#ffb547', down: '#ff4d6d', idle: '#5d6b93' };
    var WORD = { ok: 'OK', warn: 'WARNING', down: 'DOWN', idle: 'IDLE' };
    function layout() {
      var lanes = MAP.lanes && MAP.lanes.length ? MAP.lanes : ['COMES IN', 'HOW IT ARRIVES', 'KEPT AND WORKED ON', 'WHERE YOU SEE IT', 'GOES BACK OUT'];
      var per = Math.floor((RW - X0 - SLOT / 2) / SLOT);
      var parents = {};
      MAP.edges.forEach(function (e) { (parents[e[1]] = parents[e[1]] || []).push(e[0]); });
      var pos = {}, y = 14, laneBox = [];
      lanes.forEach(function (lab, li) {
        var mine = MAP.nodes.filter(function (n) { return n.lane === li; });
        if (li > 0) {
          /* sit each box under the boxes that feed it, so lines run short and straight */
          mine.forEach(function (n, ix) {
            var ps = (parents[n.id] || []).map(function (p) { return pos[p]; }).filter(Boolean);
            n._bx = ps.length ? ps.reduce(function (a, p) { return a + p.cx; }, 0) / ps.length : 9999 + ix;
          });
          mine.sort(function (a, b) { return a._bx - b._bx; });
        }
        var rows = mine.length > per ? 2 : 1;
        var top = y;
        mine.forEach(function (n, i) {
          var r = rows > 1 ? i % 2 : 0;
          var c = rows > 1 ? Math.floor(i / 2) : i;
          var used = rows > 1 ? Math.ceil(mine.length / 2) : mine.length;
          var span = used * SLOT + (rows > 1 ? SLOT / 2 : 0);
          var left = X0 + Math.max(0, (RW - X0 - span) / 2);
          var x = left + c * SLOT + (r ? SLOT / 2 : 0);
          var ny = top + 22 + r * (NH + 16);
          pos[n.id] = { x: x, y: ny, cx: x + NW / 2, n: n };
        });
        var h = 22 + rows * (NH + 16) + 6;
        laneBox.push({ lab: lab, y: top, h: h });
        y = top + h + 96;
      });
      GEO = { pos: pos, lanes: laneBox, H: y - 80 };
    }
    function paintMap() {
      var svg = $(root, '#sysmap'); if (!svg) return;
      layout();
      var pos = GEO.pos, h = '';
      GEO.lanes.forEach(function (L, i) {
        h += '<rect class="lanebg" x="0" y="' + L.y + '" width="' + RW + '" height="' + L.h + '" rx="12"/>'
          + '<text class="lane" x="14" y="' + (L.y + 24) + '">' + escS(L.lab) + '</text>'
          + '<text class="lanesub" x="14" y="' + (L.y + 40) + '">' + String(i + 1) + ' of ' + GEO.lanes.length + '</text>';
      });
      /* one bus per source in the gap below its lane, spread so no two buses share a line */
      var bySrc = {};
      MAP.edges.forEach(function (e) { if (pos[e[0]] && pos[e[1]]) (bySrc[e[0]] = bySrc[e[0]] || []).push(e[1]); });
      var laneSrc = {};
      Object.keys(bySrc).forEach(function (s) { var l = pos[s].n.lane; (laneSrc[l] = laneSrc[l] || []).push(s); });
      var inCount = {}, inSeen = {};
      MAP.edges.forEach(function (e) { inCount[e[1]] = (inCount[e[1]] || 0) + 1; });
      Object.keys(laneSrc).forEach(function (l) {
        var srcs = laneSrc[l].sort(function (a, b) { return pos[a].cx - pos[b].cx; });
        var L = GEO.lanes[+l];
        var gapTop = L.y + L.h + 10, gapH = 76;
        srcs.forEach(function (s, k) {
          var a = pos[s];
          var busY = gapTop + (srcs.length > 1 ? (k * gapH) / (srcs.length - 1) : gapH / 2);
          var sx = a.cx, sy = a.y + NH;
          var hotS = a.n.state === 'down';
          bySrc[s].forEach(function (t) {
            var b = pos[t];
            inSeen[t] = (inSeen[t] || 0) + 1;
            var spread = inCount[t] > 1 ? (inSeen[t] - (inCount[t] + 1) / 2) * 10 : 0;
            var tx = b.cx + spread, ty = b.y;
            var hot = hotS || b.n.state === 'down';
            var cls = 'edge' + (hot ? ' hot' : a.n.state === 'ok' ? ' flow' : a.n.state === 'idle' ? ' quiet' : '');
            h += '<path class="' + cls + '" data-e="' + s + '|' + t + '" d="M' + sx + ' ' + sy + ' V' + busY + ' H' + tx + ' V' + (ty - 7) + '"/>'
              + '<path class="ahead' + (hot ? ' hot' : '') + '" data-e="' + s + '|' + t + '" d="M' + (tx - 4.5) + ' ' + (ty - 8) + ' L' + tx + ' ' + (ty - 1) + ' L' + (tx + 4.5) + ' ' + (ty - 8) + 'Z"/>';
          });
          if (bySrc[s].length > 2) h += '<circle class="junc" cx="' + sx + '" cy="' + busY + '" r="3.5"/>';
        });
      });
      MAP.nodes.forEach(function (n) {
        var p = pos[n.id]; if (!p) return;
        var outs = (bySrc[n.id] || []).length, ins = inCount[n.id] || 0;
        var deg = (ins ? ins + ' in' : '') + (ins && outs ? ' · ' : '') + (outs ? outs + ' out' : '');
        h += '<g class="node ' + n.state + '" data-n="' + n.id + '" transform="translate(' + p.x + ',' + p.y + ')"><title>' + escS(n.name + ': ' + n.detail) + '</title>'
          + '<rect width="' + NW + '" height="' + NH + '" rx="10"/>'
          + '<circle class="lamp ' + n.state + '" cx="' + (NW - 13) + '" cy="13" r="5.5" style="fill:' + LAMP[n.state] + '"/>'
          + '<text x="10" y="19">' + escS(n.name.length > 19 ? n.name.slice(0, 18) + '…' : n.name) + '</text>'
          + '<text class="s" x="10" y="33">' + escS(n.sub.length > 23 ? n.sub.slice(0, 22) + '…' : n.sub) + '</text>'
          + '<text class="st" x="10" y="45" style="fill:' + LAMP[n.state] + '">' + WORD[n.state] + '</text>'
          + (deg ? '<text class="dg" x="' + (NW - 8) + '" y="45" text-anchor="end">' + deg + '</text>' : '')
          + '</g>';
      });
      svg.setAttribute('viewBox', '0 0 ' + RW + ' ' + GEO.H);
      svg.innerHTML = h;
      $$(svg, '.node').forEach(function (g) { g.onclick = function () { selectNode(g.getAttribute('data-n')); }; });
      var sum = $(root, '#mapSum');
      if (sum) { sum.textContent = (MAP.down || 0) + ' down · ' + (MAP.warn || 0) + ' warning' + (MAP.warn === 1 ? '' : 's') + ' · ' + (MAP.idle || 0) + ' idle · ' + MAP.nodes.length + ' points'; sum.className = 'pill ' + (MAP.down ? 'p-red' : MAP.warn ? 'p-amb' : 'p-grn'); }
      paintTests(); paintIncs();
    }
    function chainOf(id) {
      /* everything upstream that feeds this box and everything downstream it feeds */
      var near = {}; near[id] = 1;
      var up = [id], down = [id];
      while (up.length) { var u = up.pop(); MAP.edges.forEach(function (e) { if (e[1] === u && !near[e[0]]) { near[e[0]] = 1; up.push(e[0]); } }); }
      var seen = {}; seen[id] = 1;
      while (down.length) { var d0 = down.pop(); MAP.edges.forEach(function (e) { if (e[0] === d0 && !seen[e[1]]) { seen[e[1]] = 1; near[e[1]] = 1; down.push(e[1]); } }); }
      return near;
    }
    function selectNode(id) {
      var svg = $(root, '#sysmap'); if (!svg) return;
      if (mapSel === id) { clearMap(); return; }
      mapSel = id;
      var near = chainOf(id);
      $$(svg, '.node').forEach(function (x) { var n = x.getAttribute('data-n'); x.classList.toggle('sel', n === id); x.classList.toggle('dim', !near[n]); });
      $$(svg, '.edge, .ahead').forEach(function (p) { var ab = p.getAttribute('data-e').split('|'); p.classList.toggle('lit', !!(near[ab[0]] && near[ab[1]])); p.classList.toggle('dim', !(near[ab[0]] && near[ab[1]])); });
      var n = MAP.nodes.filter(function (x) { return x.id === id; })[0];
      if (n) toast(root, n.name + ' · ' + WORD[n.state] + ': ' + n.detail + (n.routes ? ' · ' + n.routes : ''));
      var row = $(root, '[data-t="' + id + '"]'); if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
    }
    function clearMap() {
      mapSel = null; var svg = $(root, '#sysmap'); if (!svg) return;
      $$(svg, '.node').forEach(function (x) { x.classList.remove('sel', 'dim'); });
      $$(svg, '.edge, .ahead').forEach(function (p) { p.classList.remove('lit', 'dim'); });
    }
    function paintTests() {
      var tl = $(root, '#tlist'); if (!tl) return;
      var rows = MAP.nodes.filter(function (n) { return !onlyBadMap || n.state === 'down' || n.state === 'warn'; });
      tl.innerHTML = rows.map(function (n) {
        return '<div class="trow" data-t="' + n.id + '"><i class="' + n.state + '"></i><span><b>' + escS(n.name) + '</b> <small>' + escS(n.detail) + '</small></span><span class="ms">' + (n.ms != null ? n.ms + ' ms' : '') + '</span><span class="fix" data-run="' + n.id + '">Run</span></div>';
      }).join('') || '<div style="color:#a3b0d2;padding:8px 0">Everything is OK.</div>';
      $$(tl, '[data-run]').forEach(function (b) { b.onclick = function () { loadMap(b.getAttribute('data-run')); }; });
    }
    function paintIncs() {
      var box = $(root, '#incs'); if (!box) return;
      var bad = MAP.nodes.filter(function (n) { return n.state === 'down' || n.state === 'warn'; });
      box.innerHTML = bad.map(function (n) {
        return '<div class="incr ' + (n.state === 'down' ? 'p1' : 'p2') + '" data-inc="' + n.id + '"><i></i><div><b>' + escS(n.name) + '</b><small>' + escS(n.detail) + '</small></div><span class="ag">' + (n.state === 'down' ? 'DOWN' : 'WARN') + '</span></div>';
      }).join('') || '<div style="color:#a3b0d2;padding:8px 0">No open items.</div>';
      $$(box, '[data-inc]').forEach(function (r) { r.onclick = function () { selectNode(r.getAttribute('data-inc')); }; });
    }
    function loadMap(focusId) {
      api('/api/ops/map').then(function (r) { return r && r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (d) {
        if (!d || !d.nodes) { var s2 = $(root, '#mapSum'); if (s2) s2.textContent = 'map did not load'; return; }
        MAP = d; paintMap();
        if (focusId) { mapSel = null; selectNode(focusId); }
        tapeLine(d.down ? 'err' : d.warn ? 'warn' : 'ok', 'map', d.nodes.length + ' checks: ' + (d.down || 0) + ' down, ' + (d.warn || 0) + ' warnings');
      });
    }
    var runAll = $(root, '#runAll'); if (runAll) runAll.onclick = function () { loadMap(); toast(root, 'Every check run again'); };
    var clearSel = $(root, '#clearSel'); if (clearSel) clearSel.onclick = clearMap;
    var onlyBad = $(root, '#onlyBad'); if (onlyBad) onlyBad.onclick = function () { onlyBadMap = !onlyBadMap; onlyBad.textContent = onlyBadMap ? 'Show all' : 'Only problems'; paintTests(); };
    loadMap();
    var mapT = setInterval(function () { if (!root.isConnected && root.host && !root.host.isConnected) { clearInterval(mapT); return; } loadMap(); }, 120000);

    bindTabs();
    showPages(root, 'ops', 'map');
    var engLog = $(root, '#engLog');
    if (engLog) engLog.onclick = function () {
      api('/api/ops/switches?log=1').then(function (r) { return r && r.ok ? r.json() : { log: [] }; }).catch(function () { return { log: [] }; }).then(function (d) {
        var rows = d.log || [];
        modal(root, '<h3>Change log</h3><p style="color:#a3b0d2;margin:0 0 10px">Every flip of an engage switch, newest first.</p>'
          + (rows.length ? '<table class="t" style="width:100%"><tr><th style="text-align:left">When</th><th style="text-align:left">Switch</th><th style="text-align:left">Set to</th></tr>' + rows.map(function (x) {
            return '<tr><td>' + escS(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(x.at))) + '</td><td>' + escS(x.label) + '</td><td>' + (x.on ? 'On' : 'Off') + '</td></tr>';
          }).join('') + '</table>' : '<p>No switch has been flipped yet.</p>')
          + '<div style="text-align:right;margin-top:12px"><button class="cbtn" data-close>Close</button></div>');
        var c = $(root, '#mbox [data-close]'); if (c) c.onclick = function () { closeModal(root); };
      });
    };
    var freeze = $(root, '#freeze');
    if (freeze) freeze.onclick = function () { frozen = !frozen; freeze.textContent = frozen ? 'Frozen' : 'Freeze'; toast(root, frozen ? 'Dials held at this reading' : 'Dials live again'); };
    var sweep = $(root, '#sweepNow');
    if (sweep) sweep.onclick = function () { loadAll(); toast(root, 'Swept lamps, dials, APIs and the tape from live endpoints'); };
    var pingAll = $(root, '#pingAll');
    if (pingAll) pingAll.onclick = function () {
      $$(root, '.api').forEach(function (el) {
        pingOne(el.getAttribute('data-a'), el.querySelector('b').textContent, el.querySelector('.rd b'));
      });
    };
    var apiLogs = $(root, '#apiLogs');
    if (apiLogs) apiLogs.onclick = function () { toast(root, 'Open Logs on a service to see that service’s own calls'); };
    var tapePause = $(root, '#tapePause');
    if (tapePause) tapePause.onclick = function () { frozen = !frozen; tapePause.textContent = frozen ? 'Resume' : 'Pause'; };
    var tapeClear = $(root, '#tapeClear');
    if (tapeClear) tapeClear.onclick = function () { var tp = $(root, '#tape'); if (tp) tp.innerHTML = ''; tapeLine('info', 'tape', 'cleared'); };
    loadAll();
  }

  window.bind17fPage = function (root, mode) {
    if (!root) return;
    try {
      showPages(root, mode, 'map');
      if (mode === 'ops') bindOps(root);
      else bindVault(root);
      var dc = $(root, '#dclose'); if (dc) dc.onclick = function () { closeDrawer(root); };
      var sc = $(root, '#scrim'); if (sc) sc.onclick = function () { closeDrawer(root); };
    } catch (e) { console.warn('17f live bind', e); }
  };
})();
