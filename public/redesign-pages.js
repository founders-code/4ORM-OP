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
    return { 'To-do': 'todo', Idea: 'idea', Person: 'person', Decision: 'dec' }[t] || '';
  }

  function liveDashboardState() {
    var S = window.STATE || {};
    var days = daysToClose();
    var items = (S.items || []).filter(function (it) { return it.status !== 'dropped'; });
    var open = items.filter(function (it) { return it.status !== 'done'; });
    var overdue = open.filter(function (it) { return typeof bucket === 'function' ? bucket(it) === 'overdue' : false; });
    var mail = (S.mail || []).filter(function (row) { return !row.bulk || (typeof mailIsContact === 'function' && mailIsContact(row)); }).slice(0, 5);
    var linked = (S.linkedin || []).filter(liPerson).sort(function (a, b) { return (Number(b.at) || 0) - (Number(a.at) || 0); }).slice(0, 8);
    var movers = ((S.ceo && S.ceo.moves) || []).slice(0, 3);
    var meetings = (S.events || []).filter(function (ev) { return ev.start >= Date.now() - 60000; }).sort(function (a, b) { return a.start - b.start; }).slice(0, 3);
    var plugs = (S.plugins || []).filter(function (p) { return p.connected || p.on; }).length;
    var queue = S.content || {};
    var kindWord = { message: 'sent you a message', inmail: 'sent you an InMail', invite: 'wants to connect', update: 'posted an update', comment: 'commented on your post', view: 'viewed your profile' };
    function flagOf(row) {
      var blob = ((row.from || '') + ' ' + (row.subject || '')).toLowerCase();
      if (/vc|venture|investor/.test(blob)) return 'vc';
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
    return {
      cash: fin.cashLabel || '$3,180',
      burn: fin.burnLabel || 'see Financials',
      runway: fin.runwayLabel || '~1 day',
      raise: (fin.raise && (fin.raise.inLabel + ' of ' + fin.raise.targetLabel)) || '$80K of $250K',
      daysToClose: days,
      closeWhen: 'Oct 30',
      lamps: [
        { led: 'r', name: 'Runway', st: 'r', word: 'Critical' },
        { led: 'a', name: 'Raise pace', st: 'a', word: 'Behind' },
        { led: 'g', name: 'Pipeline', st: 'g', word: (S.pipeline || []).length ? 'Live' : 'Waiting' },
        { led: 'a', name: 'Spend', st: 'a', word: 'Watch' },
        { led: 'a', name: 'Legal docs', st: 'a', word: 'Open' },
        { led: 'r', name: 'Concentration', st: 'r', word: 'High' },
        { led: 'g', name: 'Integrations', st: 'g', word: (plugs || '-') + ' live' }
      ],
      alerts: alerts,
      cheques: (fin.cheques && fin.cheques.length) ? fin.cheques.map(function (c) {
        return { cls: c.state === 'in' ? 'in' : c.state === 'pend' ? 'pd' : 'op', label: c.label };
      }) : [{ cls: 'op', label: '-' }, { cls: 'op', label: '-' }, { cls: 'op', label: '-' }, { cls: 'op', label: '-' }, { cls: 'op', label: '-' }, { cls: 'op', label: '-' }, { cls: 'op', label: '-' }],
      toGo: (fin.raise && fin.raise.toGoLabel) || '$170K',
      bookedWeek: '$0',
      paceNote: 'Behind pace — widen the round today.',
      worries: [
        { tone: 'r', title: 'Concentration.', body: 'One friends-and-family track — one delayed cheque is the whole pace.' },
        { tone: 'r', title: 'About a day of runway.', body: 'A cheque has to land before the desk goes dark.' },
        { tone: 'a', title: 'Unsigned docs + short runway.', body: 'That pairing is what stalls a close.' }
      ],
      linkedin: linked.map(function (row) {
        return { name: row.name, action: kindWord[row.kind] || 'update', snippet: row.snippet || '', age: ageLabel(row.at) };
      }),
      inbox: mail.map(function (m) {
        return { from: m.from || m.email || 'Sender', color: '#2e6bf2', flag: flagOf(m), subject: m.subject || '(no subject)', preview: m.snippet || '', age: ageLabel(m.at) };
      }),
      meetings: meetings.map(function (ev, i) {
        return { when: soon(ev.start), title: ev.title || 'Meeting', kind: i === 0 ? 'join' : 'bell' };
      }),
      moves: movers.map(function (move) {
        var zone = String(move.zone || move.area || 'Raise');
        var zc = /partner/i.test(zone) ? 'z3' : /cash|runway/i.test(zone) ? 'z1' : 'z2';
        return { title: move.title || move.text || move.name || '', why: move.whyNow || move.why || '', zone: zc, zoneLabel: zone };
      }),
      health: {
        score: 36, dash: '108.6 301.6',
        bars: [
          { name: 'Cash', pct: 12, color: 'var(--red)', n: 12 },
          { name: 'Raise', pct: 34, color: 'var(--amber)', n: 34 },
          { name: 'Pipeline', pct: 72, color: 'var(--green)', n: 72 },
          { name: 'Product', pct: 30, color: 'var(--amber)', n: 30 },
          { name: 'Legal', pct: 40, color: 'var(--amber)', n: 40 }
        ]
      },
      momentum: {
        bars: [{ h: 28, day: 'Tue' }, { h: 40, day: 'Wed' }, { h: 22, day: 'Thu' }, { h: 52, day: 'Fri' }, { h: 36, day: 'Sat' }, { h: 58, day: 'Sun' }, { h: 70, day: 'Mon', now: true }],
        desk: open.length, done: '-', overdue: overdue.length, blocked: '-'
      },
      content: {
        queued: typeof queue.left === 'number' ? queue.left : '-',
        queuedNote: 'posts queued',
        barPct: 4,
        cadence: queue.cadence != null ? queue.cadence + ' a day' : '-',
        newsletter: queue.newsletterDue || '-',
        nextClip: '-'
      }
    };
  }

  function liveWarState() {
    var S = window.STATE || {};
    var days = daysToClose();
    var fin = S.finance || {};
    var moves = ((S.ceo && S.ceo.moves) || []).filter(function (m) { return m.title || m.text || m.name; }).slice(0, 3);
    var actions = (S.meetingActions || []).filter(function (row) { return row.status !== 'done' && row.status !== 'tasked'; }).slice(0, 5);
    var meetings = (S.events || []).filter(function (ev) { return ev.start >= Date.now() - 60000; }).sort(function (a, b) { return a.start - b.start; }).slice(0, 2);
    function colItems(key) {
      return (S.items || []).filter(function (it) {
        if (it.status === 'done' || it.status === 'dropped') return false;
        var b = typeof bucket === 'function' ? bucket(it) : 'later';
        if (key === 'today') return b === 'today' || b === 'overdue';
        if (key === 'week') return b === 'week';
        return b === 'later';
      });
    }
    function pack(key) {
      var all = colItems(key);
      return { count: all.length, more: Math.max(0, all.length - 5), tasks: all.slice(0, 5).map(function (it) { return { title: verbTitle(it), tag: it.area || 'Ops' }; }) };
    }
    var heroMove = moves[0] || {};
    return {
      cash: fin.cashLabel || '$3,180',
      runway: fin.runwayLabel || '~1 day',
      raise: (fin.raise && (fin.raise.inLabel + ' of ' + fin.raise.targetLabel)) || '$80K of $250K',
      daysToClose: days,
      launch: 'Oct 23',
      momentumHours: '13h open today',
      coach: "Regulators can wait. Don't let them take a cash-first morning — drop them or give them 10 minutes, then back to the one thing.",
      streak: 'Focus streak · start today',
      hero: { title: heroMove.title || heroMove.text || heroMove.name || 'Pick today’s one move', why: heroMove.whyNow || heroMove.why || '' },
      moves: moves.map(function (m, i) {
        var zone = String(m.zone || m.area || 'Raise');
        var zc = /cash|runway/i.test(zone) ? 'z-cash' : /partner/i.test(zone) ? 'z-part' : /reg/i.test(zone) ? 'z-reg' : 'z-raise';
        return { title: m.title || m.text || m.name || '', zone: zc, zoneLabel: zone, one: i === 0, why: m.whyNow || m.why || '', src: m.source || '' };
      }),
      meetingActions: actions.map(function (row) {
        return { tag: /said|you/i.test(row.kind || row.tag || '') ? 't-you' : 't-fu', tagLabel: /said|you/i.test(row.kind || row.tag || '') ? 'You said' : 'Follow up', text: row.text || '', from: (row.meetingTitle || 'Meeting') + (row.meetingDate ? ' · ' + row.meetingDate : '') };
      }),
      meetingActionTotal: (S.meetingActions || []).length,
      nextUp: meetings.map(function (ev, i) {
        return { when: soon(ev.start), title: ev.title || 'Meeting', link: i === 0 ? 'Join' : 'Prep' };
      }),
      reachChips: ['All 0'],
      reach: [],
      today: pack('today'),
      week: pack('week'),
      later: pack('later')
    };
  }

  function liveNotesState() {
    var S = window.STATE || {};
    var rows = (S.notes || []).map(function (n) {
      return {
        color: colorClass(n.color), type: n.kind || n.type || 'Note', typeCls: typeCls(n.kind || n.type),
        title: n.title || '', body: n.body || '', pin: !!n.pin,
        checks: (n.checks || n.todos || []).map(function (c) { return { done: !!(c.done || c.checked), text: c.text || c.title || '' }; }),
        links: n.links || [], reminder: n.reminder || '', convert: n.convert || 'Convert to task'
      };
    });
    var pinned = rows.filter(function (n) { return n.pin; });
    var rest = rows.filter(function (n) { return !n.pin; });
    function count(pred) { return rows.filter(pred).length; }
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
      + '<div class="g2"><section class="card"><div class="ch"><h3>Inbox &mdash; needs you</h3><div class="tabs"><span class="on">People only</span><span>All mail</span></div><span class="s">' + inbox.length + ' waiting</span></div><div id="mail">' + mailHtml + '</div><div class="foot">Bulk and notification mail is filed in Email &rarr; Quiet. <span class="lnk">Open Email</span></div></section>'
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
})();
