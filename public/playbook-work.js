/* Playbook work views, 28 Oct 2026: Lanes (A), Time blocks (C) and the 15-minute Sprint (D), beside Full week.
   Every contact opens the contact card (dossier.js). Plays, events and to-dos open the Playbook's own pop-ups. */
(function () {
  var PBW = window.PBWork = window.PBWork || {};
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(url, method, body) {
    var fn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
    return fn(url, { method: method || 'GET', credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  }
  function vanDay(ms) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)); }
  function vanHM(ms) { return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms)); }
  function minsOf(ms) { var p = vanHM(ms).split(':'); return Number(p[0]) * 60 + Number(p[1]); }
  function hm(m) { m = Math.max(0, Math.round(m)); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function tel(v) { return String(v || '').split(/\s*(?:;|\/|,|\bor\b)\s*/)[0].replace(/[^\d+]/g, ''); }

  var S = { calls: null, at: 0, root: null, host: null, mode: '', sprint: null };
  var LANES = [
    { key: 'call', name: 'Phone', test: function (r) { return r.channel === 'Call'; }, c: '#00dc86', min: 4, cap: 120 },
    { key: 'li', name: 'LinkedIn in GoHighLevel', test: function (r) { return r.channel === 'LinkedIn'; }, c: '#4272f9', min: 3, cap: 60 },
    { key: 'mail', name: 'Email and forms', test: function (r) { return r.channel === 'Email' || r.channel === 'Form'; }, c: '#9771f9', min: 3, cap: 60 }
  ];
  function people() {
    var d = S.calls || {};
    var seen = {}, out = [];
    (d.due || []).concat(d.planned || []).forEach(function (r) { if (!seen[r.id]) { seen[r.id] = 1; out.push(r); } });
    return out;
  }
  function laneOf(key) { return LANES.filter(function (l) { return l.key === key; })[0]; }
  function inLane(l) {
    return people().filter(l.test).sort(function (a, b) {
      var pa = Number(a.pain) || 0, pb = Number(b.pain) || 0;
      if (pb !== pa) return pb - pa;
      return (Number(b.score) || 0) - (Number(a.score) || 0);
    });
  }
  function load(force, then) {
    if (!force && S.calls && Date.now() - S.at < 60000) { if (then) then(); return; }
    S.at = Date.now();
    api('/api/growth?calls=1').then(function (r) { return r && r.ok ? r.json() : null; }).then(function (d) { if (d) S.calls = d; if (then) then(); }).catch(function () { if (then) then(); });
  }
  function painBar(p) {
    var n = Number(p); if (!isFinite(n) || p === null || p === '' || p === undefined) return '';
    return '<span class="wpain">' + [1, 2, 3, 4, 5].map(function (i) { return '<i' + (n >= i * 20 - 10 ? ' class="on"' : '') + '></i>'; }).join('') + '</span><b class="wpn">' + esc(n) + '</b>';
  }
  function whoOf(r) {
    if (r.list === 'angels') return String(r.contact || '').replace(r.name, '').trim().slice(0, 70);
    var p = String(r.contact || '').split(/\s*\|\s*/);
    return [p[0] && !/@|^\+?\d/.test(p[0]) ? p[0] : '', p[1] || ''].filter(Boolean).join(' · ');
  }
  function card(r, lane) {
    var sub = [whoOf(r), r.city, r.industry && r.industry !== r.name ? r.industry : ''].filter(Boolean).join(' · ');
    var line = r.pain_drivers || r.backed || r.why || '';
    return '<div class="wcard" style="--c:' + lane.c + '" data-who="' + esc(r.id) + '" data-lane="' + lane.key + '"><div class="wn"><b>' + esc(r.name) + '</b>' + (r.next_date ? '<span class="wdue">follow-up</span>' : '') + '</div>'
      + '<div class="ws">' + esc(sub) + '</div>' + (line || r.pain ? '<div class="wl">' + painBar(r.pain) + esc(String(line).slice(0, 120)) + '</div>' : '') + '</div>';
  }
  function today() { return vanDay(Date.now()); }
  function events() {
    var t = today();
    return (((window.STATE || {}).events) || []).filter(function (ev) { return ev && ev.start && vanDay(ev.start) === t && !(ev.dur >= 1440); }).sort(function (a, b) { return a.start - b.start; });
  }
  function plays() {
    var M = window.__playMount || {}, ti = M.todayIdx == null ? 0 : M.todayIdx;
    return (M.rows || []).filter(function (r) { return r && !r.s && r.d && (r.d[ti] === 'due' || r.d[ti] === 'next'); });
  }
  function todos() { return (window.TDL || []).filter(function (x) { return x.b === 'today' && !x.done && !x.gone; }); }
  function score() { var d = S.calls || {}; return (d.doneToday || 0) + ' done · ' + people().length + ' to go'; }

  /* ---------- A: Run sheet (replaces Lanes, 29 Oct 2026) ----------
     Everything for today on one list: every number to call, every LinkedIn touch, every email and form,
     the to-dos and the rhythms. A box on every line. Logging an outcome ticks the box; Undo puts it back. */
  var OUTS = {
    call: [['No answer', 'No answer'], ['Left voicemail', 'Voicemail'], ['Spoke', 'Spoke'], ['Meeting booked', 'Booked']],
    li: [['Sent in GoHighLevel', 'Sent'], ['Replied', 'Replied']],
    mail: [['Sent', 'Sent'], ['Form sent', 'Form sent'], ['Replied', 'Replied']]
  };
  var CHK = { call: 'Called', li: 'Sent in GoHighLevel', mail: 'Sent' };
  function R() { if (!S.run) S.run = { flt: 'all', list: '', hide: false, done: {}, touch: {}, more: {}, items: {} }; return S.run; }
  function runRows() {
    var run = R(), rows = [];
    LANES.forEach(function (l) {
      inLane(l).forEach(function (r) { rows.push({ kind: l.key, id: r.id, r: r, list: r.listName || r.list || '' }); });
    });
    /* Rows logged this session stay on the sheet, struck through. */
    Object.keys(run.items).forEach(function (id) { if (!rows.some(function (x) { return x.id === id; })) rows.push(run.items[id]); });
    todos().concat((window.TDL || []).filter(function (x) { return x.b === 'today' && run.done['td:' + x.id]; }).filter(function (x, i, arr) { return arr.indexOf(x) === i; }))
      .forEach(function (x) { if (!rows.some(function (y) { return y.id === 'td:' + x.id; })) rows.push({ kind: 'todo', id: 'td:' + x.id, x: x, list: 'To-dos' }); });
    var M = window.__playMount || {}, ti = M.todayIdx == null ? 0 : M.todayIdx;
    (M.rows || []).filter(function (r) { return r && !r.s && r.d && (r.d[ti] === 'due' || r.d[ti] === 'next' || run.done['pl:' + (r.id || r.n)]); })
      .forEach(function (r) { rows.push({ kind: 'play', id: 'pl:' + (r.id || r.n), p: r, list: 'Rhythms' }); });
    return rows;
  }
  function isDone(row) {
    var run = R();
    if (run.done[row.id]) return true;
    if (row.kind === 'play') { var M = window.__playMount || {}, ti = M.todayIdx == null ? 0 : M.todayIdx; return row.p.d && row.p.d[ti] === 'done'; }
    if (row.kind === 'todo') return !!row.x.done;
    return false;
  }
  var BLOCKS = [['call', 'Calls', '#00dc86'], ['li', 'LinkedIn through GoHighLevel', '#4272f9'], ['mail', 'Email and forms', '#ffa946'], ['todo', 'To-dos', '#9771f9'], ['play', 'Rhythms left today', '#c8d1ea']];
  function rowHtml(row, n) {
    var run = R(), done = isDone(row), k = row.kind;
    var box = '<button type="button" class="rcb' + (done ? ' on' : '') + '" data-rck="' + esc(row.id) + '" aria-label="' + (done ? 'Done' : 'Mark done') + '">' + (done ? 'Done' : '') + '</button>';
    var num = '<span class="rn">' + n + '</span>';
    if (k === 'todo') {
      var x = row.x;
      return '<div class="rrow' + (done ? ' rdone' : '') + '">' + box + num + '<div class="rwho"><b>' + esc(x.t) + '</b><small>' + esc(x.from || 'To-do') + '</small></div><span class="rtag">To-do</span><span class="rmid"></span>'
        + '<div class="racts">' + (done ? '<span class="rlog">Done</span>' : '<button type="button" data-rtodo="' + esc(x.id) + '">Open</button>') + '</div></div>';
    }
    if (k === 'play') {
      var p = row.p;
      return '<div class="rrow' + (done ? ' rdone' : '') + '">' + box + num + '<div class="rwho"><b>' + esc(p.n) + '</b><small>' + esc(p.grp || 'Daily') + '</small></div><span class="rtag">Rhythm</span><span class="rmid">' + (done ? 'Done' : 'Due today') + '</span>'
        + '<div class="racts">' + (done ? '<span class="rlog">Done</span>' : '<button type="button" data-rplay="' + esc(row.id) + '">Open</button>') + '</div></div>';
    }
    var r = row.r, ph = tel(r.phone), shown = String(r.phone || '').split(/\s*[;/]\s*/)[0];
    var sub = [whoOf(r), r.city].filter(Boolean).join(' · ');
    var mid = k === 'call' ? (ph ? '<a class="rph" href="tel:' + esc(ph) + '">' + esc(shown) + '</a>' : '<span class="rph none">No phone yet</span>')
      : '<span class="rline">' + esc(String(r.why || r.pain_drivers || r.backed || r.email || '').slice(0, 90)) + '</span>';
    var pain = (r.pain != null && r.pain !== '') ? painBar(r.pain) : '';
    var outs = done ? '<span class="rlog">' + esc(run.done[row.id] || 'Logged') + '</span>'
      : (OUTS[k] || []).map(function (o) { return '<button type="button" data-rout="' + esc(o[0]) + '" data-rid="' + esc(row.id) + '">' + esc(o[1]) + '</button>'; }).join('')
        + '<button type="button" class="rgo" data-who="' + esc(r.id) + '" data-lane="' + k + '">' + (k === 'call' && ph ? 'Call' : 'Open card') + '</button>';
    return '<div class="rrow' + (done ? ' rdone' : '') + '">' + box + num + '<div class="rwho"><b>' + esc(r.name) + '</b><small>' + esc(sub) + '</small></div><span class="rtag">' + esc(row.list) + '</span>'
      + '<span class="rmid">' + mid + (pain ? '<span class="rpain">' + pain + '</span>' : '') + '</span><div class="racts">' + outs + '</div></div>';
  }
  function paintLanes() {
    var run = R(), rows = runRows();
    var lists = []; rows.forEach(function (x) { if ((x.kind === 'call' || x.kind === 'li' || x.kind === 'mail') && x.list && lists.indexOf(x.list) < 0) lists.push(x.list); });
    var all = rows.length, dn = rows.filter(isDone).length;
    var cnt = {}; BLOCKS.forEach(function (b) { cnt[b[0]] = rows.filter(function (x) { return x.kind === b[0]; }); });
    var h = '<div class="rhead"><div class="rh1"><div><span class="wlab">Run sheet · ' + esc(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())) + '</span>'
      + '<h3>Everything for today, one list, check it off</h3></div><div class="rbig"><b>' + dn + '</b><span>of ' + all + ' done</span></div></div>'
      + '<div class="rbar">' + BLOCKS.map(function (b) { var c = cnt[b[0]], d = c.filter(isDone).length; return c.length ? '<i style="flex:' + c.length + ';--c:' + b[2] + '"><em style="width:' + Math.round(d / c.length * 100) + '%"></em></i>' : ''; }).join('') + '</div>'
      + '<div class="rflt"><button type="button" data-rf="all" class="' + (run.flt === 'all' ? 'on' : '') + '">All ' + all + '</button>'
      + BLOCKS.map(function (b) { var c = cnt[b[0]]; return c.length ? '<button type="button" data-rf="' + b[0] + '" class="' + (run.flt === b[0] ? 'on' : '') + '">' + esc(b[0] === 'play' ? 'Rhythms' : b[0] === 'li' ? 'LinkedIn' : b[0] === 'mail' ? 'Email' : b[1]) + ' ' + c.length + '</button>' : ''; }).join('')
      + '<span class="rsp"></span>' + lists.map(function (l) { return '<button type="button" data-rl="' + esc(l) + '" class="' + (run.list === l ? 'on' : '') + '">' + esc(l) + '</button>'; }).join('')
      + '<button type="button" data-rhide="1" class="' + (run.hide ? 'on' : '') + '">Hide done</button></div></div>';
    BLOCKS.forEach(function (b) {
      if (run.flt !== 'all' && run.flt !== b[0]) return;
      var rs = cnt[b[0]].filter(function (x) { return !run.list || x.list === run.list || x.kind === 'todo' || x.kind === 'play'; });
      if (run.list && (b[0] === 'todo' || b[0] === 'play')) return;
      if (!rs.length) return;
      var d = rs.filter(isDone).length;
      var vis = rs.filter(function (x) { return !(run.hide && isDone(x)); });
      var lim = run.more[b[0]] ? vis.length : 15;
      var firstOpen = rs.filter(function (x) { return !isDone(x); })[0];
      h += '<section class="rblk" style="--c:' + b[2] + '"><div class="rbh"><i></i><b>' + esc(b[1]) + '</b><span>' + d + ' of ' + rs.length + '</span><span class="rmini"><em style="width:' + Math.round(d / rs.length * 100) + '%"></em></span>'
        + (b[0] === 'call' && firstOpen ? '<button type="button" class="rstart" data-start="call">Start calling</button>' : '') + '</div>'
        + vis.slice(0, lim).map(function (x) { return rowHtml(x, rs.indexOf(x) + 1); }).join('')
        + (vis.length > lim ? '<div class="rmore">' + (vis.length - lim) + ' more in this block <button type="button" data-rmore="' + b[0] + '">Show all ' + vis.length + '</button></div>' : '')
        + '</section>';
    });
    var doneRows = rows.filter(isDone);
    h += '<div class="rdonebox"><span class="wlab">Done today · ' + ((S.calls && S.calls.doneToday) || 0) + ' contacts logged</span><p>' + (doneRows.length ? doneRows.map(function (x) {
      return esc(x.kind === 'todo' ? x.x.t : x.kind === 'play' ? x.p.n : x.r.name + (run.done[x.id] ? ', ' + run.done[x.id].toLowerCase() : ''));
    }).join(' · ') : 'Nothing checked off yet.') + '</p></div>';
    return h;
  }
  function runLog(id, outcome) {
    var run = R(), row = runRows().filter(function (x) { return x.id === id; })[0];
    if (!row || !row.r) return;
    var ch = row.kind === 'call' ? 'Call' : row.kind === 'li' ? 'LinkedIn' : 'Email';
    if (outcome === 'Spoke' && window.openDossier) {
      window.openDossier(row.r.id, { channel: 'Call', onSaved: function (rec, o) { if (o) { run.done[id] = o; run.items[id] = row; } load(true, paint); } });
      return;
    }
    run.done[id] = outcome; run.items[id] = row; paint();
    var fu = /voicemail|No answer/i.test(outcome) ? vanDay(Date.now() + 2 * 86400000) : '';
    api('/api/growth', 'POST', { action: 'touch', id: row.r.id, channel: ch, outcome: outcome, note: '', next_date: fu }).then(function (x) { return x && x.ok ? x.json() : null; }).then(function (res) {
      var tid = res && res.touch && res.touch.id;
      if (!res) { delete run.done[id]; paint(); if (S.toast) S.toast('Could not log that. Try again.', function () {}); return; }
      if (S.calls) S.calls.doneToday = (S.calls.doneToday || 0) + 1;
      if (S.toast) S.toast(row.r.name + ' · ' + outcome, function () { if (tid) api('/api/growth', 'POST', { action: 'undo-touch', touchId: tid }); delete run.done[id]; delete run.items[id]; if (S.calls) S.calls.doneToday = Math.max(0, (S.calls.doneToday || 1) - 1); paint(); });
    }).catch(function () { delete run.done[id]; paint(); });
  }
  function runCheck(id) {
    var run = R(), row = runRows().filter(function (x) { return x.id === id; })[0];
    if (!row || isDone(row)) return;
    if (row.kind === 'todo') { run.done[id] = 'Done'; paint(); if (S.open.todoDone) S.open.todoDone(row.x.id); return; }
    if (row.kind === 'play') { run.done[id] = 'Done'; paint(); if (S.open.playDone) S.open.playDone(row.p, function () { delete run.done[id]; paint(); }); return; }
    runLog(id, CHK[row.kind] || 'Done');
  }

  /* ---------- C: Time blocks ---------- */
  function planBlocks() {
    var evs = events().map(function (ev) { var s = minsOf(ev.start); return { s: s, e: s + (Number(ev.dur) || 30), ev: ev }; });
    var DAY0 = 8 * 60, DAY1 = 17 * 60;
    var gaps = [], cur = DAY0;
    evs.forEach(function (x) { if (x.s > cur) gaps.push([cur, Math.min(x.s, DAY1)]); cur = Math.max(cur, x.e); });
    if (cur < DAY1) gaps.push([cur, DAY1]);
    gaps = gaps.filter(function (g) { return g[1] - g[0] >= 30; });
    var blocks = [];
    LANES.forEach(function (l) {
      var n = inLane(l).length; if (!n) return;
      var need = Math.max(30, Math.min(l.cap, Math.ceil(n * l.min / 15) * 15));
      while (need >= 30 && gaps.length) {
        var g = gaps[0], len = Math.min(need, g[1] - g[0]);
        blocks.push({ s: g[0], e: g[0] + len, lane: l });
        g[0] += len; need -= len;
        if (g[1] - g[0] < 30) gaps.shift();
      }
    });
    var items = evs.map(function (x, k) { return { s: x.s, e: x.e, ev: x.ev, k: k }; }).concat(blocks);
    return items.sort(function (a, b) { return a.s - b.s; });
  }
  function paintBlocks() {
    var items = planBlocks(), now = minsOf(Date.now());
    var used = {};
    var h = '<div class="wblocks"><div class="wtl">';
    if (!items.length) h += '<div class="wm">Nothing planned today.</div>';
    items.forEach(function (it) {
      var live = now >= it.s && now < it.e, past = now >= it.e;
      if (it.ev) {
        h += '<div class="wblk wevb' + (live ? ' now' : '') + (past ? ' past' : '') + '" data-ev="' + it.k + '"><span class="wt">' + hm(it.s) + '</span><div><b>' + esc(it.ev.title || 'Event') + '</b><span class="wm"> ' + (it.e - it.s) + ' min</span></div></div>';
        return;
      }
      var l = it.lane, all = inLane(l), from = used[l.key] || 0;
      var per = Math.max(1, Math.round((it.e - it.s) / l.min));
      var rs = all.slice(from, from + per); used[l.key] = from + rs.length;
      h += '<div class="wblk wrk' + (live ? ' now' : '') + (past ? ' past' : '') + '" style="--c:' + l.c + '"><span class="wt">' + hm(it.s) + '</span><div class="wbody"><div class="wlh"><b>' + hm(it.s) + ' - ' + hm(it.e) + ' ' + esc(l.name) + '</b><span>' + rs.length + ' in this block</span></div>'
        + '<div class="wrow' + (rs.length > 6 ? ' wscroll' : '') + '">' + rs.map(function (r) { return card(r, l); }).join('') + '</div>'
        + (rs.length > 6 ? '<div class="wm">' + rs.length + ' in this block. Scroll right to see all of them.</div>' : '')
        + (rs.length ? '<button type="button" class="wstart" data-start="' + l.key + '" data-from="' + from + '" data-n="' + rs.length + '">Start this block</button>' : '') + '</div></div>';
    });
    h += '</div><div class="wside"><div class="wlab">Score</div><div class="wbig">' + esc(score()) + '</div>'
      + '<div class="wlab" style="margin-top:12px">Plays</div>' + plays().map(function (r, k) { return '<div class="wcard" style="--c:#ffa946" data-play="' + k + '"><div class="wn"><b>' + esc(r.n) + '</b></div></div>'; }).join('')
      + '<div class="wlab" style="margin-top:12px">To-dos due</div>' + (todos().map(function (x) { return '<div class="wcard" style="--c:#ff4866" data-todo="' + esc(x.id) + '"><div class="wn"><b>' + esc(x.t) + '</b></div></div>'; }).join('') || '<div class="wm">None due.</div>')
      + '</div></div>';
    return h;
  }

  /* ---------- D: 15-minute sprint ---------- */
  var KEYS = [['1', 'No answer'], ['2', 'Left voicemail'], ['3', 'Spoke'], ['4', 'Meeting booked'], ['5', 'Call back'], ['6', 'Not interested']];
  /* A sprint is the next 15 not yet logged; the rest of today's list waits underneath for the next sprint. */
  function sprintPool(l) { return inLane(l).filter(function (r) { return l.key !== 'call' || tel(r.phone); }); }
  function sprintNew(laneKey, skip) {
    var l = laneOf(laneKey || 'call');
    var pool = sprintPool(l).filter(function (r) { return !(skip && skip[r.id]); });
    S.sprint = { lane: l.key, list: pool.slice(0, 15), rest: pool.slice(15), i: 0, left: 15 * 60, run: false, res: {}, timer: null, done: skip || {} };
  }
  function paintSprint() {
    var sp = S.sprint;
    if (!sp) { sprintNew('call'); sp = S.sprint; }
    var l = laneOf(sp.lane), r = sp.list[sp.i];
    var c = { n: 0, talk: 0, vm: 0, na: 0, book: 0 };
    Object.keys(sp.res).forEach(function (k) { var o = sp.res[k]; c.n++; if (o === 'Spoke') c.talk++; if (o === 'Left voicemail') c.vm++; if (o === 'No answer') c.na++; if (o === 'Meeting booked') c.book++; });
    var mm = Math.floor(sp.left / 60), ss = sp.left % 60;
    var h = '<div class="wsp"><div class="wtop"><div class="wbox wclock"><span class="wlab">Time left</span><b class="wtime">' + mm + ':' + String(ss).padStart(2, '0') + '</b>'
      + '<button type="button" class="wstart" data-sp="' + (sp.run ? 'pause' : 'go') + '">' + (sp.run ? 'Pause' : (sp.left < 900 ? 'Resume' : 'Start the clock')) + '</button></div>'
      + '<div class="wbox"><span class="wlab">List</span><select data-sp="lane">' + LANES.map(function (x) { return '<option value="' + x.key + '"' + (x.key === sp.lane ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div>'
      + '<div class="wbox"><span class="wlab">Dialled</span><b>' + c.n + '</b></div><div class="wbox"><span class="wlab">Talked</span><b style="color:#00dc86">' + c.talk + '</b></div>'
      + '<div class="wbox"><span class="wlab">Voicemail</span><b style="color:#ffa946">' + c.vm + '</b></div><div class="wbox"><span class="wlab">No answer</span><b>' + c.na + '</b></div><div class="wbox"><span class="wlab">Booked</span><b style="color:#9771f9">' + c.book + '</b></div></div>';
    h += '<div class="wspm"><div class="wnow">';
    if (r) {
      h += '<div class="wlab" style="color:' + l.c + '">Now · ' + (sp.i + 1) + ' of ' + sp.list.length + '</div><div class="wnm" data-who="' + esc(r.id) + '">' + esc(r.name) + '</div><div class="ws">' + esc([whoOf(r), r.city, r.industry].filter(Boolean).join(' · ')) + '</div>'
        + (tel(r.phone) ? '<a class="wtel" href="tel:' + esc(tel(r.phone)) + '">' + esc(String(r.phone).split(/\s*[;/]\s*/)[0]) + '</a>' : (r.email ? '<a class="wtel sm" href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a>' : ''))
        + (r.pain || r.pain_drivers ? '<div class="wl">' + painBar(r.pain) + esc(r.pain_drivers || '') + '</div>' : '')
        + (r.why ? '<div class="wl">' + esc(r.why) + '</div>' : '')
        + '<div class="wkeys">' + KEYS.map(function (k) { return '<button type="button" data-out="' + esc(k[1]) + '"><kbd>' + k[0] + '</kbd>' + esc(k[1] === 'Spoke' ? 'Talked (opens the card)' : k[1]) + '</button>'; }).join('') + '<button type="button" data-out="skip"><kbd>S</kbd>Skip</button><button type="button" data-who="' + esc(r.id) + '">Open the full card</button></div>';
    } else {
      h += '<div class="wnm">Sprint done</div><div class="wl">' + c.n + ' dialled · ' + c.talk + ' talked · ' + c.book + ' booked. Call-backs are in the follow-ups.</div><button type="button" class="wstart" data-sp="again">Another sprint</button>';
    }
    h += '</div><div class="wtiles">' + sp.list.map(function (x, k) {
      var o = sp.res[x.id];
      return '<div class="wtile' + (k === sp.i ? ' cur' : '') + (o ? ' done' : '') + '" data-tile="' + k + '"><b>' + esc(x.name) + '</b><span>' + esc(whoOf(x).split(' · ')[0] || x.city || '') + '</span><i>' + esc(o || (x.pain ? 'Pain ' + x.pain : '')) + '</i></div>';
    }).join('') + '</div>'
      + ((sp.rest || []).length ? '<div class="wnext"><div class="wlh"><b style="color:#aeb6c8">Up next · ' + sp.rest.length + ' more today</b><button type="button" class="wstart" data-sp="next15">Load the next ' + Math.min(15, sp.rest.length) + '</button></div>'
        + sp.rest.map(function (x) { return '<div class="wcard" style="--c:#2a2c35" data-who="' + esc(x.id) + '"><div class="wn"><b>' + esc(x.name) + '</b>' + (x.pain ? '<span class="wpn">Pain ' + esc(x.pain) + '</span>' : '') + '</div><div class="ws">' + esc([whoOf(x), x.city].filter(Boolean).join(' · ')) + '</div></div>'; }).join('') + '</div>' : '')
      + '</div></div>';
    return h;
  }
  function sprintTick() {
    var sp = S.sprint; if (!sp) return;
    clearInterval(sp.timer);
    if (!sp.run) return;
    sp.timer = setInterval(function () {
      if (!sp.run || S.mode !== 'sprint') { clearInterval(sp.timer); return; }
      sp.left -= 1;
      if (sp.left <= 0) { sp.left = 0; sp.run = false; clearInterval(sp.timer); }
      var t = S.host && S.host.querySelector('.wtime');
      if (t) t.textContent = Math.floor(sp.left / 60) + ':' + String(sp.left % 60).padStart(2, '0');
      if (!sp.run) paint();
    }, 1000);
  }
  function sprintLog(out) {
    var sp = S.sprint, r = sp && sp.list[sp.i]; if (!r) return;
    if (out === 'skip') { sp.i += 1; paint(); return; }
    if (out === 'Spoke') {
      sp.run = false; sprintTick();
      if (window.openDossier) window.openDossier(r.id, { channel: 'Call', onSaved: function (rec, o) { if (o) { sp.res[r.id] = o; sp.i += 1; } paint(); } });
      return;
    }
    sp.res[r.id] = out; sp.i += 1; paint();
    var fu = out === 'Call back' ? new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' }) : (out === 'Left voicemail' ? new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' }) : '');
    api('/api/growth', 'POST', { action: 'touch', id: r.id, channel: 'Call', outcome: out, note: '', next_date: fu }).then(function (x) { return x && x.ok ? x.json() : null; }).then(function (res) {
      var stage = out === 'Meeting booked' ? 'Meeting booked' : out === 'Not interested' ? 'Not a fit' : (!r.stage || r.stage === 'Cold' ? 'Contacted' : '');
      if (stage) api('/api/growth', 'PATCH', { id: r.id, stage: stage });
      var tid = res && res.touch && res.touch.id;
      if (S.toast) S.toast(r.name + ' · ' + out, function () { if (tid) api('/api/growth', 'POST', { action: 'undo-touch', touchId: tid }); delete sp.res[r.id]; paint(); });
    });
  }

  function paint() {
    if (!S.host) return;
    var mode = S.mode;
    S.host.hidden = !(mode === 'lanes' || mode === 'blocks' || mode === 'sprint');
    if (S.host.hidden) return;
    if (!S.calls) { S.host.innerHTML = '<div class="wm" style="padding:20px">Loading today’s lists…</div>'; load(false, paint); return; }
    S.host.innerHTML = mode === 'lanes' ? paintLanes() : mode === 'blocks' ? paintBlocks() : paintSprint();
  }
  function startQueue(laneKey, from, n) {
    var rs = inLane(laneOf(laneKey));
    if (from != null) rs = rs.slice(from, from + (n || rs.length));
    if (!rs.length || !window.openDossier) return;
    var ids = rs.map(function (r) { return r.id; });
    window.openDossier(ids[0], { queue: ids, channel: laneKey === 'call' ? 'Call' : laneKey === 'li' ? 'LinkedIn' : null, onSaved: function () { load(true, paint); } });
  }

  PBW.bind = function (root, opts) {
    S.root = root; S.toast = opts && opts.toast; S.open = opts || {};
    var host = root.getElementById ? root.getElementById('pbWork') : null;
    if (!host) return;
    S.host = host;
    if (host._bound) return;
    host._bound = true;
    host.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('a[href]')) return;
      var sp = t.closest('[data-sp]');
      if (sp && sp.tagName !== 'SELECT') {
        var a = sp.getAttribute('data-sp');
        if (a === 'go') { S.sprint.run = true; sprintTick(); paint(); }
        if (a === 'pause') { S.sprint.run = false; sprintTick(); paint(); }
        if (a === 'again' || a === 'next15') {
          var seen = Object.assign({}, S.sprint.done || {});
          S.sprint.list.forEach(function (r) { seen[r.id] = 1; });
          clearInterval(S.sprint.timer); sprintNew(S.sprint.lane, seen); paint();
        }
        return;
      }
      var out = t.closest('[data-out]'); if (out) { sprintLog(out.getAttribute('data-out')); return; }
      var rck = t.closest('[data-rck]'); if (rck) { runCheck(rck.getAttribute('data-rck')); return; }
      var ro = t.closest('[data-rout]'); if (ro) { runLog(ro.getAttribute('data-rid'), ro.getAttribute('data-rout')); return; }
      var rf = t.closest('[data-rf]'); if (rf) { R().flt = rf.getAttribute('data-rf'); R().list = ''; paint(); return; }
      var rl = t.closest('[data-rl]'); if (rl) { var L = rl.getAttribute('data-rl'); R().list = R().list === L ? '' : L; R().flt = 'all'; paint(); return; }
      var rh = t.closest('[data-rhide]'); if (rh) { R().hide = !R().hide; paint(); return; }
      var rm = t.closest('[data-rmore]'); if (rm) { R().more[rm.getAttribute('data-rmore')] = 1; paint(); return; }
      var rt = t.closest('[data-rtodo]'); if (rt && S.open.todo) { S.open.todo(rt.getAttribute('data-rtodo')); return; }
      var rp = t.closest('[data-rplay]'); if (rp && S.open.play) { var pr = runRows().filter(function (x) { return x.id === rp.getAttribute('data-rplay'); })[0]; if (pr) S.open.play(pr.p); return; }
      var tile = t.closest('[data-tile]'); if (tile && S.sprint) { S.sprint.i = +tile.getAttribute('data-tile'); paint(); return; }
      var st = t.closest('[data-start]'); if (st) { startQueue(st.getAttribute('data-start'), st.hasAttribute('data-from') ? +st.getAttribute('data-from') : null, +st.getAttribute('data-n') || 0); return; }
      var who = t.closest('[data-who]');
      if (who && window.openDossier) {
        var lk = who.getAttribute('data-lane');
        var ids = lk ? inLane(laneOf(lk)).map(function (r) { return r.id; }) : null;
        window.openDossier(who.getAttribute('data-who'), { queue: ids, onSaved: function () { load(true, paint); } });
        return;
      }
      var ev = t.closest('[data-ev]'); if (ev && S.open.event) { var e2 = events()[+ev.getAttribute('data-ev')]; if (e2) S.open.event(e2); return; }
      var pl = t.closest('[data-play]'); if (pl && S.open.play) { var p2 = plays()[+pl.getAttribute('data-play')]; if (p2) S.open.play(p2); return; }
      var td = t.closest('[data-todo]'); if (td && S.open.todo) { S.open.todo(td.getAttribute('data-todo')); return; }
    });
    host.addEventListener('change', function (e) {
      if (e.target.matches && e.target.matches('select[data-sp="lane"]')) { if (S.sprint) clearInterval(S.sprint.timer); sprintNew(e.target.value); paint(); }
    });
    document.addEventListener('keydown', function (e) {
      if (S.mode !== 'sprint' || !S.host || S.host.hidden) return;
      if (document.getElementById('dsr') && document.getElementById('dsr').classList.contains('open')) return;
      var tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
      var k = KEYS.filter(function (x) { return x[0] === e.key; })[0];
      if (k) { e.preventDefault(); sprintLog(k[1]); }
      else if (e.key === 's' || e.key === 'S') { e.preventDefault(); sprintLog('skip'); }
    });
  };
  PBW.setMode = function (mode) {
    S.mode = mode;
    if (mode === 'lanes' || mode === 'blocks' || mode === 'sprint') load(false, paint);
    paint();
  };
  PBW.refresh = function () { if (S.mode && S.mode !== 'compact') load(true, paint); };
})();
