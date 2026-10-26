/* Same ShadowPage + paint*Live for live STATE and ?fixture=mockup.
   ONE render path: data = fixtureOn() ? REDESIGN_FIXTURE.page : live*State().
   Fixture is data only. Parts B/C/D must use this same split. */
(function () {
  var TOKEN = ':host,:root{--ground:#0b1430;--ground2:#13224a;--side:#08102a;--card:#fff;--ink:#101a33;--ink2:#4a5672;--ink3:#7a86a0;--line:#e8ecf3;--soft:#f5f7fb;--blue:#2e6bf2;--blue50:#eaf1fe;--green:#12a36a;--green50:#e4f6ee;--amber:#c98408;--amber50:#fff4e0;--red:#e0364f;--red50:#fde9ec;--violet:#6b4fd8;font-family:Inter,-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",system-ui,sans-serif}'
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
    + '.desk-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:80;background:#142036;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;display:none;align-items:center;gap:12px;box-shadow:0 10px 30px rgba(3,10,30,.28)}'
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
    + '.pick-row:first-child{border-top:0}';
  var CSS = {
    room: '/port-css/dashboard.css?v=2', war: '/port-css/war-room.css?v=5', notes: '/port-css/notes.css?v=2',
    contacts: '/port-css/pipeline.css', work: '/port-css/spaces.css?v=5', spaceOpen: '/port-css/space-open.css?v=1', docs: '/port-css/documents.css',
    links: '/port-css/links.css?v=2', mail: '/port-css/email.css?v=2', mailPeople: '/port-css/email-people.css?v=1',
    playbook: '/port-css/playbook.css?v=2', calendar: '/port-css/calendar.css?v=3', zoom: '/port-css/zoom.css',
    completed: '/port-css/completed.css'
  };
  var HOSTS = {
    opsDash: 'room', warDesk: 'war', notesDesk: 'notes',
    pipeDesk: 'contacts', spacesDesk: 'work', docsDesk: 'docs', linksDesk: 'links', mailDesk: 'mail',
    playDesk: 'playbook', calDesk: 'calendar', zoomDesk: 'zoom', doneDesk: 'completed'
  };
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
  function stepsMap() {
    try { return JSON.parse(localStorage.getItem('cr_move_steps') || '{}') || {}; } catch (e) { return {}; }
  }

  function findHost(hostId) {
    var host = document.getElementById(hostId);
    if (host) return host;
    var views = ['v-playbook', 'v-calendar', 'v-znotes', 'v-done', 'v-news'];
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
      style.textContent = TOKEN + (cssText.work || '');
      return;
    }
    if (cssText[key] != null) style.textContent = TOKEN + cssText[key];
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
    return Math.max(0, Math.ceil((Date.parse('2026-10-30T07:00:00Z') - Date.now()) / 86400000));
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
      archived: !!meta.archived
    };
  }
  function noteFromBoard(n) {
    var kind = noteKind(n.kind || n.type);
    var pinMap = {};
    try { pinMap = JSON.parse(localStorage.getItem('cr_note_pin') || '{}'); } catch (e) { pinMap = {}; }
    return {
      id: String(n.id || ''), source: 'board',
      color: colorClass(n.color), type: kind.type, typeCls: kind.typeCls,
      title: n.title || '', body: n.body || '', pin: !!(n.pin || pinMap[n.id]),
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
    if (days <= 14) alerts.push({ sev: 'r', text: 'Raise closes in ' + days + ' days — cheques still open.', area: 'Raise' });
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
      cash: fin.cashLabel || (fin.cash != null ? ('$' + Number(fin.cash).toLocaleString('en-US')) : '$3,180'),
      burn: fin.burnLabel || 'see Financials',
      runway: fin.runwayLabel || '~1 day',
      raise: (raise.inLabel && raise.targetLabel) ? (raise.inLabel + ' of ' + raise.targetLabel) : '$80K of $250K',
      daysToClose: days,
      closeWhen: 'Oct 30',
      lamps: lamps,
      alerts: alerts,
      cheques: asList(fin.cheques).length ? asList(fin.cheques).map(function (c) {
        var st = String(c.state || c.status || '');
        return { cls: st === 'in' ? 'in' : (st === 'pend' || st === 'pending' ? 'pd' : 'op'), label: c.label || c.name || '-' };
      }) : [{ cls: 'op', label: '-' }, { cls: 'op', label: '-' }, { cls: 'op', label: '-' }, { cls: 'op', label: '-' }, { cls: 'op', label: '-' }, { cls: 'op', label: '-' }, { cls: 'op', label: '-' }],
      toGo: raise.toGoLabel || '$170K',
      bookedWeek: '$0',
      paceNote: 'Behind pace — widen the round today.',
      worries: [
        { tone: 'r', title: 'Concentration.', body: 'One friends-and-family track — one delayed cheque is the whole pace.' },
        { tone: 'r', title: 'About a day of runway.', body: 'A cheque has to land before the desk goes dark.' },
        { tone: 'a', title: 'Unsigned docs + short runway.', body: 'That pairing is what stalls a close.' }
      ],
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
      meetings: meetings.map(function (ev, i) {
        return { when: soon(ev.start), title: ev.title, kind: (i === 0 || ev.join) ? 'join' : 'bell', url: ev.join || '' };
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
    var moves = ceoMoves().slice(0, 3);
    var actions = asList(S.meetingActions).filter(function (row) { return row.status !== 'done' && row.status !== 'tasked' && row.status !== 'handled'; });
    var meetings = upcomingEvents().slice(0, 1);
    var nextEv = meetings[0] || {};
    function colItems(key) {
      return asList(S.items).filter(function (it) {
        if (key === 'done') {
          if (it.status !== 'done') return false;
          var when = it.doneAt || it.completedAt || it.updatedAt || it.due || '';
          if (!when) return true;
          try {
            var d = new Date(when);
            var now = new Date();
            return d.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' }) === now.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
          } catch (e) { return true; }
        }
        if (it.status === 'done' || it.status === 'dropped') return false;
        var b = itemBucket(it);
        if (key === 'today') return b === 'today' || b === 'overdue';
        if (key === 'week') return b === 'week';
        return b === 'later';
      });
    }
    function pack(key, cap) {
      var all = colItems(key);
      var limit = cap || 8;
      return { count: all.length, more: Math.max(0, all.length - limit), tasks: all.slice(0, limit).map(function (it) {
        return { id: it.id, title: verbTitle(it), tag: it.tag || it.category || it.area || 'Ops' };
      }) };
    }
    var zoomTasks = actions.filter(function (row) { return !row.handled; }).map(function (row) {
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
    var pb = S.playbook || {};
    var lights = pb.lightsLeft != null ? pb.lightsLeft : (pb.left != null ? pb.left : 0);
    var mailNeed = asList(S.mail).filter(function (m) { return m && (m.unread || m.needsReply || m.needReply); }).length;
    var cold = asList(S.contacts).filter(function (c) {
      var last = c.lastTouch || c.last_touch || c.lastContact || '';
      if (!last) return false;
      return (Date.now() - new Date(last).getTime()) / 86400000 >= 14;
    }).length;
    var attn = asList(S.integrations).filter(function (g) { return /warn|error|off|attention|missing/i.test(String(g.state || g.word || '')); }).length;
    var sigCount = [mailNeed, actions.length, people.filter(function (p) { return !p.done; }).length, cold, attn].filter(Boolean).length;
    liveLog('war', { moveOut: moves.length, actOut: actions.length, today: todayPack.count, week: colItems('week').length, later: colItems('later').length });
    return {
      cash: fin.cashLabel || '$3,180',
      runway: fin.runwayLabel || '~1 day',
      toGo: raise.toGoLabel || '$170K',
      daysToClose: days,
      nextMeet: { title: nextEv.title || '—', when: nextEv.start ? soon(nextEv.start) : '', url: nextEv.join || nextEv.url || '' },
      lights: lights,
      sigCount: sigCount || 0,
      coach: (S.ceo && S.ceo.coach) || "Regulators can wait. Don't let them take a cash-first morning — drop them or give them 20 minutes after 3pm.",
      hero: { id: heroMove.id || '', title: moveText(heroMove) || 'Pick today’s one move', why: moveWhy(heroMove) },
      moves: moves.map(function (m, i) {
        var zone = String(m.zone || m.area || 'Raise');
        var zc = /cash|runway/i.test(zone) ? 'z-cash' : /partner/i.test(zone) ? 'z-part' : /reg/i.test(zone) ? 'z-reg' : 'z-raise';
        return { id: m.id || '', title: moveText(m), zone: zc, zoneLabel: zone, one: i === 0, why: moveWhy(m), src: m.source || m.sourceLine || m.source_line || '' };
      }),
      meetingActionTotal: actions.length,
      reachToday: people.filter(function (p) { return !p.done; }).length,
      today: todayPack,
      week: pack('week', 8),
      later: pack('later', 2),
      done: pack('done', 8),
      signals: liveSignalsState(S, {
        mailNeed: mailNeed, owed: actions.length, reach: people.filter(function (p) { return !p.done; }).length,
        cold: cold, attn: attn, toGo: raise.toGoLabel || '$170K', days: days
      })
    };
  }

  function liveSignalsState(S, n) {
    var brain = (S.ceo && (S.ceo.brainLine || S.ceo.lastLine)) || '';
    return {
      brain: brain ? ('4orm Intelligence: ' + brain) : '4orm Intelligence is watching the desk.',
      needYou: n.sigCount || ((n.mailNeed ? 1 : 0) + (n.owed ? 1 : 0) + (n.reach ? 1 : 0) + (n.cold ? 1 : 0)),
      since: '8:00',
      needs: [
        { color: '#e0364f', title: 'Inbox', count: (n.mailNeed || 0) + ' need a reply', detail: 'People waiting on you', dest: 'mail', go: 'Email' },
        { color: '#e0364f', title: 'Owed from meetings', count: (n.owed || 0) + ' open', detail: 'From Zoom + Granola', dest: 'review', go: 'Review' },
        { color: '#c98408', title: 'Reach out', count: (n.reach || 0) + ' today', detail: 'Needs you today', dest: 'pipe', go: 'Pipeline' },
        { color: '#c98408', title: 'Going cold', count: (n.cold || 0) + ' people', detail: '14 days or more', dest: 'people', go: 'People' }
      ],
      news: [],
      watch: [
        { color: '#e0364f', title: 'Raise', count: (n.toGo || '$170K') + ' to go', detail: (n.days || 0) + ' days', dest: 'finance', go: 'Financials' },
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
    function addNote(n, mapFn) {
      var id = String(n && n.id || '') || (String(n && n.title || '') + '\n' + String(n && n.body || ''));
      if (!id || seen[id]) return;
      seen[id] = true;
      var row = mapFn(n);
      if (row && row.title && /^\[archived\]/i.test(row.title)) row.archived = true;
      if (row && !row.archived) rows.push(row);
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
      notes: rest
    };
  }

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
      var trail = ev.kind === 'join'
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
      + (data.worries || []).map(function (w) {
        return '<div class="row"><span class="wic ' + w.tone + '">!</span><div class="rt"><b>' + esc(w.title) + '</b> ' + esc(w.body) + '</div></div>';
      }).join('') + '</section></div>'
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
    return '<div class="task' + (done ? ' d' : '') + (picked ? ' picked' : '') + '" draggable="true" data-action="task-drag" data-id="' + id + '">' + sb + '<span class="cb' + (done ? ' on' : '') + '" data-action="task-done" data-id="' + id + '"></span><div><div class="tt">' + esc(it.title) + '</div><div class="tg">' + esc(it.tag || '') + '</div></div>' + hv + x + '</div>';
  }
  function execCol(label, col, bucket, dests, done) {
    var tasks = (col && col.tasks) || [];
    var body = tasks.length
      ? tasks.map(function (it) { return warTask(it, dests, done); }).join('')
      : '<div class="empty">Nothing set for this ' + (label === 'This week' ? 'week' : 'column') + '.<br>Drag a task here or press +.</div>';
    var more = col && col.more ? '<div class="more2">+ ' + col.more + ' more</div>' : '';
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
      + (sig.news && sig.news.length ? '<div class="sec">New since ' + esc(sig.since || '8:00') + '</div>' + rows(sig.news) : '')
      + '<div class="sec">Watch</div>' + rows(sig.watch)
      + '<div class="sf">Everything above lives on its own page. This is the summary.<a data-action="signals-go" data-dest="brain">Brain log</a></div></div>';
  }

  function paintWarLive() {
    var wrap = wrapOf('warDesk');
    if (!wrap) return;
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
    wrap.innerHTML =
      '<section class="ribbon thin">'
      + '<span class="ri"><b class="red">' + esc(data.runway || '~1 day') + '</b> runway</span><span class="rsep"></span>'
      + '<span class="ri"><b>' + esc(data.toGo || '$170K') + '</b> to go &middot; <b>' + esc(data.daysToClose != null ? data.daysToClose : 11) + ' days</b></span><span class="rsep"></span>'
      + '<span class="ri">Next: <b>' + esc(next.title || '—') + '</b> ' + esc(next.when || '') + (next.url ? ' <span class="lnk" data-action="meet-join" data-url="' + esc(next.url) + '">Join</span>' : '') + '</span><span class="rsep"></span>'
      + '<span class="ri"><b>' + esc(data.lights != null ? data.lights : 11) + '</b> lights left today</span>'
      + '<span class="sp"></span>'
      + '<span class="ri sig" id="sigBtn" data-action="signals-open">Signals <b class="n">' + esc(data.sigCount != null ? data.sigCount : 6) + '</b></span>'
      + '<div class="cwrap"><button class="coachbtn" id="coachbtn" data-action="coach-toggle">Coaching note</button>'
      + '<div class="coachpop" id="coachpop"><b>Coaching note</b><p>' + esc(data.coach || '') + '</p></div></div>'
      + '<button class="vb" data-action="show-money">Show $</button></section>'
      + '<div class="capture"><input data-action="capture-input" placeholder="Capture a task or an idea to park it, so you don\'t lose focus"><button data-action="capture-add">Add</button></div>'
      + '<div class="wrow"><section class="hero"><div class="htop"><div>'
      + '<div class="hl">Today\'s one move</div><h2>' + esc(data.hero && data.hero.title) + '</h2>'
      + '<div class="why">' + esc(data.hero && data.hero.why) + '</div></div>'
      + '<div class="ring"><svg viewBox="0 0 112 112"><circle cx="56" cy="56" r="48" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="8"/><circle cx="56" cy="56" r="48" fill="none" stroke="#5b8cff" stroke-width="8" stroke-dasharray="301.6" stroke-dashoffset="0" stroke-linecap="round" transform="rotate(-90 56 56)"/></svg><div><div><b>25:00</b><span>focus</span></div></div></div></div>'
      + '<div class="hbtns"><button class="hb1 go" data-action="focus-toggle">&#9654; Start 25-min focus</button><button class="hb2" data-action="focus-stop" hidden>Stop</button><button class="hb1" data-action="hero-commit" data-id="' + esc((data.hero && data.hero.id) || '') + '" data-title="' + esc((data.hero && data.hero.title) || '') + '">Commit as my one thing</button><button class="hb2" data-action="hero-plan" data-id="' + esc((data.hero && data.hero.id) || '') + '" data-title="' + esc((data.hero && data.hero.title) || '') + '">Plan</button><button class="hb2" data-action="hero-cancel" data-id="' + esc((data.hero && data.hero.id) || '') + '">Cancel this move</button></div>'
      + '<div class="moves"><div class="mh"><h3>4orm Intelligence &middot; CEO ranked moves</h3><span class="s">rebuilt 6:30 am</span><button class="rr" data-action="moves-rerun">&#8635; Re-run</button></div>'
      + moves.map(function (m, i) {
        var mid = String(m.id || ('m' + i));
        var stored = stepsMap()[mid] || m.steps || [];
        var wantOpen = (window.STATE && window.STATE.openSteps === mid) || (qFlag('steps') && i === 0);
        var steps = Array.isArray(stored) ? stored : [];
        var doneN = steps.filter(function (s) { return s && s.done; }).length;
        var stp = '';
        if (wantOpen) {
          stp = '<div class="stp" style="grid-column:1/-1"><h6>Steps for this move <em>' + doneN + ' of ' + steps.length + ' done</em></h6>'
            + steps.map(function (s, si) {
              return '<div class="s' + (s.done ? ' d' : '') + '" data-action="step-toggle" data-id="' + esc(mid) + '" data-i="' + si + '"><i>' + (s.done ? '&#10003;' : '') + '</i><span>' + esc(s.text || '') + '</span>'
                + (s.when ? '<small>' + esc(s.when) + '</small>' : (s.act ? '<a data-action="step-act" data-id="' + esc(mid) + '" data-i="' + si + '" data-act="' + esc(s.act) + '">' + esc(s.act) + '</a>' : '')) + '</div>';
            }).join('')
            + '<div class="addst" data-action="step-add" data-id="' + esc(mid) + '">+ Add a step</div></div>';
        }
        return '<div class="mv2' + (m.one ? ' one' : '') + '"><span class="rk">' + (i + 1) + '</span><div><div class="mt">' + esc(m.title) + ' <span class="zn ' + m.zone + '">' + esc(m.zoneLabel) + '</span>' + (m.one ? '<span class="yo">Your one move</span>' : '') + '</div><div class="ms2">' + esc(m.why) + '</div><div class="src">' + esc(m.src) + '</div></div><div class="ma"><button class="do" data-action="move-do" data-id="' + esc(mid) + '">Do</button><button data-action="move-steps" data-id="' + esc(mid) + '"' + (wantOpen ? ' class="on-steps" style="background:#101a33;color:#fff"' : '') + '>Steps</button><button data-action="move-plan" data-id="' + esc(mid) + '" data-title="' + esc(m.title) + '">Plan</button><button class="x" data-action="move-dismiss" data-id="' + esc(mid) + '"' + (m.one ? ' title="Dismiss - the next move takes its place"' : '') + '>&times;</button></div>' + stp + '</div>';
      }).join('') + '</div></section>'
      + '<div class="rstack"><section class="card exec today' + (execSelecting() ? ' sel' : '') + '">'
      + '<div class="ch"><h3>Today</h3><span class="s">' + esc(today.count || (today.tasks || []).length) + ' on the desk &middot; drag to reorder</span><span class="selbtn" data-action="exec-select">' + (execSelecting() ? 'Done' : 'Select') + '</span><span class="lnk" style="margin-left:auto" data-action="exec-add" data-bucket="today">+ Add</span></div>'
      + execBar()
      + '<div class="tl" data-action="col-drop" data-bucket="today">' + todayBody + '</div>'
      + '<div class="foot"><span class="lnk" data-action="owed-review">' + esc(data.meetingActionTotal != null ? data.meetingActionTotal : 8) + ' owed from meetings &middot; review</span><span class="lnk" style="margin-left:auto" data-action="reach-pipe">Reach out &middot; ' + esc(data.reachToday != null ? data.reachToday : 4) + ' today &rsaquo;</span></div>'
      + '</section></div></div>'
      + '<section class="card exec"><div class="ch"><h3>Execution</h3><span class="s">drag between columns &middot; Today is above</span><span class="lnk" style="margin-left:auto" data-action="exec-full">Full screen</span></div><div class="cols">'
      + execCol('This week', data.week, 'week', [['today', 'Today'], ['later', 'Later']])
      + execCol('Later', data.later, 'later', [['today', 'Today'], ['week', 'Week']])
      + execCol('Done today', data.done, 'done', [], true)
      + '</div></section>'
      + signalsHtml(data, sigOpen)
      + '<div class="plan-ov" id="planOv" hidden data-action="plan-close"><div class="plan-box" data-action="note-keep"><h3 id="planHd">Plan</h3><textarea id="planBody" data-action="plan-draft" rows="8" placeholder="Steps, one per line"></textarea><div class="plan-acts"><button class="pri" data-action="plan-ask">Ask 4orm Intelligence</button><button class="pri" data-action="plan-save">Save plan</button><button data-action="plan-close">Cancel</button></div></div></div>'
      + '<div class="toast" id="toast"></div>';
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

  function noteCard(n) {
    var ty = 'ty' + (n.typeCls ? ' ' + n.typeCls : '');
    var id = esc(n.id || '');
    var src = esc(n.source || 'sticky');
    var ttl = esc(n.title || '');
    var pin = n.pin
      ? '<span class="pin" data-action="note-pin" data-id="' + id + '" data-source="' + src + '" data-on="1"></span><span class="nx x" data-action="note-archive" data-id="' + id + '" data-source="' + src + '" data-title="' + ttl + '">&times;</span>'
      : '<span class="nx x" style="margin-left:auto" data-action="note-archive" data-id="' + id + '" data-source="' + src + '" data-title="' + ttl + '">&times;</span>';
    var title = n.title ? '<h4>' + esc(n.title) + '</h4>' : '';
    var body = n.body ? '<p>' + esc(n.body) + '</p>' : '';
    var checks = (n.checks || []).map(function (c) {
      return '<div class="ck' + (c.done ? ' done' : '') + '"><i>' + (c.done ? '&#10003;' : '') + '</i>' + esc(c.text) + '</div>';
    }).join('');
    var metaBits = (n.links || []).map(function (l) {
      var lab = /^Link\s/i.test(String(l || '')) ? String(l) : ('Link ' + l);
      return '<span class="mc link">' + esc(lab) + '</span>';
    });
    if (n.reminder) metaBits.push('<span class="mc rem">&#9200; ' + esc(n.reminder) + '</span>');
    var meta = metaBits.length ? '<div class="meta">' + metaBits.join('') + '</div>' : '';
    return '<div class="note ' + n.color + '" data-action="note-open" data-id="' + id + '" data-source="' + src + '" data-title="' + ttl + '" data-body="' + esc(n.body || '') + '" data-type="' + esc(n.typeCls || '') + '" data-color="' + esc(n.color || 'y') + '" data-pin="' + (n.pin ? '1' : '0') + '"><div class="nh"><span class="' + ty + '">' + esc(n.type) + '</span>' + pin + '</div>'
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
    var data = notesData();
    var c = data.counts || {};
    wrap.innerHTML =
      '<div class="bar"><h1>Notes</h1><span class="sub">Capture fast, sort later &mdash; every note can become a task, content or a Space</span>'
      + '<div class="r"><button class="btn" data-action="notes-tidy">Tidy up</button><button class="btn" data-action="notes-full">&#8599; Full screen</button><button class="btn pri" data-action="note-new">+ New note</button></div></div>'
      + '<div class="tools"><input class="search" data-action="notes-search" placeholder="Search notes, people, Spaces">'
      + '<button class="chip on" data-action="notes-filter" data-filter="all">All <i>' + esc(c.all) + '</i></button><button class="chip" data-action="notes-filter" data-filter="pinned">Pinned <i>' + esc(c.pinned) + '</i></button>'
      + '<button class="chip" data-action="notes-filter" data-filter="todo">To-do <i>' + esc(c.todo) + '</i></button><button class="chip" data-action="notes-filter" data-filter="idea">Idea <i>' + esc(c.idea) + '</i></button>'
      + '<button class="chip" data-action="notes-filter" data-filter="person">Person <i>' + esc(c.person) + '</i></button><button class="chip" data-action="notes-filter" data-filter="dec">Decision <i>' + esc(c.decision) + '</i></button>'
      + '<button class="chip" data-action="notes-filter" data-filter="archive">Archive</button>'
      + '<div class="cols" title="Filter by colour"><span class="cdot y" data-action="notes-color" data-color="y" style="background:#fff6c9"></span><span class="cdot" data-action="notes-color" data-color="p" style="background:#ffe1ea"></span><span class="cdot" data-action="notes-color" data-color="g" style="background:#ddf5e6"></span><span class="cdot" data-action="notes-color" data-color="b" style="background:#e1ecff"></span><span class="cdot" data-action="notes-color" data-color="o" style="background:#ffe6cf"></span><span class="cdot" data-action="notes-color" data-color="v" style="background:#ece4ff"></span></div>'
      + '<div class="seg"><span class="on" data-action="notes-view" data-view="board">Board</span><span data-action="notes-view" data-view="canvas">Canvas</span></div></div>'
      + '<div class="sec">Pinned</div><div class="board" style="margin-bottom:6px">'
      + (data.pinned || []).map(noteCard).join('') + '<div class="newcard" data-action="note-new">+ Pin a note here</div></div>'
      + '<div class="sec">All notes</div><div class="board">'
      + (data.notes || []).map(noteCard).join('') + '</div>'
      + noteOverlayHtml(data)
      + '<div class="toast" id="toast"></div>';
    finishPaint(wrap);
    markReady('notesDesk');
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
    signalsHtml: signalsHtml
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
      var warView = /\/war-room\/?$/.test(path) || /(?:^|[?&])view=war(?:&|$)/.test(q) || /\/control-room/.test(path) || path === '/' || path === '/control-room.html';
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
