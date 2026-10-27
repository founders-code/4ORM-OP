/* Live Vault + Control room. Snippet HTML is chrome only — numbers come from /api. */
(function () {
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
    var ORGS = ['4ormIQ', '4ormop', '4orm Finance', 'Important documents'];
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
      var h = '<tr><th>ID</th><th>Document</th><th>Version</th><th>Status</th><th>Verified</th><th>Owner</th><th>Note</th></tr>';
      if (!rows.length) {
        h += '<tr class="row"><td colspan="7">' + reason + '</td></tr>';
      } else {
        rows.forEach(function (x) {
          h += '<tr class="row" data-id="' + x.id + '"><td class="id">' + x.id + '</td><td class="nm"><b>' + x.n + '</b><small>' + x.org + ' · ' + x.kind + '</small></td><td class="mut">' + (x.v || '-') + '</td><td><span class="pill ' + stp(x.st) + '">' + x.st + '</span></td><td class="mut">' + (x.dt || '-') + '</td><td class="mut">' + x.own + '</td><td class="mut">' + (x.note || '-') + '</td></tr>';
        });
      }
      var tab = $(root, '#vtab'); if (tab) tab.innerHTML = h;
      $$(root, '#vtab tr.row').forEach(function (e) {
        e.onclick = function () { openDoc(e.getAttribute('data-id')); };
      });
    }
    function openDoc(id) {
      var x = docs.filter(function (r) { return r.id === id; })[0];
      if (!x) return;
      var dbc = $(root, '#dbc'); if (dbc) dbc.innerHTML = 'Vault / ' + x.org + ' / ' + x.kind + ' / <b>' + x.id + '</b>';
      var body = $(root, '#dbody');
      if (body) body.innerHTML = '<div class="box"><div class="vfacts"><div><small>Document</small><span>' + x.n + '</span></div><div><small>Version</small><span>' + (x.v || '-') + '</span></div><div><small>Status</small><span class="pill ' + stp(x.st) + '">' + x.st + '</span></div><div><small>Owner</small><span>' + x.own + '</span></div></div>' + (x.note ? '<div class="watch">' + x.note + '</div>' : '') + '</div>';
      var foot = $(root, '#dfoot');
      if (foot) foot.innerHTML = '<span class="msg">' + x.id + ' · ' + x.n + '</span><button class="btn" type="button" data-action="vault-assign">Assign an owner</button><button class="btn pri" type="button" data-action="vault-upload">Upload a new version</button>';
      openDrawer(root);
    }
    var vq = $(root, '#vq');
    if (vq) vq.oninput = function (e) { q = String(e.target.value || '').toLowerCase(); render(); };
    var dc = $(root, '#dclose'); if (dc) dc.onclick = function () { closeDrawer(root); };
    var sc = $(root, '#scrim'); if (sc) sc.onclick = function () { closeDrawer(root); };
    api('/api/vault/documents').then(function (r) { return r && r.ok ? r.json() : api('/api/vault').then(function (r2) { return r2 && r2.ok ? r2.json() : { docs: [], reason: 'vault unavailable' }; }); }).then(function (d) {
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
    function dialHTML(d) {
      var v = d.value;
      var max = d.red ? d.red * 1.3 : 100;
      var has = v != null && isFinite(Number(v));
      var num = has ? Number(v) : 0;
      var f = Math.max(0, Math.min(1, num / (max || 1)));
      var a = 180 + f * 180;
      var nx = 80 + 40 * Math.cos(a * Math.PI / 180), ny = 84 + 40 * Math.sin(a * Math.PI / 180);
      var shown = has ? (num % 1 ? num.toFixed(2) : String(num)) : '-';
      var note = d.note || (has ? '' : 'no sample yet');
      return '<div class="dial" data-k="' + d.key + '" title="' + note + '"><span class="rl">0–' + (d.red || '-') + '</span><svg viewBox="0 0 160 100">'
        + '<path d="M22 84 A58 58 0 0 1 138 84" stroke="#141c3d" stroke-width="9" fill="none" stroke-linecap="round"/>'
        + '<line class="ndl" x1="80" y1="84" x2="' + nx.toFixed(1) + '" y2="' + ny.toFixed(1) + '" stroke="#e9eefa" stroke-width="2.2" stroke-linecap="round"/>'
        + '</svg><div class="val">' + shown + '<span>' + (d.unit || '') + '</span></div><div class="lab">' + (d.label || d.key) + '</div><div class="dlt">' + note + '</div></div>';
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
      for (var i = 1; i < 4; i++) g += '<line x1="0" y1="' + (i * 9) + '" x2="220" y2="' + (i * 9) + '" stroke="#141c3d" stroke-width="1"/>';
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
      var rooms = $(root, '#pg-ledger .rooms');
      if (rooms) {
        rooms.querySelectorAll('.big').forEach(function (b) { b.textContent = '-'; });
        rooms.querySelectorAll('.s').forEach(function (s) { s.textContent = 'no sample from 4ormIQ yet'; });
      }
      $$(root, '#pg-ledger .led .ch').forEach(function (c) { if (!c.classList.contains('h')) c.textContent = '-'; });
      $$(root, '#pg-ledger .led .hash').forEach(function (c) { c.textContent = '-'; });
    }
    function paintSwitches(sw) {
      var box = $(root, '#engs'); if (!box) return;
      box.innerHTML = (sw || []).map(function (s) {
        return '<div class="sw' + (s.on ? ' on' : '') + '" data-s="' + s.key + '"><div><b>' + s.label + '</b><small>' + (s.sub || '') + '</small></div>'
          + '<button class="tog" type="button" aria-pressed="' + (s.on ? 'true' : 'false') + '" data-action="ops-flip"><i></i></button><span class="swst">' + (s.on ? 'ON' : 'OFF') + '</span></div>';
      }).join('');
      $$(root, '.sw .tog').forEach(function (b) {
        b.onclick = function () {
          var id = b.closest('.sw').getAttribute('data-s');
          var on = b.getAttribute('aria-pressed') !== 'true';
          api('/api/ops/switches', { method: 'POST', body: JSON.stringify({ key: id, on: on }) }).then(function (r) { return r && r.json ? r.json() : {}; }).then(function (d) {
            if (d && d.saved) loadAll();
            else toast(root, (d && d.error) || 'Not saved');
          });
        };
      });
    }
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
    bindTabs();
    showPages(root, 'ops', 'map');
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
