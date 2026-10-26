/* Notes canvas (03c), Spaces arrange (05d), Signals detail (02e). Port of the design files. */
(function () {
  function P() { return window.__port || {}; }
  function fixtureOn() { return P().fixtureOn ? P().fixtureOn() : !!window.fixtureMockup; }
  function wrapOf(id) { return P().wrapOf ? P().wrapOf(id) : null; }
  function whenCss(fn) { if (P().whenCss) P().whenCss(fn); else fn(); }
  function markReady(id) { if (P().markReady) P().markReady(id); }
  function esc(s) { return P().esc ? P().esc(s) : String(s == null ? '' : s); }
  function qFlag(name) {
    try { return new URLSearchParams(location.search || '').get(name) === '1'; } catch (e) { return false; }
  }
  function qParam(name) {
    try { return new URLSearchParams(location.search || '').get(name) || ''; } catch (e) { return ''; }
  }
  function writeOk() { return !fixtureOn(); }
  function api(url, opts) {
    opts = opts || {};
    var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
    return fn(url, Object.assign({ credentials: 'same-origin', headers: { 'content-type': 'application/json' } }, opts, {
      body: opts.body != null ? JSON.stringify(opts.body) : opts.body
    }));
  }
  function toast(root, t) {
    var e = root.getElementById ? root.getElementById('toast') : root.querySelector('#toast');
    if (!e) return;
    e.textContent = t;
    e.classList.add('show');
    clearTimeout(e._t);
    e._t = setTimeout(function () { e.classList.remove('show'); }, 1700);
  }
  function TY() { return { todo: 'To do', idea: 'Idea', person: 'Person', dec: 'Decision', note: 'Note' }; }

  function canvasSample() {
    var F = window.REDESIGN_FIXTURE || {};
    return F.notesCanvas || {
      clusters: [
        { id: 'raise', name: 'Raise - pre-seed', color: '#2e6bf2', x: 120, y: 120, w: 760, h: 520 },
        { id: 'dp', name: 'Design partners', color: '#12a36a', x: 960, y: 120, w: 760, h: 520 },
        { id: 'reg', name: 'Regulators', color: '#6b4fd8', x: 120, y: 740, w: 520, h: 420 },
        { id: 'prod', name: 'Product ideas', color: '#c98408', x: 720, y: 740, w: 1000, h: 420 }
      ],
      notes: [
        { c: 'raise', x: 150, y: 160, k: 'b', t: 'todo', h: 'Kevin - wire the $25K', p: 'He said Thursday. Send the subscription docs today.' },
        { c: 'raise', x: 400, y: 160, k: 'y', t: 'idea', h: 'Second close date', p: 'Hold Nov 6 as the soft close; tell Mike the same.' },
        { c: 'raise', x: 150, y: 340, k: 'g', t: 'person', h: 'Mench Capital', p: 'Questions on capture rate. Send the one-pager with the base case.' },
        { c: 'raise', x: 400, y: 340, k: 'w', t: 'note', h: '$170K to go', p: '11 days. Three warm, two cold.' },
        { c: 'dp', x: 990, y: 160, k: 'g', t: 'person', h: 'Bow Valley CU', p: 'Wants the compliance requirements before Thursday 10:00.' },
        { c: 'dp', x: 1240, y: 160, k: 'b', t: 'todo', h: 'Enrich - discovery call', p: 'Book 30 min. Bring the suitability record demo.' },
        { c: 'dp', x: 990, y: 340, k: 'o', t: 'idea', h: 'Credit union pack', p: 'One page for CU boards: what changes, what it costs.' },
        { c: 'reg', x: 150, y: 780, k: 'v', t: 'dec', h: 'BCFSA intro', p: 'Lead with conduct risk, not technology.' },
        { c: 'reg', x: 400, y: 780, k: 'p', t: 'todo', h: 'FINTRAC fines note', p: 'Pull the four credit union cases for the deck.' },
        { c: 'prod', x: 750, y: 780, k: 'y', t: 'idea', h: 'Voice log to tasks', p: 'Every voice note becomes a War Room task with a due date.' },
        { c: 'prod', x: 1000, y: 780, k: 'w', t: 'note', h: 'Advisor read-back', p: 'Read the advice back to the client in plain words.' },
        { c: 'prod', x: 1250, y: 780, k: 'b', t: 'todo', h: 'Readiness check link', p: 'Add the free check to every Space bundle.' },
        { c: null, x: 1840, y: 200, k: 'y', t: 'note', h: 'Unfiled - Thanksgiving list', p: 'Drag me into a cluster.' }
      ]
    };
  }

  function liveCanvasData() {
    var S = window.STATE || {};
    var clusters = (S.noteClusters || []).map(function (c) {
      return { id: c.id, name: c.name, color: c.color || '#2e6bf2', x: Number(c.x) || 120, y: Number(c.y) || 120, w: Number(c.w) || 500, h: Number(c.h) || 300 };
    });
    var notes = [];
    var auto = 0;
    function titleOf(n) {
      var meta = n.meta || {};
      var t = String(n.title || meta.title || '').trim();
      if (!t || /^note$/i.test(t) || /^untitled/i.test(t)) {
        t = String(n.body || '').replace(/^\s+/, '').split(/\n/)[0].trim();
      }
      return t;
    }
    function savedPos(n) {
      var x = n.canvas_x != null ? Number(n.canvas_x) : (n.x != null ? Number(n.x) : NaN);
      var y = n.canvas_y != null ? Number(n.canvas_y) : (n.y != null ? Number(n.y) : NaN);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      if (x === 0 && y === 0) return null;
      return { x: x, y: y };
    }
    function push(n, src) {
      var pos = savedPos(n);
      var x, y;
      if (pos) { x = pos.x; y = pos.y; }
      else {
        x = 150 + (auto % 4) * 264;
        y = 160 + Math.floor(auto / 4) * 204;
        auto += 1;
      }
      var meta = n.meta || {};
      var t = meta.kind || 'note';
      if (t === 'decision') t = 'dec';
      var row = {
        id: n.id, c: n.cluster_id || meta.cluster || null, x: x, y: y,
        k: ({ yellow: 'y', pink: 'p', green: 'g', blue: 'b', orange: 'o', violet: 'v', white: 'w' }[n.color] || n.color || 'y'),
        t: t, h: titleOf(n), p: n.body || '', src: src, laid: !pos,
        w: Math.max(160, Math.min(900, Number(n.canvas_w || n.w) || 240)),
        hh: Math.max(100, Math.min(900, Number(n.canvas_h || n.hh) || 180)),
        updated: n.updated_at || n.updatedAt || n.created_at || ''
      };
      notes.push(row);
    }
    var seen = {};
    function addAll(arr, src) {
      (arr || []).slice().sort(function (a, b) {
        return String(b.updated_at || b.updatedAt || b.created_at || '').localeCompare(String(a.updated_at || a.updatedAt || a.created_at || ''));
      }).forEach(function (n) {
        if (!n || !n.id || seen[n.id]) return;
        seen[n.id] = 1;
        push(n, src);
      });
    }
    addAll(S.notes, 'board');
    addAll(S.boardNotes, 'board');
    addAll(S.stickies, 'sticky');
    var pile = {};
    notes.forEach(function (n) {
      var k = n.x + ',' + n.y;
      pile[k] = (pile[k] || 0) + 1;
    });
    notes.forEach(function (n) {
      if ((pile[n.x + ',' + n.y] || 0) < 2) return;
      n.x = 150 + (auto % 4) * 264;
      n.y = 160 + Math.floor(auto / 4) * 204;
      auto += 1;
    });
    return { clusters: clusters, notes: notes };
  }

  function saveNotePos(n) {
    if (!writeOk() || !n.id) return;
    api('/api/notes/' + encodeURIComponent(n.id), { method: 'PATCH', body: { canvas_x: n.x, canvas_y: n.y, x: n.x, y: n.y, w: n.w, h: n.hh, canvas_w: n.w, canvas_h: n.hh, cluster_id: n.c || null } }).catch(function () {});
  }
  function saveCluster(c) {
    if (!writeOk() || !c.id || String(c.id).length < 30) return;
    api('/api/notes/clusters', { method: 'PATCH', body: { id: c.id, name: c.name, x: c.x, y: c.y, w: c.w, h: c.h, color: c.color } }).catch(function () {});
  }

  function paintNotesCanvasPage() {
    var wrap = wrapOf('notesDesk');
    if (!wrap) return;
    if (P().applyPageCss) P().applyPageCss(wrap, 'notesCanvas');
    var data = fixtureOn() ? canvasSample() : liveCanvasData();
    var CL = data.clusters.slice();
    var NOTES = data.notes.slice();
    wrap.innerHTML =
      '<div class="bar"><h1>Notes</h1><span class="sub">Lay notes out on a grid, group them into named clusters</span>'
      + '<div class="r"><div class="seg"><span data-action="notes-view" data-view="board">Board</span><span class="on" data-action="notes-view" data-view="canvas">Canvas</span></div>'
      + '<button class="btn" data-action="canvas-add-cluster">+ Cluster</button><button class="btn pri" data-action="canvas-add-note">+ Note</button></div></div>'
      + '<div class="tools"><input class="search" id="q" data-action="canvas-search" placeholder="Search notes - the canvas flies to the match">'
      + '<div class="zoom"><button type="button" data-action="canvas-zoom-out" aria-label="Zoom out">&minus;</button><b id="zLbl">100%</b><button type="button" data-action="canvas-zoom-in" aria-label="Zoom in">+</button></div>'
      + '<button class="btn" data-action="canvas-fit">Fit all</button>'
      + '<span class="hint">Drag empty space to pan &middot; pinch or ' + String.fromCharCode(8984) + ' scroll to zoom &middot; Shift-drag to select</span></div>'
      + '<div class="stage" id="stage" data-action="canvas-stage">'
      + '<div class="world" id="world"></div><div class="marq" id="marq"></div>'
      + '<div class="selbar" id="selbar"><b id="selN">3 selected</b><button class="btn pri" data-action="canvas-mk-cluster">Make a cluster</button><button class="btn" data-action="canvas-sel-clear">Clear</button></div>'
      + '<div class="mklbl">Double-click a cluster name to rename it &middot; drag a note into a cluster to file it</div>'
      + '<div class="mini" id="mini" data-action="canvas-mini"></div></div>'
      + '<div class="toast" id="toast"></div>';
    if (P().finishPaint) P().finishPaint(wrap);
    bindCanvas(wrap, CL, NOTES);
    if (fixtureOn()) setTimeout(function () { markReady('notesDesk'); }, 220);
    else markReady('notesDesk');
  }

  function bindCanvas(root, CL, NOTES) {
    var world = root.getElementById ? root.getElementById('world') : root.querySelector('#world');
    var stage = root.getElementById ? root.getElementById('stage') : root.querySelector('#stage');
    if (!world || !stage) return;
    var z = 1, ox = -60, oy = -40, drag = null, sel = new Set();
    var types = TY();
    function apply() {
      world.style.transform = 'translate(' + ox + 'px,' + oy + 'px) scale(' + z + ')';
      world.classList.toggle('far', z < 0.55);
      var zl = root.getElementById ? root.getElementById('zLbl') : root.querySelector('#zLbl');
      if (zl) zl.textContent = (Number.isFinite(z) ? Math.round(z * 100) : 100) + '%';
      mini();
    }
    function render() {
      grow();
      world.innerHTML = CL.map(function (c) {
        return '<div class="cluster" data-id="' + esc(c.id) + '" data-action="canvas-cluster" style="left:' + c.x + 'px;top:' + c.y + 'px;width:' + c.w + 'px;height:' + c.h + 'px;border-color:' + esc(c.color) + '"><div class="cn" data-action="canvas-cluster-name" style="background:' + esc(c.color) + '">' + esc(c.name) + ' <i>' + NOTES.filter(function (n) { return n.c == c.id; }).length + '</i></div><span class="rz" data-action="canvas-rz"></span></div>';
      }).join('') + NOTES.map(function (n, i) {
        var nw = n.w || 240, nh = n.hh || 180;
        return '<div class="note ' + esc(n.k) + '" data-i="' + i + '" data-action="canvas-note" style="left:' + n.x + 'px;top:' + n.y + 'px;width:' + nw + 'px;height:' + nh + 'px"><span class="ty ' + esc(n.t) + '">' + esc(types[n.t] || 'Note') + '</span><h4>' + esc(n.h) + '</h4><p>' + esc(n.p) + '</p><span class="sz">' + nw + ' x ' + nh + '</span><span class="nrz" data-action="canvas-note-rz"></span></div>';
      }).join('');
      apply();
    }
    function toWorld(cx, cy) {
      var r = stage.getBoundingClientRect();
      return [(cx - r.left - ox) / z, (cy - r.top - oy) / z];
    }
    function zoomAt(f, cx, cy) {
      var r = stage.getBoundingClientRect();
      cx = cx != null ? cx : r.left + r.width / 2;
      cy = cy != null ? cy : r.top + r.height / 2;
      var w = toWorld(cx, cy);
      z = Math.min(2, Math.max(0.15, z * f));
      ox = cx - r.left - w[0] * z;
      oy = cy - r.top - w[1] * z;
      apply();
    }
    function grow() {
      if (fixtureOn()) {
        world.style.width = '6000px';
        world.style.height = '4000px';
        return;
      }
      var maxX = 2400, maxY = 1600;
      NOTES.forEach(function (n) {
        maxX = Math.max(maxX, (n.x || 0) + (n.w || 240) + 480);
        maxY = Math.max(maxY, (n.y || 0) + (n.hh || 180) + 480);
      });
      CL.forEach(function (c) {
        maxX = Math.max(maxX, c.x + c.w + 480);
        maxY = Math.max(maxY, c.y + c.h + 480);
      });
      world.style.width = maxX + 'px';
      world.style.height = maxY + 'px';
    }
    function centerLatest() {
      var latest = NOTES.slice().sort(function (a, b) { return String(b.updated || '').localeCompare(String(a.updated || '')); })[0];
      var r = stage.getBoundingClientRect();
      z = 1;
      var nx = latest ? latest.x + (latest.w || 240) / 2 : 400;
      var ny = latest ? latest.y + (latest.h || 180) / 2 : 300;
      ox = r.width / 2 - nx * z;
      oy = r.height / 2 - ny * z;
      apply();
    }
    function fit() {
      if (!CL.length && !NOTES.length) return;
      var xs = CL.map(function (c) { return [c.x, c.x + c.w]; }).concat(NOTES.map(function (n) { return [n.x, n.x + 220]; })).flat();
      var ys = CL.map(function (c) { return [c.y, c.y + c.h]; }).concat(NOTES.map(function (n) { return [n.y, n.y + 150]; })).flat();
      var x0 = Math.min.apply(null, xs) - 60, x1 = Math.max.apply(null, xs) + 60;
      var y0 = Math.min.apply(null, ys) - 80, y1 = Math.max.apply(null, ys) + 60;
      var r = stage.getBoundingClientRect();
      var rw = r.width > 40 ? r.width : 1168;
      var rh = r.height > 40 ? r.height : 620;
      z = Math.min(rw / (x1 - x0), rh / (y1 - y0));
      if (!Number.isFinite(z) || z <= 0) z = 0.57;
      ox = -x0 * z + (rw - (x1 - x0) * z) / 2;
      oy = -y0 * z + (rh - (y1 - y0) * z) / 2;
      apply();
    }
    function clusterAt(x, y) {
      return CL.slice().reverse().find(function (c) { return x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h; });
    }
    function markSel() {
      world.querySelectorAll('.note').forEach(function (n) { n.classList.toggle('sel', sel.has(+n.dataset.i)); });
      var sb = root.getElementById ? root.getElementById('selbar') : root.querySelector('#selbar');
      var sn = root.getElementById ? root.getElementById('selN') : root.querySelector('#selN');
      if (sb) sb.classList.toggle('on', sel.size > 1);
      if (sn) sn.textContent = sel.size + ' selected';
    }
    function mini() {
      var m = root.getElementById ? root.getElementById('mini') : root.querySelector('#mini');
      if (!m) return;
      var s = 180 / 2200;
      var h = CL.map(function (c) {
        return '<i style="left:' + (c.x * s) + 'px;top:' + (c.y * s) + 'px;width:' + (c.w * s) + 'px;height:' + (c.h * s) + 'px;background:' + esc(c.color) + '"></i>';
      }).join('');
      h += NOTES.map(function (n) {
        return '<i style="left:' + (n.x * s) + 'px;top:' + (n.y * s) + 'px;width:8px;height:6px;background:#fff;opacity:.9"></i>';
      }).join('');
      var r = stage.getBoundingClientRect();
      h += '<span class="vp" style="left:' + ((-ox / z) * s) + 'px;top:' + ((-oy / z) * s) + 'px;width:' + ((r.width / z) * s) + 'px;height:' + ((r.height / z) * s) + 'px"></span>';
      m.innerHTML = h;
    }
    function rename(id) {
      var cn = world.querySelector('.cluster[data-id="' + id + '"] .cn');
      var c = CL.find(function (x) { return String(x.id) === String(id); });
      if (!cn || !c) return;
      cn.textContent = c.name;
      cn.contentEditable = true;
      cn.focus();
      try { document.getSelection().selectAllChildren(cn); } catch (e) {}
      var done = function () {
        cn.contentEditable = false;
        c.name = (cn.textContent || '').trim() || 'Untitled cluster';
        render();
        markSel();
        saveCluster(c);
        toast(root, 'Cluster name saved');
      };
      cn.addEventListener('blur', done, { once: true });
      cn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); cn.blur(); } });
    }
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX, e.clientY);
      else { ox -= e.deltaX; oy -= e.deltaY; apply(); }
    }, { passive: false });
    stage.addEventListener('pointerdown', function (e) {
      var note = e.target.closest('.note'), cn = e.target.closest('.cn'), rz = e.target.closest('.rz');
      if (cn && cn.isContentEditable) return;
      var w = toWorld(e.clientX, e.clientY), wx = w[0], wy = w[1];
      if (rz && rz.getAttribute('data-action') === 'canvas-note-rz' && note) {
        var ni = +note.dataset.i;
        drag = { type: 'n-rz', i: ni, sx: wx, sy: wy, w: NOTES[ni].w || 240, h: NOTES[ni].hh || 180 };
        var rzEl = world.querySelector('.note[data-i="' + ni + '"]');
        if (rzEl) rzEl.classList.add('rs');
      } else if (rz) {
        var c = CL.find(function (x) { return String(x.id) === String(rz.parentNode.dataset.id); });
        drag = { type: 'rz', c: c, sx: wx, sy: wy, w: c.w, h: c.h };
      } else if (note) {
        var i = +note.dataset.i;
        if (!sel.has(i)) { if (!e.shiftKey) sel.clear(); sel.add(i); }
        drag = { type: 'note', sx: wx, sy: wy, start: Array.from(sel).map(function (j) { return [j, NOTES[j].x, NOTES[j].y]; }) };
        markSel();
      } else if (cn) {
        var cl = CL.find(function (x) { return String(x.id) === String(cn.parentNode.dataset.id); });
        drag = { type: 'cl', c: cl, sx: wx, sy: wy, x: cl.x, y: cl.y, inner: NOTES.map(function (n, idx) { return [idx, n.x, n.y]; }).filter(function (p) { return NOTES[p[0]].c == cl.id; }) };
      } else if (e.shiftKey) drag = { type: 'marq', sx: e.clientX, sy: e.clientY };
      else { drag = { type: 'pan', sx: e.clientX, sy: e.clientY, ox: ox, oy: oy }; stage.classList.add('pan'); sel.clear(); markSel(); }
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    });
    stage.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var w = toWorld(e.clientX, e.clientY), wx = w[0], wy = w[1];
      if (drag.type === 'pan') { ox = drag.ox + e.clientX - drag.sx; oy = drag.oy + e.clientY - drag.sy; apply(); return; }
      if (drag.type === 'marq') {
        var m = root.getElementById ? root.getElementById('marq') : root.querySelector('#marq');
        var r = stage.getBoundingClientRect();
        var x = Math.min(drag.sx, e.clientX) - r.left, y = Math.min(drag.sy, e.clientY) - r.top;
        Object.assign(m.style, { display: 'block', left: x + 'px', top: y + 'px', width: Math.abs(e.clientX - drag.sx) + 'px', height: Math.abs(e.clientY - drag.sy) + 'px' });
        drag.ex = e.clientX; drag.ey = e.clientY;
        return;
      }
      var dx = wx - drag.sx, dy = wy - drag.sy;
      if (drag.type === 'note') {
        drag.start.forEach(function (p) {
          var i = p[0]; NOTES[i].x = p[1] + dx; NOTES[i].y = p[2] + dy;
          var el = world.querySelector('.note[data-i="' + i + '"]');
          if (el) { el.style.left = NOTES[i].x + 'px'; el.style.top = NOTES[i].y + 'px'; }
        });
        var hit = clusterAt(wx, wy);
        world.querySelectorAll('.cluster').forEach(function (c) { c.classList.toggle('drop', !!(hit && c.dataset.id == hit.id)); });
      }
      if (drag.type === 'cl') {
        drag.c.x = drag.x + dx; drag.c.y = drag.y + dy;
        drag.inner.forEach(function (p) { NOTES[p[0]].x = p[1] + dx; NOTES[p[0]].y = p[2] + dy; });
        render(); markSel();
      }
      if (drag.type === 'rz') { drag.c.w = Math.max(260, drag.w + dx); drag.c.h = Math.max(200, drag.h + dy); render(); }
      if (drag.type === 'n-rz') {
        NOTES[drag.i].w = Math.max(160, Math.min(900, drag.w + dx));
        NOTES[drag.i].hh = Math.max(100, Math.min(900, drag.h + dy));
        var nel = world.querySelector('.note[data-i="' + drag.i + '"]');
        if (nel) {
          nel.style.width = NOTES[drag.i].w + 'px';
          nel.style.height = NOTES[drag.i].hh + 'px';
          var sz = nel.querySelector('.sz');
          if (sz) sz.textContent = Math.round(NOTES[drag.i].w) + ' x ' + Math.round(NOTES[drag.i].hh);
        }
      }
    });
    stage.addEventListener('pointerup', function (e) {
      if (!drag) return;
      stage.classList.remove('pan');
      if (drag.type === 'note') {
        var w = toWorld(e.clientX, e.clientY);
        var hit = clusterAt(w[0], w[1]);
        var moved = 0;
        drag.start.forEach(function (p) {
          var i = p[0], nc = hit ? hit.id : null;
          if (NOTES[i].c !== nc) { NOTES[i].c = nc; moved += 1; }
          saveNotePos(NOTES[i]);
        });
        render(); markSel();
        toast(root, moved ? (hit ? 'Filed in ' + hit.name : 'Taken out of the cluster') : 'Position saved');
      }
      if (drag.type === 'cl') { saveCluster(drag.c); drag.inner.forEach(function (p) { saveNotePos(NOTES[p[0]]); }); toast(root, drag.c.name + ' moved with its ' + drag.inner.length + ' notes'); }
      if (drag.type === 'rz') { saveCluster(drag.c); toast(root, 'Cluster resized'); }
      if (drag.type === 'n-rz') {
        var doneEl = world.querySelector('.note[data-i="' + drag.i + '"]');
        if (doneEl) doneEl.classList.remove('rs');
        saveNotePos(NOTES[drag.i]); grow(); toast(root, 'Note resized');
      }
      if (drag.type === 'marq' && drag.ex) {
        var a = toWorld(drag.sx, drag.sy), c = toWorld(drag.ex, drag.ey);
        var x0 = Math.min(a[0], c[0]), x1 = Math.max(a[0], c[0]), y0 = Math.min(a[1], c[1]), y1 = Math.max(a[1], c[1]);
        sel = new Set(NOTES.map(function (n, i) { return i; }).filter(function (i) { return NOTES[i].x < x1 && NOTES[i].x + 220 > x0 && NOTES[i].y < y1 && NOTES[i].y + 120 > y0; }));
        markSel();
      }
      var mq = root.getElementById ? root.getElementById('marq') : root.querySelector('#marq');
      if (mq) mq.style.display = 'none';
      drag = null;
    });
    world.addEventListener('dblclick', function (e) {
      var cn = e.target.closest('.cn');
      if (cn) rename(cn.parentNode.dataset.id);
    });
    root.addEventListener('click', function (e) {
      var act = e.target.closest('[data-action]');
      if (!act) return;
      var a = act.getAttribute('data-action');
      if (a === 'canvas-zoom-in') zoomAt(1.25);
      if (a === 'canvas-zoom-out') zoomAt(0.8);
      if (a === 'canvas-fit') fit();
      if (a === 'canvas-sel-clear') { sel.clear(); markSel(); }
      if (a === 'canvas-mk-cluster') {
        var ids = Array.from(sel), xs = ids.map(function (i) { return NOTES[i].x; }), ys = ids.map(function (i) { return NOTES[i].y; });
        var c = { id: 'c' + Date.now(), name: 'New cluster', color: '#e0364f', x: Math.min.apply(null, xs) - 30, y: Math.min.apply(null, ys) - 40, w: Math.max.apply(null, xs) - Math.min.apply(null, xs) + 280, h: Math.max.apply(null, ys) - Math.min.apply(null, ys) + 210 };
        if (writeOk()) {
          api('/api/notes/clusters', { method: 'POST', body: c }).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (row) {
            if (row && row.id) c.id = row.id;
            CL.push(c); ids.forEach(function (i) { NOTES[i].c = c.id; saveNotePos(NOTES[i]); });
            sel.clear(); render(); markSel(); rename(c.id);
          }).catch(function () { CL.push(c); ids.forEach(function (i) { NOTES[i].c = c.id; }); sel.clear(); render(); markSel(); rename(c.id); });
        } else { CL.push(c); ids.forEach(function (i) { NOTES[i].c = c.id; }); sel.clear(); render(); markSel(); rename(c.id); }
      }
      if (a === 'canvas-add-cluster') {
        var r = stage.getBoundingClientRect();
        var w = toWorld(r.left + r.width / 2, r.top + r.height / 2);
        var c2 = { id: 'c' + Date.now(), name: 'New cluster', color: '#0f8a8a', x: w[0] - 250, y: w[1] - 150, w: 500, h: 300 };
        function addC(row) { if (row && row.id) c2.id = row.id; CL.push(c2); render(); rename(c2.id); }
        if (writeOk()) api('/api/notes/clusters', { method: 'POST', body: c2 }).then(function (res) { return res && res.ok ? res.json() : null; }).then(addC).catch(function () { addC(null); });
        else addC(null);
      }
      if (a === 'canvas-add-note') {
        var r2 = stage.getBoundingClientRect();
        var w2 = toWorld(r2.left + r2.width / 2, r2.top + r2.height / 2);
        var hit = clusterAt(w2[0], w2[1]);
        var n = { c: hit ? hit.id : null, x: w2[0] - 120, y: w2[1] - 90, w: 240, hh: 180, k: 'y', t: 'note', h: 'New note', p: 'Type here. Saves as you type.' };
        NOTES.push(n); render();
        toast(root, hit ? 'New note in ' + hit.name : 'New note on the canvas');
        if (writeOk()) {
          api('/api/notes/sticky', { method: 'POST', body: { body: n.p, color: 'yellow', x: n.x, y: n.y, meta: { title: n.h, kind: 'note' } } })
            .then(function (res) { return res && res.ok ? res.json() : null; })
            .then(function (row) { if (row && row.id) { n.id = row.id; saveNotePos(n); } });
        }
      }
      if (a === 'canvas-mini') {
        var box = act.getBoundingClientRect(), s = 180 / 2200, sr = stage.getBoundingClientRect();
        ox = sr.width / 2 - ((e.clientX - box.left) / s) * z;
        oy = sr.height / 2 - ((e.clientY - box.top) / s) * z;
        apply();
      }
    });
    var q = root.getElementById ? root.getElementById('q') : root.querySelector('#q');
    if (q) q.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var qq = String(e.target.value || '').toLowerCase();
      var i = NOTES.findIndex(function (n) { return (n.h + ' ' + n.p).toLowerCase().indexOf(qq) >= 0; });
      if (i < 0) { toast(root, 'No note matches'); return; }
      var r = stage.getBoundingClientRect();
      z = 1.1; ox = r.width / 2 - (NOTES[i].x + 110) * z; oy = r.height / 2 - (NOTES[i].y + 60) * z;
      sel = new Set([i]); apply(); markSel();
    });
    render();
    if (fixtureOn()) {
      fit();
      requestAnimationFrame(function () { requestAnimationFrame(function () { fit(); }); });
    } else centerLatest();
  }

  /* ---------- Spaces arrange ---------- */
  function arrangeSample() {
    return (window.REDESIGN_FIXTURE && window.REDESIGN_FIXTURE.spacesArrange) || [
      { id: 'gen', name: 'General', min: false, sp: [['Regulator intro', 2, 'Add docs'], ['Friends & Family email', 2, 'Add docs'], ['Design partners', 2, 'Add docs']] },
      { id: 'vc', name: 'Venture Capital', min: false, sp: [['Joe Canavan', 4, 'Send today'], ['Neil Mitchell', 4, 'Add docs'], ['Norm Cappell', 3, 'Write intro'], ['Mench Capital', 5, 'Ready to send']] },
      { id: 'biz', name: 'Business', min: false, sp: [['Bow Valley Credit Union', 3, 'Attach the 2-pager'], ['Enrich Mortgage Group', 2, 'Book discovery'], ['Remax desk', 1, 'Add person']] },
      { id: 'reg', name: 'Regulators', min: false, sp: [['BCFSA', 2, 'Write intro'], ['FINTRAC note', 1, 'Add docs']] }
    ];
  }
  function liveArrange() {
    var S0 = window.STATE || {};
    var spaces = (S0.packages && S0.packages.length ? S0.packages : (S0.spaces || [])).slice();
    spaces.sort(function (a, b) { return (Number(a.position) || 0) - (Number(b.position) || 0); });
    var by = {};
    spaces.forEach(function (s) {
      var cat = s.category || s.spaceCategory || 'General';
      if (!by[cat]) by[cat] = { id: cat, name: cat, min: false, sp: [] };
      by[cat].sp.push([s.name, Number(s.readyScore || s.score || 2), s.status === 'sent' ? 'Sent' : 'Open', s.id]);
    });
    var order = ((S0.spaceGroups) || []).map(function (g) { return g.name || g; });
    var names = order.filter(function (n) { return by[n]; });
    Object.keys(by).forEach(function (n) { if (names.indexOf(n) < 0) names.push(n); });
    if (!names.length) return arrangeSample();
    return names.map(function (n) { return by[n]; });
  }

  window.paintSpacesArrangePage = paintSpacesArrangePage;
  function paintSpacesArrangePage() {
    var wrap = wrapOf('spacesDesk');
    if (!wrap) return;
    if (P().applyPageCss) P().applyPageCss(wrap, 'spacesArrange');
    var CATS = (fixtureOn() ? arrangeSample() : liveArrange()).map(function (c) { return Object.assign({}, c, { sp: c.sp.slice() }); });
    wrap.innerHTML =
      '<div class="bar"><h1>Spaces</h1><span class="sub">Every send-bundle, grouped by who it\'s for</span>'
      + '<div class="r"><div class="seg" id="seg"><span class="on" data-action="spaces-arr-view" data-v="groups">Groups</span><span data-action="spaces-arr-view" data-v="board">Board</span></div>'
      + '<button class="btn ghost" data-action="spaces-arr-minall" id="minAll">Collapse all</button><button class="btn pri" data-action="spaces-new">+ New space</button></div></div>'
      + '<p class="tip" id="tip"><b>Drag a space</b> to reorder it or drop it in another category. <b>Drag a category header</b> to move the whole category up or down. Collapse them to arrange the order quickly.</p>'
      + '<section class="view on" id="groups"></section><section class="view" id="board"></section>'
      + '<div class="toast" id="toast"></div>';
    if (P().finishPaint) P().finishPaint(wrap);
    bindArrange(wrap, CATS);
    markReady('spacesDesk');
  }

  function bindArrange(root, CATS) {
    function card(s, ci, si) {
      return '<div class="sp" draggable="true" data-action="spaces-arr-sp" data-c="' + ci + '" data-s="' + si + '"' + (s[3] ? ' data-id="' + esc(s[3]) + '"' : '') + '><div class="t"><span class="rg" style="--p:' + (s[1] * 20) + '%"><span>' + s[1] + '/5</span></span><h4>' + esc(s[0]) + '</h4></div><span class="nx">' + esc(s[2]) + '</span></div>';
    }
    function renderGroups() {
      var el = root.getElementById ? root.getElementById('groups') : root.querySelector('#groups');
      el.innerHTML = CATS.map(function (c, ci) {
        return '<div class="cat' + (c.min ? ' min' : '') + '" draggable="true" data-action="spaces-arr-cat" data-c="' + ci + '"><div class="ch"><span class="grab">MOVE</span><h2>' + esc(c.name) + '</h2><span class="n">' + c.sp.length + '</span><span class="pos">' + (ci + 1) + ' of ' + CATS.length + '</span><span class="tg" data-action="spaces-arr-tg" data-tg="' + ci + '">' + (c.min ? 'Expand' : 'Collapse') + '</span></div><div class="grid" data-c="' + ci + '">' + c.sp.map(function (s, si) { return card(s, ci, si); }).join('') + '<div class="addsp" data-action="spaces-new">+ New space</div></div></div>';
      }).join('');
    }
    function renderBoard() {
      var el = root.getElementById ? root.getElementById('board') : root.querySelector('#board');
      el.innerHTML = '<div class="board">' + CATS.map(function (c, ci) {
        return '<div class="col' + (c.min ? ' min' : '') + '" draggable="true" data-action="spaces-arr-cat" data-c="' + ci + '"><div class="ch"><span class="grab">MOVE</span><h2>' + esc(c.name) + '</h2><span class="n">' + c.sp.length + '</span><span class="tg" data-action="spaces-arr-tg" data-tg="' + ci + '">' + (c.min ? 'Open' : 'Fold') + '</span></div><div class="list" data-c="' + ci + '">' + c.sp.map(function (s, si) { return card(s, ci, si); }).join('') + '</div></div>';
      }).join('') + '</div>';
    }
    function render() {
      var on = root.querySelector('#seg span.on');
      var v = (on && on.getAttribute('data-v')) || 'groups';
      var g = root.querySelector('#groups');
      var b = root.querySelector('#board');
      if (g) g.classList.toggle('on', v === 'groups');
      if (b) b.classList.toggle('on', v === 'board');
      if (v === 'groups') { renderGroups(); if (b) b.innerHTML = ''; }
      else { renderBoard(); if (g) g.innerHTML = ''; }
    }
    function persist() {
      if (!writeOk()) return;
      api('/api/spaces/groups/reorder', { method: 'PATCH', body: { ids: CATS.map(function (c) { return c.name; }) } }).catch(function () {});
      CATS.forEach(function (c) {
        c.sp.forEach(function (s, i) {
          if (s[3]) api('/api/spaces/' + encodeURIComponent(s[3]), { method: 'PATCH', body: { group: c.name, position: i } }).catch(function () {});
        });
      });
    }
    var drag = null;
    function clear() { root.querySelectorAll('.ins-l,.ins-r,.ins-t,.ins-b,.over-top,.over-bot,.into,.empty-over').forEach(function (x) { x.classList.remove('ins-l', 'ins-r', 'ins-t', 'ins-b', 'over-top', 'over-bot', 'into', 'empty-over'); }); }
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-action]');
      if (!t) return;
      var a = t.getAttribute('data-action');
      if (a === 'spaces-arr-view') {
        var v = t.getAttribute('data-v');
        root.querySelectorAll('#seg span').forEach(function (s) { s.classList.toggle('on', s.getAttribute('data-v') === v); });
        render();
        var tip = root.getElementById ? root.getElementById('tip') : root.querySelector('#tip');
        if (tip) tip.innerHTML = v === 'board' ? '<b>Drag a card</b> up or down, or into another column. <b>Drag a column header</b> left or right to put that group first or second. Fold a column to make room.' : '<b>Drag a space</b> to reorder it or drop it in another category. <b>Drag a category header</b> to move the whole category up or down. Collapse them to arrange the order quickly.';
      }
      if (a === 'spaces-arr-minall') {
        var anyOpen = CATS.some(function (c) { return !c.min; });
        CATS.forEach(function (c) { c.min = anyOpen; });
        t.textContent = anyOpen ? 'Expand all' : 'Collapse all';
        render();
      }
      if (a === 'spaces-arr-tg') {
        var c = CATS[+t.getAttribute('data-tg')];
        if (c) { c.min = !c.min; render(); }
      }
      if (a === 'spaces-arr-sp' && t.getAttribute('data-id') && window.deskActions && window.deskActions['space-open']) {
        window.deskActions['space-open'](t, root.getRootNode ? root.getRootNode() : root);
      }
    });
    root.addEventListener('dragstart', function (e) {
      var sp = e.target.closest('.sp');
      if (sp) { drag = { kind: 'sp', c: +sp.dataset.c, s: +sp.dataset.s }; sp.classList.add('dragging'); e.stopPropagation(); }
      else {
        var cat = e.target.closest('.cat,.col');
        if (!cat) return;
        drag = { kind: 'cat', c: +cat.dataset.c, board: cat.classList.contains('col') };
        cat.classList.add('dragging');
      }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'x');
    });
    root.addEventListener('dragend', function () {
      root.querySelectorAll('.dragging').forEach(function (x) { x.classList.remove('dragging'); });
      clear(); drag = null;
    });
    root.addEventListener('dragover', function (e) {
      if (!drag) return;
      e.preventDefault(); clear();
      if (drag.kind === 'sp') {
        var sp = e.target.closest('.sp');
        if (sp) {
          var r = sp.getBoundingClientRect();
          var inBoard = !!sp.closest('.col');
          sp.classList.add(inBoard ? (e.clientY < r.top + r.height / 2 ? 'ins-t' : 'ins-b') : (e.clientX < r.left + r.width / 2 ? 'ins-l' : 'ins-r'));
          drag.to = { c: +sp.dataset.c, s: +sp.dataset.s + ((inBoard ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2) ? 1 : 0) };
          return;
        }
        var cat = e.target.closest('.cat,.col');
        if (cat) {
          var ci = +cat.dataset.c;
          cat.classList.add('into');
          var box = cat.querySelector('.grid,.list');
          if (box) box.classList.add('empty-over');
          drag.to = { c: ci, s: CATS[ci].sp.length };
        }
      } else {
        var cat2 = e.target.closest(drag.board ? '.col' : '.cat');
        if (!cat2) return;
        var r2 = cat2.getBoundingClientRect();
        var after = drag.board ? e.clientX > r2.left + r2.width / 2 : e.clientY > r2.top + Math.min(r2.height / 2, 24);
        cat2.classList.add(drag.board ? (after ? 'ins-r' : 'ins-l') : (after ? 'over-bot' : 'over-top'));
        drag.to = +cat2.dataset.c + (after ? 1 : 0);
      }
    });
    root.addEventListener('drop', function (e) {
      if (!drag || drag.to == null) return;
      e.preventDefault();
      var ordinal = ['first', 'second', 'third', 'fourth', 'fifth'];
      if (drag.kind === 'sp') {
        var from = CATS[drag.c], item = from.sp.splice(drag.s, 1)[0];
        var c = drag.to.c, s = drag.to.s;
        if (c == drag.c && s > drag.s) s -= 1;
        CATS[c].sp.splice(s, 0, item);
        CATS[c].min = false;
        render(); persist();
        toast(root, c == drag.c ? item[0] + ' moved to position ' + (s + 1) + ' in ' + CATS[c].name : item[0] + ' moved to ' + CATS[c].name + ', position ' + (s + 1));
      } else {
        var to = drag.to;
        var cat = CATS.splice(drag.c, 1)[0];
        if (to > drag.c) to -= 1;
        CATS.splice(to, 0, cat);
        render(); persist();
        toast(root, cat.name + ' is now ' + (ordinal[to] || ('#' + (to + 1))));
      }
      drag = null;
    });
    render();
  }

  /* ---------- Spaces cards (05e) + quick window (05f) ---------- */
  var CARD_COL = ['#2e6bf2', '#12a36a', '#c98408', '#6b4fd8', '#e0364f', '#0f8a8a'];
  var CARD_STEPS = ['Person', 'Notes', 'Docs attached', 'Link added', 'Intro written'];
  function cardsSample() {
    return [
      { name: 'General', min: false, sp: [
        { n: 'Regulator intro', o: 'Template for regulator first contact', why: 'The intro we send to BCFSA, FSRA and AMF. Leads with conduct risk.', d: [1, 1, 0, 0, 0], last: '-', em: 0, stage: 'draft', nx: ['Add docs', 'amb'], docs: 0, links: 0, notes: 'Template for regulator first contact.' },
        { n: 'Friends & Family email', o: 'Round update for the F&F list', why: 'Monthly note to friends and family investors: progress, raise status, one ask.', d: [1, 1, 0, 0, 0], last: '12 Oct', em: 14, stage: 'sent', nx: ['Write intro', 'amb'], docs: 1, links: 0, notes: 'Round update for the F&F list.' },
        { n: 'Design partners', o: 'Pack for credit unions and brokers', why: 'Pilot pitch: what changes for their advisors, 30-day pilot, pricing for 10 seats.', d: [1, 1, 1, 0, 0], last: '22 Oct', em: 6, stage: 'pilot', nx: ['Add the link', 'amb'], docs: 2, links: 0, notes: 'Pack for credit unions and brokers.' }
      ] },
      { name: 'Venture Capital', min: false, sp: [
        { n: 'Joe Canavan', o: 'Angel - email first', why: 'Backs fintech infrastructure. Wants the base case and the raise terms in one page.', d: [1, 1, 1, 1, 0], last: '-', em: 0, stage: 'Storage', nx: ['Send today', 'red'], docs: 2, links: 1, notes: 'Angel - email first.' },
        { n: 'Neil Mitchell', o: 'Marsh Canada MD - insurtech angel', why: 'Backed QuickFacts. Lead with conduct risk in insurance distribution, not AI.', d: [1, 1, 1, 0, 0], last: '-', em: 0, stage: 'Storage', nx: ['Add docs', 'amb'], docs: 1, links: 4, notes: 'Marsh Canada MD - insurtech angel.' },
        { n: 'Norm Cappell', o: 'Angel - Calgary network', why: 'Knows the Alberta credit unions. Ask for two intros rather than a cheque first.', d: [1, 1, 0, 0, 0], last: '3 Oct', em: 2, stage: 'Cold', nx: ['Write intro', 'amb'], docs: 0, links: 0, notes: 'Angel - Calgary network.' },
        { n: 'Mench Capital', o: 'Investor - Mike Gardner', why: 'Questions on the capture rate. Send the base case and the three scenarios.', d: [1, 1, 1, 1, 1], last: '20 Oct', em: 5, stage: 'Info pack sent', nx: ['Ready to send', 'grn'], docs: 3, links: 1, notes: 'Questions on the capture rate. Send the base case and the three scenarios.' }
      ] },
      { name: 'Business', min: false, sp: [
        { n: 'Bow Valley Credit Union', o: 'Design partner - compliance lead', why: 'Board wants a sample record and pricing on one page before Thursday 10:00.', d: [1, 1, 1, 0, 0], last: '22 Oct', em: 8, stage: 'Meeting booked', nx: ['Attach sample', 'red'], docs: 2, links: 0, notes: 'Design partner - compliance lead.' },
        { n: 'Enrich Mortgage Group', o: 'Broker group - discovery', why: 'Wants proof of what each client was told before signing. 30-day pilot, 2 brokers.', d: [1, 1, 0, 0, 0], last: '26 Oct', em: 3, stage: 'Contact made', nx: ['Book discovery', 'amb'], docs: 0, links: 0, notes: 'Broker group - discovery.' },
        { n: 'Tom Robertson', o: 'Mortgage broker', why: 'Met at the CMT event. Interested in the read-back feature for his team.', d: [1, 0, 0, 0, 0], last: '-', em: 0, stage: 'Storage', nx: ['Add notes', 'amb'], docs: 0, links: 0, notes: 'Mortgage broker.' }
      ] }
    ];
  }
  function pctOf(s) { return (s.d || []).filter(Boolean).length; }
  function iniOf(n) { return String(n || '').split(' ').map(function (x) { return x[0] || ''; }).join('').slice(0, 2).toUpperCase(); }
  function ringColor(k) { return k === 5 ? 'var(--green)' : (k >= 3 ? '#2e6bf2' : '#c98408'); }
  function fmtDay(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'America/Vancouver' }).format(d);
  }
  function liveFacts(pkg) {
    var S0 = window.STATE || {};
    var name = String(pkg.name || '');
    var contacts = (S0.contacts || []).concat(S0.pipeline || []).concat(S0.people || []);
    var hit = contacts.filter(function (c) {
      var cn = String(c.name || '').toLowerCase();
      return cn && (cn === name.toLowerCase() || name.toLowerCase().indexOf(cn) >= 0 || cn.indexOf(name.toLowerCase()) >= 0);
    })[0];
    var last = (hit && (hit.lastTouch || hit.last_touch || hit.lastContact)) || pkg.lastTouch || pkg.last_contact || '';
    var emails = 0;
    var addr = String((hit && (hit.email || hit.address)) || '').toLowerCase();
    (S0.mail || S0.inbox || []).forEach(function (m) {
      var blob = String((m.from || '') + ' ' + (m.to || '') + ' ' + (m.email || '')).toLowerCase();
      if (addr && blob.indexOf(addr) >= 0) emails += 1;
      else if (name && blob.indexOf(name.toLowerCase()) >= 0) emails += 1;
    });
    var stage = (hit && (hit.stage || hit.pipelineStage || hit.status)) || pkg.stage || pkg.status || 'draft';
    return { last: fmtDay(last), em: emails, stage: String(stage) };
  }
  function stepsFromPkg(pkg) {
    if (pkg.steps && pkg.steps.length) {
      return CARD_STEPS.map(function (t) {
        var hit = pkg.steps.filter(function (x) { return x && String(x.t || x.text || '') === t; })[0];
        return hit && (hit.d || hit.done) ? 1 : 0;
      });
    }
    var docs = (pkg.docs || pkg.items || []).filter(function (d) { return d && d.kind !== 'link' && d.mime !== 'text/x-folder'; });
    var links = (pkg.docs || pkg.items || []).filter(function (d) { return d && (d.kind === 'link' || d.mime === 'text/x-link'); });
    return [
      (pkg.recipients || pkg.people || []).length ? 1 : 0,
      (pkg.notes || pkg.description) ? 1 : 0,
      (pkg.docCount || docs.length) ? 1 : 0,
      (pkg.linkCount || links.length) ? 1 : 0,
      (pkg.emailBody || pkg.angle) ? 1 : 0
    ];
  }
  function nextChip(s) {
    if (s.nx && s.nx.length) return s.nx;
    var k = pctOf(s);
    if (k === 5) return ['Ready to send', 'grn'];
    var i = (s.d || []).indexOf(0);
    var missing = CARD_STEPS[i] || 'Next step';
    var map = { Person: 'Add person', Notes: 'Add notes', 'Docs attached': 'Add docs', 'Link added': 'Add the link', 'Intro written': 'Write intro' };
    var due = /today|due/i.test(String(s.stage || '')) || String(s.last || '') === fmtDay(new Date().toISOString());
    return [map[missing] || missing, due ? 'red' : 'amb'];
  }
  function cardFromPkg(pkg) {
    var facts = liveFacts(pkg);
    var docs = (pkg.docs || pkg.items || []).filter(function (d) { return d && d.kind !== 'link' && d.mime !== 'text/x-folder'; });
    var links = (pkg.docs || pkg.items || []).filter(function (d) { return d && (d.kind === 'link' || d.mime === 'text/x-link'); });
    var s = {
      id: pkg.id,
      n: pkg.name || 'Untitled space',
      o: pkg.subjectLabel || pkg.organisation || pkg.organization || pkg.description || '',
      why: pkg.angle || '',
      d: stepsFromPkg(pkg),
      last: facts.last,
      em: facts.em,
      stage: facts.stage,
      docs: Number(pkg.docCount != null ? pkg.docCount : docs.length) || 0,
      links: Number(pkg.linkCount != null ? pkg.linkCount : links.length) || 0,
      notes: pkg.notes || pkg.description || '',
      people: (pkg.recipients || pkg.people || []).map(function (p) { return p.name || p.email || ''; }).filter(Boolean),
      files: docs,
      linkItems: links,
      history: pkg.history || []
    };
    s.nx = nextChip(s);
    return s;
  }
  function liveCards() {
    var S0 = window.STATE || {};
    var spaces = (S0.packages && S0.packages.length ? S0.packages : (S0.spaces || [])).slice();
    spaces.sort(function (a, b) { return (Number(a.position) || 0) - (Number(b.position) || 0); });
    var by = {};
    spaces.forEach(function (s) {
      var cat = s.category || s.spaceCategory || 'General';
      if (!by[cat]) by[cat] = { id: cat, name: cat, min: false, sp: [] };
      by[cat].sp.push(cardFromPkg(s));
    });
    var junk = spaces.filter(function (s) {
      var n = String(s.name || '');
      var people = (s.recipients || s.people || []).length;
      var docs = Number(s.docCount || (s.docs || []).length) || 0;
      var notes = String(s.notes || s.description || '').trim();
      return /^Untitled space$/i.test(n) || /Untitlezzzzd/i.test(n) || (!people && !docs && !notes);
    });
    if (junk.length) console.log('[spaces-audit] test-looking', junk.map(function (s) { return { id: s.id, name: s.name }; }));
    var order = ((S0.spaceGroups) || []).map(function (g) { return g.name || g; });
    var names = order.filter(function (n) { return by[n]; });
    Object.keys(by).forEach(function (n) { if (names.indexOf(n) < 0) names.push(n); });
    if (!names.length) return [{ name: 'General', min: false, sp: [] }];
    return names.map(function (n) { return by[n]; });
  }
  window.paintSpacesCardsPage = paintSpacesCardsPage;
  function paintSpacesCardsPage(openWanted) {
    var wrap = wrapOf('spacesDesk');
    if (!wrap) return;
    if (P().applyPageCss) P().applyPageCss(wrap, 'spacesCards');
    var CATS = (fixtureOn() ? cardsSample() : liveCards()).map(function (c) { return Object.assign({}, c, { sp: c.sp.slice() }); });
    var all = CATS.reduce(function (n, c) { return n + c.sp.length; }, 0);
    var readyN = CATS.reduce(function (n, c) { return n + c.sp.filter(function (s) { return pctOf(s) === 5; }).length; }, 0);
    var needDocs = CATS.reduce(function (n, c) { return n + c.sp.filter(function (s) { return !s.d[2]; }).length; }, 0);
    var kpiHtml = fixtureOn()
      ? '<span><b>53</b> spaces</span><span class="hot"><b>2</b> ready to send</span><span><b>4</b> need docs</span><span><b>0</b> sent this week</span><span><b>0</b> replies</span><span><b>0</b> meetings booked</span>'
      : '<span><b>' + all + '</b> spaces</span><span class="hot"><b>' + readyN + '</b> ready to send</span><span><b>' + needDocs + '</b> need docs</span><span><b>0</b> sent this week</span><span><b>0</b> replies</span><span><b>0</b> meetings booked</span>';
    wrap.innerHTML =
      '<div class="bar"><h1>Spaces</h1><span class="sub">Every send-bundle, grouped by who it\'s for</span>'
      + '<div class="r"><input class="search" id="q" data-action="spaces-search" placeholder="Search spaces or people"><div class="seg" id="seg"><span class="on" data-action="spaces-arr-view" data-v="groups">Groups</span><span data-action="spaces-arr-view" data-v="board">Board</span></div>'
      + '<button class="btn ghost" data-action="spaces-arr-minall" id="minAll">Collapse all</button><button class="btn pri" data-action="spaces-new">+ New space</button></div></div>'
      + '<div class="kpis">' + kpiHtml + '</div>'
      + '<section class="view on" id="groups"><div id="cats"></div></section><section class="view" id="board"></section>'
      + '<div class="scrim" id="scrim" data-action="spaces-card-close"></div>'
      + '<aside class="qw" id="qw" role="dialog" aria-label="Space">'
      + '<div class="qh"><span class="cr" id="qCr"></span><div class="r">'
      + '<button class="btn sm" data-action="spaces-card-prev" id="prev">&lsaquo; Prev</button>'
      + '<button class="btn sm" data-action="spaces-card-next" id="next">Next &rsaquo;</button>'
      + '<button class="btn sm" data-action="spaces-card-full" id="full">Open full page</button>'
      + '<button class="btn sm" data-action="spaces-card-close" id="close">Close</button></div></div>'
      + '<div class="qb" id="qb"></div>'
      + '<div class="qf"><span class="st" id="qSt"></span>'
      + '<button class="btn sm" data-action="space-drive" id="drive">Move to Drive</button>'
      + '<button class="btn sm" data-action="space-book" id="book">Book 20 min</button>'
      + '<button class="btn sm" data-action="space-email" id="email">Email them</button>'
      + '<button class="btn sm" data-action="space-menu" id="qMore">&middot;&middot;&middot;</button>'
      + '<button class="btn sm pri" data-action="space-send" id="send">Send bundle</button></div></aside>'
      + '<div class="menu" id="menu"><div class="lbl">Move to</div><div data-action="space-move-group" data-group="General">General</div><div data-action="space-move-group" data-group="Venture Capital">Venture Capital</div><div data-action="space-move-group" data-group="Business">Business</div><div data-action="space-move-group" data-group="Regulators">Regulators</div><div data-action="space-rename">Rename</div><div class="del" data-action="space-archive">Delete</div></div>'
      + '<div class="toast" id="toast"></div>';
    if (P().finishPaint) P().finishPaint(wrap);
    bindCards(wrap, CATS, !!openWanted);
    markReady('spacesDesk');
  }
  function bindCards(root, CATS, openWanted) {
    var cur = null;
    var savedScroll = 0;
    function flat() { return CATS.reduce(function (a, c, ci) { return a.concat(c.sp.map(function (s, si) { return { s: s, ci: ci, si: si }; })); }, []); }
    function persist() {
      if (!writeOk()) return;
      api('/api/spaces/groups/reorder', { method: 'PATCH', body: { ids: CATS.map(function (c) { return c.name; }) } }).catch(function () {});
      CATS.forEach(function (c) {
        c.sp.forEach(function (s, i) {
          if (s.id) api('/api/spaces/' + encodeURIComponent(s.id), { method: 'PATCH', body: { group: c.name, position: i } }).catch(function () {});
        });
      });
    }
    function cardHtml(s, ci, si) {
      var k = pctOf(s), c = ringColor(k), nx = nextChip(s);
      return '<div class="sp" draggable="true" data-action="spaces-card-open" data-c="' + ci + '" data-s="' + si + '"' + (s.id ? ' data-id="' + esc(s.id) + '"' : '') + '>'
        + '<div class="hd"><span class="av" style="background:' + CARD_COL[(ci * 3 + si) % 6] + '">' + esc(iniOf(s.n)) + '</span><div style="min-width:0"><h4>' + esc(s.n) + '</h4><div class="org">' + esc(s.o) + '</div></div>'
        + '<span class="ms" title="More" data-action="space-menu" data-id="' + esc(s.id || '') + '">&middot;&middot;&middot;</span>'
        + '<span class="ring" style="--p:' + (k * 20) + '%;--c:' + c + '"><span>' + k + '/5</span></span></div>'
        + '<p class="why">' + (s.why ? esc(s.why) : '<span data-action="spaces-card-open" data-c="' + ci + '" data-s="' + si + '">Add an angle</span>') + '</p>'
        + '<div class="facts"><div><b>' + esc(s.last) + '</b><small>last contact</small></div><div><b>' + esc(s.em) + '</b><small>emails</small></div><div><b>' + esc(s.stage) + '</b><small>pipeline stage</small></div></div>'
        + '<div class="steps">' + (s.d || []).map(function (x) { return '<i class="' + (x ? 'd' : '') + '"></i>'; }).join('') + '</div>'
        + '<div class="ft"><span class="nx ' + esc(nx[1]) + '">' + esc(nx[0]) + '</span><span class="bund">' + (s.docs || 0) + ' docs &middot; ' + (s.links || 0) + ' links</span><span class="go">Open</span></div></div>';
    }
    function renderGroups() {
      var qEl = root.getElementById ? root.getElementById('q') : root.querySelector('#q');
      var q = String((qEl && qEl.value) || '').toLowerCase();
      var cats = root.getElementById ? root.getElementById('cats') : root.querySelector('#cats');
      if (!cats) return;
      cats.innerHTML = CATS.map(function (c, ci) {
        var list = c.sp.map(function (s, si) { return [s, si]; }).filter(function (pair) {
          return !q || (pair[0].n + ' ' + pair[0].o + ' ' + (pair[0].why || '')).toLowerCase().indexOf(q) >= 0;
        });
        var ready = c.sp.filter(function (s) { return pctOf(s) === 5; }).length;
        var due = c.sp.filter(function (s) { return nextChip(s)[1] === 'red'; }).length;
        return '<div class="cat' + (c.min ? ' min' : '') + '" draggable="true" data-action="spaces-arr-cat" data-c="' + ci + '"><div class="ch"><span class="grab">MOVE</span><h2>' + esc(c.name) + '</h2><span class="n">' + c.sp.length + '</span><span class="sum">' + ready + ' ready &middot; ' + due + ' due today</span><span class="tg" data-action="spaces-arr-tg" data-tg="' + ci + '">' + (c.min ? 'Expand' : 'Collapse') + '</span></div><div class="grid" data-c="' + ci + '">' + list.map(function (pair) { return cardHtml(pair[0], ci, pair[1]); }).join('') + '<div class="addsp" data-action="spaces-new">+ New space in ' + esc(c.name) + '</div></div></div>';
      }).join('');
    }
    function renderBoard() {
      var el = root.getElementById ? root.getElementById('board') : root.querySelector('#board');
      if (!el) return;
      el.innerHTML = '<div class="board">' + CATS.map(function (c, ci) {
        return '<div class="col' + (c.min ? ' min' : '') + '" draggable="true" data-action="spaces-arr-cat" data-c="' + ci + '"><div class="ch"><span class="grab">MOVE</span><h2>' + esc(c.name) + '</h2><span class="n">' + c.sp.length + '</span><span class="sum">' + c.sp.filter(function (s) { return pctOf(s) === 5; }).length + ' ready</span><span class="tg" data-action="spaces-arr-tg" data-tg="' + ci + '">' + (c.min ? 'Open' : 'Fold') + '</span></div><div class="list" data-c="' + ci + '">' + c.sp.map(function (s, si) { return cardHtml(s, ci, si); }).join('') + '</div></div>';
      }).join('') + '</div>';
    }
    function markCur() {
      root.querySelectorAll('.sp').forEach(function (e) {
        e.classList.toggle('cur', !!(cur && +e.getAttribute('data-c') === cur.ci && +e.getAttribute('data-s') === cur.si));
      });
    }
    function activeView() {
      var on = root.querySelector('#seg span.on');
      return (on && on.getAttribute('data-v')) || 'groups';
    }
    function render() {
      var v = activeView();
      var g = root.querySelector('#groups');
      var b = root.querySelector('#board');
      if (g) g.classList.toggle('on', v === 'groups');
      if (b) b.classList.toggle('on', v === 'board');
      if (v === 'groups') { renderGroups(); if (b) b.innerHTML = ''; }
      else { renderBoard(); var cats = root.querySelector('#cats'); if (cats) cats.innerHTML = ''; }
      if (cur) markCur();
    }
    function fillWindow() {
      if (!cur) return;
      var s = CATS[cur.ci].sp[cur.si], k = pctOf(s), c = ringColor(k);
      var qCr = root.getElementById ? root.getElementById('qCr') : root.querySelector('#qCr');
      var qb = root.getElementById ? root.getElementById('qb') : root.querySelector('#qb');
      var qSt = root.getElementById ? root.getElementById('qSt') : root.querySelector('#qSt');
      var qw = root.getElementById ? root.getElementById('qw') : root.querySelector('#qw');
      var scrim = root.getElementById ? root.getElementById('scrim') : root.querySelector('#scrim');
      var left = CARD_STEPS.filter(function (x, i) { return !s.d[i]; }).slice(0, 2).join(', ').toLowerCase();
      if (qCr) qCr.innerHTML = esc(CATS[cur.ci].name) + ' / <b>' + esc(s.n) + '</b>';
      var files = (s.files || []).map(function (f) { return '<span>' + esc(f.name || 'File') + '</span>'; }).join('');
      if (!files && s.docs) {
        if (s.docs >= 1) files += '<span>4orm one-pager.pdf</span>';
        if (s.docs > 1) files += '<span>Base case model.pdf</span>';
        if (s.docs > 2) files += '<span>Three scenarios.pdf</span>';
      }
      var linkBits = (s.linkItems || []).map(function (l) { return '<span>' + esc(l.name || l.title || 'Link') + '</span>'; }).join('');
      if (!linkBits && s.links) linkBits = '<span>Readiness check link</span>';
      var people = (s.people && s.people.length) ? s.people : [String(s.o || '').split(' - ').pop() || s.n];
      var hist = (s.history || []).map(function (h) {
        return '<div><small>' + esc(fmtDay(h.at) || h.at || '') + '</small>' + esc(h.text || '') + '</div>';
      }).join('');
      if (!hist) {
        hist = '<div><small>' + esc(s.last === '-' ? 'Today' : s.last) + '</small>Last email in the thread</div>'
          + (s.em ? '<div><small>14 Oct</small>Info pack sent - ' + s.em + ' emails so far</div>' : '')
          + '<div><small>2 Oct</small>Space created</div>';
      }
      if (qb) qb.innerHTML =
        '<div class="hero"><span class="av" style="background:' + CARD_COL[(cur.ci * 3 + cur.si) % 6] + '">' + esc(iniOf(s.n)) + '</span>'
        + '<div style="min-width:0;flex:1"><h2 contenteditable="true" spellcheck="false" id="eName" data-action="space-card-name" data-id="' + esc(s.id || '') + '">' + esc(s.n) + '</h2>'
        + '<div class="org" contenteditable="true" spellcheck="false" id="eOrg" data-action="space-card-desc" data-id="' + esc(s.id || '') + '">' + esc(s.o) + '</div></div>'
        + '<span class="ring" style="--p:' + (k * 20) + '%;--c:' + c + '"><span>' + k + '/5</span></span></div>'
        + '<div class="tags"><span class="cat2">' + esc(CATS[cur.ci].name) + '</span><span>' + esc(s.stage) + '</span><span>' + (s.em ? 'In touch' : 'Never contacted') + '</span></div>'
        + '<div class="qfacts"><div><b>' + esc(s.last) + '</b><small>last contact</small></div><div><b>' + esc(s.em) + '</b><small>emails</small></div><div><b>' + esc(s.stage) + '</b><small>pipeline stage</small></div><div><b>' + (Number(s.docs || 0) + Number(s.links || 0)) + '</b><small>in the bundle</small></div></div>'
        + '<div class="qs"><h3>The angle<span class="s">4orm Intelligence</span><span class="a" data-action="space-rewrite" data-id="' + esc(s.id || '') + '">Rewrite</span><span class="a" data-action="space-research" data-id="' + esc(s.id || '') + '">Research</span></h3>'
        + '<div class="ang" contenteditable="true" id="eAng" data-action="space-angle" data-id="' + esc(s.id || '') + '">' + esc(s.why) + '</div></div>'
        + '<div class="qs"><h3>Ready to send<span class="s">' + k + ' of 5 done</span></h3><div class="chk todo">' + CARD_STEPS.map(function (x, i) {
          return '<label class="td' + (s.d[i] ? ' d' : '') + '" data-action="spaces-card-tick" data-st="' + i + '" data-id="' + esc(s.id || '') + '"><i></i>' + esc(x) + '</label>';
        }).join('') + '</div></div>'
        + '<div class="qs"><h3>Bundle<span class="s">what goes out</span></h3><div class="bund">' + files + linkBits
        + '<span class="add" data-action="space-docs" data-id="' + esc(s.id || '') + '">+ Add a file</span>'
        + '<span class="add" data-action="space-link" data-id="' + esc(s.id || '') + '">+ Add a link</span></div></div>'
        + '<div class="qs"><h3>People<span class="s">who this is for</span></h3><div class="ppl">' + people.map(function (p) { return '<span>' + esc(p) + '</span>'; }).join('')
        + '<span class="add" data-action="space-people" data-id="' + esc(s.id || '') + '">+ Add a person</span></div></div>'
        + '<div class="qs"><h3>Notes<span class="s">saves as you type</span></h3><div class="note" contenteditable="true" data-action="space-notes" data-id="' + esc(s.id || '') + '">' + esc(s.notes || s.why || '') + '</div></div>'
        + '<div class="qs"><h3>History</h3><div class="hist">' + hist + '</div></div>';
      if (qSt) qSt.innerHTML = '<b>' + k + '/5</b> ready to send' + (k < 5 ? ' &middot; ' + esc(left) + ' left' : ' &middot; everything is attached and approved');
      ['drive', 'book', 'email', 'send', 'qMore'].forEach(function (id) {
        var b = root.getElementById ? root.getElementById(id) : root.querySelector('#' + id);
        if (b && s.id) b.setAttribute('data-id', s.id);
      });
      if (qw) qw.classList.add('on');
      if (scrim) scrim.classList.add('on');
      markCur();
    }
    function openCard(ci, si) {
      var host = document.getElementById('spacesDesk');
      savedScroll = (host && host.scrollTop) || (root.scrollTop) || 0;
      cur = { ci: ci, si: si };
      var s = CATS[ci] && CATS[ci].sp[si];
      if (s && s.id && window.STATE) {
        var hit = (window.STATE.packages || []).filter(function (p) { return String(p.id) === String(s.id); })[0];
        if (hit) window.STATE.spaceCard = hit;
      }
      fillWindow();
    }
    function closeCard() {
      var qw = root.getElementById ? root.getElementById('qw') : root.querySelector('#qw');
      var scrim = root.getElementById ? root.getElementById('scrim') : root.querySelector('#scrim');
      if (qw) qw.classList.remove('on');
      if (scrim) scrim.classList.remove('on');
      cur = null;
      markCur();
      var host = document.getElementById('spacesDesk');
      if (host) host.scrollTop = savedScroll;
    }
    function step(d) {
      var f = flat();
      if (!cur || !f.length) return;
      var i = f.findIndex(function (x) { return x.ci === cur.ci && x.si === cur.si; });
      i = (i + d + f.length) % f.length;
      openCard(f[i].ci, f[i].si);
    }
    root.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-action]');
      if (!t) return;
      var a = t.getAttribute('data-action');
      if (a === 'spaces-arr-view') {
        var v = t.getAttribute('data-v');
        root.querySelectorAll('#seg span').forEach(function (s) { s.classList.toggle('on', s.getAttribute('data-v') === v); });
        render();
      }
      if (a === 'spaces-arr-minall') {
        var anyOpen = CATS.some(function (c) { return !c.min; });
        CATS.forEach(function (c) { c.min = anyOpen; });
        t.textContent = anyOpen ? 'Expand all' : 'Collapse all';
        render();
      }
      if (a === 'spaces-arr-tg') {
        var c = CATS[+t.getAttribute('data-tg')];
        if (c) { c.min = !c.min; render(); }
      }
      if (a === 'spaces-card-open') {
        e.stopPropagation();
        openCard(+t.getAttribute('data-c'), +t.getAttribute('data-s'));
      }
      if (a === 'spaces-card-close') closeCard();
      if (a === 'spaces-card-prev') step(-1);
      if (a === 'spaces-card-next') step(1);
      if (a === 'spaces-card-full') {
        var s = cur && CATS[cur.ci] && CATS[cur.ci].sp[cur.si];
        if (s && window.deskActions && window.deskActions['space-open']) {
          t.setAttribute('data-id', s.id || '');
          window.deskActions['space-open'](t, root);
        }
      }
      if (a === 'spaces-card-tick') {
        if (!cur) return;
        var s2 = CATS[cur.ci].sp[cur.si];
        var i = +t.getAttribute('data-st');
        s2.d[i] = s2.d[i] ? 0 : 1;
        s2.nx = nextChip(s2);
        if (writeOk() && s2.id) {
          var steps = CARD_STEPS.map(function (name, idx) { return { t: name, d: !!s2.d[idx] }; });
          api('/api/spaces/' + encodeURIComponent(s2.id), { method: 'PATCH', body: { steps: steps } }).catch(function () {});
        }
        fillWindow();
        render();
        toast(root, s2.d[i] ? 'Ticked' : 'Unticked');
      }
    });
    var q = root.getElementById ? root.getElementById('q') : root.querySelector('#q');
    if (q) q.addEventListener('input', function () { render(); });
    root.addEventListener('blur', function (e) {
      var t = e.target;
      if (!t || !cur) return;
      var s = CATS[cur.ci].sp[cur.si];
      if (t.id === 'eName') { s.n = String(t.textContent || '').trim() || s.n; render(); fillWindow(); }
      if (t.id === 'eOrg') { s.o = String(t.textContent || '').trim(); render(); }
      if (t.id === 'eAng') { s.why = String(t.textContent || '').trim(); render(); }
    }, true);
    if (!root.__cardKeys) {
      root.__cardKeys = true;
      document.addEventListener('keydown', function (e) {
        if (!cur) return;
        var qw = root.getElementById ? root.getElementById('qw') : root.querySelector('#qw');
        if (!qw || !qw.classList.contains('on')) return;
        if (e.key === 'Escape') { e.preventDefault(); closeCard(); return; }
        var ae = e.target;
        if (ae && (ae.isContentEditable || /INPUT|TEXTAREA/.test(ae.tagName || ''))) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      });
    }
    var drag = null;
    function clear() { root.querySelectorAll('.ins-l,.ins-r,.ins-t,.ins-b,.over-top,.over-bot,.into,.empty-over').forEach(function (x) { x.classList.remove('ins-l', 'ins-r', 'ins-t', 'ins-b', 'over-top', 'over-bot', 'into', 'empty-over'); }); }
    root.addEventListener('dragstart', function (e) {
      var sp = e.target.closest('.sp');
      if (sp) { drag = { kind: 'sp', c: +sp.dataset.c, s: +sp.dataset.s }; sp.classList.add('dragging'); e.stopPropagation(); }
      else {
        var cat = e.target.closest('.cat,.col');
        if (!cat) return;
        drag = { kind: 'cat', c: +cat.dataset.c, board: cat.classList.contains('col') };
        cat.classList.add('dragging');
      }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'x');
    });
    root.addEventListener('dragend', function () {
      root.querySelectorAll('.dragging').forEach(function (x) { x.classList.remove('dragging'); });
      clear(); drag = null;
    });
    root.addEventListener('dragover', function (e) {
      if (!drag) return;
      e.preventDefault(); clear();
      if (drag.kind === 'sp') {
        var sp = e.target.closest('.sp');
        if (sp) {
          var r = sp.getBoundingClientRect();
          var inBoard = !!sp.closest('.col');
          sp.classList.add(inBoard ? (e.clientY < r.top + r.height / 2 ? 'ins-t' : 'ins-b') : (e.clientX < r.left + r.width / 2 ? 'ins-l' : 'ins-r'));
          drag.to = { c: +sp.dataset.c, s: +sp.dataset.s + ((inBoard ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2) ? 1 : 0) };
          return;
        }
        var cat = e.target.closest('.cat,.col');
        if (cat) {
          var ci = +cat.dataset.c;
          cat.classList.add('into');
          var box = cat.querySelector('.grid,.list');
          if (box) box.classList.add('empty-over');
          drag.to = { c: ci, s: CATS[ci].sp.length };
        }
      } else {
        var cat2 = e.target.closest(drag.board ? '.col' : '.cat');
        if (!cat2) return;
        var r2 = cat2.getBoundingClientRect();
        var after = drag.board ? e.clientX > r2.left + r2.width / 2 : e.clientY > r2.top + Math.min(r2.height / 2, 24);
        cat2.classList.add(drag.board ? (after ? 'ins-r' : 'ins-l') : (after ? 'over-bot' : 'over-top'));
        drag.to = +cat2.dataset.c + (after ? 1 : 0);
      }
    });
    root.addEventListener('drop', function (e) {
      if (!drag || drag.to == null) return;
      e.preventDefault();
      var ordinal = ['first', 'second', 'third', 'fourth', 'fifth'];
      if (drag.kind === 'sp') {
        var from = CATS[drag.c], item = from.sp.splice(drag.s, 1)[0];
        var c = drag.to.c, s = drag.to.s;
        if (c == drag.c && s > drag.s) s -= 1;
        CATS[c].sp.splice(s, 0, item);
        CATS[c].min = false;
        render(); persist();
        toast(root, c == drag.c ? item.n + ' moved to position ' + (s + 1) + ' in ' + CATS[c].name : item.n + ' moved to ' + CATS[c].name + ', position ' + (s + 1));
      } else {
        var to = drag.to;
        var cat = CATS.splice(drag.c, 1)[0];
        if (to > drag.c) to -= 1;
        CATS.splice(to, 0, cat);
        render(); persist();
        toast(root, cat.name + ' is now ' + (ordinal[to] || ('#' + (to + 1))));
      }
      drag = null;
    });
    render();
    if (openWanted) openCard(1, 3);
    var focusId = window.STATE && window.STATE.spaceFocusId;
    if (focusId && !openWanted) {
      CATS.forEach(function (c, ci) {
        c.sp.forEach(function (s, si) { if (String(s.id) === String(focusId)) openCard(ci, si); });
      });
    }
  }

  /* ---------- Signals detail ---------- */
  function signalsDetailHtml(open) {
    var F = window.REDESIGN_FIXTURE || {};
    var live = !fixtureOn();
    var S = window.STATE || {};
    var need = ((S.mailNeed && S.mailNeed.length) ? S.mailNeed : (S.mail || []).filter(function (m) { return m && (m.needsReply || m.needReply || m.unread); })).slice(0, 5);
    var owed = (S.meetingActions || []).filter(function (x) { return x && x.status !== 'done' && x.status !== 'dismissed' && x.status !== 'handled' && x.status !== 'tasked' && !x.done; }).slice(0, 8);
    var reach = ((S.reachOut && S.reachOut.length) ? S.reachOut : (S.contacts || []).filter(function (c) {
      var last = c.lastTouch || c.last_touch || '';
      if (!last) return !!c.nextAction;
      return (Date.now() - new Date(last).getTime()) / 86400000 >= 9;
    })).slice(0, 4);
    var news = ((S.newsItems && S.newsItems.length) ? S.newsItems : (S.news || [])).slice(0, 3);
    var finOk = !!S.finUnlocked;
    try { finOk = finOk || Number(sessionStorage.getItem('cr_fin_until') || 0) > Date.now(); } catch (e) {}
    var raise = finOk && S.finance ? String(S.finance.raiseLabel || '-') : '-';
    var now = new Date();
    var hh = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
    var since = '08:00';
    if (fixtureOn() || qFlag('sigdetail')) {
      return designSignalsHtml(open, hh);
    }
    function contactName(raw) {
      var s = String(raw || '').trim();
      var email = (s.match(/<([^>]+)>/) || [])[1] || (/@/.test(s) ? s : '');
      var local = email ? email.split('@')[0] : '';
      var people = [].concat(S.contacts || [], S.people || []);
      var hit = people.filter(function (c) {
        var e = String(c.email || c.addr || '').toLowerCase();
        return (email && e === email.toLowerCase()) || (local && e.split('@')[0] === local.toLowerCase()) || String(c.name || '').toLowerCase() === s.toLowerCase();
      })[0];
      if (hit && hit.name) return hit.name;
      var quoted = s.match(/^"?([^"<]+?)"?\s*</);
      if (quoted) return quoted[1].trim();
      if (email && s.indexOf('@') >= 0 && s.indexOf(' ') < 0) return s.split('@')[0];
      return s.replace(/<[^>]+>/g, '').trim() || s;
    }
    function mailReason(m) {
      return String(m.why || m.reason || m.subject || m.preview || m.snippet || m.body || '').replace(/\s+/g, ' ').trim() || 'Needs a reply.';
    }
    var nNeed = need.length + owed.length + reach.length;
    window.__signalsNeedCount = nNeed;
    var first = [];
    if (need[0]) first.push({ t: 'Reply to ' + contactName(need[0].from || need[0].name || 'inbox'), r: mailReason(need[0]), act: 'Reply', go: 'mail-reply', id: need[0].id });
    if (reach[0]) first.push({ t: (reach[0].name || 'Reach out'), r: String(reach[0].nextAction || reach[0].why || reach[0].context || 'No recent touch — send one line today.'), act: 'Email', go: 'pipe-reach', id: reach[0].id });
    if (owed[0]) first.push({ t: owed[0].title || owed[0].text || 'Meeting follow-up', r: String(owed[0].meeting || owed[0].why || owed[0].context || 'From the last meeting.'), act: '+ Today', go: 'owed-today', id: owed[0].id });
    function itemRow(b, p, acts) {
      return '<div class="it"><div><b>' + esc(b) + '</b><p>' + esc(p) + '</p></div><div class="r">' + acts + '</div></div>';
    }
    var body =
      '<div class="now" data-sec="need"><h3>Do these first</h3>' + first.map(function (x, i) {
        return '<div class="nowi"><span class="k">' + (i + 1) + '</span><div><b>' + esc(x.t) + '</b><span>' + esc(x.r) + '</span></div><button class="act pri" data-action="' + x.go + '" data-id="' + esc(x.id || '') + '">' + esc(x.act) + '</button></div>';
      }).join('') + '</div>'
      + '<div class="sec" data-sec="need"><h3>Needs you</h3><span class="s">open a row to see the actual items</span><span class="go" data-action="signals-go" data-dest="mail">All in Email</span></div>'
      + '<div class="grpx open" data-sec="need"><div class="gh" data-action="sig-toggle"><i style="background:#e0364f"></i><div><b>Inbox</b> <span>' + need.length + ' need a reply</span></div><em></em><span class="ar">Hide</span></div><div class="items">'
      + (need.map(function (m) { return itemRow(contactName(m.from || m.name || 'Mail'), m.subject || m.preview || '', '<button class="act" data-action="mail-open" data-id="' + esc(m.id || '') + '">Open</button><button class="act pri" data-action="mail-reply" data-id="' + esc(m.id || '') + '">Reply</button>'); }).join('') || '<div class="it"><div><b>None</b><p>Inbox is clear.</p></div></div>')
      + '</div></div>'
      + '<div class="grpx" data-sec="need"><div class="gh" data-action="sig-toggle"><i style="background:#e0364f"></i><div><b>Owed from meetings</b> <span>' + owed.length + ' open</span></div><em></em><span class="ar">Show</span></div><div class="items">'
      + owed.map(function (o) { return itemRow(o.title || o.text || 'Action', o.meeting || '', '<button class="act" data-action="owed-today" data-id="' + esc(o.id || '') + '">+ Today</button><button class="act" data-action="owed-done" data-id="' + esc(o.id || '') + '">Done</button>'); }).join('')
      + '</div></div>'
      + '<div class="grpx" data-sec="need"><div class="gh" data-action="sig-toggle"><i style="background:#c98408"></i><div><b>Reach out</b> <span>' + reach.length + '</span></div><em>from Pipeline</em><span class="ar">Show</span></div><div class="items">'
      + reach.map(function (r) { return itemRow(r.name || 'Person', r.nextAction || '', '<button class="act pri" data-action="signals-go" data-dest="pipe">Open</button>'); }).join('')
      + '</div></div>'
      + '<div class="sec" data-sec="news"><h3>News that touches 4orm</h3><span class="s">Canada only</span><span class="go" data-action="signals-go" data-dest="news">All news</span></div>'
      + news.map(function (n) {
        return '<div class="news" data-sec="news"><div class="tg"><span>News</span><small>' + esc(n.source || '') + '</small></div><h4>' + esc(n.title || '') + '</h4><p class="why"><b>Why it matters:</b> ' + esc(n.why || n.summary || n.excerpt || '') + '</p><div class="r"><button class="act pri" data-action="news-space" data-id="' + esc(n.id || '') + '">Add to a Space</button><button class="act" data-action="news-save" data-id="' + esc(n.id || '') + '">Save</button><a class="act" data-action="news-source" href="' + esc(n.url || '#') + '" target="_blank" rel="noopener noreferrer">Source</a></div></div>';
      }).join('')
      + '<div class="sec" data-sec="watch"><h3>Watch</h3><span class="s">numbers that should move this week</span></div>'
      + '<div class="watch" data-sec="watch"><div class="row"><b>Raise</b><span>' + esc(raise) + '</span><button class="act" data-action="signals-go" data-dest="finance">Financials</button></div></div>'
      + '<div class="watch" data-sec="watch"><div class="row"><b>Integrations</b><span>check connected services</span><button class="act" data-action="signals-go" data-dest="int">Fix</button></div></div>';
    return '<div class="sig' + (open ? ' on' : '') + '" id="sig" role="dialog" aria-label="Signals">'
      + '<div class="sh"><b>Signals</b><span class="s">' + nNeed + ' need you &middot; checked ' + hh + ' &middot; every 15 s</span><button class="x" data-action="signals-close">Close</button></div>'
      + '<div class="tabs" id="tabs"><span class="on" data-action="sig-tab" data-f="all">All</span><span data-action="sig-tab" data-f="need">Needs you<i>' + nNeed + '</i></span><span data-action="sig-tab" data-f="new">New since ' + since + '</span><span data-action="sig-tab" data-f="news">News<i>' + news.length + '</i></span><span data-action="sig-tab" data-f="watch">Watch</span></div>'
      + '<div class="body">' + body + '</div>'
      + '<div class="sf">Every row opens the page it came from. Nothing here sends on its own.<button class="act" data-action="sig-seen">Mark all seen</button></div></div>'
      + '<div class="scrim' + (open ? ' on' : '') + '" id="scrim" data-action="signals-close"></div>';
  }

  function designSignalsHtml(open, hh) {
    hh = hh || '14:05';
    return '<div class="bar"><h1>War Room</h1></div><div class="ghostcard"></div><div class="ghostcard"></div><div class="ghostcard"></div>'
      + '<div class="scrim on" id="scrim" data-action="signals-close"></div>'
      + '<aside class="sig on" id="sig" role="dialog" aria-label="Signals">'
      + '<div class="sh"><b>Signals</b><span class="s">6 need you &middot; checked 14:05 &middot; every 15 s</span><button class="x" data-action="signals-close">Close</button></div>'
      + '<div class="tabs" id="tabs"><span class="on" data-action="sig-tab" data-f="all">All</span><span data-action="sig-tab" data-f="need">Needs you<i>6</i></span><span data-action="sig-tab" data-f="new">New since 08:00<i>3</i></span><span data-action="sig-tab" data-f="news">News<i>3</i></span><span data-action="sig-tab" data-f="watch">Watch<i>2</i></span></div>'
      + '<div class="body">'
      + '<div class="now" data-sec="need"><h3>Do these first</h3>'
      + '<div class="nowi"><span class="k">1</span><div><b>Reply to Bow Valley Credit Union</b><span>They asked for the compliance requirements before Thursday 10:00. Meeting is booked, so a late reply costs the meeting.</span></div><button class="act pri" data-action="mail-reply">Reply</button></div>'
      + '<div class="nowi"><span class="k">2</span><div><b>Kevin Wong: confirm the $25K wire</b><span>He said "wiring Thursday". Send the subscription docs today so Thursday holds.</span></div><button class="act pri" data-action="mail-compose">Send docs</button></div>'
      + '<div class="nowi"><span class="k">3</span><div><b>Mench Capital is going cold</b><span>9 days since their questions on capture rate. One line plus the one-pager answers it.</span></div><button class="act" data-action="signals-go" data-dest="pipe">Nudge</button></div></div>'
      + '<div class="sec" data-sec="need"><h3>Needs you</h3><span class="s">open a row to see the actual items</span><span class="go" data-action="signals-go" data-dest="mail">All in Email</span></div>'
      + '<div class="grpx open" data-sec="need"><div class="gh" data-action="sig-toggle"><i style="background:#e0364f"></i><div><b>Inbox</b> <span>5 need a reply</span></div><em>oldest 2d</em><span class="ar">Hide</span></div><div class="items">'
      + '<div class="it"><div><b>Bow Valley Credit Union</b><span class="age red">1d</span><p>Follow-up from Thursday\'s call - compliance requirements</p></div><div class="r"><button class="act" data-action="mail-open">Open</button><button class="act pri" data-action="mail-reply">Reply</button></div></div>'
      + '<div class="it"><div><b>Bruce Fair</b><span class="age red">1h</span><p>RE: Pitch Deck - I cannot open in PPT</p></div><div class="r"><button class="act" data-action="mail-open">Open</button><button class="act pri" data-action="mail-reply">Reply</button></div></div>'
      + '<div class="it"><div><b>CLHIA Affiliates</b><span class="age amb">9h</span><p>Wants the insurer list</p></div><div class="r"><button class="act" data-action="mail-open">Open</button><button class="act pri" data-action="mail-reply">Reply</button></div></div>'
      + '<div class="it"><div><b>Mike Gardner</b><span class="age amb">2d</span><p>Re: 4orm Finance - Overview for Investors</p></div><div class="r"><button class="act" data-action="mail-open">Open</button><button class="act pri" data-action="mail-reply">Reply</button></div></div>'
      + '<div class="it"><div><b>Ashish Dhir</b><span class="age amb">2d</span><p>Settlement finality - next step?</p></div><div class="r"><button class="act" data-action="mail-open">Open</button><button class="act pri" data-action="mail-reply">Reply</button></div></div>'
      + '</div></div>'
      + '<div class="grpx" data-sec="need"><div class="gh" data-action="sig-toggle"><i style="background:#e0364f"></i><div><b>Owed from meetings</b> <span>8 open</span></div><em>3 due today</em><span class="ar">Show</span></div><div class="items">'
      + '<div class="it"><div><b>Send Dean the wallet setup steps</b><span class="age red">due today</span><p>Dean and Chad weekly call &middot; Oct 23</p></div><div class="r"><button class="act" data-action="owed-today">+ Today</button><button class="act" data-action="owed-done">Done</button></div></div>'
      + '<div class="it"><div><b>Share the insurer list with CLHIA</b><span class="age red">due today</span><p>CLHIA intro &middot; Oct 22</p></div><div class="r"><button class="act" data-action="owed-today">+ Today</button><button class="act" data-action="owed-done">Done</button></div></div>'
      + '<div class="it"><div><b>Book the Enrich discovery call</b><span class="age amb">3d</span><p>Pipeline review &middot; Oct 21</p></div><div class="r"><button class="act" data-action="signals-go" data-dest="calendar">Book</button><button class="act" data-action="owed-done">Done</button></div></div>'
      + '</div></div>'
      + '<div class="grpx" data-sec="need"><div class="gh" data-action="sig-toggle"><i style="background:#c98408"></i><div><b>Reach out</b> <span>4 today</span></div><em>from Pipeline</em><span class="ar">Show</span></div><div class="items">'
      + '<div class="it"><div><b>Kevin Wong</b><p>VC &middot; call about the $25K</p></div><div class="r"><button class="act pri" data-action="signals-go" data-dest="pipe">Call</button></div></div>'
      + '<div class="it"><div><b>Joe Canavan</b><p>VC &middot; angel &middot; email</p></div><div class="r"><button class="act pri" data-action="mail-compose">Email</button></div></div>'
      + '<div class="it"><div><b>Enrich Mortgage Group</b><p>Design partner &middot; discovery call to book</p></div><div class="r"><button class="act pri" data-action="signals-go" data-dest="calendar">Book</button></div></div>'
      + '<div class="it"><div><b>BCFSA</b><p>Regulator &middot; intro meeting requested Oct 1</p></div><div class="r"><button class="act pri" data-action="signals-go" data-dest="pipe">Nudge</button></div></div>'
      + '</div></div>'
      + '<div class="grpx" data-sec="need"><div class="gh" data-action="sig-toggle"><i style="background:#c98408"></i><div><b>Going cold</b> <span>3 people</span></div><em>no touch 9 to 21 days</em><span class="ar">Show</span></div><div class="items">'
      + '<div class="it"><div><b>BCFSA</b><span class="age red">21d</span><p>Regulator &middot; last: intro request</p></div><div class="r"><button class="act" data-action="signals-go" data-dest="pipe">Nudge</button></div></div>'
      + '<div class="it"><div><b>Dean Hesse</b><span class="age amb">16d</span><p>Advisor &middot; offered investor intros</p></div><div class="r"><button class="act" data-action="mail-compose">Email</button></div></div>'
      + '<div class="it"><div><b>Mench Capital</b><span class="age amb">9d</span><p>Investor &middot; questions on capture rate</p></div><div class="r"><button class="act" data-action="mail-reply">Reply</button></div></div>'
      + '</div></div>'
      + '<div class="sec" data-sec="new"><h3>New since 08:00</h3><span class="s">what changed while you worked</span></div>'
      + '<div class="grpx" data-sec="new"><div class="gh" data-action="sig-toggle"><i style="background:#2e6bf2"></i><div><b>Pipeline</b> <span>2 moved</span></div><em>11:40</em><span class="ar">Show</span></div><div class="items">'
      + '<div class="it"><div><b>Bow Valley CU</b><p>Contact made ' + String.fromCharCode(8594) + ' Meeting booked &middot; Thu 10:00</p></div><div class="r"><button class="act" data-action="signals-go" data-dest="pipe">Open</button></div></div>'
      + '<div class="it"><div><b>Enrich Mortgage Group</b><p>Cold ' + String.fromCharCode(8594) + ' Contact made</p></div><div class="r"><button class="act" data-action="signals-go" data-dest="pipe">Open</button></div></div></div></div>'
      + '<div class="grpx" data-sec="new"><div class="gh" data-action="sig-toggle"><i style="background:#12a36a"></i><div><b>Zoom</b> <span>notes ready</span></div><em>12:15</em><span class="ar">Show</span></div><div class="items"><div class="it"><div><b>Don and Chad 1on1</b><p>2 actions owed &middot; summary ready</p></div><div class="r"><button class="act" data-action="signals-go" data-dest="owed">Read</button></div></div></div></div>'
      + '<div class="grpx" data-sec="new"><div class="gh" data-action="sig-toggle"><i style="background:#2e6bf2"></i><div><b>LinkedIn</b> <span>7 new messages</span></div><em>people only</em><span class="ar">Show</span></div><div class="items"><div class="it"><div><b>John Peter Blanco</b><p>Sr. Marketing Specialist, Acadium &middot; wants to connect</p></div><div class="r"><button class="act" data-action="signals-go" data-dest="mail">Open</button></div></div></div></div>'
      + '<div class="sec" data-sec="news"><h3>News that touches 4orm</h3><span class="s">Canada only &middot; 3 of 41 today</span><span class="go" data-action="signals-go" data-dest="news">All news</span></div>'
      + '<div class="news" data-sec="news"><div class="tg"><span class="reg">Regulator</span><small>FINTRAC &middot; 09:12</small></div><h4>FINTRAC fines four credit unions $816,750 for record-keeping failures</h4><p class="why"><b>Why it matters:</b> the gap is missing records of what was advised. That is the 4orm record. Use it in the BCFSA and Bow Valley conversations.</p><div class="r"><button class="act pri" data-action="news-space">Add to a Space</button><button class="act" data-action="news-save">Save</button><a class="act" href="https://fintrac-canafe.canada.ca" target="_blank" rel="noopener noreferrer">Source</a></div></div>'
      + '<div class="news" data-sec="news"><div class="tg"><span class="opp">Opportunity</span><small>CMT &middot; 07:40</small></div><h4>AI is making mortgage fraud harder to spot, brokers say</h4><p class="why"><b>Why it matters:</b> brokers want proof of what the client was told. A hook for Enrich and the Remax desk.</p><div class="r"><button class="act pri" data-action="news-space">Add to a Space</button><button class="act" data-action="news-save">Save</button><a class="act" href="https://canadianmortgagetrends.com" target="_blank" rel="noopener noreferrer">Source</a></div></div>'
      + '<div class="news" data-sec="news"><div class="tg"><span>Market</span><small>OSFI &middot; 06:05</small></div><h4>OSFI sets expectations for model risk in advice tools</h4><p class="why"><b>Why it matters:</b> a reviewable record is what OSFI is asking for. Good line for the investor update.</p><div class="r"><button class="act pri" data-action="news-space">Add to investor update</button><button class="act" data-action="news-save">Save</button><a class="act" href="https://www.osfi-bsif.gc.ca" target="_blank" rel="noopener noreferrer">Source</a></div></div>'
      + '<div class="sec" data-sec="watch"><h3>Watch</h3><span class="s">numbers that should move this week</span></div>'
      + '<div class="watch" data-sec="watch"><div class="row"><b>Raise</b><span>$80K of $250K &middot; $0 booked this week</span><button class="act" data-action="signals-go" data-dest="finance">Financials</button></div><div class="pbar"><i style="width:32%"></i></div><small>$170K to go &middot; 11 days to the close date &middot; 1 wire pending (Kevin, $25K)</small></div>'
      + '<div class="watch" data-sec="watch"><div class="row"><b>Integrations</b><span>1 needs attention</span><button class="act" data-action="signals-go" data-dest="int">Fix</button></div><small>Perplexity key not set, so Research in News and Spaces is off.</small></div>'
      + '</div><div class="sf">Every row opens the page it came from. Nothing here sends on its own.<button class="act" data-action="sig-seen">Mark all seen</button></div></aside>';
  }

  function paintSignalsDetailPage() {
    whenCss(function () {
      var wrap = wrapOf('warDesk');
      if (!wrap) return;
      if (P().applyPageCss) P().applyPageCss(wrap, 'signalsDetail');
      wrap.innerHTML = designSignalsHtml(true, '14:05');
      var btn = document.getElementById('signalsBtn');
      if (btn) {
        btn.classList.add('on');
        if (!btn.querySelector('.ct')) {
          var ct = document.createElement('span');
          ct.className = 'ct';
          ct.textContent = '6';
          btn.appendChild(ct);
        }
      }
      if (P().finishPaint) P().finishPaint(wrap);
      bindSignals(wrap.getRootNode ? wrap.getRootNode() : wrap);
      markReady('warDesk');
    });
  }

  window.paintSignalsOverlay = function (open) {
    if (qFlag('sigdetail')) return;
    var host = document.getElementById('sigHost');
    var btn = document.getElementById('signalsBtn');
    if (!host) return;
    if (!open) {
      host.classList.remove('on');
      host.setAttribute('hidden', '');
      host.innerHTML = '';
      if (btn) btn.classList.remove('on');
      return;
    }
    var html = fixtureOn() ? designSignalsHtml(true, '14:05') : signalsDetailHtml(true);
    if (html.indexOf('<div class="ghostcard') >= 0) {
      var cut = html.indexOf('<div class="scrim');
      if (cut < 0) cut = html.indexOf('<aside class="sig');
      if (cut >= 0) html = html.slice(cut);
    }
    if (!document.getElementById('sigCss')) {
      var link = document.createElement('link');
      link.id = 'sigCss';
      link.rel = 'stylesheet';
      link.href = '/port-css/signals-detail.css?v=4';
      document.head.appendChild(link);
    }
    host.className = '';
    host.innerHTML = html;
    host.classList.add('on');
    host.removeAttribute('hidden');
    var nNeed = window.__signalsNeedCount;
    if (nNeed == null) {
      var mNeed = html.match(/(\d+)\s+need you/);
      nNeed = mNeed ? Number(mNeed[1]) : 0;
    }
    if (btn) {
      btn.classList.add('on');
      var ct = btn.querySelector('.ct') || btn.querySelector('.n') || btn.querySelector('b');
      if (!ct) {
        ct = document.createElement('span');
        ct.className = 'ct';
        btn.appendChild(ct);
      }
      ct.textContent = String(nNeed);
    }
    if (typeof window.bindShadowActions === 'function') window.bindShadowActions(document);
    bindSignals(host);
  };
  window.closeSignalsPanel = function () { window.paintSignalsOverlay(false); };
  window.openSignalsPanel = function () { window.paintSignalsOverlay(true); };

  var prevNotes = window.paintRedesignNotes;
  window.paintRedesignNotes = function () {
    whenCss(function () {
      var S0 = window.STATE || {};
      var stored = String(S0.notesView || (function () { try { return localStorage.getItem('cr_notes_view') || ''; } catch (e) { return ''; } })());
      var canvasOn = qFlag('canvas') || (!qFlag('open') && !qFlag('board') && stored !== 'board' && (!fixtureOn() || qFlag('canvas')));
      if (fixtureOn() && !qFlag('canvas')) canvasOn = false;
      if (qFlag('board')) canvasOn = false;
      if (!fixtureOn() && !stored && !qFlag('open') && !qFlag('board')) canvasOn = true;
      if (canvasOn) paintNotesCanvasPage();
      else if (typeof prevNotes === 'function') prevNotes();
    });
  };
  var prevSpaces = window.paintRedesignSpaces;
  window.paintRedesignSpaces = function () {
    whenCss(function () {
      var panel = !!(window.STATE && window.STATE.pkg && window.STATE.pkg.id);
      var spaceQ = qParam('space');
      if (spaceQ === '1' && typeof prevSpaces === 'function') { prevSpaces(); return; }
      if (spaceQ === 'open' || qFlag('cards') || (!fixtureOn() && !panel)) {
        paintSpacesCardsPage(spaceQ === 'open');
        return;
      }
      if (qFlag('arrange') && !panel) paintSpacesArrangePage();
      else if (typeof prevSpaces === 'function') prevSpaces();
    });
  };
  var prevWar = window.paintRedesignWar;
  window.paintRedesignWar = function () {
    whenCss(function () {
      if (qFlag('sigdetail')) paintSignalsDetailPage();
      else if (typeof prevWar === 'function') prevWar();
    });
  };

  var prevSig = P().signalsHtml;
  if (P()) {
    P().signalsHtml = function (data, open) {
      if (!fixtureOn() || qFlag('sigdetail')) return signalsDetailHtml(open);
      return prevSig ? prevSig(data, open) : '';
    };
  }

  function bindSignals(root) {
    if (!root || root.__sigBound) return;
    root.__sigBound = true;
    root.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-action="sig-toggle"]');
      if (t) {
        var g = t.parentNode;
        g.classList.toggle('open');
        var ar = t.querySelector('.ar');
        if (ar) ar.textContent = g.classList.contains('open') ? 'Hide' : 'Show';
      }
      var tab = e.target.closest && e.target.closest('[data-action="sig-tab"]');
      if (tab) {
        var f = tab.getAttribute('data-f');
        var scope = tab.getRootNode();
        scope.querySelectorAll('#tabs span').forEach(function (s) { s.classList.toggle('on', s === tab); });
        scope.querySelectorAll('[data-sec]').forEach(function (x) { x.style.display = (f === 'all' || x.getAttribute('data-sec') === f) ? '' : 'none'; });
      }
      if (e.target.closest && e.target.closest('[data-action="sig-seen"]')) {
        try { localStorage.setItem('cr_sig_seen', String(Date.now())); } catch (err) {}
        var S = window.STATE || {};
        S.signalsOpen = false;
        if (typeof window.paintSignalsOverlay === 'function') window.paintSignalsOverlay(false);
      }
    });
  }

  function plannerMode() {
    try {
      var q = new URLSearchParams(location.search || '');
      if (q.get('view') === 'war' || q.get('steps') === '1' || q.get('signals') === '1' || q.get('select') === '1' || q.get('sigdetail') === '1') return false;
      if (q.get('view') === 'planner' || q.get('view') === 'timeline') return true;
      if (/\/(planner|timeline)/.test(location.pathname || '')) return true;
    } catch (e) {}
    return !fixtureOn();
  }
  var plannerCache = { items: null, inflight: null, painted: 0 };
  function paintPlannerLive(opts) {
    opts = opts || {};
    var wrap = wrapOf('warDesk');
    if (!wrap) { markReady('warDesk'); return; }
    if (P().applyPageCss) P().applyPageCss(wrap, 'planner');
    function go(items) {
      wrap.innerHTML = window.__plannerBody || '<div class="page"><h1>Planner</h1></div>';
      wrap.querySelectorAll('[data-act],[data-pop],[data-zoom],[data-toggle],[data-chip]').forEach(function (el) {
        if (!el.getAttribute('data-action')) el.setAttribute('data-action', el.getAttribute('data-act') || el.getAttribute('data-pop') || el.getAttribute('data-zoom') || 'planner');
      });
      var h1 = wrap.querySelector('h1');
      if (h1) h1.textContent = 'Planner';
      try {
        if (typeof window.bindPlannerPage === 'function') window.bindPlannerPage(wrap, items || null);
      } catch (err) {
        wrap.setAttribute('data-planner-err', String((err && err.message) || err));
      }
      if (P().finishPaint) P().finishPaint(wrap);
      markReady('warDesk');
      plannerCache.painted = Date.now();
    }
    function fail() {
      wrap.innerHTML = '<div class="page"><h1>Planner</h1><div class="card" style="padding:24px">Couldn\'t load - <span class="lnk" data-action="planner-retry">Retry</span></div></div>';
      markReady('warDesk');
    }
    if (fixtureOn() || !window.authFetch) { go(null); return; }
    if (!opts.force && plannerCache.items && wrap.querySelector('.page') && Date.now() - plannerCache.painted < 14000) {
      go(plannerCache.items);
      return;
    }
    if (plannerCache.inflight) { plannerCache.inflight.then(function (items) { if (items) go(items); else fail(); }); return; }
    if (!wrap.querySelector('.page')) {
      wrap.innerHTML = '<div class="page"><h1>Planner</h1><div class="ghostcard"></div><div class="ghostcard"></div><div class="ghostcard"></div></div>';
    }
    plannerCache.inflight = window.authFetch('/api/timeline', { credentials: 'same-origin', quiet: true }).then(function (r) {
      if (!r || !r.ok) throw new Error('load');
      return r.json();
    }).then(function (d) {
      plannerCache.items = (d && d.items) || [];
      plannerCache.inflight = null;
      go(plannerCache.items);
      return plannerCache.items;
    }).catch(function () {
      plannerCache.inflight = null;
      fail();
      return null;
    });
  }
  window.__plannerRetry = function () { paintPlannerLive({ force: true }); };
  var _paintWar = window.paintRedesignWar;
  window.paintRedesignWar = function () {
    if (plannerMode()) { whenCss(function () { paintPlannerLive({ force: plannerCache.painted && (Date.now() - plannerCache.painted > 14000) }); }); return; }
    if (typeof _paintWar === 'function') _paintWar();
  };
  if (plannerMode()) whenCss(function () { paintPlannerLive({ force: true }); });
  if (qFlag('canvas')) whenCss(paintNotesCanvasPage);
  if (qFlag('arrange')) paintSpacesArrangePage();
  if (qFlag('cards') || qParam('space') === 'open') paintSpacesCardsPage(qParam('space') === 'open');
  if (qFlag('sigdetail')) paintSignalsDetailPage();
  if (!fixtureOn() && typeof window.authFetch === 'function') {
    window.authFetch('/api/notes/clusters', { credentials: 'same-origin', quiet: true }).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (d) {
      if (d && d.clusters && window.STATE) window.STATE.noteClusters = d.clusters;
    }).catch(function () {});
  }
})();
