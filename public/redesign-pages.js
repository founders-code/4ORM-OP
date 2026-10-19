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
    + '.port-body{display:block;min-width:0}';
  var CSS = { room: '/port-css/dashboard.css', war: '/port-css/war-room.css', notes: '/port-css/notes.css' };
  var cssText = {};
  var cssWait = [];
  var BELL = '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>';
  var EYE = '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var FL = { vc: 'Investor', dp: 'Design partner', rg: 'Regulator' };

  function fixtureOn() {
    try { return /(?:^|[?&])fixture=mockup(?:&|$)/.test(String(location.search || '')); } catch (e) { return false; }
  }

  window.ShadowPage = function (hostId, pageKey) {
    var host = document.getElementById(hostId);
    if (!host) return null;
    if (host.shadowRoot) return host.shadowRoot;
    var root = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = TOKEN + (cssText[pageKey] || '');
    root.appendChild(style);
    var wrap = document.createElement('div');
    wrap.className = 'port-body';
    root.appendChild(wrap);
    return root;
  };

  function wrapOf(hostId) {
    var key = hostId === 'opsDash' ? 'room' : hostId === 'warDesk' ? 'war' : 'notes';
    var root = window.ShadowPage(hostId, key);
    if (!root) return null;
    var style = root.querySelector('style');
    if (style && cssText[key] && style.textContent.indexOf(cssText[key]) < 0) style.textContent = TOKEN + cssText[key];
    return root.querySelector('.port-body') || root;
  }

  function whenCss(fn) {
    if (cssText.room && cssText.war && cssText.notes) fn();
    else cssWait.push(fn);
  }
  Object.keys(CSS).forEach(function (key) {
    fetch(CSS[key]).then(function (r) { return r.text(); }).then(function (t) {
      cssText[key] = t;
      if (cssText.room && cssText.war && cssText.notes) {
        var q = cssWait.splice(0);
        q.forEach(function (fn) { fn(); });
      }
    }).catch(function () {
      cssText[key] = cssText[key] || '';
      if (Object.keys(CSS).every(function (k) { return cssText[k] != null; })) {
        var q = cssWait.splice(0);
        q.forEach(function (fn) { fn(); });
      }
    });
  });

  function markReady(hostId) {
    var host = document.getElementById(hostId);
    if (host) host.setAttribute('data-port-ready', '1');
  }
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
    if (row.kind === 'update' && /^linkedin$/i.test(name)) return false;
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
    return [];
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
        kind: row.kind || row.type || 'update',
        snippet: row.snippet || row.preview || row.subject || '',
        at: Number(row.at || row.date) || 0,
        unread: !!row.unread
      };
    }).filter(function (row) { return row.name && !/^linkedin$/i.test(row.name); });
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
    return {
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
      meetingActions: asList(S.meetingActions).length, reachOut: asList(S.reachOut).length,
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
    var lamps = ceoLamps.length ? ceoLamps.map(function (l) {
      var led = lampLed(l.state);
      return { led: led, name: l.label || l.name || l.key || 'Lamp', st: led, word: l.word || l.state || '' };
    }) : [
      { led: 'r', name: 'Runway', st: 'r', word: 'Critical' },
      { led: 'a', name: 'Raise pace', st: 'a', word: 'Behind' },
      { led: 'g', name: 'Pipeline', st: 'g', word: asList(S.pipeline).length ? 'Live' : 'Waiting' },
      { led: 'a', name: 'Spend', st: 'a', word: 'Watch' },
      { led: 'a', name: 'Legal docs', st: 'a', word: 'Open' },
      { led: 'r', name: 'Concentration', st: 'r', word: 'High' },
      { led: 'g', name: 'Integrations', st: 'g', word: (plugs || 0) + ' live' }
    ];
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
        return { name: row.name, action: kindWord[row.kind] || 'update', snippet: row.snippet, age: ageLabel(row.at) };
      }),
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
        return { when: soon(ev.start), title: ev.title, kind: (i === 0 || ev.join) ? 'join' : 'bell' };
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
    var actions = asList(S.meetingActions).filter(function (row) { return row.status !== 'done' && row.status !== 'tasked'; });
    var meetings = upcomingEvents().slice(0, 2);
    function colItems(key) {
      return asList(S.items).filter(function (it) {
        if (it.status === 'done' || it.status === 'dropped') return false;
        var b = itemBucket(it);
        if (key === 'today') return b === 'today' || b === 'overdue';
        if (key === 'week') return b === 'week';
        return b === 'later';
      });
    }
    function pack(key) {
      var all = colItems(key);
      return { count: all.length, more: Math.max(0, all.length - 5), tasks: all.slice(0, 5).map(function (it) {
        return { title: verbTitle(it), tag: it.category || it.area || 'Ops' };
      }) };
    }
    var heroMove = moves[0] || {};
    var people = asList(S.reachOut);
    var kinds = [['all', 'All'], ['vc', 'VC'], ['design', 'Design partner'], ['regulator', 'Regulator'], ['corporate', 'Corporate'], ['client', 'Client']];
    var reachChips = kinds.map(function (pair) {
      var n = people.filter(function (p) { return pair[0] === 'all' || p.kind === pair[0]; }).length;
      return pair[1] + ' ' + n;
    });
    var reachNames = { vc: 'VC', design: 'Design partner', regulator: 'Regulator', corporate: 'Corporate', client: 'Client' };
    liveLog('war', { moveOut: moves.length, actOut: actions.length, meetOut: meetings.length, reachOut: people.length, today: colItems('today').length, week: colItems('week').length, later: colItems('later').length });
    return {
      cash: fin.cashLabel || '$3,180',
      runway: fin.runwayLabel || '~1 day',
      raise: (raise.inLabel && raise.targetLabel) ? (raise.inLabel + ' of ' + raise.targetLabel) : '$80K of $250K',
      daysToClose: days,
      launch: 'Oct 23',
      momentumHours: (function () {
        var busy = 0;
        asList(S.events).forEach(function (ev) {
          if (Math.abs(eventStart(ev) - Date.now()) > 16 * 3600000) return;
          busy += Number(ev.dur) || 30;
        });
        return Math.max(0, Math.round((15 * 60 - busy) / 60)) + 'h open today';
      }()),
      coach: "Regulators can wait. Don't let them take a cash-first morning — drop them or give them 10 minutes, then back to the one thing.",
      streak: 'Focus streak · start today',
      hero: { title: moveText(heroMove) || 'Pick today’s one move', why: moveWhy(heroMove) },
      moves: moves.map(function (m, i) {
        var zone = String(m.zone || m.area || 'Raise');
        var zc = /cash|runway/i.test(zone) ? 'z-cash' : /partner/i.test(zone) ? 'z-part' : /reg/i.test(zone) ? 'z-reg' : 'z-raise';
        return { title: moveText(m), zone: zc, zoneLabel: zone, one: i === 0, why: moveWhy(m), src: m.source || m.sourceLine || m.source_line || '' };
      }),
      meetingActions: actions.slice(0, 5).map(function (row) {
        var you = String(row.kind || row.tag || '') === 'you_said' || /said|you/i.test(String(row.kind || row.tag || ''));
        return { tag: you ? 't-you' : 't-fu', tagLabel: you ? 'You said' : 'Follow up', text: row.text || row.body || '', from: (row.meetingTitle || row.meeting_title || 'Meeting') + (row.meetingDate || row.meeting_date ? ' · ' + (row.meetingDate || row.meeting_date) : '') };
      }),
      meetingActionTotal: actions.length,
      nextUp: meetings.map(function (ev, i) {
        return { when: soon(ev.start), title: ev.title, link: (i === 0 || ev.join) ? 'Join' : 'Prep' };
      }),
      reachChips: reachChips,
      reach: people.filter(function (p) { return !p.done; }).slice(0, 8).map(function (p) {
        var bits = [reachNames[p.kind] || p.kind || 'Corporate', p.company, p.nextAction || p.next_action].filter(Boolean);
        return { name: p.name || 'Person', meta: bits.join(' · ') };
      }),
      today: pack('today'),
      week: pack('week'),
      later: pack('later')
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
      return '<div class="li2"><span class="in">in</span><div class="t"><div class="l1"><b>' + esc(row.name) + '</b> <span>' + esc(row.action) + '</span></div><div class="l2">' + esc(row.snippet) + '</div></div><span class="age">' + esc(row.age) + '</span><span class="lnk">Open &rsaquo;</span></div>';
    }).join('') : '<div class="li2"><div class="t"><div class="l1">No people waiting on LinkedIn</div><div class="l2">System notices stay hidden.</div></div></div>';
    var mailHtml = inbox.length ? inbox.map(function (m) {
      var av = m.from.split(' ').map(function (x) { return x[0]; }).join('').slice(0, 2);
      return '<div class="mail"><span class="av" style="background:' + esc(m.color || '#2e6bf2') + '">' + esc(av) + '</span><div style="min-width:0"><div class="mn"><span>' + esc(m.from) + '</span>' + (m.flag ? '<em class="flag ' + m.flag + '" style="font-style:normal">' + FL[m.flag] + '</em>' : '') + '</div><div class="ms">' + esc(m.subject) + '</div><div class="mp">' + esc(m.preview) + '</div></div><div class="mr"><span class="age">' + esc(m.age) + '</span><button class="rb">Reply</button><button class="more" title="More: not a person, snooze, file">&middot;&middot;&middot;</button></div></div>';
    }).join('') : '<div class="mail"><div class="mp">No person-to-person mail waiting.</div></div>';
    var meetHtml = meetings.length ? meetings.map(function (ev) {
      var trail = ev.kind === 'join' ? '<span class="join">Join</span>' : '<span class="bell"' + (ev.kind === 'bell-on' ? ' title="Alarm on"' : '') + '>' + BELL + '</span>';
      return '<div class="meet"><span class="tm">' + esc(ev.when) + '</span><span class="nm">' + esc(ev.title) + '</span>' + trail + '</div>';
    }).join('') : '<div class="meet"><span class="nm">No meetings on the calendar.</span></div>';
    var mvHtml = moves.length ? moves.map(function (move, i) {
      return '<div class="mv"><span class="k">' + (i + 1) + '</span><div class="t">' + esc(move.title) + '<small>' + esc(move.why) + '</small></div><span class="zone ' + move.zone + '">' + esc(move.zoneLabel) + '</span></div>';
    }).join('') : '<div class="mv"><div class="t">No ranked move yet<small>The War Room one-thing fills this.</small></div></div>';
    var health = data.health || { score: '-', dash: '0 301.6', bars: [] };
    var mom = data.momentum || { bars: [], desk: '-', done: '-', overdue: '-', blocked: '-' };
    var content = data.content || {};
    var peopleTab = fixtureOn() ? true : peopleInboxOn();
    wrap.innerHTML =
      '<section class="cmd"><div class="cmdtop">'
      + '<div class="vit"><div class="k">Cash</div><div class="v"><span class="mask" data-real="' + esc(data.cash) + '">' + mask(data.cash) + '</span></div><div class="sub">in the bank</div></div>'
      + '<div class="vit"><div class="k">Burn</div><div class="v"><span class="mask" data-real="' + esc(data.burn) + '">' + mask(data.burn) + '</span></div><div class="sub">per month</div></div>'
      + '<div class="vit"><div class="k">Runway</div><div class="v red">' + esc(data.runway) + '</div><div class="sub">at this cash</div></div>'
      + '<div class="vit"><div class="k">Raise &middot; friends &amp; family</div><div class="v"><span class="mask" data-real="' + esc(data.raise) + '">' + mask(data.raise) + '</span><button class="eye" id="eye" title="Show figures">' + EYE + '</button></div><div class="raisebar"><i></i></div></div>'
      + '<div class="count"><div class="big">' + esc(data.daysToClose) + ' days</div><div class="k">to close &middot; ' + esc(data.closeWhen) + '</div></div></div>'
      + '<div class="lamps">' + (data.lamps || []).map(function (l) {
        return '<div class="lamp"><span class="led ' + l.led + '"></span><span class="nm">' + esc(l.name) + '</span><span class="st ' + l.st + '">' + esc(l.word) + '</span></div>';
      }).join('') + '</div></section>'
      + '<div class="g3"><section class="card"><div class="ch"><h3>What needs you now</h3><span class="s">across the desk</span></div>'
      + (data.alerts || []).map(function (n) {
        return '<div class="row"><span class="sev ' + n.sev + '"></span><div class="rt">' + esc(n.text) + '<small>' + esc(n.area) + '</small></div><span class="lnk">Open</span></div>';
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
      + '<section class="card" style="margin-bottom:16px"><div class="ch"><h3>LinkedIn</h3><span class="s">' + linked.length + ' new &middot; people only, system notices hidden</span><span class="lnk" style="margin-left:14px">Open LinkedIn</span></div><div class="ligrid">' + linkedHtml + '</div></section>'
      + '<div class="g2"><section class="card"><div class="ch"><h3>Inbox &mdash; needs you</h3><div class="tabs"><span' + (peopleTab ? ' class="on"' : '') + '>People only</span><span' + (peopleTab ? '' : ' class="on"') + '>All mail</span></div><span class="s">' + inbox.length + ' waiting</span></div><div id="mail">' + mailHtml + '</div><div class="foot">Bulk and notification mail is filed in Email &rarr; Quiet. <span class="lnk">Open Email</span></div></section>'
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
    var root = wrap.getRootNode();
    var eye = root.getElementById && root.getElementById('eye');
    if (eye) eye.onclick = function () {
      try { localStorage.setItem('cr_show_money', moneyOn() ? '0' : '1'); } catch (e) {}
      paintDashboardLive();
    };
    root.querySelectorAll('.rb').forEach(function (b, ix) {
      b.onclick = function () {
        var t = root.getElementById('toast');
        if (!t) return;
        t.textContent = 'Opens the reply drafted in your voice';
        t.classList.add('show');
        setTimeout(function () { t.classList.remove('show'); }, 1500);
        if (!fixtureOn() && typeof openReply === 'function') openReply(inbox[ix]);
      };
    });
    root.querySelectorAll('.lnk').forEach(function (el) {
      if (el.textContent === 'Open Email') el.onclick = function () { if (typeof switchView === 'function') switchView('mail'); };
    });
    root.querySelectorAll('.tabs span').forEach(function (el, i) {
      el.onclick = function () {
        try { localStorage.setItem('cr_inbox_people', i === 0 ? '1' : '0'); } catch (e) {}
        paintDashboardLive();
      };
    });
    markReady('opsDash');
  }

  function execCol(label, col, btns) {
    var tasks = (col && col.tasks) || [];
    var body = tasks.length ? tasks.map(function (it) {
      return '<div class="task"><span class="cb"></span><div><div class="tt">' + esc(it.title) + '</div><div class="tg">' + esc(it.tag) + '</div></div><div class="hv">' + btns + '</div></div>';
    }).join('') : '<div class="empty">Nothing set for this ' + (label === 'Today' ? 'column' : label === 'This week' ? 'week' : 'column') + '.<br>Drag a task here or press +.</div>';
    if (label === 'This week' && !tasks.length) body = '<div class="empty">Nothing set for this week.<br>Drag a task here or press +.</div>';
    var more = col && col.more ? '<div class="more2">+ ' + col.more + ' more</div>' : '';
    return '<div class="col"><div class="colh"><b>' + label + '</b><span class="c">' + ((col && col.count) || 0) + '</span><button class="plus">+</button></div>' + body + more + '</div>';
  }

  function paintWarLive() {
    var wrap = wrapOf('warDesk');
    if (!wrap) return;
    var data = warData();
    var moves = data.moves || [];
    wrap.innerHTML =
      '<section class="ribbon">'
      + '<div class="rv"><div class="k">Cash</div><div class="v">' + mask(data.cash) + '</div></div>'
      + '<div class="rv"><div class="k">Runway</div><div class="v red">' + esc(data.runway) + '</div></div>'
      + '<div class="rv"><div class="k">Raise &middot; F&amp;F</div><div class="v">' + mask(data.raise) + '</div></div>'
      + '<div class="rv"><div class="k">To close Oct 30</div><div class="v">' + esc(data.daysToClose) + ' days</div></div>'
      + '<div class="rv"><div class="k">4ormIQ launch</div><div class="v gold">' + esc(data.launch) + '</div></div>'
      + '<div class="rv mom2"><div class="k">Momentum &middot; this week</div><div class="mb"><i></i><i></i><i></i><i></i><i class="now"></i><span>' + esc(data.momentumHours) + '</span></div></div>'
      + '<span class="sp"></span>'
      + '<div class="cwrap"><button class="coachbtn" id="coachbtn">&#128161; Coaching note</button>'
      + '<div class="coachpop" id="coachpop"><b>Coaching note</b><p>' + esc(data.coach) + '</p></div></div>'
      + '<span class="streak">' + esc(data.streak) + '</span>'
      + '<button class="vb">Show $</button></section>'
      + '<div class="capture"><input placeholder="Capture a task or an idea to park it, so you don\'t lose focus"><button>Add</button></div>'
      + '<div class="wrow"><section class="hero"><div class="htop"><div>'
      + '<div class="hl">Today\'s one move</div><h2>' + esc(data.hero && data.hero.title) + '</h2>'
      + '<div class="why">' + esc(data.hero && data.hero.why) + '</div></div>'
      + '<div class="ring"><svg viewBox="0 0 112 112"><circle cx="56" cy="56" r="48" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="8"/><circle cx="56" cy="56" r="48" fill="none" stroke="#5b8cff" stroke-width="8" stroke-dasharray="301.6" stroke-dashoffset="0" stroke-linecap="round" transform="rotate(-90 56 56)"/></svg><div><div><b>25:00</b><span>focus</span></div></div></div></div>'
      + '<div class="hbtns"><button class="hb1 go">&#9654; Start 25-min focus</button><button class="hb1">Commit as my one thing</button><button class="hb2">Plan</button><button class="hb2">Cancel this move</button></div>'
      + '<div class="moves"><div class="mh"><h3>4orm Intelligence &middot; CEO ranked moves</h3><span class="s">rebuilt 6:30 am</span><button class="rr">&#8635; Re-run</button></div>'
      + moves.map(function (m, i) {
        return '<div class="mv2' + (m.one ? ' one' : '') + '"><span class="rk">' + (i + 1) + '</span><div><div class="mt">' + esc(m.title) + ' <span class="zn ' + m.zone + '">' + esc(m.zoneLabel) + '</span>' + (m.one ? '<span class="yo">Your one move</span>' : '') + '</div><div class="ms2">' + esc(m.why) + '</div><div class="src">' + esc(m.src) + '</div></div><div class="ma"><button class="do">Do</button><button>Steps</button><button>Plan</button><button class="x"' + (m.one ? ' title="Dismiss - the next move takes its place"' : '') + '>&times;</button></div></div>';
      }).join('') + '</div></section>'
      + '<div class="rstack"><section class="card"><div class="ch"><h3>After your meetings &mdash; what you owe</h3><span class="s">from Zoom + Granola</span></div>'
      + (data.meetingActions || []).map(function (row) {
        return '<div class="mo"><span class="tag ' + row.tag + '">' + esc(row.tagLabel) + '</span><div style="min-width:0"><div class="tt">' + esc(row.text) + '</div><div class="mf">' + esc(row.from) + '</div></div><div class="ad"><button>+ Today</button><button>+ Week</button></div></div>';
      }).join('')
      + '<div class="foot"><span class="lnk">Review all ' + esc(data.meetingActionTotal) + ' meeting action items &rsaquo;</span></div></section>'
      + '<section class="card"><div class="ch"><h3>Next up</h3><span class="s">alarms on</span></div>'
      + (data.nextUp || []).map(function (ev) {
        return '<div class="nx"><span class="tm">' + esc(ev.when) + '</span><span class="nm">' + esc(ev.title) + '</span><span class="lnk">' + esc(ev.link) + '</span></div>';
      }).join('')
      + '<button class="slot">Find a 30-min slot</button></section></div></div>'
      + '<section class="card" style="margin-bottom:16px"><div class="ch"><h3>Reach out</h3><span class="s">people to contact &middot; check off when done</span><span class="lnk" style="margin-left:14px">+ Add from Pipeline or Contacts</span></div>'
      + '<div class="chips">' + (data.reachChips || []).map(function (c, i) {
        return '<button class="chip' + (i === 0 ? ' on' : '') + '">' + esc(c) + '</button>';
      }).join('') + '</div>'
      + '<div class="ro">' + (data.reach || []).map(function (p) {
        return '<div class="rc"><span class="cb"></span><div><b>' + esc(p.name) + '</b><span>' + esc(p.meta) + '</span></div></div>';
      }).join('') + '</div></section>'
      + '<section class="card exec"><div class="ch"><h3>Execution</h3><span class="s">drag between columns &middot; hover a task for Today / Week / Later</span><span class="lnk" style="margin-left:14px">&#8599; Full screen</span></div><div class="cols">'
      + execCol('Today', data.today, '<button>Week</button><button>Later</button><button>&times;</button>')
      + execCol('This week', data.week, '<button>Today</button><button>Later</button><button>&times;</button>')
      + execCol('Later', data.later, '<button>Today</button><button>Week</button><button>&times;</button>')
      + '</div></section><div class="toast" id="toast"></div>';
    var root = wrap.getRootNode();
    var btn = root.getElementById && root.getElementById('coachbtn');
    var pop = root.getElementById && root.getElementById('coachpop');
    if (btn && pop) {
      btn.onclick = function (e) { e.stopPropagation(); pop.classList.toggle('open'); };
      document.addEventListener('click', function () { pop.classList.remove('open'); });
    }
    var vb = root.querySelector('.vb');
    if (vb) vb.onclick = function () {
      try { localStorage.setItem('cr_show_money', moneyOn() ? '0' : '1'); } catch (e) {}
      paintWarLive();
    };
    markReady('warDesk');
  }

  function noteCard(n) {
    var ty = 'ty' + (n.typeCls ? ' ' + n.typeCls : '');
    var pin = n.pin ? '<span class="pin">&#128204;</span><span class="nx">&times;</span>' : '<span class="nx" style="margin-left:auto">&times;</span>';
    var title = n.title ? '<h4>' + esc(n.title) + '</h4>' : '';
    var body = n.body ? '<p>' + esc(n.body) + '</p>' : '';
    var checks = (n.checks || []).map(function (c) {
      return '<div class="ck' + (c.done ? ' done' : '') + '"><i>' + (c.done ? '&#10003;' : '') + '</i>' + esc(c.text) + '</div>';
    }).join('');
    var metaBits = (n.links || []).map(function (l) {
      return '<span class="mc link">&#128279; ' + esc(l) + '</span>';
    });
    if (n.reminder) metaBits.push('<span class="mc rem">&#9200; ' + esc(n.reminder) + '</span>');
    var meta = metaBits.length ? '<div class="meta">' + metaBits.join('') + '</div>' : '';
    return '<div class="note ' + n.color + '"><div class="nh"><span class="' + ty + '">' + esc(n.type) + '</span>' + pin + '</div>'
      + title + body + checks + meta
      + '<div class="na"><span class="conv">&#10022; ' + esc(n.convert) + '</span><span class="sp"></span><span class="ic">&#9998;</span><span class="ic">&#8943;</span></div></div>';
  }

  function paintNotesLive() {
    var wrap = wrapOf('notesDesk');
    if (!wrap) return;
    var data = notesData();
    var c = data.counts || {};
    wrap.innerHTML =
      '<div class="bar"><h1>Notes</h1><span class="sub">Capture fast, sort later &mdash; every note can become a task, content or a Space</span>'
      + '<div class="r"><button class="btn">Tidy up</button><button class="btn">&#8599; Full screen</button><button class="btn pri">+ New note</button></div></div>'
      + '<div class="tools"><input class="search" placeholder="Search notes, people, Spaces">'
      + '<button class="chip on">All <i>' + esc(c.all) + '</i></button><button class="chip">&#9733; Pinned <i>' + esc(c.pinned) + '</i></button>'
      + '<button class="chip">To-do <i>' + esc(c.todo) + '</i></button><button class="chip">Idea <i>' + esc(c.idea) + '</i></button>'
      + '<button class="chip">Person <i>' + esc(c.person) + '</i></button><button class="chip">Decision <i>' + esc(c.decision) + '</i></button>'
      + '<button class="chip">Archive</button>'
      + '<div class="cols" title="Filter by colour"><span class="cdot y" style="background:#fff6c9"></span><span class="cdot" style="background:#ffe1ea"></span><span class="cdot" style="background:#ddf5e6"></span><span class="cdot" style="background:#e1ecff"></span><span class="cdot" style="background:#ffe6cf"></span><span class="cdot" style="background:#ece4ff"></span></div>'
      + '<div class="seg"><span class="on">Board</span><span>Canvas</span></div></div>'
      + '<div class="sec">&#9733; Pinned</div><div class="board" style="margin-bottom:6px">'
      + (data.pinned || []).map(noteCard).join('') + '<div class="newcard">+ Pin a note here</div></div>'
      + '<div class="sec">All notes</div><div class="board">'
      + (data.notes || []).map(noteCard).join('') + '</div>'
      + '<div class="toast" id="toast"></div>';
    var root = wrap.getRootNode();
    root.querySelectorAll('.ck').forEach(function (el) {
      el.onclick = function () {
        el.classList.toggle('done');
        var i = el.querySelector('i');
        if (i) i.innerHTML = el.classList.contains('done') ? '&#10003;' : '';
      };
    });
    markReady('notesDesk');
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
  whenCss(function () {
    try {
      var path = String(location.pathname || '');
      var notesView = /\/notes\/?$/.test(path) || /(?:^|[?&])view=notes(?:&|$)/.test(String(location.search || ''));
      if (!notesView) return;
      var vn = document.getElementById('v-notes');
      if (vn) vn.hidden = false;
      paintNotesLive();
    } catch (e) {}
  });
})();
