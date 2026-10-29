/* Drive (14) and Integrations (17) on the redesign pattern.
   Each page renders into its own shadow root (#driveDesk, #intDesk) with the design's page CSS
   (/port-css/drive.css, /port-css/integrations.css, copied verbatim from design-reference/redesign plus
   a small "live additions" block). Every control carries a data-action handled by the single delegated
   listener in desk-actions.js (handlers are added to window.deskActions; text fields use the
   __deskInputExt / __deskKeyExt hooks; drops use __deskDropExt on [data-drop-ext]).
   Stars, pins and pin order save to /api/drive/marks. Integrations read /api/integrations/status.
   ?fixture=mockup paints the design's own sample data (redesign-fixture-d.js, loaded only then).
   No icons, no emoji, 24-hour times. */
(function () {
  var TOKEN = ':host{--ground:#0b0c10;--ground2:#0b0c10;--side:#07080b;--card:#fff;--ink:#101a33;--ink2:#4a5672;--ink3:#7a86a0;--line:#e8ecf3;--soft:#f5f7fb;--blue:#2e6bf2;--blue50:#eaf1fe;--green:#12a36a;--green50:#e4f6ee;--amber:#c98408;--amber50:#fff4e0;--red:#e0364f;--red50:#fde9ec;--violet:#6b4fd8;display:block;min-width:0;color:var(--ink);font-size:16px;line-height:normal;font-family:Inter,-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",system-ui,sans-serif}'
    + '*{box-sizing:border-box}button{font:inherit;cursor:pointer}[hidden]{display:none!important}[data-action]{cursor:pointer}'
    + '.card{background:var(--card);border-radius:16px;box-shadow:0 10px 30px rgba(3,10,30,.22);min-width:0}'
    + '.ch{display:flex;align-items:center;gap:8px;padding:14px 16px 10px}.ch h3{margin:0;font-size:14px;font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ch .s{margin-left:auto;font-size:12px;color:var(--ink3);font-weight:600;white-space:nowrap}'
    + '.lnk{color:var(--blue);font-weight:700;font-size:12.5px;white-space:nowrap;cursor:pointer}'
    + '.foot{padding:10px 16px 14px;font-size:12.5px;color:var(--ink3);border-top:1px solid var(--line)}'
    + '.port-body{display:block;min-width:0}'
    /* design shell av-fix: avatar initials are white and bold on every page */
    + '.av{color:#fff!important;font-size:11.5px!important;font-weight:800!important}'
    + '.av{color:#fff;font-weight:800;font-size:11px}'
    + '.desk-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:95;background:#18191f;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;display:none;align-items:center;gap:12px;box-shadow:0 10px 30px rgba(3,10,30,.28)}'
    + '.desk-toast.show{display:flex}.desk-toast button{background:#fff;color:#142036;border:0;border-radius:8px;padding:4px 10px;font-weight:800}';
  var CSS = { drive: '/port-css/drive.css?v=2', int: '/port-css/integrations.css?v=2', neon: '/port-css/neon.css?v=2', intNeon: '/port-css/integrations-neon.css?v=6' };
  var cssText = {};
  var PAGE_ROWS = 12;
  var TOP_DRIVES = 14;

  function fixtureOn() {
    try { return /(?:^|[?&])fixture=mockup(?:&|$)/.test(String(location.search || '')); } catch (e) { return false; }
  }
  function S() { return window.STATE || (window.STATE = {}); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function attr(el, n) { return el && el.getAttribute ? (el.getAttribute(n) || '') : ''; }
  function api(url, opts) {
    opts = opts || {};
    var o = { method: opts.method || 'GET', credentials: 'same-origin', quiet: true, headers: {} };
    if (opts.body != null) { o.headers['content-type'] = 'application/json'; o.body = JSON.stringify(opts.body); }
    var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
    return fn(url, o);
  }
  function readJson(r) { return r && r.json ? r.json().catch(function () { return {}; }) : Promise.resolve({}); }
  /* Resolves with the JSON body on 2xx; rejects with the server's error text otherwise. */
  function call(url, opts) {
    return api(url, opts).then(function (r) {
      return readJson(r).then(function (d) {
        if (!r || !r.ok || (d && (d.ok === false || d.saved === false))) {
          var err = new Error((d && d.error) || ('HTTP ' + (r ? r.status : 0)));
          err.status = r ? r.status : 0;
          err.body = d;
          throw err;
        }
        return d || {};
      });
    });
  }
  function loadCss(key) {
    if (cssText[key] != null) return Promise.resolve(cssText[key]);
    return fetch(CSS[key]).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; }).then(function (t) {
      cssText[key] = t || '';
      return cssText[key];
    });
  }
  function mount(hostId, key) {
    var host = document.getElementById(hostId);
    if (!host) return null;
    var root = host.shadowRoot;
    if (!root) {
      root = host.attachShadow({ mode: 'open' });
      var style = document.createElement('style');
      style.textContent = TOKEN;
      root.appendChild(style);
      var wrap = document.createElement('div');
      wrap.className = 'port-body';
      root.appendChild(wrap);
    }
    var st = root.querySelector('style');
    if (st && cssText[key] != null && st.getAttribute('data-css') !== key) {
      var extra = key === 'int' ? ((cssText.neon || '') + (cssText.intNeon || '')) : '';
      st.textContent = TOKEN + cssText[key] + extra;
      st.setAttribute('data-css', key);
      var wrap = root.querySelector('.port-body');
      if (wrap && key === 'int') wrap.classList.add('neon');
    }
    return root;
  }
  function paintInto(root, html) {
    var wrap = root.querySelector('.port-body');
    var active = root.activeElement;
    var keep = active && active.getAttribute ? attr(active, 'data-action') : '';
    var a = 0, b = 0;
    try { if (keep) { a = active.selectionStart; b = active.selectionEnd; } } catch (e) {}
    wrap.innerHTML = html;
    if (typeof window.bindShadowActions === 'function') window.bindShadowActions(root);
    if (keep) {
      var again = root.querySelector('[data-action="' + keep + '"]');
      if (again && again.focus) { again.focus(); try { again.setSelectionRange(a, b); } catch (e) {} }
    }
  }
  function toast(root, msg, undo) {
    if (!root) return;
    var t = root.getElementById('pgdToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'pgdToast';
      t.className = 'desk-toast';
      root.appendChild(t);
    }
    window.__deskUndo = undo || null;
    t.innerHTML = esc(msg) + (undo ? ' <button type="button" data-action="toast-undo">Undo</button>' : '');
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove('show'); }, 4200);
  }
  function rootFor(id) { var h = document.getElementById(id); return h && h.shadowRoot; }
  function fixtureData() { return window.REDESIGN_FIXTURE_D || null; }
  var fixtureLoading = null;
  function whenFixture(fn) {
    if (!fixtureOn() || fixtureData()) { fn(); return; }
    if (!fixtureLoading) {
      fixtureLoading = new Promise(function (res) {
        var tag = document.createElement('script');
        tag.src = '/redesign-fixture-d.js?v=2';
        tag.onload = res; tag.onerror = res;
        document.head.appendChild(tag);
      });
    }
    fixtureLoading.then(fn);
  }
  function hhmm(ms) {
    try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms)); } catch (e) { return ''; }
  }
  function vanDay(ms) {
    try { return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' }); } catch (e) { return ''; }
  }
  /* "Today 14:05", "Yesterday", "Oct 14", "Oct 14, 2025" - real dates, 24-hour. */
  function when(iso) {
    var ts = Date.parse(iso || '');
    if (!Number.isFinite(ts)) return '-';
    var day = vanDay(ts);
    if (day === vanDay(Date.now())) return 'Today ' + hhmm(ts);
    if (day === vanDay(Date.now() - 86400000)) return 'Yesterday';
    var opts = { timeZone: 'America/Vancouver', month: 'short', day: 'numeric' };
    if (day.slice(0, 4) !== vanDay(Date.now()).slice(0, 4)) opts.year = 'numeric';
    try { return new Date(ts).toLocaleDateString('en-US', opts); } catch (e) { return day; }
  }
  function ago(iso) {
    var ts = Date.parse(iso || '');
    if (!Number.isFinite(ts)) return '';
    var d = Math.floor((Date.now() - ts) / 86400000);
    if (d <= 0) return 'edited today';
    if (d === 1) return 'edited yesterday';
    if (d < 45) return 'edited ' + d + 'd ago';
    return 'edited ' + when(iso);
  }

  /* ============================== DRIVE ============================== */
  function D() {
    var s = S();
    if (!s.drv) s.drv = { sel: '', open: {}, q: '', mode: 'list', all: false, moreDrives: false, ask: null, marks: { stars: [], pins: [], links: {} } };
    return s.drv;
  }
  function kids(n) { return (n && (n.children || n.folders)) || []; }
  function files(n) { return (n && (n.files || n.docs)) || []; }
  function walk(nodes, fn, depth, trail) {
    (nodes || []).forEach(function (n) {
      if (!n || !n.id) return;
      var path = (trail || []).concat([n.name || 'Folder']);
      fn(n, depth || 0, path);
      walk(kids(n), fn, (depth || 0) + 1, path);
    });
  }
  function drives() { return fixtureOn() && fixtureData() ? fixtureData().drives : (S().drives || []); }
  function findNode(id) {
    var hit = null;
    walk(drives(), function (n) { if (!hit && n.id === id) hit = n; });
    return hit;
  }
  function pathOf(id) {
    var out = null;
    walk(drives(), function (n, d, path) { if (!out && n.id === id) out = path; });
    return out || [];
  }
  function parentOf(id) {
    var hit = null;
    walk(drives(), function (n) { if (!hit && kids(n).some(function (c) { return c && c.id === id; })) hit = n; });
    return hit;
  }
  function isTop(id) { return drives().some(function (d) { return d && d.id === id; }); }
  function kindOf(f) {
    var m = String((f && (f.mime || f.kind)) || '').toLowerCase();
    var n = String((f && f.name) || '').toLowerCase();
    if (m.indexOf('spreadsheet') >= 0 || m.indexOf('sheet') >= 0 || /\.(xlsx?|csv)$/.test(n)) return 's';
    if (m.indexOf('presentation') >= 0 || m.indexOf('slide') >= 0 || /\.pptx?$/.test(n)) return 'sl';
    if (m.indexOf('pdf') >= 0 || /\.pdf$/.test(n)) return 'p';
    if (m.indexOf('image') >= 0 || /\.(png|jpe?g|gif|webp)$/.test(n)) return 'i';
    return 'd';
  }
  var BADGE = { d: 'DOC', p: 'PDF', s: 'XLS', sl: 'PPT', i: 'IMG' };
  var WORD = { d: 'Doc', p: 'PDF', s: 'Sheet', sl: 'Slides', i: 'Image' };
  var TINT = { d: '#e1ecff', p: '#fde9ec', s: '#e4f6ee', sl: '#ffe6cf', i: '#ece4ff' };
  function thumbOf(f) {
    var own = String((f && (f.thumb || f.thumbUrl)) || '');
    if (own.indexOf('/') === 0 || own.indexOf('https://') === 0) return own;
    var id = String((f && (f.driveFileId || f.id)) || '');
    return /^[\w-]{8,}$/.test(id) && !/^[0-9a-f-]{36}$/i.test(id) ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w320' : '';
  }
  function starred(id) { return D().marks.stars.indexOf(id) >= 0; }
  function pinned(id) { return D().marks.pins.some(function (p) { return p.id === id; }); }
  function spaces() { return (S().packages || []).filter(function (p) { return p && p.id; }); }
  function linkFor(id) { return (D().marks.links || {})[id] || null; }

  var loaded = { drives: false, marks: false, spaces: false };
  function loadDrivesOnce() {
    if (loaded.drives || fixtureOn()) return;
    loaded.drives = true;
    if ((S().drives || []).some(function (d) { return d && d.name === 'My Drive'; })) return;
    call('/api/drives').then(function (d) {
      var fresh = (d && d.drives) || [];
      if (!fresh.length) { D().drivesNote = d && d.status === 'busy' ? 'Drive is busy. Try again in a minute.' : ''; paintDrive(); return; }
      var have = {};
      (S().drives || []).forEach(function (n) { if (n && n.id) have[n.id] = n; });
      S().drives = fresh.map(function (n) { return have[n.id] && have[n.id].loaded ? have[n.id] : n; });
      paintDrive();
    }).catch(function (err) {
      D().drivesNote = err && err.status === 403 ? 'Drive is for the room owner only.' : 'Drive could not be reached.';
      paintDrive();
    });
  }
  /* Browser-only stars/pins from before the server field: send them up once, then forget them. */
  function migrateLocal(marks) {
    var localStars = {}, localPins = [];
    try { localStars = JSON.parse(localStorage.getItem('cr_drive_star') || '{}') || {}; } catch (e) { localStars = {}; }
    try { localPins = JSON.parse(localStorage.getItem('cr_pins') || '[]') || []; } catch (e) { localPins = []; }
    var jobs = [];
    Object.keys(localStars).forEach(function (id) {
      if (localStars[id] && localStars[id] !== '0' && /^[\w-]{8,}$/.test(id) && marks.stars.indexOf(id) < 0) jobs.push({ kind: 'star', id: id, on: true });
    });
    (Array.isArray(localPins) ? localPins : []).slice(0, 40).reverse().forEach(function (p) {
      if (p && /^[\w-]{8,}$/.test(String(p.id || '')) && !marks.pins.some(function (x) { return x.id === p.id; })) {
        jobs.push({ kind: 'pin', id: p.id, on: true, name: p.name, url: p.url, mime: p.mime, thumb: p.thumb });
      }
    });
    if (!jobs.length) return Promise.resolve(null);
    return jobs.reduce(function (chain, body) {
      return chain.then(function () { return call('/api/drive/marks', { method: 'POST', body: body }); });
    }, Promise.resolve()).then(function (last) {
      try { localStorage.removeItem('cr_drive_star'); localStorage.removeItem('cr_pins'); } catch (e) {}
      return last;
    }).catch(function () { return null; });
  }
  function loadMarks(force) {
    if (fixtureOn()) return;
    if (loaded.marks && !force) return;
    loaded.marks = true;
    call('/api/drive/marks').then(function (d) {
      var marks = { stars: d.stars || [], pins: d.pins || [], links: d.links || {} };
      D().marks = marks;
      D().marksErr = '';
      paintDrive();
      return migrateLocal(marks).then(function (last) {
        if (last) { D().marks = { stars: last.stars || [], pins: last.pins || [], links: marks.links }; paintDrive(); }
      });
    }).catch(function () { D().marksErr = 'Stars and pins could not load.'; paintDrive(); });
  }
  function loadSpacesOnce() {
    if (loaded.spaces || fixtureOn() || spaces().length) return;
    loaded.spaces = true;
    call('/api/spaces').then(function (d) {
      var rows = d.spaces || d.packages || [];
      if (rows.length && !spaces().length) S().packages = rows;
      paintDrive();
    }).catch(function () {});
  }
  function loadFolder(id) {
    if (fixtureOn() || id === 'shared-with-me') return;
    var node = findNode(id);
    if (!node || node.loaded || node._loading) return;
    node._loading = true;
    node.err = '';
    call('/api/drive/children?id=' + encodeURIComponent(id)).then(function (d) {
      node._loading = false;
      if (d.error) throw new Error(d.error);
      var prev = {};
      kids(node).forEach(function (c) { if (c && c.id) prev[c.id] = c; });
      var next = (d.folders || []).map(function (f) {
        var old = prev[f.id];
        return old ? Object.assign(old, { name: f.name, url: f.url || '' }) : { id: f.id, name: f.name, url: f.url || '', children: [], files: [] };
      });
      node.children = next;
      if (node.folders) node.folders = next;
      node.files = d.files || [];
      node.docs = node.files;
      node.loaded = true;
      paintDrive();
    }).catch(function (err) {
      node._loading = false;
      node.err = (err && err.message && !/^HTTP/.test(err.message)) ? err.message : 'Drive could not open this folder.';
      paintDrive();
    });
  }
  function selNode() {
    var dv = D();
    var n = dv.sel ? findNode(dv.sel) : null;
    if (!n) { n = drives()[0] || null; if (n) dv.sel = n.id; }
    return n;
  }
  function countOf(n) {
    if (!n) return '';
    if (n.id === 'shared-with-me' || n.loaded || isTop(n.id)) return String(files(n).length + kids(n).length);
    return '';
  }
  function treeRows() {
    var dv = D();
    var top = drives();
    var mine = top.filter(function (d) { return d.id === 'shared-with-me' || d.name === 'My Drive'; });
    var shared = top.filter(function (d) { return mine.indexOf(d) < 0; });
    var starredFirst = shared.filter(function (d) { return starred(d.id); }).concat(shared.filter(function (d) { return !starred(d.id); }));
    var shown = dv.moreDrives ? starredFirst : starredFirst.slice(0, TOP_DRIVES);
    function row(n, depth) {
      var open = !!dv.open[n.id];
      var sub = kids(n);
      var canOpen = n.id !== 'shared-with-me' && (!n.loaded || sub.length > 0);
      var st = starred(n.id);
      var html = '<div class="dr' + (dv.sel === n.id ? ' on' : '') + '" data-action="drive-pick" data-id="' + esc(n.id) + '" style="padding-left:' + (14 + depth * 14) + 'px">'
        + '<span class="tg" data-action="drive-toggle" data-id="' + esc(n.id) + '">' + (canOpen ? (open ? '&minus;' : '+') : '') + '</span>'
        + '<span class="nm">' + esc(n.name || 'Folder') + '</span>'
        + (n.id === 'shared-with-me' ? '' : '<span class="sb' + (st ? ' on' : '') + '" data-action="drive-star" data-id="' + esc(n.id) + '">' + (st ? 'Starred' : 'Star') + '</span>')
        + '<span class="n">' + esc(countOf(n)) + '</span></div>';
      if (open) {
        if (n._loading) html += '<div class="dr more" style="padding-left:' + (28 + depth * 14) + 'px">Loading…</div>';
        else if (n.err) html += '<div class="dr more" data-action="drive-retry" data-id="' + esc(n.id) + '" style="padding-left:' + (28 + depth * 14) + 'px">' + esc(n.err) + ' Click to retry.</div>';
        sub.forEach(function (c) { html += row(c, depth + 1); });
      }
      return html;
    }
    var html = mine.map(function (n) { return row(n, 0); }).join('');
    if (shown.length) html += '<div class="sepl"></div>' + shown.map(function (n) { return row(n, 0); }).join('');
    if (starredFirst.length > TOP_DRIVES) {
      html += '<div class="dr more" data-action="drive-more-drives">' + (dv.moreDrives ? 'Show fewer drives' : '+ ' + (starredFirst.length - TOP_DRIVES) + ' more drives') + '</div>';
    }
    if (!top.length) html += '<div class="empty">' + esc(dv.drivesNote || (loaded.drives ? 'Loading Drive…' : 'Drive is unavailable.')) + '</div>';
    return html;
  }
  function poolFiles() {
    var dv = D();
    var q = String(dv.q || '').trim().toLowerCase();
    var node = selNode();
    var rows;
    if (q) {
      rows = [];
      var seen = {};
      walk(drives(), function (n, depth, path) {
        files(n).forEach(function (f) {
          if (!f || seen[f.id] || String(f.name || '').toLowerCase().indexOf(q) < 0) return;
          seen[f.id] = 1;
          rows.push({ f: f, folder: path[path.length - 1] || '' });
        });
      });
    } else {
      var here = node ? (node.name || '') : '';
      rows = files(node).map(function (f) { return { f: f, folder: f.folderLabel || here }; });
    }
    rows.sort(function (a, b) { return (Date.parse(b.f.modified || '') || 0) - (Date.parse(a.f.modified || '') || 0); });
    return rows;
  }
  function fileAttrs(f) {
    return ' draggable="true" data-kind="drivefile" data-id="' + esc(f.id) + '" data-drive="' + esc(f.id) + '" data-name="' + esc(f.name || '') + '" data-url="' + esc(f.url || '') + '" data-mime="' + esc(f.mime || '') + '"';
  }
  function avOf(owner) {
    var o = String(owner || 'Shared');
    if (o === 'You') return { t: 'You', c: '#2e6bf2', w: 'You' };
    if (o === 'Shared') return { t: 'S', c: '#7a86a0', w: 'Shared' };
    var parts = o.split(/\s+/).filter(Boolean);
    return { t: ((parts[0] || 'S')[0] + ((parts[1] || '')[0] || '')).toUpperCase(), c: '#c98408', w: parts[0] || o };
  }
  function pinsHtml() {
    var pins = D().marks.pins || [];
    var cards = pins.map(function (p) {
      var k = kindOf(p);
      var img = thumbOf(p);
      return '<div class="pin" data-action="drive-open" data-drop-ext="drive-pin"' + fileAttrs(p).replace('data-kind="drivefile"', 'data-kind="drivepin"') + '>'
        + '<div class="th" style="background:' + TINT[k] + '"><i></i>' + (img ? '<img alt="" loading="lazy" src="' + esc(img) + '" onerror="this.remove()">' : '') + '</div>'
        + '<div class="nm">' + esc(p.name || 'File') + '</div><div class="mt">' + esc(WORD[k] + (p.modified ? ' · ' + ago(p.modified) : '')) + '</div>'
        + '<div class="ac"><span data-action="drive-unpin" data-id="' + esc(p.id) + '">Unpin</span></div></div>';
    }).join('');
    return '<section class="card"><div class="ch"><h3>Pinned for the raise</h3><span class="s">drag a file here to pin it</span></div>'
      + '<div class="pins" data-drop-ext="drive-pin">' + (cards || '<div class="pinempty">Drag a file here, or click Pin on a row. Deck, model, SAFE and the data room stay one click away.</div>') + '</div></section>';
  }
  function spacesHtml() {
    var list = spaces();
    if (!list.length) return '';
    return '<section class="card"><div class="ch"><h3>Drop onto a Space</h3><span class="s">drag a file onto a Space to attach it</span></div>'
      + '<div class="spz">' + list.slice(0, 16).map(function (sp) {
        return '<span class="spd" data-drop-ext="drive-space" data-space="' + esc(sp.id) + '" data-action="drive-space-open">' + esc(sp.name || 'Space') + '</span>';
      }).join('') + '</div></section>';
  }
  function driveHtml() {
    var dv = D();
    var node = selNode();
    var rows = poolFiles();
    var total = rows.length;
    var shown = dv.all ? rows : rows.slice(0, PAGE_ROWS);
    var title = dv.q ? 'Search: ' + dv.q : (node ? node.name : 'Drive');
    var sub = dv.q ? total + ' match' + (total === 1 ? '' : 'es') : total + ' file' + (total === 1 ? '' : 's') + ' · newest first';
    var body;
    if (node && !node.loaded && !isTop(node.id) && node.id !== 'shared-with-me' && !dv.q) body = '<div class="empty">' + (node.err ? esc(node.err) + ' <span class="lnk" data-action="drive-retry" data-id="' + esc(node.id) + '">Retry</span>' : 'Loading this folder…') + '</div>';
    else if (!shown.length) body = '<div class="empty">' + (dv.q ? 'No files match. Search covers the folders opened so far.' : 'No files in this folder.') + '</div>';
    else if (dv.mode === 'grid') {
      body = '<div class="grid">' + shown.map(function (r) {
        var f = r.f, k = kindOf(f), img = thumbOf(f);
        return '<div class="gcard" data-action="drive-open"' + fileAttrs(f) + '><div class="th" style="background:' + TINT[k] + '">' + (img ? '<img alt="" loading="lazy" src="' + esc(img) + '" onerror="this.remove()">' : '') + '</div>'
          + '<div class="nm">' + esc(f.name || 'File') + '</div><div class="mt">' + esc(BADGE[k] + ' · ' + when(f.modified)) + '</div></div>';
      }).join('') + '</div>';
    } else {
      /* Design 14: four columns. Pin and Copy float in on row hover inside the Owner cell. */
      body = '<table class="tbl">'
        + '<tr><th>Name</th><th>Linked to</th><th>Modified</th><th>Owner</th></tr><tbody>'
        + shown.map(function (r) {
          var f = r.f, k = kindOf(f), link = linkFor(f.id), av = avOf(f.owner), pin = pinned(f.id);
          return '<tr data-action="drive-open"' + fileAttrs(f) + '><td><div class="fn"><span class="ty t-' + k + '">' + BADGE[k] + '</span><div style="min-width:0"><b>' + esc(f.name || 'File') + '</b><span>' + esc(r.folder) + '</span></div></div></td>'
            + '<td>' + (link ? '<span class="sp" data-action="drive-space-open" data-space="' + esc(link.spaceId) + '">' + esc(link.space) + '</span>' : '<span class="lk" data-action="drive-link" data-id="' + esc(f.id) + '">+ Link to Space</span>') + '</td>'
            + '<td class="when">' + esc(when(f.modified)) + '</td>'
            + '<td class="ownc"><div class="who"><span class="av" style="background:' + av.c + '">' + esc(av.t === 'You' ? 'Me' : av.t) + '</span>' + esc(av.w) + '</div>'
            + '<span class="rpin"><span class="star' + (pin ? ' on' : '') + '" data-action="drive-pin" data-id="' + esc(f.id) + '">' + (pin ? 'Pinned' : 'Pin') + '</span><span class="racts" style="display:inline-flex"><span data-action="drive-copy" data-id="' + esc(f.id) + '">Copy</span></span></span></td></tr>';
        }).join('') + '</tbody></table>';
    }
    var foot = total > PAGE_ROWS
      ? 'Showing ' + shown.length + ' of ' + total + ' &middot; <span class="lnk" data-action="drive-show-all">' + (dv.all ? 'Show fewer' : 'Show all') + '</span> &middot; click a file to open it in the viewer'
      : (total ? 'Showing ' + total + ' &middot; click a file to open it in the viewer' : 'Pick a folder on the left');
    var crumb = node && !dv.q ? pathOf(node.id).join(' / ') : '';
    return '<div class="bar"><h1>Drive</h1><span class="sub">Google Drive &mdash; files open right here</span>'
      + '<div class="r"><input class="search" type="text" placeholder="Search Drive" aria-label="Search Drive" data-action="drive-search" data-ext-field value="' + esc(dv.q) + '">'
      + '<div class="seg"><span class="' + (dv.mode !== 'grid' ? 'on' : '') + '" data-action="drive-mode" data-mode="list">List</span><span class="' + (dv.mode === 'grid' ? 'on' : '') + '" data-action="drive-mode" data-mode="grid">Thumbnails</span></div>'
      + '<button class="btn" type="button" data-action="drive-newfolder">New folder</button><button class="btn pri" type="button" data-action="drive-newdoc">+ New doc</button></div></div>'
      + '<div class="lay"><section class="card"><div class="lh">Drives <span class="lnk" data-action="drive-expand">Expand all</span><span class="lnk" data-action="drive-collapse">Collapse</span></div>'
      + treeRows()
      + '<div style="height:8px"></div><div class="tools"><button type="button" data-action="drive-subfolder">+ Subfolder</button><button type="button" data-action="drive-rename">Rename</button><button type="button" data-action="drive-move">Move</button></div></section>'
      + '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">'
      + (D().marksErr ? '<div class="card empty">' + esc(D().marksErr) + ' <span class="lnk" data-action="drive-marks-retry">Retry</span></div>' : '')
      + pinsHtml()
      + '<section class="card"><div class="ch"><h3 title="' + esc(crumb) + '">' + esc(title) + '</h3><span class="s">' + esc(sub) + '</span></div>' + body + '<div class="foot">' + foot + '</div></section>'
      + spacesHtml()
      + '</div></div>'
      + askHtml();
  }
  function askHtml() {
    var a = D().ask;
    if (!a) return '';
    if (a.kind === 'text') {
      return '<div class="ask" data-action="drive-ask-cancel"><div class="askb" data-action="drive-ask-stay"><h3>' + esc(a.title) + '</h3>'
        + '<input type="text" maxlength="180" data-action="drive-ask-input" data-ext-field value="' + esc(a.value || '') + '">'
        + '<div class="er">' + esc(a.err || '') + '</div>'
        + '<div class="acts"><button class="btn" type="button" data-action="drive-ask-cancel">Cancel</button><button class="btn pri" type="button" data-action="drive-ask-ok">' + esc(a.ok || 'Save') + '</button></div></div></div>';
    }
    var q = String(a.q || '').toLowerCase();
    var rows = (a.rows || []).filter(function (r) { return !q || r.label.toLowerCase().indexOf(q) >= 0; }).slice(0, 150);
    return '<div class="ask" data-action="drive-ask-cancel"><div class="askb" data-action="drive-ask-stay"><h3>' + esc(a.title) + '</h3>'
      + '<input type="text" placeholder="' + esc(a.placeholder || 'Find…') + '" data-action="drive-ask-q" data-ext-field value="' + esc(a.q || '') + '">'
      + '<div class="plist">' + (rows.length ? rows.map(function (r) { return '<div data-action="drive-ask-pick" data-id="' + esc(r.id) + '">' + esc(r.label) + '</div>'; }).join('') : '<div>' + esc(a.none || 'Nothing matches') + '</div>') + '</div>'
      + '<div class="er">' + esc(a.err || '') + '</div>'
      + '<div class="acts"><button class="btn" type="button" data-action="drive-ask-cancel">Cancel</button></div></div></div>';
  }
  function paintDrive() {
    if (S().desk !== 'drive') return;
    var go = function () {
      loadCss('drive').then(function () {
        var root = mount('driveDesk', 'drive');
        if (!root) return;
        paintInto(root, driveHtml());
        var host = document.getElementById('driveDesk');
        if (host) host.setAttribute('data-port-ready', '1');
        if (D().ask && D().ask.focus) {
          D().ask.focus = false;
          var box = root.querySelector('[data-action="drive-ask-input"], [data-action="drive-ask-q"]');
          if (box) { box.focus(); if (box.select) box.select(); }
        }
      });
    };
    if (fixtureOn()) {
      whenFixture(function () {
        var fx = fixtureData();
        if (fx && !D().__fx) { D().__fx = true; D().marks = { stars: fx.stars || [], pins: fx.pins || [], links: fx.links || {} }; }
        go();
      });
      return;
    }
    loadDrivesOnce();
    loadMarks(false);
    loadSpacesOnce();
    go();
  }

  function writeOk() { return !fixtureOn(); }
  function fileById(id) {
    var hit = null;
    walk(drives(), function (n) { files(n).forEach(function (f) { if (!hit && f && f.id === id) hit = f; }); });
    if (!hit) (D().marks.pins || []).forEach(function (p) { if (!hit && p.id === id) hit = p; });
    return hit;
  }
  function setMark(root, kind, id, on, f) {
    var dv = D();
    var before = JSON.parse(JSON.stringify(dv.marks));
    if (kind === 'star') {
      dv.marks.stars = dv.marks.stars.filter(function (x) { return x !== id; });
      if (on) dv.marks.stars.unshift(id);
    } else {
      dv.marks.pins = dv.marks.pins.filter(function (p) { return p.id !== id; });
      if (on && f) dv.marks.pins.unshift({ id: id, name: f.name || '', url: f.url || '', mime: f.mime || '', thumb: f.thumb || '', modified: f.modified || '' });
    }
    paintDrive();
    if (!writeOk()) { toast(root, (on ? (kind === 'star' ? 'Starred' : 'Pinned') : (kind === 'star' ? 'Unstarred' : 'Unpinned')) + ' (fixture)'); return; }
    var body = { kind: kind, id: id, on: on };
    if (f) { body.name = f.name; body.url = f.url; body.mime = f.mime; body.thumb = f.thumb; body.modified = f.modified; }
    call('/api/drive/marks', { method: 'POST', body: body }).then(function (d) {
      dv.marks.stars = d.stars || dv.marks.stars;
      dv.marks.pins = d.pins || dv.marks.pins;
      paintDrive();
      var label = kind === 'star' ? (on ? 'Starred' : 'Star removed') : (on ? 'Pinned for the raise' : 'Unpinned');
      toast(root, label, function () { setMark(root, kind, id, !on, f); });
    }).catch(function () {
      dv.marks = before;
      paintDrive();
      toast(root, 'Could not save that ' + (kind === 'star' ? 'star' : 'pin'));
    });
  }
  function savePinOrder(root, ids) {
    var dv = D();
    var before = dv.marks.pins.slice();
    var byId = {};
    before.forEach(function (p) { byId[p.id] = p; });
    dv.marks.pins = ids.map(function (id) { return byId[id]; }).filter(Boolean);
    paintDrive();
    if (!writeOk()) { toast(root, 'Pin order changed (fixture)'); return; }
    call('/api/drive/marks', { method: 'POST', body: { kind: 'pin', order: ids } }).then(function (d) {
      if (d.pins) dv.marks.pins = d.pins;
      paintDrive();
      toast(root, 'Pin order saved');
    }).catch(function () { dv.marks.pins = before; paintDrive(); toast(root, 'Could not save the pin order'); });
  }
  function attachToSpace(root, spaceId, f) {
    var sp = spaces().filter(function (x) { return String(x.id) === String(spaceId); })[0];
    if (!f || !spaceId) return;
    if (!writeOk()) { toast(root, 'Linked to ' + ((sp && sp.name) || 'Space') + ' (fixture)'); return; }
    if (!/^[0-9a-f-]{36}$/i.test(String(spaceId))) { toast(root, 'Save that Space first, then link files to it'); return; }
    call('/api/spaces/' + encodeURIComponent(spaceId) + '/items', { method: 'POST', body: { kind: 'file', name: f.name || 'File', mime: f.mime || '', url: f.url || '', driveFileId: f.id } }).then(function () {
      D().marks.links = D().marks.links || {};
      D().marks.links[f.id] = { spaceId: String(spaceId), space: (sp && sp.name) || 'Space' };
      if (sp) sp.docCount = (sp.docCount || 0) + 1;
      paintDrive();
      toast(root, 'Added to ' + ((sp && sp.name) || 'the Space'));
      loadMarks(true);
    }).catch(function (err) { toast(root, 'Could not add that file to the Space' + (err && err.message && !/^HTTP/.test(err.message) ? ' - ' + err.message : '')); });
  }
  function driveWrite(root, body, okMsg) {
    if (!writeOk()) { toast(root, okMsg + ' (fixture)'); return Promise.resolve(null); }
    return call('/api/drive', { method: 'POST', body: body }).then(function (d) { toast(root, okMsg); return d; })
      .catch(function () { toast(root, 'Drive did not save that. Try again.'); return null; });
  }
  function reload(node) {
    if (!node) return;
    node.loaded = false;
    D().open[node.id] = true;
    loadFolder(node.id);
  }
  function targetFolder(root, needPick) {
    var n = D().sel ? findNode(D().sel) : null;
    if (!n) {
      if (needPick) { toast(root, 'Pick a folder on the left first'); return null; }
      n = drives()[0] || null;
      if (!n) { toast(root, 'Drive is unavailable'); return null; }
    }
    if (n.id === 'shared-with-me') { toast(root, 'Pick a folder inside Shared with me'); return null; }
    return n;
  }
  function openAsk(a) { a.focus = true; D().ask = a; paintDrive(); }
  function closeAsk() { D().ask = null; paintDrive(); }
  function mkdir(root, needPick) {
    var p = targetFolder(root, needPick);
    if (!p) return;
    if (pathOf(p.id).length >= 5) { toast(root, 'Folders go four layers deep'); return; }
    openAsk({ kind: 'text', title: 'New folder in ' + (p.name || 'Drive'), value: '', ok: 'Create', go: function (name) {
      return driveWrite(root, { action: 'mkdir', name: name, parentId: p.id }, 'Folder created').then(function (d) { if (d) { reload(p); D().sel = p.id; } });
    } });
  }
  function openFile(f) {
    if (!f) return;
    if (typeof window.openDocView === 'function') window.openDocView(f.name || '', f.url || '', f.id || '');
    else if (f.url) window.open(f.url, '_blank', 'noopener');
  }

  var driveActions = {
    'drive-pick': function (el) {
      var id = attr(el, 'data-id');
      var dv = D();
      var was = dv.sel === id;
      dv.sel = id;
      dv.q = '';
      dv.all = false;
      dv.open[id] = was ? !dv.open[id] : true;
      if (dv.open[id]) loadFolder(id);
      paintDrive();
    },
    'drive-toggle': function (el, root, e) {
      if (e && e.stopPropagation) e.stopPropagation();
      var id = attr(el, 'data-id');
      var dv = D();
      dv.open[id] = !dv.open[id];
      if (dv.open[id]) loadFolder(id);
      paintDrive();
    },
    'drive-retry': function (el) {
      var n = findNode(attr(el, 'data-id'));
      if (n) { n.err = ''; n.loaded = false; loadFolder(n.id); paintDrive(); }
    },
    'drive-more-drives': function () { D().moreDrives = !D().moreDrives; paintDrive(); },
    'drive-expand': function () {
      var ids = [];
      walk(drives(), function (n) { if (n.id === 'shared-with-me') return; D().open[n.id] = true; if (!n.loaded && !isTop(n.id)) ids.push(n.id); });
      paintDrive();
      var i = 0;
      (function next() { if (i >= ids.length || i >= 12) return; loadFolder(ids[i]); i += 1; setTimeout(next, 150); })();
    },
    'drive-collapse': function () { D().open = {}; paintDrive(); },
    'drive-star': function (el, root, e) {
      if (e && e.stopPropagation) e.stopPropagation();
      var id = attr(el, 'data-id');
      if (!id) return;
      setMark(root, 'star', id, !starred(id), null);
    },
    'drive-pin': function (el, root, e) {
      if (e && e.stopPropagation) e.stopPropagation();
      var id = attr(el, 'data-id');
      var f = fileById(id);
      if (!f) return;
      setMark(root, 'pin', id, !pinned(id), f);
    },
    'drive-unpin': function (el, root, e) {
      if (e && e.stopPropagation) e.stopPropagation();
      var id = attr(el, 'data-id');
      setMark(root, 'pin', id, false, fileById(id));
    },
    'drive-open': function (el) { openFile(fileById(attr(el, 'data-id')) || { id: attr(el, 'data-id'), name: attr(el, 'data-name'), url: attr(el, 'data-url') }); },
    'drive-copy': function (el, root, e) {
      if (e && e.stopPropagation) e.stopPropagation();
      var f = fileById(attr(el, 'data-id'));
      var url = (f && f.url) || '';
      if (!url) { toast(root, 'No link for this file'); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { toast(root, 'Link copied'); }, function () { toast(root, url); });
      else toast(root, url);
    },
    'drive-link': function (el, root, e) {
      if (e && e.stopPropagation) e.stopPropagation();
      var f = fileById(attr(el, 'data-id'));
      if (!f) return;
      var list = spaces();
      if (!list.length) { toast(root, 'No Spaces yet. Make one on the Spaces page.'); loadSpacesOnce(); return; }
      openAsk({ kind: 'pick', title: 'Link ' + (f.name || 'file') + ' to a Space', placeholder: 'Find a Space…', none: 'No Spaces match',
        rows: list.map(function (sp) { return { id: String(sp.id), label: sp.name || 'Space' }; }),
        go: function (spaceId) { attachToSpace(root, spaceId, f); } });
    },
    'drive-space-open': function (el, root, e) {
      if (e && e.stopPropagation) e.stopPropagation();
      var id = attr(el, 'data-space');
      if (!id) return;
      var sp = spaces().filter(function (x) { return String(x.id) === String(id); })[0];
      S().pkg = sp || { id: id };
      if (typeof window.switchView === 'function') window.switchView('work');
      if (window.history && history.replaceState) { try { history.replaceState({}, '', '/spaces'); } catch (err) {} }
    },
    'drive-show-all': function () { D().all = !D().all; paintDrive(); },
    'drive-mode': function (el) { D().mode = attr(el, 'data-mode') === 'grid' ? 'grid' : 'list'; try { localStorage.setItem('cr_doc_mode', D().mode); } catch (e) {} paintDrive(); },
    'drive-search': function () {},
    'drive-newfolder': function (el, root) { mkdir(root, false); },
    'drive-subfolder': function (el, root) { mkdir(root, true); },
    'drive-newdoc': function (el, root) {
      var p = targetFolder(root, false);
      if (!p) return;
      openAsk({ kind: 'text', title: 'New doc in ' + (p.name || 'Drive'), value: 'Untitled document', ok: 'Create', go: function (name) {
        return driveWrite(root, { action: 'mkfile', name: name, parentId: p.id }, 'Doc created').then(function (d) {
          if (!d) return;
          reload(p);
          if (d.id) openFile({ id: d.id, name: d.name || name, url: d.url || '' });
        });
      } });
    },
    'drive-rename': function (el, root) {
      var f = targetFolder(root, true);
      if (!f) return;
      if (isTop(f.id)) { toast(root, 'Drives are renamed in Google Drive. Pick a folder.'); return; }
      openAsk({ kind: 'text', title: 'Rename folder', value: f.name || '', ok: 'Save', go: function (name) {
        if (name === f.name) return Promise.resolve();
        return driveWrite(root, { action: 'rename', id: f.id, name: name }, 'Renamed').then(function (d) { if (d || !writeOk()) { f.name = name; paintDrive(); } });
      } });
    },
    'drive-move': function (el, root) {
      var f = targetFolder(root, true);
      if (!f) return;
      if (isTop(f.id)) { toast(root, 'Drives cannot be moved. Pick a folder.'); return; }
      var skip = {};
      walk([f], function (n) { skip[n.id] = 1; });
      var rows = [];
      walk(drives(), function (n, depth, path) { if (!skip[n.id] && n.id !== 'shared-with-me') rows.push({ id: n.id, label: path.join(' / ') }); });
      openAsk({ kind: 'pick', title: 'Move ' + (f.name || 'folder'), placeholder: 'Find a folder…', none: 'No folders match. Open more folders in the tree to load them.', rows: rows,
        go: function (destId) {
          var from = parentOf(f.id);
          var dest = findNode(destId);
          return driveWrite(root, { action: 'move', id: f.id, parentId: destId }, 'Moved to ' + ((dest && dest.name) || 'folder')).then(function (d) {
            if (!d) return;
            if (from) reload(from);
            if (dest) reload(dest);
          });
        } });
    },
    'drive-ask-stay': function () {},
    'drive-ask-input': function () {},
    'drive-ask-q': function () {},
    'drive-ask-cancel': function (el, root, e) {
      var t = (e && e.composedPath && e.composedPath()[0]) || null;
      if (attr(el, 'class') === 'ask' && t !== el) return;
      closeAsk();
    },
    'drive-ask-ok': function (el, root) {
      var a = D().ask;
      if (!a || a.kind !== 'text') return;
      var box = root.querySelector('[data-action="drive-ask-input"]');
      var v = String((box && box.value) || '').trim();
      if (!v) { a.err = 'Type a name first'; a.value = ''; a.focus = true; paintDrive(); return; }
      D().ask = null;
      paintDrive();
      var p = a.go && a.go(v);
      if (p && p.then) p.then(paintDrive);
    },
    'drive-ask-pick': function (el) {
      var a = D().ask;
      var id = attr(el, 'data-id');
      if (!a || !id) return;
      D().ask = null;
      paintDrive();
      var p = a.go && a.go(id);
      if (p && p.then) p.then(paintDrive);
    },
    'drive-marks-retry': function () { loadMarks(true); }
  };
  function onDriveDrop(col, payload, root) {
    var zone = attr(col, 'data-drop-ext');
    if (zone === 'drive-pin') {
      if (payload.kind === 'drivepin') {
        var ids = (D().marks.pins || []).map(function (p) { return p.id; }).filter(function (x) { return x !== payload.id; });
        var before = attr(col, 'data-id');
        var at = before ? ids.indexOf(before) : -1;
        if (at < 0) ids.push(payload.id); else ids.splice(at, 0, payload.id);
        savePinOrder(root, ids);
        return true;
      }
      if (payload.kind === 'drivefile' || payload.drive) {
        var f = fileById(payload.id) || { id: payload.id, name: payload.name, url: payload.url, mime: payload.mime };
        if (pinned(f.id)) { toast(root, 'Already pinned'); return true; }
        setMark(root, 'pin', f.id, true, f);
        return true;
      }
      toast(root, 'Drag a Drive file here to pin it');
      return true;
    }
    if (zone === 'drive-space') {
      if (payload.kind !== 'drivefile' && payload.kind !== 'drivepin') { toast(root, 'Drag a Drive file onto a Space'); return true; }
      attachToSpace(root, attr(col, 'data-space'), fileById(payload.id) || { id: payload.id, name: payload.name, url: payload.url, mime: payload.mime });
      return true;
    }
    return false;
  }

  /* =========================== INTEGRATIONS =========================== */
  function I() {
    var s = S();
    if (!s.intg) s.intg = { services: null, lastSync: '', at: 0, err: '', open: '', more: false, busy: '', forms: {}, msg: {} };
    return s.intg;
  }
  function loadStatus(force) {
    var ig = I();
    if (fixtureOn()) return Promise.resolve();
    if (!force && ig.services && Date.now() - ig.at < 30000) return Promise.resolve();
    if (ig._loading) return ig._loading;
    ig._loading = call('/api/integrations/status').then(function (d) {
      ig.services = (d.services || []).filter(function (s) { return s.key !== 'granola' && s.key !== 'riverside'; });
      ig.lastSync = d.lastSync || '';
      ig.at = Date.now();
      ig.err = '';
      S().intServices = ig.services;
    }).catch(function (err) {
      ig.err = err && err.status === 403 ? 'Integrations are for the room owner only.' : 'Connection status could not load.';
    }).then(function () { ig._loading = null; paintIntegrations(); });
    return ig._loading;
  }
  function since(iso) {
    var ts = Date.parse(iso || '');
    if (!Number.isFinite(ts)) return '-';
    var m = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (m < 60) return m + ' min';
    var h = Math.round(m / 60);
    if (h < 48) return h + ' h';
    return Math.round(h / 24) + ' d';
  }
  function manageHtml(s) {
    var ig = I();
    var msg = ig.msg[s.key] ? '<div class="' + (ig.msg[s.key].ok ? 'okm' : 'er') + '">' + esc(ig.msg[s.key].text) + '</div>' : '';
    var busy = ig.busy === s.key;
    var rows = [];
    if (s.connect === 'google') {
      rows.push('<div>' + (s.source === 'saved' ? 'Google is connected through your sign-in here.' : s.source === 'env' ? 'Google is connected through a Vercel environment key. Disconnect it by removing that key in Vercel.' : 'Google is not connected yet.') + '</div>');
      rows.push('<div class="row">'
        + (s.canRefresh ? '<button class="btn" type="button" data-action="int-refresh" data-key="' + esc(s.key) + '"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Refreshing…' : 'Refresh now') + '</button>' : '')
        + '<button class="btn" type="button" data-action="int-google">' + (s.source === 'none' ? 'Connect Google' : 'Reconnect Google') + '</button>'
        + (s.canDisconnect ? '<button class="btn" type="button" data-action="int-disconnect" data-key="google">Disconnect Google</button>' : '')
        + '</div>');
    } else if (s.connect === 'ghl') {
      var fm = ig.forms.ghl || {};
      rows.push('<div>' + (s.source === 'saved' ? 'GoHighLevel uses the key saved here.' : s.source === 'env' ? 'GoHighLevel uses a Vercel environment key. Saving a key here overrides it.' : 'Paste a GoHighLevel private integration key and the location id.') + '</div>');
      rows.push('<div class="row"><input type="password" autocomplete="off" placeholder="Private integration key" data-action="int-ghl-key" data-ext-field value="' + esc(fm.key || '') + '"><input type="text" autocomplete="off" placeholder="Location id" data-action="int-ghl-loc" data-ext-field value="' + esc(fm.loc || '') + '"></div>');
      rows.push('<div class="row"><button class="btn pri" type="button" data-action="int-ghl-save"' + (busy ? ' disabled' : '') + '>Save key</button>'
        + (s.canRefresh ? '<button class="btn" type="button" data-action="int-refresh" data-key="ghl"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Refreshing…' : 'Refresh now') + '</button>' : '')
        + (s.canDisconnect ? '<button class="btn" type="button" data-action="int-disconnect" data-key="gohighlevel">Disconnect GoHighLevel</button>' : '') + '</div>');
    } else if (s.connect === 'database') {
      var db = ig.forms.db || {};
      rows.push('<div>' + esc(s.detail || '') + '. Paste a Postgres connection string to replace it.</div>');
      rows.push('<div class="row"><input type="password" autocomplete="off" placeholder="postgres://…" data-action="int-db-conn" data-ext-field value="' + esc(db.conn || '') + '"><button class="btn pri" type="button" data-action="int-db-save"' + (busy ? ' disabled' : '') + '>Save</button></div>');
    } else {
      /* Round 3: Granola and Riverside sync into Zoom notes; Perplexity answers Research in News and Spaces. */
      var HOW = {
        granola: '',
        riverside: '',
        perplexity: 'Create a key at perplexity.ai, Settings, API. Research in News and on a Space angle answers with numbered sources.'
      };
      var keyed = s.key === 'perplexity';
      rows.push('<div>' + (s.group !== 'available' ? 'The key is set in Vercel.' : 'Set <code>' + esc(s.envVar) + '</code> in Vercel (Project, Settings, Environment variables), then redeploy.')
        + (keyed && HOW[s.key] ? ' ' + esc(HOW[s.key]) : '') + '</div>');
      rows.push('<div class="row">'
        + (s.envVar ? '<button class="btn" type="button" data-action="int-copy-env" data-key="' + esc(s.key) + '">Copy variable name</button>' : '')
        + (s.key === 'zoom' && s.canRefresh ? '<button class="btn" type="button" data-action="int-refresh" data-key="' + esc(s.key) + '"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Refreshing…' : 'Refresh now') + '</button>' : '')
        + (s.key === 'perplexity' && s.group !== 'available' ? '<button class="btn" type="button" data-action="int-perplexity-test"' + (busy ? ' disabled' : '') + '>Test the key</button>' : '')
        + '<button class="btn" type="button" data-action="int-check" data-key="' + esc(s.key) + '">Check again</button></div>');
    }
    return '<div class="mg">' + rows.join('') + msg + '</div>';
  }
  function rowHtml(s) {
    var ig = I();
    var cls = s.group === 'connected' ? 'ok' : s.group === 'attention' ? 'wa' : 'no';
    var open = ig.open === s.key;
    var btn = s.group === 'connected'
      ? '<button class="btn" type="button" data-action="int-manage" data-key="' + esc(s.key) + '">' + (open ? 'Close' : 'Manage') + '</button>'
      : '<button class="btn' + (s.group === 'attention' ? ' pri' : '') + '" type="button" data-action="int-connect" data-key="' + esc(s.key) + '">' + (open ? 'Close' : 'Connect') + '</button>';
    var feeds = (s.feeds || []).length ? '<div class="feeds">' + s.feeds.map(function (f) { return '<span>' + esc(f) + '</span>'; }).join('') + '</div>' : '';
    var det = '';
    if (s.key === 'ghl' && (s.extra || []).length) {
      var list = ig.more ? s.extra : s.extra.slice(0, 7);
      det = '<div class="det">' + list.map(function (p) { return '<span>' + esc(p.label) + ' <b>' + esc(p.value) + '</b></span>'; }).join('')
        + (s.extra.length > 7 ? '<span data-action="int-more">' + (ig.more ? 'Show fewer' : '+ ' + (s.extra.length - 7) + ' more') + '</span>' : '') + '</div>';
    }
    return '<div class="it" data-action="' + (s.group === 'connected' ? 'int-manage' : 'int-connect') + '" data-key="' + esc(s.key) + '"><span class="lg" style="background:' + esc(s.color) + '">' + esc(s.letter) + '</span>'
      + '<div><h4>' + esc(s.name) + '</h4><p>' + esc(s.what) + '</p>' + feeds + '</div>'
      + '<div class="st"><b class="' + cls + '"><i></i>' + esc(s.word) + '</b>' + (s.detail ? '<small>' + esc(s.detail) + '</small>' : '') + '</div>'
      + btn + det
      + (s.why ? '<div class="why">' + esc(s.why) + '</div>' : '')
      + (open ? manageHtml(s) : '') + '</div>';
  }
  function integrationsHtml() {
    var ig = I();
    var list = fixtureOn() && fixtureData() ? fixtureData().services : (ig.services || []);
    var head = '<div class="bar"><h1>Integrations</h1><span class="sub">What\'s connected, what it feeds, and when it last synced</span></div>';
    if (!list.length) {
      return head + '<div class="ierr">' + esc(ig.err || 'Checking connections…') + (ig.err ? ' <span class="lnk" data-action="int-check" data-key="">Retry</span>' : '') + '</div>';
    }
    var groups = { connected: [], attention: [], available: [] };
    list.forEach(function (s) { (groups[s.group] || groups.available).push(s); });
    var last = fixtureOn() && fixtureData() ? fixtureData().since : since(ig.lastSync);
    var html = head + '<div class="sumr"><div class="sx g"><b>' + groups.connected.length + '</b><span>connected</span></div><div class="sx a"><b>' + groups.attention.length + '</b><span>needs attention</span></div><div class="sx"><b>' + groups.available.length + '</b><span>available</span></div><div class="sx"><b>' + esc(last) + '</b><span>since last sync</span></div></div>';
    if (ig.err) html += '<div class="ierr">' + esc(ig.err) + ' <span class="lnk" data-action="int-check" data-key="">Retry</span></div>';
    [['connected', 'Connected'], ['attention', 'Needs attention'], ['available', 'Available']].forEach(function (g) {
      if (!groups[g[0]].length) return;
      html += '<div class="grp">' + g[1] + '</div><div class="list">' + groups[g[0]].map(rowHtml).join('') + '</div>';
    });
    return html;
  }
  function paintIntegrations() {
    if (S().desk !== 'int') return;
    var go = function () {
      Promise.all([loadCss('neon'), loadCss('intNeon'), loadCss('int')]).then(function () {
        var root = mount('intDesk', 'int');
        if (!root) return;
        paintInto(root, integrationsHtml());
        var host = document.getElementById('intDesk');
        if (host) host.setAttribute('data-port-ready', '1');
      });
    };
    if (fixtureOn()) { whenFixture(go); return; }
    loadStatus(false);
    go();
  }
  function svc(key) { return ((I().services || []).filter(function (s) { return s.key === key; })[0]) || null; }
  function setMsg(key, ok, text) { I().msg[key] = { ok: ok, text: text }; }
  var intActions = {
    'int-manage': function (el) {
      var key = attr(el, 'data-key');
      var ig = I();
      ig.open = ig.open === key ? '' : key;
      delete ig.msg[key];
      paintIntegrations();
    },
    'int-connect': function (el) {
      var key = attr(el, 'data-key');
      var s = svc(key) || (fixtureOn() && fixtureData() ? fixtureData().services.filter(function (x) { return x.key === key; })[0] : null);
      if (s && s.connect === 'google' && s.source === 'none' && !fixtureOn()) { location.href = '/api/connect/google'; return; }
      var ig = I();
      ig.open = ig.open === key ? '' : key;
      paintIntegrations();
    },
    'int-google': function () { if (!fixtureOn()) location.href = '/api/connect/google'; },
    'int-more': function () { I().more = !I().more; paintIntegrations(); },
    'int-check': function (el, root) {
      var key = attr(el, 'data-key');
      if (fixtureOn()) { toast(root, 'Checked (fixture)'); return; }
      loadStatus(true).then(function () {
        var s = svc(key);
        if (s) setMsg(key, s.group === 'connected', s.group === 'connected' ? 'Connected.' : 'Still not connected.');
        paintIntegrations();
      });
    },
    'int-copy-env': function (el, root) {
      var s = svc(attr(el, 'data-key'));
      var name = (s && s.envVar) || '';
      if (!name) return;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(name).then(function () { toast(root, 'Copied ' + name); }, function () { toast(root, name); });
      else toast(root, name);
    },
    'int-refresh': function (el, root) {
      var key = attr(el, 'data-key');
      var ig = I();
      if (fixtureOn()) { toast(root, 'Refreshed (fixture)'); return; }
      ig.busy = key;
      paintIntegrations();
      var req = key === 'zoom'
        ? call('/api/zoom-notes', { method: 'POST', body: {} }).then(function () { return loadStatus(true); })
        : call('/api/integrations/status', { method: 'POST', body: { refresh: key } }).then(function (d) {
          ig.services = d.services || ig.services; ig.lastSync = d.lastSync || ig.lastSync; ig.at = Date.now();
        });
      req.then(function () {
        var s = svc(key);
        setMsg(key, !!(s && s.group === 'connected'), s && s.group === 'connected' ? 'Synced just now.' : 'Refreshed, but it is still not healthy: ' + ((s && s.word) || 'unknown'));
        if (typeof window.loadBoard === 'function') window.loadBoard();
      }).catch(function (err) {
        var b = err && err.body;
        if (b && b.services) { ig.services = b.services; ig.at = Date.now(); }
        setMsg(key, false, (err && err.message && !/^HTTP/.test(err.message)) ? err.message : 'Refresh failed. Try again.');
      }).then(function () { ig.busy = ''; paintIntegrations(); });
    },
    'int-disconnect': function (el, root) {
      var which = attr(el, 'data-key');
      var key = which === 'gohighlevel' ? 'ghl' : 'gmail';
      var label = which === 'gohighlevel' ? 'GoHighLevel' : 'Google (Gmail, Calendar and Drive)';
      if (fixtureOn()) { toast(root, 'Disconnected (fixture)'); return; }
      if (!window.confirm('Disconnect ' + label + '? Syncing stops until you connect again.')) return;
      var ig = I();
      ig.busy = key;
      paintIntegrations();
      call('/api/integrations/' + encodeURIComponent(which) + '/disconnect', { method: 'DELETE' }).then(function () {
        return loadStatus(true).then(function () {
          var s = svc(key);
          if (s && s.source === 'env') setMsg(key, false, 'Your saved access is removed, but a Vercel environment key still connects it.');
          else setMsg(key, true, 'Disconnected.');
          toast(root, label + ' disconnected');
        });
      }).catch(function (err) {
        setMsg(key, false, (err && err.message && !/^HTTP/.test(err.message)) ? err.message : 'Could not disconnect. Nothing changed.');
      }).then(function () { ig.busy = ''; paintIntegrations(); });
    },
    'int-ghl-key': function () {},
    'int-ghl-loc': function () {},
    'int-db-conn': function () {},
    'int-ghl-save': function (el, root) {
      var ig = I();
      var fm = ig.forms.ghl || {};
      var key = String(fm.key || '').trim();
      var loc = String(fm.loc || '').trim();
      if (key.length < 10 || !/^[A-Za-z0-9]{6,80}$/.test(loc)) { setMsg('ghl', false, 'Paste the full key and a location id (letters and numbers).'); paintIntegrations(); return; }
      if (fixtureOn()) { toast(root, 'Saved (fixture)'); return; }
      ig.busy = 'ghl';
      paintIntegrations();
      call('/api/connect/ghl', { method: 'POST', body: { key: key, location: loc } }).then(function () {
        ig.forms.ghl = {};
        return call('/api/integrations/status', { method: 'POST', body: { refresh: 'ghl' } }).then(function (d) {
          ig.services = d.services || ig.services; ig.at = Date.now();
          var s = svc('ghl');
          setMsg('ghl', !!(s && s.group === 'connected'), s && s.group === 'connected' ? 'Saved. GoHighLevel answered.' : 'Saved, but GoHighLevel did not answer. Check the key and location.');
        }).catch(function () { setMsg('ghl', false, 'Saved, but GoHighLevel did not answer. Check the key and location.'); return loadStatus(true); });
      }).catch(function (err) {
        setMsg('ghl', false, err && err.status === 400 ? 'That key or location id was refused.' : 'Could not save the key. Try again.');
      }).then(function () { ig.busy = ''; paintIntegrations(); });
    },
    'int-db-save': function (el, root) {
      var ig = I();
      var v = String((ig.forms.db || {}).conn || '').trim();
      if (!v) { setMsg('database', false, 'Paste a connection string first.'); paintIntegrations(); return; }
      if (fixtureOn()) { toast(root, 'Saved (fixture)'); return; }
      ig.busy = 'database';
      paintIntegrations();
      call('/api/connect/database', { method: 'POST', body: { connection: v } }).then(function () {
        ig.forms.db = {};
        setMsg('database', true, 'Saved.');
        if (typeof window.loadBoard === 'function') window.loadBoard();
        return loadStatus(true);
      }).catch(function () { setMsg('database', false, 'That connection was refused. Nothing changed.'); })
        .then(function () { ig.busy = ''; paintIntegrations(); });
    }
  };

  /* ============================== wiring ============================== */
  function register() {
    if (!window.deskActions) return false;
    Object.assign(window.deskActions, driveActions, intActions);
    window.__deskInputExt = window.__deskInputExt || {};
    window.__deskKeyExt = window.__deskKeyExt || {};
    window.__deskRefreshExt = window.__deskRefreshExt || {};
    var searchTimer = 0;
    window.__deskInputExt['drive-search'] = function (el) {
      D().q = String(el.value || '');
      D().all = false;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(paintDrive, 140);
    };
    window.__deskInputExt['drive-ask-input'] = function (el) { if (D().ask) { D().ask.value = String(el.value || ''); D().ask.err = ''; } };
    window.__deskInputExt['drive-ask-q'] = function (el) { if (D().ask) { D().ask.q = String(el.value || ''); paintDrive(); } };
    window.__deskInputExt['int-ghl-key'] = function (el) { var f = I().forms.ghl = I().forms.ghl || {}; f.key = String(el.value || ''); };
    window.__deskInputExt['int-ghl-loc'] = function (el) { var f = I().forms.ghl = I().forms.ghl || {}; f.loc = String(el.value || ''); };
    window.__deskInputExt['int-db-conn'] = function (el) { var f = I().forms.db = I().forms.db || {}; f.conn = String(el.value || ''); };
    function askKey(el, root, e) {
      if (e.key === 'Escape') { e.preventDefault(); closeAsk(); return true; }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (attr(el, 'data-action') === 'drive-ask-input') driveActions['drive-ask-ok'](el, root);
        else { var first = root.querySelector('[data-action="drive-ask-pick"]'); if (first) driveActions['drive-ask-pick'](first, root); }
        return true;
      }
      return false;
    }
    window.__deskKeyExt['drive-ask-input'] = askKey;
    window.__deskKeyExt['drive-ask-q'] = askKey;
    window.__deskKeyExt['drive-search'] = function (el, root, e) {
      if (e.key === 'Escape' && el.value) { el.value = ''; D().q = ''; paintDrive(); return true; }
      return false;
    };
    window.__deskKeyExt['int-ghl-loc'] = function (el, root, e) { if (e.key !== 'Enter') return false; e.preventDefault(); intActions['int-ghl-save'](el, root); return true; };
    window.__deskKeyExt['int-db-conn'] = function (el, root, e) { if (e.key !== 'Enter') return false; e.preventDefault(); intActions['int-db-save'](el, root); return true; };
    var priorDrop = window.__deskDropExt;
    window.__deskDropExt = function (col, payload, root, e) {
      if (onDriveDrop(col, payload, root)) return true;
      return typeof priorDrop === 'function' ? priorDrop(col, payload, root, e) : false;
    };
    window.__deskRefreshExt.drive = function () { if (S().desk === 'drive') { loadMarks(true); paintDrive(); } };
    window.__deskRefreshExt.int = function () { if (S().desk === 'int') loadStatus(true); };
    return true;
  }
  if (!register()) {
    var tries = 0;
    var timer = setInterval(function () { tries += 1; if (register() || tries > 40) clearInterval(timer); }, 50);
  }
  window.paintRedesignDrive = function () {
    try { var m = localStorage.getItem('cr_doc_mode'); if (m === 'grid' || m === 'list') D().mode = m; } catch (e) {}
    paintDrive();
  };
  window.paintRedesignIntegrations = function () { paintIntegrations(); };
  window.__pagesD = { driveHtml: driveHtml, integrationsHtml: integrationsHtml, drive: D, intg: I };
})();
