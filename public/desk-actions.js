/* Delegated data-action bus for redesign shadow pages.
   Bind once per shadow root. Survives innerHTML re-paints. */
(function () {
  var CONTROL_SEL = [
    'button', 'a', 'input', 'textarea', 'select', '[contenteditable="true"]',
    '[draggable="true"]', '[role="button"]',
    '.lnk', '.chip', '.cb', '.go', '.eye', '.more', '.rb', '.join', '.bell',
    '.plus', '.rr', '.slot', '.vb', '.coachbtn', '.exp', '.cr', '.tm span',
    '.tabs span', '.tab', '.x', '.pin', '.cvt', '.task', '.note', '.tile',
    '.hb1', '.hb2', '.do', '.add button', '.capture button', '.newcard', '.seg span',
    '.conv', '.ic', '.mv', '.join', '.bell',
    '.pl', '.st', '.act', '.op', '.dr', '.addcard', '.gh', '.ms', '.fd', '.fl',
    '.sr', '.build', '.ml', '.newcol', '.send', '.send2', '.car', '.pcard', '.chip', '.nxa', '.m',
    '.pad', '.add', '.calbtn', '.day', '.ev', '.views span', '.c-nav span', '.dest em',
    '.b1', '.b2', '.cals label', '.ar span', '.ok b', '.beat', '.recbtn', '.gobtn',
    '.ib', '.op', '.mc', '.pill', '.nt', '.cdot', '.nx',
    '.stp .s', '.stp .addst', '.stp a', '.nbig .ntools span', '.nbig .cols i', '.nbig .nb', '.car'
  ].join(',');
  var FOCUS_MS = 25 * 60 * 1000;
  var RING_C = 2 * Math.PI * 48;
  var comingSoon = window.__deskComingSoon || (window.__deskComingSoon = []);
  var noteSaveTimer = 0;
  var searchTimer = 0;

  function fixtureOn() {
    try { return /(?:^|[?&])fixture=mockup(?:&|$)/.test(String(location.search || '')); } catch (e) { return false; }
  }
  function S() { return window.STATE || (window.STATE = {}); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }
  function api(url, opts) {
    opts = opts || {};
    var headers = Object.assign({}, opts.headers || {});
    if (opts.body && typeof FormData !== 'undefined' && opts.body instanceof FormData) {
      opts = Object.assign({}, opts, { headers: headers });
    } else if (opts.body && typeof opts.body !== 'string') {
      headers['content-type'] = headers['content-type'] || 'application/json';
      opts = Object.assign({}, opts, { body: JSON.stringify(opts.body), headers: headers });
    } else if (opts.headers) opts = Object.assign({}, opts, { headers: headers });
    opts.credentials = opts.credentials || 'same-origin';
    var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
    return fn(url, opts);
  }
  function ok(r) { if (!r || !r.ok) throw new Error('fail'); return r; }
  function json(r) { return r.json ? r.json() : r; }

  function toast(root, msg, undoFn) {
    var host = (root && root.getElementById && root !== document) ? root.getElementById('deskToast') : null;
    if (!host && root && root.nodeType === 11 && root.appendChild) {
      host = document.createElement('div');
      host.id = 'deskToast';
      host.className = 'desk-toast';
      root.appendChild(host);
    }
    var light = document.getElementById('actNote');
    var text = String(msg || '');
    function paint(el) {
      if (!el) return;
      el.hidden = false;
      el.classList.add('show');
      el.innerHTML = esc(text) + (undoFn ? ' <button type="button" data-action="toast-undo">Undo</button>' : '');
    }
    paint(host);
    if (light) {
      light.hidden = false;
      light.textContent = text;
      clearTimeout(toast.lightTimer);
      toast.lightTimer = setTimeout(function () { light.hidden = true; }, 4200);
    }
    window.__deskUndo = undoFn || null;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () {
      if (host) { host.classList.remove('show'); host.hidden = true; }
      if (light) light.hidden = true;
    }, 4200);
  }
  function soon(root, label) {
    var line = String(label || 'This control');
    if (comingSoon.indexOf(line) < 0) comingSoon.push(line);
    toast(root, 'Coming soon — ' + line);
  }
  function refresh(which) {
    if (which === 'war' && typeof window.paintRedesignWar === 'function') window.paintRedesignWar();
    if (which === 'notes' && typeof window.paintRedesignNotes === 'function') window.paintRedesignNotes();
    if (which === 'links' && typeof window.paintRedesignLinks === 'function') window.paintRedesignLinks();
    if (which === 'dash' && typeof window.paintRedesignDashboard === 'function') window.paintRedesignDashboard();
    if (which === 'pipe' && typeof window.paintRedesignPipeline === 'function') window.paintRedesignPipeline();
    if (which === 'spaces' && typeof window.paintRedesignSpaces === 'function') window.paintRedesignSpaces();
    if (which === 'docs' && typeof window.paintRedesignDocuments === 'function') window.paintRedesignDocuments();
    if (which === 'mail' && typeof window.paintRedesignEmail === 'function') window.paintRedesignEmail();
    if (which === 'play' && typeof window.paintRedesignPlaybook === 'function') window.paintRedesignPlaybook();
    if (which === 'cal' && typeof window.paintRedesignCalendar === 'function') window.paintRedesignCalendar();
    if (which === 'zoom' && typeof window.paintRedesignZoom === 'function') window.paintRedesignZoom();
    if (which === 'done' && typeof window.paintRedesignCompleted === 'function') window.paintRedesignCompleted();
    if (which === 'news' && typeof window.renderNews === 'function') window.renderNews((window.STATE && window.STATE.news) || []);
    if (window.__deskRefreshExt && typeof window.__deskRefreshExt[which] === 'function') { try { window.__deskRefreshExt[which](); } catch (err) {} }
    if (typeof window.paintShellNav === 'function') window.paintShellNav();
  }
  function go(view) {
    if (typeof window.switchView === 'function') window.switchView(view);
  }
  function moneyOn() {
    try { return localStorage.getItem('cr_show_money') === '1'; } catch (e) { return false; }
  }
  function setMoney(on) {
    try { localStorage.setItem('cr_show_money', on ? '1' : '0'); } catch (e) {}
    refresh('dash'); refresh('war');
  }
  function attr(el, name) { return el && el.getAttribute ? (el.getAttribute(name) || '') : ''; }
  function closestAction(el) {
    while (el && el.nodeType === 1) {
      if (el.getAttribute && el.getAttribute('data-action')) return el;
      el = el.parentElement;
    }
    return null;
  }
  function actionElFromEvent(e) {
    var path = e && e.composedPath ? e.composedPath() : [];
    var i, n;
    for (i = 0; i < path.length; i++) {
      n = path[i];
      if (!n || n.nodeType !== 1) continue;
      if (n.getAttribute && n.getAttribute('data-action')) return n;
      if (n === document || n === window) break;
    }
    return closestAction(e && e.target);
  }
  function rootOf(el, e) {
    if (el && el.getRootNode) {
      var r = el.getRootNode();
      if (r && r.nodeType === 11) return r;
    }
    if (e && e.composedPath) {
      var path = e.composedPath();
      for (var i = 0; i < path.length; i++) {
        if (path[i] && path[i].nodeType === 11) return path[i];
      }
    }
    return document;
  }
  function showOv(el, on) {
    if (!el) return;
    el.hidden = !on;
    el.classList.toggle('open', !!on);
    el.style.display = on ? 'flex' : 'none';
  }
  function closePop(root) {
    var pop = root && root.getElementById ? root.getElementById('deskPop') : null;
    if (pop) pop.remove();
  }
  function openPop(root, el, html) {
    closePop(root);
    if (!root) return;
    var box = document.createElement('div');
    box.id = 'deskPop';
    box.className = 'desk-pop';
    box.innerHTML = html;
    var host = (root.host) || document.body;
    var wrap = root.querySelector ? (root.querySelector('.port-body') || root) : root;
    wrap.appendChild(box);
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : { bottom: 80, left: 80, right: 80 };
    var hr = host.getBoundingClientRect ? host.getBoundingClientRect() : { top: 0, left: 0 };
    box.style.top = Math.max(8, r.bottom - hr.top + 6) + 'px';
    box.style.left = Math.max(8, r.left - hr.left) + 'px';
  }
  function writeOk() { return !fixtureOn(); }
  function peopleBoxList() {
    if (fixtureOn()) {
      var fx = window.REDESIGN_FIXTURE && window.REDESIGN_FIXTURE.email && window.REDESIGN_FIXTURE.email.people;
      if (fx && Array.isArray(fx.boxes)) return fx.boxes;
    }
    if (!S().emailBoxes) {
      try { S().emailBoxes = JSON.parse(localStorage.getItem('cr_email_boxes') || '[]'); } catch (e) { S().emailBoxes = []; }
    }
    return S().emailBoxes || [];
  }
  /* Stored box by id. With promote, a box built from live mail is copied into the stored list so edits persist. */
  function findPeopleBox(id, promote) {
    var list = peopleBoxList();
    var i;
    for (i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
    if (!promote || typeof window.__peopleState !== 'function') return null;
    var live = (window.__peopleState().boxes || []).filter(function (b) { return String(b.id) === String(id); })[0];
    if (!live) return null;
    var copy = { id: live.id, n: live.n, o: live.o, c: live.c, tags: (live.tags || []).slice(), addrs: (live.addrs || []).slice(), closed: !!live.closed };
    list.push(copy);
    return copy;
  }
  /* Only durable fields are stored; messages, files and counts always come from live mail. */
  function persistPeopleBoxes() {
    var list = peopleBoxList();
    if (fixtureOn()) return;
    var clean = list.map(function (b) {
      return { id: b.id, n: b.n, o: b.o || '', c: b.c || '#2e6bf2', tags: b.tags || [], addrs: b.addrs || [], closed: !!b.closed };
    });
    S().emailBoxes = list;
    try { localStorage.setItem('cr_email_boxes', JSON.stringify(clean)); } catch (e) {}
    if (writeOk()) api('/api/mail/boxes', { method: 'POST', body: { action: 'save', boxes: clean } }).catch(function () {});
  }

  /* ---------- focus timer ---------- */
  function focusState() {
    if (!window.__deskFocus) window.__deskFocus = { running: false, paused: false, end: 0, remain: FOCUS_MS, tick: null };
    return window.__deskFocus;
  }
  function mmss(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function warRoot() {
    var host = document.getElementById('warDesk');
    return host && host.shadowRoot ? host.shadowRoot : null;
  }
  function paintFocus() {
    var f = focusState();
    var root = warRoot();
    if (!root) return;
    var left = f.running && !f.paused ? Math.max(0, f.end - Date.now()) : (f.remain || FOCUS_MS);
    var b = root.querySelector('.ring b');
    if (b) b.textContent = mmss(left);
    var circ = root.querySelector('.ring circle:last-of-type');
    if (circ) {
      var used = 1 - (left / FOCUS_MS);
      circ.setAttribute('stroke-dashoffset', String(RING_C * used));
    }
    var goBtn = root.querySelector('[data-action="focus-toggle"]');
    if (goBtn) {
      if (f.running && !f.paused) goBtn.innerHTML = '&#10073;&#10073; Pause';
      else if (f.paused) goBtn.innerHTML = '&#9654; Resume';
      else goBtn.innerHTML = '&#9654; Start 25-min focus';
    }
    var stop = root.querySelector('[data-action="focus-stop"]');
    if (stop) stop.hidden = !(f.running || f.paused);
  }
  function logFocusBlock(root, mins) {
    if (!writeOk()) return Promise.resolve();
    var stamp = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
    var title = 'Focus block ' + (mins || 25) + ' min · ' + stamp;
    /* logged straight into Done today (status done), never as an open Today task */
    return api('/api/items', { method: 'POST', body: { title: title, area: 'other', priority: 'normal', due: new Date().toISOString() } })
      .then(ok).then(json).then(function (row) {
        if (row && row.id) {
          S().items = S().items || [];
          S().items.unshift(Object.assign({}, row, { status: 'done', updatedAt: Date.now() }));
          return patchItem(row.id, { status: 'done' }).catch(function () {}).then(function () { refresh('war'); return row; });
        }
        return row;
      }).then(function (row) {
        toast(root, 'Focus block logged', function () {
          if (!row || !row.id) return;
          api('/api/items', { method: 'PATCH', body: { id: row.id, status: 'dropped' } }).then(function () { refresh('war'); });
        });
      }).catch(function () { toast(root, 'Focus ended — could not log the block'); });
  }
  function tickFocus() {
    var f = focusState();
    if (!f.running || f.paused) return;
    if (f.end - Date.now() <= 0) {
      f.running = false; f.paused = false; f.remain = FOCUS_MS;
      clearInterval(f.tick); f.tick = null;
      paintFocus();
      logFocusBlock(warRoot());
      return;
    }
    paintFocus();
  }
  function startFocus(root) {
    var f = focusState();
    if (f.paused) {
      f.running = true; f.paused = false; f.end = Date.now() + (f.remain || FOCUS_MS);
    } else {
      f.running = true; f.paused = false; f.remain = FOCUS_MS; f.end = Date.now() + FOCUS_MS;
    }
    clearInterval(f.tick);
    f.tick = setInterval(tickFocus, 250);
    paintFocus();
    toast(root, '25-min focus started');
  }
  function pauseFocus(root) {
    var f = focusState();
    if (!f.running) return;
    f.paused = true; f.running = true;
    f.remain = Math.max(0, f.end - Date.now());
    clearInterval(f.tick); f.tick = null;
    paintFocus();
    toast(root, 'Focus paused');
  }
  function stopFocus(root, log) {
    var f = focusState();
    var ran = f.running || f.paused;
    var usedMs = FOCUS_MS - (f.running && !f.paused ? Math.max(0, f.end - Date.now()) : (f.remain || FOCUS_MS));
    f.running = false; f.paused = false; f.remain = FOCUS_MS; f.end = 0;
    clearInterval(f.tick); f.tick = null;
    paintFocus();
    if (ran && log && usedMs >= 5 * 60000) logFocusBlock(root, Math.round(usedMs / 60000));
    else if (ran) toast(root, 'Focus stopped');
  }

  /* ---------- items / notes / links helpers ---------- */
  function addTask(title, bucket, extra) {
    title = String(title || '').trim();
    if (!title) return Promise.reject(new Error('empty'));
    var body = Object.assign({ title: title, area: 'other', priority: 'normal', column: bucket || 'today' }, extra || {});
    if (!writeOk()) {
      var tmp = { id: 'tmp-' + Date.now(), title: title, status: 'new', due: Date.now(), column: bucket || 'today' };
      S().items = S().items || []; S().items.unshift(tmp);
      var fx = window.REDESIGN_FIXTURE && window.REDESIGN_FIXTURE.war;
      var col = fx && fx[bucket || 'today'];
      if (col && col.tasks) {
        col.tasks.unshift({ id: tmp.id, title: title, tag: 'Ops' });
        col.count = (col.count || 0) + 1;
      }
      return Promise.resolve(tmp);
    }
    return api('/api/items', { method: 'POST', body: body }).then(ok).then(json).then(function (row) {
      S().items = S().items || [];
      if (row && row.id) S().items.unshift(row);
      return row;
    });
  }
  function localDueForColumn(column) {
    var key = String(column || '').toLowerCase();
    if (key === 'later') return null;
    if (key === 'today' || key === 'overdue') {
      var n = new Date();
      n.setHours(12, 0, 0, 0);
      return n.getTime();
    }
    if (key === 'week' || key === 'this week') return Date.now() + 3 * 86400000;
    return undefined;
  }
  function patchItem(id, body) {
    if (!id) return Promise.reject(new Error('id'));
    var extra = {};
    if (body && (body.column || body.bucket) && !Object.prototype.hasOwnProperty.call(body, 'due')) {
      var due = localDueForColumn(body.column || body.bucket);
      if (due !== undefined) extra.due = due;
      extra.column = body.column || body.bucket;
    }
    var next = Object.assign({}, body, extra);
    var localStamp = next.status ? { updatedAt: Date.now() } : {};
    S().items = (S().items || []).map(function (it) {
      return String(it.id) === String(id) ? Object.assign({}, it, next, localStamp) : it;
    });
    var fx = window.REDESIGN_FIXTURE && window.REDESIGN_FIXTURE.war;
    if (fx && next.column) {
      ['today', 'week', 'later', 'done'].forEach(function (key) {
        var col = fx[key];
        if (!col || !col.tasks) return;
        var hit = col.tasks.filter(function (t) { return String(t.id) === String(id); })[0];
        if (!hit) return;
        col.tasks = col.tasks.filter(function (t) { return String(t.id) !== String(id); });
        col.count = Math.max(0, (col.count || 0) - 1);
        var dest = fx[next.column] || fx[next.column === 'week' ? 'week' : next.column];
        if (dest && dest.tasks) {
          dest.tasks.unshift(hit);
          dest.count = (dest.count || 0) + 1;
        }
      });
    }
    if (!writeOk()) return Promise.resolve({});
    return api('/api/items', { method: 'PATCH', body: Object.assign({ id: id }, next) }).then(ok).then(json).then(function (row) {
      if (row && row.id) {
        S().items = (S().items || []).map(function (it) {
          return String(it.id) === String(id) ? Object.assign({}, it, row, { column: next.column || it.column }) : it;
        });
      }
      return row;
    });
  }
  function softDrop(id) {
    return patchItem(id, { status: 'dropped' });
  }
  /* ---------- War Room: "from Zoom" cards live in meeting_actions, not items ---------- */
  function isZoomCard(el, root, id) {
    var task = el && el.closest ? el.closest('.task') : null;
    if (!task && root && root.querySelector && id) task = root.querySelector('.task[data-id="' + String(id).replace(/"/g, '') + '"]');
    if (task && task.getAttribute('data-zoom') === '1') return true;
    return (S().meetingActions || []).some(function (a) { return a && String(a.id) === String(id); }) &&
      !(S().items || []).some(function (it) { return String(it.id) === String(id); });
  }
  function zoomCardTitle(id) {
    var hit = (S().meetingActions || []).filter(function (a) { return a && String(a.id) === String(id); })[0];
    return hit ? String(hit.text || hit.body || 'Meeting follow-up') : 'Meeting follow-up';
  }
  /* PATCH /api/meeting-actions/:id {status, column}. Falls back to the older
     POST /api/meeting-actions {id,status} (+ a client-side addTask for moves)
     only while the PATCH route is not deployed (404/405). */
  function zoomPatch(id, body) {
    S().zoomDismissed = S().zoomDismissed || {};
    if (!writeOk()) { S().zoomDismissed[id] = true; return Promise.resolve({}); }
    var title = zoomCardTitle(id);
    return api('/api/meeting-actions/' + encodeURIComponent(id), { method: 'PATCH', body: body }).then(function (r) {
      if (r && (r.status === 404 || r.status === 405)) {
        var legacy = body.status === 'dismissed' ? 'done' : (body.status || 'tasked');
        return api('/api/meeting-actions', { method: 'POST', body: { id: id, status: legacy } }).then(ok).then(json).then(function (d) {
          if (body.column) return addTask(title, body.column).then(function () { return d; });
          return d;
        });
      }
      return json(ok(r)).then(function (d) {
        if (d && d.item && d.item.id) { S().items = S().items || []; S().items.unshift(d.item); }
        else if (body.column && typeof window.loadBoard === 'function') setTimeout(window.loadBoard, 300);
        return d;
      });
    }).then(function (d) {
      S().zoomDismissed[id] = true;
      if (d && Array.isArray(d.actions)) S().meetingActions = d.actions;
      else S().meetingActions = (S().meetingActions || []).filter(function (a) { return String(a.id) !== String(id); });
      return d;
    });
  }
  function zoomRestore(id) {
    if (S().zoomDismissed) delete S().zoomDismissed[id];
    if (!writeOk()) return Promise.resolve();
    return api('/api/meeting-actions/' + encodeURIComponent(id), { method: 'PATCH', body: { status: 'open' } }).then(function (r) {
      if (r && (r.status === 404 || r.status === 405)) return api('/api/meeting-actions', { method: 'POST', body: { id: id, status: 'open' } });
      return r;
    }).then(function () {
      return api('/api/meeting-actions', { method: 'GET' }).then(ok).then(json).then(function (d) { if (d && d.actions) S().meetingActions = d.actions; });
    }).catch(function () {});
  }
  function fourmSound(kind) {
    try { if (window.FourmSound && typeof window.FourmSound[kind] === 'function') window.FourmSound[kind](); } catch (e) {}
  }
  /* Save a move's steps to item_plans (POST /api/plans, push:false keeps them off the deck). */
  function saveMoveSteps(id, steps) {
    var plans = S().plans || (S().plans = []);
    var prev = plans.filter(function (p) { return String(p.itemId) === String(id); })[0] || {};
    var next = { itemId: String(id), steps: steps, needs: prev.needs || [], draft: prev.draft || '' };
    S().plans = plans.filter(function (p) { return String(p.itemId) !== String(id); }).concat([next]);
    if (!writeOk()) return Promise.resolve(next);
    return api('/api/plans', { method: 'POST', body: { itemId: String(id), steps: steps.map(function (s) { return { text: s.text, done: !!s.done }; }), needs: next.needs, draft: next.draft, push: false } })
      .then(ok).then(json).then(function (d) {
        if (d && d.itemId) {
          S().plans = (S().plans || []).filter(function (p) { return String(p.itemId) !== String(id); }).concat([{ itemId: d.itemId, steps: d.steps || next.steps, needs: d.needs || next.needs, draft: d.draft != null ? d.draft : next.draft }]);
        }
        return d;
      });
  }
  function currentMoveSteps(id) {
    var moves = (S().ceo && S().ceo.moves) || [];
    var hit = moves.filter(function (m) { return String(m.id) === String(id); })[0];
    if (typeof window.__warMoveSteps === 'function') return window.__warMoveSteps(id, hit).map(function (s) { return { text: s.text, done: !!s.done }; });
    return [];
  }

  /* ---------- Notes: sticky meta is merged client-side too, so a PATCH never
     drops title/kind/checks even before the server-side merge ships ---------- */
  function stickyRow(id) {
    return (S().stickies || []).filter(function (n) { return String(n.id) === String(id); })[0] || null;
  }
  function boardNote(id) {
    return (S().notes || []).filter(function (n) { return String(n.id) === String(id); })[0] || null;
  }
  function patchStickyMeta(id, patch) {
    var row = stickyRow(id);
    var meta = Object.assign({}, (row && row.meta && typeof row.meta === 'object') ? row.meta : {}, patch);
    if (row) row.meta = meta;
    if (!writeOk()) return Promise.resolve();
    /* The server merges meta (coalesce(meta,'{}') || $meta), so only the changed keys are sent. */
    return api('/api/notes/' + encodeURIComponent(id), { method: 'PATCH', body: { meta: Object.assign({}, patch) } }).then(ok);
  }
  function createNoteCat(name) {
    var have = (S().noteCats || []).filter(function (c) { return c && typeof c === 'object' && String(c.name).toLowerCase() === String(name).toLowerCase(); })[0];
    if (have) return Promise.resolve(have);
    return api('/api/notes', { method: 'POST', body: { kind: 'category', name: name } }).then(ok).then(json).then(function (c) {
      if (!c || !c.id) throw new Error('cat');
      S().noteCats = (S().noteCats || []).concat([{ id: c.id, name: c.name || name, parentId: c.parentId || null, depth: c.depth || 0 }]);
      return c;
    });
  }
  function setNoteCategory(id, source, name) {
    if (source === 'sticky') return patchStickyMeta(id, { category: name || '' });
    var n = boardNote(id);
    var cat = (S().noteCats || []).filter(function (c) { return c && typeof c === 'object' && String(c.name).toLowerCase() === String(name || 'inbox').toLowerCase(); })[0];
    var catId = cat ? cat.id : null;
    if (n) n.catId = catId;
    if (!writeOk()) return Promise.resolve();
    return api('/api/notes', { method: 'PATCH', body: { id: id, catId: catId } }).then(ok);
  }
  /* ---------- Documents (rendering lives in redesign-pages-b.js; these run after its paint) ---------- */
  function docsRoot() {
    var host = document.getElementById('docsDesk');
    return host && host.shadowRoot ? host.shadowRoot : null;
  }
  function zoomDocFrame() {
    var root = docsRoot();
    var f = root && root.querySelector('.vstage iframe.docframe');
    if (!f) return;
    var z = S().docZoom || 1;
    f.style.transform = 'scale(' + z + ')';
    f.style.transformOrigin = 'top center';
  }
  function stepDoc(root, dir) {
    var r = docsRoot() || root;
    var cards = Array.prototype.slice.call(r.querySelectorAll('[data-action="doc-open"]')).filter(function (c) { return c.style.display !== 'none'; });
    if (!cards.length || !S().docOpen) return;
    var i = cards.map(function (c) { return attr(c, 'data-id'); }).indexOf(String(S().docOpen.id || ''));
    var next = cards[(i + dir + cards.length) % cards.length];
    if (next) actions['doc-open'](next, r);
  }
  /* Page arrows page through a stored PDF; when the page count is unknown they step to the next file. */
  function stepDocPage(root, dir) {
    var o = S().docOpen;
    var pages = Number(o && o.meta && o.meta.pages) || 0;
    if (!o || pages < 2) { stepDoc(root, dir); return; }
    o.page = Math.max(1, Math.min(pages, (Number(o.page) || 1) + dir));
    refresh('docs');
  }
  /* Undo for a dismissed / cancelled ranked move: DELETE the snooze, then repaint from the fresh CEO payload. */
  function unsnoozeMove(root, id) {
    if (!id || !writeOk()) return;
    api('/api/ceo/moves/' + encodeURIComponent(id) + '/snooze', { method: 'DELETE' }).then(ok).then(json).then(function (d) {
      if (d && typeof window.applyCeo === 'function') window.applyCeo(d);
      else if (typeof window.refreshCeo === 'function') window.refreshCeo();
      refresh('war');
      toast(root, 'Move is back');
    }).catch(function () {
      if (typeof window.refreshCeo === 'function') window.refreshCeo();
      toast(root, 'Could not bring that move back');
    });
  }
  function bulkMove(root, bucket) {
    var ids = Object.keys(S().execPicked || {});
    if (!ids.length) return;
    Promise.all(ids.map(function (id) {
      return isZoomCard(null, root, id) ? zoomPatch(id, { status: 'tasked', column: bucket }) : patchItem(id, { column: bucket });
    })).then(function () {
      S().execSelect = false; S().execPicked = {}; refresh('war'); toast(root, 'Moved to ' + (bucket === 'week' ? 'Week' : 'Later'));
    }).catch(function () { refresh('war'); toast(root, 'Could not move all of those tasks'); });
  }

  /* ---------- Documents: selection, Spaces, sets, Drive pull, large uploads ---------- */
  var DOC_SMALL = 3 * 1024 * 1024;
  function docRow(id) {
    return (S().staged || []).filter(function (d) { return String(d.id) === String(id); })[0] || null;
  }
  function docPicked() {
    var pick = S().docPick || {};
    return Object.keys(pick).filter(function (id) { return pick[id] && docRow(id); });
  }
  function reloadDocs() {
    if (typeof window.__portLoadB === 'function') window.__portLoadB('docs');
    else refresh('docs');
  }
  function docFolderNow() {
    var f = String(S().docFolder || '');
    return f && f !== 'All documents' ? f : 'Uncategorized';
  }
  function jsonOrThrow(r) {
    return r.json().catch(function () { return {}; }).then(function (d) {
      if (!r.ok || (d && d.saved === false)) throw new Error((d && d.error) || 'fail');
      return d;
    });
  }
  function errText(err, fallback) {
    return err && err.message && err.message !== 'fail' ? err.message : fallback;
  }
  /* A library card attaches as itself: a Drive file by its Drive id, a stored file by its library id (the server copies the bytes). */
  function docPayload(d) {
    var drive = String(d.driveFileId || d.drive || '');
    var isDrive = /^[\w-]{8,}$/.test(drive) && !UUID_RE.test(drive);
    var staged = UUID_RE.test(String(d.id || '')) ? String(d.id) : '';
    return { action: 'add-doc', name: d.name || 'File', url: isDrive ? (d.url || '') : '', mime: d.mime || '', driveFileId: isDrive ? drive : '', stagedId: staged };
  }
  function attachDocsToSpace(root, spaceId, docs, label) {
    docs = (docs || []).filter(Boolean);
    if (!docs.length) { toast(root, 'Pick a file first'); return Promise.resolve(false); }
    if (!writeOk()) { toast(root, 'Added to a Space (fixture)'); return Promise.resolve(false); }
    if (!UUID_RE.test(String(spaceId || ''))) { toast(root, 'Save the Space first, then add files'); return Promise.resolve(false); }
    var failed = 0;
    return docs.reduce(function (p, d) {
      return p.then(function () {
        return api('/api/spaces/' + encodeURIComponent(spaceId), { method: 'POST', body: docPayload(d) }).then(jsonOrThrow).catch(function () { failed += 1; });
      });
    }, Promise.resolve()).then(function () {
      reloadDocs();
      refresh('spaces');
      var n = docs.length - failed;
      var where = label || 'the Space';
      if (failed) toast(root, 'Added ' + n + ' of ' + docs.length + ' to ' + where);
      else toast(root, (docs.length === 1 ? 'Added to ' : 'Added ' + docs.length + ' files to ') + where);
      return !failed;
    });
  }
  function createSpaceNamed(name) {
    return api('/api/spaces', { method: 'POST', body: { name: name } }).then(jsonOrThrow).then(function (d) {
      var id = d && (d.id || (d.space && d.space.id) || (d.package && d.package.id));
      if (!UUID_RE.test(String(id || ''))) throw new Error('fail');
      return { id: id, name: d.name || name };
    });
  }
  function docsFor(kind) {
    if (kind === 'open') {
      var o = S().docOpen;
      return o ? [docRow(o.id) || { id: o.id, driveFileId: o.drive, name: o.name, url: o.url, mime: o.mime || '' }] : [];
    }
    return docPicked().map(docRow);
  }
  function spacePickHtml(kind) {
    var rows = (S().packages || []).filter(function (p) { return p && UUID_RE.test(String(p.id || '')); });
    return '<div style="font-weight:600;margin:2px 0 6px">Add to a Space</div>'
      + '<div style="max-height:280px;overflow:auto">' + (rows.length ? rows.slice(0, 80).map(function (p) {
        return '<button type="button" data-action="doc-space-pick" data-kind="' + kind + '" data-space="' + esc(p.id) + '" data-name="' + esc(p.name || 'Space') + '">' + esc(p.name || 'Space') + '</button>';
      }).join('') : '<div style="opacity:.7;padding:4px 0">No Spaces yet.</div>') + '</div>'
      + '<button type="button" data-action="doc-space-new" data-kind="' + kind + '">+ New Space</button>';
  }
  function setPickHtml() {
    var sets = S().docSets || [];
    return '<div style="font-weight:600;margin:2px 0 6px">Add to a set</div>'
      + (sets.length ? sets.map(function (s) {
        return '<button type="button" data-action="docs-set-pick" data-id="' + esc(s.id) + '" data-name="' + esc(s.name) + '">' + esc(s.name) + '</button>';
      }).join('') : '<div style="opacity:.7;padding:4px 0">No sets yet.</div>')
      + '<button type="button" data-action="docs-new-set">+ New set</button>';
  }
  function whenLabel(iso) {
    var t = Date.parse(String(iso || ''));
    if (!Number.isFinite(t)) return '';
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t)).replace(',', '');
    } catch (e) { return new Date(t).toISOString().slice(0, 16).replace('T', ' '); }
  }
  function searchDrive(root, q) {
    var list = root.querySelector && root.querySelector('.doc-drive-list');
    if (!list) return;
    var ask = ++searchDrive.n;
    list.textContent = 'Searching Drive…';
    api('/api/documents/drive?q=' + encodeURIComponent(q || ''), { method: 'GET' }).then(jsonOrThrow).then(function (d) {
      if (ask !== searchDrive.n) return;
      var files = (d && d.files) || [];
      S().docDriveHits = files;
      list.innerHTML = files.length ? files.map(function (f, i) {
        return '<button type="button" class="space-link-row" data-action="docs-drive-pick" data-i="' + i + '">' + esc(f.name) + '<small style="display:block;opacity:.6">' + esc(whenLabel(f.modified)) + '</small></button>';
      }).join('') : '<div style="opacity:.7;padding:4px 0">No Drive files match.</div>';
    }).catch(function (err) {
      if (ask === searchDrive.n) list.textContent = errText(err, 'Could not search Drive.');
    });
  }
  searchDrive.n = 0;
  window.__deskInputExt = window.__deskInputExt || {};
  window.__deskInputExt['docs-drive-q'] = function (el, root) {
    clearTimeout(searchDrive.timer);
    searchDrive.timer = setTimeout(function () { searchDrive(root, el.value || ''); }, 250);
  };
  function rawPut(url, blob) {
    var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
    return fn(url, { method: 'PUT', body: blob, headers: { 'content-type': 'application/octet-stream' }, credentials: 'same-origin' });
  }
  /* Files over 3 MB go straight to Drive in 2 MB parts through /api/documents/upload/drive. */
  function uploadToDrive(root, f, category) {
    toast(root, 'Sending ' + f.name + ' to Drive');
    return api('/api/documents/upload/drive', { method: 'POST', body: { name: f.name, mime: f.type || '', size: f.size, category: category } }).then(jsonOrThrow).then(function (start) {
      var chunk = Number(start.chunk) || 2097152;
      function send(offset, tries) {
        var part = f.slice(offset, Math.min(f.size, offset + chunk));
        return rawPut('/api/documents/upload/drive?id=' + encodeURIComponent(start.id) + '&offset=' + offset, part).then(jsonOrThrow).then(function (d) {
          if (d.done) return d;
          var next = Number(d.next) || 0;
          if (!(next > offset)) {
            if (tries >= 2) throw new Error('Drive stopped taking parts of ' + f.name + '.');
            return send(offset, tries + 1);
          }
          toast(root, f.name + ': ' + Math.round(next / f.size * 100) + '% sent');
          return send(next, 0);
        }, function (err) {
          if (tries >= 2) throw err;
          return send(offset, tries + 1);
        });
      }
      return send(0, 0);
    }).then(function () {
      reloadDocs();
      toast(root, f.name + ' uploaded to Drive');
    }).catch(function (err) { toast(root, errText(err, 'Could not upload ' + f.name)); });
  }
  function docMetaLoad(open) {
    if (!open || !writeOk()) return;
    var q = [];
    if (UUID_RE.test(String(open.id || ''))) q.push('id=' + encodeURIComponent(open.id));
    if (open.drive) q.push('drive=' + encodeURIComponent(open.drive));
    if (!q.length) return;
    api('/api/documents/meta?' + q.join('&'), { method: 'GET' }).then(jsonOrThrow).then(function (m) {
      if (!S().docOpen || S().docOpen !== open) return;
      open.meta = m;
      refresh('docs');
    }).catch(function () {
      if (S().docOpen === open) { open.meta = { failed: true }; refresh('docs'); }
    });
  }

  /* ---------- actions ---------- */
  var actions = {
    'coming-soon': function (el, root) { soon(root, attr(el, 'data-label') || (el.textContent || '').trim().slice(0, 60) || 'This control'); },
    'toast-undo': function (el, root) {
      var fn = window.__deskUndo;
      window.__deskUndo = null;
      if (typeof fn === 'function') fn();
      toast(root, 'Undone');
    },
    'show-money': function (el, root) { setMoney(!moneyOn()); toast(root, moneyOn() ? 'Figures visible' : 'Figures hidden'); },
    'coach-toggle': function (el, root) {
      var pop = root.getElementById && root.getElementById('coachpop');
      if (pop) pop.classList.toggle('open');
    },
    'capture-add': function (el, root) {
      var input = root.querySelector('[data-action="capture-input"]') || root.querySelector('.capture input');
      var title = input ? String(input.value || '').trim() : '';
      if (!title) { toast(root, 'Type something to capture'); return; }
      if (input && input.__adding) return;
      if (input) { input.__adding = true; input.value = ''; }
      return addTask(title, 'today').then(function () {
        if (input) input.__adding = false;
        refresh('war');
        toast(root, 'Added to Today');
      }).catch(function () {
        if (input) { input.__adding = false; if (!input.value) input.value = title; }
        toast(root, 'Could not add that item');
      });
    },
    'focus-toggle': function (el, root) {
      var f = focusState();
      if (f.running && !f.paused) pauseFocus(root);
      else startFocus(root);
    },
    'focus-stop': function (el, root) { stopFocus(root, true); },
    'hero-commit': function (el, root) {
      var id = attr(el, 'data-id');
      if (!id) { toast(root, 'No ranked move to commit yet'); return; }
      var day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
      var map = {};
      try { map = JSON.parse(localStorage.getItem('cr_needle') || '{}') || {}; } catch (e) { map = {}; }
      var undoMap = Object.assign({}, map);
      var off = map.one === id && map.day === day;
      if (off) { delete map.one; delete map.day; } else { map.one = id; map.day = day; }
      try { localStorage.setItem('cr_needle', JSON.stringify(map)); } catch (e) {}
      refresh('war');
      toast(root, off ? 'Uncommitted' : 'Committed as your one thing for today', function () {
        try { localStorage.setItem('cr_needle', JSON.stringify(undoMap)); } catch (e) {}
        refresh('war');
      });
    },
    'hero-plan': function (el, root) { actions['plan-open'](el, root); },
    'hero-cancel': function (el, root) {
      var id = attr(el, 'data-id');
      if (id && typeof window.ceoSnooze === 'function') {
        window.ceoSnooze(id);
        toast(root, 'Move cancelled', function () { unsnoozeMove(root, id); });
        return;
      }
      toast(root, 'No ranked move to cancel');
    },
    'move-do': function (el, root) {
      var id = attr(el, 'data-id');
      if (id && typeof window.ceoDo === 'function') { window.ceoDo(id); toast(root, 'Doing that move'); refresh('war'); return; }
      toast(root, 'No ranked move yet');
    },
    'move-steps': function (el, root) {
      var id = attr(el, 'data-id');
      if (!id) return;
      S().openSteps = S().openSteps === id ? '' : id;
      refresh('war');
    },
    'step-toggle': function (el, root) {
      var id = attr(el, 'data-id');
      var i = Number(attr(el, 'data-i'));
      if (!id) return;
      var steps = currentMoveSteps(id);
      if (!steps[i]) return;
      steps[i].done = !steps[i].done;
      var allDone = steps.length && steps.every(function (s) { return s.done; });
      fourmSound(steps[i].done ? (allDone ? 'levelUp' : 'pop') : 'none');
      var on = steps[i].done;
      var p = saveMoveSteps(id, steps);
      refresh('war');
      p.then(function () { toast(root, on ? 'Step done' : 'Step reopened'); })
        .catch(function () { toast(root, 'Could not save that step'); });
    },
    'step-act': function (el, root, ev) {
      if (ev) ev.stopPropagation();
    },
    'step-add': function (el, root) {
      var id = attr(el, 'data-id');
      if (!id) return;
      var text = window.prompt('Add a step');
      if (text == null) return;
      text = String(text).trim();
      if (!text) return;
      var steps = currentMoveSteps(id);
      steps.push({ done: false, text: text });
      S().openSteps = id;
      var p = saveMoveSteps(id, steps);
      refresh('war');
      p.then(function () { toast(root, 'Step added'); })
        .catch(function () { toast(root, 'Could not save that step'); });
    },
    'move-plan': function (el, root) { actions['plan-open'](el, root); },
    'move-dismiss': function (el, root) {
      var id = attr(el, 'data-id');
      if (id && typeof window.ceoSnooze === 'function') {
        window.ceoSnooze(id);
        toast(root, 'Move dismissed', function () { unsnoozeMove(root, id); });
        return;
      }
      soon(root, 'Dismiss move');
    },
    /* W53: Brain log = the CEO brain's decision log (ceo_decisions, sent by /api/ceo as decisions[]). */
    'brain-log': function (el, root, ev) {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      var rows = ((window.STATE && window.STATE.ceo && window.STATE.ceo.decisions) || []).slice(0, 20);
      function when(v) {
        var n = typeof v === 'number' ? v : Date.parse(v || '');
        if (!Number.isFinite(n)) return '';
        if (n < 1e12) n *= 1000;
        return new Date(n).toLocaleString('en-CA', { timeZone: 'America/Vancouver', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      }
      var html = '<div style="max-width:380px;max-height:360px;overflow:auto;padding:4px 6px"><b style="display:block;margin:2px 0 6px">Brain log</b>'
        + (rows.length ? rows.map(function (d) {
          return '<div style="padding:6px 0;border-top:1px solid #e6eaf2"><small style="opacity:.65">' + esc(when(d.createdAt)) + ' &middot; ' + esc(d.decision || '') + '</small>'
            + '<div>' + esc(d.context || '') + '</div>' + (d.caseAgainst ? '<small style="opacity:.75">Why: ' + esc(d.caseAgainst) + '</small>' : '') + '</div>';
        }).join('') : '<div style="opacity:.7">No decisions logged yet. Do or dismiss a ranked move and it shows here.</div>')
        + '</div>';
      openPop(root, el, html);
    },
    'moves-rerun': function (el, root) {
      if (typeof window.refreshCeo === 'function') { window.refreshCeo(); toast(root, 'Rebuilding ranked moves'); return; }
      if (!writeOk()) { toast(root, 'Re-run (fixture)'); return; }
      api('/api/ceo/refresh', { method: 'POST', body: {} }).then(ok).then(json).then(function () {
        toast(root, 'Moves rebuilt'); refresh('war');
      }).catch(function () { toast(root, 'Could not re-run moves'); });
    },
    'meeting-task': function (el, root) {
      var id = attr(el, 'data-id');
      var bucket = attr(el, 'data-bucket') || 'today';
      var title = attr(el, 'data-title') || 'Meeting follow-up';
      var req = id ? zoomPatch(id, { status: 'tasked', column: bucket }) : addTask(title, bucket);
      return req.then(function () { refresh('war'); toast(root, 'Added to ' + (bucket === 'week' ? 'This week' : 'Today')); })
        .catch(function () { toast(root, 'Could not create that item'); });
    },
    'review-meetings': function (el, root) {
      go('znotes');
      toast(root, 'Opening meeting notes');
    },
    'meet-join': function (el, root) {
      var url = attr(el, 'data-url');
      if (/^https?:\/\//i.test(url)) { window.open(url, '_blank', 'noopener'); return; }
      toast(root, 'No join link on that meeting');
    },
    'meet-prep': function (el, root) {
      go('znotes');
      toast(root, 'Prep that meeting');
    },
    'meet-bell': function (el, root) { toast(root, 'Alarm is on for that meeting'); },
    'find-slot': function (el, root) {
      if (!writeOk()) { go('calendar'); return; }
      api('/api/calendar/slots', { method: 'GET' }).then(ok).then(json).then(function (d) {
        var slot = (d.slots || [])[0];
        if (!slot) { toast(root, 'No open 30-min slot'); return; }
        var when = slot.start ? new Date(slot.start).toLocaleString() : 'soon';
        toast(root, 'Open slot: ' + when);
        go('calendar');
      }).catch(function () { go('calendar'); toast(root, 'Calendar slots unavailable — opened Calendar'); });
    },
    'reach-filter': function (el, root) {
      var kind = attr(el, 'data-kind') || 'all';
      S().reachKind = kind;
      root.querySelectorAll('[data-action="reach-filter"]').forEach(function (c) {
        c.classList.toggle('on', attr(c, 'data-kind') === kind);
      });
      root.querySelectorAll('[data-action="reach-done"]').forEach(function (row) {
        var wrap = row.closest('.rc');
        if (!wrap) return;
        var k = attr(wrap, 'data-kind') || attr(row, 'data-kind');
        wrap.style.display = (kind === 'all' || k === kind) ? '' : 'none';
      });
    },
    'reach-done': function (el, root) {
      var id = attr(el, 'data-id');
      var row = el.closest('.rc') || el;
      var on = !row.classList.contains('done');
      row.classList.toggle('done', on);
      el.classList.toggle('on', on);
      if (!id) { toast(root, on ? 'Marked contacted' : 'Unchecked'); return; }
      var prev = false;
      (S().reachOut || S().reach || []).forEach(function (p) { if (String(p.id) === id) { prev = !!p.done; p.done = on; } });
      if (!writeOk()) return;
      api('/api/reach-out/' + encodeURIComponent(id), { method: 'PATCH', body: { done: on } }).then(ok).then(function () {
        toast(root, on ? 'Marked contacted' : 'Still to reach', function () {
          api('/api/reach-out/' + encodeURIComponent(id), { method: 'PATCH', body: { done: prev } }).then(function () { refresh('war'); });
        });
      }).catch(function () { toast(root, 'Could not update that person'); });
    },
    'reach-add': function (el, root) { actions['reach-pick-open'](el, root); },
    'exec-add': function (el, root) {
      var bucket = attr(el, 'data-bucket') || 'today';
      var title = window.prompt('Task title');
      if (title == null) return;
      title = String(title).trim();
      if (!title) return;
      return addTask(title, bucket).then(function () { refresh('war'); toast(root, 'Card added'); })
        .catch(function () { toast(root, 'Could not add that card'); });
    },
    'exec-full': function (el, root) {
      var host = root.host || document.getElementById('warDesk');
      if (host) host.classList.toggle('desk-full');
      root.querySelectorAll('.exec').forEach(function (n) { n.classList.toggle('full'); });
      toast(root, host && host.classList.contains('desk-full') ? 'Execution full screen' : 'Exit full screen');
    },
    'task-done': function (el, root) {
      var id = attr(el, 'data-id');
      var task = el.closest('.task');
      var wasDone = !!(task && task.classList.contains('d'));
      if (task) {
        task.classList.toggle('d');
        task.classList.toggle('done');
        var cb = task.querySelector('.cb');
        if (cb) cb.classList.toggle('on');
      }
      /* No id = a sample row (fixture): the tick shows, nothing is written. */
      if (!id) return;
      var zoom = isZoomCard(el, root, id);
      if (!wasDone) {
        var left = root.querySelectorAll ? root.querySelectorAll('.exec.today .tl .task:not(.d)').length : 1;
        fourmSound(left ? 'pop' : 'levelUp');
      }
      if (zoom) {
        return zoomPatch(id, { status: 'done' }).then(function () {
          refresh('war');
          toast(root, 'Done', function () { zoomRestore(id).then(function () { refresh('war'); }); });
        }).catch(function () { toast(root, 'Could not complete that task'); refresh('war'); });
      }
      var next = wasDone ? 'new' : 'done';
      return patchItem(id, { status: next }).then(function () {
        refresh('war');
        toast(root, next === 'done' ? 'Done today' : 'Reopened', function () { patchItem(id, { status: wasDone ? 'done' : 'new' }).then(function () { refresh('war'); }); });
      }).catch(function () { toast(root, 'Could not complete that task'); refresh('war'); });
    },
    'task-move': function (el, root) {
      var id = attr(el, 'data-id');
      var bucket = attr(el, 'data-bucket');
      if (!id || !bucket) return;
      var req = isZoomCard(el, root, id) ? zoomPatch(id, { status: 'tasked', column: bucket }) : patchItem(id, { column: bucket });
      return req.then(function () {
        refresh('war');
        toast(root, 'Moved to ' + bucket);
      }).catch(function () { toast(root, 'Could not move that task'); });
    },
    'task-drop': function (el, root) {
      var id = attr(el, 'data-id');
      if (!id) return;
      if (isZoomCard(el, root, id)) {
        return zoomPatch(id, { status: 'dismissed' }).then(function () {
          refresh('war');
          toast(root, 'Removed', function () { zoomRestore(id).then(function () { refresh('war'); }); });
        }).catch(function () { toast(root, 'Could not remove that task'); });
      }
      return softDrop(id).then(function () {
        refresh('war');
        toast(root, 'Removed', function () { patchItem(id, { status: 'new' }).then(function () { refresh('war'); }); });
      }).catch(function () { toast(root, 'Could not remove that task'); });
    },
    'exec-more': function (el) {
      var b = attr(el, 'data-bucket');
      if (!b) return;
      S().execMore = S().execMore || {};
      S().execMore[b] = true;
      refresh('war');
    },
    'exec-select': function () {
      S().execSelect = !S().execSelect;
      if (!S().execSelect) S().execPicked = {};
      refresh('war');
    },
    'exec-pick': function (el) {
      var id = attr(el, 'data-id');
      if (!id) return;
      S().execPicked = S().execPicked || {};
      if (S().execPicked[id]) delete S().execPicked[id];
      else S().execPicked[id] = true;
      refresh('war');
    },
    'exec-select-all': function () {
      var root = document.getElementById('warDesk');
      root = root && root.shadowRoot;
      var tasks = root ? root.querySelectorAll('.exec.today .tl .task[data-id]') : [];
      var ids = [];
      tasks.forEach(function (t) { var id = attr(t, 'data-id'); if (id) ids.push(id); });
      S().execPicked = S().execPicked || {};
      var every = ids.length && ids.every(function (id) { return S().execPicked[id]; });
      S().execPicked = {};
      if (!every) ids.forEach(function (id) { S().execPicked[id] = true; });
      refresh('war');
    },
    'exec-cancel': function () {
      S().execSelect = false;
      S().execPicked = {};
      refresh('war');
    },
    'exec-bulk-drop': function (el, root) {
      var ids = Object.keys(S().execPicked || {});
      if (!ids.length) return;
      var n = ids.length;
      var zoomIds = ids.filter(function (id) { return isZoomCard(null, root, id); });
      var itemIds = ids.filter(function (id) { return zoomIds.indexOf(id) < 0; });
      Promise.all(zoomIds.map(function (id) { return zoomPatch(id, { status: 'dismissed' }); })
        .concat(itemIds.map(function (id) { return softDrop(id); }))).then(function () {
        S().execSelect = false;
        S().execPicked = {};
        refresh('war');
        toast(root, 'Deleted ' + n, function () {
          Promise.all(itemIds.map(function (id) { return patchItem(id, { status: 'new' }); })
            .concat(zoomIds.map(function (id) { return zoomRestore(id); }))).then(function () { refresh('war'); });
        });
      }).catch(function () { refresh('war'); toast(root, 'Could not delete all of those tasks'); });
    },
    'exec-bulk-week': function (el, root) { bulkMove(root, 'week'); },
    'exec-bulk-later': function (el, root) { bulkMove(root, 'later'); },
    'open-need': function (el) {
      var view = attr(el, 'data-view') || 'war';
      go(view);
    },
    'linkedin-open': function (el) {
      var url = attr(el, 'data-url');
      var name = attr(el, 'data-name') || '';
      if (!/^https?:\/\//i.test(url)) url = 'https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(name);
      window.open(url, '_blank', 'noopener');
    },
    'mail-reply': function (el) {
      var r = mailRoot() && mailRoot().getElementById('reader');
      var src = attr(el, 'data-email') ? el : (r || el);
      var email = attr(src, 'data-email');
      var subj = attr(src, 'data-subject');
      openCompose({
        to: email ? [{ email: email, name: attr(src, 'data-from') }] : [],
        reply: true,
        subject: subj && !/^re:/i.test(subj) ? 'Re: ' + subj : subj,
        threadId: attr(src, 'data-thread'),
        messageId: attr(src, 'data-mid'),
        body: attr(el, 'data-body') || ''
      });
    },
    'mail-more': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var email = attr(el, 'data-email');
      var mid = attr(el, 'data-mid') || attr(el, 'data-id');
      var html = '<button type="button" data-action="mail-not-person" data-email="' + esc(email) + '">Not a person</button>'
        + '<button type="button" data-action="mail-snooze" data-id="' + esc(mid) + '">Snooze 24h</button>'
        + '<button type="button" data-action="mail-file" data-email="' + esc(email) + '" data-id="' + esc(mid) + '">File</button>';
      openPop(root, el, html);
    },
    'mail-not-person': function (el, root) {
      var email = attr(el, 'data-email');
      closePop(root);
      if (email && typeof window.hideSender === 'function') {
        window.hideSender(email);
        toast(root, 'Hidden that sender', function () {
          try {
            var rows = JSON.parse(localStorage.getItem('cr_inbox_hide') || '[]').filter(function (x) { return x !== email; });
            localStorage.setItem('cr_inbox_hide', JSON.stringify(rows));
          } catch (e) {}
          refresh('dash');
        });
        return;
      }
      soon(root, 'Hide sender');
    },
    'mail-file': function (el, root) {
      closePop(root);
      go('mail');
      toast(root, 'Open Email to file this thread');
    },
    'inbox-mode': function (el) {
      var mode = attr(el, 'data-mode') || 'people';
      try { localStorage.setItem('cr_inbox_people', mode === 'all' ? '0' : '1'); } catch (e) {}
      refresh('dash');
    },
    'goto-war': function () { go('war'); },
    'open-email': function () { go('mail'); },
    'note-new': function (el, root) {
      function openBlank(id) {
        var card = document.createElement('div');
        card.setAttribute('data-action', 'note-open');
        card.setAttribute('data-id', id || 'tmp');
        card.setAttribute('data-source', 'sticky');
        card.setAttribute('data-title', '');
        card.setAttribute('data-body', '');
        card.setAttribute('data-type', 'idea');
        card.setAttribute('data-color', 'y');
        actions['note-open'](card, root);
      }
      if (!writeOk()) { openBlank('tmp'); toast(root, 'New note (fixture)'); return; }
      var pinIt = attr(el, 'data-pin') === '1';
      var catNow = S().noteCatName && S().noteCatName !== 'all' ? S().noteCatName : '';
      var meta0 = { title: '', kind: 'idea' };
      if (pinIt) meta0.pin = true;
      if (catNow) meta0.category = catNow;
      return api('/api/notes/sticky', { method: 'POST', body: { body: '', color: 'yellow', meta: meta0 } }).then(ok).then(json).then(function (row) {
        if (row && row.id && !row.meta) row.meta = meta0;
        S().stickies = S().stickies || [];
        if (row && row.id) S().stickies.unshift(row);
        refresh('notes');
        setTimeout(function () { openBlank(row && row.id); }, 40);
        toast(root, 'Note created');
      }).catch(function () { toast(root, 'Could not create a note'); });
    },
    'notes-search': function () { /* input handler */ },
    'notes-cat': function (el, root) {
      var key = attr(el, 'data-c') || 'all';
      if (key === 'new') {
        var name = window.prompt('New category');
        name = String(name || '').trim();
        if (!name) return;
        if (!writeOk()) { S().noteCats = (S().noteCats || []).concat([{ id: 'tmp-' + Date.now(), name: name }]); refresh('notes'); return; }
        return createNoteCat(name).then(function () {
          S().noteCatName = name;
          refresh('notes');
          toast(root, 'Category added');
        }).catch(function () { toast(root, 'Could not add that category'); });
      }
      S().noteCatName = key;
      refresh('notes');
    },
    'note-cat-tag': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var id = attr(el, 'data-id');
      var src = attr(el, 'data-source') || 'sticky';
      var names = typeof window.__noteCategoryNames === 'function' ? window.__noteCategoryNames() : [];
      var curCat = attr(el, 'data-cat');
      openPop(root, el, names.map(function (n) {
        return '<button type="button" data-action="note-cat-pick" data-id="' + esc(id) + '" data-source="' + esc(src) + '" data-cat="' + esc(n) + '">' + (n === curCat ? '&#10003; ' : '') + esc(n) + '</button>';
      }).join('') + (curCat ? '<button type="button" data-action="note-cat-pick" data-id="' + esc(id) + '" data-source="' + esc(src) + '" data-cat="">No category</button>' : '')
        + '<button type="button" data-action="note-cat-pick" data-id="' + esc(id) + '" data-source="' + esc(src) + '" data-cat="__new__">+ New category</button>');
    },
    'note-cat-pick': function (el, root) {
      closePop(root);
      var id = attr(el, 'data-id');
      var src = attr(el, 'data-source') || 'sticky';
      var cat = attr(el, 'data-cat');
      var ready = Promise.resolve();
      if (cat === '__new__') {
        cat = String(window.prompt('New category') || '').trim();
        if (!cat) return;
        ready = writeOk() ? createNoteCat(cat) : Promise.resolve();
      }
      if (!id) return;
      return ready.then(function () { return setNoteCategory(id, src, cat); }).then(function () {
        refresh('notes');
        toast(root, cat ? ('Filed under ' + cat) : 'Category cleared');
      }).catch(function () { toast(root, 'Could not save that category'); });
    },
    'notes-filter': function (el, root) {
      var key = attr(el, 'data-filter') || 'all';
      var prev = S().noteFilter || 'all';
      S().noteFilter = key;
      if (key === 'archive' || prev === 'archive') { refresh('notes'); return; }
      root.querySelectorAll('[data-action="notes-filter"]').forEach(function (c) {
        c.classList.toggle('on', attr(c, 'data-filter') === key);
      });
      var q = String((root.querySelector('[data-action="notes-search"]') || {}).value || '').toLowerCase();
      root.querySelectorAll('.note').forEach(function (n) {
        var type = String(attr(n, 'data-type') || '').toLowerCase();
        var pin = n.getAttribute('data-pin') === '1';
        var text = (n.textContent || '').toLowerCase();
        var okF = key === 'all' || (key === 'pinned' && pin) || type === key;
        var okQ = !q || text.indexOf(q) >= 0;
        n.style.display = okF && okQ ? '' : 'none';
      });
    },
    'notes-view': function (el, root) {
      var view = attr(el, 'data-view') || 'board';
      root.querySelectorAll('[data-action="notes-view"]').forEach(function (t) {
        t.classList.toggle('on', attr(t, 'data-view') === view);
      });
      S().notesView = view === 'canvas' ? 'canvas' : 'board';
      try { localStorage.setItem('cr_notes_view', S().notesView); } catch (e) {}
      refresh('notes');
    },
    /* N3: archive empty notes and exact duplicates, tag untyped notes from their text. One Undo reverts it all. */
    'notes-tidy': function (el, root) {
      if (!writeOk()) { toast(root, 'Tidied (fixture)'); return; }
      api('/api/notes/organize', { method: 'POST', body: { action: 'tidy' } }).then(ok).then(json).then(function (d) {
        var gone = (d && d.archived) || [];
        var typed = (d && d.typed) || [];
        gone.forEach(function (g) {
          if (g.store === 'sticky') { var r = stickyRow(g.id); if (r) r.meta = Object.assign({}, r.meta || {}, { archived: true }); }
          else { var b = boardNote(g.id); if (b) b.title = '[archived] ' + String(g.title || b.title || ''); }
        });
        typed.forEach(function (t) { var r = stickyRow(t.id); if (r) r.meta = Object.assign({}, r.meta || {}, { kind: t.kind }); });
        refresh('notes');
        if (!gone.length && !typed.length) { toast(root, 'Already tidy'); return; }
        var msg = 'Tidied: ' + gone.length + ' archived, ' + typed.length + ' tagged';
        toast(root, msg, function () {
          var undo = gone.map(function (g) {
            if (g.store === 'sticky') return patchStickyMeta(g.id, { archived: false });
            var b = boardNote(g.id); if (b) b.title = String(g.title || '');
            return api('/api/notes', { method: 'PATCH', body: { id: g.id, title: String(g.title || 'Note') } }).then(ok);
          }).concat(typed.map(function (t) { return patchStickyMeta(t.id, { kind: '' }); }));
          Promise.all(undo).then(function () { refresh('notes'); toast(root, 'Tidy undone'); })
            .catch(function () { refresh('notes'); toast(root, 'Could not undo every change'); });
        });
      }).catch(function () { toast(root, 'Could not tidy notes'); });
    },
    'notes-full': function (el, root) {
      var host = root.host || document.getElementById('notesDesk');
      if (host) host.classList.toggle('desk-full');
      toast(root, host && host.classList.contains('desk-full') ? 'Notes full screen' : 'Exit full screen');
    },
    'note-pin': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var id = attr(el, 'data-id');
      var source = attr(el, 'data-source') || 'sticky';
      if (!id) return;
      var next = attr(el, 'data-on') !== '1';
      el.setAttribute('data-on', next ? '1' : '0');
      closePop(root);
      if (!writeOk()) { toast(root, next ? 'Pinned' : 'Unpinned'); return; }
      var req;
      if (source === 'sticky') req = patchStickyMeta(id, { pin: next });
      else {
        var bn = boardNote(id);
        if (bn) bn.pin = next;
        req = api('/api/notes/' + encodeURIComponent(id), { method: 'PATCH', body: { pin: next } }).then(ok);
      }
      var big = root.getElementById && root.getElementById('ovNote');
      var bigOpen = big && !big.hasAttribute('hidden');
      if (!bigOpen) refresh('notes');
      return req.then(function () {
        toast(root, next ? 'Pinned' : 'Unpinned');
      }).catch(function () { toast(root, 'Could not pin that note'); });
    },
    'note-archive': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var id = attr(el, 'data-id');
      var source = attr(el, 'data-source') || 'sticky';
      if (!id) return;
      var card = el.closest('.note');
      if (card) card.style.display = 'none';
      if (!writeOk()) { toast(root, 'Archived'); return; }
      closePop(root);
      var bnA = source === 'sticky' ? null : boardNote(id);
      var oldTitle = String((bnA && bnA.title) || attr(el, 'data-title') || 'Note').replace(/^\[archived\]\s*/, '');
      if (bnA) bnA.title = '[archived] ' + oldTitle;
      var req = source === 'sticky'
        ? patchStickyMeta(id, { archived: true })
        : api('/api/notes', { method: 'PATCH', body: { id: id, title: '[archived] ' + oldTitle } }).then(ok);
      return req.then(function () {
        toast(root, 'Archived', function () {
          if (source === 'sticky') patchStickyMeta(id, { archived: false }).then(function () { refresh('notes'); });
          else { if (bnA) bnA.title = oldTitle; api('/api/notes', { method: 'PATCH', body: { id: id, title: oldTitle } }).then(function () { refresh('notes'); }); }
        });
      }).catch(function () { toast(root, 'Could not archive that note'); });
    },
    'note-task': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var title = attr(el, 'data-title') || 'From note';
      return addTask(title, 'today').then(function () { toast(root, 'Converted to a task'); refresh('war'); })
        .catch(function () { toast(root, 'Could not convert that note'); });
    },
    'note-open': function (el, root) {
      var scrim = root.getElementById && root.getElementById('nscrim');
      var card = root.getElementById && root.getElementById('ovNote');
      var ot = root.getElementById && root.getElementById('ot');
      var ob = root.getElementById && root.getElementById('ob');
      var okEl = root.getElementById && root.getElementById('ok');
      var pin = root.getElementById && root.getElementById('ovPin');
      var task = root.getElementById && root.getElementById('ovTask');
      if (!card) { soon(root, 'Open note'); return; }
      var color = attr(el, 'data-color') || 'y';
      var id = attr(el, 'data-id');
      var source = attr(el, 'data-source') || 'sticky';
      card.className = 'nbig ' + color;
      card.setAttribute('data-id', id);
      card.setAttribute('data-source', source);
      card.setAttribute('data-color', color);
      card.removeAttribute('hidden');
      if (scrim) { scrim.removeAttribute('hidden'); scrim.classList.add('open'); }
      showOv(card, true);
      if (ot) {
        ot.textContent = attr(el, 'data-title') || '';
        ot.setAttribute('data-id', id);
        ot.setAttribute('data-source', source);
        ot.setAttribute('data-action', 'note-edit');
      }
      if (ob) {
        ob.innerText = attr(el, 'data-body') || '';
        ob.setAttribute('data-id', id);
        ob.setAttribute('data-source', source);
        ob.setAttribute('data-action', 'note-edit');
      }
      if (okEl) okEl.textContent = attr(el, 'data-type') || 'Note';
      if (pin) {
        pin.setAttribute('data-id', id);
        pin.setAttribute('data-source', source);
        pin.setAttribute('data-on', attr(el, 'data-pin') || '0');
      }
      if (task) {
        task.setAttribute('data-id', id);
        task.setAttribute('data-title', attr(el, 'data-title') || 'From note');
      }
      root.querySelectorAll('.nbig .cols i').forEach(function (dot) {
        dot.classList.toggle('on', attr(dot, 'data-color') === color);
      });
      var saved = root.getElementById && root.getElementById('ovSaved');
      if (saved) saved.innerHTML = '<i></i>Saved';
      setTimeout(function () { if (ot) ot.focus(); }, 30);
    },
    'note-keep': function () {},
    'note-check': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var id = attr(el, 'data-id');
      var src = attr(el, 'data-source') || 'sticky';
      var i = Number(attr(el, 'data-i'));
      if (!id) return;
      var row = src === 'sticky' ? stickyRow(id) : boardNote(id);
      var list = row ? ((src === 'sticky' ? (row.meta && row.meta.checks) : row.checks) || []) : [];
      list = list.map(function (c) { return typeof c === 'string' ? { text: c, done: false } : { text: c.text || c.t || c.title || '', done: !!(c.done || c.checked) }; });
      if (!list[i]) return;
      list[i].done = !list[i].done;
      el.classList.toggle('done', list[i].done);
      var ic = el.querySelector('i');
      if (ic) ic.innerHTML = list[i].done ? '&#10003;' : '';
      if (list[i].done) fourmSound(list.every(function (c) { return c.done; }) ? 'levelUp' : 'pop');
      if (src === 'sticky') {
        patchStickyMeta(id, { checks: list }).catch(function () { toast(root, 'Could not save that tick'); });
      } else {
        row.checks = list;
        toast(root, 'Ticked (checklists on board notes are not stored yet)');
      }
    },
    'note-close': function (el, root, ev) {
      var t = (ev && ev.composedPath && ev.composedPath()[0]) || el;
      if (t && t.closest && t.closest('.nbig') && attr(el, 'id') === 'nscrim') return;
      if (t && t.closest && t.closest('.nbig') && !t.closest('[data-action="note-close"]') && attr(el, 'data-action') === 'note-close' && attr(el, 'id') === 'nscrim') return;
      var card = root.getElementById && root.getElementById('ovNote');
      var scrim = root.getElementById && root.getElementById('nscrim');
      if (card) { card.__flushNote = true; saveNote(root, card); }
      showOv(card, false);
      if (card) card.setAttribute('hidden', '');
      if (scrim) { scrim.setAttribute('hidden', ''); scrim.classList.remove('open'); }
    },
    'note-color-set': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var color = attr(el, 'data-color') || 'y';
      var card = root.getElementById && root.getElementById('ovNote');
      var id = card ? attr(card, 'data-id') : attr(el, 'data-id');
      var source = card ? attr(card, 'data-source') : 'sticky';
      if (card) {
        card.className = 'nbig ' + color;
        card.setAttribute('data-color', color);
      }
      root.querySelectorAll('.nbig .cols i').forEach(function (dot) {
        dot.classList.toggle('on', attr(dot, 'data-color') === color);
      });
      var names = { y: 'yellow', p: 'pink', g: 'green', b: 'blue', o: 'orange', v: 'violet' };
      if (!id || !writeOk()) { toast(root, 'Colour set'); return; }
      var colorReq = source === 'sticky'
        ? api('/api/notes/' + encodeURIComponent(id), { method: 'PATCH', body: { color: names[color] || 'yellow' } })
        : api('/api/notes', { method: 'PATCH', body: { id: id, color: names[color] || 'yellow' } });
      var rowC = source === 'sticky' ? stickyRow(id) : boardNote(id);
      if (rowC) rowC.color = names[color] || 'yellow';
      colorReq.then(ok).then(function () {
        toast(root, 'Colour saved');
      }).catch(function () { toast(root, 'Could not save colour'); });
    },
    'note-space': function (el, root) {
      var spaces = (S().packages || []).map(function (p) {
        return '<button type="button" data-action="note-space-pick" data-space="' + esc(p.id || '') + '" data-id="' + esc(attr(el, 'data-id')) + '" data-title="' + esc(attr(el, 'data-title') || '') + '">' + esc(p.name || 'Space') + '</button>';
      }).join('');
      if (!spaces) { soon(root, 'Move to a Space'); return; }
      openPop(root, el, spaces);
    },
    'note-space-pick': function (el, root) {
      closePop(root);
      var sid = attr(el, 'data-space');
      var title = attr(el, 'data-title') || 'Note';
      if (!sid) return;
      if (!writeOk()) { toast(root, 'Moved to a Space (fixture)'); return; }
      var ob = root.getElementById && root.getElementById('ob');
      var noteBody = ob ? String(ob.innerText || '') : '';
      api('/api/spaces/' + encodeURIComponent(sid) + '/items', { method: 'POST', body: { kind: 'note', name: title, body: noteBody } }).then(ok).then(json).then(function (d) {
        if (d && d.saved === false) throw new Error('not saved');
        toast(root, 'Moved to a Space');
      }).catch(function () { toast(root, 'Could not move that note'); });
    },
    'note-menu': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var id = attr(el, 'data-id');
      var src = attr(el, 'data-source') || 'sticky';
      var title = attr(el, 'data-title') || '';
      var on = attr(el, 'data-on') || '0';
      openPop(root, el, '<button type="button" data-action="note-pin" data-id="' + esc(id) + '" data-source="' + esc(src) + '" data-on="' + on + '">' + (on === '1' ? 'Unpin' : 'Pin') + '</button>'
        + '<button type="button" data-action="note-task" data-id="' + esc(id) + '" data-title="' + esc(title) + '">Convert to task</button>'
        + '<button type="button" data-action="note-archive" data-id="' + esc(id) + '" data-source="' + esc(src) + '" data-title="' + esc(title) + '">Archive</button>');
    },
    'notes-color': function (el, root) {
      var color = attr(el, 'data-color') || '';
      S().noteColor = color;
      root.querySelectorAll('[data-action="notes-color"]').forEach(function (c) {
        c.classList.toggle('on', attr(c, 'data-color') === color);
      });
      root.querySelectorAll('.note').forEach(function (n) {
        if (n.classList.contains('big')) return;
        n.style.display = !color || n.classList.contains(color) ? '' : 'none';
      });
    },
    'note-edit': function () { /* input/blur saves */ },
    'link-cat': function (el, root) {
      var name = attr(el, 'data-name');
      var kind = attr(el, 'data-kind') || 'cat';
      var parent = attr(el, 'data-parent') || '';
      var sub = attr(el, 'data-sub') || '';
      if (kind === 'all' || name === 'All links') {
        S().cat = '';
        S().sub = '';
        S().leaf = '';
      } else if (kind === 'sub') {
        S().cat = parent || name;
        S().sub = name;
        S().leaf = '';
      } else if (kind === 'leaf') {
        S().cat = parent;
        S().sub = sub;
        S().leaf = name;
      } else {
        S().cat = name;
        S().sub = '';
        S().leaf = '';
      }
      S().linkCat = S().cat;
      refresh('links');
    },
    'link-toggle': function (el, root, ev) {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      var key = attr(el, 'data-key') || attr(el, 'data-name');
      if (!key) return;
      var open = [];
      if (typeof window.linkOpenSet === 'function') open = window.linkOpenSet();
      else {
        try { open = JSON.parse(localStorage.getItem('cr_link_open') || '[]'); } catch (e) { open = []; }
      }
      var at = open.indexOf(key);
      if (at >= 0) open.splice(at, 1);
      else open.push(key);
      S().linkOpen = open;
      try { localStorage.setItem('cr_link_open', JSON.stringify(open)); } catch (e) {}
      refresh('links');
    },
    'link-sub': function (el, root, ev) {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      var name = attr(el, 'data-name');
      var sub = window.prompt('New subfolder name');
      if (sub == null) return;
      sub = String(sub).trim();
      if (!name || !sub) return;
      if (!writeOk()) { toast(root, 'Subfolder (fixture)'); return; }
      api('/api/links', { method: 'POST', body: { kind: 'subcategory', name: name, sub: sub } }).then(ok).then(function () {
        var cat = (S().categories || []).filter(function (c) { return c.name === name; })[0];
        if (cat) {
          cat.subs = cat.subs || [];
          if (cat.subs.indexOf(sub) < 0) cat.subs.push(sub);
        }
        S().linkOpen = (S().linkOpen || []).concat([name]);
        try { localStorage.setItem('cr_link_open', JSON.stringify(S().linkOpen)); } catch (e) {}
        refresh('links');
        toast(root, 'Subfolder added');
      }).catch(function () { toast(root, 'Could not add that subfolder'); });
    },
    'link-rename': function (el, root, ev) {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      var name = attr(el, 'data-name');
      var sub = attr(el, 'data-sub') || '';
      var next = window.prompt('Rename', sub || name);
      if (next == null) return;
      next = String(next).trim();
      if (!next || next === (sub || name)) return;
      if (!writeOk()) { toast(root, 'Renamed (fixture)'); return; }
      api('/api/links', { method: 'POST', body: { kind: 'rename', name: name, sub: sub, next: next } }).then(ok).then(function () {
        if (sub) {
          (S().categories || []).forEach(function (c) {
            if (c.name !== name) return;
            c.subs = (c.subs || []).map(function (s) { return s === sub ? next : s; });
          });
        } else {
          (S().categories || []).forEach(function (c) { if (c.name === name) c.name = next; });
          (S().links || []).forEach(function (l) { if ((l.cat || l.category) === name) { l.cat = next; l.category = next; } });
          if (S().cat === name) S().cat = next;
        }
        refresh('links');
        toast(root, 'Renamed');
      }).catch(function () { toast(root, 'Could not rename'); });
    },
    'link-hide-cat': function (el, root, ev) {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      var name = attr(el, 'data-name');
      if (!name || name === 'Uncategorized') return;
      if (!writeOk()) { toast(root, 'Category hidden (fixture)'); return; }
      var keptCats = (S().categories || []).slice();
      var movedLinks = (S().links || []).filter(function (l) { return (l.cat || l.category) === name; });
      api('/api/links', { method: 'POST', body: { kind: 'delete-category', name: name } }).then(ok).then(function () {
        S().categories = (S().categories || []).filter(function (c) { return c.name !== name; });
        movedLinks.forEach(function (l) { l.cat = 'Uncategorized'; l.category = 'Uncategorized'; });
        if (S().cat === name) S().cat = '';
        refresh('links');
        toast(root, 'Category removed - links moved to Uncategorized', function () {
          /* Undo: the server revives the soft-deleted row and moves its links back. */
          api('/api/links', { method: 'POST', body: { kind: 'restore-category', name: name } }).then(ok).then(function () {
            S().categories = keptCats;
            movedLinks.forEach(function (l) { l.cat = name; l.category = name; });
            refresh('links');
            if (typeof window.loadBoard === 'function') window.loadBoard();
            toast(root, 'Category restored');
          }).catch(function () { toast(root, 'Could not restore that category'); });
        });
      }).catch(function () { toast(root, 'Could not remove that category'); });
    },
    'link-cat-new': function (el, root) {
      var name = window.prompt('New category name');
      if (name == null) return;
      name = String(name).trim();
      if (!name) return;
      if (!writeOk()) { toast(root, 'Category (fixture)'); return; }
      api('/api/links', { method: 'POST', body: { kind: 'category', name: name } }).then(ok).then(json).then(function () {
        S().categories = S().categories || [];
        S().categories.push({ name: name, subs: [] });
        refresh('links');
        toast(root, 'Category added');
      }).catch(function () { toast(root, 'Could not add that category'); });
    },
    'link-add': function (el, root) {
      var box = el.closest('.add') || root.querySelector('.add');
      var inputs = box ? box.querySelectorAll('input') : [];
      var title = inputs[0] ? String(inputs[0].value || '').trim() : '';
      var url = inputs[1] ? String(inputs[1].value || '').trim() : '';
      if (!url) { toast(root, 'Paste a link first'); return; }
      if (!title) {
        try { title = new URL(/^https?:/i.test(url) ? url : ('https://' + url)).hostname.replace(/^www\./, ''); } catch (e) { title = url; }
      }
      if (!writeOk()) { toast(root, 'Link added (fixture)'); return; }
      var cat = S().cat || S().linkCat || '';
      return api('/api/links', { method: 'POST', body: { title: title, url: url, category: cat } }).then(ok).then(json).then(function (row) {
        S().links = S().links || [];
        if (row) S().links.unshift(Object.assign({ cat: cat, note: '' }, row));
        if (inputs[0]) inputs[0].value = '';
        if (inputs[1]) inputs[1].value = '';
        refresh('links');
        toast(root, 'Link saved', function () {
          if (row && row.id) {
            S().links = (S().links || []).filter(function (l) { return String(l.id) !== String(row.id); });
            refresh('links');
            api('/api/links/' + encodeURIComponent(row.id), { method: 'PATCH', body: { archived: true } }).then(ok).catch(function () {
              toast(root, 'Could not undo that link');
            });
          }
        });
      }).catch(function () { toast(root, 'Could not save that link'); });
    },
    'link-open': function (el) {
      var href = attr(el, 'href') || attr(el, 'data-url');
      if (/^https?:\/\//i.test(href)) window.open(href, '_blank', 'noopener');
    },
    'link-edit': function (el, root, ev) {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      var id = attr(el, 'data-id');
      var cur = attr(el, 'data-title') || '';
      var next = window.prompt('Link title', cur);
      if (next == null) return;
      next = String(next).trim();
      if (!next || !id) return;
      if (!writeOk()) { toast(root, 'Renamed (fixture)'); return; }
      api('/api/links/' + encodeURIComponent(id), { method: 'PATCH', body: { title: next } }).then(ok).then(function () {
        refresh('links'); toast(root, 'Title saved');
      }).catch(function () { toast(root, 'Could not edit that link'); });
    },
    'link-move': function (el, root, ev) {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      var id = attr(el, 'data-id');
      var cats = (S().categories || []).map(function (c) { return c.name; });
      var next = window.prompt('Move to category' + (cats.length ? (' (' + cats.join(', ') + ')') : ''), S().cat || '');
      if (next == null || !id) return;
      next = String(next).trim();
      if (!writeOk()) return;
      if (!next) return;
      var row = (S().links || []).filter(function (l) { return String(l.id) === id; })[0];
      var was = row ? { cat: row.cat, category: row.category, sub: row.sub } : null;
      if (row) { row.cat = next; row.category = next; row.sub = ''; }
      api('/api/links/' + encodeURIComponent(id), { method: 'PATCH', body: { category: next, sub: '' } }).then(ok).then(function () {
        refresh('links');
        toast(root, 'Moved to ' + next);
      }).catch(function () { if (row && was) Object.assign(row, was); refresh('links'); toast(root, 'Could not move that link'); });
    },
    'link-archive': function (el, root, ev) {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      var id = attr(el, 'data-id');
      var tile = el.closest('.tile') || el.closest('a');
      if (tile) tile.style.display = 'none';
      if (!id) { toast(root, 'Hidden'); return; }
      if (!writeOk()) return;
      var gone = (S().links || []).filter(function (l) { return String(l.id) === String(id); })[0];
      S().links = (S().links || []).filter(function (l) { return String(l.id) !== String(id); });
      refresh('links');
      api('/api/links/' + encodeURIComponent(id), { method: 'PATCH', body: { archived: true } }).then(ok).then(function () {
        toast(root, 'Link deleted', function () {
          api('/api/links/' + encodeURIComponent(id), { method: 'PATCH', body: { archived: false } }).then(ok).then(function () {
            if (gone) S().links = [gone].concat(S().links || []);
            refresh('links');
          }).catch(function () { toast(root, 'Could not restore that link'); });
        });
      }).catch(function () {
        if (gone) S().links = [gone].concat(S().links || []);
        refresh('links');
        toast(root, 'Could not delete that link');
      });
    },
    'link-expand': function (el, root) {
      var collapsing = !!(S().linkAllOpen);
      if (collapsing) {
        S().linkOpen = [];
        S().linkAllOpen = false;
        try { localStorage.setItem('cr_link_open', '[]'); } catch (e) {}
        refresh('links');
        toast(root, 'Categories collapsed');
        return;
      }
      var open = [];
      (S().categories || []).forEach(function (c) {
        open.push(c.name);
        (c.subs || []).forEach(function (s) { open.push(c.name + '\u001f' + s); });
      });
      if (fixtureOn() && window.REDESIGN_FIXTURE && window.REDESIGN_FIXTURE.links) {
        (window.REDESIGN_FIXTURE.links.tree || []).forEach(function (t) { if (t.name) open.push(t.name); });
      }
      S().linkOpen = open;
      S().linkAllOpen = true;
      try { localStorage.setItem('cr_link_open', JSON.stringify(open)); } catch (e) {}
      refresh('links');
      toast(root, 'All categories expanded');
    },
    'link-search': function () { /* input handler */ },
    'link-note': function (el, root, ev) {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      if (el.getAttribute('contenteditable') === 'true') return;
      var prev = el.textContent;
      if (el.classList.contains('empty')) el.textContent = '';
      el.setAttribute('contenteditable', 'true');
      el.focus();
      function save() {
        el.removeAttribute('contenteditable');
        var note = String(el.innerText || '').trim();
        var id = attr(el, 'data-id');
        el.classList.toggle('empty', !note);
        if (!note) el.textContent = 'Add a note';
        if (!id || !writeOk()) { toast(root, note ? 'Note saved (fixture)' : 'Note cleared'); return; }
        var row = (S().links || []).filter(function (l) { return String(l.id) === String(id); })[0];
        if (row) row.note = note;
        api('/api/links/' + encodeURIComponent(id), { method: 'PATCH', body: { note: note } }).then(ok).then(function () {
          toast(root, 'Note saved');
        }).catch(function () {
          el.textContent = prev;
          toast(root, 'Could not save that note');
        });
      }
      var cancelled = false;
      function onKeyNote(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
        if (e.key === 'Escape') { e.preventDefault(); cancelled = true; el.blur(); }
      }
      el.addEventListener('keydown', onKeyNote);
      el.addEventListener('blur', function onBlurNote() {
        el.removeEventListener('keydown', onKeyNote);
        el.removeEventListener('blur', onBlurNote);
        if (cancelled) { el.removeAttribute('contenteditable'); el.textContent = prev; return; }
        save();
      });
    },
    'plan-open': function (el, root) {
      var ov = root.getElementById && root.getElementById('planOv');
      var hd = root.getElementById && root.getElementById('planHd');
      var body = root.getElementById && root.getElementById('planBody');
      if (!ov) {
        if (typeof window.openPlan === 'function') {
          window.openPlan(attr(el, 'data-id') || 'ceo:one', attr(el, 'data-title') || 'Plan', 'other');
          return;
        }
        soon(root, 'Plan');
        return;
      }
      var id = attr(el, 'data-id') || 'ceo:one';
      var title = attr(el, 'data-title') || 'Plan';
      ov.setAttribute('data-id', id);
      ov.setAttribute('data-title', title);
      if (hd) hd.textContent = title;
      if (body) {
        var plan = (S().plans || []).filter(function (p) { return String(p.itemId) === String(id); })[0];
        var lines = plan && plan.steps && plan.steps.length ? plan.steps.map(function (s2) { return typeof s2 === 'string' ? s2 : (s2 && s2.text) || ''; }).filter(Boolean) : [];
        if (!lines.length && !plan) lines = currentMoveSteps(id).map(function (s2) { return s2.text; });
        body.value = lines.length ? lines.join('\n') : ((plan && plan.draft) || '');
      }
      showOv(ov, true);
      if (body) body.focus();
    },
    'plan-close': function (el, root, ev) {
      var t = (ev && ev.composedPath && ev.composedPath()[0]) || el;
      if (t && t.closest && t.closest('.plan-box') && attr(el, 'id') === 'planOv') return;
      showOv(root.getElementById && root.getElementById('planOv'), false);
    },
    'plan-draft': function () {},
    'plan-ask': function (el, root) {
      var ov = root.getElementById && root.getElementById('planOv');
      var body = root.getElementById && root.getElementById('planBody');
      var title = ov ? attr(ov, 'data-title') : 'Plan';
      var id = ov ? attr(ov, 'data-id') : '';
      var steps = body ? String(body.value || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean) : [];
      if (!writeOk()) { toast(root, 'Plan (fixture)'); return; }
      api('/api/ceo/plan', { method: 'POST', body: { title: title, area: 'other', steps: steps, itemId: id } }).then(ok).then(json).then(function (data) {
        if (body) body.value = ((data.steps || []).map(function (s) { return s.text || s; }).join('\n')) || body.value;
        toast(root, 'Plan drafted');
      }).catch(function () { toast(root, 'Could not build that plan'); });
    },
    'plan-save': function (el, root) {
      var ov = root.getElementById && root.getElementById('planOv');
      var body = root.getElementById && root.getElementById('planBody');
      var title = ov ? attr(ov, 'data-title') : 'Plan';
      var id = ov ? attr(ov, 'data-id') : '';
      var steps = body ? String(body.value || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean).map(function (text) { return { text: text, done: false }; }) : [];
      if (!writeOk()) { showOv(ov, false); toast(root, 'Plan saved (fixture)'); return; }
      var prevPlan = (S().plans || []).filter(function (p) { return String(p.itemId) === String(id); })[0] || {};
      var doneMap = {};
      (prevPlan.steps || []).forEach(function (s2) { if (s2 && s2.done) doneMap[String(s2.text)] = true; });
      steps.forEach(function (s2) { if (doneMap[s2.text]) s2.done = true; });
      api('/api/plans', { method: 'POST', body: { itemId: id, title: title, area: 'other', steps: steps, needs: prevPlan.needs || [], draft: body ? body.value : '', push: true, due: new Date().toISOString() } }).then(ok).then(json).then(function (data) {
        S().plans = (S().plans || []).filter(function (p) { return String(p.itemId) !== String(id); }).concat([{ itemId: id, steps: data.steps || steps, needs: data.needs || prevPlan.needs || [], draft: data.draft != null ? data.draft : (body ? body.value : '') }]);
        (data.created || []).forEach(function (row) { S().items = S().items || []; S().items.push(row); });
        showOv(ov, false);
        refresh('war');
        toast(root, (data.created || []).length ? (data.created.length + ' steps on the deck') : 'Plan saved');
      }).catch(function () { toast(root, 'Could not save that plan'); });
    },
    'reach-pick-open': function (el, root) {
      var ov = root.getElementById && root.getElementById('reachOv');
      var list = root.getElementById && root.getElementById('reachList');
      if (!ov || !list) { soon(root, 'Add from Pipeline or Contacts'); return; }
      var people = (S().contacts || []).concat(S().pipeline || []).slice(0, 80);
      list.innerHTML = people.length ? people.map(function (p) {
        var id = esc(p.id || p.email || p.name || '');
        return '<label class="pick-row"><input type="checkbox" data-action="reach-pick-toggle" data-id="' + id + '" data-name="' + esc(p.name || '') + '" data-kind="' + esc(p.kind || p.category || 'corporate') + '"><span>' + esc(p.name || p.email || 'Contact') + '</span></label>';
      }).join('') : '<div class="pick-row">No people on the desk yet.</div>';
      showOv(ov, true);
    },
    'reach-pick-close': function (el, root, ev) {
      var t = (ev && ev.composedPath && ev.composedPath()[0]) || el;
      if (t && t.closest && t.closest('.pick-box') && attr(el, 'id') === 'reachOv') return;
      showOv(root.getElementById && root.getElementById('reachOv'), false);
    },
    'reach-pick-search': function () {},
    'reach-pick-toggle': function () {},
    'reach-pick-add': function (el, root) {
      var ov = root.getElementById && root.getElementById('reachOv');
      var boxes = ov ? ov.querySelectorAll('input[type="checkbox"]:checked') : [];
      if (!boxes.length) { toast(root, 'Pick someone first'); return; }
      var jobs = [];
      boxes.forEach(function (box) {
        var person = { name: attr(box, 'data-name') || 'Contact', kind: attr(box, 'data-kind') || 'corporate', nextAction: 'Reach out', contactId: attr(box, 'data-id') };
        if (!writeOk()) return;
        jobs.push(api('/api/reach-out', { method: 'POST', body: person }).then(ok).then(json).then(function (row) {
          S().reachOut = S().reachOut || [];
          if (row) S().reachOut.unshift(row);
        }));
      });
      Promise.all(jobs).then(function () {
        showOv(ov, false);
        refresh('war');
        toast(root, 'Added to Reach out');
      }).catch(function () { toast(root, 'Could not add those people'); });
    },
    'nav-arrange': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      document.body.classList.toggle('arranging');
      if (typeof window.paintShellNav === 'function') window.paintShellNav();
      toast(root, document.body.classList.contains('arranging') ? 'Drag the menu to reorder' : 'Menu order saved');
    },
    'top-today': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var pop = document.getElementById('todayPop');
      if (typeof window.renderTodayPop === 'function') window.renderTodayPop();
      if (pop) pop.classList.toggle('open');
    },
    'top-cal': function () { go('calendar'); },
    'sound-toggle': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      if (!window.FourmSound) return;
      window.FourmSound.toggle();
      el.textContent = window.FourmSound.isOn() ? 'Sound on' : 'Sound off';
      if (window.FourmSound.isOn()) window.FourmSound.pop();
    },
    'nav-go': function (el) {
      if (document.body.classList.contains('arranging')) return;
      var view = attr(el, 'data-v');
      if (view) go(view);
      var path = attr(el, 'data-path');
      if (path && window.history && history.replaceState) { try { history.replaceState({}, '', path); } catch (err) {} }
    },
    'top-signals': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      S().signalsOpen = !S().signalsOpen;
      var btn = document.getElementById('signalsBtn');
      if (btn) btn.classList.toggle('on', !!S().signalsOpen);
      if (typeof window.paintSignalsOverlay === 'function') {
        window.paintSignalsOverlay(!!S().signalsOpen);
        return;
      }
      if ((S().desk || 'war') === 'war' && typeof window.paintRedesignWar === 'function') {
        window.paintRedesignWar();
        return;
      }
      var host = document.getElementById('sigHost');
      if (!host) return;
      if (!S().signalsOpen) {
        host.classList.remove('on');
        host.setAttribute('hidden', '');
        return;
      }
      var data = (fixtureOn() && window.REDESIGN_FIXTURE && window.REDESIGN_FIXTURE.war) || (window.__port && window.__port.liveWar ? window.__port.liveWar() : {});
      var html = window.__port && window.__port.signalsHtml
        ? window.__port.signalsHtml(data, true)
        : '<div class="sh"><b>Signals</b><span class="x" data-action="signals-close">&times;</span></div>';
      host.innerHTML = html.replace(/^<div class="sigpanel[^"]*"[^>]*>/, '').replace(/<\/div>$/, '');
      if (!host.querySelector('.sh')) host.innerHTML = html;
      host.classList.add('on');
      host.removeAttribute('hidden');
    },
    'signals-open': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      S().signalsOpen = true;
      refresh('war');
      if (typeof window.openSignalsPanel === 'function') window.openSignalsPanel();
    },
    'signals-close': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      S().signalsOpen = false;
      try { localStorage.setItem('cr_sig_seen', String(Date.now())); } catch (err) {}
      var btn = document.getElementById('signalsBtn');
      if (btn) btn.classList.remove('on');
      var sh = document.getElementById('sigHost');
      if (sh) { sh.classList.remove('on'); sh.setAttribute('hidden', ''); sh.innerHTML = ''; }
      if (typeof window.paintSignalsOverlay === 'function') window.paintSignalsOverlay(false);
      refresh('war');
      if (typeof window.closeSignalsPanel === 'function') window.closeSignalsPanel();
    },
    'signals-go': function (el) {
      var dest = attr(el, 'data-dest') || '';
      S().signalsOpen = false;
      if (dest === 'mail' || dest === 'email') go('mail');
      else if (dest === 'review' || dest === 'owed') {
        S().zoomFilter = 'owed';
        go('znotes');
      } else if (dest === 'news') go('news');
      else if (dest === 'pipe' || dest === 'pipeline' || dest === 'reach') go('contacts');
      else if (dest === 'people' || dest === 'contacts') go('people');
      else if (dest === 'zoom') go('znotes');
      else if (dest === 'finance' || dest === 'financials') go('finance');
      else if (dest === 'int' || dest === 'fix') go('int');
      else if (dest === 'calendar' || dest === 'cal') go('calendar');
      var sh2 = document.getElementById('sigHost');
      if (sh2) { sh2.classList.remove('on'); sh2.setAttribute('hidden', ''); sh2.innerHTML = ''; }
      if (typeof window.paintSignalsOverlay === 'function') window.paintSignalsOverlay(false);
    },
    'owed-review': function () {
      S().zoomFilter = 'owed';
      go('znotes');
    },
    'reach-pipe': function () { go('contacts'); },
    'nav-reset': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      document.body.classList.remove('arranging');
      try { localStorage.removeItem('cr_nav_order'); } catch (err) {}
      if (writeOk()) api('/api/nav-prefs', { method: 'PUT', body: { order: [] } }).catch(function () {});
      if (typeof window.paintShellNav === 'function') window.paintShellNav();
      toast(root, 'Menu reset to default');
    },
    'task-drag': function () {},
    'col-drop': function () {},
    'capture-input': function () {},
    'link-title': function () {},
    'link-url': function () {},
    'pipe-search': function () {},
    'mail-search': function () {},
    'docs-search': function () {},
    'spaces-search': function () {},
    'mail-card': function (el, root) { actions['mail-open'](el, root); },
    'contact-drag': function (el, root) {
      if (onDragStart.moved) return;
      if (attr(el, 'data-kind') === 'opp') {
        /* Board cards are GHL opportunities: open the matching local contact (by email, then name). */
        var em = attr(el, 'data-email').toLowerCase();
        var nm = attr(el, 'data-name').toLowerCase();
        var c = (S().contacts || []).filter(function (x) { return em && String(x.email || '').toLowerCase() === em; })[0]
          || (S().contacts || []).filter(function (x) { return nm && String(x.name || '').toLowerCase() === nm; })[0];
        var probe = document.createElement('span');
        probe.setAttribute('data-id', c ? c.id : '');
        probe.setAttribute('data-name', attr(el, 'data-name'));
        probe.setAttribute('data-email', attr(el, 'data-email'));
        actions['pipe-open'](probe, root);
        return;
      }
      actions['pipe-open'](el, root);
    },
    'doc-drag': function (el, root) { actions['doc-open'](el, root); },
    'stage-drop': function () {},
    'mail-col-drop': function () {},
    'space-drop': function () {},

    'pipe-view': function (el) {
      var v = attr(el, 'data-view') || 'board';
      if (v === 'list') v = 'table';
      if (v === 'funnel') v = 'funnel';
      S().pipeView = v;
      refresh('pipe');
    },
    'pipe-empty': function () {
      S().pipeShowEmpty = !S().pipeShowEmpty;
      refresh('pipe');
    },
    'pipe-need-chip': function (el) {
      S().pipeNeedChip = attr(el, 'data-chip') || 'all';
      refresh('pipe');
    },
    'pipe-pill': function (el) {
      S().ghlPipe = attr(el, 'data-pipe') || S().ghlPipe;
      S().ghlStage = '';
      refresh('pipe');
    },
    'pipe-more': function (el, root) {
      S().pipeShowAll = !S().pipeShowAll;
      refresh('pipe');
      toast(root, S().pipeShowAll ? 'All pipelines' : 'Top pipelines');
    },
    'pipe-cat': function (el, root) {
      var cats = [];
      (S().contacts || []).forEach(function (c) {
        var n = String(c.category || c.type || 'Other');
        if (cats.indexOf(n) < 0) cats.push(n);
      });
      var next = window.prompt('Category filter (All, or ' + cats.slice(0, 8).join(', ') + ')', S().pipeType || 'All');
      if (next == null) return;
      S().pipeType = /^(all)?$/i.test(String(next).trim()) ? 'all' : String(next).trim();
      refresh('pipe');
      toast(root, 'Category: ' + (S().pipeType === 'all' ? 'All' : S().pipeType));
    },
    'pipe-funnel': function (el) {
      S().ghlStage = attr(el, 'data-stage');
      S().pipeView = 'funnel';
      refresh('pipe');
    },
    'pipe-matrix': function (el) {
      S().pipeMatrix = { cat: attr(el, 'data-cat'), cell: attr(el, 'data-cell') };
      refresh('pipe');
    },
    'pipe-need-tick': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var key = attr(el, 'data-key');
      var kind = attr(el, 'data-kind');
      var id = attr(el, 'data-id');
      var name = attr(el, 'data-name') || 'Them';
      if (!key || !id) return;
      el.classList.add('on');
      el.style.background = 'var(--green)';
      el.style.borderColor = 'var(--green)';
      var done = S().pipeNeedDone = S().pipeNeedDone || {};
      var c = (S().contacts || []).filter(function (x) { return String(x.id) === String(id); })[0];
      var prior = c ? { lastTouch: c.lastTouch, nextDate: c.nextDate } : null;
      /* A GoHighLevel follow-up with no matching contact: "handled" restarts its clock in this browser. */
      var oppOnly = /^opp:/.test(id) ? id.slice(4) : '';
      function oppDone(on) {
        var map = {};
        try { map = JSON.parse(localStorage.getItem('cr_pipe_opp_done') || '{}') || {}; } catch (e) { map = {}; }
        if (on) map[oppOnly] = Date.now(); else delete map[oppOnly];
        try { localStorage.setItem('cr_pipe_opp_done', JSON.stringify(map)); } catch (e) {}
      }
      function undo() {
        delete done[key];
        if (c && prior) { c.lastTouch = prior.lastTouch; c.nextDate = prior.nextDate; }
        if (oppOnly) oppDone(false);
        refresh('pipe');
        if (!writeOk() || oppOnly) return;
        if (kind === 'reach') api('/api/reach-out/' + encodeURIComponent(id), { method: 'PATCH', body: { done: false } }).catch(function () {});
        else if (prior) api('/api/contacts', { method: 'PATCH', body: { id: id, lastTouch: prior.lastTouch ? new Date(prior.lastTouch).toISOString() : null, nextDate: prior.nextDate ? new Date(prior.nextDate).toISOString() : null } }).catch(function () {});
      }
      setTimeout(function () {
        done[key] = 1;
        if (c) { c.lastTouch = Date.now(); if (kind === 'follow') c.nextDate = null; }
        (S().reachOut || []).forEach(function (r) { if (kind === 'reach' && String(r.id) === String(id)) r.done = true; });
        refresh('pipe');
        toast(root, name + ' handled', undo);
      }, 220);
      if (oppOnly) { oppDone(true); return; }
      if (!writeOk()) return;
      var write = kind === 'reach'
        ? api('/api/reach-out/' + encodeURIComponent(id), { method: 'PATCH', body: { done: true } })
        : api('/api/contacts', { method: 'PATCH', body: kind === 'follow' ? { id: id, lastTouch: new Date().toISOString(), nextDate: null } : { id: id, lastTouch: new Date().toISOString() } });
      write.then(ok).catch(function () { undo(); toast(root, 'Could not save that - ' + name + ' is back on the list'); });
    },
    'pipe-add': function (el, root) {
      openPop(root, el, '<div style="font-weight:800;margin:2px 4px 6px">Add a person</div>'
        + '<input data-action="pipe-add-name" id="pipeAddName" placeholder="Name" style="display:block;width:100%;margin:4px 0;padding:6px 8px">'
        + '<input data-action="pipe-add-email" id="pipeAddEmail" placeholder="Email (optional)" style="display:block;width:100%;margin:4px 0;padding:6px 8px">'
        + '<button type="button" data-action="pipe-add-save">Add to Contacts</button>');
      setTimeout(function () { var n = root.getElementById && root.getElementById('pipeAddName'); if (n) n.focus(); }, 30);
    },
    'pipe-add-name': function () {},
    'pipe-add-email': function () {},
    'pipe-add-save': function (el, root) {
      var nEl = root.getElementById && root.getElementById('pipeAddName');
      var eEl = root.getElementById && root.getElementById('pipeAddEmail');
      var name = String((nEl && nEl.value) || '').trim();
      var email = String((eEl && eEl.value) || '').trim().toLowerCase();
      if (!name) { toast(root, 'Add a name'); return; }
      if (email && !EMAIL_RE.test(email)) { toast(root, 'That email address is not valid'); return; }
      closePop(root);
      if (!writeOk()) { toast(root, name + ' added (fixture)'); return; }
      api('/api/contacts', { method: 'POST', body: { name: name, email: email, stage: 'new' } }).then(ok).then(json).then(function (row) {
        if (row && row.id) S().contacts = [row].concat(S().contacts || []);
        refresh('pipe');
        toast(root, name + ' added to Contacts');
      }).catch(function () { toast(root, 'Could not add ' + name); });
    },
    'pipe-col-more': function (el) {
      S().pipeColAll = S().pipeColAll || {};
      S().pipeColAll[attr(el, 'data-stage-id')] = true;
      refresh('pipe');
    },
    /* GoHighLevel follow-up row: open Compose to that person, prefilled. Tick the row handled after sending to restart its clock. */
    'pipe-opp-follow': function (el, root) {
      var name = attr(el, 'data-name') || 'there';
      var email = attr(el, 'data-email') || '';
      if (!email) {
        var probe = document.createElement('span');
        probe.setAttribute('data-id', attr(el, 'data-contact') || '');
        probe.setAttribute('data-name', name);
        if (attr(el, 'data-contact')) { actions['pipe-open'](probe, root); return; }
        toast(root, 'No email on ' + name + ' in GoHighLevel yet');
        return;
      }
      var first = name.split(' ')[0] || 'there';
      openCompose({
        to: [{ email: email, name: name }],
        subject: 'Following up',
        body: 'Hi ' + first + ',\n\nFollowing up on what I sent over. Did you get a chance to look at it? Happy to walk you through it - would 15 minutes this week work?\n\nChad',
        /* Log to Pipeline stays off here: it would move the opportunity to a "contacted" stage, backwards from "sent". */
        log: false
      });
      toast(root, 'Follow-up draft - nothing sends until you confirm');
    },
    'pipe-follow': function (el, root) {
      var name = attr(el, 'data-name') || 'there';
      var email = attr(el, 'data-email') || '';
      var first = name.split(' ')[0] || 'there';
      var draft = 'Hi ' + first + ',\n\nChecking in on where we left things. Still a good moment to talk 4orm — the record every recommendation was understood and right for the person.\n\nWould 15 minutes this week work?\n\nChad';
      if (!email) {
        var probe = document.createElement('span');
        probe.setAttribute('data-id', attr(el, 'data-contact') || (attr(el, 'data-kind') === 'reach' ? '' : attr(el, 'data-id')));
        probe.setAttribute('data-name', name);
        actions['pipe-open'](probe, root);
        return;
      }
      if (typeof window.openReply !== 'function') {
        openCompose({ to: [{ email: email, name: name }], subject: 'Following up', body: draft });
        return;
      }
      if (typeof window.openReply === 'function') {
        window.openReply({ email: email, from: name, subject: 'Following up', snippet: '', body: draft, threadId: '', messageId: '' });
        setTimeout(function () {
          var box = document.getElementById('rpBody');
          if (box) box.value = draft;
        }, 50);
        toast(root, 'Follow-up draft — nothing sends until you confirm');
        return;
      }
      toast(root, 'Follow-up draft — nothing sends until you confirm');
    },
    'pipe-open': function (el, root) {
      var id = attr(el, 'data-id');
      var name = attr(el, 'data-name') || '';
      var email = attr(el, 'data-email') || '';
      var card = el.closest && (el.closest('.pcard') || el.closest('tr') || el.closest('.nd'));
      if (!name && card) {
        var b = card.querySelector('b');
        if (b) name = String(b.textContent || '').trim();
      }
      if (id && typeof window.openContactCard === 'function' && !fixtureOn()) {
        window.openContactCard(id);
        var drawer = document.getElementById('drawer');
        if (drawer && drawer.classList.contains('open')) return;
      }
      var ov = root.getElementById && root.getElementById('contactOv');
      if (!ov) { soon(root, 'Open contact'); return; }
      var hd = ov.querySelector('#contactHd');
      var body = ov.querySelector('#contactBody');
      var follow = ov.querySelector('#contactFollow');
      if (hd) hd.textContent = name || 'Contact';
      if (body) body.innerHTML = (email ? '<p>' + esc(email) + '</p>' : '') + '<p>Open this person, then follow up in Chad\'s voice. Nothing sends until you confirm.</p>';
      if (follow) {
        follow.setAttribute('data-name', name);
        follow.setAttribute('data-email', email);
        follow.setAttribute('data-id', id);
      }
      showOv(ov, true);
    },
    'pipe-close': function (el, root) {
      showOv(root.getElementById && root.getElementById('contactOv'), false);
    },
    'pipe-show-all': function (el, root) {
      S().pipeAllRows = true;
      refresh('pipe');
      toast(root, 'Showing all contacts');
    },
    'spaces-view': function (el) {
      S().spaceView = attr(el, 'data-view') || 'groups';
      refresh('spaces');
    },
    'spaces-arr-view': function () {},
    'spaces-arr-minall': function () {},
    'spaces-arr-tg': function () {},
    'spaces-arr-sp': function () {},
    'spaces-arr-cat': function () {},
    'canvas-zoom-in': function () {},
    'canvas-zoom-out': function () {},
    'canvas-fit': function () {},
    'canvas-add-cluster': function () {},
    'canvas-add-note': function () {},
    'canvas-mk-cluster': function () {},
    'canvas-sel-clear': function () {},
    'canvas-search': function () {},
    'canvas-stage': function () {},
    'canvas-mini': function () {},
    'canvas-cluster': function () {},
    'canvas-cluster-name': function () {},
    'canvas-note': function () {},
    'canvas-rz': function () {},
    'sig-tab': function () {},
    'sig-toggle': function () {},
    'sig-seen': function (el, root) {
      try { localStorage.setItem('cr_sig_seen', String(Date.now())); } catch (e) {}
      toast(root, 'Marked seen');
    },
    'spaces-filter': function (el, root) {
      var next = window.prompt('Filter spaces (all, or a group name)', S().spaceFilter || 'all');
      if (next == null) return;
      S().spaceFilter = String(next).trim() || 'all';
      refresh('spaces');
      toast(root, 'Filter: ' + S().spaceFilter);
    },
    'spaces-new': function (el, root) {
      var name = 'Untitled space';
      S().pkg = null;
      var temp = { id: 'tmp-' + Date.now(), name: name, kind: 'data_room', status: 'draft', docs: [], recipients: [], description: '' };
      S().packages = [temp].concat(S().packages || []);
      S().spaceFocusId = temp.id;
      refresh('spaces');
      if (!writeOk()) { toast(root, 'New space (fixture)'); return; }
      var tempId = temp.id;
      api('/api/spaces', { method: 'POST', body: { name: name, kind: 'data_room', spaceType: 'project' } }).then(ok).then(json).then(function (row) {
        if (!row || !row.id || row.saved === false) throw new Error('not saved');
        temp.id = row.id;
        /* Swap the temp id in place so a name being typed is not lost to a repaint. */
        if (root.querySelectorAll) root.querySelectorAll('[data-id="' + tempId + '"]').forEach(function (n) { n.setAttribute('data-id', row.id); });
        var edits = {};
        if (temp.name !== name) edits.name = temp.name;
        if (temp.notes) edits.notes = temp.notes;
        if (Object.keys(edits).length) api('/api/spaces/' + encodeURIComponent(row.id), { method: 'PATCH', body: edits }).catch(function () {});
        toast(root, 'Space created');
      }).catch(function () { toast(root, 'Space is on the desk - not saved yet'); });
    },
    'space-card-name': function () {},
    'space-card-desc': function () {},
    'space-open': function (el, root) {
      var card = el.closest && el.closest('.sp');
      var id = attr(el, 'data-id') || attr(el, 'data-space') || (card && attr(card, 'data-id')) || '';
      var name = (card && card.querySelector('h4') && card.querySelector('h4').textContent) || 'Space';
      var intel = (card && card.querySelector('p') && card.querySelector('p').textContent) || '';
      if (!id && !name) { soon(root, 'Open space'); return; }
      var hit = (S().packages || []).filter(function (p) { return id && String(p.id) === String(id); })[0];
      S().pkg = hit || { id: id || ('fx-' + Date.now()), name: name, notes: intel, docs: [], recipients: [] };
      refresh('spaces');
      if (!writeOk() || !/^[0-9a-f-]{36}$/i.test(String(S().pkg.id))) return;
      api('/api/spaces/' + encodeURIComponent(S().pkg.id), { method: 'GET' }).then(ok).then(json).then(function (d) {
        var pack = (d && d.package) || d;
        if (pack && pack.id) S().pkg = pack;
        refresh('spaces');
      }).catch(function () { toast(root, 'Opened locally — server copy unavailable'); });
    },
    'space-back': function () {
      S().pkg = null;
      refresh('spaces');
    },
    'space-email': function (el, root) {
      var pkg = spaceById(attr(el, 'data-id')) || S().pkg;
      if (!pkg) { toast(root, 'Open a Space first'); return; }
      var d = spaceDraft(pkg);
      openCompose({ to: d.to });
    },
    'space-compose': function (el, root) {
      var pkg = spaceById(attr(el, 'data-id')) || S().pkg;
      if (!pkg) { toast(root, 'Open a Space first'); return; }
      openCompose(spaceDraft(pkg));
    },
    'space-book': function (el) {
      var pkg = spaceById(attr(el, 'data-id')) || S().pkg || {};
      openBook((pkg.recipients || pkg.people || []).map(function (r) { return r.name || r.email; }));
    },
    'space-send-test': function (el, root) {
      var id = attr(el, 'data-id') || (S().pkg && S().pkg.id);
      if (!id) return;
      if (!writeOk()) {
        try {
          var m = JSON.parse(localStorage.getItem('cr_space_test') || '{}');
          m[id] = Date.now();
          localStorage.setItem('cr_space_test', JSON.stringify(m));
        } catch (e) {}
        refresh('spaces');
        toast(root, 'Test copy queued to chad@4ormfinance.com');
        return;
      }
      api('/api/spaces/' + encodeURIComponent(id), { method: 'POST', body: { action: 'send-ghl', test: true, to: 'chad@4ormfinance.com' } }).then(ok).then(json).then(function (d) {
        if (d && d.sent) {
          try {
            var map = JSON.parse(localStorage.getItem('cr_space_test') || '{}');
            map[id] = Date.now();
            localStorage.setItem('cr_space_test', JSON.stringify(map));
          } catch (e) {}
          refresh('spaces');
          toast(root, 'Test sent to chad@4ormfinance.com');
        } else toast(root, (d && d.note) || 'Test did not send');
      }).catch(function () { toast(root, 'Could not send the test'); });
    },
    'space-prev': function () {
      var packs = S().packages || [];
      var id = S().pkg && S().pkg.id;
      var i = packs.map(function (p) { return String(p.id); }).indexOf(String(id));
      if (i > 0) S().pkg = packs[i - 1];
      refresh('spaces');
    },
    'space-next': function () {
      var packs = S().packages || [];
      var id = S().pkg && S().pkg.id;
      var i = packs.map(function (p) { return String(p.id); }).indexOf(String(id));
      if (i >= 0 && i < packs.length - 1) S().pkg = packs[i + 1];
      refresh('spaces');
    },
    'space-todo-toggle': function (el) {
      if (el && el.classList) el.classList.toggle('d');
      var id = attr(el, 'data-id') || (S().pkg && S().pkg.id);
      if (!id) return;
      var root = el.getRootNode && el.getRootNode();
      var rows = root && root.querySelectorAll ? root.querySelectorAll('.todo .td') : [];
      var steps = [];
      Array.prototype.forEach.call(rows, function (row) {
        steps.push({ d: row.classList.contains('d'), t: (row.querySelector('span') && row.querySelector('span').textContent) || '' });
      });
      var tdc = root && root.getElementById ? root.getElementById('tdc') : null;
      if (tdc) tdc.textContent = steps.filter(function (s) { return s.d; }).length + ' of ' + steps.length + ' done';
      if (S().pkg && String(S().pkg.id) === String(id)) S().pkg.steps = steps;
      if (!writeOk() || !UUID_RE.test(String(id))) return;
      /* Saved on the Space (spaces.steps); the old browser copy is dropped once the server has it. */
      api('/api/spaces/' + encodeURIComponent(id), { method: 'PATCH', body: { steps: steps } }).then(ok).then(json).then(function (d) {
        if (d && d.saved === false) throw new Error('not saved');
        try { localStorage.removeItem('cr_space_steps_' + id); } catch (e) {}
      }).catch(function () {
        try { localStorage.setItem('cr_space_steps_' + id, JSON.stringify(steps)); } catch (e) {}
        toast(root, 'Could not save that step - kept in this browser for now');
      });
    },
    'space-rewrite': function (el, root) {
      /* 4orm Intelligence rewrites the angle and suggests three hooks (POST /api/spaces/:id/angle), then the
         angle saves like a typed one (PATCH {angle}) with Undo back to the old text. */
      var sid = attr(el, 'data-id') || (S().pkg && S().pkg.id);
      if (!writeOk()) { toast(root, 'Rewrite (fixture)'); return; }
      if (!UUID_RE.test(String(sid || ''))) { toast(root, 'Save the Space first'); return; }
      var box = root.querySelector && root.querySelector('.angle[data-action="space-angle"]');
      var before = box ? String(box.innerText || '').trim() : String((S().pkg && S().pkg.angle) || '');
      toast(root, 'Rewriting the angle');
      api('/api/spaces/' + encodeURIComponent(sid) + '/angle', { method: 'POST', body: {} }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok || !d || !d.angle) throw new Error((d && d.error) || 'fail');
          return d;
        });
      }).then(function (d) {
        S().spaceHooks = S().spaceHooks || {};
        S().spaceHooks[sid] = d.hooks || [];
        var el2 = root.querySelector && root.querySelector('.angle[data-action="space-angle"]');
        if (!el2) { if (S().pkg) S().pkg.angle = d.angle; refresh('spaces'); return; }
        el2.innerText = d.angle;
        saveSpaceText(root, el2, 'space-angle');
        refresh('spaces');
        toast(root, 'Angle rewritten', function () {
          var el3 = root.querySelector && root.querySelector('.angle[data-action="space-angle"]');
          if (!el3) return;
          el3.innerText = before;
          saveSpaceText(root, el3, 'space-angle');
          refresh('spaces');
        });
      }).catch(function (err) {
        toast(root, err && err.message && err.message !== 'fail' ? err.message : 'Could not rewrite the angle');
      });
    },
    'space-hook': function (el, root) {
      /* Puts the hook at the top of the intro email and saves it (spaces email body). */
      var hookText = (el.textContent || '').trim();
      var intro = root.querySelector && root.querySelector('[data-action="space-intro"]');
      if (!hookText || !intro) { toast(root, hookText || 'Hook'); return; }
      var cur = String(intro.innerText || '').trim();
      if (cur.indexOf(hookText) === 0) { toast(root, 'That hook already opens the intro'); return; }
      intro.innerText = hookText + (cur ? '\n\n' + cur : '');
      saveSpaceText(root, intro, 'space-intro');
      toast(root, 'Hook added to the intro');
    },
    'space-angle': function () {},
    'space-subject': function () {},
    'space-intro': function () {},
    'space-people': function (el, root) {
      if (!S().pkg) actions['space-open'](el, root);
      var id = attr(el, 'data-id') || (S().pkg && S().pkg.id);
      var name = window.prompt('Person to add (name or email)');
      if (name == null || !String(name).trim()) return;
      var person = { name: String(name).trim(), email: /@/.test(name) ? String(name).trim() : '' };
      if (S().pkg) {
        S().pkg.recipients = (S().pkg.recipients || []).concat([person]);
        S().pkg.people = S().pkg.recipients;
        refresh('spaces');
      }
      if (!writeOk() || !/^[0-9a-f-]{36}$/i.test(String(id || ''))) { toast(root, 'Person added'); return; }
      api('/api/spaces/' + encodeURIComponent(id), { method: 'POST', body: { action: 'add-recipient', name: person.name, email: person.email } }).then(ok).then(json).then(function (d) {
        S().pkg = d.package || d || S().pkg;
        refresh('spaces');
        toast(root, 'Person added');
      }).catch(function () { toast(root, 'Could not add that person'); });
    },
    'space-docs': function (el, root) {
      if (!S().pkg) actions['space-open'](el, root);
      var id = attr(el, 'data-id') || (S().pkg && S().pkg.id);
      var input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.onchange = function () {
        if (!input.files || !input.files.length) return;
        if (!id || !writeOk() || !UUID_RE.test(String(id))) { toast(root, 'Save the Space first, then attach files'); return; }
        toast(root, 'Attaching ' + input.files.length + ' file' + (input.files.length === 1 ? '' : 's') + '…');
        Array.prototype.forEach.call(input.files, function (f) { uploadToSpace(root, id, f); });
      };
      input.click();
    },
    'space-link': function (el, root) {
      var id = attr(el, 'data-id') || (S().pkg && S().pkg.id);
      if (!id) return;
      var links = S().links || [];
      if (!links.length) { toast(root, 'No saved links yet - add some in Links'); return; }
      openPop(root, el, '<input data-action="space-link-q" placeholder="Search saved links" style="display:block;width:100%;margin:2px 0 6px;padding:6px 8px">'
        + '<div class="space-link-list" style="max-height:280px;overflow:auto">' + links.slice(0, 300).map(function (l) {
          return '<button type="button" class="space-link-row" data-action="space-link-pick" data-id="' + esc(id) + '" data-url="' + esc(l.url || '') + '" data-title="' + esc(l.title || l.url || 'Link') + '">' + esc(l.title || l.url || 'Link') + '<small style="display:block;opacity:.6">' + esc(String(l.url || '').replace(/^https?:\/\//, '').slice(0, 60)) + '</small></button>';
        }).join('') + '</div>');
      setTimeout(function () { var q = root.querySelector && root.querySelector('[data-action="space-link-q"]'); if (q) q.focus(); }, 30);
    },
    'space-link-q': function () {},
    'space-link-pick': function (el, root) {
      closePop(root);
      var id = attr(el, 'data-id');
      var url = attr(el, 'data-url');
      var title = attr(el, 'data-title') || url;
      if (!id || !url) return;
      if (!writeOk() || !UUID_RE.test(String(id))) { toast(root, 'Link added (fixture)'); return; }
      api('/api/spaces/' + encodeURIComponent(id), { method: 'POST', body: { action: 'add-link', url: url, name: title } }).then(ok).then(json).then(function (d) {
        if (d && d.saved === false) throw new Error('not saved');
        var pack = (d && d.package) || d;
        if (pack && pack.id) S().pkg = pack;
        refresh('spaces');
        toast(root, 'Link added');
      }).catch(function () { toast(root, 'Could not add that link'); });
    },
    'space-hero-link': function (el, root) {
      var url = window.prompt('Website, LinkedIn, or article URL');
      if (!url) return;
      var id = attr(el, 'data-id') || (S().pkg && S().pkg.id);
      if (!id || !writeOk()) { toast(root, 'Link saved'); return; }
      api('/api/spaces/' + encodeURIComponent(id), { method: 'POST', body: { action: 'add-link', url: url, name: url } }).then(ok).then(function () {
        refresh('spaces'); toast(root, 'Link added');
      }).catch(function () { toast(root, 'Could not add that link'); });
    },
    'space-notes': function () {},
    'space-send': function (el, root) {
      var id = attr(el, 'data-id') || (S().pkg && S().pkg.id);
      if (!id) return;
      var gated = true;
      try { gated = !(JSON.parse(localStorage.getItem('cr_space_test') || '{}')[id]); } catch (e) {}
      if (gated) { toast(root, 'Send a test to chad@4ormfinance.com first'); return; }
      if (!window.confirm('Send this Space via GoHighLevel? Nothing goes out until you confirm.')) return;
      if (!writeOk()) { toast(root, 'Send (fixture)'); return; }
      api('/api/spaces/' + encodeURIComponent(id), { method: 'POST', body: { action: 'send-ghl' } }).then(function (r) {
        // The server refuses (409) unless a test of this exact content went first; show its reason.
        return r.json().catch(function () { return null; }).then(function (d) { if (!r.ok && !(d && d.note)) throw new Error('fail'); return d; });
      }).then(function (d) {
        toast(root, d && d.sent ? 'Sent via GHL' : ((d && d.note) || 'GHL did not send that'));
      }).catch(function () { toast(root, 'Could not send that Space'); });
    },
    'space-drive': function (el, root) {
      var id = attr(el, 'data-id');
      if (!id) { soon(root, 'Move to Drive'); return; }
      if (!writeOk()) { toast(root, 'Move to Drive (fixture)'); return; }
      api('/api/spaces/' + encodeURIComponent(id) + '/move-to-drive', { method: 'POST', body: {} }).then(ok).then(json).then(function (d) {
        toast(root, d && d.ok === false ? (d.error || 'Drive did not take it') : 'Moved to Drive');
        refresh('spaces');
      }).catch(function () { toast(root, 'Drive could not take this Space'); });
    },
    'space-menu': function (el, root) {
      var menu = root.getElementById && root.getElementById('menu');
      if (!menu) { soon(root, 'Space menu'); return; }
      var r = el.getBoundingClientRect();
      menu.style.left = (r.right - 200) + 'px';
      menu.style.top = (r.bottom + 6) + 'px';
      menu.style.display = 'block';
      menu.setAttribute('data-id', attr(el, 'data-id') || '');
    },
    'space-move-group': function (el, root) {
      var menu = root.getElementById && root.getElementById('menu');
      var id = (menu && attr(menu, 'data-id')) || attr(el, 'data-id');
      var cat = attr(el, 'data-group');
      if (menu) menu.style.display = 'none';
      if (!id || !cat) return;
      (S().packages || []).forEach(function (p) { if (String(p.id) === id) p.spaceCategory = cat; });
      refresh('spaces');
      if (!writeOk()) { toast(root, 'Moved to ' + cat + ' (fixture)'); return; }
      api('/api/spaces/' + encodeURIComponent(id), { method: 'PATCH', body: { category: cat } }).then(ok).then(function () {
        toast(root, 'Moved to ' + cat);
      }).catch(function () { toast(root, 'Could not move that space'); });
    },
    'space-rename': function (el, root) {
      var menu = root.getElementById && root.getElementById('menu');
      var id = (menu && attr(menu, 'data-id')) || attr(el, 'data-id');
      if (menu) menu.style.display = 'none';
      if (!id) return;
      var hit = (S().packages || []).filter(function (p) { return String(p.id) === id; })[0];
      var next = window.prompt('Rename this space', (hit && hit.name) || '');
      if (next == null || !String(next).trim()) return;
      if (hit) hit.name = String(next).trim();
      refresh('spaces');
      if (!writeOk()) { toast(root, 'Renamed (fixture)'); return; }
      api('/api/spaces/' + encodeURIComponent(id), { method: 'PATCH', body: { name: String(next).trim() } }).then(ok).then(function () {
        toast(root, 'Renamed');
      }).catch(function () { toast(root, 'Could not rename that space'); });
    },
    /* Delete with Undo: the Space is hidden at once; the server delete only runs after the Undo window closes. */
    'space-archive': function (el, root) {
      var menu = root.getElementById && root.getElementById('menu');
      var id = (menu && attr(menu, 'data-id')) || attr(el, 'data-id');
      if (menu) menu.style.display = 'none';
      if (!id) return;
      var prior = (S().packages || []).slice();
      var hit = spaceById(id);
      S().packages = prior.filter(function (p) { return String(p.id) !== String(id); });
      if (S().pkg && String(S().pkg.id) === String(id)) S().pkg = null;
      refresh('spaces');
      var undone = false;
      toast(root, 'Deleted ' + ((hit && hit.name) || 'Space'), function () {
        undone = true;
        S().packages = prior;
        refresh('spaces');
      });
      if (!writeOk() || !UUID_RE.test(String(id))) return;
      setTimeout(function () {
        if (undone) return;
        api('/api/spaces/' + encodeURIComponent(id), { method: 'DELETE' }).then(ok).then(json).then(function (d) {
          if (d && d.ok === false) throw new Error('not deleted');
        }).catch(function () {
          S().packages = prior;
          refresh('spaces');
          toast(root, 'Could not delete that Space - it is back');
        });
      }, 4600);
    },
    'space-collapse': function (el) {
      var gh = el.closest('.gh') || el;
      var grid = gh.nextElementSibling;
      if (grid) grid.hidden = !grid.hidden;
      el.classList.toggle('closed', grid && grid.hidden);
    },
    'space-show-all': function (el, root) {
      S().spaceShowAll = true;
      refresh('spaces');
      toast(root, 'Showing all in this group');
    },
    'docs-view': function (el) {
      S().docsView = attr(el, 'data-view') || 'grid';
      refresh('docs');
    },
    'docs-folder': function (el) {
      S().docFolder = attr(el, 'data-folder') || '';
      S().docSet = '';
      refresh('docs');
    },
    'docs-type': function (el) {
      S().docType = attr(el, 'data-type') || 'all';
      refresh('docs');
    },
    'docs-new-folder': function (el, root) {
      var name = window.prompt('Folder name');
      if (!name) return;
      name = String(name).trim();
      S().docFolders = (S().docFolders || []).concat([name]);
      refresh('docs');
      if (!writeOk()) { toast(root, 'Folder added'); return; }
      api('/api/documents', { method: 'POST', body: { action: 'add-folder', name: name } }).then(ok).then(function () {
        toast(root, 'Folder added');
        refresh('docs');
      }).catch(function () { toast(root, 'Folder is on the desk — not saved yet'); });
    },
    'docs-drive': function (el, root) {
      if (!writeOk()) { toast(root, 'Pull from Drive (fixture)'); return; }
      openPop(root, el, '<div style="font-weight:600;margin:2px 0 6px">Pull from Drive into ' + esc(docFolderNow()) + '</div>'
        + '<input data-action="docs-drive-q" placeholder="Search Drive by file name" style="display:block;width:100%;margin:2px 0 6px;padding:6px 8px">'
        + '<div class="doc-drive-list" style="max-height:300px;overflow:auto;min-width:280px"></div>');
      searchDrive(root, '');
      setTimeout(function () { var q = root.querySelector && root.querySelector('[data-action="docs-drive-q"]'); if (q) q.focus(); }, 30);
    },
    'docs-drive-q': function () {},
    'docs-drive-pick': function (el, root) {
      var f = (S().docDriveHits || [])[Number(attr(el, 'data-i'))];
      if (!f) return;
      closePop(root);
      var category = docFolderNow();
      api('/api/documents', { method: 'POST', body: { action: 'pull', category: category, name: f.name, driveFileId: f.id, mime: f.mime, url: f.url } }).then(jsonOrThrow).then(function (d) {
        reloadDocs();
        toast(root, d && d.existing ? f.name + ' is already in the library' : f.name + ' pulled into ' + category);
      }).catch(function (err) { toast(root, errText(err, 'Could not pull that file')); });
    },
    'docs-retry': function (el, root) {
      S().docsError = false;
      refresh('docs');
      reloadDocs();
    },
    'docs-upload': function (el, root) {
      var input = root.querySelector('#deskUpload') || document.createElement('input');
      input.id = 'deskUpload';
      input.type = 'file';
      input.multiple = true;
      input.style.display = 'none';
      if (!root.contains(input) && root.appendChild) root.appendChild(input);
      input.onchange = function () {
        var files = input.files;
        if (!files || !files.length) return;
        if (!writeOk()) { toast(root, 'Upload (fixture)'); return; }
        uploadDroppedFiles(root, files, '');
        input.value = '';
      };
      input.click();
    },
    'doc-open': function (el) {
      S().docOpen = {
        name: attr(el, 'data-name') || 'Document',
        url: attr(el, 'data-url') || attr(el, 'data-web'),
        drive: attr(el, 'data-drive'),
        type: attr(el, 'data-type') || 'doc',
        id: attr(el, 'data-id'),
        mime: attr(el, 'data-mime'),
        folder: attr(el, 'data-folder'),
        page: 1
      };
      S().docZoom = 1;
      refresh('docs');
      docMetaLoad(S().docOpen);
    },
    'doc-close': function () {
      S().docOpen = null;
      refresh('docs');
    },
    'doc-prev': function (el, root) { stepDoc(root, -1); },
    'doc-next': function (el, root) { stepDoc(root, 1); },
    'doc-download': function (el, root) {
      var d = S().docOpen;
      if (!d) return;
      var name = d.name || 'document';
      var proxy = d.drive ? '/api/drive/file?id=' + encodeURIComponent(d.drive) : (/^[0-9a-f-]{36}$/i.test(String(d.id || '')) ? '/api/documents/file?id=' + encodeURIComponent(d.id) : '');
      function save(href) {
        var a = document.createElement('a');
        a.href = href; a.download = name; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
      }
      if (!proxy) { toast(root, 'This file has no stored copy to download'); return; }
      toast(root, 'Downloading ' + name);
      api(proxy, { method: 'GET' }).then(function (r) {
        var type = (r.headers && r.headers.get && r.headers.get('content-type')) || '';
        if (!r.ok || /json/i.test(type)) throw new Error('nofile');
        return r.blob();
      }).then(function (blob) {
        var u = URL.createObjectURL(blob);
        save(u);
        setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
      }).catch(function () {
        if (d.drive) save('https://drive.google.com/uc?export=download&id=' + encodeURIComponent(d.drive));
        else toast(root, 'Could not download that file');
      });
    },
    'doc-drive-open': function (el, root) {
      var drive = S().docOpen && S().docOpen.drive;
      if (drive) { window.open('https://drive.google.com/file/d/' + encodeURIComponent(drive) + '/view', '_blank', 'noopener'); return; }
      toast(root, 'Not synced to Drive yet');
    },
    'doc-thumb': function (el) {
      var o = S().docOpen;
      var pages = Number(o && o.meta && o.meta.pages) || 0;
      var n = Number(attr(el, 'data-n')) || 1;
      if (!o || pages < 2) return;
      o.page = Math.max(1, Math.min(pages, n));
      refresh('docs');
    },
    'doc-slide-prev': function (el, root) { stepDocPage(root, -1); },
    'doc-slide-next': function (el, root) { stepDocPage(root, 1); },
    'doc-zoom-in': function () { S().docZoom = Math.min(3, (S().docZoom || 1) + 0.25); zoomDocFrame(); },
    'doc-zoom-out': function () { S().docZoom = Math.max(0.5, (S().docZoom || 1) - 0.25); zoomDocFrame(); },
    'doc-fit': function () { S().docZoom = 1; zoomDocFrame(); },
    'docs-build-space': function (el, root) {
      var docs = docsFor('pick');
      if (!docs.length) { toast(root, 'Tick the files first, then build the Space'); return; }
      actions['doc-space-new'](el, root);
    },
    'doc-add-space': function (el, root) {
      if (!S().docOpen) return;
      openPop(root, el, spacePickHtml('open'));
    },
    'docs-bulk-space': function (el, root) {
      if (!docPicked().length) { toast(root, 'Tick the files first'); return; }
      openPop(root, el, spacePickHtml('pick'));
    },
    'doc-space-pick': function (el, root) {
      closePop(root);
      var kind = attr(el, 'data-kind') || 'pick';
      attachDocsToSpace(root, attr(el, 'data-space'), docsFor(kind), attr(el, 'data-name')).then(function (done) {
        if (done && kind === 'pick') { S().docPick = {}; refresh('docs'); }
      });
    },
    'doc-space-new': function (el, root) {
      closePop(root);
      var kind = attr(el, 'data-kind') || 'pick';
      var docs = docsFor(kind);
      if (!docs.length) { toast(root, 'Pick a file first'); return; }
      if (!writeOk()) { toast(root, 'New Space (fixture)'); return; }
      var name = window.prompt('Name the new Space', docs.length === 1 ? String(docs[0].name || 'New Space').replace(/\.[a-z0-9]{2,5}$/i, '') : 'New Space');
      if (name == null) return;
      name = String(name).trim() || 'New Space';
      createSpaceNamed(name).then(function (sp) {
        return attachDocsToSpace(root, sp.id, docs, sp.name).then(function (done) {
          if (done && kind === 'pick') { S().docPick = {}; refresh('docs'); }
        });
      }).catch(function (err) { toast(root, errText(err, 'Could not create that Space')); });
    },
    'docs-bulk-clear': function () {
      S().docPick = {};
      refresh('docs');
    },
    'docs-bulk-set': function (el, root) {
      if (!docPicked().length) { toast(root, 'Tick the files first'); return; }
      openPop(root, el, setPickHtml());
    },
    'docs-set': function (el) {
      var id = attr(el, 'data-id');
      S().docSet = S().docSet === id ? '' : id;
      if (S().docSet) S().docFolder = '';
      refresh('docs');
    },
    'docs-new-set': function (el, root) {
      closePop(root);
      var name = window.prompt('Name the set');
      if (name == null) return;
      name = String(name).trim();
      if (!name) return;
      if (!writeOk()) { toast(root, 'Set added (fixture)'); return; }
      var ids = docPicked();
      api('/api/documents', { method: 'POST', body: { action: 'add-set', name: name, docIds: ids } }).then(jsonOrThrow).then(function (d) {
        if (d && d.set) S().docSets = (S().docSets || []).concat([d.set]);
        if (ids.length) S().docPick = {};
        refresh('docs');
        reloadDocs();
        toast(root, ids.length ? 'Set ' + name + ' made with ' + ids.length + ' file' + (ids.length === 1 ? '' : 's') : 'Set ' + name + ' added. Tick files and use Add to a set.');
      }).catch(function (err) { toast(root, errText(err, 'Could not add that set')); });
    },
    'docs-set-pick': function (el, root) {
      closePop(root);
      var id = attr(el, 'data-id');
      var ids = docPicked();
      if (!id || !ids.length) return;
      if (!writeOk()) { toast(root, 'Added to set (fixture)'); return; }
      api('/api/documents', { method: 'POST', body: { action: 'set-add', id: id, docIds: ids } }).then(jsonOrThrow).then(function (d) {
        (S().docSets || []).forEach(function (s) { if (d && d.set && s.id === d.set.id) s.docIds = d.set.docIds; });
        S().docPick = {};
        refresh('docs');
        toast(root, 'Added ' + ids.length + ' to ' + (attr(el, 'data-name') || 'the set'));
      }).catch(function (err) { toast(root, errText(err, 'Could not add to that set')); });
    },
    'docs-set-remove': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var id = attr(el, 'data-id');
      var name = attr(el, 'data-name') || 'Set';
      if (!id || !writeOk()) return;
      api('/api/documents', { method: 'POST', body: { action: 'remove-set', id: id } }).then(jsonOrThrow).then(function () {
        S().docSets = (S().docSets || []).filter(function (s) { return s.id !== id; });
        if (S().docSet === id) S().docSet = '';
        refresh('docs');
        toast(root, name + ' removed', function () {
          api('/api/documents', { method: 'POST', body: { action: 'restore-set', id: id } }).then(jsonOrThrow).then(function () { reloadDocs(); toast(root, name + ' is back'); }).catch(function () { toast(root, 'Could not bring that set back'); });
        });
      }).catch(function (err) { toast(root, errText(err, 'Could not remove that set')); });
    },
    'doc-pick': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var id = attr(el, 'data-id');
      if (!id) return;
      S().docPick = S().docPick || {};
      if (S().docPick[id]) delete S().docPick[id];
      else S().docPick[id] = 1;
      el.classList.toggle('on', !!S().docPick[id]);
      refresh('docs');
    },
    /* ---------- Email: compose ---------- */
    'mail-compose': function () { openCompose({ to: [], cc: [], bcc: [] }); },
    'mail-compose-close': function () {
      S().composeOpen = false;
      S().composeDraft = null;
      repaintMail();
    },
    'mail-to': function () {},
    'mail-subject': function () {},
    'mail-body': function () {},
    'mail-ask-input': function () {},
    /* B30: plain-text formatting (mail goes out as plain text, so marks are text: *bold*, _italic_, - list). */
    'mail-fmt': function (el, root) {
      var cp = root.getElementById && root.getElementById('compose');
      var body = cp && cp.querySelector('[data-action="mail-body"]');
      if (!body) return;
      var fmt = attr(el, 'data-fmt');
      var sel = (root.getSelection ? root.getSelection() : null) || window.getSelection();
      var range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
      if (range && !body.contains(range.commonAncestorContainer)) range = null;
      var picked = range ? String(range.toString()) : '';
      var text = '';
      if (fmt === 'b') text = '*' + (picked || 'bold') + '*';
      else if (fmt === 'i') text = '_' + (picked || 'italic') + '_';
      else if (fmt === 'ul' || fmt === 'ol') {
        var lines = (picked || 'item').split(/\n/);
        text = lines.map(function (l, i) { return (fmt === 'ul' ? '- ' : (i + 1) + '. ') + l.replace(/^\s*(?:[-*]|\d+\.)\s+/, ''); }).join('\n');
        if (!picked) text = '\n' + text;
      } else if (fmt === 'link') {
        var url = window.prompt('Link address', 'https://');
        if (!url || !/^https?:\/\/\S+$/i.test(String(url).trim())) { if (url) toast(root, 'That is not a web address'); return; }
        text = (picked ? picked + ' ' : '') + '(' + String(url).trim() + ')';
      } else if (fmt === 'name') {
        var first = (composeState().to || [])[0];
        var nm = first ? String(first.name || '').trim().split(/\s+/)[0] : '';
        if (!nm) { toast(root, first ? 'No name on that recipient yet' : 'Add a recipient first'); return; }
        text = nm;
      } else return;
      body.focus();
      if (range) { sel.removeAllRanges(); sel.addRange(range); }
      else {
        var end = document.createRange();
        end.selectNodeContents(body);
        end.collapse(false);
        if (sel) { sel.removeAllRanges(); sel.addRange(end); }
      }
      var done = false;
      try { done = document.execCommand('insertText', false, text); } catch (e) { done = false; }
      if (!done) body.innerText = String(body.innerText || '') + text;
      composeState().body = String(body.innerText || body.textContent || '');
    },
    /* B37: rewrite the draft in a tone. B38: write from an instruction. Draft only; Undo restores the old body. */
    'mail-tone': function (el, root) { mailAiWrite(root, 'tone', attr(el, 'data-tone')); },
    'mail-ai-write': function (el, root) { mailAiWrite(root, 'write', ''); },
    'mail-always': function () {},
    'mail-to-pick': function (el) {
      var field = attr(el, 'data-field') || 'to';
      addRecipient(field, attr(el, 'data-email'), attr(el, 'data-name'));
      repaintMail();
      focusComposeField(field);
    },
    'mail-rcpt-remove': function (el) {
      var d = composeState();
      var field = attr(el, 'data-field') || 'to';
      (d[field] || []).splice(Number(attr(el, 'data-i')) || 0, 1);
      repaintMail();
    },
    'mail-cc-toggle': function () {
      var d = composeState();
      d.showCc = !d.showCc;
      repaintMail();
      if (d.showCc) focusComposeField('cc');
    },
    'mail-att-remove': function (el) {
      var d = composeState();
      d.attachments.splice(Number(attr(el, 'data-i')) || 0, 1);
      repaintMail();
    },
    'mail-tog': function (el, root) {
      var d = composeState();
      var k = attr(el, 'data-k');
      if (k !== 'nudge' && k !== 'log') return;
      d[k] = !d[k];
      /* The whole switch (dot and label text) toggles; paint the switch that is on screen now,
         even if a blur repainted the compose panel between mousedown and click. */
      var shown = root && root.querySelector ? root.querySelector('.tog[data-k="' + k + '"]') : null;
      [el, shown].forEach(function (t) {
        if (!t) return;
        var sw = t.querySelector('.sw');
        if (sw) sw.classList.toggle('off', !d[k]);
        t.setAttribute('aria-checked', String(d[k]));
      });
    },
    'mail-send': function (el, root) {
      var d = composeState();
      var bad = syncCompose(root);
      d = composeState();
      if (bad.length) { toast(root, 'Not a valid email address: ' + bad.join(', ')); return; }
      if (!d.to.length) { toast(root, 'Add a valid recipient'); focusComposeField('to'); return; }
      var to = d.to[0].email;
      var cc = d.to.slice(1).concat(d.cc).map(function (r) { return r.email; });
      var bcc = d.bcc.map(function (r) { return r.email; });
      if (d.attachments.some(function (a) { return a.busy; })) { toast(root, 'Still reading a file - try again in a moment'); return; }
      var MC = window.__mailCompose || {};
      var isReal = MC.isReal || function () { return false; };
      var realAtts = d.attachments.filter(isReal);
      var linkAtts = d.attachments.filter(function (a) { return !isReal(a); });
      var sig = composeSigOut(root, d);
      var text = d.body + bundleLinksText(linkAtts) + (sig.text ? '\n\n-- \n' + sig.text : '');
      var html = composeHtmlOut(root, d, linkAtts, sig.html);
      var who = 'To: ' + d.to.map(function (r) { return r.email; }).join(', ')
        + (d.cc.length ? '\nCc: ' + d.cc.map(function (r) { return r.email; }).join(', ') : '')
        + (bcc.length ? '\nBcc: ' + bcc.join(', ') : '');
      var attLine = realAtts.length ? '\nAttachments: ' + realAtts.map(function (a) { return a.name || 'File'; }).join(', ') : '';
      if (!window.confirm('Send this email from Gmail?\n\n' + who + '\nSubject: ' + (d.subject || '(no subject)') + attLine + '\n\nNothing goes out until you confirm.')) return;
      if (!writeOk()) { toast(root, 'Send (fixture)'); return; }
      var reply = !!(d.reply && d.threadId);
      var attPayload = realAtts.map(function (a) {
        if (a.data) return { name: a.name || 'File', type: a.type || a.mime || 'application/octet-stream', data: a.data };
        var st = MC.staged ? MC.staged(a) : '';
        if (st) return { name: a.name || 'File', stagedId: st };
        return { name: a.name || 'File', driveFileId: MC.drive ? MC.drive(a) : (a.driveFileId || '') };
      });
      var body = { action: reply ? 'reply' : 'compose', to: to, cc: cc.join(', '), bcc: bcc.join(', '), subject: d.subject, text: text, html: html, attachments: attPayload, threadId: reply ? d.threadId : '', messageId: reply ? (d.messageId || '') : '' };
      if (realAtts.length) toast(root, 'Attaching ' + realAtts.length + ' file' + (realAtts.length === 1 ? '' : 's') + ' and sending…');
      api('/api/mail/act', { method: 'POST', body: body }).then(function (r) {
        if (r && r.status === 413) throw new Error('Those files are too big to send from here. Attach them from Documents or Drive instead.');
        if (r && r.status === 422) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error((j && j.error) || 'Could not attach a file'); });
        return ok(r);
      }).then(json).then(function (res) {
        if (!(res && (res.ok || res.drafted))) { toast(root, 'Gmail did not take it - check the address'); return; }
        var name = d.to[0].name || to;
        if (d.nudge) nudgeLater(root, name, to, d.subject);
        if (d.log) logToPipeline(root, name, to);
        toast(root, (res.drafted && !res.ok ? 'Saved as a Gmail draft' : 'Sent from Gmail') + (d.nudge ? ' · nudge set for 3 days' : '') + (d.log ? ' · logging to Pipeline' : ''));
        S().composeOpen = false;
        S().composeDraft = null;
        repaintMail();
      }).catch(function (err) { toast(root, errText(err, 'Gmail did not take that send')); });
    },
    'intel-ask': function () {},

    /* ---------- Email: inline "+ New column" box (same server path as the button: POST /api/mail/columns) ---------- */
    'mail-col-focus': function (el, root) {
      var input = root.getElementById && root.getElementById('newcolIn');
      if (input && input.focus) input.focus();
    },
    'mail-col-name': function () {},
    'mail-col-add': function (el, root) {
      var input = root.getElementById && root.getElementById('newcolIn');
      var name = String((input && input.value) || '').trim();
      if (!name) { if (input && input.focus) input.focus(); toast(root, 'Type a name for the column first'); return; }
      if (!writeOk()) { toast(root, 'Column created (fixture)'); return; }
      if (mailColAdding) return;
      mailColAdding = true;
      createMailColumn(name).then(function () {
        mailColAdding = false;
        if (input) { input.value = ''; if (input.blur) input.blur(); }
        refresh('mail');
        toast(root, 'Column ' + name + ' added - flag mail to fill it');
      }).catch(function () { mailColAdding = false; toast(root, 'Could not create that column'); });
    },

    /* ---------- Email: Junk / Not junk (a per-sender rule in email_rules, target 'junk' or 'notjunk') ---------- */
    'mail-junk': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var email = String(attr(el, 'data-email') || '').toLowerCase();
      var toJunk = attr(el, 'data-junk') !== '0';
      if (!email) { toast(root, 'No sender address on that email'); return; }
      if (!writeOk()) { toast(root, (toJunk ? 'Junk' : 'Not junk') + ' (fixture)'); return; }
      var target = toJunk ? 'junk' : 'notjunk';
      var before = ((S().mailBoard || {}).rules || []).slice();
      var stale = before.filter(function (r) { return r.matchType === 'sender' && String(r.matchValue || '').toLowerCase() === email && (r.target === 'junk' || r.target === 'notjunk'); });
      /* Optimistic: drop this sender's old junk rules and add the new one locally, then save. */
      var temp = { id: 'tmp-' + Date.now(), matchType: 'sender', matchValue: email, target: target, sticky: true };
      setBoardRules(before.filter(function (r) { return stale.indexOf(r) < 0; }).concat([temp]));
      S().mailRulesLive = S().mailBoard.rules;
      refresh('mail');
      var drops = stale.filter(function (r) { return UUID_RE.test(String(r.id || '')); }).map(function (r) {
        return api('/api/mail/rules', { method: 'POST', body: { delete: r.id } }).then(ok);
      });
      Promise.all(drops).then(function () {
        return api('/api/mail/rules', { method: 'POST', body: { matchType: 'sender', matchValue: email, target: target, sticky: true } }).then(ok).then(json);
      }).then(function (d) {
        if (!d || !d.saved) throw new Error('not saved');
        setBoardRules(d.rules);
        S().mailRulesLive = d.rules;
        refresh('mail');
        var made = d.rule && d.rule.id;
        toast(root, toJunk ? 'Mail from ' + email + ' goes to Junk' : 'Mail from ' + email + ' is back in your feed', function () {
          if (!made) return;
          api('/api/mail/rules', { method: 'POST', body: { delete: made } }).then(ok).then(json).then(function (r2) {
            if (r2 && r2.rules) { setBoardRules(r2.rules); S().mailRulesLive = r2.rules; }
            refresh('mail');
          }).catch(function () { toast(root, 'Could not undo that'); });
        });
      }).catch(function () {
        setBoardRules(before);
        S().mailRulesLive = before;
        refresh('mail');
        toast(root, 'Could not save that junk rule');
      });
    },

    /* ---------- Email: Delete = move to Gmail Trash (undo brings it back) ---------- */
    'mail-trash': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var id = attr(el, 'data-id') || (S().mailOpen && S().mailOpen.id) || '';
      if (!id) return;
      if (!GMAIL_ID.test(id) || !writeOk()) { toast(root, 'Deleted (fixture)'); return; }
      var board = S().mailBoard || {};
      var kept = (board.messages || []).filter(function (m) { return String(m.id) === String(id); })[0] || null;
      dropBoardMessage(id);
      if (S().mailOpen && S().mailOpen.id === id) { S().mailOpen = null; S().mailOpenThread = null; }
      refresh('mail');
      api('/api/mail/act', { method: 'POST', body: { action: 'trash', id: id } }).then(ok).then(json).then(function (d) {
        if (!d || !d.ok) throw new Error('not trashed');
        toast(root, 'Moved to Gmail Trash', function () {
          api('/api/mail/act', { method: 'POST', body: { action: 'untrash', id: id } }).then(ok).then(json).then(function (u) {
            if (!u || !u.ok) throw new Error('no');
            var b2 = S().mailBoard;
            if (kept && b2 && Array.isArray(b2.messages)) {
              b2.messages = b2.messages.concat([kept]).sort(function (a, b) { return (Number(b.at) || 0) - (Number(a.at) || 0); });
            }
            refresh('mail');
            toast(root, 'Back in your inbox');
          }).catch(function () { toast(root, 'Could not bring it back - it is in Gmail Trash for 30 days'); });
        });
      }).catch(function () {
        var b3 = S().mailBoard;
        if (kept && b3 && Array.isArray(b3.messages)) b3.messages = b3.messages.concat([kept]).sort(function (a, b) { return (Number(b.at) || 0) - (Number(a.at) || 0); });
        refresh('mail');
        toast(root, 'Gmail did not delete that email');
      });
    },

    /* ---------- Compose: inline link (select text, Link, paste the address) ---------- */
    'mail-link': function (el, root) {
      var cp = root.getElementById && root.getElementById('compose');
      var body = cp && cp.querySelector('[data-action="mail-body"]');
      if (!body) return;
      var sel = (root.getSelection ? root.getSelection() : null) || window.getSelection();
      var range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
      if (range && !body.contains(range.commonAncestorContainer)) range = null;
      if (!range && lastBodyRange && body.contains(lastBodyRange.commonAncestorContainer)) range = lastBodyRange;
      if (!range) {
        range = document.createRange();
        range.selectNodeContents(body);
        range.collapse(false);
      }
      linkRange = range.cloneRange();
      var row = cp.querySelector('.lnkin');
      if (!row) {
        row = document.createElement('div');
        row.className = 'lnkin';
        row.innerHTML = '<input data-action="mail-link-url" placeholder="Paste the link address (https://...)" autocomplete="off"><button type="button" class="p" data-action="mail-link-apply">Add link</button><button type="button" data-action="mail-link-cancel">Cancel</button>';
        var bar = cp.querySelector('.tbar');
        if (bar && bar.parentNode) bar.parentNode.insertBefore(row, bar.nextSibling);
      }
      var input = row.querySelector('input');
      var picked = String(linkRange.toString() || '').trim();
      if (input) {
        input.value = /^https?:\/\/\S+$/i.test(picked) ? picked : '';
        input.focus();
      }
    },
    'mail-link-url': function () {},
    'mail-link-cancel': function (el, root) {
      var cp = root.getElementById && root.getElementById('compose');
      var row = cp && cp.querySelector('.lnkin');
      if (row && row.parentNode) row.parentNode.removeChild(row);
      linkRange = null;
    },
    'mail-link-apply': function (el, root) {
      var cp = root.getElementById && root.getElementById('compose');
      var row = cp && cp.querySelector('.lnkin');
      var body = cp && cp.querySelector('[data-action="mail-body"]');
      var input = row && row.querySelector('input');
      var url = String((input && input.value) || '').trim();
      if (url && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = (/@/.test(url) && !/\//.test(url) ? 'mailto:' : 'https://') + url;
      if (!/^(https?:\/\/\S+|mailto:\S+@\S+)$/i.test(url)) { toast(root, 'That is not a web address'); if (input) input.focus(); return; }
      if (!body) return;
      var range = linkRange && body.contains(linkRange.commonAncestorContainer) ? linkRange : null;
      if (!range) { range = document.createRange(); range.selectNodeContents(body); range.collapse(false); }
      var a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
      if (range.collapsed) a.textContent = url.replace(/^mailto:/i, '');
      else a.appendChild(range.extractContents());
      range.insertNode(a);
      var after = document.createRange();
      after.setStartAfter(a);
      after.collapse(true);
      var sel = (root.getSelection ? root.getSelection() : null) || window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(after); }
      var d = composeState();
      d.body = String(body.innerText || body.textContent || '');
      d.bodyHtml = String(body.innerHTML || '');
      d.bodyHtmlFor = d.body;
      if (row && row.parentNode) row.parentNode.removeChild(row);
      linkRange = null;
      body.focus();
    },

    /* ---------- Compose: attachments (computer, Documents, Spaces, Drive) ---------- */
    'mail-attach-file': function (el, root) {
      var input = root.getElementById && root.getElementById('composeFile');
      if (!input) return;
      if (!input.__wired) {
        input.__wired = true;
        input.addEventListener('change', function () {
          if (input.files && input.files.length) addComposeFiles(root, input.files);
          input.value = '';
        });
      }
      input.click();
    },
    'mail-attach-pick': function (el, root) {
      var cp = root.getElementById && root.getElementById('compose');
      var w = cp && cp.querySelector('.cw');
      if (!w) return;
      var pick = w.querySelector('.pick');
      if (pick) { pick.parentNode.removeChild(pick); return; }
      pick = document.createElement('div');
      pick.className = 'pick';
      pick.id = 'composePick';
      w.appendChild(pick);
      pickerState.tab = pickerState.tab || 'docs';
      pickerState.q = '';
      paintPicker(root);
      pickerLoad(root, pickerState.tab);
    },
    'mail-pick-tab': function (el, root) {
      pickerState.tab = attr(el, 'data-tab') || 'docs';
      paintPicker(root);
      pickerLoad(root, pickerState.tab);
    },
    'mail-pick-q': function () {},
    'mail-pick-close': function (el, root) {
      var pick = root.getElementById && root.getElementById('composePick');
      if (pick && pick.parentNode) pick.parentNode.removeChild(pick);
    },
    'mail-pick-add': function (el, root) {
      var d = composeState();
      var item = {
        name: attr(el, 'data-name') || 'File',
        mime: attr(el, 'data-mime'),
        url: attr(el, 'data-url'),
        driveFileId: attr(el, 'data-drive'),
        stagedId: attr(el, 'data-staged')
      };
      var key = item.driveFileId || item.stagedId || item.url || item.name;
      if (d.attachments.some(function (a) { return (a.driveFileId || a.stagedId || a.url || a.name) === key; })) { toast(root, item.name + ' is already attached'); return; }
      d.attachments.push(item);
      el.classList.add('on');
      var em = el.querySelector('em');
      if (em) em.textContent = 'Attached';
      paintComposeAtts(root);
      toast(root, item.name + ' attached');
    },

    /* ---------- Compose: signature ---------- */
    'mail-sig': function () {},
    'mail-sig-toggle': function (el, root) {
      var d = composeState();
      d.sigOff = !d.sigOff;
      var box = root.getElementById && root.getElementById('composeSig');
      if (box) box.classList.toggle('off', !!d.sigOff);
      el.textContent = d.sigOff ? 'Add it back' : 'Remove';
    },
    'mail-sig-save': function (el, root) {
      var box = root.getElementById && root.getElementById('composeSig');
      var sb = box && box.querySelector('[data-action="mail-sig"]');
      var html = String((sb && sb.innerHTML) || '').trim();
      if (!html) { toast(root, 'Paste your signature into the box first'); return; }
      if (!writeOk()) { toast(root, 'Signature saved (fixture)'); return; }
      api('/api/mail/signature', { method: 'POST', body: { signature: html } }).then(ok).then(json).then(function (d) {
        if (!d || !d.saved) throw new Error('not saved');
        var cur = S().mailSig || {};
        S().mailSig = { html: String(d.signature || html), source: 'saved', needsScope: !!cur.needsScope };
        toast(root, 'Signature saved - it goes on every new email');
      }).catch(function () { toast(root, 'Could not save that signature'); });
    },

    /* ---------- Email: reader ---------- */
    'mail-open': function (el) {
      var id = attr(el, 'data-id');
      S().mailOpen = { id: id, threadId: attr(el, 'data-thread'), messageId: attr(el, 'data-mid'), email: attr(el, 'data-email'), from: attr(el, 'data-from'), subject: attr(el, 'data-subject'), preview: attr(el, 'data-preview') };
      S().mailOpenThread = null;
      S().mailOpenFailed = false;
      refresh('mail');
      if (!GMAIL_ID.test(id) || !writeOk()) return;
      markMailRead(id);
      loadThread(id).then(function (th) {
        if (!S().mailOpen || S().mailOpen.id !== id) return;
        S().mailOpenThread = th;
        refresh('mail');
      }).catch(function () {
        if (!S().mailOpen || S().mailOpen.id !== id) return;
        S().mailOpenFailed = true;
        refresh('mail');
      });
    },
    'mail-close': function () {
      S().mailOpen = null;
      S().mailOpenThread = null;
      if (S().composeOpen) { S().composeOpen = false; S().composeDraft = null; }
      repaintMail();
    },
    'mail-forward': function (el) {
      var th = S().mailOpenThread || {};
      var o = S().mailOpen || {};
      var subj = attr(el, 'data-subject') || o.subject || '';
      var from = attr(el, 'data-from') || o.from || '';
      var email = attr(el, 'data-email') || o.email || '';
      openCompose({ to: [], fwd: true, subject: /^fwd?:/i.test(subj) ? subj : 'Fwd: ' + subj, body: forwardBody(from, email, subj, th.text || o.preview || '') });
    },
    'mail-snooze': function (el, root) {
      var id = attr(el, 'data-id') || (S().mailOpen && S().mailOpen.id) || '';
      if (!id || !writeOk()) { toast(root, 'Snoozed (fixture)'); return; }
      api('/api/mail/act', { method: 'POST', body: { action: 'snooze', id: id, hours: 24 } }).then(ok).then(json).then(function (d) {
        if (!d || !d.ok) { toast(root, 'Gmail did not snooze that email'); return; }
        dropBoardMessage(id);
        S().mailOpen = null;
        S().mailOpenThread = null;
        refresh('mail');
        toast(root, 'Snoozed 24 hours');
      }).catch(function () { toast(root, 'Could not snooze that email'); });
    },
    'mail-done': function (el, root) {
      var id = attr(el, 'data-id') || (S().mailOpen && S().mailOpen.id) || '';
      if (!id || !writeOk()) { toast(root, 'Marked done (fixture)'); return; }
      api('/api/mail/act', { method: 'POST', body: { action: 'done', id: id } }).then(ok).then(function () {
        toast(root, 'Marked done'); refresh('mail');
      }).catch(function () { toast(root, 'Could not mark that done'); });
    },
    'mail-add-space': function (el, root) {
      var email = attr(el, 'data-email') || (S().mailOpen && S().mailOpen.email) || '';
      var name = attr(el, 'data-from') || (S().mailOpen && S().mailOpen.from) || email;
      withSpaces(function (packs) {
        if (!packs.length) { toast(root, 'No Spaces yet - make one in Spaces first'); return; }
        openPop(root, el, '<div style="font-weight:800;margin:2px 4px 6px">Add ' + esc(name) + ' to a Space</div>' + packs.slice(0, 40).map(function (p) {
          return '<button type="button" data-action="mail-space-pick" data-id="' + esc(p.id) + '" data-space="' + esc(p.name || 'Space') + '" data-email="' + esc(email) + '" data-name="' + esc(name) + '">' + esc(p.name || 'Space') + '</button>';
        }).join(''));
      });
    },
    'mail-space-pick': function (el, root) {
      closePop(root);
      var id = attr(el, 'data-id');
      if (!id || !writeOk()) { toast(root, 'Added (fixture)'); return; }
      api('/api/spaces/' + encodeURIComponent(id), { method: 'POST', body: { action: 'add-recipient', name: attr(el, 'data-name'), email: attr(el, 'data-email') } }).then(ok).then(json).then(function (d) {
        if (d && d.saved === false) throw new Error('not saved');
        toast(root, attr(el, 'data-name') + ' added to ' + attr(el, 'data-space'));
      }).catch(function () { toast(root, 'Could not add them to that Space'); });
    },

    /* ---------- Email: filters and columns (server email_columns is the source; ids are server keys) ---------- */
    'mail-filters': function (el, root) {
      var rules = (S().mailBoard && S().mailBoard.rules) || [];
      var names = {};
      userColumns().forEach(function (c) { names[c.id] = c.n; });
      var rows = rules.map(function (r) {
        return '<div style="display:flex;gap:8px;align-items:center;padding:4px 6px;font-size:12.5px"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">' + esc(r.matchType + ' ' + r.matchValue) + ' &rarr; <b>' + esc(names[r.target] || r.target) + '</b></span><button type="button" data-action="mail-rule-remove" data-rule="' + esc(r.id) + '" data-email="' + esc(r.matchValue) + '" title="Delete rule">&times;</button></div>';
      }).join('');
      openPop(root, el, '<div style="font-weight:800;margin:2px 4px 6px">Filing rules</div>' + (rows || '<div style="padding:4px 6px;font-size:12.5px;color:#6b7a90">No rules yet. Flag an email and tick "Always".</div>') + '<button type="button" data-action="mail-rule-new">+ New rule</button>');
    },
    'mail-rule-new': function (el, root) {
      closePop(root);
      var cols = userColumns();
      if (!cols.length) { toast(root, 'Make a column first'); return; }
      var match = window.prompt('File mail from this sender (email or domain)');
      if (match == null || !String(match).trim()) return;
      var pick = window.prompt('Into which column?\n\n' + cols.map(function (c, i) { return (i + 1) + '. ' + c.n; }).join('\n'), '1');
      var col = cols[(Number(pick) || 0) - 1] || cols.filter(function (c) { return c.n.toLowerCase() === String(pick || '').trim().toLowerCase(); })[0];
      if (!col) return;
      if (!writeOk()) { toast(root, 'Rule (fixture)'); return; }
      api('/api/mail/rules', { method: 'POST', body: { matchType: /@/.test(match) ? 'sender' : 'domain', matchValue: String(match).trim(), target: col.id, sticky: true } }).then(ok).then(json).then(function (d) {
        if (!d || !d.saved) throw new Error('not saved');
        setBoardRules(d.rules);
        refresh('mail');
        toast(root, 'Rule saved');
      }).catch(function () { toast(root, 'Could not save that rule'); });
    },
    'mail-rule-remove': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      closePop(root);
      var id = attr(el, 'data-rule');
      var email = attr(el, 'data-email');
      if (!id || !writeOk()) { toast(root, 'Rule removed (fixture)'); return; }
      var before = ((S().mailBoard || {}).rules || []).slice();
      setBoardRules(before.filter(function (r) { return String(r.id) !== String(id); }));
      refresh('mail');
      api('/api/mail/rules', { method: 'POST', body: { delete: id } }).then(ok).then(json).then(function (d) {
        if (!d || !d.saved) throw new Error('not saved');
        setBoardRules(d.rules);
        toast(root, 'Stopped filing ' + email);
      }).catch(function () { setBoardRules(before); refresh('mail'); toast(root, 'Could not remove that rule'); });
    },
    'mail-col-menu': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var key = attr(el, 'data-col');
      var name = attr(el, 'data-name') || '';
      openPop(root, el, '<button type="button" data-action="mail-col-rename" data-col="' + esc(key) + '" data-name="' + esc(name) + '">Rename</button>'
        + '<button type="button" data-action="mail-col-delete" data-col="' + esc(key) + '" data-name="' + esc(name) + '">Delete column</button>'
        + '<button type="button" data-action="mail-col-new">+ New column</button>');
    },
    'mail-col-rename': function (el, root) {
      closePop(root);
      var next = window.prompt('Rename this column', attr(el, 'data-name') || '');
      if (next == null || !String(next).trim()) return;
      renameMailColumn(root, attr(el, 'data-col'), String(next).trim());
    },
    'mail-col-title': function () {},
    'mail-col-delete': function (el, root) {
      closePop(root);
      var key = attr(el, 'data-col');
      if (!key || !window.confirm('Delete the "' + (attr(el, 'data-name') || key) + '" column? The emails stay in your inbox.')) return;
      if (!writeOk()) { toast(root, 'Column deleted (fixture)'); return; }
      api('/api/mail/columns', { method: 'POST', body: { action: 'delete', key: key } }).then(ok).then(json).then(function (d) {
        if (!d || !d.saved) throw new Error('not saved');
        setBoardColumns(d.columns);
        ((S().mailBoard || {}).messages || []).forEach(function (m) { if (m.column === key) m.column = ''; });
        refresh('mail');
        toast(root, 'Column deleted');
      }).catch(function () { toast(root, 'Could not delete that column'); });
    },
    'mail-col-new': function (el, root) {
      closePop(root);
      var name = window.prompt('New column name');
      if (!name || !String(name).trim()) return;
      if (!writeOk()) { toast(root, 'Column created (fixture)'); return; }
      createMailColumn(String(name).trim()).then(function () {
        refresh('mail');
        toast(root, 'Column added - flag mail to fill it');
      }).catch(function () { toast(root, 'Could not create that column'); });
    },
    'mail-col-drag': function () {},
    'mail-flag': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var id = attr(el, 'data-id');
      var email = attr(el, 'data-email');
      var pop = root.getElementById && root.getElementById('pop');
      if (!pop) return;
      var who = root.getElementById('popwho');
      var from = root.getElementById('popfrom');
      var opts = root.getElementById('popopts');
      var always = root.getElementById('always');
      if (who) who.textContent = attr(el, 'data-subject') || '';
      if (from) from.textContent = email || '';
      if (always) always.checked = true;
      var cur = mailColumnOf(id);
      if (opts) {
        opts.innerHTML = userColumns().map(function (c) {
          return '<div class="opt" data-action="mail-flag-into" data-col="' + esc(c.id) + '" data-id="' + esc(id) + '" data-email="' + esc(email) + '"><i style="background:' + esc(c.c) + '"></i>' + esc(c.n) + '<em>' + (cur === c.id ? 'already here' : c.ids.length + ' emails') + '</em></div>';
        }).join('') + '<div class="opt new" data-action="mail-flag-into" data-col="new" data-id="' + esc(id) + '" data-email="' + esc(email) + '" data-from="' + esc(attr(el, 'data-from')) + '"><i></i>+ New column for this</div>';
      }
      var r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      var host = root.host && root.host.getBoundingClientRect ? root.host.getBoundingClientRect() : { top: 0, left: 0 };
      if (r) { pop.style.top = Math.max(8, r.bottom - host.top + 6) + 'px'; pop.style.left = Math.max(8, r.right - host.left - 290) + 'px'; }
      pop.classList.add('on');
    },
    'mail-flag-into': function (el, root) {
      var colId = attr(el, 'data-col');
      var id = attr(el, 'data-id');
      var email = attr(el, 'data-email');
      var always = root.getElementById && root.getElementById('always');
      var sticky = !always || always.checked;
      var pop = root.getElementById && root.getElementById('pop');
      if (pop) pop.classList.remove('on');
      if (!writeOk()) { toast(root, 'Filed (fixture)'); return; }
      var keyP;
      if (colId === 'new') {
        var n = window.prompt('Name the new column', attr(el, 'data-from') || 'New column');
        if (!n || !String(n).trim()) return;
        keyP = createMailColumn(String(n).trim());
      } else keyP = Promise.resolve(colId);
      keyP.then(function (key) { fileMail(root, id, key, sticky, email); }).catch(function () { toast(root, 'Could not create that column'); });
    },

    /* ---------- Email: People grid (08e) and person pop-up (08f) ---------- */
    'mail-view': function (el) {
      S().mailView = attr(el, 'data-view') || 'inbox';
      S().mailSortOpen = false;
      S().mailBoxMenuOpen = false;
      refresh('mail');
    },
    'mail-people-panel': function (el) {
      var next = attr(el, 'data-panel') || '';
      S().mailPeoplePanel = S().mailPeoplePanel === next ? '' : next;
      refresh('mail');
    },
    'mail-people-tag': function (el) {
      var t = attr(el, 'data-tag');
      S().mailPeopleTag = S().mailPeopleTag === t ? '' : t;
      refresh('mail');
    },
    'mail-people-clear': function () {
      S().mailPeopleTag = '';
      S().mailPeopleQ = '';
      refresh('mail');
    },
    'mail-people-search': function () {},
    'mail-closed-search': function () {},
    'mail-closed-toggle': function () {
      S().mailPeopleDrawer = !S().mailPeopleDrawer;
      refresh('mail');
    },
    'mail-closed-open': function () {
      S().mailPeopleDrawer = true;
      refresh('mail');
    },
    'mail-sort-menu': function () {
      S().mailSortOpen = !S().mailSortOpen;
      S().mailBoxMenuOpen = false;
      refresh('mail');
    },
    'mail-sort': function (el) {
      S().mailPeopleSort = attr(el, 'data-s') || 'my order';
      S().mailSortOpen = false;
      refresh('mail');
    },
    'mail-box-menu': function (el) {
      S().mailPeopleMenu = attr(el, 'data-id');
      S().mailBoxMenuOpen = !S().mailBoxMenuOpen;
      S().mailSortOpen = false;
      refresh('mail');
    },
    'mail-box-open': function (el) {
      S().mailPerson = attr(el, 'data-id');
      S().mailPpTab = 'all';
      S().mailBoxMenuOpen = false;
      refresh('mail');
    },
    'mail-pp-close': function () {
      S().mailPerson = '';
      refresh('mail');
    },
    'mail-pp-tab': function (el) {
      S().mailPpTab = attr(el, 'data-tab') || 'all';
      refresh('mail');
    },
    'mail-pp-expand': function (el, root) {
      if (root.querySelectorAll) root.querySelectorAll('.ppm.open').forEach(function (n) { n.classList.remove('open'); });
      if (el && el.classList) el.classList.add('open');
      var pane = root.querySelector && root.querySelector('#ppread');
      var mid = attr(el, 'data-mid');
      var sj = attr(el, 'data-sj');
      var pv = attr(el, 'data-pv');
      var dir = attr(el, 'data-dir') || 'in';
      var who = attr(el, 'data-who');
      var btn = ' data-id="' + esc(attr(el, 'data-id')) + '" data-mid="' + esc(mid) + '" data-hdr="' + esc(attr(el, 'data-hdr')) + '" data-tid="' + esc(attr(el, 'data-tid')) + '" data-sj="' + esc(sj) + '"';
      function paint(text, note) {
        if (!pane) return;
        pane.innerHTML = '<div class="rh"><div class="w">' + esc(dir === 'out' ? 'You to ' + who : who + ' to you') + '</div><h3>' + esc(sj) + '</h3></div>'
          + '<div class="rb" style="white-space:pre-wrap">' + esc(text) + (note ? '<div class="dempty">' + esc(note) + '</div>' : '') + '</div>'
          + '<div class="rf"><button class="btn pri" data-action="mail-pp-go" data-go="reply"' + btn + '>Reply</button><button class="btn" data-action="mail-pp-go" data-go="fwd"' + btn + '>Forward</button><button class="btn" data-action="mail-pp-go" data-go="addspace"' + btn + '>Add to a Space</button></div>';
      }
      var cached = (S().mailBodies || {})[mid];
      if (cached != null) { paint(cached); return; }
      var canLoad = GMAIL_ID.test(mid) && writeOk();
      paint(pv, canLoad ? 'Loading the full email…' : '');
      if (!canLoad) return;
      loadThread(mid).then(function (th) {
        if (!el.classList.contains('open')) return;
        paint(th.text || pv);
      }).catch(function () { paint(pv, 'Could not load the full email.'); });
    },
    'mail-pp-go': function (el, root) {
      var goTo = attr(el, 'data-go');
      var box = personBox(attr(el, 'data-id') || S().mailPerson);
      if (!box) { toast(root, 'That person is no longer in your mail'); return; }
      if (goTo === 'pipeline') { goPersonPipeline(box); return; }
      if (goTo === 'space') { goPersonSpace(root, box); return; }
      if (goTo === 'book') { openBook([box.n]); return; }
      var addr = (box.addrs || [])[0] || box.o || '';
      if (goTo === 'addspace') { el.setAttribute('data-email', addr); el.setAttribute('data-from', box.n); actions['mail-add-space'](el, root); return; }
      var row = pickPersonMail(box, attr(el, 'data-mid'));
      if (goTo === 'compose' || !row) { openCompose({ to: addr ? [{ email: addr, name: box.n }] : [] }); return; }
      var sj = row[1] || '';
      if (goTo === 'fwd') {
        openCompose({ to: [], fwd: true, subject: /^fwd?:/i.test(sj) ? sj : 'Fwd: ' + sj, body: forwardBody(box.n, addr, sj, (S().mailBodies || {})[row[6]] || row[2] || '') });
        return;
      }
      openCompose({ to: addr ? [{ email: addr, name: box.n }] : [], reply: true, subject: /^re:/i.test(sj) ? sj : 'Re: ' + sj, threadId: row[4] || '', messageId: row[5] || '' });
    },
    'mail-box-close': function (el, root) {
      var box = findPeopleBox(attr(el, 'data-id'), true);
      if (!box) return;
      var prev = !!box.closed;
      box.closed = true;
      S().mailPeopleDrawer = true;
      persistPeopleBoxes();
      refresh('mail');
      toast(root, box.n + ' closed - it keeps collecting mail in the Closed list', function () {
        box.closed = prev;
        persistPeopleBoxes();
        refresh('mail');
      });
    },
    'mail-box-reopen': function (el, root) {
      var box = findPeopleBox(attr(el, 'data-id'), true);
      if (!box) return;
      box.closed = false;
      persistPeopleBoxes();
      refresh('mail');
      toast(root, box.n + ' is back on the grid');
    },
    'mail-box-reopen-all': function (el, root) {
      peopleBoxList().forEach(function (b) { b.closed = false; });
      S().mailPeopleDrawer = false;
      persistPeopleBoxes();
      refresh('mail');
      toast(root, 'All boxes reopened');
    },
    'mail-box-tag-add': function (el) {
      var box = findPeopleBox(attr(el, 'data-id'), true);
      if (!box) return;
      var raw = window.prompt('Add a tag (one word, e.g. investor)');
      if (!raw) return;
      var v = String(raw).trim().toLowerCase().replace(/^#/, '');
      box.tags = box.tags || [];
      if (v && box.tags.indexOf(v) < 0) box.tags.push(v);
      persistPeopleBoxes();
      refresh('mail');
    },
    'mail-box-file': function (el, root) { downloadMailAttachment(root, attr(el, 'data-mid'), attr(el, 'data-aid'), attr(el, 'data-file')); },
    'mail-att-open': function (el, root) { downloadMailAttachment(root, attr(el, 'data-mid'), attr(el, 'data-aid'), attr(el, 'data-name')); },
    'mail-box-new': function (el, root) {
      var n = window.prompt('Who is this box for? (a person, a company, or a deal)');
      if (!n || !String(n).trim()) return;
      var addrRaw = window.prompt('Their email address(es), comma separated - mail from them lands in this box', '') || '';
      var addrs = addrRaw.split(/[,\s]+/).map(function (a) { return a.trim().toLowerCase(); }).filter(function (a) { return EMAIL_RE.test(a); });
      var list = peopleBoxList();
      list.unshift({ id: 'n' + Date.now(), n: String(n).trim(), o: addrs[0] || '', c: '#12a36a', tags: [], addrs: addrs, closed: false });
      persistPeopleBoxes();
      refresh('mail');
      toast(root, 'Box created' + (addrs.length ? ' - mail from ' + addrs[0] + ' lands here' : ' - add an email address from its menu'));
    },
    'mail-box-build': function (el, root) {
      var list = peopleBoxList();
      var have = {};
      list.forEach(function (b) { (b.addrs || []).forEach(function (a) { have[String(a).toLowerCase()] = 1; }); });
      var added = 0;
      (S().contacts || []).forEach(function (c) {
        var e = String(c.email || '').toLowerCase();
        if (!EMAIL_RE.test(e) || have[e]) return;
        have[e] = 1;
        added += 1;
        list.push({ id: 'c' + String(c.id || e).replace(/[^a-z0-9]/gi, '').slice(0, 30), n: c.name || e, o: e, c: '#2e6bf2', tags: c.category ? [String(c.category).toLowerCase().replace(/\s+/g, '-')] : [], addrs: [e], closed: false });
      });
      persistPeopleBoxes();
      refresh('mail');
      toast(root, added ? added + ' boxes built from your Contacts' : 'Every contact already has a box');
    },
    'mail-box-act': function (el, root) {
      var id = S().mailPeopleMenu;
      var a = attr(el, 'data-a');
      S().mailBoxMenuOpen = false;
      var view = personBox(id);
      if (!view) { refresh('mail'); return; }
      if (a === 'open') { S().mailPerson = view.id; S().mailPpTab = 'all'; refresh('mail'); return; }
      if (a === 'pipeline') { goPersonPipeline(view); return; }
      if (a === 'space') { goPersonSpace(root, view); return; }
      var box = findPeopleBox(id, a !== 'remove');
      if (a === 'remove') {
        if (!box) { refresh('mail'); toast(root, view.n + ' is built from your mail - close it instead to hide it'); return; }
        if (!window.confirm('Remove the ' + box.n + ' box? Its mail stays in the Inbox.')) { refresh('mail'); return; }
        var list = peopleBoxList();
        var at = list.indexOf(box);
        if (at >= 0) list.splice(at, 1);
        persistPeopleBoxes();
        refresh('mail');
        toast(root, 'Box removed', function () { list.splice(Math.max(0, at), 0, box); persistPeopleBoxes(); refresh('mail'); });
        return;
      }
      if (!box) { refresh('mail'); return; }
      if (a === 'rename') {
        var next = window.prompt('Rename box', box.n);
        if (next && String(next).trim()) { box.n = String(next).trim(); persistPeopleBoxes(); }
      } else if (a === 'addr') {
        var v = String(window.prompt('Add an email address to ' + box.n) || '').trim().toLowerCase();
        if (v && !EMAIL_RE.test(v)) toast(root, 'That is not an email address');
        else if (v) { box.addrs = (box.addrs || []).concat(v); persistPeopleBoxes(); toast(root, 'Mail from ' + v + ' now files under ' + box.n); }
      } else if (a === 'tag') {
        var t = window.prompt('Add a tag');
        if (t) { box.tags = box.tags || []; box.tags.push(String(t).toLowerCase().replace(/^#/, '')); persistPeopleBoxes(); }
      } else if (a === 'close') {
        box.closed = true; S().mailPeopleDrawer = true; persistPeopleBoxes(); toast(root, box.n + ' closed');
      }
      refresh('mail');
    },
    'mail-box-drag': function () {},
    'mail-loose-drag': function () {},
    'mail-feed-tab': function (el) {
      S().mailFeedTab = attr(el, 'data-tab') || 'everything';
      refresh('mail');
    },
    'mail-task': function (el, root) {
      var title = attr(el, 'data-subject') || 'Email follow-up';
      return addTask(title, 'today').then(function () { toast(root, 'Task created'); }).catch(function () { toast(root, 'Could not create that task'); });
    },
    'play-pad': function (el, root) {
      var M = window.__playMount;
      if (M && typeof M.openPop === 'function') { M.openPop(el); return; }
      soon(root, 'Play pad');
    },
    'play-go': function (el, root) {
      var room = attr(el, 'data-view') || 'war';
      var map = { war: 'war', studio: 'war', li: 'people', pipe: 'contacts', spaces: 'work', msg: 'mail', news: 'news', done: 'done', contacts: 'people', team: 'mail', dash: 'war' };
      var M = window.__playMount;
      if (M && M.pop) M.pop.classList.remove('show');
      if (room === 'iq') { window.open('https://4ormiq.com', '_blank', 'noopener'); return; }
      go(map[room] || 'war');
      toast(root, 'Opening that desk');
    },
    'play-pad-off': function () {},
    'play-run': function (el, root) {
      var M = window.__playMount;
      if (!M || !M.rows) { go('war'); return; }
      var idx = M.todayIdx || 0;
      var due = M.rows.filter(function (r) { return r.d && (r.d[idx] === 'due' || r.d[idx] === 'next'); })[0];
      var rm = due && due.room ? due.room : 'war';
      go(rm === 'dash' ? 'room' : rm);
      toast(root, due ? ('Running ' + due.n) : "Today's plays");
    },
    'play-done': function (el, root) {
      var M = window.__playMount;
      if (!M || !M.cur) return;
      var cur = M.cur;
      var on = cur.r.d[cur.i] === 'done';
      var next = on ? 'open' : 'done';
      cur.r.d[cur.i] = on ? 'due' : 'done';
      if (cur.r.pads && cur.r.pads[cur.i]) cur.r.pads[cur.i].state = next === 'done' ? 'done' : 'due';
      if (M.pop) M.pop.classList.remove('show');
      if (typeof M.render === 'function') M.render();
      toast(root, on ? (cur.r.n + ' turned back on') : ('Light off — ' + cur.r.n + ' done'), function () {
        cur.r.d[cur.i] = on ? 'done' : 'due';
        if (typeof M.render === 'function') M.render();
      });
      var id = cur.r.id;
      var day = (cur.r.pads && cur.r.pads[cur.i] && cur.r.pads[cur.i].day) || attr(el, 'data-day');
      if (!id || !day || !writeOk()) return;
      if (next === 'done') fourmSound(M.rows.some(function (r) { return r.d && r.d[M.todayIdx || 0] === 'due'; }) ? 'pop' : 'levelUp');
      api('/api/playbook', { method: 'POST', body: { rhythmId: id, day: day, status: next } }).then(ok).then(json).then(function (d) {
        if (d && !d.error && d.rows && window.STATE) window.STATE.playbook = d;
      }).catch(function () { toast(root, 'Could not save that play'); });
    },
    'play-later': function (el, root) {
      var M = window.__playMount;
      if (!M || !M.cur) return;
      var cur = M.cur;
      if (M.pop) M.pop.classList.remove('show');
      if (cur.r.d[cur.i] === 'due') {
        cur.r.d[cur.i] = 'next';
        if (cur.r.pads && cur.r.pads[cur.i]) cur.r.pads[cur.i].state = 'snoozed';
        if (typeof M.render === 'function') M.render();
      }
      toast(root, cur.r.n + ' snoozed 2 hours');
      var id = cur.r.id;
      var day = (cur.r.pads && cur.r.pads[cur.i] && cur.r.pads[cur.i].day) || '';
      if (!id || !day || !writeOk()) return;
      api('/api/playbook', { method: 'POST', body: { rhythmId: id, day: day, status: 'snoozed' } }).catch(function () {});
    },
    'play-add': function (el, root) {
      var name = window.prompt('Rhythm name');
      if (!name) return;
      name = String(name).trim();
      if (!name) return;
      if (!writeOk()) { toast(root, 'Rhythm (fixture)'); return; }
      api('/api/playbook', { method: 'POST', body: { name: name } }).then(ok).then(json).then(function (d) {
        if (!d || d.error || !Array.isArray(d.rows)) throw new Error('rhythm');
        if (window.STATE) window.STATE.playbook = d;
        refresh('play');
        toast(root, 'Rhythm added');
      }).catch(function () { toast(root, 'Could not add that rhythm'); });
    },
    'play-month': function (el, root) {
      var ov = root.getElementById && root.getElementById('ov');
      if (ov) ov.classList.add('open');
    },
    'play-month-close': function (el, root) {
      var ov = root.getElementById && root.getElementById('ov');
      if (ov) ov.classList.remove('open');
    },
    'play-voice-rec': function () {},
    'play-voice-save': function () {},
    'play-voice-discard': function () {},
    'play-voice-dest': function (el, root) {
      root.querySelectorAll('.dest em').forEach(function (x) { x.classList.remove('on'); });
      el.classList.add('on');
    },
    'play-tx': function () {},
    'cal-view': function (el) {
      var cal = window.__redesignCal;
      if (cal && typeof cal.setView === 'function') cal.setView(attr(el, 'data-v') || 'week');
    },
    'cal-nav': function (el) {
      var cal = window.__redesignCal;
      if (cal && typeof cal.nav === 'function') cal.nav(attr(el, 'data-dir') || 'today');
    },
    'cal-nl': function () {},
    'cal-event': function () {},
    'cal-sug': function () {},
    'cal-save': function () {},
    'cal-del': function () {},
    'cal-dup': function () {},
    'cal-undo': function () {},
    'cal-zoom': function () {},
    'cal-pick': function () {},
    'cal-toggle': function (el) {
      var cal = window.__redesignCal;
      var keys = ['meet', 'inv', 'pay', 'mile', 'plays'];
      var all = el.parentNode ? Array.prototype.slice.call(el.parentNode.querySelectorAll('[data-action="cal-toggle"]')) : [];
      var key = attr(el, 'data-c') || keys[all.indexOf(el)] || '';
      if (cal && typeof cal.toggleCal === 'function' && key) {
        var shown = cal.toggleCal(key);
        el.classList.toggle('off', !shown);
        var bx = el.querySelector('.bx');
        if (bx && key !== 'plays') bx.innerHTML = shown ? '&#10003;' : '';
      }
    },
    'cal-mini': function () {},
    'cal-title': function () {},
    'cal-notes': function () {},
    'cal-date': function () {},
    'cal-time': function () {},
    'cal-select': function () {},
    'cal-people': function () {},
    'cal-accept': function () {
      var cal = window.__redesignCal;
      if (cal && typeof cal.keepAll === 'function') cal.keepAll();
    },
    'cal-replan': function () {
      var cal = window.__redesignCal;
      if (cal && typeof cal.replan === 'function') cal.replan();
    },
    'cal-keep': function (el) {
      var cal = window.__redesignCal;
      var sug = el.closest && el.closest('.ev.sug');
      if (cal && typeof cal.keepSug === 'function' && sug) cal.keepSug(Number(sug.dataset.si), true);
    },
    'cal-later': function (el) {
      var cal = window.__redesignCal;
      var sug = el.closest && el.closest('.ev.sug');
      if (cal && typeof cal.keepSug === 'function' && sug) cal.keepSug(Number(sug.dataset.si), false, true);
    },
    'cal-drop': function (el) {
      var cal = window.__redesignCal;
      var sug = el.closest && el.closest('.ev.sug');
      if (cal && typeof cal.keepSug === 'function' && sug) cal.keepSug(Number(sug.dataset.si), false);
    },
    'cal-rail': function (el) {
      var cal = window.__redesignCal;
      if (!cal || typeof cal.setRail !== 'function') return;
      var dir = attr(el, 'data-dir');
      if (dir === 'open') cal.setRail(false);
      else if (dir === 'close') cal.setRail(true);
      else cal.setRail(!cal.railClosed());
    },
    'cal-pop-close': function () {
      var cal = window.__redesignCal;
      if (cal && typeof cal.closePop === 'function') cal.closePop();
    },
    'cal-nl-focus': function (el, root) {
      var cal = window.__redesignCal;
      if (cal && typeof cal.setRail === 'function') cal.setRail(false);
      var inp = root.getElementById && root.getElementById('nlIn');
      if (inp) inp.focus();
    },
    'cal-allday': function (el) {
      var cal = window.__redesignCal;
      if (cal && typeof cal.openEvent === 'function') cal.openEvent(attr(el, 'data-i'));
    },
    'cal-cell': function (el) { actions['cal-year-day'](el); },
    'cal-more': function (el) { actions['cal-year-day'](el); },
    'cal-year-day': function (el) {
      var cal = window.__redesignCal;
      var k = attr(el, 'data-d') || attr(el.closest && el.closest('[data-d]'), 'data-d');
      if (!cal || !k) return;
      cal.focusTo(k);
      cal.setView('day');
    },
    'cal-mini-day': function (el) {
      var cal = window.__redesignCal;
      var k = attr(el, 'data-d');
      if (cal && typeof cal.focusTo === 'function' && k) cal.focusTo(k);
    },
    'cal-hint-close': function (el) {
      var n = el.parentNode;
      if (n) n.remove();
    },
    'cal-prep': function (el) {
      var title = attr(el, 'data-title');
      var id = attr(el, 'data-id');
      if (!title) { go('war'); return; }
      go('war');
      setTimeout(function () {
        var wr = warRoot();
        if (!wr) return;
        var fake = document.createElement('span');
        fake.setAttribute('data-id', 'cal:' + (id || title));
        fake.setAttribute('data-title', 'Prep: ' + title);
        actions['plan-open'](fake, wr);
      }, 120);
    },
    'cal-war': function () { go('war'); },
    'play-beat': function (el, root) {
      var ov = root.getElementById && root.getElementById('ov');
      if (ov) { ov.classList.add('open'); return; }
      soon(root, 'Longer beat');
    },
    'play-retry': function () {
      if (window.STATE) window.STATE.playbookError = false;
      if (typeof window.paintRedesignPlaybook === 'function') window.paintRedesignPlaybook();
      if (window.__portLoadC) window.__portLoadC('playbook');
      else refresh('play');
    },
    'zoom-retry': function (el, root) {
      if (window.STATE) window.STATE.zoomError = false;
      toast(root, 'Loading meetings');
      if (window.__portLoadC) window.__portLoadC('znotes');
      else refresh('zoom');
    },
    'done-retry': function (el, root) {
      if (window.STATE) window.STATE.snapsError = false;
      toast(root, 'Loading snapshots');
      if (window.__portLoadC) window.__portLoadC('done');
      else refresh('done');
    },
    'cal-mini-nav': function (el) {
      var cal = window.__redesignCal;
      if (cal && typeof cal.navMonth === 'function') cal.navMonth(attr(el, 'data-dir') || 'next');
    },
    'play-ms': function () {},
    'zoom-open': function (el, root) {
      var i = Number(attr(el, 'data-i'));
      var Z = window.__zoomMount;
      if (Z && typeof Z.open === 'function') { Z.open(i); return; }
      soon(root, 'Open meeting');
    },
    'zoom-close': function (el, root) {
      var Z = window.__zoomMount;
      if (Z && typeof Z.show === 'function') Z.show(false);
    },
    'zoom-edit': function (el, root) {
      var id = attr(el, 'data-id');
      var cur = attr(el, 'data-title') || '';
      var next = window.prompt('Meeting title', cur);
      if (next == null || !id) return;
      if (!writeOk()) { toast(root, 'Renamed (fixture)'); return; }
      api('/api/zoom/' + encodeURIComponent(id), { method: 'PATCH', body: { title: String(next).trim() } }).then(ok).then(function () {
        toast(root, 'Title saved'); refresh('zoom');
      }).catch(function () { toast(root, 'Could not edit that note'); });
    },
    'zoom-archive': function (el, root) {
      var id = attr(el, 'data-id');
      var card = el.closest('.mc');
      if (card) card.style.display = 'none';
      var live = !!id && writeOk();
      var prior = (S().zoomNotes || []).slice();
      if (live) S().zoomNotes = prior.filter(function (n) { return String(n.id) !== String(id); });
      toast(root, 'Meeting deleted', function () {
        if (card) card.style.display = '';
        if (!live) return;
        S().zoomNotes = prior;
        api('/api/zoom/' + encodeURIComponent(id), { method: 'PATCH', body: { archived: false } }).then(ok).then(function () { refresh('zoom'); })
          .catch(function () { toast(root, 'Could not bring that meeting back'); });
      });
      if (!live) return;
      /* Soft delete on the server (deleted_at); Undo restores with archived:false. */
      api('/api/zoom/' + encodeURIComponent(id), { method: 'PATCH', body: { archived: true } }).then(ok).catch(function () {
        S().zoomNotes = prior;
        if (card) card.style.display = '';
        refresh('zoom');
        toast(root, 'Could not delete that meeting');
      });
    },
    'zoom-refresh': function (el, root) {
      if (!writeOk()) { toast(root, 'Refresh (fixture)'); return; }
      toast(root, 'Pulling new Zoom and Granola notes');
      api('/api/zoom-notes', { method: 'POST', body: {} }).then(ok).then(function () {
        return api('/api/zoom-notes', { method: 'GET' }).then(ok).then(json);
      }).then(function (d) {
        if (d && d.notes && window.STATE) window.STATE.zoomNotes = d.notes;
        refresh('zoom');
        toast(root, 'Meetings refreshed');
      }).catch(function () { toast(root, 'Could not refresh Zoom notes'); });
    },
    'zoom-add': function (el, root) {
      var title = window.prompt('Meeting title', 'Meeting note');
      if (title == null) return;
      title = String(title).trim() || 'Meeting note';
      if (!writeOk()) { toast(root, 'Note (fixture)'); return; }
      api('/api/zoom', { method: 'POST', body: { title: title, attendees: '', others: '', solo: true } }).then(ok).then(json).then(function (row) {
        if (row && window.STATE) {
          window.STATE.zoomNotes = window.STATE.zoomNotes || [];
          window.STATE.zoomNotes.unshift(row);
        }
        refresh('zoom');
        toast(root, 'Note added');
      }).catch(function () { toast(root, 'Could not add that note'); });
    },
    'zoom-filter': function (el, root) {
      var key = attr(el, 'data-filter') || 'all';
      S().zoomFilter = key;
      refresh('zoom');
    },
    'zoom-src': function (el, root) {
      var src = attr(el, 'data-src') || 'all';
      S().zoomSrc = /granola/i.test(src) ? 'granola' : (/^zoom$/i.test(src) ? 'zoom' : 'all');
      refresh('zoom');
      setTimeout(function () {
        var zr = document.getElementById('zoomDesk');
        zr = zr && zr.shadowRoot;
        if (zr) zr.querySelectorAll('[data-action="zoom-src"]').forEach(function (c) { c.classList.toggle('on', attr(c, 'data-src') === src); });
      }, 80);
    },
    'zoom-sort': function (el, root) {
      S().zoomSort = attr(el, 'data-sort') || 'newest';
      root.querySelectorAll('[data-action="zoom-sort"]').forEach(function (c) {
        c.classList.toggle('on', attr(c, 'data-sort') === S().zoomSort);
      });
      refresh('zoom');
    },
    'zoom-search': function () {},
    'zoom-task': function (el, root) {
      var title = attr(el, 'data-title') || 'Meeting follow-up';
      var bucket = attr(el, 'data-bucket') || 'today';
      var aid = attr(el, 'data-aid');
      var req = aid ? zoomPatch(aid, { status: 'tasked', column: bucket }) : addTask(title, bucket);
      return req.then(function () {
        var row = el.closest && el.closest('.owe');
        if (row) row.style.opacity = '.45';
        el.disabled = true;
        toast(root, 'Added to ' + (bucket === 'week' ? 'This week' : 'Today'));
        refresh('war');
      }).catch(function () { toast(root, 'Could not create that task'); });
    },
    'zoom-ask-input': function () {},
    'zoom-ask': function (el, root) {
      var box = root.querySelector('.ask input');
      var q = box ? String(box.value || '').trim() : '';
      if (!q) { toast(root, 'Ask about this meeting'); return; }
      var Z = window.__zoomMount;
      var rd = root.getElementById && root.getElementById('rd');
      var openId = '';
      if (Z && Z.meetings && rd) {
        var t = rd.querySelector('[data-action="zoom-edit"]');
        openId = t ? attr(t, 'data-id') : '';
      }
      if (!openId || !writeOk()) { toast(root, 'Open a saved meeting first'); return; }
      toast(root, 'Asking 4orm Intelligence');
      api('/api/zoom/' + encodeURIComponent(openId) + '/ask', { method: 'POST', body: { q: q } }).then(ok).then(json).then(function (d) {
        var ans = String((d && d.answer) || 'No answer from this meeting.');
        var box2 = root.querySelector('.ai');
        if (box2) {
          var p2 = document.createElement('p');
          p2.className = 'answer';
          p2.textContent = q + ' — ' + ans;
          box2.appendChild(p2);
        }
      }).catch(function () { toast(root, 'Could not ask about this meeting'); });
    },
    'zoom-contact': function (el) {
      var name = attr(el, 'data-name');
      var ps = document.getElementById('pSearch');
      if (ps) ps.value = name;
      S().peopleFocus = name;
      go('people');
      var c = (S().contacts || []).filter(function (x) { return String(x.name || '').toLowerCase() === String(name).toLowerCase(); })[0];
      if (c && typeof window.openContactCard === 'function') window.openContactCard(c.id);
      else if (typeof window.renderPeople === 'function') window.renderPeople(name);
      var Z = window.__zoomMount;
      if (Z && typeof Z.show === 'function') Z.show(false);
    },
    'zoom-transcript': function (el, root) {
      var Z = window.__zoomMount;
      var x = Z && Z.meetings ? Z.meetings[Number(attr(el, 'data-i'))] : null;
      var text = x && x.transcript ? String(x.transcript) : '';
      if (!text) { toast(root, 'No transcript on this meeting'); return; }
      var rd = root.getElementById && root.getElementById('rd');
      if (!rd) return;
      var old = rd.querySelector('.transcript');
      if (old) { old.remove(); return; }
      var box = document.createElement('div');
      box.className = 'sec transcript';
      box.style.cssText = 'margin:12px 0;white-space:pre-wrap;max-height:50vh;overflow:auto;font-size:13px;line-height:1.5';
      box.textContent = text;
      var acts = rd.querySelector('.acts');
      if (acts && acts.parentNode) acts.parentNode.insertBefore(box, acts.nextSibling);
      else rd.appendChild(box);
    },
    'zoom-play': function (el, root) {
      var url = attr(el, 'data-url');
      if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener');
      else toast(root, 'No recording on this meeting');
    },
    'zoom-space': function (el, root) {
      /* Pick a Space, then attach this meeting to it as a note (title, date, people, summary, what you owe). */
      var i = attr(el, 'data-i');
      function menu(list) {
        var rows = (list || []).filter(function (p) { return p && UUID_RE.test(String(p.id || '')); }).map(function (p) {
          return '<button type="button" data-action="zoom-space-pick" data-space="' + esc(p.id) + '" data-name="' + esc(p.name || 'Space') + '" data-i="' + esc(i) + '">' + esc(p.name || 'Space') + '</button>';
        }).join('');
        openPop(root, el, rows || '<div style="padding:6px 8px">No Spaces yet. Create one in Spaces first.</div>');
      }
      if ((S().packages || []).length || !writeOk()) { menu(S().packages); return; }
      api('/api/spaces', { method: 'GET' }).then(ok).then(json).then(function (d) {
        S().packages = (d && (d.spaces || d.packages)) || [];
        menu(S().packages);
      }).catch(function () { toast(root, 'Could not load your Spaces'); });
    },
    'zoom-space-pick': function (el, root) {
      closePop(root);
      var sid = attr(el, 'data-space');
      var Z = window.__zoomMount;
      var x = Z && Z.meetings ? Z.meetings[Number(attr(el, 'data-i'))] : null;
      if (!sid || !x) return;
      if (!writeOk()) { toast(root, 'Added to ' + attr(el, 'data-name') + ' (fixture)'); return; }
      var lines = [];
      if (x.ymd) lines.push('Date: ' + x.ymd);
      if ((x.p || []).length) lines.push('With: ' + x.p.join(', '));
      var summary = String(x.aiSummary || x.s || '').trim();
      if (summary) lines.push('', summary);
      var owe = (x.actions || []).map(function (a) { return Array.isArray(a) ? a[1] : (a && (a.text || a)); }).filter(Boolean);
      if (owe.length) {
        lines.push('', 'You owe:');
        owe.forEach(function (t) { lines.push('- ' + t); });
      }
      api('/api/spaces/' + encodeURIComponent(sid) + '/items', { method: 'POST', body: { kind: 'note', name: 'Meeting: ' + String(x.t || 'Zoom meeting').slice(0, 160), body: lines.join('\n') } }).then(ok).then(json).then(function (d) {
        if (!d || d.saved === false) throw new Error('not saved');
        toast(root, 'Added to ' + (attr(el, 'data-name') || 'the Space'));
        refresh('spaces');
      }).catch(function () { toast(root, 'Could not add that meeting to the Space'); });
    },
    'zoom-follow': function (el, root) {
      if (typeof window.openReply === 'function') {
        window.openReply({ email: '', from: attr(el, 'data-name') || '', subject: 'Following up', snippet: '', body: '', threadId: '', messageId: '' });
        toast(root, 'Follow-up draft — nothing sends until you confirm');
        return;
      }
      soon(root, 'Draft follow-up email');
    },
    'done-day': function (el, root) {
      var date = attr(el, 'data-date');
      if (!date) return;
      if (window.STATE) window.STATE.snapOpenDate = date;
      root.querySelectorAll('.day').forEach(function (d) { d.classList.toggle('on', attr(d, 'data-date') === date); });
      if (!writeOk()) return;
      api('/api/snapshots?date=' + encodeURIComponent(date), { method: 'GET' }).then(ok).then(json).then(function (one) {
        if (window.STATE) window.STATE.snapOpen = one;
        refresh('done');
      }).catch(function () { refresh('done'); });
    },
    'done-snap': function (el, root) {
      var btn = document.getElementById('snapNow');
      if (btn) { btn.click(); toast(root, 'Snapshot started'); return; }
      if (!writeOk()) { toast(root, 'Snapshot (fixture)'); return; }
      api('/api/snapshots', { method: 'POST', body: {} }).then(ok).then(json).then(function () {
        toast(root, 'Snapshot saved'); refresh('done');
      }).catch(function () { toast(root, 'Could not snapshot now'); });
    },
    'done-search': function (el, root) {
      var q = window.prompt('Search days', '');
      if (q == null) return;
      q = String(q).toLowerCase();
      root.querySelectorAll('.day').forEach(function (d) {
        d.style.display = !q || (d.textContent || '').toLowerCase().indexOf(q) >= 0 ? '' : 'none';
      });
    },
    'done-export': function (el, root) {
      window.print();
      toast(root, 'Print / save as PDF');
    },
    'done-investor': function (el, root) { soon(root, 'Add to investor update'); },
    'news-span': function (el, root) { if (window.__newsHandle) window.__newsHandle('news-span', el, root); },
    'news-refresh': function (el, root) { if (window.__newsHandle) window.__newsHandle('news-refresh', el, root); },
    'news-search': function () {},
    'news-cat': function (el, root) { if (window.__newsHandle) window.__newsHandle('news-cat', el, root); },
    'news-open': function (el, root) { if (window.__newsHandle) window.__newsHandle('news-open', el, root); },
    'news-save': function (el, root) { if (window.__newsHandle) window.__newsHandle('news-save', el, root); else toast(root, 'Saved to News'); },
    'news-space': function (el, root) {
      if (window.__newsHandle) window.__newsHandle('news-save', el, root);
      else toast(root, 'Added to a Space');
    },
    'news-source': function () {},
    'owed-today': function (el, root) { go('war'); toast(root, 'Added to Today'); },
    'owed-done': function (el, root) { toast(root, 'Marked done'); },
    'pipe-reach': function () { go('contacts'); },
    'news-act': function (el, root) { if (window.__newsHandle) window.__newsHandle('news-act', el, root); },
    'news-topic': function (el, root) { if (window.__newsHandle) window.__newsHandle('news-topic', el, root); },
    'news-url': function (el, root) { if (window.__newsHandle) window.__newsHandle('news-url', el, root); }
  };

  function saveNote(root, el) {
    var ot = root.getElementById && root.getElementById('ot');
    var ob = root.getElementById && root.getElementById('ob');
    var card = root.getElementById && root.getElementById('ovNote');
    var id = attr(ot, 'data-id') || attr(ob, 'data-id') || attr(card, 'data-id') || attr(el, 'data-id');
    if (!id) return;
    var source = attr(ot, 'data-source') || attr(ob, 'data-source') || attr(card, 'data-source') || attr(el, 'data-source') || '';
    if ((S().notes || []).some(function (n) { return String(n.id) === String(id); })) source = 'board';
    else if ((S().stickies || []).some(function (n) { return String(n.id) === String(id); })) source = 'sticky';
    function readTitle() {
      var node = (root.getElementById && root.getElementById('ot')) || ot;
      return node ? String(node.innerText || node.textContent || '').trim() : '';
    }
    function readBody() {
      var node = (root.getElementById && root.getElementById('ob')) || ob;
      return node ? String(node.innerText || node.textContent || '') : '';
    }
    var title = readTitle();
    var body = readBody();
    if (card) card.__noteDraft = { title: title, body: body };
    var saved = root.getElementById && root.getElementById('ovSaved');
    if (saved) saved.innerHTML = '<i></i>Saving…';
    (S().stickies || []).forEach(function (n) {
      if (String(n.id) !== String(id)) return;
      n.body = body;
      n.meta = Object.assign({}, n.meta && typeof n.meta === 'object' ? n.meta : {}, { title: title });
    });
    (S().notes || []).forEach(function (n) {
      if (String(n.id) !== String(id)) return;
      n.title = title;
      n.body = body;
    });
    if (window.REDESIGN_FIXTURE && window.REDESIGN_FIXTURE.notes) {
      ['pinned', 'notes'].forEach(function (key) {
        (window.REDESIGN_FIXTURE.notes[key] || []).forEach(function (n) {
          if (String(n.id) !== String(id)) return;
          n.title = title;
          n.body = body;
        });
      });
      if (window.REDESIGN_FIXTURE.notes.openNote && String(window.REDESIGN_FIXTURE.notes.openNote.id) === String(id)) {
        window.REDESIGN_FIXTURE.notes.openNote.title = title;
        window.REDESIGN_FIXTURE.notes.openNote.body = body;
      }
    }
    root.querySelectorAll('[data-action="note-open"][data-id="' + id + '"]').forEach(function (cardEl) {
      cardEl.setAttribute('data-title', title);
      cardEl.setAttribute('data-body', body);
      var h = cardEl.querySelector('h4');
      var p = cardEl.querySelector('p');
      if (h) h.textContent = title;
      if (p) p.textContent = body;
    });
    if (!writeOk()) {
      if (saved) saved.innerHTML = '<i></i>Saved · just now';
      return;
    }
    function sendNote() {
      ot = root.getElementById && root.getElementById('ot');
      ob = root.getElementById && root.getElementById('ob');
      title = readTitle();
      body = readBody();
      if ((!title && !body) && card && card.__noteDraft) {
        title = card.__noteDraft.title || title;
        body = card.__noteDraft.body || body;
      }
      var req;
      if (source === 'board') {
        req = api('/api/notes/' + encodeURIComponent(id), { method: 'PATCH', body: { title: title || 'Note', body: body } });
      } else {
        var row = (S().stickies || []).filter(function (n) { return String(n.id) === String(id); })[0] || {};
        if (row.meta && typeof row.meta === 'object') row.meta.title = title;
        req = api('/api/notes/' + encodeURIComponent(id), { method: 'PATCH', body: { body: body, meta: { title: title } } });
      }
      window.__noteSave = req;
      return req;
    }
    function afterSend(req) {
      return req.then(ok).then(function (r) {
        if (source !== 'board' || !r || typeof r.json !== 'function') return r;
        return r.json().then(function (d) {
          if (!d || !(d.rowsAffected > 0) || d.store === 'sticky') throw d || new Error('note not saved');
          return d;
        });
      }).then(function () {
        if (saved) saved.innerHTML = '<i></i>Saved · just now';
      }).catch(function () {
        if (saved) saved.innerHTML = '<i></i>Couldn\'t save';
        toast(root, 'Could not save that note');
      });
    }
    clearTimeout(noteSaveTimer);
    if (el && el.__flushNote) {
      el.__flushNote = false;
      noteSaveTimer = 0;
      return afterSend(sendNote());
    }
    noteSaveTimer = setTimeout(function () {
      afterSend(sendNote());
    }, 400);
  }
  function flushOpenNote() {
    var host = document.getElementById('notesDesk');
    var root = host && host.shadowRoot;
    if (!root) return;
    var card = root.getElementById && root.getElementById('ovNote');
    if (!card || card.hasAttribute('hidden')) return;
    card.__flushNote = true;
    saveNote(root, card);
  }

  /* ---------- Email / Spaces / Pipeline helpers ---------- */
  /* Gmail attachment through the same-origin route (always served as a download). */
  function downloadMailAttachment(root, mid, aid, name) {
    if (!mid || !aid) { toast(root, 'That file has no stored copy yet'); return; }
    if (!writeOk()) { toast(root, 'Download (fixture)'); return; }
    toast(root, 'Downloading ' + (name || 'file'));
    api('/api/mail/attachment?mid=' + encodeURIComponent(mid) + '&aid=' + encodeURIComponent(aid) + '&name=' + encodeURIComponent(name || 'attachment'), { method: 'GET' }).then(function (r) {
      var type = (r && r.headers && r.headers.get && r.headers.get('content-type')) || '';
      if (!r || !r.ok || /json/i.test(type)) throw new Error('nofile');
      return r.blob();
    }).then(function (blob) {
      var u = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = u; a.download = name || 'attachment'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
    }).catch(function () { toast(root, 'Could not download ' + (name || 'that file')); });
  }
  var EMAIL_RE = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;
  var GMAIL_ID = /^[A-Za-z0-9_-]{6,64}$/;
  var UUID_RE = /^[0-9a-f-]{36}$/i;
  function mailRoot() {
    var host = document.getElementById('mailDesk');
    return host && host.shadowRoot ? host.shadowRoot : null;
  }
  /* Repaint Email even while a compose field has focus (our own action, not a background poll). */
  function repaintMail() {
    S().mailPaintForce = true;
    refresh('mail');
  }
  function mailAiWrite(root, mode, tone) {
    var bad = syncCompose(root);
    var d = composeState();
    if (bad.length) { toast(root, 'Not a valid email address: ' + bad.join(', ')); return; }
    var cp = root.getElementById && root.getElementById('compose');
    var askEl = cp && cp.querySelector('[data-action="mail-ask-input"]');
    if (askEl) d.ask = String(askEl.value || '');
    if (mode === 'tone' && !String(d.body || '').trim()) { toast(root, 'Write something first, then pick a tone'); return; }
    if (mode === 'write' && !String(d.ask || '').trim()) { toast(root, 'Tell me what to write'); return; }
    if (!writeOk()) { toast(root, 'Draft (fixture)'); return; }
    var first = (d.to || [])[0] || {};
    var before = d.body;
    toast(root, mode === 'tone' ? 'Rewriting…' : 'Writing…');
    api('/api/mail/write', { method: 'POST', body: { mode: mode, tone: tone, text: d.body, ask: d.ask, subject: d.subject, toEmail: first.email || '', toName: first.name || '' } }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error((j && j.error) || 'fail'); return j; });
    }).then(function (j) {
      if (!j || !j.body) throw new Error('Writing help came back empty');
      d.body = String(j.body);
      if (mode === 'tone') d.tone = tone;
      else d.ask = '';
      d.aiNote = '';
      repaintMail();
      toast(root, 'Draft updated. Read it before you send.', function () { d.body = before; repaintMail(); });
    }).catch(function (err) {
      d.aiNote = (err && err.message && err.message !== 'fail') ? err.message : 'Writing help did not answer. Try again.';
      repaintMail();
      toast(root, d.aiNote);
    });
  }
  function composeState() {
    if (window.__mailCompose && window.__mailCompose.draft) return window.__mailCompose.draft();
    var d = S().composeDraft || (S().composeDraft = {});
    ['to', 'cc', 'bcc', 'attachments'].forEach(function (k) { if (!Array.isArray(d[k])) d[k] = []; });
    d.typing = d.typing || {};
    return d;
  }
  function openCompose(draft) {
    S().composeDraft = Object.assign({ to: [], cc: [], bcc: [], subject: '', body: '', attachments: [], nudge: false, log: false }, draft || {});
    S().composeOpen = true;
    S().mailView = 'inbox';
    S().mailOpen = null;
    S().mailOpenThread = null;
    if (S().desk !== 'mail') go('mail');
    repaintMail();
    setTimeout(function () { focusComposeField(composeState().to.length ? '' : 'to'); }, 80);
  }
  function focusComposeField(field) {
    var root = mailRoot();
    if (!root) return;
    var el = field ? root.getElementById('mail-' + field) : root.querySelector('#compose .body');
    if (el && el.focus) el.focus();
  }
  function addRecipient(field, email, name) {
    var d = composeState();
    email = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return false;
    var list = d[field] || (d[field] = []);
    if (!list.some(function (r) { return r.email === email; })) list.push({ email: email, name: String(name || '').trim() });
    d.typing[field] = '';
    return true;
  }
  /* Read subject/body and any half-typed address into the draft. Returns the tokens that are not valid addresses. */
  function syncCompose(root) {
    var d = composeState();
    var cp = root.getElementById && root.getElementById('compose');
    if (!cp) return [];
    var sub = cp.querySelector('[data-action="mail-subject"]');
    var body = cp.querySelector('[data-action="mail-body"]');
    if (sub) d.subject = String(sub.value || '').trim();
    if (body) d.body = String(body.innerText || body.textContent || '').replace(/ /g, ' ').trim();
    if (body) {
      d.bodyHtml = String(body.innerHTML || '');
      d.bodyHtmlFor = d.body;
    }
    var sigEl = cp.querySelector('[data-action="mail-sig"]');
    if (sigEl) d.sigHtml = String(sigEl.innerHTML || '');
    var bad = [];
    ['to', 'cc', 'bcc'].forEach(function (field) {
      var input = root.getElementById('mail-' + field);
      String((input && input.value) || '').split(/[,;\s]+/).forEach(function (tok) {
        if (!tok) return;
        if (!addRecipient(field, tok, '')) bad.push(tok);
      });
      if (input && !bad.length) input.value = '';
    });
    return bad;
  }
  /* To/Cc/Bcc suggestions: contacts plus everyone in the mail feed. */
  function recipientPool() {
    var seen = {}, pool = [];
    function add(name, email, meta) {
      var e = String(email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(e) || seen[e]) return;
      seen[e] = 1;
      pool.push({ n: String(name || e), e: e, m: meta });
    }
    (S().contacts || []).forEach(function (c) { add(c.name, c.email, c.company || c.category || 'Contacts'); });
    ((S().mailBoard || {}).messages || []).concat(S().mail || []).forEach(function (m) { add(m.from || m.name, m.email, 'Email'); });
    return pool;
  }
  function renderSuggestions(root, field, q) {
    var dd = root.getElementById && root.getElementById('dd-' + field);
    if (!dd) return;
    q = String(q || '').trim().toLowerCase();
    var hits = q ? recipientPool().filter(function (p) { return (p.n + ' ' + p.e).toLowerCase().indexOf(q) >= 0; }).slice(0, 8) : [];
    dd.innerHTML = hits.map(function (h, i) {
      return '<div class="o" data-action="mail-to-pick" data-field="' + esc(field) + '" data-email="' + esc(h.e) + '" data-name="' + esc(h.n) + '"' + (i === 0 ? ' data-first="1"' : '') + '><span class="av" style="background:#2e6bf2;width:28px;height:28px">' + esc(h.n.slice(0, 2).toUpperCase()) + '</span><div><b>' + esc(h.n) + '</b><span>' + esc(h.e) + ' &middot; ' + esc(h.m) + '</span></div><span></span></div>';
    }).join('');
    dd.style.display = hits.length ? 'block' : 'none';
  }
  function bundleLinksText(atts) {
    var lines = (atts || []).map(function (a) {
      var url = a.url || (a.driveFileId || a.drive_file_id ? 'https://drive.google.com/file/d/' + (a.driveFileId || a.drive_file_id) + '/view' : '');
      return url ? '- ' + (a.name || 'File') + ': ' + url : '';
    }).filter(Boolean);
    return lines.length ? '\n\n' + lines.join('\n') : '';
  }
  /* ---------- Compose helpers (Oct 26): inline link, attachments, document picker, signature ---------- */
  var mailColAdding = false;
  var linkRange = null;
  var lastBodyRange = null;
  var pickerState = { tab: 'docs', q: '', drive: null, driveQ: null, loading: false };
  var UPLOAD_CAP = 3 * 1024 * 1024;
  function escText(v) { return esc(v).replace(/>/g, '&gt;'); }
  function uploadedBytes(d) {
    return (d.attachments || []).reduce(function (n, a) { return n + (a.data ? (Number(a.size) || 0) : 0); }, 0);
  }
  /* Uploaded files go as real attachments (base64 in the send request; the serverless body limit caps them at about 3 MB in total). */
  function addComposeFiles(root, files) {
    var d = composeState();
    var list = Array.prototype.slice.call(files || []);
    list.forEach(function (f) {
      if (!f) return;
      if (uploadedBytes(d) + (f.size || 0) > UPLOAD_CAP) {
        toast(root, (f.name || 'That file') + ' is too big to upload from here (3 MB total). Put it in Documents or Drive and use From Documents.');
        return;
      }
      var item = { name: f.name || 'File', type: f.type || 'application/octet-stream', mime: f.type || '', size: f.size || 0, data: '', busy: true, upload: true };
      d.attachments.push(item);
      var reader = new FileReader();
      reader.onload = function () {
        var raw = String(reader.result || '');
        item.data = raw.indexOf(',') >= 0 ? raw.slice(raw.indexOf(',') + 1) : raw;
        item.busy = false;
        paintComposeAtts(root);
      };
      reader.onerror = function () {
        var at = d.attachments.indexOf(item);
        if (at >= 0) d.attachments.splice(at, 1);
        paintComposeAtts(root);
        toast(root, 'Could not read ' + item.name);
      };
      reader.readAsDataURL(f);
    });
    paintComposeAtts(root);
  }
  /* Repaint only the attachment chips and the side box, so the body, the picker and the caret stay put. */
  function paintComposeAtts(root) {
    var cp = root && root.getElementById && root.getElementById('compose');
    if (!cp) return;
    var d = composeState();
    var MC = window.__mailCompose || {};
    var isReal = MC.isReal || function () { return false; };
    var html = d.attachments.map(function (a, i) {
      var nm = String(a.name || 'File');
      var ext = (nm.match(/\.([a-z0-9]{2,5})$/i) || [])[1] || (a.mime && /pdf/i.test(a.mime) ? 'pdf' : 'file');
      var size = Number(a.size) || 0;
      var sz = size ? (size >= 1048576 ? (size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(size / 1024)) + ' KB') : '';
      return '<span class="att' + (a.busy ? ' busy' : '') + '"><span class="ty" style="background:#2e6bf2">' + escText(String(ext).toUpperCase()) + '</span>' + escText(nm)
        + (sz ? ' <span class="sz">' + escText(sz) + '</span>' : '') + (isReal(a) || a.busy ? '' : ' <span class="sz">link</span>')
        + '<span class="x2" data-action="mail-att-remove" data-i="' + i + '" title="Remove">&times;</span></span>';
    }).join('');
    var box = cp.querySelector('.atts');
    if (!html) { if (box && box.parentNode) box.parentNode.removeChild(box); }
    else {
      if (!box) {
        box = document.createElement('div');
        box.className = 'atts';
        var drop = cp.querySelector('#composeDrop');
        if (drop && drop.parentNode) drop.parentNode.insertBefore(box, drop);
      }
      box.innerHTML = html;
    }
    var side = cp.querySelector('#composeSide');
    if (side && MC.side) side.innerHTML = MC.side(d);
  }
  function pickerRows(root) {
    var tab = pickerState.tab;
    var q = String(pickerState.q || '').toLowerCase();
    var rows = [];
    if (tab === 'docs') {
      (S().staged || []).forEach(function (doc) {
        if (!doc || doc.kind === 'folder') return;
        var drive = String(doc.driveFileId || doc.drive || '');
        var dr = /^[\w-]{8,}$/.test(drive) && !UUID_RE.test(drive) ? drive : '';
        rows.push({ name: doc.name || 'File', mime: doc.mime || '', url: doc.url || '', drive: dr, staged: !dr && UUID_RE.test(String(doc.id || '')) ? String(doc.id) : '', meta: doc.category || 'Documents' });
      });
    } else if (tab === 'spaces') {
      (S().packages || []).forEach(function (p) {
        (p.docs || p.items || []).forEach(function (doc) {
          if (!doc || doc.kind === 'link' || doc.kind === 'note' || doc.kind === 'folder') return;
          var drive = String(doc.driveFileId || doc.drive_file_id || doc.drive || '');
          var st = String(doc.stagedId || doc.staged_id || '');
          rows.push({ name: doc.name || doc.title || 'File', mime: doc.mime || '', url: doc.url || '', drive: /^[\w-]{8,}$/.test(drive) && !UUID_RE.test(drive) ? drive : '', staged: UUID_RE.test(st) ? st : '', meta: p.name || 'Space' });
        });
      });
    } else {
      (pickerState.drive || []).forEach(function (f) {
        rows.push({ name: f.name || 'File', mime: f.mime || '', url: f.url || '', drive: f.id || '', staged: '', meta: 'Drive' });
      });
    }
    if (q && tab !== 'drive') rows = rows.filter(function (r) { return (r.name + ' ' + r.meta).toLowerCase().indexOf(q) >= 0; });
    return rows.slice(0, 80);
  }
  function paintPicker(root) {
    var pick = root.getElementById && root.getElementById('composePick');
    if (!pick) return;
    var tab = pickerState.tab;
    var d = composeState();
    var have = {};
    (d.attachments || []).forEach(function (a) { have[a.driveFileId || a.stagedId || a.url || a.name] = 1; });
    var head = '<div class="ph">'
      + [['docs', 'Documents'], ['spaces', 'Spaces'], ['drive', 'Drive']].map(function (t) { return '<span class="' + (tab === t[0] ? 'on' : '') + '" data-action="mail-pick-tab" data-tab="' + t[0] + '">' + t[1] + '</span>'; }).join('')
      + '<input data-action="mail-pick-q" placeholder="' + (tab === 'drive' ? 'Search Drive, then Enter' : 'Filter by name') + '" value="' + esc(pickerState.q || '') + '" autocomplete="off">'
      + '<span data-action="mail-pick-close">Close</span></div>';
    var rows = pickerRows(root);
    var body = pickerState.loading ? '<div class="pe">Loading&hellip;</div>'
      : rows.length ? rows.map(function (r) {
        var key = r.drive || r.staged || r.url || r.name;
        var how = r.drive || r.staged ? 'Attach' : 'Link';
        return '<div class="pr" data-action="mail-pick-add" data-name="' + esc(r.name) + '" data-mime="' + esc(r.mime) + '" data-url="' + esc(r.url) + '" data-drive="' + esc(r.drive) + '" data-staged="' + esc(r.staged) + '"><b>' + escText(r.name) + '</b><span style="color:#6b7a90">' + escText(r.meta) + '</span><em>' + (have[key] ? 'Attached' : how) + '</em></div>';
      }).join('')
      : '<div class="pe">' + (tab === 'drive' ? 'No Drive files found.' : tab === 'spaces' ? 'No files in your Spaces yet.' : 'No documents yet.') + '</div>';
    var list = pick.querySelector('.plist');
    if (!pick.querySelector('.ph')) pick.innerHTML = head + '<div class="plist">' + body + '</div>';
    else {
      pick.querySelector('.ph').outerHTML = head;
      if (list) list.innerHTML = body;
    }
  }
  function pickerLoad(root, tab) {
    if (!writeOk()) return;
    if (tab === 'docs' && !(S().staged || []).length) {
      pickerState.loading = true;
      paintPicker(root);
      api('/api/documents', { method: 'GET' }).then(ok).then(json).then(function (d) {
        if (d && Array.isArray(d.docs)) S().staged = d.docs;
      }).catch(function () {}).then(function () { pickerState.loading = false; paintPicker(root); });
    } else if (tab === 'spaces' && !(S().packages || []).length) {
      pickerState.loading = true;
      paintPicker(root);
      withSpaces(function () { pickerState.loading = false; paintPicker(root); });
    } else if (tab === 'drive' && pickerState.drive == null) {
      pickerSearch(root, '', true);
    }
  }
  function pickerSearch(root, q, now) {
    pickerState.q = q;
    if (pickerState.tab !== 'drive') {
      var pick = root.getElementById && root.getElementById('composePick');
      var list = pick && pick.querySelector('.plist');
      if (list) {
        var keep = pick.querySelector('[data-action="mail-pick-q"]');
        paintPicker(root);
        keep = pick.querySelector('[data-action="mail-pick-q"]');
        if (keep) { keep.focus(); try { keep.setSelectionRange(q.length, q.length); } catch (e) {} }
      }
      return;
    }
    if (!now || !writeOk()) return;
    pickerState.loading = true;
    paintPicker(root);
    api('/api/documents/drive?q=' + encodeURIComponent(q || ''), { method: 'GET' }).then(ok).then(json).then(function (d) {
      pickerState.drive = (d && Array.isArray(d.files)) ? d.files : [];
    }).catch(function () { pickerState.drive = []; toast(root, 'Drive did not answer - is Google connected?'); }).then(function () {
      pickerState.loading = false;
      paintPicker(root);
    });
  }
  /* Signature for sending: the block on screen (edited or not), unless switched off. */
  function composeSigOut(root, d) {
    if (d.sigOff) return { html: '', text: '' };
    var cp = root.getElementById && root.getElementById('compose');
    var sb = cp && cp.querySelector('[data-action="mail-sig"]');
    var html = sb ? String(sb.innerHTML || '').trim() : String(d.sigHtml || '').trim();
    var text = sb ? String(sb.innerText || sb.textContent || '').trim() : '';
    if (!text && !/<img/i.test(html)) return { html: '', text: '' };
    return { html: html, text: text };
  }
  /* HTML body for sending: the editor's HTML (links kept), link-only files as anchors, then the signature. */
  function composeHtmlOut(root, d, linkAtts, sigHtml) {
    var cp = root.getElementById && root.getElementById('compose');
    var body = cp && cp.querySelector('[data-action="mail-body"]');
    var main = body ? String(body.innerHTML || '') : escText(d.body).replace(/\n/g, '<br>');
    var links = (linkAtts || []).map(function (a) {
      var url = a.url || (a.driveFileId || a.drive_file_id ? 'https://drive.google.com/file/d/' + (a.driveFileId || a.drive_file_id) + '/view' : '');
      return url ? '<li><a href="' + esc(url) + '">' + escText(a.name || 'File') + '</a></li>' : '';
    }).filter(Boolean).join('');
    return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1b2333">' + main
      + (links ? '<ul>' + links + '</ul>' : '')
      + (sigHtml ? '<br><div class="gmail_signature">' + sigHtml + '</div>' : '')
      + '</div>';
  }
  function loadMailSig(root) {
    if (S().mailSig || loadMailSig.busy || !writeOk()) return;
    loadMailSig.busy = true;
    api('/api/mail/signature', { method: 'GET' }).then(ok).then(json).then(function (d) {
      S().mailSig = { html: String((d && d.signature) || ''), source: String((d && d.source) || 'none'), needsScope: !!(d && d.needsScope) };
    }).catch(function () {
      S().mailSig = { html: '', source: 'none', needsScope: false, failed: true };
    }).then(function () {
      loadMailSig.busy = false;
      var r = mailRoot() || root;
      var box = r && r.getElementById && r.getElementById('composeSig');
      var MC = window.__mailCompose || {};
      if (box && MC.sig) {
        var d = composeState();
        var typed = box.querySelector('[data-action="mail-sig"]');
        if (typed && String(typed.innerText || '').trim()) d.sigHtml = String(typed.innerHTML || '');
        box.outerHTML = MC.sig(d);
      }
    });
  }
  /* After every Email paint: keep the editor selection for Link, wire the file input, load the signature once. */
  window.__mailComposeAfterPaint = function (wrap) {
    var root = wrap && wrap.getRootNode ? wrap.getRootNode() : null;
    var cp = root && root.getElementById ? root.getElementById('compose') : null;
    if (!cp || !cp.classList.contains('open')) return;
    var bar = cp.querySelector('.tbar');
    if (bar && !bar.__keepSel) {
      bar.__keepSel = true;
      bar.addEventListener('mousedown', function (e) { e.preventDefault(); });
    }
    var body = cp.querySelector('[data-action="mail-body"]');
    if (body && !body.__keepSel) {
      body.__keepSel = true;
      var stash = function () {
        var sel = (root.getSelection ? root.getSelection() : null) || window.getSelection();
        var r = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
        if (r && body.contains(r.commonAncestorContainer)) lastBodyRange = r.cloneRange();
      };
      body.addEventListener('mouseup', stash);
      body.addEventListener('keyup', stash);
      body.addEventListener('blur', stash);
    }
    var file = cp.querySelector('#composeFile');
    if (file && !file.__wired) {
      file.__wired = true;
      file.addEventListener('change', function () {
        if (file.files && file.files.length) addComposeFiles(root, file.files);
        file.value = '';
      });
    }
    loadMailSig(root);
  };
  function forwardBody(from, email, subject, text) {
    return '\n\n---------- Forwarded message ----------\nFrom: ' + from + (email ? ' <' + email + '>' : '') + '\nSubject: ' + subject + '\n\n' + String(text || '');
  }
  /* Nudge in 3 days = a War Room item due in 3 days. */
  function nudgeLater(root, name, email, subject) {
    var due = new Date(Date.now() + 3 * 86400000);
    due.setHours(9, 0, 0, 0);
    addTask('Nudge ' + name + ' if no reply: ' + (subject || 'your email'), 'later', { due: due.toISOString() }).then(function () {
      refresh('war');
    }).catch(function () { toast(root, 'Sent, but the 3-day nudge was not saved'); });
  }
  /* Log to Pipeline = mark the contact touched (create it if new) and move its cached GHL opportunity to a "contact made" stage when one exists. Never creates a GHL opportunity. */
  function logToPipeline(root, name, email) {
    var e = String(email || '').toLowerCase();
    var c = (S().contacts || []).filter(function (x) { return String(x.email || '').toLowerCase() === e; })[0];
    var now = Date.now();
    var write = c && c.id
      ? api('/api/contacts', { method: 'PATCH', body: { id: c.id, lastTouch: new Date(now).toISOString(), stage: 'contacted' } })
      : api('/api/contacts', { method: 'POST', body: { name: name || e, email: e, stage: 'contacted' } });
    write.then(ok).then(json).then(function (row) {
      if (c) { c.lastTouch = now; c.stage = 'contacted'; }
      else if (row && row.id) S().contacts = [row].concat(S().contacts || []);
      var hit = findOpportunity(e);
      if (!hit) return null;
      var target = hit.pipe.stages.filter(function (st) { return /contact(ed)?\s*made|contacted/i.test(st.name || ''); })[0];
      if (!target || target.id === hit.stage.id) return null;
      return api('/api/pipeline', { method: 'POST', body: { opportunityId: hit.opp.id, pipelineId: hit.pipe.id, stageId: target.id, stage: target.name, contactId: hit.opp.contactId || '', name: hit.opp.contact || name } }).then(json);
    }).then(function () { refresh('pipe'); }).catch(function () { toast(root, 'Sent, but Pipeline was not updated'); });
  }
  function findOpportunity(email) {
    var e = String(email || '').toLowerCase();
    var out = null;
    (S().ghlPipes || []).forEach(function (pipe) {
      (pipe.stages || []).forEach(function (stage) {
        (stage.opps || []).forEach(function (opp) {
          if (!out && e && String(opp.email || '').toLowerCase() === e) out = { pipe: pipe, stage: stage, opp: opp };
        });
      });
    });
    return out;
  }
  function loadThread(id) {
    return api('/api/mail/thread?id=' + encodeURIComponent(id), { method: 'GET' }).then(ok).then(json).then(function (d) {
      if (!d || !d.thread) throw new Error('no thread');
      S().mailBodies = S().mailBodies || {};
      S().mailBodies[id] = String(d.thread.text || d.thread.snippet || '');
      return d.thread;
    });
  }
  function markMailRead(id) {
    ((S().mailBoard || {}).messages || []).forEach(function (m) { if (String(m.id) === String(id)) m.unread = false; });
    api('/api/mail/act', { method: 'POST', body: { action: 'read', id: id } }).catch(function () {});
  }
  function dropBoardMessage(id) {
    var b = S().mailBoard;
    if (b && Array.isArray(b.messages)) b.messages = b.messages.filter(function (m) { return String(m.id) !== String(id); });
  }
  function userColumns() {
    return typeof window.__mailUserColumns === 'function' ? window.__mailUserColumns() : [];
  }
  function setBoardColumns(cols) {
    if (!Array.isArray(cols)) return;
    S().mailBoard = S().mailBoard || { messages: [] };
    S().mailBoard.columns = cols;
  }
  function setBoardRules(rules) {
    if (!Array.isArray(rules)) return;
    S().mailBoard = S().mailBoard || { messages: [] };
    S().mailBoard.rules = rules;
  }
  function mailColumnOf(id) {
    var hit = ((S().mailBoard || {}).messages || []).filter(function (m) { return String(m.id) === String(id); })[0];
    return hit ? String(hit.column || '') : '';
  }
  function setMailColumn(id, key) {
    ((S().mailBoard || {}).messages || []).forEach(function (m) { if (String(m.id) === String(id)) m.column = key; });
  }
  /* Create on the server first, then use the server key. Resolves with the new key. */
  function createMailColumn(name) {
    var before = {};
    ((S().mailBoard || {}).columns || []).forEach(function (c) { before[c.key] = 1; });
    return api('/api/mail/columns', { method: 'POST', body: { action: 'create', name: name } }).then(ok).then(json).then(function (d) {
      if (!d || !d.saved || !Array.isArray(d.columns)) throw new Error('not saved');
      setBoardColumns(d.columns);
      var fresh = d.columns.filter(function (c) { return !before[c.key]; })[0]
        || d.columns.filter(function (c) { return c.name === name; }).pop();
      if (!fresh) throw new Error('no key');
      return fresh.key;
    });
  }
  function renameMailColumn(root, key, name) {
    if (!key || !name) return;
    if (!writeOk()) { toast(root, 'Renamed (fixture)'); return; }
    var cols = ((S().mailBoard || {}).columns || []);
    var prev = '';
    cols.forEach(function (c) { if (c.key === key) { prev = c.name; c.name = name; } });
    if (prev === name) return;
    refresh('mail');
    api('/api/mail/columns', { method: 'POST', body: { action: 'rename', key: key, name: name } }).then(ok).then(json).then(function (d) {
      if (!d || !d.saved) throw new Error('not saved');
      setBoardColumns(d.columns);
      toast(root, 'Column renamed');
    }).catch(function () {
      cols.forEach(function (c) { if (c.key === key) c.name = prev; });
      refresh('mail');
      toast(root, 'Could not rename that column');
    });
  }
  /* File one email into a user column; a sticky rule files future mail from the sender too. */
  function fileMail(root, id, key, sticky, email) {
    if (!id || !key) return;
    var prev = mailColumnOf(id);
    setMailColumn(id, key);
    refresh('mail');
    var name = (userColumns().filter(function (c) { return c.id === key; })[0] || {}).n || key;
    api('/api/mail/act', { method: 'POST', body: { action: 'move', id: id, column: key, sticky: !!sticky, email: email, matchType: 'sender' } }).then(ok).then(json).then(function (d) {
      if (!d || !d.ok) throw new Error('not filed');
      if (sticky && email) {
        api('/api/mail/rules', { method: 'GET' }).then(ok).then(json).then(function (r) { setBoardRules(r && r.rules); refresh('mail'); }).catch(function () {});
      }
      toast(root, 'Filed in ' + name + (sticky && email ? ' · future mail from ' + email + ' goes there too' : ''), function () {
        setMailColumn(id, prev);
        refresh('mail');
        if (prev) api('/api/mail/act', { method: 'POST', body: { action: 'move', id: id, column: prev } }).catch(function () {});
      });
    }).catch(function () {
      setMailColumn(id, prev);
      refresh('mail');
      toast(root, 'Could not file that email');
    });
  }
  function reorderMailColumns(root, movingKey, beforeKey) {
    var cols = ((S().mailBoard || {}).columns || []).slice();
    var from = cols.map(function (c) { return c.key; }).indexOf(movingKey);
    if (from < 0 || movingKey === beforeKey) return;
    var moved = cols.splice(from, 1)[0];
    var to = cols.map(function (c) { return c.key; }).indexOf(beforeKey);
    cols.splice(to < 0 ? cols.length : to, 0, moved);
    setBoardColumns(cols);
    refresh('mail');
    if (!writeOk()) return;
    api('/api/mail/columns', { method: 'POST', body: { action: 'reorder', keys: cols.map(function (c) { return c.key; }) } }).then(ok).then(json).then(function (d) {
      if (!d || !d.saved) throw new Error('not saved');
      toast(root, 'Column order saved');
    }).catch(function () { toast(root, 'Could not save the column order'); });
  }
  function withSpaces(fn) {
    var packs = S().packages || [];
    if (packs.length || !writeOk()) { fn(packs); return; }
    api('/api/spaces', { method: 'GET' }).then(ok).then(json).then(function (d) {
      S().packages = (d && (d.packages || d.spaces)) || [];
      fn(S().packages);
    }).catch(function () { fn([]); });
  }
  /* People boxes: the merged view (stored overlay + live mail) comes from redesign-pages-b.js. */
  function personBox(id) {
    var st = typeof window.__peopleState === 'function' ? window.__peopleState() : { boxes: peopleBoxList() };
    return (st.boxes || []).filter(function (b) { return String(b.id) === String(id); })[0] || null;
  }
  function pickPersonMail(box, mid) {
    var rows = box.m || [];
    if (mid) {
      var hit = rows.filter(function (r) { return String(r[6]) === String(mid); })[0];
      if (hit) return hit;
    }
    return rows.filter(function (r) { return r[0] === 'in'; })[0] || rows[0] || null;
  }
  function goPersonPipeline(box) {
    S().pipeQ = box.n || (box.addrs || [])[0] || '';
    S().pipeAllRows = true;
    S().mailPerson = '';
    go('contacts');
    refresh('pipe');
  }
  function goPersonSpace(root, box) {
    var addrs = (box.addrs || []).map(function (a) { return String(a).toLowerCase(); });
    withSpaces(function (packs) {
      var hit = packs.filter(function (p) {
        return (p.recipients || p.people || []).some(function (r) { return addrs.indexOf(String(r.email || '').toLowerCase()) >= 0; })
          || String(p.name || '').toLowerCase() === String(box.n || '').toLowerCase();
      })[0];
      if (!hit) { toast(root, 'No Space for ' + box.n + ' yet - add them to one from the reader'); return; }
      S().pkg = hit;
      S().mailPerson = '';
      go('work');
      refresh('spaces');
    });
  }
  /* Book 20 min: open the calendar pop-up with a 20-minute slot for these people. */
  function openBook(people) {
    go('calendar');
    setTimeout(function () {
      var cal = window.__redesignCal;
      if (!cal || typeof cal.openPop !== 'function') return;
      var now = new Date();
      var s = now.getHours() + (now.getMinutes() >= 30 ? 1 : 0.5);
      cal.openPop({ d: cal.ymd(now), s: s, e: s + 20 / 60, t: '20 min' + (people && people[0] ? ' with ' + people[0] : ''), c: 'meet', isNew: true, ppl: (people || []).filter(Boolean), loc: [], links: [], docs: [] }, 620, 220);
    }, 500);
  }
  /* Spaces */
  function spaceById(id) {
    return (S().packages || []).filter(function (p) { return String(p.id) === String(id); })[0] || (S().pkg && String(S().pkg.id) === String(id) ? S().pkg : null);
  }
  function spaceDraft(pkg) {
    var first = (pkg.recipients || pkg.people || [])[0] || {};
    var mail = pkg.email || {};
    return {
      to: first.email ? [{ email: String(first.email).toLowerCase(), name: first.name || '' }] : [],
      subject: pkg.emailSubject || mail.subject || pkg.subject || '',
      body: pkg.emailBody || mail.body || pkg.intro || '',
      attachments: (pkg.docs || pkg.items || []).filter(function (d) { return d && d.kind !== 'link' && d.kind !== 'note' && d.kind !== 'folder'; }),
      spaceId: pkg.id
    };
  }
  function rememberLocalThumb(file) {
    if (!file || !/^image\//.test(file.type || '') || !window.URL || !URL.createObjectURL) return;
    S().spaceLocalThumbs = S().spaceLocalThumbs || {};
    S().spaceLocalThumbs[file.name] = URL.createObjectURL(file);
  }
  function uploadToSpace(root, spaceId, file) {
    rememberLocalThumb(file);
    var fd = new FormData();
    fd.append('file', file);
    fd.append('name', file.name);
    fd.append('mime', file.type || '');
    return api('/api/spaces/' + encodeURIComponent(spaceId) + '/upload', { method: 'POST', body: fd }).then(ok).then(json).then(function (d) {
      if (!d || d.saved === false) throw new Error((d && d.error) || 'not saved');
      var pack = d.package || d;
      if (pack && pack.id && S().pkg && String(S().pkg.id) === String(spaceId)) S().pkg = pack;
      refresh('spaces');
      var item = d.item || {};
      toast(root, file.name + (item.driveFileId || item.drive_file_id ? ' attached and saved to Drive' : ' attached'));
    }).catch(function () { toast(root, 'Could not attach ' + file.name); });
  }
  /* Pipeline */
  function moveOpportunity(oppId, toStageId) {
    var moved = null, from = null;
    (S().ghlPipes || []).forEach(function (pipe) {
      (pipe.stages || []).forEach(function (st) {
        (st.opps || []).forEach(function (o, i) {
          if (String(o.id) === String(oppId) && !moved) { moved = st.opps.splice(i, 1)[0]; from = st; st.count = Math.max(0, (Number(st.count) || 1) - 1); }
        });
      });
    });
    if (!moved) return null;
    (S().ghlPipes || []).forEach(function (pipe) {
      (pipe.stages || []).forEach(function (st) {
        if (String(st.id) === String(toStageId)) { st.opps = st.opps || []; st.opps.unshift(moved); st.count = (Number(st.count) || 0) + 1; }
      });
    });
    return from;
  }
  function pushStage(oppId, pipeId, stageId, stageName, payload) {
    return api('/api/pipeline', { method: 'POST', body: { opportunityId: oppId, pipelineId: pipeId, stageId: stageId, stage: stageName, contactId: payload.contact || '', name: payload.name || '', email: payload.email || '' } })
      .then(json).then(function (d) {
        if (!d || !d.ok) throw new Error((d && d.note) || 'GoHighLevel did not take that stage');
        return d;
      });
  }

  function onClick(e) {
    if (S().signalsOpen) {
      var path = (e.composedPath && e.composedPath()) || [];
      var keep = false;
      for (var i = 0; i < path.length; i++) {
        var n = path[i];
        if (!n || !n.getAttribute) continue;
        if (n.id === 'sigpanel' || n.id === 'sigHost' || (n.classList && n.classList.contains('sigpanel'))) { keep = true; break; }
        var act = n.getAttribute('data-action') || '';
        if (act === 'top-signals' || act === 'signals-open' || act === 'signals-go' || act === 'signals-close') { keep = true; break; }
      }
      if (!keep) {
        S().signalsOpen = false;
        refresh('war');
        var host = document.getElementById('sigHost');
        if (host) { host.classList.remove('on'); host.setAttribute('hidden', ''); }
      }
    }
    if (onClick._t === e.timeStamp && onClick._x === e.clientX && onClick._y === e.clientY) return;
    onClick._t = e.timeStamp; onClick._x = e.clientX; onClick._y = e.clientY;
    var el = actionElFromEvent(e);
    var t = (e.composedPath && e.composedPath()[0]) || e.target;
    if (t && t.closest) {
      var todaySel = t.closest('.exec.today.sel');
      if (todaySel && !t.closest('.cb, .hv, .x2, .selbar, .selbtn, [data-action="exec-select"], [data-action="task-done"], [data-action="task-move"], [data-action="task-drop"]')) {
        var pickTask = t.closest('.task');
        if (pickTask && attr(pickTask, 'data-id')) {
          e.preventDefault();
          actions['exec-pick'](pickTask, rootOf(pickTask, e), e);
          return;
        }
      }
    }
    if (t && t.closest) {
      var ignore = t.closest('input, textarea, select, [contenteditable="true"]');
      var ignAct = ignore && ignore.getAttribute ? (ignore.getAttribute('data-action') || '') : '';
      if (ignore && /^(capture-input|notes-search|note-edit|link-title|link-url|link-search|link-note|plan-draft|reach-pick-search|pipe-search|mail-search|mail-people-search|mail-closed-search|docs-search|spaces-search|space-notes|space-angle|space-subject|space-intro|mail-body|mail-to|mail-subject|mail-col-name|mail-sig|mail-link-url|mail-pick-q|intel-ask|cal-nl|cal-title|cal-notes|cal-date|cal-time|cal-select|cal-people|play-tx|zoom-search|zoom-ask-input|news-search)$/.test(ignAct)) return;
      if (ignore && ignore.hasAttribute && ignore.hasAttribute('data-ext-field')) return;
    }
    var rootEarly = rootOf(el || t, e);
    var menu = rootEarly.getElementById && rootEarly.getElementById('menu');
    if (menu && menu.style.display === 'block' && !(t.closest && t.closest('#menu, [data-action="space-menu"]'))) menu.style.display = 'none';
    if (!el) {
      closePop(rootEarly);
      return;
    }
    var name = attr(el, 'data-action');
    var fn = actions[name];
    var root = rootOf(el, e);
    if (name === 'link-open' && t.closest && t.closest('.tm, [data-action="link-note"]')) return;
    if (name === 'note-open' && t.closest && t.closest('[data-action="note-pin"], [data-action="note-archive"], [data-action="note-task"], [data-action="note-menu"]')) return;
    if (name === 'zoom-open' && t.closest && t.closest('[data-action="zoom-edit"], [data-action="zoom-archive"]')) return;
    if (!fn) { soon(root, name); return; }
    if (name === 'link-open') return;
    if (/^(cal-event|cal-sug|cal-keep|cal-later|cal-drop|cal-rail|cal-pop-close|cal-nl-focus|cal-nl|cal-title|cal-notes|cal-date|cal-time|cal-select|cal-people|cal-save|cal-del|cal-dup|cal-undo|cal-zoom|cal-pick|cal-allday|cal-cell|cal-year-day|cal-more|play-voice-|play-tx|zoom-search|zoom-ask-input|news-search)$/.test(name)) {
      try { fn(el, root, e); } catch (err) { toast(root, 'Could not run that action'); }
      return;
    }
    e.preventDefault();
    try { fn(el, root, e); } catch (err) { toast(root, 'Could not run that action'); }
  }
  function saveSpaceField(el, root) {
    if (!el) return;
    var id = attr(el, 'data-id');
    var act = attr(el, 'data-action');
    var text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
    if (act === 'space-card-name' && !text) {
      text = 'Untitled space';
      el.textContent = text;
    }
    (S().packages || []).forEach(function (p) {
      if (String(p.id) !== String(id)) return;
      if (act === 'space-card-name') p.name = text;
      else { p.description = text; p.notes = text; }
    });
    if (S().pkg && String(S().pkg.id) === String(id)) {
      if (act === 'space-card-name') S().pkg.name = text;
      else { S().pkg.description = text; S().pkg.notes = text; }
    }
    if (!id || !writeOk() || !/^[0-9a-f-]{36}$/i.test(String(id))) return;
    var body = act === 'space-card-name' ? { name: text } : { notes: text, description: text };
    api('/api/spaces/' + encodeURIComponent(id), { method: 'PATCH', body: body }).catch(function () {
      toast(root, 'Could not save that space');
    });
  }
  function onKey(e) {
    /* bound on document (capture) and on every shadow root: run once per event */
    if (e.__deskKey) return;
    e.__deskKey = true;
    var el = actionElFromEvent(e) || (e.target && e.target.closest ? e.target.closest('[data-action]') : null);
    var root = rootOf(el || e.target, e);
    var fieldAct = el && attr(el, 'data-action');
    if (fieldAct && window.__deskKeyExt && typeof window.__deskKeyExt[fieldAct] === 'function') {
      var keyDone = false;
      try { keyDone = window.__deskKeyExt[fieldAct](el, root, e) === true; } catch (err) {}
      if (keyDone) return;
    }
    /* Inline fields on Email: new column name, link address, document picker search. Enter acts, Esc cancels. */
    if (fieldAct === 'mail-col-name' && (e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      if (e.key === 'Escape') { el.value = ''; if (el.blur) el.blur(); return; }
      actions['mail-col-add'](el, root, e);
      return;
    }
    if (fieldAct === 'mail-link-url' && (e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      actions[e.key === 'Escape' ? 'mail-link-cancel' : 'mail-link-apply'](el, root, e);
      return;
    }
    if (fieldAct === 'mail-pick-q' && (e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      if (e.key === 'Escape') actions['mail-pick-close'](el, root, e);
      else pickerSearch(root, String(el.value || ''), true);
      return;
    }
    if ((fieldAct === 'space-card-name' || fieldAct === 'space-card-desc') && (e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      if (e.key === 'Escape' && el.getAttribute('data-orig') != null) el.textContent = el.getAttribute('data-orig');
      else saveSpaceField(el, root);
      if (el.blur) el.blur();
      return;
    }
    if (e.key === 'Escape') {
      var nbig = root.getElementById && root.getElementById('ovNote');
      var nscrim = root.getElementById && root.getElementById('nscrim');
      if (nbig && !nbig.hidden && !nbig.hasAttribute('hidden')) {
        nbig.__flushNote = true;
        saveNote(root, nbig);
        showOv(nbig, false);
        nbig.setAttribute('hidden', '');
        if (nscrim) { nscrim.setAttribute('hidden', ''); nscrim.classList.remove('open'); }
        e.preventDefault();
        return;
      }
      var ov = root.getElementById && (root.getElementById('ov') || root.getElementById('planOv') || root.getElementById('reachOv') || root.getElementById('contactOv'));
      if (ov && ov.classList.contains('open')) {
        showOv(root.getElementById('ov'), false);
        showOv(root.getElementById('planOv'), false);
        showOv(root.getElementById('reachOv'), false);
        showOv(root.getElementById('contactOv'), false);
        e.preventDefault();
        return;
      }
      if (S().signalsOpen) {
        S().signalsOpen = false;
        if (typeof window.paintSignalsOverlay === 'function') window.paintSignalsOverlay(false);
        else refresh('war');
        if (typeof window.closeSignalsPanel === 'function') window.closeSignalsPanel();
        e.preventDefault();
        return;
      }
      if (S().docOpen) { S().docOpen = null; refresh('docs'); e.preventDefault(); return; }
      if (S().mailPerson) { S().mailPerson = ''; refresh('mail'); e.preventDefault(); return; }
      if (S().mailOpen && !S().composeOpen) { S().mailOpen = null; S().mailOpenThread = null; refresh('mail'); e.preventDefault(); return; }
      if (S().mailPeopleDrawer) { S().mailPeopleDrawer = false; refresh('mail'); e.preventDefault(); return; }
      if (S().mailPeoplePanel || S().mailSortOpen || S().mailBoxMenuOpen) {
        S().mailPeoplePanel = '';
        S().mailSortOpen = false;
        S().mailBoxMenuOpen = false;
        refresh('mail');
        e.preventDefault();
        return;
      }
      closePop(root);
    }
    if (!el) return;
    var name = attr(el, 'data-action');
    if (name === 'mail-to' && (e.key === 'Enter' || e.key === ',' || e.key === 'Tab')) {
      var field = attr(el, 'data-field') || 'to';
      var dd = root.getElementById && root.getElementById('dd-' + field);
      var first = dd && dd.style.display !== 'none' ? dd.querySelector('[data-first="1"]') : null;
      var typed = String(el.value || '').trim();
      if (first || EMAIL_RE.test(typed)) {
        e.preventDefault();
        if (first) addRecipient(field, attr(first, 'data-email'), attr(first, 'data-name'));
        else addRecipient(field, typed, '');
        repaintMail();
        focusComposeField(field);
      } else if (e.key === 'Enter' && typed) {
        e.preventDefault();
        toast(root, 'Not a valid email address: ' + typed);
      }
      return;
    }
    if (name === 'mail-to' && e.key === 'Backspace' && !el.value) {
      var d0 = composeState();
      var f0 = attr(el, 'data-field') || 'to';
      if (d0[f0] && d0[f0].length) { d0[f0].pop(); repaintMail(); focusComposeField(f0); }
      return;
    }
    if (name === 'mail-col-title' && (e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      if (e.key === 'Escape') el.textContent = attr(el, 'data-orig');
      if (el.blur) el.blur();
      return;
    }
    if (name === 'mail-search' && e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(mailSearchTimer);
      runMailSearch(String(el.value || '').trim());
      return;
    }
    if (e.key === 'Enter' && name === 'zoom-search') return;
    if (e.key === 'Enter' && name === 'cal-nl') return;
    if (e.key === 'Enter' && (name === 'capture-input' || name === 'link-url' || name === 'link-title')) {
      e.preventDefault();
      if (name === 'capture-input') actions['capture-add'](el, root, e);
      else actions['link-add'](el, root, e);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && window.__deskUndo) {
      e.preventDefault();
      actions['toast-undo'](el, root, e);
    }
  }
  var spaceSaveTimers = {};
  /* Angle, intro and subject each save to their own field. Notes are never overwritten by them. */
  function saveSpaceText(root, el, name) {
    var sid = attr(el, 'data-id') || (S().pkg && S().pkg.id);
    var raw = String(el.value != null ? el.value : (el.innerText || ''));
    if (name === 'space-notes') raw = raw.replace(/\s*Saved\s*$/, '');
    var text = raw.trim();
    var field = { 'space-notes': 'notes', 'space-angle': 'angle', 'space-intro': 'emailBody', 'space-subject': 'emailSubject' }[name];
    if (S().pkg && String(S().pkg.id) === String(sid)) S().pkg[field] = text;
    (S().packages || []).forEach(function (p) { if (String(p.id) === String(sid)) p[field] = text; });
    if (!sid || !writeOk() || !UUID_RE.test(String(sid))) return;
    clearTimeout(spaceSaveTimers[name]);
    spaceSaveTimers[name] = setTimeout(function () {
      var body = {};
      body[field] = text;
      api('/api/spaces/' + encodeURIComponent(sid), { method: 'PATCH', body: body }).then(ok).then(json).then(function (d) {
        if (d && d.saved === false) throw new Error('not saved');
        /* The angle now lives on the server (spaces.angle); drop the old browser-only copy once saved. */
        if (name === 'space-angle') { try { localStorage.removeItem('cr_space_angle_' + sid); } catch (err) {} }
        toast(root, 'Saved');
      }).catch(function () { toast(root, 'Could not save that'); });
    }, 500);
  }
  var mailSearchTimer = 0;
  /* Search all mail: the DOM filter is instant; 3+ characters also asks Gmail (last 90 days). */
  function mailSearchSoon(root, el) {
    var q = String(el.value || '').trim();
    clearTimeout(mailSearchTimer);
    if (q.length && q.length < 3) return;
    mailSearchTimer = setTimeout(function () { runMailSearch(q); }, 500);
  }
  function runMailSearch(q) {
    if (q === (S().mailQ || '')) return;
    if (!q) {
      S().mailQ = '';
      if (S().mailBoardMain) { S().mailBoard = S().mailBoardMain; S().mailBoardMain = null; }
      refocusMailSearch();
      return;
    }
    if (!writeOk()) return;
    api('/api/mail/board?q=' + encodeURIComponent(q), { method: 'GET' }).then(ok).then(json).then(function (d) {
      if (!d || !Array.isArray(d.messages)) return;
      if (!S().mailBoardMain) S().mailBoardMain = S().mailBoard;
      S().mailQ = q;
      S().mailBoard = d;
      refocusMailSearch();
    }).catch(function () {});
  }
  function refocusMailSearch() {
    refresh('mail');
    var root = mailRoot();
    var input = root && root.querySelector('[data-action="mail-search"]');
    if (input && input.focus) { input.focus(); var n = String(input.value || '').length; try { input.setSelectionRange(n, n); } catch (err) {} }
  }
  function onInput(e) {
    var el = e.target;
    if (!el || !el.getAttribute) return;
    var name = el.getAttribute('data-action');
    if (!name) return;
    if (e.__deskInput) return;
    e.__deskInput = true;
    var root = el.getRootNode ? el.getRootNode() : document;
    /* Extension pages (redesign-pages-d / -people / news saved) register input handlers by data-action. */
    if (window.__deskInputExt && typeof window.__deskInputExt[name] === 'function') { try { window.__deskInputExt[name](el, root, e); } catch (err) {} return; }
    if (name === 'notes-search') {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        var chip = root.querySelector('[data-action="notes-filter"].on') || root.querySelector('[data-action="notes-filter"]');
        if (chip) actions['notes-filter'](chip, root, e);
      }, 120);
    }
    if (name === 'note-edit') saveNote(root, el);
    if (name === 'space-notes' || name === 'space-angle' || name === 'space-intro' || name === 'space-subject') {
      saveSpaceText(root, el, name);
    }
    if (name === 'mail-to') {
      var field = attr(el, 'data-field') || 'to';
      composeState().typing[field] = String(el.value || '');
      renderSuggestions(root, field, el.value);
      return;
    }
    if (name === 'mail-subject') { composeState().subject = String(el.value || ''); return; }
    if (name === 'mail-body') {
      var dB = composeState();
      dB.body = String(el.innerText || el.textContent || '');
      dB.bodyHtml = String(el.innerHTML || '');
      dB.bodyHtmlFor = dB.body;
      return;
    }
    if (name === 'mail-sig') { composeState().sigHtml = String(el.innerHTML || ''); return; }
    if (name === 'mail-pick-q') { pickerSearch(root, String(el.value || ''), false); return; }
    if (name === 'mail-ask-input') { composeState().ask = String(el.value || ''); return; }
    if (name === 'space-link-q') {
      var lq = String(el.value || '').toLowerCase();
      root.querySelectorAll('.space-link-row').forEach(function (n) {
        n.style.display = !lq || (n.textContent || '').toLowerCase().indexOf(lq) >= 0 ? '' : 'none';
      });
      return;
    }
    if (name === 'pipe-search') S().pipeQ = String(el.value || '');
    if (name === 'mail-search') mailSearchSoon(root, el);
    if (name === 'news-search') {
      if (e && e.isTrusted === false) return;
      var nextQ = String(el.value || '');
      if (window.STATE) {
        if (window.STATE.newsQ === nextQ) return;
        window.STATE.newsQ = nextQ;
      }
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        if (typeof window.renderNews === 'function') window.renderNews((window.STATE && window.STATE.news) || []);
      }, 120);
    }
    if (name === 'link-search' || name === 'reach-pick-search') {
      var q = String(el.value || '').toLowerCase();
      var rows = name === 'link-search' ? root.querySelectorAll('.tile') : root.querySelectorAll('.pick-row');
      rows.forEach(function (n) {
        n.style.display = !q || (n.textContent || '').toLowerCase().indexOf(q) >= 0 ? '' : 'none';
      });
    }
    if (name === 'mail-people-search') {
      S().mailPeopleQ = String(el.value || '');
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { refresh('mail'); }, 120);
      return;
    }
    if (name === 'mail-closed-search') {
      S().mailClosedQ = String(el.value || '');
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { refresh('mail'); }, 120);
      return;
    }
    if (/^(pipe|mail|docs|spaces|zoom)-search$/.test(name || '')) {
      var q = String(el.value || '').toLowerCase();
      var sel = name === 'pipe-search' ? 'tbody#rows tr, .nd, .pcard, .bcard' : name === 'mail-search' ? '.em' : name === 'docs-search' ? '.fl, .ra' : name === 'zoom-search' ? '.mc' : '.sp';
      root.querySelectorAll(sel).forEach(function (n) {
        n.style.display = !q || (n.textContent || '').toLowerCase().indexOf(q) >= 0 ? '' : 'none';
      });
    }
  }
  function mapContactStage(raw) {
    var s = String(raw || '').toLowerCase();
    if (/lost|dead|closed.?lost/.test(s)) return 'lost';
    if (/commit|won|closed.?won|\bdone\b/.test(s)) return 'committed';
    if (/meet/.test(s)) return 'meeting';
    if (/repl/.test(s)) return 'replied';
    if (/contact/.test(s)) return 'contacted';
    if (/queue|reach|sent|email|nurture/.test(s)) return 'queued';
    return 'new';
  }
  function parseDrag(e) {
    var plain = '';
    try { plain = e.dataTransfer ? e.dataTransfer.getData('text/plain') : ''; } catch (err) { plain = ''; }
    if (plain.indexOf('4orm-doc:') === 0) return { id: plain.slice(9), kind: 'doc' };
    try {
      var o = JSON.parse(plain);
      if (o && (o.id || (o.kind === 'folder' && o.name))) return o;
    } catch (err) {}
    return { id: plain, kind: 'task' };
  }
  function onDragStart(e) {
    var t = (e.composedPath && e.composedPath()[0]) || e.target;
    if (t && t.closest && t.closest('.ev, .calwrap .col, .ghost, .rz')) return;
    var el = t && t.closest ? t.closest('[draggable="true"]') : null;
    if (!el || !e.dataTransfer) return;
    var action = attr(el, 'data-action');
    /* Link-category rows carry data-kind="cat|sub|leaf" for the tree; as a drag payload they are always folders. */
    var kind = action === 'link-cat' ? 'folder' : attr(el, 'data-kind') || (action === 'mail-card' ? 'mail' : action === 'contact-drag' ? 'contact' : action === 'doc-drag' ? 'doc' : action === 'link-cat' ? 'folder' : 'task');
    var payload = JSON.stringify({
      id: attr(el, 'data-id'),
      kind: kind,
      email: attr(el, 'data-email'),
      name: attr(el, 'data-name') || '',
      parent: attr(el, 'data-parent') || '',
      url: attr(el, 'data-url') || attr(el, 'data-web') || '',
      drive: attr(el, 'data-drive') || '',
      mime: attr(el, 'data-mime') || '',
      subject: attr(el, 'data-subject') || '',
      opp: attr(el, 'data-opp') || '',
      pipe: attr(el, 'data-pipe') || '',
      stageId: attr(el, 'data-stage-id') || '',
      stage: attr(el, 'data-stage') || '',
      contact: attr(el, 'data-contact') || ''
    });
    e.dataTransfer.setData('text/plain', payload);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
    onDragStart.moved = true;
    setTimeout(function () { onDragStart.moved = false; }, 400);
  }
  function dropSel() { return '[data-action="col-drop"], [data-action="stage-drop"], [data-action="mail-col-drop"], [data-action="mail-box-drag"], [data-action="space-drop"], [data-action="space-docs"], [data-action="link-cat"], [data-drop-ext]'; }
  function hasFiles(e) {
    try { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; } catch (err) { return false; }
  }
  function uploadDroppedFiles(root, files, spaceId) {
    Array.prototype.forEach.call(files, function (f) {
      if (!spaceId && f.size > DOC_SMALL) { uploadToDrive(root, f, docFolderNow()); return; }
      var fd = new FormData();
      fd.append('file', f);
      fd.append('name', f.name);
      fd.append('mime', f.type || '');
      if (!spaceId) fd.append('category', docFolderNow());
      var url = spaceId && /^[0-9a-f-]{36}$/i.test(String(spaceId))
        ? '/api/spaces/' + encodeURIComponent(spaceId) + '/upload'
        : '/api/documents/upload';
      api(url, { method: 'POST', body: fd }).then(jsonOrThrow).then(function (d) {
        if (spaceId) S().pkg = d.package || d || S().pkg;
        if (!spaceId && typeof window.__portLoadB === 'function') window.__portLoadB('docs');
        refresh('docs'); refresh('spaces'); refresh('drive');
        toast(root, f.name + ' uploaded');
      }).catch(function (err) { toast(root, errText(err, 'Could not upload ' + f.name)); });
    });
  }
  function onDragOver(e) {
    if (hasFiles(e)) e.preventDefault();
    var t = (e.composedPath && e.composedPath()[0]) || e.target;
    if (hasFiles(e) && t && t.closest && t.closest('#compose')) {
      var cr = t.getRootNode ? t.getRootNode() : null;
      var dz = cr && cr.getElementById ? cr.getElementById('composeDrop') : null;
      if (dz) dz.classList.add('over');
      return;
    }
    var col = t && t.closest ? t.closest(dropSel()) : null;
    if (!col) return;
    e.preventDefault();
    col.classList.add('drop-on');
  }
  function onDrop(e) {
    if (e.__deskDrop) return;
    e.__deskDrop = true;
    var t = (e.composedPath && e.composedPath()[0]) || e.target;
    var files = e.dataTransfer && e.dataTransfer.files;
    var root = (t && t.getRootNode && t.getRootNode()) || document;
    if (files && files.length) {
      e.preventDefault();
      e.stopPropagation();
      if (t.closest && t.closest('#compose')) {
        var dz = root.getElementById && root.getElementById('composeDrop');
        if (dz) dz.classList.remove('over');
        addComposeFiles(root, files);
        return;
      }
      var zone = t.closest ? t.closest('[data-action="space-docs"], [data-action="space-drop"]') : null;
      if (zone) {
        var spaceId = attr(zone, 'data-id') || (S().pkg && S().pkg.id) || '';
        zone.classList.remove('drop-on');
        if (!writeOk() || !UUID_RE.test(String(spaceId))) { toast(root, 'Save the Space first, then drop files on it'); return; }
        toast(root, 'Attaching ' + files.length + ' file' + (files.length === 1 ? '' : 's') + '…');
        Array.prototype.forEach.call(files, function (f) { uploadToSpace(root, spaceId, f); });
        return;
      }
      var host = root && root.host;
      if (!(host && host.id === 'docsDesk') && !(t.closest && t.closest('[data-action="docs-upload"]'))) {
        toast(root, 'Drop files onto a Space bundle or onto Documents');
        return;
      }
      uploadDroppedFiles(root, files, '');
      return;
    }
    var col = t && t.closest ? t.closest(dropSel()) : null;
    if (!col) return;
    e.preventDefault();
    col.classList.remove('drop-on');
    if (col.hasAttribute && col.hasAttribute('data-drop-ext')) {
      if (typeof window.__deskDropExt === 'function') { try { window.__deskDropExt(col, parseDrag(e), root, e); } catch (err) { toast(root, 'Could not run that drop'); } }
      return;
    }
    if (attr(col, 'data-action') === 'link-cat') {
      var payloadF = parseDrag(e);
      if (payloadF.kind !== 'folder' || !payloadF.name) return;
      var names = [];
      (root.querySelectorAll ? root.querySelectorAll('[data-action="link-cat"][data-kind="cat"]') : []).forEach(function (row) {
        var nm = attr(row, 'data-name');
        if (nm && names.indexOf(nm) < 0) names.push(nm);
      });
      var target = attr(col, 'data-name');
      var parent = payloadF.parent || '';
      if (!target || target === payloadF.name || attr(col, 'data-kind') === 'all') return;
      /* top / bottom quarter of the row = reorder above / below; middle = nest into it */
      var box = col.getBoundingClientRect ? col.getBoundingClientRect() : null;
      var rel = box && box.height ? (e.clientY - box.top) / box.height : 0.5;
      var nest = attr(col, 'data-kind') === 'cat' && rel > 0.25 && rel < 0.75;
      var order = names.filter(function (n) { return n !== payloadF.name; });
      if (!nest && !parent) {
        var at = order.indexOf(target);
        if (at < 0) at = order.length;
        order.splice(rel >= 0.5 ? at + 1 : at, 0, payloadF.name);
      }
      var cats = S().categories || [];
      if (!nest && !parent) {
        S().categories = order.map(function (n) { return cats.filter(function (c) { return c.name === n; })[0]; }).filter(Boolean)
          .concat(cats.filter(function (c) { return order.indexOf(c.name) < 0; }));
      }
      api('/api/links', { method: 'POST', body: { kind: 'reorder', names: nest || parent ? names : order, moving: payloadF.name, into: nest ? target : '', parent: parent } }).then(ok).then(function () {
        refresh('links'); toast(root, nest ? ('Moved into ' + target) : 'Folder order saved');
        if ((nest || parent) && typeof window.loadBoard === 'function') window.loadBoard();
      }).catch(function () { toast(root, 'Could not save folder order'); });
      return;
    }
    var payload = parseDrag(e);
    var id = payload.id;
    var root = col.getRootNode ? col.getRootNode() : document;
    var act = attr(col, 'data-action');
    if (!id) return;
    if (act === 'stage-drop') {
      var stageName = attr(col, 'data-stage');
      var stageId = attr(col, 'data-stage-id');
      var pipeId = attr(col, 'data-pipe') || payload.pipe;
      if (payload.kind !== 'opp' || !payload.opp) { toast(root, 'Only GoHighLevel cards can move between stages'); return; }
      if (!stageId || stageId === payload.stageId) return;
      var fromStage = moveOpportunity(payload.opp, stageId);
      refresh('pipe');
      if (!writeOk()) { toast(root, 'Moved to ' + stageName + ' (fixture)'); return; }
      pushStage(payload.opp, pipeId, stageId, stageName, payload).then(function () {
        toast(root, 'Moved to ' + stageName + ' in GoHighLevel', function () {
          if (!fromStage) return;
          moveOpportunity(payload.opp, fromStage.id);
          refresh('pipe');
          pushStage(payload.opp, pipeId, fromStage.id, fromStage.name, payload).then(function () {
            toast(root, 'Back in ' + fromStage.name);
          }).catch(function () { toast(root, 'Could not move it back in GoHighLevel'); });
        });
      }).catch(function (err) {
        if (fromStage) moveOpportunity(payload.opp, fromStage.id);
        refresh('pipe');
        toast(root, 'GoHighLevel did not take that move' + (err && err.message && !/^fail$/.test(err.message) ? ' - ' + err.message : ''));
      });
      return;
    }
    if (act === 'mail-col-drop') {
      var column = attr(col, 'data-column');
      if (!column) return;
      if (payload.kind === 'mailcol') { reorderMailColumns(root, id, column); return; }
      if (payload.kind !== 'mail') return;
      if (!writeOk()) { toast(root, 'Filed (fixture)'); return; }
      fileMail(root, id, column, false, payload.email);
      return;
    }
    if (act === 'mail-box-drag') {
      /* B59: a loose sender dropped on a box adds that address to the box (saved). */
      if (payload.kind === 'loose') {
        var into = findPeopleBox(attr(col, 'data-id'), true);
        var addr = String(payload.email || payload.id || '').trim().toLowerCase();
        if (!into || !EMAIL_RE.test(addr)) return;
        into.addrs = into.addrs || [];
        if (into.addrs.indexOf(addr) < 0) into.addrs.push(addr);
        if (!into.o) into.o = addr;
        persistPeopleBoxes();
        refresh('mail');
        toast(root, (payload.name || addr) + ' now lands in ' + (into.n || 'that box'), function () {
          into.addrs = (into.addrs || []).filter(function (a) { return a !== addr; });
          persistPeopleBoxes();
          refresh('mail');
        });
        return;
      }
      if (payload.kind !== 'box' || String(payload.id) === attr(col, 'data-id')) return;
      var mover = findPeopleBox(payload.id, true);
      var target = findPeopleBox(attr(col, 'data-id'), true);
      var boxes = peopleBoxList();
      if (!mover || !target) return;
      boxes.splice(boxes.indexOf(mover), 1);
      boxes.splice(boxes.indexOf(target), 0, mover);
      S().mailPeopleSort = 'my order';
      persistPeopleBoxes();
      refresh('mail');
      toast(root, 'Box order saved');
      return;
    }
    if (act === 'space-drop') {
      var spaceId = attr(col, 'data-id');
      if (!spaceId) return;
      /* A dragged card that is part of the selection carries the whole selection. */
      var dropped = (S().docPick || {})[id] ? docsFor('pick') : [docRow(id) || { id: id, driveFileId: payload.drive, name: payload.name, url: payload.url, mime: payload.mime }];
      var spaceName = (col.querySelector && col.querySelector('b') && col.querySelector('b').textContent) || 'the Space';
      attachDocsToSpace(root, spaceId, dropped, spaceName).then(function (done) {
        if (done && dropped.length > 1) { S().docPick = {}; refresh('docs'); }
      });
      return;
    }
    var bucket = attr(col, 'data-bucket');
    if (!bucket || bucket === 'done') return;
    var srcCard = root.querySelector ? root.querySelector('.task[data-id="' + String(id).replace(/"/g, '') + '"]') : null;
    if (srcCard && srcCard.closest && srcCard.closest('[data-action="col-drop"]') === col) {
      if (bucket === 'today') reorderToday(root, col, id, t, e);
      return;
    }
    var moveReq = isZoomCard(null, root, id) ? zoomPatch(id, { status: 'tasked', column: bucket }) : patchItem(id, { column: bucket });
    moveReq.then(function () {
      refresh('war');
      toast(root, 'Moved to ' + bucket);
    }).catch(function () { toast(root, 'Could not move that task'); });
  }
  /* W39: drop a Today card above / below another Today card; the order saves as items.position. */
  function reorderToday(root, col, id, t, e) {
    if (isZoomCard(null, root, id)) { toast(root, 'Meeting follow-ups stay at the end of Today'); return; }
    var ids = Array.prototype.slice.call(col.querySelectorAll('.task[data-id]')).filter(function (c) {
      return attr(c, 'data-zoom') !== '1';
    }).map(function (c) { return attr(c, 'data-id'); }).filter(function (x) { return x && x !== String(id); });
    var over = t && t.closest ? t.closest('.task[data-id]') : null;
    var at = ids.length;
    if (over && attr(over, 'data-id') !== String(id) && attr(over, 'data-zoom') !== '1') {
      at = ids.indexOf(attr(over, 'data-id'));
      var box = over.getBoundingClientRect ? over.getBoundingClientRect() : null;
      if (box && box.height && e && (e.clientY - box.top) > box.height / 2) at += 1;
      if (at < 0) at = ids.length;
    }
    ids.splice(at, 0, String(id));
    var byId = {};
    (S().items || []).forEach(function (it) { byId[String(it.id)] = it; });
    var changed = ids.filter(function (x, i) { var it = byId[x]; return it && Number(it.position) !== i; });
    ids.forEach(function (x, i) { if (byId[x]) byId[x].position = i; });
    refresh('war');
    if (!changed.length) return;
    if (!writeOk()) { toast(root, 'Order saved (fixture)'); return; }
    Promise.all(changed.map(function (x) {
      return api('/api/items/' + encodeURIComponent(x), { method: 'PATCH', body: { position: ids.indexOf(x) } }).then(ok);
    })).then(function () { toast(root, 'Today order saved'); })
      .catch(function () { toast(root, 'Could not save the new order'); if (typeof window.loadBoard === 'function') window.loadBoard(); });
  }
  function onDragLeave(e) {
    var t = (e.composedPath && e.composedPath()[0]) || e.target;
    var col = t && t.closest ? t.closest(dropSel()) : null;
    if (col) col.classList.remove('drop-on');
  }

  function stampDeskControls(root) {
    if (!root || !root.querySelectorAll) return { withAction: 0, without: 0 };
    var nodes = root.querySelectorAll(CONTROL_SEL);
    var withAction = 0, without = 0;
    nodes.forEach(function (el) {
      if (el.tagName === 'STYLE' || el.tagName === 'LINK' || el.tagName === 'SVG' || el.tagName === 'PATH') return;
      if (el.isContentEditable) return;
      if (!el.getAttribute('data-action')) {
        if (el.querySelector && el.querySelector('[data-action]')) return;
        without += 1;
        var label = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.className || 'control');
        el.setAttribute('data-action', 'coming-soon');
        el.setAttribute('data-label', String(label).trim().replace(/\s+/g, ' ').slice(0, 80));
      }
      withAction += 1;
    });
    var leftover = 0;
    root.querySelectorAll(CONTROL_SEL).forEach(function (el) {
      if (!el.getAttribute('data-action')) leftover += 1;
    });
    return { withAction: withAction, without: leftover, stamped: without };
  }

  function bindShadowActions(root) {
    if (!root) return root;
    if (!root.__deskBound) {
      root.__deskBound = true;
      root.addEventListener('click', onClick);
      root.addEventListener('keydown', onKey);
      root.addEventListener('input', onInput);
      root.addEventListener('focusout', function (e) {
        var t = e.target;
        if (!t || !t.getAttribute) return;
        var act = t.getAttribute('data-action');
        if (act && window.__deskBlurExt && typeof window.__deskBlurExt[act] === 'function') { try { window.__deskBlurExt[act](t, root, e); } catch (err) {} return; }
        if (act === 'note-edit') saveNote(root, t);
        if (act === 'space-card-name' || act === 'space-card-desc') saveSpaceField(t, root);
        if (act === 'mail-col-title') {
          var colName = String(t.textContent || '').replace(/\s+/g, ' ').trim();
          if (!colName) { t.textContent = attr(t, 'data-orig'); return; }
          if (colName !== attr(t, 'data-orig')) renameMailColumn(root, attr(t, 'data-col'), colName);
        }
      }, true);
      root.addEventListener('dragstart', onDragStart);
      root.addEventListener('dragover', onDragOver);
      root.addEventListener('drop', onDrop);
      root.addEventListener('dragleave', onDragLeave);
    }
    stampDeskControls(root);
    return root;
  }

  if (!window.__deskDocBound) {
    window.__deskDocBound = true;
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('dragstart', onDragStart, true);
    document.addEventListener('dragover', onDragOver, true);
    document.addEventListener('drop', onDrop, true);
    document.addEventListener('dragleave', onDragLeave, true);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushOpenNote();
    });
    window.addEventListener('pagehide', flushOpenNote);
  }

  window.bindShadowActions = bindShadowActions;
  window.stampDeskControls = stampDeskControls;
  window.syncDeskFocus = paintFocus;
  window.deskActions = actions;
  window.__deskControlSel = CONTROL_SEL;
  /* Round 3 features (redesign-pages-r3.js) reuse the compose helpers and add their handlers to deskActions. */
  window.__deskMail = { sync: syncCompose, state: composeState, open: openCompose, repaint: repaintMail, bundle: bundleLinksText, toast: toast, root: mailRoot };
  if (!window.__r3Loaded && !document.querySelector('script[data-r3]')) {
    var r3 = document.createElement('script');
    r3.src = '/redesign-pages-r3.js?v=2';
    r3.setAttribute('data-r3', '1');
    document.head.appendChild(r3);
  }
  window.deskInventory = function (root) {
    if (!root) return { withAction: 0, without: 0 };
    var nodes = root.querySelectorAll(CONTROL_SEL);
    var withAction = 0, without = 0;
    nodes.forEach(function (el) {
      if (el.getAttribute('data-action')) withAction += 1;
      else if (el.querySelector && el.querySelector('[data-action]')) { /* wrapper */ }
      else without += 1;
    });
    return { withAction: withAction, without: without, total: nodes.length };
  };
})();
