(function () {
  var TOKEN = ':host,:root{--ground:#0b1430;--ground2:#13224a;--side:#08102a;--card:#fff;--ink:#101a33;--ink2:#4a5672;--ink3:#7a86a0;--line:#e8ecf3;--soft:#f5f7fb;--blue:#2e6bf2;--blue50:#eaf1fe;--green:#12a36a;--green50:#e4f6ee;--amber:#c98408;--amber50:#fff4e0;--red:#e0364f;--red50:#fde9ec;--violet:#6b4fd8;font-family:Inter,-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",system-ui,sans-serif}'
    + '*{box-sizing:border-box}'
    + ':host{display:block;min-width:0;color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",system-ui,sans-serif}'
    + 'button{font:inherit;cursor:pointer}'
    + '.card{background:var(--card);border-radius:16px;box-shadow:0 10px 30px rgba(3,10,30,.22);min-width:0}'
    + '.ch{display:flex;align-items:center;gap:8px;padding:14px 16px 10px}'
    + '.ch h3{margin:0;font-size:14px;font-weight:800}'
    + '.ch .s{margin-left:auto;font-size:12px;color:var(--ink3);font-weight:600;white-space:nowrap}'
    + '.lnk{color:var(--blue);font-weight:700;font-size:12.5px;white-space:nowrap;cursor:pointer}'
    + '.foot{padding:10px 16px 14px;font-size:12.5px;color:var(--ink3);border-top:1px solid var(--line)}';
  var CSS = { room: '/port-css/dashboard.css', war: '/port-css/war-room.css', notes: '/port-css/notes.css' };
  var MAIN = { room: '/port-fixtures/01-dashboard-main.html', war: '/port-fixtures/02-war-room-main.html', notes: '/port-fixtures/03-notes-main.html' };
  var cache = {};

  function fixtureOn() {
    try { return /(?:^|[?&])fixture=mockup(?:&|$)/.test(String(location.search || '')); } catch (e) { return false; }
  }

  window.ShadowPage = function (hostId, cssHref) {
    var host = document.getElementById(hostId);
    if (!host) return null;
    if (host.shadowRoot) return host.shadowRoot;
    var root = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = TOKEN;
    root.appendChild(style);
    if (cssHref) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssHref;
      root.appendChild(link);
    }
    var wrap = document.createElement('div');
    wrap.className = 'port-body';
    root.appendChild(wrap);
    return root;
  };

  function wrapOf(hostId) {
    var root = window.ShadowPage(hostId, CSS[hostId === 'opsDash' ? 'room' : hostId === 'warDesk' ? 'war' : 'notes']);
    if (!root) return null;
    return root.querySelector('.port-body') || root;
  }

  function loadMain(key, cb) {
    if (cache[key]) { cb(cache[key]); return; }
    fetch(MAIN[key]).then(function (r) { return r.text(); }).then(function (html) {
      cache[key] = html;
      cb(html);
    }).catch(function () { cb(''); });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function moneyOn() {
    try { return localStorage.getItem('cr_show_money') === '1'; } catch (e) { return false; }
  }
  function cash(raw) { return moneyOn() ? raw : '$••••'; }
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

  function paintFixture(hostId, key) {
    var wrap = wrapOf(hostId);
    if (!wrap) return;
    loadMain(key, function (html) {
      wrap.innerHTML = html;
      var root = wrap.getRootNode();
      bindSample(root, key);
    });
  }

  function bindSample(root, key) {
    if (key === 'room') {
      var shown = false;
      var eye = root.getElementById && root.getElementById('eye');
      if (eye) eye.onclick = function () {
        shown = !shown;
        root.querySelectorAll('.mask').forEach(function (e) {
          if (!e.dataset.hide) e.dataset.hide = e.innerHTML;
          e.innerHTML = shown ? e.dataset.real : e.dataset.hide;
        });
      };
    }
    if (key === 'war') {
      var btn = root.getElementById && root.getElementById('coachbtn');
      var pop = root.getElementById && root.getElementById('coachpop');
      if (btn && pop) {
        btn.onclick = function (e) { e.stopPropagation(); pop.classList.toggle('open'); };
        document.addEventListener('click', function () { pop.classList.remove('open'); });
      }
    }
    if (key === 'notes') {
      root.querySelectorAll('.ck').forEach(function (c) {
        c.onclick = function () { c.classList.toggle('done'); var i = c.querySelector('i'); if (i) i.innerHTML = c.classList.contains('done') ? '&#10003;' : ''; };
      });
    }
  }

  function paintDashboardLive() {
    var wrap = wrapOf('opsDash');
    if (!wrap) return;
    if (fixtureOn()) { paintFixture('opsDash', 'room'); return; }
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
    var kindWord = { message: 'sent you a message', inmail: 'sent you an InMail', invite: 'wants to connect', update: 'posted an update' };
    var FL = { vc: 'Investor', dp: 'Design partner', rg: 'Regulator' };
    function flagOf(row) {
      var blob = ((row.from || '') + ' ' + (row.subject || '')).toLowerCase();
      if (/vc|venture|investor/.test(blob)) return 'vc';
      if (/broker|design partner|century|remax/.test(blob)) return 'dp';
      if (/regulat|bcfsa|clhia|fcac/.test(blob)) return 'rg';
      return '';
    }
    var need = [];
    if (days <= 14) need.push(['r', 'Raise closes in ' + days + ' days — cheques still open.', 'Raise']);
    if (overdue.length) need.push(['a', overdue.length + ' task' + (overdue.length === 1 ? ' is' : 's are') + ' overdue.', 'Tasks']);
    if (mail.length) need.push(['b', mail.length + ' people are waiting on a reply.', 'Inbox']);
    if (!need.length) need.push(['b', 'Desk is clear for now.', 'Desk']);
    var linkedHtml = linked.length ? linked.map(function (row) {
      return '<div class="li2"><span class="in">in</span><div class="t"><div class="l1"><b>' + esc(row.name) + '</b> <span>' + esc(kindWord[row.kind] || 'update') + '</span></div><div class="l2">' + esc(row.snippet || '') + '</div></div><span class="age">' + esc(ageLabel(row.at)) + '</span><a class="lnk" href="https://www.linkedin.com/messaging/" target="_blank" rel="noopener noreferrer">Open ›</a></div>';
    }).join('') : '<div class="li2"><div class="t"><div class="l1">No people waiting on LinkedIn</div><div class="l2">System notices stay hidden.</div></div></div>';
    var mailHtml = mail.length ? mail.map(function (m) {
      var fl = flagOf(m);
      var who = m.from || m.email || 'Sender';
      return '<div class="mail"><span class="av" style="background:#2e6bf2">' + esc(initials(who)) + '</span><div style="min-width:0"><div class="mn"><span>' + esc(who) + '</span>' + (fl ? '<em class="flag ' + fl + '" style="font-style:normal">' + FL[fl] + '</em>' : '') + '</div><div class="ms">' + esc(m.subject || '(no subject)') + '</div><div class="mp">' + esc(m.snippet || '') + '</div></div><div class="mr"><span class="age">' + esc(ageLabel(m.at)) + '</span><button class="rb" type="button">Reply</button><button class="more" type="button" title="More: not a person, snooze, file">···</button></div></div>';
    }).join('') : '<div class="mail"><div class="mp">No person-to-person mail waiting.</div></div>';
    var meetHtml = meetings.length ? meetings.map(function (ev, i) {
      return '<div class="meet"><span class="tm">' + esc(soon(ev.start)) + '</span><span class="nm">' + esc(ev.title || 'Meeting') + '</span>' + (i === 0 ? '<a class="join" href="' + esc(ev.link || '#') + '" target="_blank" rel="noopener noreferrer">Join</a>' : '<span class="bell" title="Alarm on"><svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg></span>') + '</div>';
    }).join('') : '<div class="meet"><span class="nm">No meetings on the calendar.</span></div>';
    var mvHtml = movers.length ? movers.map(function (move, i) {
      var zone = String(move.zone || move.area || 'Raise');
      var zc = /partner/i.test(zone) ? 'z3' : /cash|runway/i.test(zone) ? 'z1' : 'z2';
      return '<div class="mv"><span class="k">' + (i + 1) + '</span><div class="t">' + esc(move.title || move.text || move.name || '') + '<small>' + esc(move.whyNow || move.why || '') + '</small></div><span class="zone ' + zc + '">' + esc(zone) + '</span></div>';
    }).join('') : '<div class="mv"><div class="t">No ranked move yet<small>The War Room one-thing fills this.</small></div></div>';
    var score = 36;
    wrap.innerHTML =
      '<section class="cmd"><div class="cmdtop">'
      + '<div class="vit"><div class="k">Cash</div><div class="v"><span class="mask" data-real="$3,180">' + cash('$3,180') + '</span></div><div class="sub">in the bank</div></div>'
      + '<div class="vit"><div class="k">Burn</div><div class="v"><span class="mask" data-real="see Financials">' + cash('see Financials') + '</span></div><div class="sub">per month</div></div>'
      + '<div class="vit"><div class="k">Runway</div><div class="v red">~1 day</div><div class="sub">at this cash</div></div>'
      + '<div class="vit"><div class="k">Raise · friends &amp; family</div><div class="v"><span class="mask" data-real="$80K of $250K">' + cash('$80K of $250K') + '</span><button class="eye" id="eye" title="Show figures"><svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button></div><div class="raisebar"><i></i></div></div>'
      + '<div class="count"><div class="big">' + days + ' days</div><div class="k">to close · Oct 30</div></div></div>'
      + '<div class="lamps">'
      + '<div class="lamp"><span class="led r"></span><span class="nm">Runway</span><span class="st r">Critical</span></div>'
      + '<div class="lamp"><span class="led a"></span><span class="nm">Raise pace</span><span class="st a">Behind</span></div>'
      + '<div class="lamp"><span class="led g"></span><span class="nm">Pipeline</span><span class="st g">' + ((S.pipeline || []).length ? 'Live' : 'Waiting') + '</span></div>'
      + '<div class="lamp"><span class="led a"></span><span class="nm">Spend</span><span class="st a">Watch</span></div>'
      + '<div class="lamp"><span class="led a"></span><span class="nm">Legal docs</span><span class="st a">Open</span></div>'
      + '<div class="lamp"><span class="led r"></span><span class="nm">Concentration</span><span class="st r">High</span></div>'
      + '<div class="lamp"><span class="led g"></span><span class="nm">Integrations</span><span class="st g">' + (plugs || '-') + ' live</span></div>'
      + '</div></section>'
      + '<div class="g3"><section class="card"><div class="ch"><h3>What needs you now</h3><span class="s">across the desk</span></div>'
      + need.map(function (n) { return '<div class="row"><span class="sev ' + n[0] + '"></span><div class="rt">' + n[1] + '<small>' + n[2] + '</small></div><span class="lnk">Open</span></div>'; }).join('')
      + '</section><section class="card"><div class="ch"><h3>Raise tracker</h3><span class="s">7 × $25K cheques</span></div>'
      + '<div class="cheques"><div class="cq in">In</div><div class="cq in">In</div><div class="cq in">In</div><div class="cq pd">Pend</div><div class="cq op">5</div><div class="cq op">6</div><div class="cq op">7</div></div>'
      + '<div class="pace"><b><span class="mask" data-real="$170K">' + cash('$170K') + '</span> to go</b> in ' + days + ' days. Booked <span class="mask" data-real="$0">' + cash('$0') + '</span> this week. <span class="w">Behind pace — widen the round today.</span></div></section>'
      + '<section class="card"><div class="ch"><h3>What I\'d worry about</h3><span class="s">blind spots</span></div>'
      + '<div class="row"><span class="wic r">!</span><div class="rt"><b>Concentration.</b> One friends-and-family track — one delayed cheque is the whole pace.</div></div>'
      + '<div class="row"><span class="wic r">!</span><div class="rt"><b>About a day of runway.</b> A cheque has to land before the desk goes dark.</div></div>'
      + '<div class="row"><span class="wic a">!</span><div class="rt"><b>Unsigned docs + short runway.</b> That pairing is what stalls a close.</div></div></section></div>'
      + '<section class="card" style="margin-bottom:16px"><div class="ch"><h3>LinkedIn</h3><span class="s">' + linked.length + ' new · people only, system notices hidden</span><a class="lnk" style="margin-left:14px" href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer">Open LinkedIn</a></div><div class="ligrid">' + linkedHtml + '</div></section>'
      + '<div class="g2"><section class="card"><div class="ch"><h3>Inbox — needs you</h3><div class="tabs"><span class="on">People only</span><span>All mail</span></div><span class="s">' + mail.length + ' waiting</span></div><div id="mail">' + mailHtml + '</div><div class="foot">Bulk and notification mail is filed in Email → Quiet. <span class="lnk">Open Email</span></div></section>'
      + '<div class="stack"><section class="card"><div class="ch"><h3>Next meetings</h3><span class="s">today</span></div>' + meetHtml + '</section>'
      + '<section class="card"><div class="ch"><h3>Today\'s 1–3</h3><span class="s">from the War Room</span></div>' + mvHtml + '</section></div></div>'
      + '<div class="g3"><section class="card"><div class="ch"><h3>Company health</h3><span class="s">desk snapshot</span></div><div class="health"><svg viewBox="0 0 120 120" width="120" height="120"><circle cx="60" cy="60" r="48" fill="none" stroke="#eef1f6" stroke-width="14"/><circle cx="60" cy="60" r="48" fill="none" stroke="#f29b26" stroke-width="14" stroke-dasharray="108.6 301.6" stroke-linecap="round" transform="rotate(-90 60 60)"/><text x="60" y="62" text-anchor="middle" font-size="30" font-weight="850" fill="#101a33">' + score + '</text><text x="60" y="80" text-anchor="middle" font-size="11" fill="#7a86a0">of 100</text></svg><div>'
      + '<div class="hb">Cash<div class="t"><i style="width:12%;background:var(--red)"></i></div><b>12</b></div>'
      + '<div class="hb">Raise<div class="t"><i style="width:34%;background:var(--amber)"></i></div><b>34</b></div>'
      + '<div class="hb">Pipeline<div class="t"><i style="width:72%;background:var(--green)"></i></div><b>72</b></div>'
      + '<div class="hb">Product<div class="t"><i style="width:30%;background:var(--amber)"></i></div><b>30</b></div>'
      + '<div class="hb">Legal<div class="t"><i style="width:40%;background:var(--amber)"></i></div><b>40</b></div></div></div></section>'
      + '<section class="card"><div class="ch"><h3>Momentum</h3><span class="s">last 7 days</span></div><div class="mom"><div class="bars"><div><i style="height:28px"></i><span>Tue</span></div><div><i style="height:40px"></i><span>Wed</span></div><div><i style="height:22px"></i><span>Thu</span></div><div><i style="height:52px"></i><span>Fri</span></div><div><i style="height:36px"></i><span>Sat</span></div><div><i style="height:58px"></i><span>Sun</span></div><div><i style="height:70px;background:#5b8cff"></i><span>Mon</span></div></div>'
      + '<div class="desk"><div class="dk"><b>' + open.length + '</b><span>on the desk</span></div><div class="dk"><b>-</b><span>done this week</span></div><div class="dk red"><b>' + overdue.length + '</b><span>overdue</span></div><div class="dk red"><b>-</b><span>blocked</span></div></div></div></section>'
      + '<section class="card"><div class="ch"><h3>Content runway</h3><span class="s">GoHighLevel</span></div><div class="runway"><div class="big"><b>' + (typeof queue.left === 'number' ? queue.left : '-') + '</b><span>posts queued</span></div><div class="bar"><i style="width:4%;background:var(--amber)"></i></div>'
      + '<div class="kv"><span>Cadence</span><b>' + (queue.cadence != null ? queue.cadence + ' a day' : '-') + '</b></div>'
      + '<div class="kv"><span>Newsletter</span><b>' + esc(queue.newsletterDue || '-') + '</b></div>'
      + '<div class="kv"><span>Next clip</span><b>-</b></div></div></section></div>'
      + '<div class="toast" id="toast"></div>';
    var root = wrap.getRootNode();
    var shown = moneyOn();
    var eye = root.getElementById && root.getElementById('eye');
    if (eye) eye.onclick = function () {
      try { localStorage.setItem('cr_show_money', moneyOn() ? '0' : '1'); } catch (e) {}
      paintDashboardLive();
    };
    root.querySelectorAll('.rb').forEach(function (b, ix) {
      b.onclick = function () {
        if (typeof openReply === 'function') openReply(mail[ix]);
      };
    });
    root.querySelectorAll('.lnk').forEach(function (el) {
      if (el.textContent === 'Open Email') el.onclick = function () { if (typeof switchView === 'function') switchView('mail'); };
    });
  }

  function paintWarLive() {
    var wrap = wrapOf('warDesk');
    if (!wrap) return;
    if (fixtureOn()) { paintFixture('warDesk', 'war'); return; }
    loadMain('war', function (html) {
      wrap.innerHTML = html;
      var root = wrap.getRootNode();
      var S = window.STATE || {};
      var days = daysToClose();
      var cashEl = root.querySelectorAll('.ribbon .v');
      if (cashEl[0]) cashEl[0].textContent = cash('$••••');
      if (cashEl[2]) cashEl[2].textContent = cash('$••••');
      if (cashEl[3]) cashEl[3].textContent = days + ' days';
      var moves = ((S.ceo && S.ceo.moves) || []).filter(function (m) { return m.title || m.text || m.name; }).slice(0, 3);
      if (moves[0]) {
        var h2 = root.querySelector('.hero h2');
        if (h2) h2.textContent = moves[0].title || moves[0].text || moves[0].name;
      }
      var actions = (S.meetingActions || []).filter(function (row) { return row.status !== 'done' && row.status !== 'tasked'; }).slice(0, 5);
      var meetBox = root.querySelector('.rstack .card');
      if (meetBox && actions.length) {
        var rows = meetBox.querySelectorAll('.mo');
        actions.forEach(function (row, i) {
          if (!rows[i]) return;
          var tt = rows[i].querySelector('.tt');
          var mf = rows[i].querySelector('.mf');
          if (tt) tt.textContent = row.text || '';
          if (mf) mf.textContent = (row.meetingTitle || 'Meeting') + (row.meetingDate ? ' · ' + row.meetingDate : '');
        });
      }
      var cols = root.querySelectorAll('.exec .col');
      function colItems(key) {
        return (S.items || []).filter(function (it) {
          if (it.status === 'done' || it.status === 'dropped') return false;
          var b = typeof bucket === 'function' ? bucket(it) : 'later';
          if (key === 'today') return b === 'today' || b === 'overdue';
          if (key === 'week') return b === 'week';
          return b === 'later';
        });
      }
      ['today', 'week', 'later'].forEach(function (key, ix) {
        var col = cols[ix];
        if (!col) return;
        var items = colItems(key);
        var more = items.length > 5 ? items.length - 5 : 0;
        items = items.slice(0, 5);
        var head = col.querySelector('.colh');
        var body = items.map(function (it) {
          return '<div class="task"><span class="cb"></span><div><div class="tt">' + esc(verbTitle(it)) + '</div><div class="tg">' + esc(it.area || 'Ops') + '</div></div><div class="hv"><button type="button">Week</button><button type="button">Later</button><button type="button">&times;</button></div></div>';
        }).join('') || '<div class="empty">Nothing set for this column.<br>Drag a task here or press +.</div>';
        col.innerHTML = (head ? head.outerHTML.replace(/<span class="c">\d+<\/span>/, '<span class="c">' + (colItems(key).length) + '</span>') : '') + body + (more ? '<div class="more2">+ ' + more + ' more</div>' : '');
      });
      bindSample(root, 'war');
    });
  }

  function paintNotesLive() {
    var wrap = wrapOf('notesDesk');
    if (!wrap) return;
    if (fixtureOn()) { paintFixture('notesDesk', 'notes'); return; }
    loadMain('notes', function (html) {
      wrap.innerHTML = html;
      var S = window.STATE || {};
      var notes = S.notes || [];
      var board = wrap.querySelectorAll('.board');
      var all = board[1] || board[0];
      if (all && notes.length) {
        all.innerHTML = notes.map(function (n) {
          var body = n.body ? '<p>' + esc(n.body) + '</p>' : '';
          var title = n.title ? '<h4>' + esc(n.title) + '</h4>' : '';
          return '<div class="note ' + colorClass(n.color) + '"><div class="nh"><span class="ty">Note</span><span class="nx" style="margin-left:auto">&times;</span></div>' + title + body + '<div class="na"><span class="conv">✦ Convert to task</span><span class="sp"></span><span class="ic">✎</span><span class="ic">⋯</span></div></div>';
        }).join('');
      }
      bindSample(wrap.getRootNode(), 'notes');
    });
  }

  window.paintRedesignDashboard = paintDashboardLive;
  window.paintRedesignWar = paintWarLive;
  window.paintRedesignNotes = paintNotesLive;

  var _ops = window.renderOpsDash;
  Object.defineProperty(window, 'renderOpsDash', {
    configurable: true,
    set: function (fn) { _ops = fn; },
    get: function () {
      return function () {
        paintDashboardLive();
        if (typeof window.paintShellNav === 'function') window.paintShellNav();
      };
    }
  });

  var origWar;
  function hookWar() {
    if (typeof window.renderWar !== 'function' || window.renderWar.__redesign) return;
    origWar = window.renderWar;
    window.renderWar = function () {
      paintWarLive();
      if (typeof window.paintShellNav === 'function') window.paintShellNav();
    };
    window.renderWar.__redesign = true;
  }
  var origNotes;
  function hookNotes() {
    if (typeof window.renderNotes !== 'function' || window.renderNotes.__redesign) return;
    origNotes = window.renderNotes;
    window.renderNotes = function () {
      paintNotesLive();
      if (typeof window.paintShellNav === 'function') window.paintShellNav();
    };
    window.renderNotes.__redesign = true;
  }
  setInterval(function () { hookWar(); hookNotes(); }, 400);
  hookWar();
  hookNotes();
})();
