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
  function findPeopleBox(id) {
    var list = peopleBoxList();
    var i;
    for (i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
    return null;
  }
  function persistPeopleBoxes() {
    var list = peopleBoxList();
    if (fixtureOn()) return;
    S().emailBoxes = list;
    try { localStorage.setItem('cr_email_boxes', JSON.stringify(list)); } catch (e) {}
    if (writeOk()) api('/api/mail/boxes', { method: 'POST', body: { action: 'save', boxes: list } }).catch(function () {});
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
  function logFocusBlock(root) {
    if (!writeOk()) return Promise.resolve();
    var title = 'Focus block 25 min';
    return api('/api/items', { method: 'POST', body: { title: title, area: 'other', priority: 'normal', due: new Date().toISOString() } })
      .then(ok).then(json).then(function (row) {
        if (row && row.id) {
          S().items = S().items || [];
          S().items.unshift(row);
        }
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
    f.running = false; f.paused = false; f.remain = FOCUS_MS; f.end = 0;
    clearInterval(f.tick); f.tick = null;
    paintFocus();
    if (ran && log) logFocusBlock(root);
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
    S().items = (S().items || []).map(function (it) {
      return String(it.id) === String(id) ? Object.assign({}, it, next) : it;
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
      return addTask(title, 'today').then(function () {
        if (input) input.value = '';
        refresh('war');
        toast(root, 'Added to Today');
      }).catch(function () { toast(root, 'Could not add that item'); });
    },
    'focus-toggle': function (el, root) {
      var f = focusState();
      if (f.running && !f.paused) pauseFocus(root);
      else startFocus(root);
    },
    'focus-stop': function (el, root) { stopFocus(root, true); },
    'hero-commit': function (el, root) {
      var id = attr(el, 'data-id');
      var title = attr(el, 'data-title') || (S().ceo && S().ceo.moves && S().ceo.moves[0] && S().ceo.moves[0].text) || 'Today\'s one move';
      try {
        var map = {};
        try { map = JSON.parse(localStorage.getItem('cr_needle') || '{}'); } catch (e) { map = {}; }
        map.one = id || title;
        localStorage.setItem('cr_needle', JSON.stringify(map));
      } catch (e) {}
      toast(root, 'Committed as your one thing');
      refresh('war');
    },
    'hero-plan': function (el, root) { actions['plan-open'](el, root); },
    'hero-cancel': function (el, root) {
      var id = attr(el, 'data-id');
      if (id && typeof window.ceoSnooze === 'function') {
        window.ceoSnooze(id);
        toast(root, 'Move cancelled', function () { if (typeof window.refreshCeo === 'function') window.refreshCeo(); });
        return;
      }
      soon(root, 'Cancel this move');
    },
    'move-do': function (el, root) {
      var id = attr(el, 'data-id');
      if (id && typeof window.ceoDo === 'function') { window.ceoDo(id); toast(root, 'Doing that move'); refresh('war'); return; }
      soon(root, 'Do move');
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
      var map = {};
      try { map = JSON.parse(localStorage.getItem('cr_move_steps') || '{}') || {}; } catch (e) { map = {}; }
      var steps = map[id];
      if (!Array.isArray(steps)) {
        var moves = ((window.REDESIGN_FIXTURE && window.REDESIGN_FIXTURE.war && window.REDESIGN_FIXTURE.war.moves) || (S().ceo && S().ceo.moves) || []);
        var hit = moves.filter(function (m) { return String(m.id) === String(id); })[0];
        steps = (hit && hit.steps) ? hit.steps.slice() : [];
      }
      if (!steps[i]) return;
      steps[i] = Object.assign({}, steps[i], { done: !steps[i].done, when: steps[i].done ? '' : 'done just now' });
      map[id] = steps;
      try { localStorage.setItem('cr_move_steps', JSON.stringify(map)); } catch (e) {}
      refresh('war');
      toast(root, steps[i].done ? 'Step done' : 'Step reopened');
    },
    'step-act': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var act = attr(el, 'data-act') || (el.textContent || '').trim();
      if (/open/i.test(act)) { go('war'); toast(root, 'Opened'); return; }
      if (/call/i.test(act)) { toast(root, 'Call from this move'); return; }
      if (/raise/i.test(act)) { go('war'); toast(root, 'Raise tracker'); return; }
      toast(root, act || 'Step action');
    },
    'step-add': function (el, root) {
      var id = attr(el, 'data-id');
      var text = window.prompt('Add a step');
      if (text == null) return;
      text = String(text).trim();
      if (!text) return;
      var map = {};
      try { map = JSON.parse(localStorage.getItem('cr_move_steps') || '{}') || {}; } catch (e) { map = {}; }
      var steps = Array.isArray(map[id]) ? map[id] : [];
      steps.push({ done: false, text: text });
      map[id] = steps;
      try { localStorage.setItem('cr_move_steps', JSON.stringify(map)); } catch (e) {}
      S().openSteps = id;
      refresh('war');
      toast(root, 'Step added');
      if (writeOk()) {
        api('/api/ceo/plan', { method: 'POST', body: { title: 'Move steps', area: 'other', steps: steps.map(function (s) { return s.text; }), itemId: id } }).catch(function () {});
      }
    },
    'move-plan': function (el, root) { actions['plan-open'](el, root); },
    'move-dismiss': function (el, root) {
      var id = attr(el, 'data-id');
      if (id && typeof window.ceoSnooze === 'function') {
        window.ceoSnooze(id);
        toast(root, 'Move dismissed', function () { if (typeof window.refreshCeo === 'function') window.refreshCeo(); });
        return;
      }
      soon(root, 'Dismiss move');
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
      return addTask(title, bucket).then(function () {
        if (id && writeOk()) {
          return api('/api/meeting-actions', { method: 'POST', body: { id: id, status: 'tasked' } }).then(ok).then(json).then(function (d) {
            if (d && d.actions) S().meetingActions = d.actions;
          });
        }
      }).then(function () { refresh('war'); toast(root, 'Added to ' + (bucket === 'week' ? 'This week' : 'Today')); })
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
      if (task) {
        task.classList.toggle('d');
        task.classList.toggle('done');
        var cb = task.querySelector('.cb');
        if (cb) cb.classList.toggle('on');
      }
      if (!id) { toast(root, 'Checked off'); return; }
      var tag = task && task.querySelector('.tg');
      var fromZoom = tag && /from Zoom/i.test(tag.textContent || '');
      var req = fromZoom
        ? api('/api/meeting-actions', { method: 'POST', body: { id: id, status: 'handled' } }).then(ok).then(json).then(function (d) {
          if (d && d.actions) S().meetingActions = d.actions;
          return patchItem(id, { status: 'done' }).catch(function () {});
        })
        : patchItem(id, { status: 'done' });
      return req.then(function () {
        refresh('war');
        toast(root, 'Done today', function () { patchItem(id, { status: 'new' }).then(function () { refresh('war'); }); });
      }).catch(function () { toast(root, 'Could not complete that task'); });
    },
    'task-move': function (el, root) {
      var id = attr(el, 'data-id');
      var bucket = attr(el, 'data-bucket');
      if (!id || !bucket) return;
      return patchItem(id, { column: bucket }).then(function () {
        refresh('war');
        toast(root, 'Moved to ' + bucket);
      }).catch(function () { toast(root, 'Could not move that task'); });
    },
    'task-drop': function (el, root) {
      var id = attr(el, 'data-id');
      if (!id) return;
      var task = el.closest && el.closest('.task');
      var tag = task && task.querySelector('.tg');
      var fromZoom = tag && /from Zoom/i.test(tag.textContent || '');
      var hide = function () {
        return softDrop(id).then(function () {
          refresh('war');
          toast(root, 'Removed', function () { patchItem(id, { status: 'new' }).then(function () { refresh('war'); }); });
        });
      };
      if (fromZoom) {
        return api('/api/meeting-actions', { method: 'POST', body: { id: id, status: 'handled' } }).then(ok).then(json).then(function (d) {
          if (d && d.actions) S().meetingActions = d.actions;
          return hide();
        }).catch(function () { toast(root, 'Could not hide that task'); });
      }
      return hide().catch(function () { toast(root, 'Could not hide that task'); });
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
      Promise.all(ids.map(function (id) {
        var task = root.querySelector('.task[data-id="' + id + '"]');
        var tag = task && task.querySelector('.tg');
        var fromZoom = tag && /from Zoom/i.test(tag.textContent || '');
        var req = fromZoom ? api('/api/meeting-actions', { method: 'POST', body: { id: id, status: 'handled' } }) : Promise.resolve();
        return req.then(function () { return softDrop(id); });
      })).then(function () {
        S().execSelect = false;
        S().execPicked = {};
        refresh('war');
        toast(root, 'Deleted ' + n, function () {
          Promise.all(ids.map(function (id) { return patchItem(id, { status: 'new' }); })).then(function () { refresh('war'); });
        });
      }).catch(function () { toast(root, 'Could not delete those tasks'); });
    },
    'exec-bulk-week': function (el, root) {
      var ids = Object.keys(S().execPicked || {});
      Promise.all(ids.map(function (id) { return patchItem(id, { column: 'week' }); })).then(function () {
        S().execSelect = false; S().execPicked = {}; refresh('war'); toast(root, 'Moved to Week');
      }).catch(function () { toast(root, 'Could not move those tasks'); });
    },
    'exec-bulk-later': function (el, root) {
      var ids = Object.keys(S().execPicked || {});
      Promise.all(ids.map(function (id) { return patchItem(id, { column: 'later' }); })).then(function () {
        S().execSelect = false; S().execPicked = {}; refresh('war'); toast(root, 'Moved to Later');
      }).catch(function () { toast(root, 'Could not move those tasks'); });
    },
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
    'mail-reply': function (el, root) {
      var r = (root.getElementById && root.getElementById('reader')) || el;
      var row = {
        email: attr(el, 'data-email') || attr(r, 'data-email'),
        subject: attr(el, 'data-subject') || attr(r, 'data-subject'),
        threadId: attr(el, 'data-thread') || attr(r, 'data-thread'),
        from: attr(el, 'data-from') || attr(r, 'data-from') || '',
        snippet: attr(el, 'data-preview') || '',
        messageId: attr(el, 'data-mid') || '',
        body: attr(el, 'data-body') || ''
      };
      S().composeDraft = row;
      S().composeOpen = true;
      go('mail');
      refresh('mail');
      setTimeout(function () {
        var host = document.getElementById('mailDesk');
        var mailRoot = host && host.shadowRoot;
        if (mailRoot) actions['mail-compose'](el, mailRoot);
      }, 40);
      toast(root, 'Opening reply');
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
      return api('/api/notes/sticky', { method: 'POST', body: { body: '', color: 'yellow', meta: { title: '', kind: 'idea' } } }).then(ok).then(json).then(function (row) {
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
        if (!name) return;
        S().noteCats = (S().noteCats || []).concat([String(name).trim()]);
        refresh('notes');
        return;
      }
      S().noteCat = key;
      refresh('notes');
    },
    'note-cat-tag': function (el, root) {
      var id = attr(el, 'data-id');
      var cats = ['Raise', 'Regulators', 'Product', 'Team', 'Research'].concat(S().noteCats || []);
      var cur = attr(el, 'data-cat') || '';
      var i = cats.indexOf(cur);
      var next = cats[(i + 1) % cats.length] || 'Raise';
      el.textContent = next;
      el.setAttribute('data-cat', next);
      (S().notes || []).forEach(function (n) { if (String(n.id) === String(id)) n.category = next; });
      if (!writeOk() || !id) return;
      api('/api/notes/' + encodeURIComponent(id), { method: 'PATCH', body: { category: next } }).catch(function () {});
    },
    'notes-filter': function (el, root) {
      var key = attr(el, 'data-filter') || 'all';
      S().noteFilter = key;
      root.querySelectorAll('[data-action="notes-filter"]').forEach(function (c) {
        c.classList.toggle('on', attr(c, 'data-filter') === key);
      });
      var q = String((root.querySelector('[data-action="notes-search"]') || {}).value || '').toLowerCase();
      root.querySelectorAll('.note').forEach(function (n) {
        var type = String(attr(n, 'data-type') || '').toLowerCase();
        var pin = n.getAttribute('data-pin') === '1';
        var text = (n.textContent || '').toLowerCase();
        var okF = key === 'all' || (key === 'pinned' && pin) || (key === 'archive' ? false : type === key);
        var okQ = !q || text.indexOf(q) >= 0;
        n.style.display = okF && okQ ? '' : 'none';
      });
    },
    'notes-view': function (el, root) {
      var view = attr(el, 'data-view') || 'board';
      root.querySelectorAll('[data-action="notes-view"]').forEach(function (t) {
        t.classList.toggle('on', attr(t, 'data-view') === view);
      });
      root.querySelectorAll('.board').forEach(function (board) {
        board.classList.toggle('canvas', view === 'canvas');
      });
      toast(root, view === 'canvas' ? 'Canvas' : 'Board');
    },
    'notes-tidy': function (el, root) { soon(root, 'Tidy up notes'); },
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
      if (!writeOk()) { toast(root, next ? 'Pinned' : 'Unpinned'); return; }
      try {
        var map = JSON.parse(localStorage.getItem('cr_note_pin') || '{}');
        map[id] = next; localStorage.setItem('cr_note_pin', JSON.stringify(map));
      } catch (e) {}
      var payload = source === 'sticky' ? { meta: { pin: next } } : { pin: next };
      return api('/api/notes/' + encodeURIComponent(id), { method: 'PATCH', body: payload }).then(ok).then(function () {
        refresh('notes'); toast(root, next ? 'Pinned' : 'Unpinned');
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
      var req = source === 'sticky'
        ? api('/api/notes/' + encodeURIComponent(id), { method: 'PATCH', body: { meta: { archived: true } } })
        : api('/api/notes', { method: 'PATCH', body: { id: id, title: '[archived] ' + (attr(el, 'data-title') || 'Note') } });
      return req.then(ok).then(function () {
        toast(root, 'Archived', function () {
          if (source === 'sticky') api('/api/notes/' + id, { method: 'PATCH', body: { meta: { archived: false } } }).then(function () { refresh('notes'); });
          else api('/api/notes', { method: 'PATCH', body: { id: id, title: String(attr(el, 'data-title') || 'Note').replace(/^\[archived\]\s*/, '') } }).then(function () { refresh('notes'); });
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
      if (source === 'sticky') {
        api('/api/notes/' + encodeURIComponent(id), { method: 'PATCH', body: { color: names[color] || 'yellow' } }).then(ok).then(function () {
          toast(root, 'Colour saved');
        }).catch(function () { toast(root, 'Could not save colour'); });
      }
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
      api('/api/spaces/' + encodeURIComponent(sid) + '/items', { method: 'POST', body: { kind: 'note', name: title } }).then(ok).then(function () {
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
      api('/api/links', { method: 'POST', body: { kind: 'delete-category', name: name } }).then(ok).then(function () {
        S().categories = (S().categories || []).filter(function (c) { return c.name !== name; });
        if (S().cat === name) S().cat = '';
        refresh('links');
        toast(root, 'Category hidden', function () { refresh('links'); });
      }).catch(function () { toast(root, 'Could not hide that category'); });
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
            api('/api/links/' + row.id, { method: 'PATCH', body: { note: '__archived__' } }).then(function () { refresh('links'); });
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
      var row = (S().links || []).filter(function (l) { return String(l.id) === id; })[0];
      if (row) row.cat = next;
      api('/api/links', { method: 'POST', body: { title: (row && row.title) || attr(el, 'data-title'), url: (row && row.url) || attr(el, 'data-url'), category: next } }).then(ok).then(function () {
        if (row) api('/api/links/' + id, { method: 'PATCH', body: { note: '__archived__' } });
        refresh('links');
        toast(root, 'Moved to ' + next);
      }).catch(function () { toast(root, 'Could not move that link'); });
    },
    'link-archive': function (el, root, ev) {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      var id = attr(el, 'data-id');
      var tile = el.closest('.tile') || el.closest('a');
      if (tile) tile.style.display = 'none';
      if (!id) { toast(root, 'Hidden'); return; }
      if (!writeOk()) return;
      var prev = attr(el, 'data-note') || '';
      api('/api/links/' + encodeURIComponent(id), { method: 'PATCH', body: { note: '__archived__' } }).then(ok).then(function () {
        toast(root, 'Link hidden', function () {
          api('/api/links/' + id, { method: 'PATCH', body: { note: prev } }).then(function () { refresh('links'); });
        });
      }).catch(function () { toast(root, 'Could not hide that link'); });
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
      el.addEventListener('blur', save, { once: true });
      el.addEventListener('keydown', function onKeyNote(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
        if (e.key === 'Escape') { el.textContent = prev; el.blur(); }
      }, { once: true });
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
      if (body) body.value = '';
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
      api('/api/plans', { method: 'POST', body: { itemId: id, title: title, area: 'other', steps: steps, needs: [], draft: body ? body.value : '', push: true } }).then(ok).then(json).then(function (data) {
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
      var side = document.getElementById('side');
      if (side) side.querySelectorAll('.nav').forEach(function (n) {
        n.setAttribute('draggable', document.body.classList.contains('arranging') ? 'true' : 'false');
      });
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
    'nav-go': function (el) {
      var view = attr(el, 'data-v');
      if (view) go(view);
    },
    'top-signals': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      S().signalsOpen = !S().signalsOpen;
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
      var data = (window.REDESIGN_FIXTURE && window.REDESIGN_FIXTURE.war) || {};
      var html = window.__port && window.__port.signalsHtml
        ? window.__port.signalsHtml(data, true)
        : '<div class="sh"><b>Signals</b><span class="x" data-action="signals-close">&times;</span></div>';
      host.innerHTML = html.replace(/^<div class="sigpanel[^"]*"[^>]*>/, '').replace(/<\/div>$/, '');
      if (!host.querySelector('.sh')) host.innerHTML = html;
      host.classList.add('on');
      host.removeAttribute('hidden');
      if (typeof window.bindShadowActions === 'function') window.bindShadowActions(document);
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
      refresh('war');
      if (typeof window.closeSignalsPanel === 'function') window.closeSignalsPanel();
    },
    'signals-go': function (el) {
      var dest = attr(el, 'data-dest') || '';
      S().signalsOpen = false;
      if (dest === 'mail' || dest === 'email') go('mail');
      else if (dest === 'review' || dest === 'owed') {
        go('war');
        S().reviewMeetings = true;
        refresh('war');
      } else if (dest === 'pipe' || dest === 'pipeline' || dest === 'reach') go('contacts');
      else if (dest === 'people' || dest === 'contacts') go('people');
      else if (dest === 'zoom') go('znotes');
      else if (dest === 'finance' || dest === 'financials') go('finance');
      else if (dest === 'int' || dest === 'fix') go('int');
      else if (dest === 'brain') soon(el, 'Brain log');
    },
    'meet-join': function (el) {
      var url = attr(el, 'data-url');
      if (url) window.open(url, '_blank', 'noopener');
      else soon(el, 'Join meeting');
    },
    'owed-review': function () {
      S().reviewMeetings = true;
      refresh('war');
      toast(document.body, 'Review meeting commitments');
    },
    'reach-pipe': function () { go('contacts'); },
    'nav-reset': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      document.body.classList.remove('arranging');
      try { localStorage.removeItem('cr_nav_order'); } catch (err) {}
      if (typeof window.paintShellNav === 'function') window.paintShellNav();
      toast(root, 'Menu reset to default');
    },
    'task-drag': function () {},
    'col-drop': function () {},
    'capture-input': function () {},
    'link-title': function () {},
    'link-url': function () {},
    'note-edit': function () {},
    'notes-search': function () {},
    'pipe-search': function () {},
    'mail-search': function () {},
    'docs-search': function () {},
    'spaces-search': function () {},
    'mail-card': function (el, root) { actions['mail-open'](el, root); },
    'contact-drag': function (el, root) {
      if (onDragStart.moved) return;
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
    'pipe-need-tick': function (el) {
      el.classList.toggle('on');
      if (el.classList.contains('on')) { el.style.background = 'var(--green)'; el.style.borderColor = 'var(--green)'; }
      else { el.style.background = ''; el.style.borderColor = ''; }
    },
    'pipe-add': function () { go('contacts'); },
    'pipe-follow': function (el, root) {
      var name = attr(el, 'data-name') || 'there';
      var email = attr(el, 'data-email') || '';
      var first = name.split(' ')[0] || 'there';
      var draft = 'Hi ' + first + ',\n\nChecking in on where we left things. Still a good moment to talk 4orm — the record every recommendation was understood and right for the person.\n\nWould 15 minutes this week work?\n\nChad';
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
      api('/api/spaces', { method: 'POST', body: { name: name, kind: 'data_room', spaceType: 'project' } }).then(ok).then(json).then(function (row) {
        if (row && row.id) {
          temp.id = row.id;
          S().spaceFocusId = row.id;
        }
        refresh('spaces');
        toast(root, 'Space created');
      }).catch(function () { toast(root, 'Space is on the desk — not saved yet'); });
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
    'space-email': function () { S().composeOpen = true; go('mail'); },
    'space-book': function () {
      go('calendar');
      setTimeout(function () {
        var cal = window.__redesignCal;
        if (!cal || typeof cal.openPop !== 'function') return;
        var now = new Date();
        var d = cal.ymd(now);
        var s = now.getHours() + (now.getMinutes() >= 30 ? 0.5 : 0);
        cal.openPop({ d: d, s: s, e: s + 20 / 60, t: '20 min', c: 'meet', isNew: true, ppl: [], loc: [], links: [], docs: [] }, 620, 220);
      }, 500);
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
    'space-rewrite': function (el, root) { toast(root, '4orm Intelligence will rewrite the angle'); },
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
      try { localStorage.setItem('cr_space_steps_' + id, JSON.stringify(steps)); } catch (e) {}
    },
    'space-hook': function (el, root) { toast(root, (el.textContent || '').trim() || 'Hook'); },
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
        toast(root, input.files.length + ' file' + (input.files.length === 1 ? '' : 's') + ' staged');
        if (!id || !writeOk() || !/^[0-9a-f-]{36}$/i.test(String(id))) return;
        Array.prototype.forEach.call(input.files, function (f) {
          var fd = new FormData();
          fd.append('file', f);
          fd.append('name', f.name);
          fd.append('mime', f.type || '');
          api('/api/spaces/' + encodeURIComponent(id) + '/upload', { method: 'POST', body: fd }).then(ok).then(json).then(function (d) {
            S().pkg = d.package || d || S().pkg;
            refresh('spaces');
          }).catch(function () { toast(root, 'Could not attach ' + f.name); });
        });
      };
      input.click();
    },
    'space-link': function (el, root) {
      var id = attr(el, 'data-id') || (S().pkg && S().pkg.id);
      var links = (S().links || []);
      var pick = links.slice(0, 40).map(function (l) {
        return (l.title || l.url || '') + ' — ' + (l.url || '');
      });
      var choice = window.prompt('Pick a saved link (paste URL, or type part of the title)\n\n' + pick.slice(0, 12).join('\n'));
      if (!choice || !id) return;
      var hit = links.filter(function (l) {
        var hay = ((l.title || '') + ' ' + (l.url || '')).toLowerCase();
        return hay.indexOf(String(choice).toLowerCase()) >= 0;
      })[0];
      var url = (hit && hit.url) || choice;
      if (!/^https?:\/\//i.test(url) && hit) url = hit.url;
      if (!writeOk()) { toast(root, 'Link added (fixture)'); return; }
      api('/api/spaces/' + encodeURIComponent(id), { method: 'POST', body: { action: 'add-link', url: url, name: (hit && hit.title) || url } }).then(ok).then(json).then(function (d) {
        S().pkg = d.package || d || S().pkg;
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
      api('/api/spaces/' + encodeURIComponent(id), { method: 'POST', body: { action: 'send-ghl' } }).then(ok).then(json).then(function (d) {
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
    'space-archive': function (el, root) {
      var menu = root.getElementById && root.getElementById('menu');
      var id = (menu && attr(menu, 'data-id')) || attr(el, 'data-id');
      if (menu) menu.style.display = 'none';
      if (!id) return;
      var prior = (S().packages || []).slice();
      S().packages = (S().packages || []).filter(function (p) { return String(p.id) !== String(id); });
      if (S().pkg && String(S().pkg.id) === String(id)) S().pkg = null;
      refresh('spaces');
      toast(root, 'Space hidden', function () {
        S().packages = prior;
        refresh('spaces');
      });
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
      go('drive');
      toast(root, 'Opening Drive');
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
        toast(root, files.length + ' file' + (files.length === 1 ? '' : 's') + ' staged — drop onto a Space');
      };
      input.click();
    },
    'doc-open': function (el) {
      S().docOpen = {
        name: attr(el, 'data-name') || 'Document',
        url: attr(el, 'data-url') || attr(el, 'data-web'),
        drive: attr(el, 'data-drive'),
        type: attr(el, 'data-type') || 'doc',
        id: attr(el, 'data-id')
      };
      refresh('docs');
    },
    'doc-close': function () {
      S().docOpen = null;
      refresh('docs');
    },
    'doc-prev': function (el, root) { toast(root, 'Previous file'); },
    'doc-next': function (el, root) { toast(root, 'Next file'); },
    'doc-download': function (el, root) {
      var url = (S().docOpen && S().docOpen.url) || '';
      if (/^https?:\/\//i.test(url)) { window.open(url, '_blank', 'noopener'); return; }
      toast(root, 'Download starts when the file is on Drive');
    },
    'doc-drive-open': function (el, root) {
      var drive = S().docOpen && S().docOpen.drive;
      if (drive) { window.open('https://drive.google.com/file/d/' + encodeURIComponent(drive) + '/view', '_blank', 'noopener'); return; }
      toast(root, 'Not synced to Drive yet');
    },
    'doc-thumb': function () {},
    'doc-slide-prev': function () {},
    'doc-slide-next': function () {},
    'doc-zoom-in': function (el, root) { toast(root, 'Zoom in'); },
    'doc-zoom-out': function (el, root) { toast(root, 'Zoom out'); },
    'doc-fit': function (el, root) { toast(root, 'Fit'); },
    'docs-build-space': function (el, root) {
      if (typeof window.addBlankSpace === 'function') { window.addBlankSpace(); toast(root, 'Building a space from the selection'); return; }
      actions['spaces-new'](el, root);
    },
    'doc-pick': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var id = attr(el, 'data-id');
      if (!id) return;
      S().docPick = S().docPick || {};
      if (S().docPick[id]) delete S().docPick[id];
      else S().docPick[id] = 1;
      el.classList.toggle('on', !!S().docPick[id]);
    },
    'mail-compose': function (el, root) {
      var pkg = S().pkg;
      if (pkg && pkg.id) {
        S().composeDraft = Object.assign({}, S().composeDraft || {}, {
          from: pkg.name || '',
          subject: pkg.subject || '',
          body: pkg.intro || pkg.notes || '',
          attachments: pkg.docs || []
        });
        S().composeOpen = true;
      }
      var cp = root.getElementById && root.getElementById('compose');
      var sc = root.getElementById && root.getElementById('scrim');
      if (cp) cp.classList.add('open');
      if (sc) sc.classList.add('open');
      if (!cp && pkg && pkg.id) go('mail');
    },
    'mail-compose-close': function (el, root) {
      var cp = root.getElementById && root.getElementById('compose');
      var sc = root.getElementById && root.getElementById('scrim');
      if (cp) cp.classList.remove('open');
      if (sc) sc.classList.remove('open');
      S().composeOpen = false;
    },
    'mail-open': function (el, root) {
      var r = root.getElementById && root.getElementById('reader');
      var sc = root.getElementById && root.getElementById('scrim');
      if (r) {
        r.classList.add('open');
        r.setAttribute('data-id', attr(el, 'data-id') || '');
        r.setAttribute('data-thread', attr(el, 'data-thread') || '');
        r.setAttribute('data-email', attr(el, 'data-email') || '');
        r.setAttribute('data-subject', attr(el, 'data-subject') || '');
        var h2 = r.querySelector('h2');
        if (h2) h2.textContent = attr(el, 'data-subject') || 'Thread';
      }
      if (sc) sc.classList.add('open');
      var tid = attr(el, 'data-thread');
      if (tid && writeOk()) api('/api/mail/thread?id=' + encodeURIComponent(tid), { method: 'GET' }).catch(function () {});
    },
    'mail-close': function (el, root) {
      var r = root.getElementById && root.getElementById('reader');
      var sc = root.getElementById && root.getElementById('scrim');
      var cp = root.getElementById && root.getElementById('compose');
      if (r) r.classList.remove('open');
      if (cp) cp.classList.remove('open');
      if (sc) sc.classList.remove('open');
    },
    'mail-body': function () {},
    'mail-to': function () {},
    'mail-subject': function () {},
    'intel-ask': function () {},
    'mail-snooze': function (el, root) {
      var id = attr(el, 'data-id') || attr((root.getElementById && root.getElementById('reader')) || el, 'data-id');
      if (!id || !writeOk()) { toast(root, 'Snoozed (fixture)'); return; }
      api('/api/mail/act', { method: 'POST', body: { action: 'snooze', id: id, hours: 24 } }).then(ok).then(function () {
        toast(root, 'Snoozed 24 hours', function () {
          api('/api/mail/act', { method: 'POST', body: { action: 'move', id: id, column: 'needs_now' } }).then(function () { refresh('mail'); });
        });
        refresh('mail');
      }).catch(function () { toast(root, 'Could not snooze that thread'); });
    },
    'mail-done': function (el, root) {
      var id = attr(el, 'data-id') || attr((root.getElementById && root.getElementById('reader')) || el, 'data-id');
      if (!id || !writeOk()) { toast(root, 'Marked done (fixture)'); return; }
      api('/api/mail/act', { method: 'POST', body: { action: 'done', id: id } }).then(ok).then(function () {
        toast(root, 'Marked done'); refresh('mail');
      }).catch(function () { toast(root, 'Could not mark that done'); });
    },
    'mail-add-space': function (el, root) {
      soon(root, 'Add to Space');
    },
    'mail-move-col': function (el, root) {
      var id = attr(el, 'data-id') || attr((root.getElementById && root.getElementById('reader')) || el, 'data-id');
      var next = window.prompt('Move to column key (needs_now, investors, vcs, prospects, design, team, quiet)', 'prospects');
      if (next == null || !id) return;
      if (!writeOk()) { toast(root, 'Moved (fixture)'); return; }
      api('/api/mail/act', { method: 'POST', body: { action: 'move', id: id, column: String(next).trim() } }).then(ok).then(function () {
        toast(root, 'Filed'); refresh('mail');
      }).catch(function () { toast(root, 'Could not file that thread'); });
    },
    'mail-filters': function (el, root) { soon(root, 'Mail filters'); },
    'mail-rule-new': function (el, root) {
      var match = window.prompt('Rule: sender contains');
      if (match == null || !String(match).trim()) return;
      var target = window.prompt('File into column key (needs_now, investors, vcs, prospects, design, team, quiet)', 'prospects');
      if (target == null) return;
      if (!writeOk()) { toast(root, 'Rule (fixture)'); return; }
      api('/api/mail/rules', { method: 'POST', body: { matchType: 'sender', matchValue: String(match).trim(), target: String(target).trim(), sticky: true } }).then(ok).then(function () {
        toast(root, 'Rule saved'); refresh('mail');
      }).catch(function () { toast(root, 'Could not save that rule'); });
    },
    'mail-auto': function (el, root) {
      var on = true;
      try { on = localStorage.getItem('cr_mail_auto') !== '0'; } catch (e) {}
      try { localStorage.setItem('cr_mail_auto', on ? '0' : '1'); } catch (e) {}
      var dot = root.querySelector('.rules > span');
      if (dot) { dot.classList.toggle('on', !on); dot.style.background = !on ? '' : '#ccd6e4'; }
      toast(root, !on ? 'Auto-filing on' : 'Auto-filing paused');
    },
    'mail-col-menu': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var key = attr(el, 'data-col');
      var name = attr(el, 'data-name') || '';
      openPop(root, el, '<button type="button" data-action="mail-col-rename" data-col="' + esc(key) + '" data-name="' + esc(name) + '">Rename</button>'
        + '<button type="button" data-action="mail-col-new">+ New column</button>');
    },
    'mail-col-rename': function (el, root) {
      closePop(root);
      var key = attr(el, 'data-col');
      var next = window.prompt('Rename this column', attr(el, 'data-name') || '');
      if (next == null || !String(next).trim()) return;
      if (!writeOk()) { toast(root, 'Renamed (fixture)'); return; }
      api('/api/mail/columns', { method: 'POST', body: { action: 'rename', key: key, name: String(next).trim() } }).then(ok).then(function () {
        toast(root, 'Column renamed'); refresh('mail');
      }).catch(function () { soon(root, 'Column menu'); });
    },
    'mail-col-new': function (el, root) {
      var name = window.prompt('New column name');
      if (!name) return;
      name = String(name).trim();
      var cols = Array.isArray(S().emailColumns) ? S().emailColumns.slice() : [];
      if (!cols.length && window.REDESIGN_FIXTURE && window.REDESIGN_FIXTURE.email && window.REDESIGN_FIXTURE.email.cols) {
        cols = window.REDESIGN_FIXTURE.email.cols.slice();
      }
      cols.push({ id: 'c' + Date.now(), n: name, c: ['#12a36a', '#6b4fd8', '#2e6bf2', '#c98408'][cols.length % 4], from: [], ids: [] });
      S().emailColumns = cols;
      refresh('mail');
      if (!writeOk()) { toast(root, 'Column "' + name + '" created - flag mail to fill it'); return; }
      api('/api/mail/columns', { method: 'POST', body: { action: 'create', name: name } }).then(ok).then(function () {
        toast(root, 'Column added'); refresh('mail');
      }).catch(function () { toast(root, 'Column is on the desk — not saved yet'); });
    },
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
      if (el && el.classList) el.classList.add('open');
      var pane = root.querySelector && root.querySelector('#ppread');
      var sj = attr(el, 'data-sj') || '';
      var pv = attr(el, 'data-pv') || '';
      var dir = attr(el, 'data-dir') || 'in';
      var tid = attr(el, 'data-tid') || '';
      var who = attr(el, 'data-who') || '';
      function paint(body) {
        if (!pane) return;
        pane.innerHTML = '<div class="rh"><div class="w">' + esc(dir === 'out' ? 'You to ' + who : who + ' to you') + '</div><h3>' + esc(sj) + '</h3></div><div class="rb">' + (body || esc(pv)).replace(/\n/g, '<br>') + '</div><div class="rf"><button class="btn pri" data-action="mail-pp-go" data-go="reply">Reply</button><button class="btn" data-action="mail-pp-go" data-go="fwd">Forward</button><button class="btn" data-action="mail-pp-go" data-go="space">Add to a Space</button></div>';
      }
      paint(esc(pv));
      if (!tid || !writeOk()) return;
      api('/api/mail/thread?id=' + encodeURIComponent(tid), { method: 'GET' }).then(json).then(function (d) {
        var th = d && d.thread;
        var html = (th && (th.html || th.body || th.text || th.snippet)) || pv;
        paint(String(html));
      }).catch(function () {});
    },
    'mail-pp-go': function (el, root) {
      var goTo = attr(el, 'data-go');
      var box = findPeopleBox(attr(el, 'data-id'));
      var name = box ? box.n : 'this person';
      if (goTo === 'pipeline') { toast(root, 'Opens ' + name + ' in Pipeline'); go('contacts'); return; }
      if (goTo === 'space') { toast(root, 'Opens the ' + name + ' Space'); go('work'); return; }
      if (goTo === 'compose' || goTo === 'reply' || goTo === 'fwd') {
        S().composeOpen = true;
        S().mailView = 'inbox';
        if (box) S().composeTo = (box.addrs && box.addrs[0]) || '';
        refresh('mail');
        return;
      }
      if (goTo === 'book') { toast(root, 'Opens the calendar with a 20-min slot for ' + name); go('calendar'); return; }
    },
    'mail-box-close': function (el, root) {
      var box = findPeopleBox(attr(el, 'data-id'));
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
      var box = findPeopleBox(attr(el, 'data-id'));
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
    'mail-box-tag-add': function (el, root) {
      var box = findPeopleBox(attr(el, 'data-id'));
      if (!box) return;
      var raw = window.prompt('Add a tag (one word, e.g. investor)');
      if (!raw) return;
      var v = String(raw).trim().toLowerCase().replace(/^#/, '');
      box.tags = box.tags || [];
      if (v && box.tags.indexOf(v) < 0) box.tags.push(v);
      persistPeopleBoxes();
      refresh('mail');
    },
    'mail-box-file': function (el, root) {
      var name = attr(el, 'data-file');
      if (name) toast(root, 'Opens ' + name + ' in the in-site viewer');
    },
    'mail-box-new': function (el, root) {
      var n = window.prompt('Who is this box for?');
      if (!n) return;
      var box = { id: 'n' + Date.now(), n: n, o: 'New box', c: '#12a36a', tags: [], in: 0, out: 0, files: [], more: 0, st: ['ok', 'Nothing yet'], last: '-', m: [], closed: false };
      var list = peopleBoxList();
      list.unshift(box);
      persistPeopleBoxes();
      refresh('mail');
      toast(root, 'Box created - drag mail onto it, or it fills as mail arrives');
    },
    'mail-box-act': function (el, root) {
      var box = findPeopleBox(S().mailPeopleMenu);
      var a = attr(el, 'data-a');
      S().mailBoxMenuOpen = false;
      if (!box) { refresh('mail'); return; }
      if (a === 'open') { S().mailPerson = box.id; S().mailPpTab = 'all'; refresh('mail'); return; }
      if (a === 'rename') {
        var next = window.prompt('Rename box', box.n);
        if (next) { box.n = next; persistPeopleBoxes(); }
        refresh('mail');
        return;
      }
      if (a === 'addr') {
        var v = window.prompt('Add an email address to ' + box.n);
        if (v) { box.addrs = (box.addrs || []).concat(v); persistPeopleBoxes(); toast(root, 'Mail from ' + v + ' now files under ' + box.n); }
        refresh('mail');
        return;
      }
      if (a === 'tag') {
        var t = window.prompt('Add a tag');
        if (t) { box.tags = box.tags || []; box.tags.push(String(t).toLowerCase().replace(/^#/, '')); persistPeopleBoxes(); }
        refresh('mail');
        return;
      }
      if (a === 'pipeline') { toast(root, 'Opens ' + box.n + ' in Pipeline'); go('contacts'); return; }
      if (a === 'space') { toast(root, 'Opens the ' + box.n + ' Space'); go('work'); return; }
      if (a === 'close') { box.closed = true; S().mailPeopleDrawer = true; persistPeopleBoxes(); refresh('mail'); toast(root, box.n + ' closed'); return; }
      if (a === 'remove') {
        if (!window.confirm('Remove the ' + box.n + ' box? Its mail stays in the Inbox.')) { refresh('mail'); return; }
        var list = peopleBoxList();
        var i = list.indexOf(box);
        if (i >= 0) list.splice(i, 1);
        persistPeopleBoxes();
        refresh('mail');
        toast(root, 'Box removed');
      }
    },
    'mail-box-drag': function () {},
    'mail-loose-drag': function () {},
    'mail-feed-tab': function (el) {
      S().mailFeedTab = attr(el, 'data-tab') || 'everything';
      refresh('mail');
    },
    'mail-flag': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var id = attr(el, 'data-id');
      var email = attr(el, 'data-email');
      var subject = attr(el, 'data-subject');
      var pop = root.getElementById && root.getElementById('pop');
      if (!pop) return;
      var who = root.getElementById('popwho');
      var from = root.getElementById('popfrom');
      var opts = root.getElementById('popopts');
      var always = root.getElementById('always');
      if (who) who.textContent = subject || '';
      if (from) from.textContent = email || '';
      if (always) always.checked = true;
      var cols = Array.isArray(S().emailColumns) ? S().emailColumns : ((window.REDESIGN_FIXTURE && window.REDESIGN_FIXTURE.email && window.REDESIGN_FIXTURE.email.cols) || []);
      if (opts) {
        opts.innerHTML = cols.map(function (c) {
          return '<div class="opt" data-action="mail-flag-into" data-col="' + esc(c.id) + '" data-id="' + esc(id) + '" data-email="' + esc(email) + '"><i style="background:' + esc(c.c) + '"></i>' + esc(c.n) + '<em>' + ((c.ids || []).indexOf(Number(id)) >= 0 || (c.ids || []).indexOf(id) >= 0 ? 'already here' : (c.ids || []).length + ' emails') + '</em></div>';
        }).join('') + '<div class="opt new" data-action="mail-flag-into" data-col="new" data-id="' + esc(id) + '" data-email="' + esc(email) + '" data-from="' + esc(attr(el, 'data-from')) + '"><i></i>+ New column for this</div>';
      }
      pop.classList.add('on');
      S().mailFlagId = id;
      S().mailFlagEmail = email;
    },
    'mail-flag-into': function (el, root) {
      var colId = attr(el, 'data-col');
      var id = attr(el, 'data-id') || S().mailFlagId;
      var email = attr(el, 'data-email') || S().mailFlagEmail;
      var always = root.getElementById && root.getElementById('always');
      var sticky = !always || always.checked;
      var cols = Array.isArray(S().emailColumns) ? S().emailColumns.slice() : ((window.REDESIGN_FIXTURE && window.REDESIGN_FIXTURE.email && window.REDESIGN_FIXTURE.email.cols) || []).slice();
      var c = cols.filter(function (x) { return x.id === colId; })[0];
      if (colId === 'new') {
        var n = window.prompt('Name the new column', attr(el, 'data-from') || 'New column');
        if (!n) return;
        c = { id: 'c' + Date.now(), n: String(n).trim(), c: '#12a36a', from: [], ids: [] };
        cols.push(c);
      }
      if (!c) return;
      var nid = isNaN(Number(id)) ? id : Number(id);
      if ((c.ids || []).indexOf(nid) < 0 && (c.ids || []).indexOf(id) < 0) c.ids = [nid].concat(c.ids || []);
      if (sticky && email && (c.from || []).indexOf(email) < 0) c.from = (c.from || []).concat([email]);
      S().emailColumns = cols;
      var pop = root.getElementById && root.getElementById('pop');
      if (pop) pop.classList.remove('on');
      refresh('mail');
      toast(root, 'Filed in ' + c.n + (sticky && email ? ' · future mail from ' + email + ' goes there too' : ''), function () {
        c.ids = (c.ids || []).filter(function (x) { return x !== nid && x !== id; });
        refresh('mail');
      });
      if (writeOk()) {
        api('/api/mail/act', { method: 'POST', body: { action: 'move', id: id, column: c.id, sticky: sticky, email: email, matchType: 'sender' } }).catch(function () {});
      }
    },
    'mail-rule-remove': function (el, root, ev) {
      if (ev) ev.stopPropagation();
      var colId = attr(el, 'data-col');
      var email = attr(el, 'data-email');
      var cols = Array.isArray(S().emailColumns) ? S().emailColumns : ((window.REDESIGN_FIXTURE && window.REDESIGN_FIXTURE.email && window.REDESIGN_FIXTURE.email.cols) || []);
      cols.forEach(function (c) {
        if (c.id === colId) c.from = (c.from || []).filter(function (f) { return f !== email; });
      });
      S().emailColumns = cols;
      refresh('mail');
      toast(root, 'Stopped filing ' + email);
    },
    'mail-col-drag': function () {},
    'mail-send': function (el, root) {
      var cp = root.getElementById && root.getElementById('compose');
      var toEl = cp && cp.querySelector('.fr.sugg input, .fr .val input');
      var subEl = cp && cp.querySelector('.fr.subj input');
      var bodyEl = cp && cp.querySelector('.body');
      var to = toEl ? String(toEl.value || '').trim() : '';
      var subject = subEl ? String(subEl.value || '').trim() : '';
      var text = bodyEl ? String(bodyEl.innerText || bodyEl.textContent || '') : '';
      if (!window.confirm('Send this email from Gmail? Nothing goes out until you confirm.')) return;
      if (!writeOk()) { toast(root, 'Send (fixture)'); return; }
      api('/api/mail/act', { method: 'POST', body: { action: 'compose', to: to, subject: subject, text: text } }).then(ok).then(json).then(function (d) {
        toast(root, d && d.ok ? 'Sent from Gmail' : (d && d.drafted ? 'Saved as a Gmail draft' : 'Gmail did not take it'));
        if (d && (d.ok || d.drafted)) actions['mail-compose-close'](el, root);
      }).catch(function () { toast(root, 'Gmail did not take that send'); });
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
      var map = { war: 'war', studio: 'playbook', li: 'people', pipe: 'contacts', spaces: 'work', msg: 'mail', news: 'news', iq: 'int', done: 'done', contacts: 'contacts', team: 'people', dash: 'room' };
      var M = window.__playMount;
      if (M && M.pop) M.pop.classList.remove('show');
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
      api('/api/playbook', { method: 'POST', body: { rhythmId: id, day: day, status: next } }).then(ok).then(json).then(function (d) {
        if (d && window.STATE) window.STATE.playbook = d;
      }).catch(function () { toast(root, 'Could not save that play'); });
    },
    'play-later': function (el, root) {
      var M = window.__playMount;
      if (!M || !M.cur) return;
      var cur = M.cur;
      if (M.pop) M.pop.classList.remove('show');
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
        if (d && window.STATE) window.STATE.playbook = d;
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
      el.classList.toggle('off');
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
      if (!cal || !cal.S || !cal.E) return;
      cal.S.slice().forEach(function (x) { cal.E.push({ d: x.d, s: x.s, e: x.e, t: x.t, c: 'mile' }); });
      cal.S.length = 0;
      if (typeof cal.render === 'function') cal.render();
    },
    'cal-replan': function (el, root) { soon(root, 'Re-plan plays'); },
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
    'cal-allday': function () {},
    'cal-cell': function () {},
    'cal-year-day': function () {},
    'cal-more': function () {},
    'cal-mini-day': function (el) {
      var cal = window.__redesignCal;
      var k = attr(el, 'data-d');
      if (cal && typeof cal.focusTo === 'function' && k) cal.focusTo(k);
    },
    'cal-hint-close': function (el) {
      var n = el.parentNode;
      if (n) n.remove();
    },
    'cal-prep': function (el, root) { soon(root, 'Prep notes'); },
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
      toast(root, 'Meeting hidden', function () { if (card) card.style.display = ''; });
      if (!id || !writeOk()) return;
      api('/api/zoom/' + encodeURIComponent(id), { method: 'PATCH', body: { title: '[archived] ' + (attr(el, 'data-title') || 'Meeting') } }).catch(function () {});
    },
    'zoom-refresh': function (el, root) {
      if (!writeOk()) { toast(root, 'Refresh (fixture)'); return; }
      api('/api/zoom-notes', { method: 'GET' }).then(ok).then(json).then(function (d) {
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
      root.querySelectorAll('[data-action="zoom-filter"]').forEach(function (c) {
        c.classList.toggle('on', attr(c, 'data-filter') === key);
      });
      root.querySelectorAll('.mc').forEach(function (n) {
        var blob = (n.textContent || '').toLowerCase();
        n.style.display = (key === 'all' || blob.indexOf(key) >= 0) ? '' : 'none';
      });
    },
    'zoom-src': function (el, root) {
      var src = attr(el, 'data-src') || 'all';
      root.querySelectorAll('[data-action="zoom-src"]').forEach(function (c) {
        c.classList.toggle('on', attr(c, 'data-src') === src);
      });
      root.querySelectorAll('.mc').forEach(function (n) {
        var s = (n.querySelector('.src') && n.querySelector('.src').textContent || '').toLowerCase();
        n.style.display = (src === 'all' || s.indexOf(src) >= 0) ? '' : 'none';
      });
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
      return addTask(title, bucket).then(function () { toast(root, 'Added to War Room'); }).catch(function () { toast(root, 'Could not create that task'); });
    },
    'zoom-ask-input': function () {},
    'zoom-ask': function (el, root) {
      var box = root.querySelector('.ask input');
      var q = box ? String(box.value || '').trim() : '';
      if (!q) { toast(root, 'Ask about this meeting'); return; }
      soon(root, 'Ask about this meeting');
    },
    'zoom-contact': function () { go('contacts'); },
    'zoom-transcript': function (el, root) { soon(root, 'Open transcript'); },
    'zoom-play': function (el, root) { soon(root, 'Play recording'); },
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
    'news-save': function (el, root) { if (window.__newsHandle) window.__newsHandle('news-save', el, root); },
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
        var meta = Object.assign({}, row.meta && typeof row.meta === 'object' ? row.meta : {}, { title: title });
        req = api('/api/notes/' + encodeURIComponent(id), { method: 'PATCH', body: { body: body, meta: meta } });
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
      if (ignore && /^(capture-input|notes-search|note-edit|link-title|link-url|link-search|link-note|plan-draft|reach-pick-search|pipe-search|mail-search|mail-people-search|mail-closed-search|docs-search|spaces-search|space-notes|space-angle|space-subject|space-intro|mail-body|mail-to|mail-subject|intel-ask|cal-nl|cal-title|cal-notes|cal-date|cal-time|cal-select|cal-people|play-tx|zoom-search|zoom-ask-input|news-search)$/.test(ignAct)) return;
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
    var el = actionElFromEvent(e) || (e.target && e.target.closest ? e.target.closest('[data-action]') : null);
    var root = rootOf(el || e.target, e);
    var fieldAct = el && attr(el, 'data-action');
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
        refresh('war');
        if (typeof window.closeSignalsPanel === 'function') window.closeSignalsPanel();
        e.preventDefault();
        return;
      }
      if (S().docOpen) { S().docOpen = null; refresh('docs'); e.preventDefault(); return; }
      if (S().mailPerson) { S().mailPerson = ''; refresh('mail'); e.preventDefault(); return; }
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
  function onInput(e) {
    var el = e.target;
    if (!el || !el.getAttribute) return;
    var name = el.getAttribute('data-action');
    var root = el.getRootNode ? el.getRootNode() : document;
    if (name === 'notes-search') {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        var chip = root.querySelector('[data-action="notes-filter"].on') || root.querySelector('[data-action="notes-filter"]');
        if (chip) actions['notes-filter'](chip, root, e);
      }, 120);
    }
    if (name === 'note-edit') saveNote(root, el);
    if (name === 'space-notes' || name === 'space-angle' || name === 'space-intro' || name === 'space-subject') {
      var sid = attr(el, 'data-id') || (S().pkg && S().pkg.id);
      var text = String(el.value != null ? el.value : (el.innerText || '')).replace(/\s*Saved.*$/, '').trim();
      if (S().pkg && name === 'space-notes') S().pkg.notes = text;
      if (S().pkg && name === 'space-angle') S().pkg.description = text;
      if (S().pkg && name === 'space-intro') S().pkg.intro = text;
      if (S().pkg && name === 'space-subject') S().pkg.subject = text;
      if (!sid || !writeOk() || !/^[0-9a-f-]{36}$/i.test(String(sid))) return;
      clearTimeout(noteSaveTimer);
      noteSaveTimer = setTimeout(function () {
        var body = name === 'space-intro' ? { intro: text } : name === 'space-subject' ? { subject: text } : { notes: text };
        api('/api/spaces/' + encodeURIComponent(sid), { method: 'PATCH', body: body }).then(ok).then(function () {
          toast(root, 'Saved');
        }).catch(function () { toast(root, 'Could not save those notes'); });
      }, 400);
    }
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
      var sel = name === 'pipe-search' ? 'tbody#rows tr, .nd, .pcard' : name === 'mail-search' ? '.em, .ml' : name === 'docs-search' ? '.fl, .ra' : name === 'zoom-search' ? '.mc' : '.sp';
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
      if (o && o.id) return o;
    } catch (err) {}
    return { id: plain, kind: 'task' };
  }
  function onDragStart(e) {
    var t = (e.composedPath && e.composedPath()[0]) || e.target;
    if (t && t.closest && t.closest('.ev, .calwrap .col, .ghost, .rz')) return;
    var el = t && t.closest ? t.closest('[draggable="true"]') : null;
    if (!el || !e.dataTransfer) return;
    var action = attr(el, 'data-action');
    var kind = attr(el, 'data-kind') || (action === 'mail-card' ? 'mail' : action === 'contact-drag' ? 'contact' : action === 'doc-drag' ? 'doc' : action === 'link-cat' ? 'folder' : 'task');
    var payload = JSON.stringify({
      id: attr(el, 'data-id'),
      kind: kind,
      email: attr(el, 'data-email'),
      name: attr(el, 'data-name') || '',
      parent: attr(el, 'data-parent') || '',
      url: attr(el, 'data-url') || attr(el, 'data-web') || '',
      drive: attr(el, 'data-drive') || '',
      mime: attr(el, 'data-mime') || '',
      subject: attr(el, 'data-subject') || ''
    });
    e.dataTransfer.setData('text/plain', payload);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
    onDragStart.moved = true;
    setTimeout(function () { onDragStart.moved = false; }, 400);
  }
  function dropSel() { return '[data-action="col-drop"], [data-action="stage-drop"], [data-action="mail-col-drop"], [data-action="space-drop"], [data-action="space-docs"], [data-action="link-cat"]'; }
  function hasFiles(e) {
    try { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; } catch (err) { return false; }
  }
  function uploadDroppedFiles(root, files, spaceId) {
    Array.prototype.forEach.call(files, function (f) {
      var fd = new FormData();
      fd.append('file', f);
      fd.append('name', f.name);
      fd.append('mime', f.type || '');
      var url = spaceId && /^[0-9a-f-]{36}$/i.test(String(spaceId))
        ? '/api/spaces/' + encodeURIComponent(spaceId) + '/upload'
        : '/api/documents/upload';
      api(url, { method: 'POST', body: fd }).then(ok).then(json).then(function (d) {
        if (spaceId) S().pkg = d.package || d || S().pkg;
        refresh('docs'); refresh('spaces'); refresh('drive');
        toast(root, f.name + ' uploaded to Drive');
      }).catch(function () { toast(root, 'Could not upload ' + f.name); });
    });
  }
  function onDragOver(e) {
    if (hasFiles(e)) e.preventDefault();
    var t = (e.composedPath && e.composedPath()[0]) || e.target;
    var col = t && t.closest ? t.closest(dropSel()) : null;
    if (!col) return;
    e.preventDefault();
    col.classList.add('drop-on');
  }
  function onDrop(e) {
    var t = (e.composedPath && e.composedPath()[0]) || e.target;
    var files = e.dataTransfer && e.dataTransfer.files;
    var root = (t && t.getRootNode && t.getRootNode()) || document;
    if (files && files.length) {
      e.preventDefault();
      e.stopPropagation();
      var zone = t.closest ? t.closest('[data-action="space-docs"], [data-action="space-drop"]') : null;
      var spaceId = zone ? (attr(zone, 'data-id') || (S().pkg && S().pkg.id) || '') : '';
      uploadDroppedFiles(root, files, spaceId);
      return;
    }
    var col = t && t.closest ? t.closest(dropSel()) : null;
    if (!col) return;
    e.preventDefault();
    col.classList.remove('drop-on');
    if (attr(col, 'data-action') === 'link-cat') {
      var payloadF = parseDrag(e);
      if (payloadF.kind !== 'folder' || !payloadF.name) return;
      var names = [];
      (root.querySelectorAll ? root.querySelectorAll('[data-action="link-cat"][data-kind="cat"]') : []).forEach(function (row) {
        names.push(attr(row, 'data-name'));
      });
      var into = attr(col, 'data-name');
      var parent = payloadF.parent || '';
      if (into === payloadF.name) return;
      api('/api/links', { method: 'POST', body: { kind: 'reorder', names: names, moving: payloadF.name, into: attr(col, 'data-kind') === 'cat' ? into : '', parent: parent } }).then(ok).then(function () {
        refresh('links'); toast(root, 'Folder order saved');
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
      var mapped = mapContactStage(stageName);
      (S().contacts || []).forEach(function (c) {
        if (String(c.id) === String(id)) { c.stage = mapped; c.ghlStage = stageName; }
      });
      refresh('pipe');
      if (!writeOk()) { toast(root, 'Moved to ' + stageName + ' (fixture)'); return; }
      api('/api/contacts', { method: 'PATCH', body: { id: id, stage: mapped } }).then(ok).then(function () {
        return api('/api/pipeline', { method: 'POST', body: { id: id, stage: stageName, name: payload.name, email: payload.email } }).catch(function () { return { ok: false }; });
      }).then(function () {
        toast(root, 'Stage saved to GoHighLevel', function () {
          api('/api/contacts', { method: 'PATCH', body: { id: id, stage: 'new' } }).then(function () { refresh('pipe'); });
        });
      }).catch(function () { toast(root, 'Could not write that stage'); });
      return;
    }
    if (act === 'mail-col-drop') {
      var column = attr(col, 'data-column');
      var sticky = window.confirm('File this email into ' + (attr(col, 'data-name') || column) + '?\n\nOK = file it and save a sticky rule for this sender.');
      if (!writeOk()) { toast(root, 'Filed (fixture)'); refresh('mail'); return; }
      api('/api/mail/act', { method: 'POST', body: { action: 'move', id: id, column: column, sticky: !!sticky, email: payload.email, matchType: 'sender' } }).then(ok).then(function () {
        toast(root, sticky ? 'Filed + rule saved' : 'Filed');
        refresh('mail');
      }).catch(function () { toast(root, 'Could not file that email'); });
      return;
    }
    if (act === 'space-drop') {
      var spaceId = attr(col, 'data-id');
      if (!spaceId) return;
      if (!writeOk()) { toast(root, 'Dropped on Space (fixture)'); return; }
      api('/api/spaces/' + encodeURIComponent(spaceId), { method: 'POST', body: { action: 'add-doc', name: payload.name || 'File', url: payload.url || '', mime: payload.mime || '', driveFileId: payload.drive || id } }).then(ok).then(function () {
        toast(root, 'Added to Space');
        refresh('docs'); refresh('spaces');
      }).catch(function () { toast(root, 'Could not add that file to the Space'); });
      return;
    }
    var bucket = attr(col, 'data-bucket');
    if (!bucket) return;
    patchItem(id, { column: bucket }).then(function () {
      refresh('war');
      toast(root, 'Moved to ' + bucket);
    }).catch(function () { toast(root, 'Could not move that task'); });
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
        if (act === 'note-edit') saveNote(root, t);
        if (act === 'space-card-name' || act === 'space-card-desc') saveSpaceField(t, root);
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
