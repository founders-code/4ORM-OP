/* Same ShadowPage + paint*Live for live STATE and ?fixture=mockup.
   ONE render path: data = fixtureOn() ? REDESIGN_FIXTURE.page : live*State().
   Fixture is data only. Parts B/C/D must use this same split. */
(function () {
  var TOKEN = ':host,:root{--ground:#0b0c10;--ground2:#0b0c10;--side:#07080b;--card:#fff;--ink:#101a33;--ink2:#4a5672;--ink3:#7a86a0;--line:#e8ecf3;--soft:#f5f7fb;--blue:#2e6bf2;--blue50:#eaf1fe;--green:#12a36a;--green50:#e4f6ee;--amber:#c98408;--amber50:#fff4e0;--red:#e0364f;--red50:#fde9ec;--violet:#6b4fd8;font-family:Inter,-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",system-ui,sans-serif}'
    + '*{box-sizing:border-box}'
    + ':host{display:block;min-width:0;color:var(--ink);font-size:16px;line-height:normal;font-family:Inter,-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",system-ui,sans-serif}'
    + 'button{font:inherit;cursor:pointer}'
    + '.card{background:var(--card);border-radius:16px;box-shadow:0 10px 30px rgba(3,10,30,.22);min-width:0}'
    + '.ch{display:flex;align-items:center;gap:8px;padding:14px 16px 10px}'
    + '.ch h3{margin:0;font-size:14px;font-weight:800}'
    + '.ch .s{margin-left:auto;font-size:12px;color:var(--ink3);font-weight:600;white-space:nowrap}'
    + '.lnk{color:var(--blue);font-weight:700;font-size:12.5px;white-space:nowrap;cursor:pointer}'
    + '.foot{padding:10px 16px 14px;font-size:12.5px;color:var(--ink3);border-top:1px solid var(--line)}'
    + '.port-body{display:block;min-width:0}'
    + '.desk-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:80;background:#18191f;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;display:none;align-items:center;gap:12px;box-shadow:0 10px 30px rgba(3,10,30,.28)}'
    + '.desk-toast.show{display:flex}'
    + '.desk-toast button{background:#fff;color:#142036;border:0;border-radius:8px;padding:4px 10px;font-weight:800;cursor:pointer}'
    + '.col.drop-on{outline:2px dashed var(--blue);outline-offset:-2px}'
    + '.task.done .tt{text-decoration:line-through;opacity:.55}'
    + '.rc.done b{text-decoration:line-through;opacity:.55}'
    + ':host(.desk-full){position:fixed;inset:12px;z-index:30;background:var(--soft);overflow:auto;border-radius:16px}'
    + '[hidden]{display:none!important}'
    + '[data-action]{cursor:pointer}'
    + '.desk-pop{position:absolute;z-index:50;min-width:160px;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 28px rgba(3,10,30,.22);padding:6px;}'
    + '.desk-pop button{display:block;width:100%;text-align:left;border:0;background:transparent;padding:8px 10px;border-radius:8px;font-size:13px;font-weight:650;color:var(--ink)}'
    + '.desk-pop button:hover{background:var(--soft)}'
    + '.ov{position:fixed;inset:0;z-index:45;background:rgba(10,16,40,.45);display:none;align-items:center;justify-content:center;padding:24px}'
    + '.ov.open{display:flex}'
    + '.nscrim{position:fixed;inset:0;background:rgba(5,10,28,.62);backdrop-filter:blur(6px);z-index:60}'
    + '.nbig{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-.4deg);width:720px;max-width:92vw;max-height:82vh;z-index:61;background:#fff6c9;border-radius:6px 6px 22px 6px;box-shadow:0 40px 90px rgba(0,0,0,.55);display:flex;flex-direction:column;color:#3d3200}'
    + '.nbig.y{background:#fff6c9;color:#3d3200}.nbig.p{background:#ffe1ea;color:#3d1020}.nbig.g{background:#ddf5e6;color:#12331e}.nbig.b{background:#e1ecff;color:#10203d}.nbig.o{background:#ffe6cf;color:#3d2200}.nbig.v{background:#ece4ff;color:#24103d}.nbig.w{background:#fff;color:var(--ink)}'
    + '.plan-ov,.pick-ov{position:fixed;inset:0;z-index:46;background:rgba(10,16,40,.45);display:none;align-items:center;justify-content:center;padding:24px}'
    + '.plan-ov.open,.pick-ov.open{display:flex}'
    + '.plan-box,.pick-box{width:min(640px,92vw);max-height:84vh;overflow:auto;background:#fff;border-radius:16px;padding:18px 20px;box-shadow:0 18px 40px rgba(3,10,30,.35)}'
    + '.plan-box h3,.pick-box h3{margin:0 0 12px;font-size:18px}'
    + '.plan-box textarea,.pick-box input{width:100%;border:1px solid var(--line);border-radius:10px;padding:10px;font:inherit;font-size:14px;margin:0 0 10px}'
    + '.plan-acts,.pick-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}'
    + '.plan-acts button,.pick-acts button{height:34px;border-radius:9px;border:1px solid var(--line);background:#fff;padding:0 12px;font-weight:700}'
    + '.plan-acts .pri,.pick-acts .pri{background:var(--blue);border-color:var(--blue);color:#fff}'
    + '.pick-list{max-height:360px;overflow:auto;border:1px solid var(--line);border-radius:12px}'
    + '.pick-row{display:flex;gap:10px;align-items:center;padding:10px 12px;border-top:1px solid var(--line);font-size:13.5px}'
    + '.pick-row:first-child{border-top:0}'
    + '.smenu{position:fixed;z-index:80;width:236px;background:#fff;border:1px solid #e3e8f1;border-radius:12px;box-shadow:0 18px 50px rgba(3,10,30,.35);padding:6px;display:none;font-size:13px}'
    + '.smenu.on{display:block}'
    + '.smenu .it{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;cursor:pointer;color:#101a33;font-weight:650}'
    + '.smenu .it:hover{background:#f3f6fb}'
    + '.smenu .it small{font-size:11.5px;color:#7a86a0;font-weight:600}'
    + '.smenu hr{border:0;border-top:1px solid #eef1f6;margin:5px 4px}'
    + '.smenu .grp,.smenu .folders{padding:4px 10px 6px;display:flex;flex-wrap:wrap;gap:5px}'
    + '.smenu .grp span,.smenu .folders span{font-size:12px;font-weight:700;border:1px solid #e3e8f1;border-radius:999px;padding:3px 9px;cursor:pointer;color:#33405a}'
    + '.smenu .grp span.cur,.smenu .folders span.cur{background:#eaf1fe;border-color:#c9d8ff;color:#2e6bf2}'
    + '.smenu .lb{font-size:11.5px;color:#7a86a0;font-weight:700;padding:6px 10px 2px}'
    + '.smenu .it.red{color:#d6334e}'
    + '.flash-row{box-shadow:0 0 0 3px rgba(127,176,255,.85)!important;transition:box-shadow .2s}';
  var CSS = {
    room: '/port-css/dashboard.css?v=4', war: '/port-css/war-room.css?v=10', notes: '/port-css/notes.css?v=6',
    notesCanvas: '/port-css/notes-canvas.css?v=11', spacesArrange: '/port-css/spaces-arrange.css?v=1', spacesCards: '/port-css/spaces-cards.css?v=18', signalsDetail: '/port-css/signals-detail.css?v=4', rec: '/port-css/recordings.css?v=3',
    contacts: '/port-css/pipeline.css?v=11', work: '/port-css/spaces.css?v=15', spaceOpen: '/port-css/space-open.css?v=3', docs: '/port-css/documents.css?v=11',
    links: '/port-css/links.css?v=14', mail: '/port-css/email.css?v=13', mailPeople: '/port-css/email-people.css?v=10',
    playbook: '/port-css/playbook.css?v=12', calendar: '/port-css/calendar.css?v=9', zoom: '/port-css/zoom.css?v=5',
    completed: '/port-css/completed.css?v=3', planner: '/port-css/planner.css?v=5',
    neon: '/port-css/neon.css?v=2', playbookP8: '/port-css/playbook-p8.css?v=27', plannerNeon: '/port-css/planner-neon.css?v=18',
    calendarNeon: '/port-css/calendar-neon.css?v=14', completedNeon: '/port-css/completed-neon.css?v=8',
    intNeon: '/port-css/integrations-neon.css?v=6',     vaultOps: '/port-css/vault-ops.css?v=14',
    sheetViewer: '/port-css/sheet-viewer.css?v=5', notesCanvasP8: '/port-css/notes-canvas-p8.css?v=4',
    outreach: '/port-css/outreach-lists.css?v=19',
    vault: '/port-css/vault-ops.css?v=14',
    ops: '/port-css/vault-ops.css?v=14',
    contrastP10: '/port-css/contrast-p10.css?v=6'
  };
  var HOSTS = {
    opsDash: 'room', warDesk: 'war', notesDesk: 'notes',
    pipeDesk: 'contacts', spacesDesk: 'work', docsDesk: 'docs', linksDesk: 'links', mailDesk: 'mail',
    playDesk: 'playbook', calDesk: 'calendar', zoomDesk: 'zoom', doneDesk: 'completed', recDesk: 'rec',
    vaultDesk: 'vault', opsDesk: 'ops', intDesk: 'int', plannerDesk: 'planner'
  };
  var NEON_KEYS = { playbook: 1, planner: 1, calendar: 1, contacts: 1, completed: 1, docs: 1, vault: 1, ops: 1, int: 1, war: 1 };
  var cssText = {};
  var cssWait = [];
  var BELL = '<span class="bellT">Alarm</span>';
  var EYE = '<span class="eyeT">Show $</span>';
  var FL = { vc: 'Investor', dp: 'Design partner', rg: 'Regulator' };

  function fixtureOn() {
    try { return /(?:^|[?&])fixture=mockup(?:&|$)/.test(String(location.search || '')); } catch (e) { return false; }
  }
  function qFlag(name) {
    try { return new URLSearchParams(String(location.search || '')).get(name) === '1'; } catch (e) { return false; }
  }
  /* Steps for a CEO move: the saved plan (item_plans via /api/plans) wins,
     otherwise the move's own how[] from /api/ceo. */
  function planFor(id) {
    var list = (window.STATE && window.STATE.plans) || [];
    for (var i = 0; i < list.length; i++) if (list[i] && String(list[i].itemId) === String(id)) return list[i];
    return null;
  }
  function moveSteps(id, move) {
    var plan = planFor(id);
    if (plan && Array.isArray(plan.steps) && plan.steps.length) {
      return plan.steps.map(function (s) {
        return typeof s === 'string' ? { text: s, done: false } : { text: String((s && s.text) || ''), done: !!(s && s.done) };
      }).filter(function (s) { return s.text; });
    }
    var how = (move && (move.how || move.steps)) || [];
    if (!Array.isArray(how)) how = [];
    return how.map(function (s) {
      return typeof s === 'string' ? { text: s, done: false } : { text: String((s && (s.text || s.step)) || ''), done: !!(s && s.done) };
    }).filter(function (s) { return s.text; });
  }
  window.__warMoveSteps = moveSteps;
  function hhmm(ms) {
    if (!ms) return '';
    try {
      return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
    } catch (e) { return ''; }
  }
  function vanDay(ms) {
    try { return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' }); } catch (e) { return ''; }
  }
  /* One "today" for Playbook, Planner, Calendar, Contacts lists, Completed — America/Vancouver. */
  function vancouverTodayIso() {
    try {
      var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      function g(t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value; return ''; }
      return g('year') + '-' + g('month') + '-' + g('day');
    } catch (e) { return vanDay(Date.now()) || ''; }
  }
  function vancouverTodayDate() {
    var iso = vancouverTodayIso();
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return new Date();
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  /* Contacts > Lists day headers use "Wed 28 Oct". */
  function vancouverTodayLabel() {
    try {
      var parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', weekday: 'short', day: 'numeric', month: 'short' }).formatToParts(new Date());
      function g(t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value; return ''; }
      return (g('weekday') + ' ' + g('day') + ' ' + g('month')).replace(/\s+/g, ' ').trim();
    } catch (e) { return ''; }
  }
  window.vancouverTodayIso = vancouverTodayIso;
  window.vancouverTodayDate = vancouverTodayDate;
  window.vancouverTodayLabel = vancouverTodayLabel;
  function committedOne() {
    try {
      var m = JSON.parse(localStorage.getItem('cr_needle') || '{}') || {};
      if (m.one && m.day === vanDay(Date.now())) return String(m.one);
    } catch (e) {}
    return '';
  }

  function findHost(hostId) {
    var host = document.getElementById(hostId);
    if (host) return host;
    var views = ['v-playbook', 'v-calendar', 'v-znotes', 'v-done', 'v-news', 'v-planner'];
    for (var i = 0; i < views.length; i++) {
      var v = document.getElementById(views[i]);
      if (v && v.shadowRoot && v.shadowRoot.getElementById) {
        host = v.shadowRoot.getElementById(hostId);
        if (host) return host;
      }
    }
    return null;
  }
  window.ShadowPage = function (hostId, pageKey) {
    var host = findHost(hostId);
    if (!host) return null;
    if (host.shadowRoot) return host.shadowRoot;
    var root = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = TOKEN + (cssText[pageKey] || '');
    root.appendChild(style);
    var wrap = document.createElement('div');
    wrap.className = 'port-body';
    root.appendChild(wrap);
    if (typeof window.bindShadowActions === 'function') window.bindShadowActions(root);
    return root;
  };

  function cssReady() {
    return Object.keys(CSS).every(function (k) { return cssText[k] != null; });
  }
  function wrapOf(hostId) {
    var key = HOSTS[hostId] || 'notes';
    var root = window.ShadowPage(hostId, key);
    if (!root) return null;
    var style = root.querySelector('style');
    if (style && cssText[key] && style.textContent.indexOf(cssText[key]) < 0) style.textContent = TOKEN + cssText[key];
    return root.querySelector('.port-body') || root;
  }
  function applyPageCss(wrap, key) {
    var root = wrap && wrap.getRootNode ? wrap.getRootNode() : null;
    var style = root && root.querySelector ? root.querySelector('style') : null;
    if (!style) return;
    if (key === 'work+spaceOpen') {
      style.textContent = TOKEN + (cssText.work || '') + (cssText.spacesCards || '') + (cssText.contrastP10 || '');
      return;
    }
    var body = cssText[key] != null ? cssText[key] : '';
    if (key === 'work' || key === 'spacesCards') body = (cssText.work || '') + (cssText.spacesCards || '');
    if (key === 'playbook') body += cssText.playbookP8 || '';
    if (key === 'war' || key === 'planner') body += (cssText.plannerNeon || '') + (cssText.neon || '');
    if (key === 'calendar') body += cssText.calendarNeon || '';
    if (key === 'completed') body += cssText.completedNeon || '';
    if (key === 'int') body += cssText.intNeon || '';
    if (key === 'contacts') body += (cssText.outreach || '') + (cssText.neon || '');
    if (key === 'docs') body += (cssText.sheetViewer || '') + (cssText.neon || '');
    if (key === 'notesCanvas') body += cssText.notesCanvasP8 || '';
    if (key === 'vault' || key === 'ops') body += (cssText.vaultOps || '') + (cssText.neon || '');
    if (NEON_KEYS[key] && cssText.neon && key !== 'war' && key !== 'planner' && key !== 'contacts' && key !== 'docs' && key !== 'vault' && key !== 'ops') body = (cssText.neon || '') + body;
    body += cssText.contrastP10 || '';
    if (wrap && wrap.classList && NEON_KEYS[key]) wrap.classList.add('neon');
    if (cssText[key] != null || body) style.textContent = TOKEN + body;
  }
  function finishPaint(wrap) {
    var root = wrap && wrap.getRootNode ? wrap.getRootNode() : null;
    if (root && typeof window.bindShadowActions === 'function') window.bindShadowActions(root);
    else if (root && typeof window.stampDeskControls === 'function') window.stampDeskControls(root);
    if (root && typeof window.syncDeskFocus === 'function') window.syncDeskFocus(root);
  }

  function whenCss(fn) {
    if (cssReady()) fn();
    else cssWait.push(fn);
  }
  Object.keys(CSS).forEach(function (key) {
    fetch(CSS[key]).then(function (r) { return r.text(); }).then(function (t) {
      cssText[key] = t;
      if (cssReady()) {
        var q = cssWait.splice(0);
        q.forEach(function (fn) { fn(); });
      }
    }).catch(function () {
      cssText[key] = cssText[key] || '';
      if (cssReady()) {
        var q = cssWait.splice(0);
        q.forEach(function (fn) { fn(); });
      }
    });
  });

  function markReady(hostId) {
    if (!fixtureOn() && !window.__boardApplied) {
      window.__pendingReady = window.__pendingReady || [];
      if (window.__pendingReady.indexOf(hostId) < 0) window.__pendingReady.push(hostId);
      return;
    }
    var host = findHost(hostId);
    if (host) host.setAttribute('data-port-ready', '1');
  }
  window.flushPortReady = function () {
    var pending = window.__pendingReady || [];
    window.__pendingReady = [];
    pending.forEach(function (id) { markReady(id); });
  };
  setTimeout(function () {
    if (window.__boardApplied) return;
    window.__boardApplied = true;
    window.flushPortReady();
  }, 12000);
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function moneyOn() {
    try { return localStorage.getItem('cr_show_money') === '1'; } catch (e) { return false; }
  }
  function mask(real) {
    return moneyOn() ? esc(real) : '$&bull;&bull;&bull;&bull;';
  }
  function daysToClose() {
    var S = window.STATE || {};
    var fin = S.finance || {};
    var raise = fin.raise || {};
    var raw = raise.closeDate || raise.close_date || fin.closeDate || '';
    var at = raw ? Date.parse(String(raw).length === 10 ? raw + 'T12:00:00' : raw) : NaN;
    if (!Number.isFinite(at)) return null;
    return Math.max(0, Math.ceil((at - Date.now()) / 86400000));
  }
  function ageLabel(ms) {
    if (!ms) return '';
    var m = Math.round((Date.now() - ms) / 60000);
    if (m < 60) return m + 'm';
    var h = Math.round(m / 60);
    if (h < 48) return h + 'h';
    return Math.round(h / 24) + 'd';
  }
  function soon(ms) {
    var gap = ms - Date.now();
    if (gap < 0) return 'now';
    var mins = Math.round(gap / 60000);
    if (mins < 60) return 'in ' + mins + 'm';
    return 'in ' + Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
  }
  function verbTitle(it) {
    var t = String((it && it.title) || '').trim();
    if (!t) return 'Open task';
    if (/^(call|send|reach|reply|review|fix|move|request|follow|widen|ask|draft|book|lock)\b/i.test(t)) return t;
    if ((it && it.source === 'gmail') || /^(re|fwd?|fw):/i.test(t)) {
      return 'Reply to ' + t.replace(/^(?:re|fwd?|fw):\s*/ig, '').replace(/^["“]|["”]$/g, '');
    }
    return t;
  }
  function liPerson(row) {
    var name = String(row && row.name || '').trim();
    if (!name || /^linkedin$/i.test(name)) return false;
    if (/^team\b/i.test(name) || /\bon linkedin\b/i.test(name)) return false;
    var kind = String(row.kind || row.type || '').toLowerCase();
    if (kind === 'update' || /posted an update/i.test(String(row.snippet || row.preview || ''))) return false;
    return true;
  }
  function initials(name) {
    return String(name || '?').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 2).map(function (p) { return p.slice(0, 1); }).join('').toUpperCase() || '?';
  }
  function colorClass(c) {
    return { yellow: 'y', pink: 'p', green: 'g', blue: 'b', orange: 'o', violet: 'v', white: 'w', purple: 'v' }[String(c || 'yellow')] || 'y';
  }
  function typeCls(t) {
    return { 'To-do': 'todo', Idea: 'idea', Person: 'person', Decision: 'dec', todo: 'todo', idea: 'idea', person: 'person', decision: 'dec', dec: 'dec' }[t] || '';
  }
  function asList(v) {
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.moves)) return v.moves;
    if (v && Array.isArray(v.items)) return v.items;
    if (v && Array.isArray(v.messages)) return v.messages;
    if (v && Array.isArray(v.events)) return v.events;
    if (v && Array.isArray(v.notes)) return v.notes;
    if (v && Array.isArray(v.people)) return v.people;
    if (v && Array.isArray(v.actions)) return v.actions;
    if (v && Array.isArray(v.reach)) return v.reach;
    if (v && Array.isArray(v.contacts)) return v.contacts;
    return [];
  }
  function reachPeople() {
    var S = window.STATE || {};
    var list = asList(S.reachOut);
    if (!list.length) list = asList(S.reach);
    if (!list.length) list = asList(S.reachOut);
    return list.filter(function (p) { return p && (p.name || p.fullName || p.who || p.title || p.company); });
  }
  function sampleKeys(arr) {
    var row = asList(arr)[0];
    return row && typeof row === 'object' ? Object.keys(row) : [];
  }
  function eventStart(ev) {
    if (!ev) return 0;
    var raw = ev.start != null ? ev.start : (ev.startMs != null ? ev.startMs : (ev.startAt != null ? ev.startAt : ev.begin));
    var n = typeof raw === 'number' ? raw : Date.parse(raw || '');
    if (!Number.isFinite(n) || n <= 0) return 0;
    if (n < 1e12) n *= 1000;
    return n;
  }
  function eventTitle(ev) {
    return String((ev && (ev.title || ev.summary || ev.name || ev.event)) || 'Meeting').trim();
  }
  function moveText(m) {
    return String((m && (m.text || m.title || m.name || m.label || m.move || (m.item && m.item.title))) || '').trim();
  }
  function moveWhy(m) {
    return String((m && (m.whyNow || m.why_now || m.why || m.reason || m.detail)) || '').trim();
  }
  function ceoMoves() {
    var S = window.STATE || {};
    var desk = S.ceo || {};
    var list = asList(desk.moves).length ? desk.moves : (asList(S.moves).length ? S.moves : (S.ceoMoves || []));
    return asList(list).filter(function (m) { return moveText(m); }).sort(function (a, b) {
      return (Number(a.rank) || 99) - (Number(b.rank) || 99);
    });
  }
  function itemDue(it) {
    if (!it || it.due == null || it.due === '') return null;
    var n = typeof it.due === 'number' ? it.due : Date.parse(it.due);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (n < 1e12) n *= 1000;
    return n;
  }
  function itemBucket(it) {
    var col = String((it && (it.column || it.bucket)) || '').toLowerCase();
    if (col === 'today' || col === 'week' || col === 'later') return col;
    if (col === 'overdue') return 'overdue';
    if (typeof bucket === 'function') return bucket(it);
    var due = itemDue(it);
    if (due == null) return 'later';
    var a = new Date(due); a.setHours(0, 0, 0, 0);
    var n = new Date(); n.setHours(0, 0, 0, 0);
    var d = Math.round((a - n) / 86400000);
    if (d < 0) return 'overdue';
    if (d === 0) return 'today';
    if (d <= 7) return 'week';
    return 'later';
  }
  function peopleInboxOn() {
    try { return localStorage.getItem('cr_inbox_people') !== '0'; } catch (e) { return true; }
  }
  function mailRows() {
    var S = window.STATE || {};
    var rows = asList(S.mail).length ? S.mail : asList(S.messages);
    var hidden = {};
    (S.mailHidden || []).forEach(function (email) { if (email) hidden[String(email).toLowerCase()] = true; });
    try {
      JSON.parse(localStorage.getItem('cr_inbox_hide') || '[]').forEach(function (email) { if (email) hidden[String(email).toLowerCase()] = true; });
    } catch (e) {}
    function byAt(a, b) {
      return (Number(b.at || b.date || 0) - Number(a.at || a.date || 0));
    }
    var filtered = rows.filter(function (row) {
      var who = String(row.from || row.name || '').replace(/\s+/g, ' ').trim();
      var email = String(row.email || '').toLowerCase();
      if (email && hidden[email]) return false;
      if (/^chad r\.?\s*johnston$/i.test(who) && !row.outbound) return false;
      return true;
    });
    var people = filtered.filter(function (row) { return !row.bulk; }).slice().sort(byAt);
    var bulk = filtered.filter(function (row) { return !!row.bulk; }).slice().sort(byAt);
    return peopleInboxOn() ? people : people.concat(bulk);
  }
  function linkedRows() {
    var S = window.STATE || {};
    return asList(S.linkedin).map(function (row) {
      return {
        name: String(row.name || row.from || row.who || '').trim(),
        kind: row.kind || row.type || '',
        snippet: row.snippet || row.preview || row.subject || '',
        at: Number(row.at || row.date) || 0,
        unread: !!row.unread
      };
    }).filter(liPerson);
  }
  function upcomingEvents() {
    var S = window.STATE || {};
    var now = Date.now() - 60000;
    return asList(S.events).map(function (ev) {
      return { start: eventStart(ev), title: eventTitle(ev), join: ev.join || ev.htmlLink || ev.url || '', raw: ev };
    }).filter(function (ev) { return ev.start >= now; }).sort(function (a, b) { return a.start - b.start; });
  }
  function lampLed(state) {
    var s = String(state || '').toLowerCase();
    if (s === 'red' || s === 'r' || s === 'critical' || s === 'off') return 'r';
    if (s === 'green' || s === 'g' || s === 'ok' || s === 'live') return 'g';
    return 'a';
  }
  function noteKind(raw) {
    var k = String(raw || '').toLowerCase();
    if (k === 'todo' || k === 'to-do') return { type: 'To-do', typeCls: 'todo', convert: 'Convert to tasks' };
    if (k === 'idea') return { type: 'Idea', typeCls: 'idea', convert: 'Make a launch task' };
    if (k === 'person') return { type: 'Person', typeCls: 'person', convert: 'Open his Space' };
    if (k === 'decision' || k === 'dec') return { type: 'Decision', typeCls: 'dec', convert: 'Make a task' };
    if (raw) return { type: String(raw), typeCls: typeCls(raw), convert: 'Convert to task' };
    return { type: 'Note', typeCls: '', convert: 'Convert to task' };
  }
  function noteFromSticky(n) {
    var meta = n.meta && typeof n.meta === 'object' ? n.meta : {};
    var kind = noteKind(meta.kind || n.kind || n.type);
    var body = String(n.body || '');
    var title = String(meta.title || n.title || '');
    if (!title && body.indexOf('\n') >= 0) {
      title = body.split('\n')[0].trim();
      body = body.slice(body.indexOf('\n') + 1).trim();
    }
    var checks = asList(meta.checks || n.checks || n.todos).map(function (c) {
      if (typeof c === 'string') return { done: false, text: c };
      return { done: !!(c.done || c.checked), text: c.text || c.t || c.title || '' };
    });
    var links = [];
    if (meta.link && meta.link.name) links.push(meta.link.name);
    asList(n.links).forEach(function (l) { links.push(typeof l === 'string' ? l : (l && l.name) || ''); });
    return {
      id: String(n.id || ''), source: 'sticky',
      color: colorClass(n.color), type: kind.type, typeCls: kind.typeCls,
      title: title, body: body, pin: !!(meta.pin || n.pin),
      checks: checks, links: links.filter(Boolean),
      reminder: meta.remind || meta.reminder || n.reminder || '',
      convert: meta.convert || kind.convert,
      category: String(meta.category || '').trim(),
      archived: !!meta.archived
    };
  }
  function noteCatName(catId) {
    if (!catId) return '';
    var cats = (window.STATE && window.STATE.noteCats) || [];
    for (var i = 0; i < cats.length; i++) {
      var c = cats[i];
      if (c && typeof c === 'object' && String(c.id) === String(catId)) return /^inbox$/i.test(String(c.name || '')) ? '' : String(c.name || '');
    }
    return '';
  }
  function noteFromBoard(n) {
    var kind = noteKind(n.kind || n.type);
    return {
      id: String(n.id || ''), source: 'board', catId: n.catId || '', category: noteCatName(n.catId),
      color: colorClass(n.color), type: kind.type, typeCls: kind.typeCls,
      title: n.title || '', body: n.body || '', pin: !!n.pin,
      checks: asList(n.checks || n.todos).map(function (c) {
        return { done: !!(c.done || c.checked), text: c.text || c.t || c.title || '' };
      }),
      links: asList(n.links).map(function (l) { return typeof l === 'string' ? l : (l && l.name) || ''; }).filter(Boolean),
      reminder: n.reminder || '', convert: n.convert || kind.convert, archived: false
    };
  }
  function liveLog(page, extra) {
    if (fixtureOn()) return;
    var S = window.STATE || {};
    console.info('[live-map] ' + page, Object.assign({
      mail: asList(S.mail).length, mailKeys: sampleKeys(S.mail),
      linkedin: asList(S.linkedin).length, linkedinKeys: sampleKeys(S.linkedin),
      events: asList(S.events).length, eventKeys: sampleKeys(S.events),
      ceoMoves: asList(S.ceo && S.ceo.moves).length, moveKeys: sampleKeys(S.ceo && S.ceo.moves),
      items: asList(S.items).length, itemKeys: sampleKeys(S.items),
      notes: asList(S.notes).length, stickies: asList(S.stickies).length,
      meetingActions: asList(S.meetingActions).length, reachOut: reachPeople().length,
      finance: S.finance ? Object.keys(S.finance) : null
    }, extra || {}));
  }
  var MAIL_COLORS = ['#2e6bf2', '#0f9fb5', '#c98408', '#6b4fd8', '#12a36a'];

  function liveDashboardState() {
    var S = window.STATE || {};
    var days = daysToClose();
    var items = asList(S.items).filter(function (it) { return it.status !== 'dropped'; });
    var open = items.filter(function (it) { return it.status !== 'done'; });
    var overdue = open.filter(function (it) { return itemBucket(it) === 'overdue'; });
    var mail = mailRows().slice(0, 5);
    var linked = linkedRows().sort(function (a, b) { return (Number(b.at) || 0) - (Number(a.at) || 0); }).slice(0, 8);
    var movers = ceoMoves().slice(0, 3);
    var meetings = upcomingEvents().slice(0, 3);
    var plugs = asList(S.plugins).filter(function (p) { return p.connected || p.on; }).length;
    var queue = S.content || {};
    var kindWord = { message: 'sent you a message', inmail: 'sent you an InMail', invite: 'wants to connect', update: 'posted an update', comment: 'commented on your post', view: 'viewed your profile' };
    function flagOf(row) {
      var blob = ((row.from || '') + ' ' + (row.subject || '') + ' ' + (row.email || '')).toLowerCase();
      if (/vc|venture|investor|angel/.test(blob)) return 'vc';
      if (/broker|design partner|century|remax/.test(blob)) return 'dp';
      if (/regulat|bcfsa|clhia|fcac/.test(blob)) return 'rg';
      return '';
    }
    var alerts = [];
    if (days != null && days <= 14) alerts.push({ sev: 'r', text: 'Raise closes in ' + days + ' days — cheques still open.', area: 'Raise' });
    if (overdue.length) alerts.push({ sev: 'a', text: overdue.length + ' task' + (overdue.length === 1 ? ' is' : 's are') + ' overdue.', area: 'Tasks' });
    if (mail.length) alerts.push({ sev: 'b', text: mail.length + ' people are waiting on a reply.', area: 'Inbox' });
    if (!alerts.length) alerts.push({ sev: 'b', text: 'Desk is clear for now.', area: 'Desk' });
    var fin = S.finance || {};
    var raise = fin.raise || {};
    var ceoLamps = asList(S.ceo && S.ceo.lamps);
    var lampSlots = [
      { re: /runway/, name: 'Runway', led: 'r', word: 'Critical' },
      { re: /raise/, name: 'Raise', led: 'a', word: 'Behind' },
      { re: /pipe/, name: 'Pipeline', led: 'g', word: asList(S.pipeline).length ? 'Live' : 'Waiting' },
      { re: /spend|burn/, name: 'Spend', led: 'a', word: 'Watch' },
      { re: /legal/, name: 'Legal', led: 'a', word: 'Open' },
      { re: /customer|concentrat/, name: 'Customer', led: 'r', word: 'High' },
      { re: /integrat/, name: 'Integrations', led: 'g', word: (plugs || 0) + ' live' }
    ];
    var lamps = lampSlots.map(function (slot) {
      var hit = ceoLamps.filter(function (l) {
        var blob = String(l.key || l.label || l.name || '');
        return slot.re.test(blob);
      })[0];
      var led = hit ? lampLed(hit.state) : slot.led;
      return { led: led, name: slot.name, st: led, word: (hit && (hit.word || hit.state)) || slot.word };
    });
    liveLog('dashboard', { inboxOut: mail.length, linkedOut: linked.length, meetOut: meetings.length, moveOut: movers.length });
    return {
      cash: fin.cashLabel || (fin.cash != null ? ('$' + Number(fin.cash).toLocaleString('en-US')) : '-'),
      burn: fin.burnLabel || '-',
      runway: fin.runwayLabel || '-',
      raise: (raise.inLabel && raise.targetLabel) ? (raise.inLabel + ' of ' + raise.targetLabel) : '-',
      daysToClose: days == null ? '-' : days,
      closeWhen: raise.closeLabel || raise.closeDate || '-',
      lamps: lamps,
      alerts: alerts,
      cheques: asList(fin.cheques).length ? asList(fin.cheques).map(function (c) {
        var st = String(c.state || c.status || '');
        return { cls: st === 'in' ? 'in' : (st === 'pend' || st === 'pending' ? 'pd' : 'op'), label: c.label || c.name || '-' };
      }) : [{ cls: 'op', label: '-' }, { cls: 'op', label: '-' }, { cls: 'op', label: '-' }, { cls: 'op', label: '-' }, { cls: 'op', label: '-' }, { cls: 'op', label: '-' }, { cls: 'op', label: '-' }],
      toGo: raise.toGoLabel || '-',
      bookedWeek: raise.bookedWeekLabel || '-',
      paceNote: raise.pace ? String(raise.pace) : '',
      /* Worries come from the CEO brain when it sends them; no hard-coded runway claims. */
      worries: asList(S.ceo && S.ceo.worries).map(function (w) {
        if (typeof w === 'string') return { tone: 'a', title: w, body: '' };
        return { tone: w && w.tone === 'r' ? 'r' : 'a', title: String((w && (w.title || w.label)) || ''), body: String((w && (w.body || w.detail)) || '') };
      }).filter(function (w) { return w.title; }),
      linkedin: linked.map(function (row) {
        return { name: row.name, action: kindWord[row.kind] || '', snippet: row.snippet, age: ageLabel(row.at), url: row.url || row.link || '' };
      }).filter(function (row) { return row.action && row.action !== 'posted an update'; }),
      inbox: mail.map(function (m, i) {
        return {
          from: m.from || m.name || m.email || 'Sender',
          color: m.color || MAIL_COLORS[i % MAIL_COLORS.length],
          flag: flagOf(m),
          subject: m.subject || '(no subject)',
          preview: m.snippet || m.preview || m.body || '',
          age: ageLabel(m.at || m.date),
          email: m.email, threadId: m.threadId, messageId: m.messageId
        };
      }),
      meetings: meetings.map(function (ev) {
        var url = String(ev.join || ev.url || '');
        var canJoin = /^https?:\/\//i.test(url);
        return { when: soon(ev.start), title: ev.title, kind: canJoin ? 'join' : 'bell', url: canJoin ? url : '' };
      }),
      moves: movers.map(function (move) {
        var zone = String(move.zone || move.area || 'Raise');
        var zc = /partner/i.test(zone) ? 'z3' : /cash|runway/i.test(zone) ? 'z1' : 'z2';
        return { title: moveText(move), why: moveWhy(move), zone: zc, zoneLabel: zone };
      }),
      health: {
        score: '\u2014', dash: '0 301.6',
        bars: [
          { name: 'Cash', pct: 0, color: 'var(--ink3)', n: '\u2014' },
          { name: 'Raise', pct: 0, color: 'var(--ink3)', n: '\u2014' },
          { name: 'Pipeline', pct: 0, color: 'var(--ink3)', n: '\u2014' },
          { name: 'Product', pct: 0, color: 'var(--ink3)', n: '\u2014' },
          { name: 'Legal', pct: 0, color: 'var(--ink3)', n: '\u2014' }
        ]
      },
      momentum: {
        bars: ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'].map(function (day, i) {
          return { h: 4, day: day, now: i === 6 };
        }),
        desk: '\u2014', done: '\u2014', overdue: '\u2014', blocked: '\u2014'
      },
      content: {
        queued: typeof queue.left === 'number' ? queue.left : 0,
        queuedNote: queue.left ? 'posts queued' : 'posts queued — runs dry today',
        barPct: Math.min(100, (Number(queue.left) || 0) * 8) || 4,
        cadence: queue.cadence != null ? (queue.cadence + ' a day') : '-',
        newsletter: queue.newsletterDue || '-',
        nextClip: '-'
      }
    };
  }

  function liveWarState() {
    var S = window.STATE || {};
    var days = daysToClose();
    var fin = S.finance || {};
    var raise = fin.raise || {};
    var allMoves = ceoMoves();
    var one = committedOne();
    if (one) {
      var hit = allMoves.filter(function (m) { return String(m.id || '') === one; })[0];
      if (hit) allMoves = [hit].concat(allMoves.filter(function (m) { return m !== hit; }));
    }
    var moves = allMoves.slice(0, 3);
    var dismissedZoom = S.zoomDismissed || {};
    var actions = asList(S.meetingActions).filter(function (row) {
      if (dismissedZoom[String(row.id || '')]) return false;
      return row.status !== 'done' && row.status !== 'tasked' && row.status !== 'handled' && row.status !== 'dismissed';
    });
    var meetings = upcomingEvents().slice(0, 1);
    var nextEv = meetings[0] || {};
    var todayKey = vanDay(Date.now());
    function colItems(key) {
      return asList(S.items).filter(function (it) {
        if (key === 'done') {
          if (it.status !== 'done') return false;
          var when = it.doneAt || it.completedAt || it.updatedAt || it.updated_at || '';
          if (!when) return false;
          var n = typeof when === 'number' ? when : Date.parse(when);
          if (!Number.isFinite(n)) return false;
          if (n < 1e12) n *= 1000;
          return vanDay(n) === todayKey;
        }
        if (it.status === 'done' || it.status === 'dropped') return false;
        var b = itemBucket(it);
        if (key === 'today') return b === 'today' || b === 'overdue';
        if (key === 'week') return b === 'week';
        return b === 'later';
      });
    }
    var more = S.execMore || {};
    function pack(key, cap) {
      var all = colItems(key);
      if (key === 'today') {
        /* W39: saved drag order first (items.position), then everything else in its usual order. */
        all = all.map(function (it, i) { return [it, i]; }).sort(function (a, b) {
          var pa = a[0].position == null ? 1e9 + a[1] : Number(a[0].position);
          var pb = b[0].position == null ? 1e9 + b[1] : Number(b[0].position);
          return pa - pb;
        }).map(function (pair) { return pair[0]; });
      }
      var limit = more[key] ? all.length : (cap || 8);
      return { count: all.length, more: Math.max(0, all.length - limit), tasks: all.slice(0, limit).map(function (it) {
        return { id: it.id, title: verbTitle(it), tag: it.tag || it.category || it.area || 'Ops' };
      }) };
    }
    var zoomTasks = actions.map(function (row) {
      var who = row.person || row.from || row.who || (row.meetingTitle || row.meeting_title || '').split(/[·|]/)[0] || 'meeting';
      return { id: row.id || '', title: row.text || row.body || 'Meeting follow-up', tag: 'from Zoom · ' + String(who).trim(), fromMeeting: true };
    });
    var todayPack = pack('today', 12);
    var seen = {};
    todayPack.tasks.forEach(function (t) { seen[t.id] = true; });
    zoomTasks.forEach(function (t) {
      if (t.id && seen[t.id]) return;
      todayPack.tasks.push(t);
      todayPack.count += 1;
    });
    var heroMove = moves[0] || {};
    var people = reachPeople();
    var pb = S.playbook || null;
    var lights = null;
    if (pb) {
      if (pb.todayLit != null) lights = Number(pb.todayLit) || 0;
      else if (pb.lightsLeft != null) lights = Number(pb.lightsLeft) || 0;
      else if (pb.left != null) lights = Number(pb.left) || 0;
    }
    var mailNeed = asList(S.mail).filter(function (m) { return m && (m.unread || m.needsReply || m.needReply); }).length;
    var cold = asList(S.contacts).filter(function (c) {
      var last = c.lastTouch || c.last_touch || c.lastContact || '';
      if (!last) return false;
      return (Date.now() - new Date(last).getTime()) / 86400000 >= 14;
    }).length;
    var attn = asList(S.integrations).filter(function (g) { return /warn|error|off|attention|missing/i.test(String(g.state || g.word || '')); }).length;
    var reachN = people.filter(function (p) { return !p.done; }).length;
    var sigCount = mailNeed + actions.length + reachN;
    var ceo = S.ceo || {};
    var rebuilt = ceo.rebuiltAt || ceo.generatedAt || ceo.refreshedAt || ceo.updatedAt || null;
    if (rebuilt && typeof rebuilt !== 'number') rebuilt = Date.parse(rebuilt);
    liveLog('war', { moveOut: moves.length, actOut: actions.length, today: todayPack.count, week: colItems('week').length, later: colItems('later').length });
    return {
      cash: fin.cashLabel || '-',
      runway: fin.runwayLabel || '-',
      toGo: raise.toGoLabel || '-',
      daysToClose: days,
      nextMeet: { title: nextEv.title || '-', when: nextEv.start ? soon(nextEv.start) : '', url: nextEv.join || nextEv.url || '' },
      lights: lights,
      sigCount: sigCount || 0,
      coach: String(ceo.coach || ceo.coachLine || '').trim(),
      rebuiltAt: Number.isFinite(rebuilt) ? hhmm(rebuilt) : '',
      hero: { id: heroMove.id || '', title: moveText(heroMove) || 'Pick today’s one move', why: moveWhy(heroMove), committed: !!(one && String(heroMove.id || '') === one) },
      moves: moves.map(function (m, i) {
        var zone = String(m.zone || m.area || 'Raise');
        var zc = /cash|runway/i.test(zone) ? 'z-cash' : /partner/i.test(zone) ? 'z-part' : /reg/i.test(zone) ? 'z-reg' : 'z-raise';
        return { id: m.id || '', title: moveText(m), zone: zc, zoneLabel: zone, one: i === 0, why: moveWhy(m), src: m.source || m.sourceLine || m.source_line || '', how: Array.isArray(m.how) ? m.how : [] };
      }),
      meetingActionTotal: actions.length,
      reachToday: reachN,
      today: todayPack,
      week: pack('week', 8),
      later: pack('later', 2),
      done: pack('done', 8),
      signals: liveSignalsState(S, {
        mailNeed: mailNeed, owed: actions.length, reach: reachN, sigCount: sigCount,
        cold: cold, attn: attn, toGo: raise.toGoLabel || '-', days: days
      })
    };
  }

  function liveSignalsState(S, n) {
    var brain = String((S.ceo && (S.ceo.brainLine || S.ceo.lastLine)) || '').trim();
    var seen = 0;
    try { seen = Number(localStorage.getItem('cr_sig_seen') || 0) || 0; } catch (e) { seen = 0; }
    var news = asList(S.news).filter(function (row) {
      var at = Number(row.at || row.publishedAt || row.date || 0);
      if (!at && row.published_at) at = Date.parse(row.published_at);
      if (at && at < 1e12) at *= 1000;
      return seen && at && at > seen;
    }).slice(0, 4).map(function (row) {
      return { color: '#2e6bf2', title: 'News', count: String(row.title || row.headline || '').slice(0, 80), detail: String(row.source || row.site || ''), dest: 'news', go: 'News' };
    });
    return {
      brain: '4orm Intelligence: ' + (brain || '-'),
      needYou: n.sigCount != null ? n.sigCount : ((n.mailNeed || 0) + (n.owed || 0) + (n.reach || 0)),
      since: seen ? hhmm(seen) : '',
      needs: [
        { color: '#e0364f', title: 'Inbox', count: (n.mailNeed || 0) + ' need a reply', detail: 'People waiting on you', dest: 'mail', go: 'Email' },
        { color: '#e0364f', title: 'Owed from meetings', count: (n.owed || 0) + ' open', detail: 'From Zoom + Granola', dest: 'review', go: 'Review' },
        { color: '#c98408', title: 'Reach out', count: (n.reach || 0) + ' today', detail: 'Needs you today', dest: 'pipe', go: 'Pipeline' },
        { color: '#c98408', title: 'Going cold', count: (n.cold || 0) + ' people', detail: '14 days or more', dest: 'people', go: 'People' }
      ],
      news: news,
      watch: [
        { color: '#e0364f', title: 'Raise', count: (n.toGo || '-') + ' to go', detail: (n.days == null ? '-' : n.days) + ' days', dest: 'finance', go: 'Financials' },
        { color: '#c98408', title: 'Integrations', count: (n.attn || 0) + ' need attention', detail: 'Open Integrations', dest: 'int', go: 'Fix' }
      ]
    };
  }
  function liveNotesState() {
    var S = window.STATE || {};
    var stickies = asList(S.stickies).length ? S.stickies : asList(S.stickyNotes);
    var board = asList(S.notes);
    var seen = {};
    var rows = [];
    var archived = [];
    function addNote(n, mapFn) {
      var id = String(n && n.id || '') || (String(n && n.title || '') + '\n' + String(n && n.body || ''));
      if (!id || seen[id]) return;
      seen[id] = true;
      var row = mapFn(n);
      if (row && row.title && /^\[archived\]/i.test(row.title)) { row.archived = true; row.title = row.title.replace(/^\[archived\]\s*/i, ''); }
      if (!row) return;
      if (row.archived) archived.push(row);
      else rows.push(row);
    }
    stickies.forEach(function (n) { addNote(n, noteFromSticky); });
    board.forEach(function (n) { addNote(n, noteFromBoard); });
    var pinned = rows.filter(function (n) { return n.pin; });
    var rest = rows.filter(function (n) { return !n.pin; });
    function count(pred) { return rows.filter(pred).length; }
    liveLog('notes', { stickies: stickies.length, boardNotes: board.length, out: rows.length, pinned: pinned.length });
    return {
      counts: {
        all: rows.length, pinned: pinned.length,
        todo: count(function (n) { return n.typeCls === 'todo'; }),
        idea: count(function (n) { return n.typeCls === 'idea'; }),
        person: count(function (n) { return n.typeCls === 'person'; }),
        decision: count(function (n) { return n.typeCls === 'dec'; })
      },
      pinned: pinned,
      notes: rest,
      archived: archived
    };
  }
  /* Category names for the Notes bar: real note_cats rows (by name) plus any
     name a sticky note carries in meta.category. Never renders objects. */
  function noteCategoryNames(extra) {
    var S = window.STATE || {};
    var out = [];
    function push(n) {
      n = String(n || '').trim();
      if (!n || /^inbox$/i.test(n) || /^all$/i.test(n)) return;
      if (out.map(function (x) { return x.toLowerCase(); }).indexOf(n.toLowerCase()) < 0) out.push(n);
    }
    asList(S.noteCats).forEach(function (c) {
      if (c && typeof c === 'object') { if (!c.parentId) push(c.name); }
      else push(c);
    });
    (extra || []).forEach(function (n) { push(n && n.category); });
    return out;
  }
  window.__noteCategoryNames = function () { var d = liveNotesState(); return noteCategoryNames((d.notes || []).concat(d.pinned || [])); };

  function dashboardData() {
    return fixtureOn() && window.REDESIGN_FIXTURE && window.REDESIGN_FIXTURE.dashboard
      ? window.REDESIGN_FIXTURE.dashboard
      : liveDashboardState();
  }
  function warData() {
    return fixtureOn() && window.REDESIGN_FIXTURE && window.REDESIGN_FIXTURE.war
      ? window.REDESIGN_FIXTURE.war
      : liveWarState();
  }
  function notesData() {
    return fixtureOn() && window.REDESIGN_FIXTURE && window.REDESIGN_FIXTURE.notes
      ? window.REDESIGN_FIXTURE.notes
      : liveNotesState();
  }

  function paintDashboardLive() {
    var wrap = wrapOf('opsDash');
    if (!wrap) return;
    var data = dashboardData();
    var linked = data.linkedin || [];
    var inbox = data.inbox || [];
    var meetings = data.meetings || [];
    var moves = data.moves || [];
    var linkedHtml = linked.length ? linked.map(function (row) {
      return '<div class="li2"><span class="in">in</span><div class="t"><div class="l1"><b>' + esc(row.name) + '</b> <span>' + esc(row.action) + '</span></div><div class="l2">' + esc(row.snippet) + '</div></div><span class="age">' + esc(row.age) + '</span><span class="lnk" data-action="linkedin-open" data-name="' + esc(row.name) + '" data-url="' + esc(row.url || '') + '">Open &rsaquo;</span></div>';
    }).join('') : '<div class="li2"><div class="t"><div class="l1">No people waiting on LinkedIn</div><div class="l2">System notices stay hidden.</div></div></div>';
    var mailHtml = inbox.length ? inbox.map(function (m, ix) {
      var av = m.from.split(' ').map(function (x) { return x[0]; }).join('').slice(0, 2);
      return '<div class="mail"><span class="av" style="background:' + esc(m.color || '#2e6bf2') + '">' + esc(av) + '</span><div style="min-width:0"><div class="mn"><span>' + esc(m.from) + '</span>' + (m.flag ? '<em class="flag ' + m.flag + '" style="font-style:normal">' + FL[m.flag] + '</em>' : '') + '</div><div class="ms">' + esc(m.subject) + '</div><div class="mp">' + esc(m.preview) + '</div></div><div class="mr"><span class="age">' + esc(m.age) + '</span><button class="rb" data-action="mail-reply" data-idx="' + ix + '" data-email="' + esc(m.email || '') + '" data-thread="' + esc(m.threadId || '') + '" data-mid="' + esc(m.messageId || '') + '" data-subject="' + esc(m.subject || '') + '" data-from="' + esc(m.from || '') + '" data-preview="' + esc(m.preview || '') + '">Reply</button><button class="more" data-action="mail-more" data-email="' + esc(m.email || '') + '" title="More: not a person, snooze, file">&middot;&middot;&middot;</button></div></div>';
    }).join('') : '<div class="mail"><div class="mp">No person-to-person mail waiting.</div></div>';
    var meetHtml = meetings.length ? meetings.map(function (ev) {
      var trail = ev.kind === 'join' && /^https?:\/\//i.test(ev.url || '')
        ? '<span class="join" data-action="meet-join" data-url="' + esc(ev.url || '') + '">Join</span>'
        : '<span class="bell" data-action="meet-bell" data-title="' + esc(ev.title || '') + '"' + (ev.kind === 'bell-on' ? ' title="Alarm on"' : '') + '>' + BELL + '</span>';
      return '<div class="meet"><span class="tm">' + esc(ev.when) + '</span><span class="nm">' + esc(ev.title) + '</span>' + trail + '</div>';
    }).join('') : '<div class="meet"><span class="nm">No meetings on the calendar.</span></div>';
    var mvHtml = moves.length ? moves.map(function (move, i) {
      return '<div class="mv" data-action="goto-war"><span class="k">' + (i + 1) + '</span><div class="t">' + esc(move.title) + '<small>' + esc(move.why) + '</small></div><span class="zone ' + move.zone + '">' + esc(move.zoneLabel) + '</span></div>';
    }).join('') : '<div class="mv" data-action="goto-war"><div class="t">No ranked move yet<small>The War Room one-thing fills this.</small></div></div>';
    var health = data.health || { score: '-', dash: '0 301.6', bars: [] };
    var mom = data.momentum || { bars: [], desk: '-', done: '-', overdue: '-', blocked: '-' };
    var content = data.content || {};
    var peopleTab = peopleInboxOn();
    wrap.innerHTML =
      '<section class="cmd"><div class="cmdtop">'
      + '<div class="vit"><div class="k">Cash</div><div class="v"><span class="mask" data-real="' + esc(data.cash) + '">' + mask(data.cash) + '</span></div><div class="sub">in the bank</div></div>'
      + '<div class="vit"><div class="k">Burn</div><div class="v"><span class="mask" data-real="' + esc(data.burn) + '">' + mask(data.burn) + '</span></div><div class="sub">per month</div></div>'
      + '<div class="vit"><div class="k">Runway</div><div class="v red">' + esc(data.runway) + '</div><div class="sub">at this cash</div></div>'
      + '<div class="vit"><div class="k">Raise &middot; friends &amp; family</div><div class="v"><span class="mask" data-real="' + esc(data.raise) + '">' + mask(data.raise) + '</span><button class="eye" id="eye" data-action="show-money" title="Show figures">' + EYE + '</button></div><div class="raisebar"><i></i></div></div>'
      + '<div class="count"><div class="big">' + esc(data.daysToClose) + ' days</div><div class="k">to close &middot; ' + esc(data.closeWhen) + '</div></div></div>'
      + '<div class="lamps">' + (data.lamps || []).map(function (l) {
        return '<div class="lamp"><span class="led ' + l.led + '"></span><span class="nm">' + esc(l.name) + '</span><span class="st ' + l.st + '">' + esc(l.word) + '</span></div>';
      }).join('') + '</div></section>'
      + '<div class="g3"><section class="card"><div class="ch"><h3>What needs you now</h3><span class="s">across the desk</span></div>'
      + (data.alerts || []).map(function (n) {
        return '<div class="row"><span class="sev ' + n.sev + '"></span><div class="rt">' + esc(n.text) + '<small>' + esc(n.area) + '</small></div><span class="lnk" data-action="open-need" data-view="war">Open</span></div>';
      }).join('')
      + '</section><section class="card"><div class="ch"><h3>Raise tracker</h3><span class="s">7 &times; $25K cheques</span></div>'
      + '<div class="cheques">' + (data.cheques || []).map(function (c) {
        return '<div class="cq ' + c.cls + '">' + esc(c.label) + '</div>';
      }).join('') + '</div>'
      + '<div class="pace"><b><span class="mask" data-real="' + esc(data.toGo) + '">' + mask(data.toGo) + '</span> to go</b> in ' + esc(data.daysToClose) + ' days. Booked <span class="mask" data-real="' + esc(data.bookedWeek) + '">' + mask(data.bookedWeek) + '</span> this week. <span class="w">' + esc(data.paceNote) + '</span></div></section>'
      + '<section class="card"><div class="ch"><h3>What I\'d worry about</h3><span class="s">blind spots</span></div>'
      + ((data.worries || []).length ? (data.worries || []).map(function (w) {
        return '<div class="row"><span class="wic ' + w.tone + '">!</span><div class="rt"><b>' + esc(w.title) + '</b> ' + esc(w.body) + '</div></div>';
      }).join('') : '<div class="row"><div class="rt">-</div></div>') + '</section></div>'
      + '<section class="card" style="margin-bottom:16px"><div class="ch"><h3>LinkedIn</h3><span class="s">' + linked.length + ' new &middot; people only, system notices hidden</span><span class="lnk" style="margin-left:14px" data-action="linkedin-open" data-url="https://www.linkedin.com/feed/">Open LinkedIn</span></div><div class="ligrid">' + linkedHtml + '</div></section>'
      + '<div class="g2"><section class="card"><div class="ch"><h3>Inbox &mdash; needs you</h3><div class="tabs"><span data-action="inbox-mode" data-mode="people"' + (peopleTab ? ' class="on"' : '') + '>People only</span><span data-action="inbox-mode" data-mode="all"' + (peopleTab ? '' : ' class="on"') + '>All mail</span></div><span class="s">' + inbox.length + ' waiting</span></div><div id="mail">' + mailHtml + '</div><div class="foot">Bulk and notification mail is filed in Email &rarr; Quiet. <span class="lnk" data-action="open-email">Open Email</span></div></section>'
      + '<div class="stack"><section class="card"><div class="ch"><h3>Next meetings</h3><span class="s">today</span></div>' + meetHtml + '</section>'
      + '<section class="card"><div class="ch"><h3>Today\'s 1&ndash;3</h3><span class="s">from the War Room</span></div>' + mvHtml + '</section></div></div>'
      + '<div class="g3"><section class="card"><div class="ch"><h3>Company health</h3><span class="s">desk snapshot</span></div><div class="health"><svg viewBox="0 0 120 120" width="120" height="120"><circle cx="60" cy="60" r="48" fill="none" stroke="#eef1f6" stroke-width="14"/><circle cx="60" cy="60" r="48" fill="none" stroke="#f29b26" stroke-width="14" stroke-dasharray="' + esc(health.dash) + '" stroke-linecap="round" transform="rotate(-90 60 60)"/><text x="60" y="62" text-anchor="middle" font-size="30" font-weight="850" fill="#101a33">' + esc(health.score) + '</text><text x="60" y="80" text-anchor="middle" font-size="11" fill="#7a86a0">of 100</text></svg><div>'
      + (health.bars || []).map(function (b) {
        return '<div class="hb">' + esc(b.name) + '<div class="t"><i style="width:' + b.pct + '%;background:' + b.color + '"></i></div><b>' + esc(b.n) + '</b></div>';
      }).join('') + '</div></div></section>'
      + '<section class="card"><div class="ch"><h3>Momentum</h3><span class="s">last 7 days</span></div><div class="mom"><div class="bars">'
      + (mom.bars || []).map(function (b) {
        return '<div><i style="height:' + b.h + 'px' + (b.now ? ';background:#5b8cff' : '') + '"></i><span>' + esc(b.day) + '</span></div>';
      }).join('') + '</div>'
      + '<div class="desk"><div class="dk"><b>' + esc(mom.desk) + '</b><span>on the desk</span></div><div class="dk"><b>' + esc(mom.done) + '</b><span>done this week</span></div><div class="dk red"><b>' + esc(mom.overdue) + '</b><span>overdue</span></div><div class="dk red"><b>' + esc(mom.blocked) + '</b><span>blocked</span></div></div></div></section>'
      + '<section class="card"><div class="ch"><h3>Content runway</h3><span class="s">GoHighLevel</span></div><div class="runway">'
      + '<div class="big"><b>' + esc(content.queued) + '</b><span>' + esc(content.queuedNote) + '</span></div>'
      + '<div class="bar"><i style="width:' + (content.barPct || 0) + '%;background:var(--amber)"></i></div>'
      + '<div class="kv"><span>Cadence</span><b>' + esc(content.cadence) + '</b></div>'
      + '<div class="kv"><span>Newsletter</span><b>' + esc(content.newsletter) + '</b></div>'
      + '<div class="kv"><span>Next clip</span><b>' + esc(content.nextClip) + '</b></div></div></section></div>'
      + '<div class="toast" id="toast"></div>';
    finishPaint(wrap);
    markReady('opsDash');
  }

  function execSelecting() { return !!(window.STATE && window.STATE.execSelect) || qFlag('select'); }
  function execBar() {
    var n = Object.keys((window.STATE && window.STATE.execPicked) || {}).length;
    return '<div class="selbar"><b data-role="selN">' + n + ' selected</b><button class="all" data-action="exec-select-all">Select all</button><button class="del" data-action="exec-bulk-drop">' + (n ? ('Delete ' + n) : 'Delete') + '</button><button data-action="exec-bulk-week">Move to Week</button><button data-action="exec-bulk-later">Move to Later</button><button data-action="exec-cancel">Cancel</button></div>';
  }
  function warTask(it, dests, done) {
    var id = esc(it.id || '');
    var hv = done ? '' : '<div class="hv">' + dests.map(function (d) {
      return '<button data-action="task-move" data-id="' + id + '" data-bucket="' + d[0] + '">' + d[1] + '</button>';
    }).join('') + '</div>';
    var selecting = execSelecting() && !done;
    var picked = selecting && window.STATE && window.STATE.execPicked && window.STATE.execPicked[it.id];
    var sb = done ? '' : '<span class="sb" title="Select" data-action="exec-pick" data-id="' + id + '"></span>';
    var x = done ? '' : '<span class="x2" data-action="task-drop" data-id="' + id + '" title="Delete">&times;</span>';
    var zoom = it.fromMeeting ? ' data-zoom="1"' : '';
    return '<div class="task' + (done ? ' d' : '') + (picked ? ' picked' : '') + '" draggable="true" data-action="task-drag" data-id="' + id + '"' + zoom + '>' + sb + '<span class="cb' + (done ? ' on' : '') + '" data-action="task-done" data-id="' + id + '"></span><div><div class="tt">' + esc(it.title) + '</div><div class="tg">' + esc(it.tag || '') + '</div></div>' + hv + x + '</div>';
  }
  function execCol(label, col, bucket, dests, done) {
    var tasks = (col && col.tasks) || [];
    var body = tasks.length
      ? tasks.map(function (it) { return warTask(it, dests, done); }).join('')
      : '<div class="empty">Nothing set for this ' + (label === 'This week' ? 'week' : 'column') + '.<br>Drag a task here or press +.</div>';
    var more = col && col.more ? '<div class="more2" data-action="exec-more" data-bucket="' + bucket + '">+ ' + col.more + ' more</div>' : '';
    var plus = done ? '' : '<button class="plus" data-action="exec-add" data-bucket="' + bucket + '">+</button>';
    return '<div class="col' + (done ? ' done' : '') + '" data-action="col-drop" data-bucket="' + bucket + '"><div class="colh"><b>' + label + '</b><span class="c">' + ((col && col.count) || 0) + '</span>' + plus + '</div>' + body + more + '</div>';
  }
  function signalsHtml(data, open) {
    var sig = data.signals || {};
    var rows = function (list) {
      return (list || []).map(function (r) {
        return '<div class="si" data-action="signals-go" data-dest="' + esc(r.dest || '') + '"><i style="background:' + esc(r.color || '#2e6bf2') + '"></i><div><b>' + esc(r.title) + '</b> <span>' + esc(r.count) + '</span><small>' + esc(r.detail || '') + '</small></div><em>' + esc(r.go || '') + ' &rsaquo;</em></div>';
      }).join('');
    };
    return '<div class="sigpanel' + (open ? ' on' : '') + '" id="sigpanel">'
      + '<div class="sh"><b>Signals</b><span class="s">' + esc(sig.needYou != null ? sig.needYou : (data.sigCount || 0)) + ' need you &middot; updates every 15 s</span><span class="x" data-action="signals-close">&times;</span></div>'
      + '<div class="brain">' + (function () {
        var line = sig.brain || '4orm Intelligence is watching the desk.';
        var cut = line.indexOf(':');
        if (cut > 0) return '<b>' + esc(line.slice(0, cut + 1)) + '</b>' + esc(line.slice(cut + 1));
        return esc(line);
      }()) + '</div>'
      + '<div class="sec">Needs you</div>' + rows(sig.needs)
      + (sig.news && sig.news.length ? '<div class="sec">New since ' + esc(sig.since || 'your last visit') + '</div>' + rows(sig.news) : '')
      + '<div class="sec">Watch</div>' + rows(sig.watch)
      + '<div class="sf">Everything above lives on its own page. This is the summary.<a data-action="brain-log">Brain log</a></div></div>';
  }

  function warLoadsOnce() {
    if (fixtureOn()) return;
    var S = window.STATE || (window.STATE = {});
    var finOk = !!S.finUnlocked;
    try { finOk = finOk || Number(sessionStorage.getItem('cr_fin_until') || 0) > Date.now(); } catch (e) {}
    /* Locked: no /api/finance call at all (it would 403); the ribbon shows "-" until Financials is unlocked. */
    if (finOk && !S.finance && !S.__warFinReq && typeof window.authFetch === 'function') {
      S.__warFinReq = true;
      window.authFetch('/api/finance', { credentials: 'same-origin', quiet: true }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        /* 403 {locked:true} until the Finance page is unlocked: the War Room keeps showing "-". */
        if (d && !d.error && d.locked !== true) { S.finance = d; paintWarLive(); }
      }).catch(function () {});
    }
    if (!S.playbook && !S.__warPbReq && typeof window.__portLoadC === 'function') {
      S.__warPbReq = true;
      window.__portLoadC('playbook');
    }
  }
  /* Snapshot anything the user is in the middle of (capture text, the Plan
     editor, the coaching pop) so a live-update repaint never wipes it. */
  function warEditState(wrap) {
    var root = wrap.getRootNode ? wrap.getRootNode() : null;
    var active = root && root.activeElement;
    var cap = wrap.querySelector('.capture input');
    var ov = wrap.querySelector('#planOv');
    var body = wrap.querySelector('#planBody');
    var coach = wrap.querySelector('#coachpop');
    var st = {
      cap: cap ? cap.value : '', capFocus: !!(cap && active === cap),
      capSel: cap && active === cap ? [cap.selectionStart, cap.selectionEnd] : null,
      planOpen: !!(ov && !ov.hidden && ov.style.display !== 'none' && (ov.classList.contains('open') || ov.style.display === 'flex')),
      planId: ov ? ov.getAttribute('data-id') : '', planTitle: ov ? ov.getAttribute('data-title') : '',
      planHd: (wrap.querySelector('#planHd') || {}).textContent || '',
      planBody: body ? body.value : '', planFocus: !!(body && active === body),
      planSel: body && active === body ? [body.selectionStart, body.selectionEnd] : null,
      coachOpen: !!(coach && coach.classList.contains('open'))
    };
    return st;
  }
  function warRestore(wrap, st) {
    if (!st) return;
    var cap = wrap.querySelector('.capture input');
    if (cap && st.cap) cap.value = st.cap;
    if (cap && st.capFocus) {
      try { cap.focus(); if (st.capSel) cap.setSelectionRange(st.capSel[0], st.capSel[1]); } catch (e) {}
    }
    if (st.planOpen) {
      var ov = wrap.querySelector('#planOv');
      var body = wrap.querySelector('#planBody');
      var hd = wrap.querySelector('#planHd');
      if (ov) {
        ov.setAttribute('data-id', st.planId || '');
        ov.setAttribute('data-title', st.planTitle || '');
        ov.hidden = false; ov.classList.add('open'); ov.style.display = 'flex';
      }
      if (hd) hd.textContent = st.planHd;
      if (body) {
        body.value = st.planBody;
        if (st.planFocus) { try { body.focus(); if (st.planSel) body.setSelectionRange(st.planSel[0], st.planSel[1]); } catch (e) {} }
      }
    }
    if (st.coachOpen) {
      var pop = wrap.querySelector('#coachpop');
      if (pop) pop.classList.add('open');
    }
  }

  function plannerPath() {
    try {
      var path = location.pathname || '';
      var q = new URLSearchParams(location.search || '');
      if (q.get('view') === 'war' || q.get('steps') === '1' || q.get('signals') === '1' || q.get('select') === '1' || q.get('sigdetail') === '1') return false;
      if (q.get('view') === 'planner' || q.get('view') === 'timeline') return true;
      if (/\/(planner|timeline)/.test(path)) return true;
    } catch (e) {}
    return false;
  }
  window.__plannerPath = plannerPath;
  function paintWarLive() {
    if (plannerPath() || (window.STATE && window.STATE.desk === 'planner')) return;
    var desk = (window.STATE && window.STATE.desk) || '';
    if (desk && desk !== 'war' && desk !== 'room') {
      var hold = document.getElementById('v-war');
      if (hold) hold.hidden = true;
      return;
    }
    var wrap = wrapOf('warDesk');
    if (!wrap) return;
    warLoadsOnce();
    var keep = warEditState(wrap);
    var data = warData();
    var moves = data.moves || [];
    var next = data.nextMeet || {};
    var sigOpen = qFlag('signals') || !!(window.STATE && window.STATE.signalsOpen);
    var today = data.today || { tasks: [], count: 0 };
    if (qFlag('select')) {
      window.STATE = window.STATE || {};
      window.STATE.execSelect = true;
      if (!window.STATE.execPicked || !Object.keys(window.STATE.execPicked).length) {
        window.STATE.execPicked = {};
        (today.tasks || []).slice(0, 3).forEach(function (t) {
          if (t && t.id) window.STATE.execPicked[t.id] = true;
        });
      }
    }
    var todayBody = (today.tasks || []).length
      ? today.tasks.map(function (it) { return warTask(it, [['week', 'Week'], ['later', 'Later']]); }).join('')
      : '<div class="empty">Nothing on Today.<br>Capture above or press + Add.</div>';
    var toGo = data.toGo && data.toGo !== '-' ? mask(data.toGo) : '-';
    var days = data.daysToClose == null || data.daysToClose === '' ? '-' : data.daysToClose;
    var lights = data.lights == null ? '-' : data.lights;
    var coach = String(data.coach || '');
    var hero = data.hero || {};
    wrap.innerHTML =
      '<section class="ribbon thin">'
      + '<span class="ri"><b class="red">' + esc(data.runway || '-') + '</b> runway</span><span class="rsep"></span>'
      + '<span class="ri"><b>' + toGo + '</b> to go &middot; <b>' + esc(days) + ' days</b></span><span class="rsep"></span>'
      + '<span class="ri">Next: <b>' + esc(next.title || '-') + '</b> ' + esc(next.when || '') + (/^https?:\/\//i.test(next.url || '') ? ' <span class="lnk" data-action="meet-join" data-url="' + esc(next.url) + '">Join</span>' : '') + '</span><span class="rsep"></span>'
      + '<span class="ri"><b>' + esc(lights) + '</b> lights left today</span>'
      + '<span class="sp"></span>'
      + '<span class="ri sig" id="sigBtn" data-action="signals-open">Signals <b class="n">' + esc(data.sigCount != null ? data.sigCount : 0) + '</b></span>'
      + (coach ? '<div class="cwrap"><button class="coachbtn" id="coachbtn" data-action="coach-toggle">Coaching note</button>'
        + '<div class="coachpop" id="coachpop"><b>Coaching note</b><p>' + esc(coach) + '</p></div></div>' : '')
      + '<button class="vb" data-action="show-money">' + (moneyOn() ? 'Hide $' : 'Show $') + '</button></section>'
      + '<div class="capture"><input data-action="capture-input" placeholder="Capture a task or an idea to park it, so you don\'t lose focus"><button data-action="capture-add">Add</button></div>'
      + '<div class="wrow"><section class="hero"><div class="htop"><div>'
      + '<div class="hl">Today\'s one move' + (hero.committed ? ' &middot; committed' : '') + '</div><h2>' + esc(hero.title) + '</h2>'
      + '<div class="why">' + esc(hero.why) + '</div></div>'
      + '<div class="ring"><svg viewBox="0 0 112 112"><circle cx="56" cy="56" r="48" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="8"/><circle cx="56" cy="56" r="48" fill="none" stroke="#5b8cff" stroke-width="8" stroke-dasharray="301.6" stroke-dashoffset="0" stroke-linecap="round" transform="rotate(-90 56 56)"/></svg><div><div><b>25:00</b><span>focus</span></div></div></div></div>'
      + '<div class="hbtns"><button class="hb1 go" data-action="focus-toggle">Start 25-min focus</button><button class="hb2" data-action="focus-stop" hidden>Stop</button><button class="hb1" data-action="hero-commit" data-id="' + esc(hero.id || '') + '" data-title="' + esc(hero.title || '') + '">' + (hero.committed ? 'Committed &#10003;' : 'Commit as my one thing') + '</button><button class="hb2" data-action="hero-plan" data-id="' + esc(hero.id || '') + '" data-title="' + esc(hero.title || '') + '">Plan</button><button class="hb2" data-action="hero-cancel" data-id="' + esc(hero.id || '') + '">Cancel this move</button></div>'
      + '<div class="moves"><div class="mh"><h3>4orm Intelligence &middot; CEO ranked moves</h3><span class="s">' + (data.rebuiltAt ? 'rebuilt ' + esc(data.rebuiltAt) : '') + '</span><button class="rr" data-action="moves-rerun">Re-run</button></div>'
      + moves.map(function (m, i) {
        var mid = String(m.id || ('m' + i));
        var wantOpen = (window.STATE && window.STATE.openSteps === mid) || (qFlag('steps') && i === 0);
        var steps = moveSteps(mid, m);
        var doneN = steps.filter(function (s) { return s && s.done; }).length;
        var stp = '';
        if (wantOpen) {
          stp = '<div class="stp" style="grid-column:1/-1"><h6>Steps for this move <em>' + doneN + ' of ' + steps.length + ' done</em></h6>'
            + steps.map(function (s, si) {
              return '<div class="s' + (s.done ? ' d' : '') + '" data-action="step-toggle" data-id="' + esc(mid) + '" data-i="' + si + '"><i>' + (s.done ? '&#10003;' : '') + '</i><span>' + esc(s.text || '') + '</span>'
                + (s.when ? '<small>' + esc(s.when) + '</small>' : '') + '</div>';
            }).join('')
            + '<div class="addst" data-action="step-add" data-id="' + esc(mid) + '" data-title="' + esc(m.title) + '">+ Add a step</div></div>';
        }
        return '<div class="mv2' + (m.one ? ' one' : '') + '"><span class="rk">' + (i + 1) + '</span><div><div class="mt">' + esc(m.title) + ' <span class="zn ' + m.zone + '">' + esc(m.zoneLabel) + '</span>' + (m.one ? '<span class="yo">Your one move</span>' : '') + '</div><div class="ms2">' + esc(m.why) + '</div><div class="src">' + esc(m.src) + '</div></div><div class="ma"><button class="do" data-action="move-do" data-id="' + esc(mid) + '">Do</button><button data-action="move-steps" data-id="' + esc(mid) + '"' + (wantOpen ? ' class="on-steps" style="background:#101a33;color:#fff"' : '') + '>Steps</button><button data-action="move-plan" data-id="' + esc(mid) + '" data-title="' + esc(m.title) + '">Plan</button><button class="x" data-action="move-dismiss" data-id="' + esc(mid) + '"' + (m.one ? ' title="Dismiss - the next move takes its place"' : '') + '>&times;</button></div>' + stp + '</div>';
      }).join('') + '</div></section>'
      + '<div class="rstack"><section class="card exec today' + (execSelecting() ? ' sel' : '') + '">'
      + '<div class="ch"><h3>Today</h3><span class="s">' + esc(today.count || (today.tasks || []).length) + ' on the desk' + (execSelecting() ? '' : ' &middot; drag to reorder') + '</span><span class="selbtn" data-action="exec-select">' + (execSelecting() ? 'Done' : 'Select') + '</span><span class="lnk" style="margin-left:auto" data-action="exec-add" data-bucket="today">+ Add</span></div>'
      + execBar()
      + '<div class="tl" data-action="col-drop" data-bucket="today">' + todayBody + '</div>'
      + '<div class="foot"><span class="lnk" data-action="owed-review">' + esc(data.meetingActionTotal || 0) + ' owed from meetings &middot; review</span><span class="lnk" style="margin-left:auto" data-action="reach-pipe">Reach out &middot; ' + esc(data.reachToday || 0) + ' today &rsaquo;</span></div>'
      + '</section></div></div>'
      + '<section class="card exec"><div class="ch"><h3>Execution</h3><span class="s">drag between columns &middot; Today is above</span><span class="lnk" style="margin-left:auto" data-action="exec-full">Full screen</span></div><div class="cols">'
      + execCol('This week', data.week, 'week', [['today', 'Today'], ['later', 'Later']])
      + execCol('Later', data.later, 'later', [['today', 'Today'], ['week', 'Week']])
      + execCol('Done today', data.done, 'done', [], true)
      + '</div></section>'
      + signalsHtml(data, sigOpen)
      + '<div class="plan-ov" id="planOv" hidden data-action="plan-close"><div class="plan-box" data-action="note-keep"><h3 id="planHd">Plan</h3><textarea id="planBody" data-action="plan-draft" rows="8" placeholder="Steps, one per line"></textarea><div class="plan-acts"><button class="pri" data-action="plan-ask">Ask 4orm Intelligence</button><button class="pri" data-action="plan-save">Save plan</button><button data-action="plan-close">Cancel</button></div></div></div>'
      + '<div class="toast" id="toast"></div>';
    warRestore(wrap, keep);
    finishPaint(wrap);
    markReady('warDesk');
    window.toggleSignalsPanel = function () {
      if (window.STATE) window.STATE.signalsOpen = !window.STATE.signalsOpen;
      paintWarLive();
    };
    window.openSignalsPanel = function () {
      if (window.STATE) window.STATE.signalsOpen = true;
      var p = wrap.querySelector('#sigpanel');
      if (p) p.classList.add('on');
    };
    window.closeSignalsPanel = function () {
      if (window.STATE) window.STATE.signalsOpen = false;
      var p = wrap.querySelector('#sigpanel');
      if (p) p.classList.remove('on');
    };
  }

  /* Fixture mode reproduces design 03 (no categories bar) unless ?cats=1 (design 03c). */
  var NOTE_CATS_ON = true;
  function noteCard(n) {
    var ty = 'ty' + (n.typeCls ? ' ' + n.typeCls : '');
    var id = esc(n.id || '');
    var src = esc(n.source || 'sticky');
    var ttl = esc(n.title || '');
    var catName = String(n.category || '');
    var pin = (NOTE_CATS_ON ? '<span class="catg" data-action="note-cat-tag" data-id="' + id + '" data-source="' + src + '" data-cat="' + esc(catName) + '">' + esc(catName || '+ Category') + '</span>' : '') + '<span class="pin" data-action="note-pin" data-id="' + id + '" data-source="' + src + '" data-on="' + (n.pin ? '1' : '0') + '" title="Pin"></span><span class="nx x" data-action="note-archive" data-id="' + id + '" data-source="' + src + '" data-title="' + ttl + '">&times;</span>';
    var title = n.title ? '<h4>' + esc(n.title) + '</h4>' : '';
    var body = n.body ? '<p>' + esc(n.body) + '</p>' : '';
    var checks = (n.checks || []).map(function (c, ci) {
      return '<div class="ck' + (c.done ? ' done' : '') + '" data-action="note-check" data-id="' + id + '" data-source="' + src + '" data-i="' + ci + '"><i>' + (c.done ? '&#10003;' : '') + '</i>' + esc(c.text) + '</div>';
    }).join('');
    var metaBits = (n.links || []).map(function (l) {
      var lab = /^Link\s/i.test(String(l || '')) ? String(l) : ('Link ' + l);
      return '<span class="mc link">' + esc(lab) + '</span>';
    });
    if (n.reminder) metaBits.push('<span class="mc rem">&#9200; ' + esc(n.reminder) + '</span>');
    var meta = metaBits.length ? '<div class="meta">' + metaBits.join('') + '</div>' : '';
    return '<div class="note ' + n.color + '" data-action="note-open" data-id="' + id + '" data-source="' + src + '" data-title="' + ttl + '" data-body="' + esc(n.body || '') + '" data-type="' + esc(n.typeCls || '') + '" data-color="' + esc(n.color || 'y') + '" data-pin="' + (n.pin ? '1' : '0') + '"><div class="nh"><span class="' + ty + '" data-action="notes-filter" data-filter="' + esc(n.typeCls || 'all') + '">' + esc(n.type) + '</span>' + pin + '</div>'
      + title + body + checks + meta
      + '<div class="na"><span class="conv cvt" data-action="note-task" data-id="' + id + '" data-title="' + ttl + '">' + esc(n.convert) + '</span><span class="sp"></span><span class="ic" data-action="note-open" data-id="' + id + '" data-source="' + src + '" data-title="' + ttl + '" data-body="' + esc(n.body || '') + '" data-type="' + esc(n.typeCls || '') + '" data-color="' + esc(n.color || 'y') + '">Edit</span><span class="ic" data-action="note-menu" data-id="' + id + '" data-source="' + src + '" data-title="' + ttl + '" data-on="' + (n.pin ? '1' : '0') + '">&#8943;</span></div></div>';
  }

  function paintNotesLive() {
    var wrap = wrapOf('notesDesk');
    if (!wrap) return;
    var openCard = wrap.getElementById ? wrap.getElementById('ovNote') : wrap.querySelector('#ovNote');
    if (openCard && !openCard.hasAttribute('hidden')) {
      finishPaint(wrap);
      markReady('notesDesk');
      return;
    }
    var keepQ = (wrap.querySelector('[data-action="notes-search"]') || {}).value || '';
    var data = notesData();
    var S0 = window.STATE || {};
    var filt = String(S0.noteFilter || 'all');
    var cats = fixtureOn() ? ['Raise', 'Regulators', 'Product', 'Team', 'Research'] : noteCategoryNames((data.notes || []).concat(data.pinned || []));
    var catOn = String(S0.noteCatName || 'all');
    NOTE_CATS_ON = fixtureOn() ? qFlag('cats') : true;
    var catCount = { all: 0 };
    (data.notes || []).concat(data.pinned || []).forEach(function (n) {
      catCount.all += 1;
      var k = String(n.category || '').toLowerCase();
      if (k) catCount[k] = (catCount[k] || 0) + 1;
    });
    /* Board must show every note (clustered or not). A stale category filter that
       matches zero notes falls back to All so "All 0" never hides the collection. */
    if (catOn !== 'all') {
      var wantCat = catOn.toLowerCase();
      var inCat = (data.notes || []).concat(data.pinned || []).filter(function (n) {
        return String(n.category || '').toLowerCase() === wantCat;
      }).length;
      if (!inCat) catOn = 'all';
    }
    if (catOn !== 'all' && cats.map(function (c) { return c.toLowerCase(); }).indexOf(catOn.toLowerCase()) < 0) catOn = 'all';
    var archiveView = filt === 'archive' && !fixtureOn();
    /* N9: Canvas = free placement of sticky notes, saved to sticky_notes.x / y. */
    var canvasOn = !archiveView && String(S0.notesView || (function () { try { return localStorage.getItem('cr_notes_view') || ''; } catch (e) { return ''; } })()) === 'canvas';
    try {
      var qn = new URLSearchParams(String(location.search || ''));
      if (qn.get('open') === '1') canvasOn = false;
      if (qn.get('fixture') === 'mockup' && qn.get('canvas') !== '1') canvasOn = false;
    } catch (e2) {}
    if (archiveView) {
      data = Object.assign({}, data, { pinned: [], notes: (data.archived || []).slice() });
    }
    if (catOn !== 'all') {
      var want = catOn.toLowerCase();
      data.notes = (data.notes || []).filter(function (n) { return String(n.category || '').toLowerCase() === want; });
      data.pinned = (data.pinned || []).filter(function (n) { return String(n.category || '').toLowerCase() === want; });
    }
    var c = data.counts || {};
    function chip(key, label, n) {
      return '<button class="chip' + (filt === key ? ' on' : '') + '" data-action="notes-filter" data-filter="' + key + '">' + label + (n != null ? ' <i>' + esc(n) + '</i>' : '') + '</button>';
    }
    wrap.innerHTML =
      '<div class="bar"><h1>Notes</h1><span class="sub">Capture fast, sort later &mdash; every note can become a task, content or a Space</span>'
      + '<div class="r"><button class="btn" data-action="notes-tidy">Tidy up</button><button class="btn" data-action="notes-full">Full screen</button><button class="btn pri" data-action="note-new">+ New note</button></div></div>'
      + '<div class="tools"><input class="search" data-action="notes-search" placeholder="Search notes, people, Spaces" value="' + esc(keepQ) + '">'
      + chip('all', 'All', c.all) + chip('pinned', 'Pinned', c.pinned)
      + chip('todo', 'To-do', c.todo) + chip('idea', 'Idea', c.idea)
      + chip('person', 'Person', c.person) + chip('dec', 'Decision', c.decision)
      + chip('archive', 'Archive', archiveView ? (data.notes || []).length : null)
      + '<div class="cols" title="Filter by colour"><span class="cdot y" data-action="notes-color" data-color="y" style="background:#fff6c9"></span><span class="cdot" data-action="notes-color" data-color="p" style="background:#ffe1ea"></span><span class="cdot" data-action="notes-color" data-color="g" style="background:#ddf5e6"></span><span class="cdot" data-action="notes-color" data-color="b" style="background:#e1ecff"></span><span class="cdot" data-action="notes-color" data-color="o" style="background:#ffe6cf"></span><span class="cdot" data-action="notes-color" data-color="v" style="background:#ece4ff"></span></div>'
      + (archiveView ? '' : '<div class="seg"><span' + (canvasOn ? '' : ' class="on"') + ' data-action="notes-view" data-view="board">Board</span><span' + (canvasOn ? ' class="on"' : '') + ' data-action="notes-view" data-view="canvas">Canvas</span></div>')
      + '</div>'
      + (NOTE_CATS_ON ? '<div class="cats" id="cats"><span class="cl">Categories</span>' + ['All'].concat(cats).map(function (name) {
        var key = name === 'All' ? 'all' : name;
        var cnt = catCount[key.toLowerCase()] || 0;
        return '<span class="ct' + (catOn.toLowerCase() === key.toLowerCase() ? ' on' : '') + '" data-action="notes-cat" data-c="' + esc(key) + '">' + esc(name) + ' <i>' + cnt + '</i></span>';
      }).join('') + '<span class="ct add" data-action="notes-cat" data-c="new">+ New category</span></div>' : '')
      + (archiveView ? '' : '<div class="sec">Pinned</div><div class="board" style="margin-bottom:6px">'
        + (data.pinned || []).map(noteCard).join('') + '<div class="newcard" data-action="note-new" data-pin="1">+ Pin a note here</div></div>')
      + '<div class="sec">' + (archiveView ? 'Archived' : 'All notes') + (canvasOn ? ' &middot; drag sticky notes to place them' : '') + '</div>'
      + (canvasOn ? notesCanvasHtml(data.notes || []) : '<div class="board">'
      + ((data.notes || []).map(noteCard).join('') || (archiveView ? '<div class="empty">Nothing archived.</div>' : ''))
      + '</div>')
      + noteOverlayHtml(data)
      + '<div class="toast" id="toast"></div>';
    finishPaint(wrap);
    if (canvasOn) bindNotesCanvas(wrap);
    if (filt !== 'all' && filt !== 'archive' || keepQ) {
      var chipEl = wrap.querySelector('[data-action="notes-filter"].on');
      if (chipEl && window.deskActions && window.deskActions['notes-filter']) {
        try { window.deskActions['notes-filter'](chipEl, wrap.getRootNode(), null); } catch (e) {}
      }
    }
    markReady('notesDesk');
  }

  function notesCanvasHtml(notes) {
    var raw = {};
    asList((window.STATE || {}).stickies).forEach(function (n) { if (n && n.id) raw[String(n.id)] = n; });
    var auto = 0;
    var bottom = 360;
    var cards = notes.map(function (n) {
      var r = raw[String(n.id)] || {};
      var placed = n.source === 'sticky' && r.meta && r.meta.canvas;
      var x, y, w = 260;
      if (placed) { x = Math.max(0, Number(r.x) || 0); y = Math.max(0, Number(r.y) || 0); w = Math.max(200, Math.min(420, Number(r.w) || 260)); }
      else { x = 16 + (auto % 4) * 276; y = 16 + Math.floor(auto / 4) * 250; auto += 1; }
      bottom = Math.max(bottom, y + 320);
      return '<div class="cvn" data-cid="' + esc(n.id || '') + '" data-src="' + esc(n.source || 'sticky') + '" style="position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;cursor:' + (n.source === 'sticky' ? 'grab' : 'default') + '">' + noteCard(n) + '</div>';
    }).join('');
    return '<div class="board canvasz" style="position:relative;display:block;columns:unset;min-height:' + bottom + 'px;border:1px dashed var(--line);border-radius:14px;overflow:auto">' + (cards || '<div class="empty">No notes yet.</div>') + '</div>';
  }
  function bindNotesCanvas(wrap) {
    var cz = wrap.querySelector('.canvasz');
    if (!cz) return;
    cz.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      var box = e.target.closest ? e.target.closest('.cvn') : null;
      if (!box) return;
      var hit = e.target.closest('[data-action]');
      if (hit && !hit.classList.contains('note')) return;
      if (box.getAttribute('data-src') !== 'sticky') return;
      var sx = e.clientX, sy = e.clientY;
      var ox = parseFloat(box.style.left) || 0, oy = parseFloat(box.style.top) || 0;
      var moved = false;
      function mv(ev) {
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
        moved = true;
        box.style.left = Math.max(0, Math.round(ox + dx)) + 'px';
        box.style.top = Math.max(0, Math.round(oy + dy)) + 'px';
        box.style.zIndex = '5';
      }
      function up() {
        window.removeEventListener('mousemove', mv);
        window.removeEventListener('mouseup', up);
        document.body.style.userSelect = '';
        if (!moved) return;
        var card = box.querySelector('.note');
        if (card) { card.removeAttribute('data-action'); setTimeout(function () { card.setAttribute('data-action', 'note-open'); }, 0); }
        var id = box.getAttribute('data-cid');
        var x = parseFloat(box.style.left) || 0, y = parseFloat(box.style.top) || 0;
        var row = asList((window.STATE || {}).stickies).filter(function (n) { return String(n.id) === String(id); })[0];
        if (row) { row.x = x; row.y = y; row.meta = Object.assign({}, row.meta || {}, { canvas: true }); }
        if (fixtureOn() || !/^[0-9a-f-]{36}$/i.test(String(id || ''))) return;
        var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
        fn('/api/notes/' + encodeURIComponent(id), { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: x, y: y, meta: { canvas: true } }) })
          .then(function (r) { if (!r || !r.ok) throw new Error('save'); })
          .catch(function () { var t = wrap.querySelector('#toast'); if (t) { t.textContent = 'Could not save that spot'; t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 1800); } });
      }
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', mv);
      window.addEventListener('mouseup', up);
    });
  }

  function noteOverlayHtml(data) {
    var open = qFlag('open');
    var src = (data && data.openNote) || ((data && data.pinned && data.pinned[0]) || (data && data.notes && data.notes[0]) || {});
    var color = src.color || 'y';
    var hid = open ? '' : ' hidden';
    var title = src.title || '';
    var body = src.body || '';
    var edited = src.edited || '';
    var pinOn = src.pin ? '1' : '0';
    var dots = [
      ['y', '#fff6c9'], ['p', '#ffd9df'], ['g', '#dff3e6'], ['b', '#dfe9ff'], ['v', '#efe6ff']
    ].map(function (d) {
      return '<i class="' + (d[0] === color ? 'on' : '') + '" style="background:' + d[1] + '" data-action="note-color-set" data-color="' + d[0] + '"></i>';
    }).join('');
    return '<div class="nscrim" id="nscrim"' + hid + ' data-action="note-close"></div>'
      + '<div class="nbig ' + color + '" id="ovNote"' + hid + ' data-action="note-keep" data-id="' + esc(src.id || '') + '" data-source="' + esc(src.source || 'sticky') + '" data-color="' + esc(color) + '" data-pin="' + pinOn + '">'
      + '<div class="nt"><span class="ty" id="ok">' + esc(src.type || 'Note') + '</span><span class="cols">' + dots + '</span>'
      + '<div class="ntools"><span title="Pin" id="ovPin" data-action="note-pin" data-id="' + esc(src.id || '') + '" data-source="' + esc(src.source || 'sticky') + '" data-on="' + pinOn + '">Pin</span><span title="More" data-action="note-menu" data-id="' + esc(src.id || '') + '" data-source="' + esc(src.source || 'sticky') + '" data-title="' + esc(title) + '" data-on="' + pinOn + '">&middot;&middot;&middot;</span><span title="Close (Esc)" data-action="note-close">&times;</span></div></div>'
      + '<h2 id="ot" contenteditable="true" data-action="note-edit" data-id="' + esc(src.id || '') + '" data-source="' + esc(src.source || 'sticky') + '">' + esc(title) + '</h2>'
      + '<div class="bdy" id="ob" contenteditable="true" data-action="note-edit" data-id="' + esc(src.id || '') + '" data-source="' + esc(src.source || 'sticky') + '">' + esc(body).replace(/\n/g, '<br>') + '</div>'
      + '<div class="nf"><span class="sv" id="ovSaved"><i></i>Saved &middot; just now</span>' + (edited ? '<span style="font-size:12px;color:#7a6400">' + esc(edited) + '</span>' : '')
      + '<div class="r"><button class="nb" data-action="note-space" data-id="' + esc(src.id || '') + '" data-title="' + esc(title) + '">Move to a Space</button><button class="nb pri" id="ovTask" data-action="note-task" data-id="' + esc(src.id || '') + '" data-title="' + esc(title) + '">Convert to task</button></div></div></div>';
  }

  function gated(fn) {
    return function () {
      var args = arguments;
      var self = this;
      whenCss(function () { fn.apply(self, args); });
    };
  }
  window.paintRedesignDashboard = gated(paintDashboardLive);
  window.paintRedesignWar = gated(paintWarLive);
  window.paintRedesignNotes = gated(paintNotesLive);

  var _ops = window.renderOpsDash;
  Object.defineProperty(window, 'renderOpsDash', {
    configurable: true,
    set: function (fn) { _ops = fn; },
    get: function () {
      return function () {
        window.paintRedesignDashboard();
        if (typeof window.paintShellNav === 'function') window.paintShellNav();
      };
    }
  });

  function hookWar() {
    if (typeof window.renderWar !== 'function' || window.renderWar.__redesign) return;
    window.renderWar = function () {
      window.paintRedesignWar();
      if (typeof window.paintShellNav === 'function') window.paintShellNav();
    };
    window.renderWar.__redesign = true;
  }
  function hookNotes() {
    if (typeof window.renderNotes !== 'function' || window.renderNotes.__redesign) return;
    window.renderNotes = function () {
      window.paintRedesignNotes();
      if (typeof window.paintShellNav === 'function') window.paintShellNav();
    };
    window.renderNotes.__redesign = true;
  }
  setInterval(function () { hookWar(); hookNotes(); }, 400);
  hookWar();
  hookNotes();
  window.__port = {
    fixtureOn: fixtureOn, wrapOf: wrapOf, whenCss: whenCss, markReady: markReady,
    esc: esc, asList: asList, liveLog: liveLog, initials: initials, ageLabel: ageLabel,
    HOSTS: HOSTS, TOKEN: TOKEN, finishPaint: finishPaint, applyPageCss: applyPageCss, cssText: cssText,
    signalsHtml: signalsHtml, liveWar: function () { return warData(); }, moveSteps: moveSteps, planFor: planFor
  };
  whenCss(function () {
    try {
      var path = String(location.pathname || '');
      var q = String(location.search || '');
      var notesView = /\/notes\/?$/.test(path) || /(?:^|[?&])view=notes(?:&|$)/.test(q);
      if (notesView) {
        var vn = document.getElementById('v-notes');
        if (vn) vn.hidden = false;
        paintNotesLive();
        return;
      }
      var warView = /\/war-room\/?$/.test(path) || /(?:^|[?&])view=war(?:&|$)/.test(q);
      var other = /(?:^|[?&])view=/.test(q) && !/(?:^|[?&])view=war(?:&|$)/.test(q) && !/(?:^|[?&])view=room(?:&|$)/.test(q);
      if (warView && !other) {
        var vw = document.getElementById('v-war');
        var vr = document.getElementById('v-room');
        if (vw) vw.hidden = false;
        if (vr) vr.hidden = true;
        paintWarLive();
      }
    } catch (e) {}
  });
})();
