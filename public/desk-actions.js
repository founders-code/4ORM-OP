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
    '.conv', '.ic', '.mv', '.join', '.bell'
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
    if (opts.body && typeof opts.body !== 'string') {
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
    var host = (root && root.getElementById) ? root.getElementById('deskToast') : null;
    if (!host && root) {
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
    while (el && el !== el.getRootNode && el.nodeType === 1) {
      if (el.getAttribute && el.getAttribute('data-action')) return el;
      el = el.parentElement || (el.getRootNode && el.getRootNode().host) || null;
      if (el && el.nodeType !== 1) break;
    }
    return null;
  }
  function writeOk() { return !fixtureOn(); }

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
    var title = 'TEST Focus block 25 min';
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
      var tmp = { id: 'tmp-' + Date.now(), title: title, status: 'new', due: Date.now() };
      S().items = S().items || []; S().items.unshift(tmp);
      return Promise.resolve(tmp);
    }
    if (typeof window.addItem === 'function' && bucket === 'today' && !extra) {
      window.addItem(title);
      return Promise.resolve({ title: title });
    }
    return api('/api/items', { method: 'POST', body: body }).then(ok).then(json).then(function (row) {
      S().items = S().items || [];
      if (row && row.id) S().items.unshift(row);
      return row;
    });
  }
  function patchItem(id, body) {
    if (!id) return Promise.reject(new Error('id'));
    S().items = (S().items || []).map(function (it) {
      return String(it.id) === String(id) ? Object.assign({}, it, body) : it;
    });
    if (!writeOk()) return Promise.resolve({});
    return api('/api/items', { method: 'PATCH', body: Object.assign({ id: id }, body) }).then(ok).then(json);
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
      var marked = title.indexOf('TEST') === 0 ? title : ('TEST ' + title);
      return addTask(marked, 'today').then(function () {
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
    'hero-plan': function (el) {
      var id = attr(el, 'data-id') || 'ceo:one';
      var title = attr(el, 'data-title') || 'Today\'s one move';
      if (typeof window.openPlan === 'function') window.openPlan(id, title, 'other');
    },
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
      if (id && typeof window.ceoDoSteps === 'function') { window.ceoDoSteps(id); return; }
      soon(root, 'Move steps');
    },
    'move-plan': function (el) {
      var id = attr(el, 'data-id') || '';
      var title = attr(el, 'data-title') || 'Move';
      if (typeof window.openPlan === 'function') window.openPlan(id ? ('ceo:' + id) : 'ceo:move', title, 'other');
    },
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
      var marked = title.indexOf('TEST') === 0 ? title : ('TEST ' + title);
      return addTask(marked, bucket).then(function () {
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
    'reach-add': function (el, root) {
      var name = window.prompt('Name to reach out to');
      if (name == null) return;
      name = String(name).trim();
      if (!name) return;
      var person = { name: name.indexOf('TEST') === 0 ? name : ('TEST ' + name), kind: 'corporate', nextAction: 'Reach out' };
      if (!writeOk()) { toast(root, 'Added (fixture)'); return; }
      api('/api/reach-out', { method: 'POST', body: person }).then(ok).then(json).then(function (row) {
        S().reachOut = S().reachOut || [];
        if (row) S().reachOut.unshift(row);
        refresh('war');
        toast(root, 'Added to Reach out', function () {
          if (row && row.id) api('/api/reach-out/' + row.id, { method: 'PATCH', body: { done: true } }).then(function () { refresh('war'); });
        });
      }).catch(function () { toast(root, 'Could not add that person'); });
    },
    'exec-add': function (el, root) {
      var bucket = attr(el, 'data-bucket') || 'today';
      var title = window.prompt('Task title');
      if (title == null) return;
      title = String(title).trim();
      if (!title) return;
      var marked = title.indexOf('TEST') === 0 ? title : ('TEST ' + title);
      return addTask(marked, bucket).then(function () { refresh('war'); toast(root, 'Card added'); })
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
      if (task) task.classList.toggle('done');
      if (!id) { toast(root, 'Checked off'); return; }
      return patchItem(id, { status: 'done' }).then(function () {
        refresh('war');
        toast(root, 'Completed', function () { patchItem(id, { status: 'new' }).then(function () { refresh('war'); }); });
      }).catch(function () { toast(root, 'Could not complete that task'); });
    },
    'task-move': function (el, root) {
      var id = attr(el, 'data-id');
      var bucket = attr(el, 'data-bucket');
      if (!id || !bucket) return;
      if (typeof window.moveItemColumn === 'function') window.moveItemColumn(id, bucket);
      else return patchItem(id, { column: bucket }).then(function () { refresh('war'); });
      toast(root, 'Moved to ' + bucket);
      setTimeout(function () { refresh('war'); }, 80);
    },
    'task-drop': function (el, root) {
      var id = attr(el, 'data-id');
      if (!id) return;
      return softDrop(id).then(function () {
        refresh('war');
        toast(root, 'Hidden from the board', function () { patchItem(id, { status: 'new' }).then(function () { refresh('war'); }); });
      }).catch(function () { toast(root, 'Could not hide that task'); });
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
      var idx = Number(attr(el, 'data-idx'));
      var thread = attr(el, 'data-thread');
      var email = attr(el, 'data-email');
      var subject = attr(el, 'data-subject');
      var row = { email: email, subject: subject, threadId: thread, from: attr(el, 'data-from'), snippet: attr(el, 'data-preview'), messageId: attr(el, 'data-mid') };
      if (typeof window.openReply === 'function') { window.openReply(row); return; }
      go('mail');
      toast(root, 'Opening reply');
    },
    'mail-more': function (el, root) {
      var email = attr(el, 'data-email');
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
      soon(root, 'Mail menu');
    },
    'inbox-mode': function (el) {
      var mode = attr(el, 'data-mode') || 'people';
      try { localStorage.setItem('cr_inbox_people', mode === 'all' ? '0' : '1'); } catch (e) {}
      refresh('dash');
    },
    'goto-war': function () { go('war'); },
    'open-email': function () { go('mail'); },
    'note-new': function (el, root) {
      var title = 'TEST note ' + new Date().toISOString().slice(11, 19);
      if (!writeOk()) { toast(root, 'New note (fixture)'); return; }
      return api('/api/notes', { method: 'POST', body: { title: title, body: '', color: 'yellow' } }).then(ok).then(json).then(function (row) {
        S().notes = S().notes || [];
        if (row && row.id) S().notes.unshift(row);
        refresh('notes');
        toast(root, 'Note created');
        setTimeout(function () {
          var card = root.querySelector('[data-action="note-open"][data-id="' + (row && row.id) + '"]');
          if (card) actions['note-open'](card, root);
        }, 40);
      }).catch(function () { toast(root, 'Could not create a note'); });
    },
    'notes-search': function () { /* input handler */ },
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
      var board = root.querySelector('.board') || root.querySelector('#board');
      if (board) board.classList.toggle('canvas', view === 'canvas');
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
      if (source === 'sticky') {
        return api('/api/notes/' + encodeURIComponent(id), { method: 'PATCH', body: { meta: { pin: next } } }).then(ok).then(function () {
          refresh('notes'); toast(root, next ? 'Pinned' : 'Unpinned');
        }).catch(function () { toast(root, 'Could not pin that note'); });
      }
      try {
        var map = JSON.parse(localStorage.getItem('cr_note_pin') || '{}');
        map[id] = next; localStorage.setItem('cr_note_pin', JSON.stringify(map));
      } catch (e) {}
      refresh('notes');
      toast(root, next ? 'Pinned' : 'Unpinned');
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
      var marked = title.indexOf('TEST') === 0 ? title : ('TEST ' + title);
      return addTask(marked, 'today').then(function () { toast(root, 'Converted to a task'); refresh('war'); })
        .catch(function () { toast(root, 'Could not convert that note'); });
    },
    'note-open': function (el, root) {
      var ov = root.getElementById && root.getElementById('ov');
      var ot = root.getElementById && root.getElementById('ot');
      var ob = root.getElementById && root.getElementById('ob');
      var okEl = root.getElementById && root.getElementById('ok');
      if (!ov) { soon(root, 'Open note'); return; }
      ov.hidden = false; ov.classList.add('open'); ov.style.display = 'flex';
      if (ot) { ot.textContent = attr(el, 'data-title') || ''; ot.setAttribute('data-id', attr(el, 'data-id')); ot.setAttribute('data-source', attr(el, 'data-source') || ''); }
      if (ob) {
        ob.innerText = attr(el, 'data-body') || '';
        ob.setAttribute('data-id', attr(el, 'data-id'));
        ob.setAttribute('data-source', attr(el, 'data-source') || '');
        ob.setAttribute('data-action', 'note-edit');
      }
      if (okEl) okEl.textContent = attr(el, 'data-type') || 'Note';
    },
    'note-close': function (el, root) {
      var ov = root.getElementById && root.getElementById('ov');
      if (ov) { ov.classList.remove('open'); ov.hidden = true; ov.style.display = 'none'; }
    },
    'note-edit': function () { /* input/blur saves */ },
    'link-cat': function (el, root) {
      var name = attr(el, 'data-name');
      S().cat = name;
      S().linkCat = name;
      refresh('links');
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
      root.querySelectorAll('.cr').forEach(function (n) { n.classList.add('open'); });
      toast(root, 'All categories expanded');
    },
    'nav-arrange': function () {
      var btn = document.getElementById('navArrange');
      if (btn) btn.click();
    },
    'task-drag': function () {},
    'col-drop': function () {},
    'capture-input': function () {},
    'link-title': function () {},
    'link-url': function () {},
    'note-edit': function () {},
    'notes-search': function () {}
  };

  function saveNote(root, el) {
    var id = attr(el, 'data-id');
    if (!id || !writeOk()) return;
    var source = attr(el, 'data-source');
    var ot = root.getElementById && root.getElementById('ot');
    var title = ot ? String(ot.textContent || '').trim() : '';
    var body = String(el.innerText || el.value || '');
    clearTimeout(noteSaveTimer);
    noteSaveTimer = setTimeout(function () {
      var req = source === 'board'
        ? api('/api/notes', { method: 'PATCH', body: { id: id, title: title || 'Note', body: body } })
        : api('/api/notes/' + encodeURIComponent(id), { method: 'PATCH', body: { body: (title ? title + '\n' : '') + body } });
      req.then(ok).then(function () { toast(root, 'Saved'); }).catch(function () { toast(root, 'Could not save that note'); });
    }, 400);
  }

  function onClick(e) {
    var t = e.target;
    if (t && t.closest) {
      var ignore = t.closest('input, textarea, select, [contenteditable="true"]');
      if (ignore && ignore.getAttribute && ignore.getAttribute('data-action') === 'capture-input') {
        return;
      }
      if (ignore && ignore.getAttribute && ignore.getAttribute('data-action') === 'notes-search') return;
      if (ignore && ignore.getAttribute && ignore.getAttribute('data-action') === 'note-edit') return;
      if (ignore && ignore.getAttribute && (ignore.getAttribute('data-action') === 'link-title' || ignore.getAttribute('data-action') === 'link-url')) return;
    }
    var el = t && t.closest ? t.closest('[data-action]') : closestAction(t);
    if (!el) return;
    var name = attr(el, 'data-action');
    var fn = actions[name];
    var root = el.getRootNode ? el.getRootNode() : document;
    if (name === 'link-open' && t.closest && t.closest('.tm')) return;
    if (name === 'note-open' && t.closest && t.closest('[data-action="note-pin"], [data-action="note-archive"], [data-action="note-task"]')) return;
    if (!fn) { soon(root, name); return; }
    if (name === 'link-open') return;
    e.preventDefault();
    try { fn(el, root, e); } catch (err) { toast(root, 'Could not run that action'); }
  }
  function onKey(e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
    if (!el) return;
    var name = attr(el, 'data-action');
    var root = el.getRootNode ? el.getRootNode() : document;
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
  }
  function onDragStart(e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-action="task-drag"], .task') : null;
    if (!el) return;
    var id = attr(el, 'data-id');
    if (!id || !e.dataTransfer) return;
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
  }
  function onDragOver(e) {
    var col = e.target && e.target.closest ? e.target.closest('[data-action="col-drop"], .col') : null;
    if (!col) return;
    e.preventDefault();
    col.classList.add('drop-on');
  }
  function onDrop(e) {
    var col = e.target && e.target.closest ? e.target.closest('[data-action="col-drop"], .col') : null;
    if (!col) return;
    e.preventDefault();
    col.classList.remove('drop-on');
    var id = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
    var bucket = attr(col, 'data-bucket');
    var root = col.getRootNode ? col.getRootNode() : document;
    if (!id || !bucket) return;
    if (typeof window.moveItemColumn === 'function') window.moveItemColumn(id, bucket);
    else patchItem(id, { column: bucket });
    toast(root, 'Moved to ' + bucket);
    setTimeout(function () { refresh('war'); }, 80);
  }
  function onDragLeave(e) {
    var col = e.target && e.target.closest ? e.target.closest('.col') : null;
    if (col) col.classList.remove('drop-on');
  }

  function stampDeskControls(root) {
    if (!root || !root.querySelectorAll) return { withAction: 0, without: 0 };
    var nodes = root.querySelectorAll(CONTROL_SEL);
    var withAction = 0, without = 0;
    nodes.forEach(function (el) {
      if (el.tagName === 'STYLE' || el.tagName === 'LINK' || el.tagName === 'SVG' || el.tagName === 'PATH') return;
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
    if (!root || root.__deskBound) return root;
    root.__deskBound = true;
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    root.addEventListener('input', onInput);
    root.addEventListener('dragstart', onDragStart);
    root.addEventListener('dragover', onDragOver);
    root.addEventListener('drop', onDrop);
    root.addEventListener('dragleave', onDragLeave);
    stampDeskControls(root);
    return root;
  }

  window.bindShadowActions = bindShadowActions;
  window.stampDeskControls = stampDeskControls;
  window.syncDeskFocus = paintFocus;
  window.deskActions = actions;
  window.deskInventory = function (root) {
    if (!root) return { withAction: 0, without: 0 };
    var nodes = root.querySelectorAll(CONTROL_SEL);
    var withAction = 0, without = 0;
    nodes.forEach(function (el) {
      if (el.getAttribute('data-action')) withAction += 1;
      else without += 1;
    });
    return { withAction: withAction, without: without, total: nodes.length };
  };
})();
