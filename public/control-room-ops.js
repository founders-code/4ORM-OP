(function () {
  var CATS = ['Dev', 'VC', 'Angel', 'Friends & Fam', 'Grants', 'Regulator', 'Government', 'Dev Partners', 'Design Partners', 'Banking', 'Legal'];
  var TINT = { Dev: '#D7E6FF', VC: '#D9F3E4', Angel: '#FFF1C9', 'Friends & Fam': '#F8D7DE', Grants: '#E4D8FB', Regulator: '#FDE7D0', Government: '#D8F1F4', 'Dev Partners': '#E7EAF2', 'Design Partners': '#F3E4F8', Banking: '#DCEBDD', Legal: '#F4E8D8' };

  function laDay(ms) {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
    } catch (err) {
      return '';
    }
  }

  function moveLabel(move) {
    return move ? (move.title || move.name || move.text || '') : '';
  }

  function soon(ms) {
    var gap = ms - Date.now();
    if (gap < 0) return 'now';
    var mins = Math.round(gap / 60000);
    if (mins < 60) return 'in ' + mins + 'm';
    return 'in ' + Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
  }

  function areaLabel(k, it) {
    if (it && /^Reach out -/.test(String(it.category || ''))) return String(it.category);
    if (it && /regulat/i.test(String(it.category || ''))) return 'Regulator';
    var hit = (CONFIG.areas || []).filter(function (a) { return a.k === k; })[0];
    return hit ? hit.label : (k || 'Other');
  }

  function liveItems() {
    return (STATE.items || []).filter(function (it) { return it.status !== 'dropped'; });
  }

  function daysToClose() {
    var end = Date.parse('2026-10-30T07:00:00Z');
    return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  }

  function missionShut() {
    try { return JSON.parse(localStorage.getItem('cr_mission') || '{}'); } catch (err) { return {}; }
  }

  function mc(id, title, sub, body) {
    var shut = missionShut()[id] === false;
    return '<section class="mcard' + (shut ? ' collapsed' : '') + '" data-card="' + id + '"><button type="button" class="ch" data-mc="' + id + '"><span class="t">' + title + '</span><span class="s">' + sub + '</span><span class="cx">' + (shut ? '>' : 'v') + '</span></button>' + body + '</section>';
  }

  function ageLabel(ms) {
    var gap = Date.now() - Number(ms || 0);
    if (!ms || gap < 0) return '';
    var mins = Math.round(gap / 60000);
    if (mins < 60) return mins + 'm ago';
    var hours = Math.round(mins / 60);
    if (hours < 48) return hours + 'h ago';
    return Math.round(hours / 24) + 'd ago';
  }

  function missionHtml(rows, doneWeek) {
    var days = daysToClose();
    var open = rows.filter(function (it) { return it.status !== 'done'; });
    var overdue = open.filter(function (it) { return bucket(it) === 'overdue'; });
    var reach = (STATE.reachOut || []).filter(function (person) { return !person.done; });
    var drafts = (STATE.packages || []).filter(function (space) { return String(space.stage || space.status || 'draft') === 'draft'; });
    var needs = [];
    if (days <= 30) needs.push(['r', 'Raise closes in ' + days + ' days. 4 of 7 cheques are still open.', 'Raise']);
    if (overdue.length) needs.push(['a', overdue.length + ' task' + (overdue.length === 1 ? '' : 's') + ' overdue.', 'Tasks']);
    if (reach.length) needs.push(['b', reach.length + ' people still waiting on a reach-out.', 'Reach out']);
    if (drafts.length) needs.push(['a', drafts.length + ' spaces are still drafts.', 'Spaces']);
    try {
      JSON.parse(localStorage.getItem('cr_dash_notes') || '[]').slice(0, 2).forEach(function (pin) {
        if (pin && pin.text) needs.push(['b', pin.text, 'Notes']);
      });
    } catch (err) {}
    if (!needs.length) needs.push(['b', 'Nothing on the desk is on fire.', 'Desk']);
    var needHtml = needs.map(function (row) {
      return '<div class="alert"><span class="sev ' + row[0] + '"></span><div>' + esc(row[1]) + '<span class="src">' + esc(row[2]) + '</span></div><button type="button" class="go" data-go="room">Open</button></div>';
    }).join('');
    var labels = [['in', 'In'], ['in', 'In'], ['in', '$80K'], ['pend', 'Pend'], ['open', '5'], ['open', '6'], ['open', '7']];
    var cheques = labels.map(function (pair) { return '<div class="cq ' + pair[0] + '">' + pair[1] + '</div>'; }).join('');
    var worries = [
      ['r', '<b>Concentration.</b> The $80K in is one friends-and-family track. One delayed cheque is the whole pace.'],
      ['r', '<b>About a day of runway.</b> Cash is $100. A cheque has to land before the desk goes dark.'],
      ['a', '<b>Unsigned docs plus a short runway.</b> That pairing is what stalls a close.'],
      ['a', '<b>One build path.</b> If that partner slips, the product date slips with it.']
    ];
    var worryHtml = '<div class="worry">' + worries.map(function (row) {
      return '<div class="worryrow"><span class="ic ' + row[0] + '">!</span><div class="tx">' + row[1] + '</div></div>';
    }).join('') + '</div>';
    var mail = (STATE.mail || []).slice().sort(function (a, b) {
      var av = /vc|fund|capital|ventures|investor/i.test((a.from || '') + ' ' + (a.subject || '')) ? 0 : 1;
      var bv = /vc|fund|capital|ventures|investor/i.test((b.from || '') + ' ' + (b.subject || '')) ? 0 : 1;
      return av - bv;
    });
    var vcMail = mail.filter(function (row) { return /vc|fund|capital|ventures|investor/i.test((row.from || '') + ' ' + (row.subject || '')); });
    var inbox = mail.length ? mail.slice(0, 4).map(function (row) {
      var vc = /vc|fund|capital|ventures|investor/i.test((row.from || '') + ' ' + (row.subject || ''));
      var bits = String(row.from || '?').split(/\s+/).slice(0, 2).map(function (part) { return part.slice(0, 1); }).join('').toUpperCase();
      return '<div class="ir"><span class="av' + (vc ? ' vc' : '') + '">' + esc(bits) + '</span><div><div class="su">' + esc(row.from || 'Sender') + '</div><div class="sn">' + esc(row.subject || row.snippet || '') + '</div><div class="age">' + esc(ageLabel(row.at)) + '</div></div><span class="flag ' + (vc ? 'vc' : 'rep') + '">' + (vc ? 'VC' : 'Reply') + '</span></div>';
    }).join('') + '<div class="cmini"><b>' + vcMail.length + ' VC email' + (vcMail.length === 1 ? '' : 's') + '</b> in this set.</div>' : '<div class="quiet">Gmail has not returned messages. Investor mail pins here when it does.</div>';
    var queue = STATE.content;
    var content = queue && !queue.empty ? '<div class="runway-gauge"><div class="rbig">' + queue.left + '</div><div class="rbar"><div class="track"><i style="width:' + Math.min(100, queue.left * 8) + '%"></i></div><div class="lab">posts left' + (queue.left ? ' - runs dry in about ' + Math.max(1, Math.round(queue.left / Math.max(queue.cadence || 1, 1))) + ' days' : '') + '</div></div></div><div class="cmini"><div class="r"><span>Posting cadence</span><b>' + (queue.cadence || 0) + ' / week</b></div></div>' : '<div class="quiet">GoHighLevel has not returned a content queue. Posts left and the day it runs dry show here when it does.</div>';
    var vcs = (STATE.packages || []).filter(function (space) {
      return /vc|venture|angel/i.test(String(space.spaceCategory || space.category || '') + ' ' + String(space.name || ''));
    });
    if (!vcs.length) {
      vcs = (STATE.contacts || []).filter(function (c) { return typeof catMatch === 'function' && catMatch(contactCategory(c), 'vc'); }).slice(0, 6).map(function (c) {
        return { name: c.name, stage: c.stage || 'ready' };
      });
    }
    var watch = vcs.length ? vcs.slice(0, 6).map(function (space) {
      var stage = String(space.stage || space.status || 'draft');
      var color = /repli|commit/i.test(stage) ? '#17b86a' : /sent|open/i.test(stage) ? '#f0a020' : '#c6cfdd';
      return '<div class="vcrow"><span class="d" style="background:' + color + '"></span>' + esc(space.name) + '<button type="button" class="act" data-go="work">Open</button></div>';
    }).join('') : '<div class="quiet">No VC spaces or VC contacts on the board yet.</div>';
    var pipeScore = Math.min(100, ((STATE.pipeline || []).reduce(function (n, s) { return n + (Number(s.v) || 0); }, 0) ? 70 : 16));
    var cash = 18, raise = 32, product = rows.length ? Math.max(20, 80 - Math.min(open.length, 60)) : 24;
    var legal = rows.some(function (it) { return /legal|regulat/i.test(it.title || ''); }) ? 40 : 55;
    var score = Math.round((cash + raise + pipeScore + product + legal) / 5);
    var movers = ((STATE.ceo && STATE.ceo.moves) || []).filter(function (move) { return moveLabel(move); }).slice(0, 3);
    var moverHtml = movers.length ? '<div class="mlist">' + movers.map(function (move, i) {
      return '<div class="m"><span class="dot" style="background:' + (i ? '#1f5fff' : '#f23a4d') + '"></span>' + esc(moveLabel(move)) + '<span class="mt">P' + (i + 1) + '</span></div>';
    }).join('') + '</div><div class="pace">These are the ranked moves from 4orm Intelligence, the same list as the War Room.</div>' : '<div class="quiet">No ranked move yet. The War Room one-thing fills this.</div>';
    var bars = [30, 45, 25, 60, 40, 70, Math.min(100, 20 + doneWeek * 8)].map(function (n) { return '<div class="bar" style="height:' + Math.max(8, n) + '%"></div>'; }).join('');
    var meetings = (STATE.events || []).filter(function (ev) { return ev.start >= Date.now() - 60000; }).sort(function (a, b) { return a.start - b.start; }).slice(0, 3);
    var meet = meetings.length ? meetings.map(function (ev) { return '<div class="m"><span class="dot"></span>' + esc(ev.title || 'Meeting') + '<span class="mt">' + soon(ev.start) + '</span></div>'; }).join('') : '<div class="quiet">No meetings on the calendar.</div>';
    var lamps = [
      ['Runway', 'r', 'Critical', 'room'],
      ['Raise pace', 'a', 'Behind', 'room'],
      ['Pipeline', (STATE.pipeline || []).length ? 'g' : 'a', (STATE.pipeline || []).length ? 'Live' : 'Waiting', 'contacts'],
      ['Spend', 'a', 'Watch', 'room'],
      ['Legal docs', 'a', 'Open', 'docs'],
      ['Concentration', 'r', 'High', 'work'],
      ['Integrations', 'g', 'Live', 'int']
    ];
    var strip = '<div class="command"><div class="cmdtop"><div class="vital"><span class="k">Cash</span><span class="v">$100</span><span class="sub">in the bank</span></div><div class="vital"><span class="k">Burn</span><span class="v">~$3K</span><span class="sub">implied / month</span></div><div class="vital"><span class="k">Runway</span><span class="v red">~1 day</span><span class="sub">at this cash</span></div><div class="vital"><span class="k">Raise - F&amp;F</span><span class="v">$80K / $250K</span><span class="prog"><i></i></span></div><div class="countdown"><div class="big">' + days + 'd</div><div class="k">to close - Oct 30</div></div></div><div class="lamps">' + lamps.map(function (lamp) {
      return '<button type="button" class="lamp" data-go="' + lamp[3] + '"><span class="led ' + lamp[1] + '"></span><div class="nm">' + lamp[0] + '</div><div class="st ' + lamp[1] + '">' + lamp[2] + '</div></button>';
    }).join('') + '</div></div>';
    return strip
      + '<div class="ctrl">'
      + mc('needs', 'What needs you now', 'across the desk', needHtml)
      + mc('raise', 'Raise tracker', '7 x $25K cheques', '<div class="cheques">' + cheques + '</div><div class="pace"><b>$170,000 to go</b> in ' + days + ' days. This week booked <b>$0</b> new. <span class="warn">Behind pace - widen the round today.</span></div>')
      + mc('worry', 'What I would worry about', 'blind spots', worryHtml)
      + '</div><div class="ctrl">'
      + mc('inbox', 'Inbox - needs you', 'from Gmail', inbox)
      + mc('content', 'Content runway', 'GoHighLevel', content)
      + mc('vc', 'VC watch', 'never let one go cold', watch)
      + '</div><div class="row3">'
      + mc('health', 'Company health', 'desk snapshot', '<div class="health"><div class="gauge" style="--p:' + score + '"><div class="in"><div class="n">' + score + '</div><div class="l">of 100</div></div></div><div class="subscore"><span>Cash / runway</span><span class="b"><i style="width:' + cash + '%;background:#f23a4d"></i></span></div><div class="subscore"><span>Raise</span><span class="b"><i style="width:' + raise + '%;background:#f0a020"></i></span></div><div class="subscore"><span>Pipeline</span><span class="b"><i style="width:' + pipeScore + '%;background:#17b86a"></i></span></div><div class="subscore"><span>Product</span><span class="b"><i style="width:' + product + '%;background:#f0a020"></i></span></div><div class="subscore"><span>Legal</span><span class="b"><i style="width:' + legal + '%;background:#f0a020"></i></span></div></div>')
      + mc('mom', 'Momentum', 'last 7 days', '<div class="spark">' + bars + '</div><div class="momrow"><span>Done last 7d <b>' + doneWeek + '</b></span><span>Open <b>' + open.length + '</b></span></div><div class="ch" style="cursor:default"><span class="t">Next meetings</span></div><div class="mlist">' + meet + '</div>')
      + mc('move', "Today's 1-3", 'from the War Room', moverHtml)
      + '</div>';
  }

  function bindMission(el) {
    el.querySelectorAll('[data-mc]').forEach(function (btn) {
      btn.onclick = function () {
        var map = missionShut();
        var id = btn.getAttribute('data-mc');
        map[id] = map[id] === false;
        try { localStorage.setItem('cr_mission', JSON.stringify(map)); } catch (err) {}
        renderOpsDash();
      };
    });
    el.querySelectorAll('[data-go]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        if (typeof switchView === 'function') switchView(btn.getAttribute('data-go'));
      };
    });
  }

  function loadDeskFeeds() {
    if (STATE.feedsAsked) return;
    STATE.feedsAsked = true;
    var from = new Date(Date.now() - 86400000).toISOString();
    var to = new Date(Date.now() + 14 * 86400000).toISOString();
    authFetch('/api/calendar?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to), { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      if (data && data.events && data.events.length) { STATE.events = data.events; if (STATE.desk === 'room' || !STATE.desk) renderOpsDash(); if (STATE.desk === 'war') renderWar(); }
    }).catch(function () {});
    authFetch('/api/mail', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      STATE.mail = (data && data.messages) || [];
      if (typeof stampWarmth === 'function') stampWarmth();
      if (STATE.desk === 'room' || !STATE.desk) renderOpsDash();
      if (STATE.desk === 'people' && typeof renderPeople === 'function') renderPeople(document.getElementById('pSearch') ? document.getElementById('pSearch').value : '');
      if (STATE.desk === 'contacts' && typeof renderContacts === 'function') renderContacts(document.getElementById('cSearch') ? document.getElementById('cSearch').value : '');
    }).catch(function () { STATE.mail = STATE.mail || []; });
    authFetch('/api/content', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      STATE.content = data || { empty: true };
      if (STATE.desk === 'room' || !STATE.desk) renderOpsDash();
    }).catch(function () { STATE.content = { empty: true }; });
  }

  function renderOpsDash() {
    var el = document.getElementById('opsDash');
    if (!el) return;
    var rows = liveItems();
    var done = rows.filter(function (it) { return it.status === 'done'; });
    var active = rows.filter(function (it) { return it.status === 'doing' || it.status === 'new' || it.status === 'open'; });
    var waiting = rows.filter(function (it) { return it.status === 'waiting'; });
    var overdue = rows.filter(function (it) { return it.status !== 'done' && bucket(it) === 'overdue'; });
    var blocked = overdue.filter(function (it) { return it.priority === 'urgent' || it.priority === 'high'; });
    var total = rows.length;
    var comp = total ? Math.round((done.length / total) * 100) : 0;
    var onTime = done.length ? Math.round((done.filter(function (it) { return bucket(it) !== 'overdue'; }).length / done.length) * 100) : 100;
    var tiles = [
      ['Total', total, '', 'on the desk'],
      ['Done', done.length, 'ok', 'closed'],
      ['Active', active.length, 'go', 'in motion'],
      ['Waiting', waiting.length, '', 'paused'],
      ['Blocked', blocked.length, blocked.length ? 'bad' : '', 'stuck'],
      ['Overdue', overdue.length, 'bad', 'past due'],
      ['Comp', comp + '%', 'ok', 'done / total'],
      ['On time', onTime + '%', 'warn', 'closed on time']
    ];
    var byStatus = { done: done.length, active: active.length, waiting: waiting.length, blocked: blocked.length };
    var areas = {};
    var areaRows = {};
    rows.forEach(function (it) { var k = areaLabel(it.area, it); areas[k] = (areas[k] || 0) + 1; (areaRows[k] = areaRows[k] || []).push(it); });
    var pri = { urgent: 0, high: 0, normal: 0, low: 0 };
    rows.forEach(function (it) { if (pri[it.priority] != null) pri[it.priority] += 1; });
    var highOpen = rows.filter(function (it) { return it.status !== 'done' && (it.priority === 'high' || it.priority === 'urgent'); }).length;
    var dueWeek = rows.filter(function (it) { return it.status !== 'done' && bucket(it) === 'week'; }).length;
    var dueToday = rows.filter(function (it) { return it.status !== 'done' && (bucket(it) === 'today' || bucket(it) === 'overdue'); }).length;
    var oldest = overdue.reduce(function (max, it) { var age = it.due ? Math.max(0, Math.round((Date.now() - it.due) / 86400000)) : 0; return Math.max(max, age); }, 0);
    var weekAgo = Date.now() - 7 * 86400000;
    var doneWeek = done.filter(function (it) { var at = Date.parse(it.updated_at || '') || it.due || 0; return at >= weekAgo; }).length;
    var maxStatus = Math.max(done.length, active.length, waiting.length, blocked.length, 1);
    var maxArea = Math.max.apply(null, Object.keys(areas).map(function (k) { return areas[k]; }).concat([1]));
    var maxPri = Math.max(pri.urgent, pri.high, pri.normal, pri.low, 1);
    var lists = {};
    function meters(pairs, max) {
      return pairs.map(function (pair) {
        var key = pair[2];
        lists[key] = pair[3] || [];
        return '<button type="button" class="meter" data-ops="' + esc(key) + '"><em>' + esc(pair[0]) + '</em><span><i style="width:' + Math.round((pair[1] / max) * 100) + '%"></i></span><b>' + pair[1] + '</b></button>';
      }).join('');
    }
    var parts = [
      { n: done.length, color: '#1F8A4C', label: 'Completed' },
      { n: active.length, color: '#2F6FED', label: 'Active' },
      { n: waiting.length, color: '#E0A100', label: 'Waiting' },
      { n: blocked.length, color: '#C5363A', label: 'Blocked' }
    ];
    var upcoming = (STATE.events || []).filter(function (ev) { return ev.start >= Date.now() - 60000; }).sort(function (a, b) { return a.start - b.start; }).slice(0, 3);
    var todayKey = laDay(Date.now());
    var talks = (STATE.events || []).filter(function (ev) { return laDay(ev.start) === todayKey; }).slice(0, 4);
    var reachToday = (STATE.reachOut || []).filter(function (person) { return !person.done; }).slice(0, 4);
    var rank = { urgent: 0, high: 1, normal: 2, low: 3 };
    var top = rows.filter(function (it) { return it.status !== 'done'; }).sort(function (a, b) {
      return (rank[a.priority] == null ? 9 : rank[a.priority]) - (rank[b.priority] == null ? 9 : rank[b.priority]);
    }).slice(0, 3);
    var meetHtml = upcoming.length ? upcoming.map(function (ev) { return '<div>' + esc(ev.title || 'Event') + ' <span class="kick">' + soon(ev.start) + '</span></div>'; }).join('') : '<div class="kick">No meetings on the calendar.</div>';
    var talkHtml = talks.map(function (ev) { return '<div>' + esc(ev.title || 'Call') + '</div>'; }).join('') + reachToday.map(function (person) { return '<div>' + esc(person.name) + ' <span class="kick">' + esc(person.nextAction || 'Reach out') + '</span></div>'; }).join('');
    if (!talkHtml) talkHtml = '<div class="kick">Nothing to call today.</div>';
    var topHtml = top.length ? top.map(function (it) { return '<div>' + esc(it.title) + '</div>'; }).join('') : '<div class="kick">No open tasks.</div>';
    var trend = [];
    for (var day = 6; day >= 0; day -= 1) {
      var start = new Date(); start.setHours(0, 0, 0, 0); start = start.getTime() - day * 86400000;
      var count = done.filter(function (it) { var at = Date.parse(it.updated_at || '') || 0; return at >= start && at < start + 86400000; }).length;
      trend.push(count);
    }
    loadDeskFeeds();
    el.innerHTML = missionHtml(rows, doneWeek) + '<div class="money"><div><div class="k">Raise - friends &amp; family</div><div class="n">$80K / $250K</div><div class="bar"><span></span></div><div class="kick" style="color:#C5D4E6;margin-top:8px">$170K to go - 3/7 cheques - 18 days to Oct 30</div></div><div><div class="k">Runway</div><div class="n bad">~1 day</div></div><div><div class="k">Cash</div><div class="n">$100</div></div></div>'
      + '<div class="metrics">' + tiles.map(function (t) { return '<div class="metric ' + t[2] + '"><div class="k">' + esc(t[0]) + '</div><div class="n">' + esc(String(t[1])) + '</div><div class="kick">' + esc(t[3]) + '</div></div>'; }).join('') + '</div>'
      + '<div class="ops-2"><div class="card" style="padding:14px"><h3>Operations overview</h3><div class="kick">Status</div>' + meters([['Done', done.length, 'status:done', done], ['Active', active.length, 'status:active', active], ['Waiting', waiting.length, 'status:waiting', waiting], ['Blocked', blocked.length, 'status:blocked', blocked]], maxStatus) + '<div class="kick" style="margin-top:10px">Departments</div>' + meters(Object.keys(areas).map(function (k) { return [k, areas[k], 'area:' + k, areaRows[k]]; }), maxArea) + '<div class="kick" style="margin-top:10px">Priority</div>' + meters(Object.keys(pri).map(function (k) { return [k, pri[k], 'pri:' + k, rows.filter(function (it) { return it.priority === k; })]; }), maxPri) + '</div>'
      + '<div class="card" style="padding:14px"><h3>Quick insights</h3><div class="insights">'
      + '<button type="button" data-ops="ins:high"><b>' + highOpen + '</b><span>High priority open</span></button>'
      + '<button type="button" data-ops="ins:week"><b>' + dueWeek + '</b><span>Due this week</span></button>'
      + '<button type="button" data-ops="ins:active"><b>' + active.length + '</b><span>Active tasks</span></button>'
      + '<button type="button" data-ops="ins:today"><b>' + dueToday + '</b><span>Due today</span></button>'
      + '<button type="button" data-ops="ins:old"><b>' + oldest + 'd</b><span>Oldest overdue</span></button>'
      + '<button type="button" data-ops="ins:done"><b>' + doneWeek + '</b><span>Done last 7d</span></button>'
      + '</div><div class="desk-live"><h3>Next meetings</h3>' + meetHtml + '<h3>Today\'s conversations</h3>' + talkHtml + '<h3>Top 3 tasks</h3>' + topHtml + '</div></div></div>'
      + '<div class="ops-2"><div class="card" style="padding:14px"><h3>Task status breakdown</h3><div class="donut-wrap">' + donut(parts, total) + '<div class="legend">' + parts.map(function (p) { var pct = total ? Math.round((p.n / total) * 100) : 0; return '<div><b style="color:' + p.color + '">' + p.n + '</b> ' + esc(p.label) + ' ' + pct + '%</div>'; }).join('') + '</div></div></div>'
      + '<div class="card" style="padding:14px"><h3>Tasks by department</h3>' + Object.keys(areas).map(function (k) { return '<button type="button" class="meter" data-ops="area:' + esc(k) + '"><em>' + esc(k) + '</em><span><i style="width:' + Math.round((areas[k] / maxArea) * 100) + '%"></i></span><b>' + areas[k] + '</b></button>'; }).join('') + '<h3 style="margin-top:16px">Completed - last 7 days</h3>' + spark(trend) + '</div></div>';
    lists['ins:high'] = rows.filter(function (it) { return it.status !== 'done' && (it.priority === 'high' || it.priority === 'urgent'); });
    lists['ins:week'] = rows.filter(function (it) { return it.status !== 'done' && bucket(it) === 'week'; });
    lists['ins:active'] = active;
    lists['ins:today'] = rows.filter(function (it) { return it.status !== 'done' && (bucket(it) === 'today' || bucket(it) === 'overdue'); });
    lists['ins:old'] = overdue;
    lists['ins:done'] = done.filter(function (it) { var at = Date.parse(it.updated_at || '') || it.due || 0; return at >= weekAgo; });
    el.querySelectorAll('[data-ops]').forEach(function (btn) {
      btn.onclick = function () { openOpsList(btn.getAttribute('data-ops'), lists); };
    });
    bindMission(el);
  }

  function openOpsList(key, lists) {
    var modal = document.getElementById('modal');
    var card = document.getElementById('modalCard');
    if (!modal || !card) return;
    var rows = (lists && lists[key]) || [];
    card.classList.add('wide');
    card.innerHTML = '<div class="mhd"><div style="font-weight:700">' + esc(key.split(':').slice(1).join(':') || 'Items') + '</div><button class="x" id="mClose" type="button">x</button></div><div class="mbd">' + (rows.length ? rows.map(function (it) { return '<div class="ops-row"><button type="button" data-ops-item="' + esc(it.id) + '"><b>' + esc(it.title) + '</b><span class="kick">' + esc(areaLabel(it.area, it)) + '</span></button>' + bucketPicks(it) + '<button type="button" class="ghost-x" data-ops-del="' + esc(it.id) + '" aria-label="Delete">x</button></div>'; }).join('') : '<div class="kick">Nothing in this group.</div>') + '</div>';
    modal.classList.add('open');
    modal.hidden = false;
    document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
    card.querySelectorAll('[data-set-bucket]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        setBucket(btn.getAttribute('data-set-bucket'), btn.getAttribute('data-col'));
        openOpsList(key, lists);
      };
    });
    card.querySelectorAll('[data-ops-item]').forEach(function (btn) {
      btn.onclick = function () { if (typeof closeModal === 'function') closeModal(); editItem(btn.getAttribute('data-ops-item')); };
    });
    card.querySelectorAll('[data-ops-del]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-ops-del');
        STATE.items = (STATE.items || []).filter(function (it) { return it.id !== id; });
        lists[key] = (lists[key] || []).filter(function (it) { return it.id !== id; });
        if (typeof renderWar === 'function') renderWar();
        renderOpsDash();
        authFetch('/api/items/' + id, { method: 'DELETE', credentials: 'same-origin' }).catch(function () {});
        openOpsList(key, lists);
      };
    });
  }

  function spark(values) {
    var max = Math.max.apply(null, values.concat([1]));
    var w = 280; var h = 64;
    var pts = values.map(function (n, i) { return (i * (w / 6)) + ',' + (h - (n / max) * (h - 8) - 4); }).join(' ');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="64"><polyline fill="none" stroke="#2F6FED" stroke-width="2" points="' + pts + '"/></svg>';
  }

  function donut(parts, centre) {
    var drawn = parts.slice();
    if (!drawn.some(function (p) { return p.n; })) drawn = [{ n: 1, color: '#E6EBF1' }];
    var total = drawn.reduce(function (s, p) { return s + p.n; }, 0) || 1;
    var c = 2 * Math.PI * 42;
    var off = 0;
    var arcs = drawn.map(function (p) {
      var len = (p.n / total) * c;
      var node = '<circle cx="60" cy="60" r="42" fill="none" stroke="' + p.color + '" stroke-width="14" stroke-dasharray="' + len + ' ' + (c - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 60 60)"/>';
      off += len;
      return node;
    }).join('');
    return '<svg viewBox="0 0 120 120" width="180" height="180">' + arcs + '<text x="60" y="66" text-anchor="middle" font-size="18" font-weight="650" fill="#102033">' + (centre || 0) + '</text></svg>';
  }

  function bucketPicks(it) {
    var b = bucket(it);
    var cur = b === 'week' ? 'week' : (b === 'later' ? 'later' : 'today');
    return '<span class="bucket-picks">' + [['today', 'Today'], ['week', 'Week'], ['later', 'Later']].map(function (pair) {
      return '<button type="button" data-set-bucket="' + esc(it.id) + '" data-col="' + pair[0] + '"' + (cur === pair[0] ? ' class="on"' : '') + '>' + pair[1] + '</button>';
    }).join('') + '</span>';
  }

  function setBucket(id, col) {
    var it = (STATE.items || []).filter(function (row) { return row.id === id; })[0];
    if (!it) return;
    it.due = dueFor(col);
    renderWar();
    if (typeof renderOpsDash === 'function') renderOpsDash();
    var due = it.due == null ? null : new Date(it.due).toISOString();
    function send() {
      return authFetch('/api/items', { method: 'PATCH', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id, due: due }) }).then(function (r) { if (!r.ok) throw 0; });
    }
    send().catch(function () { return send(); }).catch(function () {});
  }

  function dueFor(col) {
    if (col === 'today') return Date.now();
    if (col === 'week') return Date.now() + 3 * 86400000;
    return null;
  }

  function renderWar() {
    var cmd = document.getElementById('warCmd');
    var board = document.getElementById('execBoard');
    if (!cmd || !board) return;
    var today = laDay(Date.now());
    var next = (STATE.events || []).filter(function (ev) { return laDay(ev.start) === today && ev.start >= Date.now() - 60000; }).sort(function (a, b) { return a.start - b.start; }).slice(0, 2);
    var kinds = [['all', 'All'], ['corporate', 'Corporate'], ['vc', 'VC'], ['client', 'Client'], ['design', 'Design partner'], ['regulator', 'Regulator']];
    var reachNames = { corporate: 'Corporate', vc: 'VC', client: 'Client', design: 'Design partner', regulator: 'Regulator' };
    var people = STATE.reachOut || [];
    var filter = STATE.reachKind || 'all';
    var shown = people.filter(function (person) { return filter === 'all' || person.kind === filter; });
    var moves = ((STATE.ceo && STATE.ceo.moves) || []).filter(function (move) { return moveLabel(move); });
    var one = moves[0];
    var needleOn = {};
    try { needleOn = JSON.parse(localStorage.getItem('cr_needle') || '{}'); } catch (err) { needleOn = {}; }
    if (needleOn.day !== laDay(Date.now())) needleOn = { day: laDay(Date.now()), ids: {} };
    var doneN = 0;
    var slots = [0, 1, 2].map(function (i) {
      var move = moves[i];
      if (!move) return '<div class="nm empty">+ set needle mover ' + (i + 1) + '</div>';
      var id = String(move.id || i);
      var on = !!(needleOn.ids && needleOn.ids[id]);
      if (on) doneN += 1;
      var rank = i === 0 ? '#1 the one thing' : '#' + (i + 1);
      return '<div class="nm' + (on ? ' done' : '') + '"><span class="rank">' + rank + '</span><div class="tt">' + esc(moveLabel(move)) + '</div><span class="tag">' + esc(move.zone || move.area || 'Raise') + '</span><input class="ck" type="checkbox" data-needle="' + esc(id) + '"' + (on ? ' checked' : '') + '/></div>';
    }).join('');
    var left = STATE.focusUntil && STATE.focusUntil > Date.now() ? STATE.focusUntil - Date.now() : 25 * 60 * 1000;
    var mm = String(Math.floor(left / 60000)).padStart(2, '0');
    var ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
    var deg = STATE.focusUntil ? Math.max(0, Math.min(360, ((STATE.focusUntil - Date.now()) / (25 * 60 * 1000)) * 360)) : 0;
    var evening = new Date().getHours() >= 17;
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var needleLog = {};
    try { needleLog = JSON.parse(localStorage.getItem('cr_needle_log') || '{}'); } catch (err) { needleLog = {}; }
    if (doneN) needleLog[today] = doneN;
    try { localStorage.setItem('cr_needle_log', JSON.stringify(needleLog)); } catch (err) {}
    var week = '';
    for (var d = 4; d >= 0; d -= 1) {
      var when = new Date(); when.setDate(when.getDate() - d);
      var label = days[when.getDay()];
      var key = laDay(when.getTime());
      var hit = needleLog[key];
      var cls = d === 0 ? 'today' : (hit ? 'hit' : '');
      week += '<div class="day ' + cls + '"><div class="d">' + (hit ? hit : cls === 'today' ? '?' : '-') + '</div><div class="l">' + label + '</div></div>';
    }
    var busyMin = 0;
    (STATE.events || []).forEach(function (ev) {
      if (laDay(ev.start) !== today) return;
      busyMin += Number(ev.dur) || 30;
    });
    var openH = Math.max(0, Math.round((15 * 60 - busyMin) / 60));
    var budget = (STATE.events || []).length ? (openH + 'h still open today between 6am and 9pm after what is already booked. Block the morning for the one thing.') : 'Open focus sits next to the calendar. Block the morning for the one thing.';
    var steps = (one && one.how && one.how.length ? one.how : (one && one.steps && one.steps.length ? one.steps : ['Confirm the next cheque', 'Send the paper', 'Lock a date this week'])).slice(0, 3);
    var streak = 0;
    for (var sd = 0; sd < 60; sd += 1) {
      var sk = laDay(Date.now() - sd * 86400000);
      if (needleLog[sk]) streak += 1;
      else if (sd > 0) break;
    }
    var eodLines = moves.slice(0, 3).map(function (move, i) {
      var on = !!(needleOn.ids && needleOn.ids[String(move.id || i)]);
      return '<div class="line"><span class="ic ' + (on ? 'ok' : 'no') + '">' + (on ? '\u2713' : '\u2717') + '</span>' + esc(moveLabel(move)) + (on ? '' : ' - not done') + '</div>';
    }).join('');
    cmd.innerHTML = '<div class="command" style="padding:10px 16px"><div class="cmdtop"><div class="vital"><span class="k">Cash</span><span class="v">$100</span></div><div class="vital"><span class="k">Runway</span><span class="v red">~1 day</span></div><div class="vital"><span class="k">Raise - F&amp;F</span><span class="v">$80K / $250K</span></div><div class="vital"><span class="k">To Oct 30</span><span class="v">' + daysToClose() + ' days</span></div><div class="vital" style="margin-left:auto;text-align:right"><span class="k">Focus streak</span><span class="v streak">' + (streak ? '\ud83d\udd25 ' + streak + ' day' + (streak === 1 ? '' : 's') : 'Start today') + '</span></div></div></div>'
      + '<div class="lb-add capbar"><input id="opsAdd" type="text" placeholder="Capture a task - or type an idea to park it, so you don\'t lose focus" style="flex:1"/><button class="btn pri sm" id="opsAddBtn" type="button">Add</button></div>'
      + '<div class="focus-hero"><div class="l"><div class="lab">4orm Intelligence - today\'s one move</div><div class="big">' + esc(one ? moveLabel(one) : 'Pick the one thing') + '</div><div class="why">' + esc(one && (one.whyNow || one.why) ? 'Why: ' + (one.whyNow || one.why) : 'Tied to runway and the raise. Cash first.') + '</div><div class="steps">' + steps.map(function (step, i) { return '<span class="step">' + (i + 1) + ' ' + esc(typeof step === 'string' ? step : (step.title || step.text || 'Step')) + '</span>'; }).join('') + '</div><div class="cap" style="background:transparent;border:0;box-shadow:none;padding:0"><button class="btn pri sm" type="button" id="focusStart">\u25b6 Start 25-min focus</button><button class="btn sm" type="button" id="focusCommit">Commit this as my one thing</button><button class="btn sm" type="button" id="focusPlan">Plan</button><button class="btn sm" type="button" id="focusLater">Not now</button></div></div><div class="r"><div class="timer" style="--deg:' + deg + 'deg"><div class="in"><div class="t" id="focusClock">' + mm + ':' + ss + '</div><div class="s">focus</div></div></div><div class="quiet" style="color:#8fa3c6"><b style="color:#eaf1ff">' + doneN + ' of 3</b> needle-movers done</div></div></div>'
      + '<div class="nm-wrap"><div class="nm-head"><span>Today\'s 1-3 needle movers</span><span class="s">the only things that count as a win today</span><span class="prog2"><b>' + doneN + '</b> / 3 done</span></div><div class="nm-row">' + slots + '</div></div>'
      + '<div class="ctrl" style="grid-template-columns:1.3fr 1fr"><div class="coach"><b>Coaching note</b><p>Regulators can wait. Do not let them take a cash-first morning. Drop them or give them 10 minutes, then come back to the one thing.</p></div><div class="mcard" style="padding:12px"><b>Momentum</b><div class="week">' + week + '</div><div class="budget">' + esc(budget) + '</div></div></div>'
      + '<div class="card" id="nextUp" style="padding:8px 12px;margin-top:8px;display:flex;align-items:center;gap:12px"><div style="flex:1">' + (next.length ? next.map(function (ev) { return '<div data-count="' + ev.start + '">' + esc(ev.title || 'Event') + ' <span class="kick">' + soon(ev.start) + '</span></div>'; }).join('') : '<div class="kick">No more events today.</div>') + '</div><button class="btn sm" id="findSlot" type="button">Find a 30-min slot</button></div>'
      + '<div class="card" style="padding:12px;margin-top:10px"><h3>Reach out</h3><div class="news-chips">' + kinds.map(function (pair) { var n = people.filter(function (person) { return pair[0] === 'all' || person.kind === pair[0]; }).length; return '<button type="button" data-reach-kind="' + pair[0] + '"' + (filter === pair[0] ? ' class="on"' : '') + '>' + pair[1] + ' ' + n + '</button>'; }).join('') + '</div><div class="reach-grid">' + (shown.length ? shown.map(function (person) { var bits = String(person.name || '?').split(/\s+/).slice(0, 2).map(function (part) { return part.slice(0, 1); }).join('').toUpperCase(); return '<div class="reach-card"><div class="av">' + esc(bits) + '</div><b>' + esc(person.name) + '</b><div class="kick">' + esc(person.company || '') + '</div><span class="kick">' + esc(reachNames[person.kind] || 'Corporate') + '</span><label class="cap"><input type="checkbox" data-reach-done="' + esc(person.id) + '"' + (person.done ? ' checked' : '') + '/>' + esc(person.nextAction || 'Reach out') + '</label><button type="button" data-reach-task="' + esc(person.id) + '">+ task</button></div>'; }).join('') : '<div class="kick">Add people from Pipeline or Contacts.</div>') + '</div></div>';
    var cols = [
      ['today', 'Today'],
      ['week', 'This week'],
      ['later', 'Later']
    ];
    board.innerHTML = '<div class="execcard"><div class="sh">Execution <span class="s">everything else - drag, tag Today/Week/Later <button class="xfull" type="button" id="execFull">\u2197 Expand full-screen</button></span></div><div class="exec">' + cols.map(function (col) {
      var items = liveItems().filter(function (it) {
        var b = bucket(it);
        if (it.status === 'done') return false;
        if (col[0] === 'today') return b === 'today' || b === 'overdue';
        if (col[0] === 'week') return b === 'week';
        return b === 'later';
      });
      return '<div class="exec-col ' + col[0] + '" data-col="' + col[0] + '"><div class="sec-h"><h3>' + col[1] + '</h3><button class="addmini" type="button" data-add-col="' + col[0] + '">+</button></div>' + items.map(function (it) {
        return '<div class="exec-card" draggable="true" data-item="' + esc(it.id) + '"><input type="checkbox" data-done="' + esc(it.id) + '" aria-label="Done"/><button type="button" data-edit="' + esc(it.id) + '" style="flex:1;text-align:left;border:0;background:transparent;font:inherit;cursor:pointer"><b>' + esc(it.title) + '</b><div class="kick">' + esc(areaLabel(it.area, it)) + '</div></button>' + bucketPicks(it) + (it._err ? '<div class="soft-err">' + esc(it._err) + '</div>' : '') + '<button type="button" class="ghost-x" data-del="' + esc(it.id) + '" aria-label="Delete">x</button></div>';
      }).join('') + '</div>';
    }).join('') + '</div></div>'
      + (evening && moves.length ? '<div class="eod"><div class="h">End of day review <span class="time">' + doneN + ' of ' + Math.min(3, moves.length) + ' done</span></div>' + eodLines + '<div class="foot">You moved <b>' + doneN + ' of ' + Math.min(3, moves.length) + '</b> needle-movers. Lock tomorrow\'s one thing now, keep the streak alive.</div></div>' : '');
    bindWar();
  }

  function bindWar() {
    var add = document.getElementById('opsAddBtn');
    if (add) add.onclick = function () { var input = document.getElementById('opsAdd'); saveItem(input.value, input.getAttribute('data-col') || 'today'); input.value = ''; };
    document.querySelectorAll('[data-add-col]').forEach(function (btn) {
      btn.onclick = function () { saveItem('', btn.getAttribute('data-add-col')); };
    });
    var find = document.getElementById('findSlot');
    if (find) find.onclick = openSlots;
    var full = document.getElementById('execFull');
    if (full) full.onclick = function () {
      document.body.classList.toggle('exec-full');
      full.textContent = document.body.classList.contains('exec-full') ? 'Close full-screen' : '\u2197 Expand full-screen';
    };
    var commit = document.getElementById('focusCommit');
    if (commit) commit.onclick = function () {
      var move = ((STATE.ceo && STATE.ceo.moves) || [])[0];
      if (!move || !moveLabel(move)) return;
      var map = {};
      try { map = JSON.parse(localStorage.getItem('cr_needle') || '{}'); } catch (err) { map = {}; }
      if (map.day !== laDay(Date.now())) map = { day: laDay(Date.now()), ids: {} };
      map.one = String(move.id || '');
      try { localStorage.setItem('cr_needle', JSON.stringify(map)); } catch (err) {}
      saveItem(moveLabel(move), 'today');
      commit.textContent = 'Committed for today';
      commit.disabled = true;
    };
    var focus = document.getElementById('focusStart');
    if (focus) focus.onclick = function () {
      STATE.focusUntil = Date.now() + 25 * 60 * 1000;
      if (STATE.focusTimer) clearInterval(STATE.focusTimer);
      STATE.focusTimer = setInterval(function () {
        var clock = document.getElementById('focusClock');
        if (!clock || !STATE.focusUntil) return;
        var left = STATE.focusUntil - Date.now();
        if (left <= 0) { clock.textContent = '00:00'; clearInterval(STATE.focusTimer); return; }
        var m = String(Math.floor(left / 60000)).padStart(2, '0');
        var s = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
        clock.textContent = m + ':' + s;
      }, 1000);
    };
    var plan = document.getElementById('focusPlan');
    if (plan) plan.onclick = function () {
      var move = ((STATE.ceo && STATE.ceo.moves) || [])[0];
      if (move && typeof openPlan === 'function') openPlan(move.id || 'one', moveLabel(move) || 'The one thing', 'investors');
    };
    var later = document.getElementById('focusLater');
    if (later) later.onclick = function () {
      var move = ((STATE.ceo && STATE.ceo.moves) || [])[0];
      if (!move || !move.id) return;
      authFetch('/api/ceo/moves/' + move.id + '/snooze', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'not now' }) }).catch(function () {});
    };
    document.querySelectorAll('[data-needle]').forEach(function (box) {
      box.onclick = function (e) {
        e.stopPropagation();
        var map = {};
        try { map = JSON.parse(localStorage.getItem('cr_needle') || '{}'); } catch (err) { map = {}; }
        if (map.day !== laDay(Date.now())) map = { day: laDay(Date.now()), ids: {} };
        map.ids = map.ids || {};
        map.ids[box.getAttribute('data-needle')] = box.checked;
        try { localStorage.setItem('cr_needle', JSON.stringify(map)); } catch (err) {}
        renderWar();
      };
    });
    document.querySelectorAll('.exec-card').forEach(function (card) {
      card.ondragstart = function (e) { e.dataTransfer.setData('text', card.getAttribute('data-item')); };
    });
    document.querySelectorAll('.exec-col').forEach(function (col) {
      col.ondragover = function (e) { e.preventDefault(); };
      col.ondrop = function (e) {
        e.preventDefault();
        setBucket(e.dataTransfer.getData('text'), col.getAttribute('data-col'));
      };
    });
    document.querySelectorAll('[data-done]').forEach(function (box) {
      box.onclick = function (e) {
        e.stopPropagation();
        var id = box.getAttribute('data-done');
        var it = (STATE.items || []).filter(function (row) { return row.id === id; })[0];
        if (it) it.status = 'done';
        renderWar();
        if (typeof renderOpsDash === 'function') renderOpsDash();
        function send() {
          return authFetch('/api/items/' + id, { method: 'PATCH', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'done' }) }).then(function (r) { if (!r.ok) throw 0; });
        }
        send().catch(function () { return send(); }).catch(function () {});
      };
    });
    document.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        if (!window.confirm('Delete this task?')) return;
        authFetch('/api/items/' + btn.getAttribute('data-del'), { method: 'DELETE', credentials: 'same-origin' }).then(function () { return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(applyBoard).catch(function () {});
      };
    });
    document.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.onclick = function () { editItem(btn.getAttribute('data-edit')); };
    });
    document.querySelectorAll('[data-reach-kind]').forEach(function (btn) {
      btn.onclick = function () { STATE.reachKind = btn.getAttribute('data-reach-kind'); renderWar(); };
    });
    document.querySelectorAll('[data-reach-done]').forEach(function (box) {
      box.onclick = function (e) {
        e.stopPropagation();
        var person = (STATE.reachOut || []).filter(function (row) { return row.id === box.getAttribute('data-reach-done'); })[0];
        if (!person) return;
        person.done = !!box.checked;
        if (box.checked) saveItem(person.nextAction || 'Reach out', 'today', 'Reach out - ' + (person.kind === 'design' ? 'Design partner' : (person.kind || 'Corporate')));
        authFetch('/api/reach-out/' + person.id, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ done: person.done }) }).catch(function () {});
        renderWar();
      };
    });
    document.querySelectorAll('[data-reach-task]').forEach(function (btn) {
      btn.onclick = function () {
        var person = (STATE.reachOut || []).filter(function (row) { return row.id === btn.getAttribute('data-reach-task'); })[0];
        if (!person) return;
        var label = { corporate: 'Corporate', vc: 'VC', client: 'Client', design: 'Design partner', regulator: 'Regulator' }[person.kind] || 'Corporate';
        saveItem(person.nextAction || 'Reach out', 'today', 'Reach out - ' + label);
      };
    });
    document.querySelectorAll('[data-set-bucket]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        e.preventDefault();
        setBucket(btn.getAttribute('data-set-bucket'), btn.getAttribute('data-col'));
      };
    });
  }

  function saveItem(title, col, category) {
    title = String(title || '').trim() || 'Untitled task';
    var temp = { id: 'tmp-' + Date.now(), title: title, area: 'other', status: 'new', priority: 'normal', due: dueFor(col), notes: '', category: category || '' };
    STATE.items = (STATE.items || []).concat([temp]);
    renderWar();
    authFetch('/api/items', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: title, area: 'other', due: dueFor(col), category: category || '' }) }).then(function (r) { if (!r.ok) throw 0; return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(applyBoard).catch(function () { temp._err = 'Not saved yet'; renderWar(); });
  }

  function loadReach() {
    authFetch('/api/reach-out', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
      STATE.reachOut = (d && d.people) || [];
      if (STATE.desk === 'war') renderWar();
      if (STATE.desk === 'room') renderOpsDash();
    }).catch(function () { STATE.reachOut = STATE.reachOut || []; });
  }

  function editItem(id) {
    var it = (STATE.items || []).filter(function (row) { return row.id === id; })[0];
    if (!it) return;
    var card = document.getElementById('modalCard');
    var modal = document.getElementById('modal');
    if (!card || !modal) return;
    card.innerHTML = '<div class="mhd"><div style="font-weight:700">Edit task</div><button class="x" id="mClose" type="button">x</button></div><form class="mbd" id="opsEdit"><label>Title<input id="opsTitle" type="text" value="' + esc(it.title) + '" style="width:100%;margin-top:4px"/></label><label style="display:block;margin-top:8px">Notes<textarea id="opsNotes" rows="4" style="width:100%;margin-top:4px">' + esc(it.notes || '') + '</textarea></label><div class="soft-err" id="opsEditErr"></div><button class="btn pri sm" type="submit" style="margin-top:10px">Save</button></form>';
    modal.classList.add('open');
    modal.hidden = false;
    document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
    document.getElementById('opsEdit').onsubmit = function (e) {
      e.preventDefault();
      var next = document.getElementById('opsTitle').value.trim() || 'Untitled task';
      it.title = next;
      it.notes = document.getElementById('opsNotes').value;
      authFetch('/api/items', { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id, title: next, notes: it.notes }) }).then(function (r) { if (!r.ok) throw 0; if (typeof closeModal === 'function') closeModal(); return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(applyBoard).catch(function () { var err = document.getElementById('opsEditErr'); if (err) err.textContent = 'Not saved yet'; renderWar(); });
    };
  }

  function slotHead(day) {
    var bits = String(day || '').split('-');
    if (bits.length < 3) return day || 'Today';
    var when = new Date(Date.UTC(Number(bits[0]), Number(bits[1]) - 1, Number(bits[2])));
    if (Number.isNaN(when.getTime())) return day;
    var wk = when.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    return wk + ' ' + Number(bits[2]);
  }

  function openSlots() {
    var card = document.getElementById('modalCard');
    var modal = document.getElementById('modal');
    if (!card || !modal) return;
    card.classList.add('wide');
    card.innerHTML = '<div class="mhd"><div style="font-weight:700">Open 30-minute slots</div><button class="x" id="mClose" type="button">x</button></div><div class="mbd" id="slotList">Reading the calendar.</div>';
    modal.classList.add('open');
    modal.hidden = false;
    document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
    authFetch('/api/calendar/slots', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      var list = document.getElementById('slotList');
      if (!list) return;
      var slots = data.slots || [];
      var days = [];
      slots.forEach(function (slot) { if (days.indexOf(slot.day) < 0) days.push(slot.day || 'Today'); });
      list.innerHTML = (data.error ? '<div class="kick">' + esc(data.error) + '</div>' : '') + '<div class="slot-cal">' + (days.length ? days : ['Today']).map(function (day) {
        var rows = slots.filter(function (slot) { return (slot.day || 'Today') === day; });
        return '<div class="slot-day"><div class="day">' + esc(slotHead(day)) + '</div>' + rows.map(function (slot) {
          var time = String(slot.label || '').split(' ').pop();
          return '<button class="slot" type="button" data-start="' + slot.start + '"' + (slot.free ? '' : ' disabled') + '>' + esc(time) + (slot.free ? '' : ' busy') + '</button>';
        }).join('') + '</div>';
      }).join('') + '</div>';
      list.querySelectorAll('.slot').forEach(function (btn) {
        btn.onclick = function () {
          btn.disabled = true;
          authFetch('/api/calendar/slots', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ start: Number(btn.getAttribute('data-start')) }) }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw d; btn.textContent = btn.textContent + ' - booked'; }); }).catch(function () { btn.disabled = false; });
        };
      });
    }).catch(function () {
      var list = document.getElementById('slotList');
      if (list) list.textContent = 'Calendar could not be read.';
    });
  }

  function renderNews(items, categories) {
    var el = document.getElementById('newsDesk');
    if (!el) return;
    var cats = categories && categories.length ? categories : ['All'];
    var on = STATE.newsCat || 'All';
    var q = String(STATE.newsQ || '').toLowerCase();
    var all = items || [];
    var rows = all.filter(function (item) { return on === 'All' || item.category === on; }).filter(function (item) { return !q || ((item.title || '') + ' ' + (item.summary || '')).toLowerCase().indexOf(q) >= 0; });
    var start = new Date();
    start.setHours(0, 0, 0, 0);
    var isToday = function (item) { return Date.parse(item.publishedAt || item.published_at || 0) >= start.getTime(); };
    if (STATE.newsSpan === 'today') {
      var todays = rows.filter(isToday);
      if (todays.length) rows = todays;
    }
    var top = rows.filter(function (item) { return item.is_top || item.isTop; })[0] || rows[0];
    var rest = rows.filter(function (item) { return item !== top; });
    function impactOf(item) {
      var cat = String(item.category || '').toLowerCase();
      var blob = (cat + ' ' + (item.title || '') + ' ' + (item.summary || '')).toLowerCase();
      if (/competitor|vanta|drata|aveni|secureframe|\bthreat\b/.test(blob)) return ['threat', 'Threat', 'g2'];
      if (/grant|non-dilutive|innovate/.test(blob)) return ['opp', 'Opportunity', 'g4'];
      if (/mortgage|housing|broker/.test(cat)) return ['opp', 'Opportunity', 'g3'];
      if (/fraud|scam|breach/.test(blob)) return ['reg', 'Regulatory', 'g6'];
      if (/venture|fundraising|angel round|series [a-d]|pre-seed|seed round/.test(blob) && !/fintrac|osfi|fcac|aml/.test(cat)) return ['opp', 'Opportunity', 'g5'];
      if (/regulat|fintrac|osfi|csa|fcac|compliance|rpaa|payment|aml/.test(blob)) return ['reg', 'Regulatory', 'g1'];
      return ['opp', 'Opportunity', ['g1', 'g3', 'g4', 'g5'][String(item.title || '').length % 4]];
    }
    function host(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
    function when(item) {
      var ts = Date.parse(item.publishedAt || item.published_at || 0);
      if (!ts) return '';
      if (ts >= start.getTime()) return 'today';
      var d = Math.floor((start.getTime() - ts) / 86400000) + 1;
      return d === 1 ? 'yesterday' : d + 'd ago';
    }
    function face(item) { return item.image ? ' style="background-image:linear-gradient(rgba(0,0,0,.05),rgba(0,0,0,.35)),url(' + esc(item.image) + ');background-size:cover;background-position:center"' : ''; }
    function story(item) {
      var hit = impactOf(item);
      var src = [host(item.url || ''), when(item)].filter(Boolean).join(' &middot; ');
      return '<div class="card story" data-news-url="' + esc(item.url || '') + '" data-news-title="' + esc(item.title || '') + '"><div class="img ' + hit[2] + '"' + face(item) + '><span class="cat">' + esc(item.category || 'News') + '</span><span class="tag ' + hit[0] + '">' + hit[1] + '</span></div><div class="b"><div class="h">' + esc(item.title || '') + '</div><div class="tk">' + esc(item.summary || '') + '</div><div class="foot">' + src + '<button type="button" class="save" data-news-save="' + esc(item.title || '') + '">Save &#8250;</button></div></div></div>';
    }
    var hero = '';
    if (top) {
      var hh = impactOf(top);
      var heroSrc = [host(top.url || ''), top.publishedAt ? new Date(top.publishedAt).toLocaleDateString('en-CA') : ''].filter(Boolean).join(' &middot; ');
      var t1 = esc(top.title || '');
      hero = '<div class="card hero"><div class="img ' + hh[2] + '"' + face(top) + '><span class="kick">Top release ' + (isToday(top) ? 'today' : 'this ' + (STATE.newsSpan === 'week' ? 'week' : 'month')) + ' &middot; ' + esc(top.category || 'News') + '</span><span class="impact ' + hh[0] + '">' + hh[1] + '</span><div class="h">' + t1 + '</div></div><div class="b"><div class="take"><b>Why it matters to 4orm:</b> ' + esc(top.summary || 'Read the source and decide where it lands - deck, regulator note or a VC follow-up.') + '</div>' + (heroSrc ? '<div class="src">' + heroSrc + '</div>' : '') + '<div class="actions"><button type="button" class="act pri" data-news-act="post" data-news-title="' + t1 + '"><span class="mk">&#10022;</span> Draft a LinkedIn post</button><button type="button" class="act" data-news-act="letter" data-news-title="' + t1 + '"><span class="mk">&#10022;</span> Add to investor newsletter</button><button type="button" class="act" data-news-act="vc" data-news-title="' + t1 + '">Cite to a VC</button><button type="button" class="act" data-news-save="' + t1 + '">Save to ' + esc(top.category || 'a') + ' space</button><button type="button" class="act" data-news-act="open" data-news-title="' + t1 + '" data-news-url="' + esc(top.url || '') + '">Open source</button></div></div></div>';
    }
    var empty = rows.length ? '' : '<div class="card nw-empty">The 8:00 and 11:00 Pacific sweeps fill this. Refresh pulls a fresh scrape.</div>';
    var briefRows = (top ? [top] : []).concat(rest).slice(0, 5);
    var brief = briefRows.map(function (item, i) { return '<div class="r"><span class="n">' + (i + 1) + '</span>' + esc(item.title || '') + '</div>'; }).join('') || '<div class="r">The sweep fills the briefing.</div>';
    var comps = ['Vanta', 'Drata', 'Aveni', 'Secureframe'].map(function (name) {
      var hits = all.filter(function (item) { return ((item.title || '') + ' ' + (item.summary || '')).toLowerCase().indexOf(name.toLowerCase()) >= 0; }).sort(function (x, y) { return Date.parse(y.publishedAt || 0) - Date.parse(x.publishedAt || 0); });
      var hit = hits[0];
      var age = hit ? Math.max(0, Math.floor((Date.now() - Date.parse(hit.publishedAt || 0)) / 86400000)) : null;
      var color = age == null ? '#c6cfdd' : age <= 2 ? '#f23a4d' : age <= 7 ? '#f0a020' : '#c6cfdd';
      var line = hit ? String(hit.title || '').slice(0, 46) : 'quiet';
      return { age: age == null ? 999 : age, html: '<div class="comprow"><span class="d" style="background:' + color + '"></span>' + (hit && line.toLowerCase().indexOf(name.toLowerCase()) === 0 ? esc(line) : esc(name) + ' - ' + esc(line)) + '<span class="mt">' + (age == null ? '-' : age === 0 ? 'today' : age + 'd') + '</span></div>' };
    }).sort(function (x, y) { return x.age - y.age; }).map(function (c) { return c.html; }).join('');
    var topics = ['RPAA', 'suitability', 'broker conduct', 'AML', 'non-dilutive', 'safeguarding', 'consumer understanding'];
    var trend = topics.map(function (topic) {
      var n = all.filter(function (item) { return ((item.title || '') + ' ' + (item.summary || '')).toLowerCase().indexOf(topic.toLowerCase()) >= 0; }).length;
      return { topic: topic, n: n };
    }).sort(function (x, y) { return y.n - x.n; }).map(function (row) {
      return '<button type="button" class="tp' + (q === row.topic.toLowerCase() ? ' on' : '') + '" data-news-topic="' + esc(row.topic) + '">' + esc(row.topic) + (row.n >= 2 ? ' <b>&#9650;</b>' : '') + '</button>';
    }).join('');
    var chips = ['All'].concat(cats.filter(function (c) { return c !== 'All'; })).map(function (c) {
      return '<span class="chip' + (c === on ? ' on' : '') + '"><button type="button" data-news="' + esc(c) + '">' + esc(c) + '</button>' + (c === 'All' ? '' : '<button type="button" class="ghost-x" data-news-del="' + esc(c) + '" aria-label="Remove category"></button>') + '</span>';
    }).join('');
    var span = STATE.newsSpan === 'today' ? 'today' : STATE.newsSpan === 'week' ? 'week' : 'month';
    el.innerHTML = '<div class="nwx"><div class="top"><span class="t">News</span><div class="seg" id="newsSpan"><button type="button" data-span="today"' + (span === 'today' ? ' class="on"' : '') + '>Today</button><button type="button" data-span="week"' + (span === 'week' ? ' class="on"' : '') + '>Last week</button><button type="button" data-span="month"' + (span === 'month' ? ' class="on"' : '') + '>Last month</button></div><button class="btn" id="newsRefresh" type="button">Refresh</button><div class="right"><input class="search" id="newsSearch" type="text" placeholder="Search news..." value="' + esc(STATE.newsQ || '') + '"/><span class="sweeps">8AM + 11AM SWEEPS</span></div></div><div class="chips">' + chips + '</div><div class="wrap"><div>' + hero + empty + '<div class="grid">' + rest.map(story).join('') + '</div></div><div class="rail"><div class="card"><div class="ch"><span class="mk">4</span><span class="t">Your briefing</span><span class="s">' + briefRows.length + ' things ' + (span === 'today' ? 'today' : 'this ' + span) + '</span></div><div class="brief">' + brief + '</div></div><div class="card"><div class="ch"><span class="t">Competitor watch</span><span class="s">Drata / Vanta / Aveni</span></div><div class="comp">' + comps + '</div></div><div class="card"><div class="ch"><span class="t">Trending for 4orm</span></div><div class="trend">' + trend + '</div></div></div></div></div>';
    var search = document.getElementById('newsSearch');
    if (search) search.oninput = function () {
      var pos = search.selectionStart;
      STATE.newsQ = search.value;
      renderNews(STATE.news || [], STATE.newsCategories || cats);
      var again = document.getElementById('newsSearch');
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) {} }
    };
    el.querySelectorAll('[data-span]').forEach(function (btn) {
      btn.onclick = function () {
        var span = btn.getAttribute('data-span');
        STATE.newsSpan = span === 'today' ? 'today' : (span === 'week' ? 'week' : 'month');
        loadNews();
      };
    });
    el.querySelectorAll('[data-news]').forEach(function (btn) {
      btn.onclick = function () { STATE.newsCat = btn.getAttribute('data-news'); renderNews(STATE.news || [], STATE.newsCategories || cats); };
    });
    el.querySelectorAll('[data-news-act]').forEach(function (btn) {
      btn.onclick = function () {
        var title = btn.getAttribute('data-news-title') || 'Story';
        var act = btn.getAttribute('data-news-act');
        if (act === 'open') { if (typeof openLink === 'function') openLink(title, btn.getAttribute('data-news-url')); return; }
        saveItem((act === 'post' ? 'LinkedIn: ' : act === 'letter' ? 'Newsletter: ' : 'Cite to a VC: ') + title, 'week');
        if (typeof deskNote === 'function') deskNote('Added to This week.');
      };
    });
    el.querySelectorAll('[data-news-url]').forEach(function (btn) {
      btn.onclick = function () { if (typeof openLink === 'function') openLink(btn.getAttribute('data-news-title'), btn.getAttribute('data-news-url')); };
    });
    el.querySelectorAll('[data-news-save]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        saveItem('News for a space: ' + (btn.getAttribute('data-news-save') || 'Story'), 'week');
        if (typeof deskNote === 'function') deskNote('Saved as a This week task.');
      };
    });
    el.querySelectorAll('[data-news-topic]').forEach(function (btn) {
      btn.onclick = function () {
        var topic = btn.getAttribute('data-news-topic');
        STATE.newsCat = 'All';
        STATE.newsQ = String(STATE.newsQ || '').toLowerCase() === topic.toLowerCase() ? '' : topic;
        renderNews(STATE.news || [], STATE.newsCategories || cats);
      };
    });
    var refresh = document.getElementById('newsRefresh');
    if (refresh) refresh.onclick = function () {
      refresh.disabled = true;
      authFetch('/api/news/refresh', { method: 'POST', credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
        STATE.news = data.items || [];
        STATE.newsCategories = data.categories || STATE.newsCategories;
        renderNews(STATE.news, STATE.newsCategories);
      }).catch(function () { refresh.disabled = false; });
    };
    el.querySelectorAll('[data-news-del]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        if (!window.confirm('Remove this category? Articles stay.')) return;
        authFetch('/api/news/categories/' + encodeURIComponent(btn.getAttribute('data-news-del')), { method: 'DELETE', credentials: 'same-origin' }).then(loadNews).catch(function () {});
      };
    });
  }

  function loadNews() {
    authFetch('/api/news' + (STATE.newsSpan === 'week' ? '?span=week' : '?span=month'), { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      STATE.news = data.items || [];
      STATE.newsCategories = data.categories || [];
      renderNews(STATE.news, STATE.newsCategories);
    }).catch(function () { renderNews([], ['Compliance', 'AI', 'Counseling', 'Fintech & regulation', 'Mortgage', 'Fraud & scams', 'Grants', 'Payments / FINTRAC']); });
  }

  function flatFiles(nodes, out) {
    (nodes || []).forEach(function (node) {
      (node.files || node.docs || []).forEach(function (file) { out.push(file); });
      flatFiles(node.children || node.folders || [], out);
    });
    return out;
  }

  function libFolders() {
    var names = (STATE.docFolders && STATE.docFolders.length ? STATE.docFolders.slice() : CATS.slice());
    (STATE.staged || []).forEach(function (d) { if (d.category && names.indexOf(d.category) < 0) names.push(d.category); });
    return names;
  }

  function docKind(d) {
    var n = String(d.name || '').toLowerCase();
    var m = String(d.mime || '').toLowerCase();
    if (m.indexOf('image/') === 0 || /\.(png|jpe?g|gif|webp)$/.test(n)) return 'images';
    if (m.indexOf('pdf') >= 0 || n.slice(-4) === '.pdf') return 'pdf';
    if (/ppt|presentation/.test(m) || /\.pptx?$/.test(n)) return 'slides';
    if (/sheet|excel|csv/.test(m) || /\.(xlsx?|csv)$/.test(n)) return 'sheets';
    return 'docs';
  }

  function docUsed(d) {
    var names = (STATE.docUse && STATE.docUse[d.id]) ? STATE.docUse[d.id].slice() : [];
    (STATE.packages || []).forEach(function (p) {
      (p.docs || []).forEach(function (x) {
        if ((d.driveFileId && x.driveFileId === d.driveFileId) || (x.name && x.name === d.name)) {
          if (names.indexOf(p.name) < 0) names.push(p.name);
        }
      });
    });
    return names;
  }

  function docSets() {
    var base = [['investor', 'Investor data room', ['VC', 'Angel', 'Friends & Fam']], ['regulator', 'Regulator pack', ['Regulator', 'Government']], ['ff', 'F&F bundle', ['Friends & Fam']]];
    var mine = [];
    try { mine = JSON.parse(localStorage.getItem('cr_doc_sets') || '[]'); } catch (err) { mine = []; }
    return base.concat((mine || []).filter(function (s) { return s && s.id; }).map(function (s) { return [s.id, s.name || 'Untitled set', [], s.ids || []]; }));
  }

  function inSet(set, d) {
    if (set[3]) return set[3].indexOf(d.id) >= 0;
    return set[2].indexOf(d.category) >= 0;
  }

  function libraryMarkup(docs, folders) {
    var sets = docSets();
    var active = STATE.docFolder && folders.indexOf(STATE.docFolder) >= 0 ? STATE.docFolder : (folders[0] || '');
    var types = [['all', 'All'], ['pdf', 'PDF'], ['slides', 'Slides'], ['sheets', 'Sheets'], ['docs', 'Docs'], ['images', 'Images']];
    var wheres = [['space', 'In a space'], ['drive', 'From Drive'], ['upload', 'Uploaded']];
    var q = String(STATE.docQ || '').toLowerCase();
    var tree = folders.map(function (c) {
      var n = docs.filter(function (d) { return d.category === c; }).length;
      var on = c === active && !STATE.docSet;
      return '<div class="row lib-card' + (on ? ' on' : '') + '" data-cat="' + esc(c) + '" data-pick-folder="' + esc(c) + '"><span class="chev">' + (on ? '\u25be' : '\u25b8') + '</span><input data-lib-rename="' + esc(c) + '" value="' + esc(c) + '" aria-label="Folder name"><span class="ct">' + n + '</span><button type="button" class="ghost-x" data-lib-folder-x="' + esc(c) + '" aria-label="Delete folder">x</button></div>';
    }).join('');
    var setHtml = sets.map(function (s) {
      var n = docs.filter(function (d) { return inSet(s, d); }).length;
      return '<div class="row' + (STATE.docSet === s[0] ? ' on' : '') + '" data-doc-set="' + esc(s[0]) + '"><span class="pin">\u2605</span>' + esc(s[1]) + '<span class="ct">' + n + '</span></div>';
    }).join('');
    var chips = '<div class="chips">' + types.map(function (t) { return '<button type="button" class="fchip' + ((STATE.docType || 'all') === t[0] ? ' on' : '') + '" data-doc-type="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div class="chips">' + wheres.map(function (t) { return '<button type="button" class="fchip' + (STATE.docWhere === t[0] ? ' on' : '') + '" data-doc-where="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    var title = active;
    var pool = docs.filter(function (d) {
      if (q) return String(d.name || '').toLowerCase().indexOf(q) >= 0 || String(d.category || '').toLowerCase().indexOf(q) >= 0;
      if (STATE.docSet) {
        var set = sets.filter(function (s) { return s[0] === STATE.docSet; })[0];
        if (set) { title = set[1]; if (!inSet(set, d)) return false; }
      } else if (d.category !== active) return false;
      if ((STATE.docType || 'all') !== 'all' && docKind(d) !== STATE.docType) return false;
      var used = docUsed(d);
      var where = used.length ? 'space' : (d.driveFileId ? 'drive' : 'upload');
      if (STATE.docWhere && STATE.docWhere !== 'all' && where !== STATE.docWhere) return false;
      return true;
    });
    if (q) title = 'Search: ' + STATE.docQ;
    var picked = STATE.docPick || {};
    var tiles = pool.map(function (d) {
      var image = (d.mime || '').indexOf('image/') === 0;
      var kind = ((d.name || '').split('.').pop() || 'file').slice(0, 4).toUpperCase();
      var k = docKind(d);
      var cls = k === 'pdf' ? ' pdf' : k === 'sheets' ? ' xls' : k === 'images' ? ' img' : '';
      var src = image ? ('/api/documents/file?id=' + encodeURIComponent(d.id)) : (d.driveFileId ? ('https://drive.google.com/thumbnail?id=' + encodeURIComponent(d.driveFileId) + '&sz=w400') : '');
      var sheet = image ? '' : '<div class="sheet"><div class="ln t"></div><div class="ln"></div><div class="ln s"></div><div class="ln"></div></div>';
      var face = (src ? '<img alt="" src="' + src + '" onload="var k=this.parentNode.querySelector(\'.sheet\');if(k)k.hidden=true" onerror="this.hidden=true"/>' : '') + sheet;
      var used = docUsed(d);
      var on = picked[d.id] ? ' sel' : '';
      return '<div class="doc' + on + ' mini-wrap" draggable="true" data-lib-inline="' + esc(d.id) + '"><input class="ck pick" type="checkbox" data-lib-pick="' + esc(d.id) + '"' + (picked[d.id] ? ' checked' : '') + ' aria-label="Select"><span class="sync ' + (d.driveFileId ? 'ok' : 'local') + '"></span><button type="button" class="ghost-x" data-lib-x="' + esc(d.id) + '" aria-label="Delete file">x</button><button type="button" class="mini"><div class="page' + cls + '">' + face + '<span class="typ">' + esc(kind) + '</span></div><div class="m"><div class="nm">' + esc(d.name || 'File') + '</div><span class="usein' + (used.length ? '' : ' none') + '">' + esc(used.length ? 'in: ' + used.slice(0, 2).join(', ') : 'not in a space') + '</span>' + (d._err ? '<span class="usein none">' + esc(d._err) + '</span>' : '') + '</div></button></div>';
    }).join('');
    var ids = Object.keys(picked);
    var menu = STATE.docMenu === 'space' ? '<div class="dmenu">' + ((STATE.packages || []).map(function (p) { return '<button type="button" data-lib-to-space="' + esc(p.id) + '">' + esc(p.name) + '</button>'; }).join('') || '<div class="hintbar">No spaces yet.</div>') + '</div>' : STATE.docMenu === 'move' ? '<div class="dmenu">' + folders.map(function (c) { return '<button type="button" data-lib-move-to="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' : '';
    var bar = ids.length ? '<div class="selbar"><b>' + ids.length + ' selected</b><div class="sp"><button type="button" class="act go" id="libAddSpace">Add to Space \u25be</button><button type="button" class="act" id="libBuildSpace">Build a Space</button><button type="button" class="act" id="libPushSel">Push to Drive</button><button type="button" class="act" id="libMoveSel">Move \u25be</button><button type="button" class="act" id="libDelSel">Delete</button></div>' + menu + '</div>' : '';
    var rail = (STATE.packages || []).slice(0, 12).map(function (p) {
      var ini = String(p.name || 'S').replace(/[^A-Za-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
      var n = (p.docs || []).length;
      return '<div class="spacedrop" data-space-drop="' + esc(p.id) + '"><div class="d">' + esc(ini) + '</div><div><div class="nm">' + esc(p.name) + '</div><div class="sub">' + n + ' doc' + (n === 1 ? '' : 's') + ' \u00b7 drop to add</div></div></div>';
    }).join('');
    var recent = docs.slice(-5).reverse().map(function (d) { var k = docKind(d); var ic = k === 'pdf' ? 'PDF' : k === 'sheets' ? 'XLS' : k === 'slides' ? 'PPT' : k === 'images' ? 'IMG' : 'DOC'; return '<div class="ri"><span class="ic">' + ic + '</span>' + esc(d.name || 'File') + '</div>'; }).join('') || '<div class="hintbar" style="padding:4px 0">Nothing added yet.</div>';
    var view = STATE.docView === 'list' ? 'list' : 'grid';
    return '<div class="dcx"><div class="head"><span class="t">Documents</span><input class="search" id="libSearch" type="search" placeholder="Search all documents - name, type, or what\'s inside" value="' + esc(STATE.docQ || '') + '"><div class="seg"><button type="button" data-doc-view="grid"' + (view === 'grid' ? ' class="on"' : '') + '>Grid</button><button type="button" data-doc-view="list"' + (view === 'list' ? ' class="on"' : '') + '>List</button></div><button type="button" class="btn" id="libAddFolder">+ Folder</button><button type="button" class="btn pri" id="libNewSet">New set</button></div><div class="cap">Your staging library and launchpad: <button type="button" class="lk" id="libPullOpen">pull from Drive</button>, <label class="lk">upload<input id="libUpload" class="file-in" type="file" multiple></label>, preview inline, select, and drop straight into a Space to build a send-bundle.</div><div class="wrap"><div class="card side"><div class="sh">Folders <button type="button" class="add" id="libAddFolder2">+ new</button></div><div class="doc-tree">' + tree + '</div><div class="divide"></div><div class="sh">Sets <button type="button" class="add" id="libNewSet2">+ new</button></div><div class="set">' + setHtml + '</div><div class="divide"></div><div class="sh">Filter by type</div>' + chips + '</div><div id="libDrop">' + bar + '<div class="grid doc-grid' + (view === 'list' ? ' list' : '') + '">' + (tiles || '<div class="empty">No files in ' + esc(title) + ' yet. Drop files here, or pull them from Drive.</div>') + '</div></div><div class="card rr"><div class="sh">Drag docs into a Space</div><div class="spacelist">' + rail + '<div class="spacedrop build" id="libBuildSpace2"><div class="d">+</div><div><div class="nm">Build a new Space</div><div class="sub">from the selection</div></div></div></div><div class="divide"></div><div class="sh">Recently added</div><div class="recent">' + recent + '</div><div class="hintbar">Green dot = synced to Drive \u00b7 amber = local only. <button type="button" class="lk" id="libInc">Top incumbents</button></div></div></div></div>';
  }

  function openPullDrive(active, folders) {
    var modal = document.getElementById('modal');
    var box = document.getElementById('modalCard');
    if (!modal || !box) return;
    box.classList.remove('wide');
    box.innerHTML = '<div class="mhd"><div style="font-weight:700">Pull from Drive</div><button class="x" id="mClose" type="button">x</button></div><div class="mbd dcx-pull"><label>Folder<select id="libCat" aria-label="Folder">' + folders.map(function (c) { return '<option' + (c === active ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label><label>Drive file<select id="libFile" aria-label="Drive file"><option value="">Choose a Drive file</option>' + flatFiles(STATE.drives || [], []).map(function (file) { return '<option value="' + esc(file.id) + '" data-url="' + esc(file.url || '') + '" data-name="' + esc(file.name || '') + '">' + esc(file.name || 'File') + '</option>'; }).join('') + '</select></label><div class="cap"><button class="btn sm pri" id="libPull" type="button">Pull into this folder</button><button class="btn sm" id="libPush" type="button">Push this folder to Drive</button></div></div>';
    modal.classList.add('open');
    modal.hidden = false;
    document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
    document.getElementById('libPull').onclick = function () {
      var sel = document.getElementById('libFile');
      var opt = sel.options[sel.selectedIndex];
      if (!opt || !opt.value) return;
      authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'pull', category: document.getElementById('libCat').value, name: opt.getAttribute('data-name'), url: opt.getAttribute('data-url'), driveFileId: opt.value }) }).then(function () { if (typeof closeModal === 'function') closeModal(); loadLibrary(); }).catch(function () {});
    };
    document.getElementById('libPush').onclick = function () { pushFolder(document.getElementById('libCat').value); };
  }

  function pushFolder(cat) {
    authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'push', category: cat }) }).then(function (r) { return r.json(); }).then(function (d) { if (d && d.error) window.alert(d.error); }).catch(function () {});
  }

  function renderLibrary() {
    var el = document.getElementById('opsLibrary');
    if (!el || el.hidden) return;
    var docs = STATE.staged || [];
    var folders = libFolders();
    if (STATE.docPick) {
      var live = {};
      docs.forEach(function (d) { if (STATE.docPick[d.id]) live[d.id] = true; });
      STATE.docPick = live;
    }
    el.innerHTML = libraryMarkup(docs, folders);
    if (!STATE.docSpacesAsked && typeof loadPackages === 'function') {
      STATE.docSpacesAsked = true;
      loadPackages().then(function () { renderLibrary(); });
    }
    var activeFolder = STATE.docFolder && folders.indexOf(STATE.docFolder) >= 0 ? STATE.docFolder : (folders[0] || 'Dev');
    var pullOpen = document.getElementById('libPullOpen');
    if (pullOpen) pullOpen.onclick = function () { openPullDrive(activeFolder, folders); };
    var search = document.getElementById('libSearch');
    if (search) search.oninput = function () {
      STATE.docQ = search.value;
      var pos = search.selectionStart;
      renderLibrary();
      var again = document.getElementById('libSearch');
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (err) {} }
    };
    el.querySelectorAll('[data-doc-view]').forEach(function (btn) {
      btn.onclick = function () { STATE.docView = btn.getAttribute('data-doc-view'); renderLibrary(); };
    });
    function newSet() {
      var mine = [];
      try { mine = JSON.parse(localStorage.getItem('cr_doc_sets') || '[]'); } catch (err) { mine = []; }
      var id = 'set-' + Date.now();
      mine.push({ id: id, name: 'Untitled set', ids: Object.keys(STATE.docPick || {}) });
      try { localStorage.setItem('cr_doc_sets', JSON.stringify(mine)); } catch (err) {}
      STATE.docSet = id;
      renderLibrary();
    }
    ['libNewSet', 'libNewSet2'].forEach(function (id) { var b = document.getElementById(id); if (b) b.onclick = newSet; });
    var addFolder2 = document.getElementById('libAddFolder2');
    if (addFolder2) addFolder2.onclick = function () { var b = document.getElementById('libAddFolder'); if (b) b.click(); };
    function takeFiles(files, category) {
      var cat = category || activeFolder || 'Dev';
      if (!cat) cat = 'Dev';
      var list = [].slice.call(files || []);
      if (!list.length) return;
      if (typeof deskBusy === 'function') deskBusy(true);
      var jobs = list.map(function (file) {
        var temp = 'tmp-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        STATE.staged = (STATE.staged || []).concat([{ id: temp, category: cat, name: file.name || 'File', mime: file.type || '', driveFileId: '', url: '' }]);
        var body = new FormData();
        body.append('file', file);
        body.append('category', cat);
        body.append('name', file.name || 'File');
        body.append('mime', file.type || '');
        return authFetch('/api/documents/upload', { method: 'POST', credentials: 'same-origin', body: body }).then(function (r) {
          return r.json().then(function (d) { return { ok: !!(r.ok && d && d.ok), temp: temp }; });
        }).catch(function () { return { ok: false, temp: temp }; });
      });
      renderLibrary();
      Promise.all(jobs).then(function (results) {
        if (typeof deskBusy === 'function') deskBusy(false);
        var failed = results.filter(function (row) { return !row.ok; });
        if (!failed.length) { loadLibrary(); return; }
        failed.forEach(function (row) {
          var hit = (STATE.staged || []).filter(function (d) { return d.id === row.temp; })[0];
          if (hit) hit._err = 'Not saved yet';
        });
        renderLibrary();
      });
    }
    var drop = document.getElementById('libDrop');
    var upload = document.getElementById('libUpload');
    if (upload) upload.onchange = function () { takeFiles(upload.files, activeFolder); };
    if (drop) {
      drop.ondragover = function (e) { e.preventDefault(); };
      drop.ondrop = function (e) { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) takeFiles(e.dataTransfer.files, activeFolder); };
    }
    function openFolder(cat) {
      var modal = document.getElementById('modal');
      var box = document.getElementById('modalCard');
      if (!modal || !box) return;
      var files = docs.filter(function (d) { return d.category === cat; });
      box.classList.add('wide');
      var mode = 'grid';
      try { mode = localStorage.getItem('cr_lib_mode') || 'grid'; } catch (err) { mode = 'grid'; }
      box.innerHTML = '<div class="mhd"><div style="font-weight:700">' + esc(cat) + '</div><div class="seg" id="libMode"><button type="button" data-lib-mode="list"' + (mode === 'list' ? ' class="on"' : '') + '>List</button><button type="button" data-lib-mode="grid"' + (mode === 'grid' ? ' class="on"' : '') + '>Thumbnails</button></div><button class="x" id="mClose" type="button">x</button></div><div class="mbd"><div class="lib-pop' + (mode === 'list' ? ' list' : '') + '">' + (files.map(function (d) {
        var image = (d.mime || '').indexOf('image/') === 0;
        var kind = ((d.name || '').split('.').pop() || (d.mime || 'file').split('/').pop() || 'file').slice(0, 8).toUpperCase();
        var thumb = image ? '<img alt="" src="/api/documents/file?id=' + encodeURIComponent(d.id) + '">' : '<span class="type">' + esc(kind) + '</span>';
        return '<div class="lib-tile"><button type="button" data-lib-open="' + esc(d.id) + '">' + thumb + '<span class="dn">' + esc(d.name) + '</span></button><button type="button" data-lib-del="' + esc(d.id) + '" aria-label="Remove">x</button></div>';
      }).join('') || '<div class="kick">No files in this folder yet.</div>') + '</div></div>';
      modal.classList.add('open');
      modal.hidden = false;
      document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
      box.querySelectorAll('[data-lib-mode]').forEach(function (btn) {
        btn.onclick = function () {
          try { localStorage.setItem('cr_lib_mode', btn.getAttribute('data-lib-mode') || 'grid'); } catch (err) {}
          openFolder(cat);
        };
      });
      box.querySelectorAll('[data-lib-open]').forEach(function (btn) {
        btn.onclick = function () {
          var doc = files.filter(function (d) { return d.id === btn.getAttribute('data-lib-open'); })[0];
          if (!doc) return;
          var url = doc.driveFileId ? ('https://drive.google.com/file/d/' + encodeURIComponent(doc.driveFileId) + '/preview') : (doc.url || ('/api/documents/file?id=' + encodeURIComponent(doc.id)));
          openDocView(doc.name, url, '');
        };
      });
      box.querySelectorAll('[data-lib-del]').forEach(function (btn) {
        btn.onclick = function () {
          authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'remove', id: btn.getAttribute('data-lib-del') }) }).then(function () { if (typeof closeModal === 'function') closeModal(); loadLibrary(); }).catch(function () {});
        };
      });
    }
    var addFolder = document.getElementById('libAddFolder');
    if (addFolder) addFolder.onclick = function () {
      var box = document.getElementById('libFolderName');
      var name = box && box.value.trim() ? box.value.trim() : 'Untitled folder';
      STATE.docFolders = libFolders();
      if (STATE.docFolders.indexOf(name) < 0) STATE.docFolders.push(name);
      if (box) box.value = '';
      renderLibrary();
      authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add-folder', name: name }) }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.saved === false) return;
        loadLibrary();
      }).catch(function () {});
    };
    el.querySelectorAll('[data-lib-rename]').forEach(function (box) {
      box.onclick = function (e) { e.stopPropagation(); };
      box.onblur = function () {
        var from = box.getAttribute('data-lib-rename') || '';
        var name = box.value.trim() || from;
        if (!from || name === from) return;
        (STATE.staged || []).forEach(function (d) { if (d.category === from) d.category = name; });
        STATE.docFolders = libFolders().map(function (c) { return c === from ? name : c; });
        renderLibrary();
        authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'rename-folder', from: from, name: name }) }).catch(function () {});
      };
    });
    el.querySelectorAll('[data-lib-folder-x]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        var name = btn.getAttribute('data-lib-folder-x') || '';
        if (!name || !window.confirm('Delete this folder? Files move to Uncategorized.')) return;
        (STATE.staged || []).forEach(function (d) { if (d.category === name) d.category = 'Uncategorized'; });
        STATE.docFolders = libFolders().filter(function (c) { return c !== name; });
        if (STATE.docFolders.indexOf('Uncategorized') < 0) STATE.docFolders.push('Uncategorized');
        renderLibrary();
        authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'remove-folder', name: name }) }).catch(function () {});
      };
    });
    el.querySelectorAll('[data-lib-x]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-lib-x') || '';
        STATE.staged = (STATE.staged || []).filter(function (d) { return d.id !== id; });
        renderLibrary();
        if (id.indexOf('tmp-') === 0) return;
        authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'remove', id: id }) }).catch(function () {});
      };
    });
    var inc = document.getElementById('libInc');
    if (inc) inc.onclick = function () {
      var names = ['Vanta|https://www.vanta.com', 'Drata|https://drata.com', 'Secureframe|https://secureframe.com', 'Thoropass|https://thoropass.com', 'AutoRek|https://www.autorek.com', 'Aveni|https://aveni.ai', 'Fenergo|https://www.fenergo.com', 'Hummingbird|https://hummingbird.co', 'ComplyAdvantage|https://complyadvantage.com', 'Trulioo|https://www.trulioo.com'];
      var modal = document.getElementById('modal');
      var box = document.getElementById('modalCard');
      if (!modal || !box) return;
      box.classList.add('wide');
      box.innerHTML = '<div class="mhd"><div style="font-weight:700">Top incumbents</div><button class="x" id="mClose" type="button">x</button></div><div class="mbd">' + names.map(function (row) { var bits = row.split('|'); return '<button type="button" class="ops-row" data-inc="' + esc(bits[1]) + '" data-name="' + esc(bits[0]) + '"><b>' + esc(bits[0]) + '</b></button>'; }).join('') + '</div>';
      modal.classList.add('open');
      modal.hidden = false;
      document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
      box.querySelectorAll('[data-inc]').forEach(function (btn) {
        btn.onclick = function () { openDocView(btn.getAttribute('data-name'), btn.getAttribute('data-inc'), 'Reference incumbent.'); };
      });
    };
    el.querySelectorAll('.mini-wrap').forEach(function (mini) {
      mini.ondragstart = function (e) {
        if (!e.dataTransfer) return;
        var id = mini.getAttribute('data-lib-inline') || '';
        e.dataTransfer.setData('text/plain', '4orm-doc:' + id);
        e.dataTransfer.effectAllowed = 'move';
        el._dragDoc = true;
      };
    });
    el.querySelectorAll('.lib-card').forEach(function (card) {
      card.ondragover = function (e) { e.preventDefault(); card.classList.add('over'); };
      card.ondragleave = function () { card.classList.remove('over'); };
      card.ondrop = function (e) {
        e.preventDefault();
        e.stopPropagation();
        card.classList.remove('over');
        var plain = '';
        try { plain = e.dataTransfer.getData('text/plain') || ''; } catch (err) { plain = ''; }
        if (plain.indexOf('4orm-doc:') === 0) {
          var id = plain.slice(9);
          var cat = card.getAttribute('data-cat') || '';
          var doc = (STATE.staged || []).filter(function (d) { return d.id === id; })[0];
          if (!doc || doc.category === cat || String(id).indexOf('tmp-') === 0) return;
          doc.category = cat;
          renderLibrary();
          authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'move', id: id, category: cat }) }).then(function (r) { return r.json(); }).then(function (d) {
            if (!d || d.ok === false) { doc._err = 'Not moved yet'; renderLibrary(); }
          }).catch(function () { doc._err = 'Not moved yet'; renderLibrary(); });
          return;
        }
        takeFiles(e.dataTransfer.files, card.getAttribute('data-cat'));
      };
      card.onclick = function (e) {
        if (el._dragDoc) { el._dragDoc = false; return; }
        if (e.target.closest('[data-lib-x],[data-lib-folder-x],[data-lib-rename]')) return;
        var mini = e.target.closest('.mini');
        if (mini) {
          var wrap = mini.closest('[data-lib-inline]');
          var doc = docs.filter(function (d) { return d.id === (wrap ? wrap.getAttribute('data-lib-inline') : ''); })[0];
          if (!doc) return;
          var url = doc.driveFileId ? ('https://drive.google.com/file/d/' + encodeURIComponent(doc.driveFileId) + '/preview') : (doc.url || ('/api/documents/file?id=' + encodeURIComponent(doc.id)));
          openDocView(doc.name, url, '');
          return;
        }
        var folder = e.target.closest('[data-pick-folder]');
        STATE.docFolder = (folder && folder.getAttribute('data-pick-folder')) || card.getAttribute('data-cat');
        STATE.docSet = '';
        renderLibrary();
      };
    });
    el.querySelectorAll('[data-pick-folder]').forEach(function (btn) {
      btn.onclick = function (e) {
        if (e.target.closest('[data-lib-rename],[data-lib-folder-x]')) return;
        e.stopPropagation();
        STATE.docFolder = btn.getAttribute('data-pick-folder') || '';
        STATE.docSet = '';
        renderLibrary();
      };
    });
    el.querySelectorAll('[data-doc-set]').forEach(function (btn) {
      btn.onclick = function () { STATE.docSet = btn.getAttribute('data-doc-set') || ''; STATE.docQ = ''; renderLibrary(); };
    });
    el.querySelectorAll('[data-doc-type]').forEach(function (btn) {
      btn.onclick = function () { STATE.docType = btn.getAttribute('data-doc-type') || 'all'; renderLibrary(); };
    });
    el.querySelectorAll('[data-doc-where]').forEach(function (btn) {
      btn.onclick = function () { var w = btn.getAttribute('data-doc-where') || 'all'; STATE.docWhere = STATE.docWhere === w ? 'all' : w; renderLibrary(); };
    });
    el.querySelectorAll('[data-lib-pick]').forEach(function (box) {
      box.onclick = function (e) { e.stopPropagation(); };
      box.onchange = function () {
        STATE.docPick = STATE.docPick || {};
        var id = box.getAttribute('data-lib-pick') || '';
        if (box.checked) STATE.docPick[id] = true; else delete STATE.docPick[id];
        renderLibrary();
      };
    });
    el.querySelectorAll('.doc-grid .mini').forEach(function (mini) {
      mini.onclick = function (e) {
        if (e.target.closest('[data-lib-x],[data-lib-pick]')) return;
        var wrap = mini.closest('[data-lib-inline]');
        var doc = docs.filter(function (d) { return d.id === (wrap ? wrap.getAttribute('data-lib-inline') : ''); })[0];
        if (!doc) return;
        var url = doc.driveFileId ? ('https://drive.google.com/file/d/' + encodeURIComponent(doc.driveFileId) + '/preview') : (doc.url || ('/api/documents/file?id=' + encodeURIComponent(doc.id)));
        openDocView(doc.name, url, '');
      };
    });
    function selectedDocs() {
      return (STATE.staged || []).filter(function (d) { return STATE.docPick && STATE.docPick[d.id]; });
    }
    function rememberUse(spaceName, ids) {
      STATE.docUse = STATE.docUse || {};
      ids.forEach(function (id) {
        STATE.docUse[id] = STATE.docUse[id] || [];
        if (STATE.docUse[id].indexOf(spaceName) < 0) STATE.docUse[id].push(spaceName);
      });
    }
    function addDocsToSpace(spaceId, ids) {
      var space = (STATE.packages || []).filter(function (p) { return p.id === spaceId; })[0];
      if (!space || !ids.length) return;
      ids.forEach(function (id) {
        var doc = (STATE.staged || []).filter(function (d) { return d.id === id; })[0];
        if (!doc || String(id).indexOf('tmp-') === 0) return;
        authFetch('/api/spaces/' + spaceId, { method: 'POST', credentials: 'same-origin', quiet: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add-doc', name: doc.name, url: doc.url || '', mime: doc.mime || '', driveFileId: doc.driveFileId || '' }) }).catch(function () {});
      });
      rememberUse(space.name, ids);
      renderLibrary();
    }
    var addSpace = document.getElementById('libAddSpace');
    if (addSpace) addSpace.onclick = function () { STATE.docMenu = STATE.docMenu === 'space' ? '' : 'space'; renderLibrary(); };
    el.querySelectorAll('[data-lib-to-space]').forEach(function (btn) {
      btn.onclick = function () { STATE.docMenu = ''; addDocsToSpace(btn.getAttribute('data-lib-to-space') || '', Object.keys(STATE.docPick || {})); };
    });
    function buildSpace() {
      var ids = Object.keys(STATE.docPick || {});
      if (!ids.length) return;
      var name = 'Bundle';
      authFetch('/api/spaces', { method: 'POST', credentials: 'same-origin', quiet: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: name }) }).then(function (r) { return r.json(); }).then(function (d) {
        var id = d && (d.id || (d.space && d.space.id) || (d.package && d.package.id));
        if (!id) return;
        STATE.packages = (STATE.packages || []).concat([{ id: id, name: d.name || name, docs: [], stage: 'draft', status: 'draft' }]);
        addDocsToSpace(id, ids);
      }).catch(function () {});
    }
    var build = document.getElementById('libBuildSpace');
    if (build) build.onclick = buildSpace;
    var build2 = document.getElementById('libBuildSpace2');
    if (build2) build2.onclick = buildSpace;
    var pushSel = document.getElementById('libPushSel');
    if (pushSel) pushSel.onclick = function () { pushFolder(activeFolder); };
    var moveSel = document.getElementById('libMoveSel');
    if (moveSel) moveSel.onclick = function () { STATE.docMenu = STATE.docMenu === 'move' ? '' : 'move'; renderLibrary(); };
    el.querySelectorAll('[data-lib-move-to]').forEach(function (btn) {
      btn.onclick = function () {
        var cat = btn.getAttribute('data-lib-move-to') || '';
        if (!cat) return;
        selectedDocs().forEach(function (doc) {
          if (String(doc.id).indexOf('tmp-') === 0) return;
          doc.category = cat;
          authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'move', id: doc.id, category: cat }) }).catch(function () { doc._err = 'Not moved yet'; });
        });
        STATE.docPick = {};
        STATE.docMenu = '';
        renderLibrary();
      };
    });
    var delSel = document.getElementById('libDelSel');
    if (delSel) delSel.onclick = function () {
      if (!window.confirm('Delete the selected files?')) return;
      var ids = Object.keys(STATE.docPick || {});
      STATE.staged = (STATE.staged || []).filter(function (d) { return ids.indexOf(d.id) < 0; });
      STATE.docPick = {};
      renderLibrary();
      ids.forEach(function (id) {
        if (id.indexOf('tmp-') === 0) return;
        authFetch('/api/documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'remove', id: id }) }).catch(function () {});
      });
    };
    el.querySelectorAll('[data-space-drop]').forEach(function (box) {
      box.ondragover = function (e) { e.preventDefault(); };
      box.ondrop = function (e) {
        e.preventDefault();
        var plain = '';
        try { plain = e.dataTransfer.getData('text/plain') || ''; } catch (err) { plain = ''; }
        var ids = plain.indexOf('4orm-doc:') === 0 ? [plain.slice(9)] : Object.keys(STATE.docPick || {});
        addDocsToSpace(box.getAttribute('data-space-drop') || '', ids);
      };
    });
  }

  function loadLibrary() {
    authFetch('/api/documents', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      STATE.staged = data.docs || [];
      STATE.docFolders = data.folders || data.categories || STATE.docFolders || CATS;
      renderLibrary();
    }).catch(function () { STATE.staged = []; renderLibrary(); });
  }

  function setLib() {
    var lib = document.getElementById('opsLibrary');
    if (lib) lib.hidden = false;
    loadLibrary();
  }

  function loadInbox() {
    var el = document.getElementById('vcInbox');
    if (!el) return;
    authFetch('/api/vc-inbox', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      var rows = data.rows || [];
      el.innerHTML = '<h3>VC inbox</h3><div class="lb-add"><input id="vcName" type="text" placeholder="Firm or person" style="flex:1"/><input id="vcNote" type="text" placeholder="Note" style="flex:1"/><button class="btn pri sm" id="vcAdd" type="button">Catch</button></div><div style="margin-top:8px">' + rows.map(function (row) {
        return '<div class="exec-card"><div style="flex:1"><b>' + esc(row.name) + '</b><div class="kick">' + esc(row.note || '') + '</div></div><button class="btn sm" type="button" data-vc-go="' + esc(row.id) + '">Promote to Pipeline</button><button type="button" data-vc-del="' + esc(row.id) + '">Delete</button></div>';
      }).join('') + '</div>';
      document.getElementById('vcAdd').onclick = function () {
        authFetch('/api/vc-inbox', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('vcName').value, note: document.getElementById('vcNote').value }) }).then(loadInbox).catch(function () {});
      };
      el.querySelectorAll('[data-vc-go]').forEach(function (btn) {
        btn.onclick = function () { authFetch('/api/vc-inbox/' + btn.getAttribute('data-vc-go'), { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'promote' }) }).then(function () { return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(function (data) { applyBoard(data); loadInbox(); }).catch(function () {}); };
      });
      el.querySelectorAll('[data-vc-del]').forEach(function (btn) {
        btn.onclick = function () {
          if (!window.confirm('Delete this name?')) return;
          authFetch('/api/vc-inbox/' + btn.getAttribute('data-vc-del'), { method: 'DELETE', credentials: 'same-origin' }).then(loadInbox).catch(function () {});
        };
      });
    }).catch(function () { el.innerHTML = ''; });
  }

  function decoratePeople() {
    document.querySelectorAll('#pBody tr').forEach(function (tr) {
      var id = tr.getAttribute('data-cid');
      var person = (STATE.contacts || []).filter(function (c) { return c.id === id; })[0];
      if (!person || !person.fbTier || tr.querySelector('.fb')) return;
      var name = tr.querySelector('.c-name');
      if (!name) return;
      name.insertAdjacentHTML('beforeend', '<div class="kick fb">' + esc(String(person.fbTier).replace(/\s*\u00b7\s*/g, ' - ')) + ' - ' + esc(person.fbAsk || '') + '</div><select data-fb-status="' + esc(person.id) + '" aria-label="Status"><option value="not_sent">not sent</option><option value="sent">sent</option><option value="replied">replied</option></select><button class="btn sm" type="button" data-fb-go="' + esc(person.id) + '">Promote to Pipeline</button>');
      var sel = name.querySelector('select');
      if (sel) sel.value = person.fbStatus || 'not_sent';
    });
    document.querySelectorAll('[data-fb-status]').forEach(function (sel) {
      sel.onchange = function () {
        authFetch('/api/contacts/' + sel.getAttribute('data-fb-status') + '/facebook', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'status', status: sel.value }) }).catch(function () {});
      };
    });
    document.querySelectorAll('[data-fb-go]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        authFetch('/api/contacts/' + btn.getAttribute('data-fb-go') + '/facebook', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'promote' }) }).catch(function () {});
      };
    });
  }

  function renderDeskNotes() {
    var host = document.getElementById('deskNotes');
    if (!host) return;
    var rows = STATE.notes || [];
    host.innerHTML = rows.map(function (note) {
      return '<div class="exec-card" style="background:#1A2332;color:#E7EEF6"><div style="flex:1"><div class="kick">' + esc(note.body || '') + '</div><b>' + esc(note.title || '') + '</b></div><button type="button" data-note-edit="' + esc(note.id) + '">Edit</button><button type="button" data-note-del="' + esc(note.id) + '">Delete</button></div>';
    }).join('');
    host.querySelectorAll('[data-note-del]').forEach(function (btn) {
      btn.onclick = function () {
        if (!window.confirm('Delete this note?')) return;
        authFetch('/api/notes', { method: 'DELETE', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: btn.getAttribute('data-note-del'), kind: 'note' }) }).then(function () { return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(applyBoard).catch(function () {});
      };
    });
    host.querySelectorAll('[data-note-edit]').forEach(function (btn) {
      btn.onclick = function () {
        var note = (STATE.notes || []).filter(function (n) { return n.id === btn.getAttribute('data-note-edit'); })[0];
        if (!note) return;
        document.getElementById('opsNoteTitle').value = note.title || '';
        document.getElementById('opsNoteBody').value = note.body || '';
        document.getElementById('opsNoteId').value = note.id;
      };
    });
  }

  openDocView = function (name, url, note) {
    var view = document.getElementById('docView');
    document.getElementById('docViewName').textContent = name || 'Document';
    var driveBtn = document.getElementById('docViewDrive');
    var frame = document.getElementById('docViewFrame');
    var fail = document.getElementById('docFallback');
    if (!fail) {
      fail = document.createElement('div');
      fail.id = 'docFallback';
      fail.style.padding = '24px';
      frame.parentNode.insertBefore(fail, frame.nextSibling);
    }
    frame.hidden = false;
    fail.hidden = true;
    view.hidden = false;
    var preview = typeof drivePreview === 'function' ? drivePreview(url) : '';
    if (driveBtn) {
      driveBtn.hidden = !preview;
      driveBtn.onclick = function () { if (preview) frame.src = preview; };
    }
    if (typeof deskBusy === 'function') deskBusy(true);
    function done() { if (typeof deskBusy === 'function') deskBusy(false); }
    function showBlob(blob) {
      var type = blob && blob.type || '';
      var ok = type.indexOf('image/') === 0 || type === 'application/pdf' || type.indexOf('text/') === 0;
      if (!ok) throw 0;
      frame.hidden = false;
      fail.hidden = true;
      frame.src = URL.createObjectURL(blob);
    }
    if (url && (url.indexOf('/api/documents/file') === 0 || url.indexOf('/api/spaces/') === 0)) {
      frame.src = 'about:blank';
      authFetch(url, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw 0;
        return r.blob();
      }).then(showBlob).catch(function () {
        frame.hidden = true;
        fail.hidden = false;
        fail.innerHTML = '<p>' + esc(note || 'This file cannot be previewed here.') + '</p>';
      }).then(done, done);
      return;
    }
    if (!preview) {
      frame.hidden = true;
      fail.hidden = false;
      fail.innerHTML = '<p>' + esc(note || 'This file cannot be previewed here.') + '</p>';
      done();
      return;
    }
    frame.src = preview;
    var id = '';
    try {
      var parsed = new URL(preview);
      var match = parsed.pathname.match(/\/d\/([^/]+)/);
      id = match ? match[1] : '';
    } catch (err) { id = ''; }
    if (!id) { done(); return; }
    authFetch('/api/drive/file?id=' + encodeURIComponent(id), { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw 0;
      return r.blob();
    }).then(showBlob).catch(function () {}).then(done, done);
  };

  var priorPeople = renderPeople;
  renderPeople = function (q) { priorPeople(q); decoratePeople(); };
  var priorContacts = renderContacts;
  renderContacts = function (q) {
    priorContacts(q);
    document.querySelectorAll('.pcard').forEach(function (card) { card.draggable = false; card.ondragstart = null; });
  };
  var priorCard = openContactCard;
  openContactCard = function (id) {
    priorCard(id);
    var body = document.querySelector('#drawer .db');
    if (STATE.desk === 'contacts') {
    document.querySelectorAll('#drawer .fld').forEach(function (field) {
      if ((field.textContent || '').indexOf('Phone') === 0) field.remove();
    });
    if (body && !document.getElementById('logPipe')) {
      body.insertAdjacentHTML('beforeend', '<div class="cap"><button class="btn sm" id="logPipe" type="button">Log note</button><button class="btn sm" id="ghlOpen" type="button">Open in GHL</button></div><textarea id="pipeNote" rows="3" placeholder="Note" style="width:100%;margin-top:8px"></textarea>');
      document.getElementById('logPipe').onclick = function () {
        authFetch('/api/contacts', { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id, notes: document.getElementById('pipeNote').value }) }).catch(function () {});
      };
      document.getElementById('ghlOpen').onclick = function () {
        openDocView('GoHighLevel', '', 'This record stays on the desk. GoHighLevel remains the source of truth.');
      };
    }
    }
    if (body && !document.getElementById('addReach')) {
      var c = (STATE.contacts || []).filter(function (row) { return row.id === id; })[0] || {};
      body.insertAdjacentHTML('beforeend', '<div class="cap" style="margin-top:10px"><span class="kick">Add to Reach out</span><span class="bucket-picks" id="reachKind"><button type="button" data-rk="corporate" class="on">Corporate</button><button type="button" data-rk="vc">VC</button><button type="button" data-rk="client">Client</button><button type="button" data-rk="design">Design partner</button><button type="button" data-rk="regulator">Regulator</button></span><button class="btn sm" id="addReach" type="button">Add to Reach out</button><button class="btn sm" id="addSpace" type="button">Add to a Space</button></div>');
      body.querySelectorAll('[data-rk]').forEach(function (btn) {
        btn.onclick = function () {
          body.querySelectorAll('[data-rk]').forEach(function (other) { other.classList.remove('on'); });
          btn.classList.add('on');
        };
      });
      document.getElementById('addReach').onclick = function () {
        var picked = body.querySelector('[data-rk].on');
        var kind = picked ? picked.getAttribute('data-rk') : 'corporate';
        var person = { id: 'tmp-' + Date.now(), name: c.name || 'Person', company: c.company || '', kind: kind, nextAction: c.nextAction || 'Reach out', done: false, contactId: id };
        STATE.reachOut = (STATE.reachOut || []).concat([person]);
        authFetch('/api/reach-out', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: person.name, company: person.company, kind: kind, contactId: id, nextAction: person.nextAction }) }).then(loadReach).catch(function () {});
      };
      document.getElementById('addSpace').onclick = function () {
        var modal = document.getElementById('modal');
        var box = document.getElementById('modalCard');
        if (!modal || !box) return;
        var rows = STATE.packages || [];
        box.classList.add('wide');
        box.innerHTML = '<div class="mhd"><div style="font-weight:700">Add to a Space</div><button class="x" id="mClose" type="button">x</button></div><div class="mbd">' + (rows.length ? rows.map(function (space) { return '<button type="button" class="ops-row" data-space-add="' + esc(space.id) + '"><b>' + esc(space.name || 'Space') + '</b></button>'; }).join('') : '<div class="kick">No spaces yet.</div>') + '</div>';
        modal.classList.add('open');
        modal.hidden = false;
        document.getElementById('mClose').onclick = function () { if (typeof closeModal === 'function') closeModal(); };
        box.querySelectorAll('[data-space-add]').forEach(function (btn) {
          btn.onclick = function () {
            authFetch('/api/spaces/' + btn.getAttribute('data-space-add'), { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add-recipient', contactId: id, name: c.name || 'Person', email: c.email || '', role: c.role || '', listed: false }) }).then(function () { if (typeof closeModal === 'function') closeModal(); }).catch(function () {});
          };
        });
      };
    }
  };

  if (typeof applyCeo === 'function') {
    var priorCeo = applyCeo;
    applyCeo = function (data) {
      priorCeo(data);
      if (!STATE.desk || STATE.desk === 'room') renderOpsDash();
      if (STATE.desk === 'war') renderWar();
    };
  }
  var priorApply = applyBoard;
  applyBoard = function (data) {
    priorApply(data);
    renderOpsDash();
    renderWar();
    renderDeskNotes();
    loadReach();
    if (STATE.desk === 'news') loadNews();
    if (STATE.desk === 'contacts') loadInbox();
  };
  var priorSwitch = switchView;
  switchView = function (v) {
    priorSwitch(v);
    if (v === 'news') loadNews();
    if (v === 'docs') setLib('library');
    if (v === 'drive') renderDocs();
    if (v === 'contacts') { loadDeskFeeds(); loadInbox(); }
    if (v === 'people') loadDeskFeeds();
    if (v === 'room') { loadDeskFeeds(); renderOpsDash(); }
    if (v === 'war') { loadReach(); renderWar(); }
    if (v === 'notes') renderSticky();
    if (v === 'znotes') renderZNotes();
  };

  var brand = document.querySelector('.brand');
  if (brand) brand.addEventListener('click', function () { setNav(document.body.classList.contains('nav-collapsed')); });
  var libMode = document.getElementById('libMode');
  if (libMode) libMode.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-lib]');
    if (btn) setLib(btn.getAttribute('data-lib'));
  });
  var grid = document.getElementById('pkgGrid');
  if (grid) grid.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-push-card]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    authFetch('/api/spaces/' + btn.getAttribute('data-push-card'), { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'push-drive' }) }).catch(function () {});
  }, true);
  var zoomForm = document.getElementById('zoomForm');
  if (zoomForm) zoomForm.onsubmit = function (e) {
    e.preventDefault();
    var id = document.getElementById('zoomId').value;
    var title = document.getElementById('zoomTitle').value.trim() || 'Untitled meeting';
    var people = document.getElementById('zoomPeople').value;
    var others = document.getElementById('zoomOthers').value;
    var payload = { title: title, attendees: people, others: others };
    var names = people.split(',').map(function (bit) { return bit.trim(); }).filter(Boolean);
    var lines = others.split('\n').map(function (bit) { return bit.trim(); }).filter(Boolean);
    zoomForm.reset();
    if (id) {
      var note = (STATE.zoomNotes || []).filter(function (n) { return n.id === id; })[0];
      if (note) { note.title = title; note.attendees = names; note.others = lines; note._err = ''; }
      renderZNotes();
      authFetch('/api/zoom/' + id, { method: 'PATCH', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) { if (!r.ok) throw 0; }).catch(function () { if (note) { note._err = 'Not saved yet'; renderZNotes(); } });
      return;
    }
    var temp = { id: 'tmp-' + Date.now(), title: title, attendees: names, others: lines, date: new Date().toISOString().slice(0, 10), solo: !names.length, intel: [], improve: [], sources: [] };
    STATE.zoomNotes = STATE.zoomNotes || [];
    STATE.zoomNotes.unshift(temp);
    renderZNotes();
    authFetch('/api/zoom', { method: 'POST', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) { if (!r.ok) throw 0; return authFetch('/api/board', { credentials: 'same-origin' }); }).then(function (r) { return r.json(); }).then(applyBoard).catch(function () { temp._err = 'Not saved yet'; renderZNotes(); });
  };
  var priorZ = renderZNotes;
  renderZNotes = function () {
    priorZ();
    var grid = document.getElementById('zGrid');
    if (!grid) return;
    grid.querySelectorAll('[data-zdel]').forEach(function (btn) {
      btn.onclick = function (ev) {
        ev.stopPropagation();
        if (!window.confirm('Delete this meeting note?')) return;
        var id = btn.getAttribute('data-zdel');
        var prev = (STATE.zoomNotes || []).slice();
        STATE.zoomNotes = prev.filter(function (n) { return n.id !== id; });
        renderZNotes();
        if (String(id).indexOf('tmp-') === 0) return;
        authFetch('/api/zoom/' + id, { method: 'DELETE', quiet: true, credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw 0; }).catch(function () { STATE.zoomNotes = prev; renderZNotes(); });
      };
    });
    grid.querySelectorAll('[data-zedit]').forEach(function (btn) {
      btn.onclick = function (ev) {
        ev.stopPropagation();
        var note = (STATE.zoomNotes || []).filter(function (n) { return n.id === btn.getAttribute('data-zedit'); })[0];
        if (!note) return;
        document.getElementById('zoomId').value = note.id;
        document.getElementById('zoomTitle').value = note.title || '';
        document.getElementById('zoomPeople').value = (note.attendees || []).join(', ');
        document.getElementById('zoomOthers').value = (note.others || []).join('\n');
        var title = document.getElementById('zoomTitle');
        if (title) title.focus();
      };
    });
  };
  function renderSticky() {
    var host = document.getElementById('stickyDesk');
    if (!host) return;
    var colours = ['yellow', 'blue', 'green', 'pink'];
    function paint(notes) {
      var q = String(STATE.stickQ || '').toLowerCase();
      var kind = STATE.stickKind || 'all';
      var colours = ['yellow', 'blue', 'green', 'pink', 'orange', 'purple'];
      var shown = notes.filter(function (note) {
        var meta = note.meta || {};
        if (kind === 'archive') return !!meta.archived;
        if (meta.archived) return false;
        if (kind === 'pinned') return !!meta.pin;
        if (kind !== 'all' && meta.kind !== kind) return false;
        return !q || String(note.body || '').toLowerCase().indexOf(q) >= 0;
      });
      var kinds = [['all', 'All'], ['pinned', 'Pinned'], ['idea', 'Idea'], ['todo', 'To-do'], ['person', 'Person'], ['decision', 'Decision'], ['archive', 'Archive']];
      host.innerHTML = '<div class="nbar"><span class="t">Notes</span><div class="nadd"><button class="nb" id="stickAdd" type="button">+ New note</button><span class="dots" id="stickDots"></span></div><div class="right"><input id="stickFind" class="nsearch" type="text" placeholder="Search notes..." aria-label="Search notes" value="' + esc(q) + '"><button class="nbtn" id="stickTidy" type="button">Tidy up</button><button class="nbtn" id="stickFull" type="button">&#8599; Full screen</button></div></div><div class="stick-filters">' + kinds.map(function (pair) { return '<button type="button" data-stick-kind="' + pair[0] + '"' + (kind === pair[0] ? ' class="on"' : '') + '>' + (pair[0] === 'pinned' ? '&#9733; ' : '') + pair[1] + '</button>'; }).join('') + '</div><div class="sticky-board" id="stickBoard"></div>';
      var board = document.getElementById('stickBoard');
      board.innerHTML = shown.map(function (note, index) {
        var meta = note.meta || {};
        var tilt = (index % 2 ? 1.2 : -1.2);
        var kindLabel = { idea: 'Idea', todo: 'To-do', person: 'Person', decision: 'Decision' }[meta.kind || ''] || 'Type';
        var pinMark = meta.pin ? '<span class="pin" aria-hidden="true">&#128204;</span>' : '';
        var checks = (meta.checks || []).map(function (row, i) {
          return '<label class="check' + (row.done ? ' done' : '') + '"><input type="checkbox" data-stick-check="' + esc(note.id) + '" data-i="' + i + '"' + (row.done ? ' checked' : '') + '/><input type="text" data-stick-line="' + esc(note.id) + '" data-i="' + i + '" value="' + esc(row.t || '') + '" placeholder="Checklist item" aria-label="Checklist item"/></label>';
        }).join('');
        var link = meta.link && meta.link.name ? '<button type="button" class="nlink" data-stick-jump="' + esc(note.id) + '">' + esc(meta.link.name) + '</button>' : '';
        return '<div class="sticky ' + esc(note.color || 'yellow') + '" data-stick="' + esc(note.id) + '" style="left:' + (Number(note.x) || 24) + 'px;top:' + (Number(note.y) || 24) + 'px;width:' + (Number(note.w) || 220) + 'px;height:' + (Number(note.h) || 220) + 'px;transform:rotate(' + tilt + 'deg)">' + pinMark + '<button type="button" class="tag" data-stick-kind-btn="' + esc(note.id) + '">' + esc(kindLabel) + '</button><button type="button" class="tag" data-stick-pin="' + esc(note.id) + '">' + (meta.pin ? 'Pinned' : 'Pin') + '</button><div class="dots">' + colours.map(function (c) { return '<button type="button" class="' + c + ((note.color || 'yellow') === c ? ' on' : '') + '" data-color="' + c + '" aria-label="' + c + '"></button>'; }).join('') + '</div><textarea rows="3">' + esc(note.body || '') + '</textarea>' + checks + '<button type="button" class="addcheck" data-stick-addcheck="' + esc(note.id) + '">+ check</button>' + link + '<input class="note-line" data-stick-link="' + esc(note.id) + '" value="' + esc((meta.link && meta.link.name) || '') + '" placeholder="Link a person or space" aria-label="Link a person or space"/><input class="note-line" data-stick-remind="' + esc(note.id) + '" value="' + esc(meta.remind || '') + '" placeholder="Reminder" aria-label="Reminder"/><div class="acts"><button type="button" data-stick-task="' + esc(note.id) + '">Convert to task</button><button type="button" data-stick-content="' + esc(note.id) + '">Send to content runway</button><button type="button" data-stick-space="' + esc(note.id) + '">Save to a space</button><button type="button" data-stick-dash="' + esc(note.id) + '">Pin to dashboard</button><button type="button" data-stick-open="' + esc(note.id) + '">Open space</button></div>' + (note._err ? '<div class="soft-err">' + esc(note._err) + '</div>' : '') + '<button type="button" class="ghost-x" data-stick-del="' + esc(note.id) + '" aria-label="Archive">x</button><button type="button" class="stick-size" data-stick-size="' + esc(note.id) + '" aria-label="Resize"></button></div>';
      }).join('');
      var dotHost = document.getElementById('stickDots');
      if (dotHost) {
        dotHost.innerHTML = colours.map(function (c) { return '<button type="button" class="' + c + ((STATE.stickColor || 'yellow') === c ? ' on' : '') + '" data-new-color="' + c + '" aria-label="' + c + '"></button>'; }).join('');
        dotHost.querySelectorAll('[data-new-color]').forEach(function (dot) {
          dot.onclick = function () { STATE.stickColor = dot.getAttribute('data-new-color'); paint(notes); };
        });
      }
      var findBox = document.getElementById('stickFind');
      if (findBox) findBox.oninput = function () {
        STATE.stickQ = findBox.value;
        paint(notes);
        var again = document.getElementById('stickFind');
        if (again) { again.focus(); var n = again.value.length; again.setSelectionRange(n, n); }
      };
      var tidy = document.getElementById('stickTidy');
      if (tidy) tidy.onclick = function () {
        notes.forEach(function (note, i) {
          note.x = 16 + (i % 4) * 200;
          note.y = 16 + Math.floor(i / 4) * 170;
          if (String(note.id).indexOf('tmp-') === 0) return;
          authFetch('/api/notes/' + note.id, { method: 'PATCH', credentials: 'same-origin', quiet: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: note.x, y: note.y }) }).catch(function () {});
        });
        paint(notes);
      };
      host.querySelectorAll('[data-stick-kind]').forEach(function (btn) {
        btn.onclick = function () { STATE.stickKind = btn.getAttribute('data-stick-kind'); paint(notes); };
      });
      var full = document.getElementById('stickFull');
      if (full) full.onclick = function () { document.body.classList.toggle('exec-full'); var board = document.getElementById('stickBoard'); if (board) board.style.minHeight = document.body.classList.contains('exec-full') ? '80vh' : ''; };
      document.getElementById('stickAdd').onclick = function () {
        var temp = { id: 'tmp-' + Date.now(), body: '', color: STATE.stickColor || 'yellow', x: 24 + (notes.length % 4) * 28, y: 24 + (notes.length % 3) * 20 };
        notes.push(temp);
        paint(notes);
        var area = host.querySelector('[data-stick="' + temp.id + '"] textarea');
        if (area) area.focus();
        authFetch('/api/notes/sticky', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: '', color: temp.color, x: temp.x, y: temp.y }) }).then(function (r) { if (!r.ok) throw 0; return r.json();         }).then(function (saved) {
          var card = host.querySelector('[data-stick="' + temp.id + '"]');
          temp.id = saved.id || temp.id;
          if (card && saved.id) card.setAttribute('data-stick', saved.id);
          var area = card && card.querySelector('textarea');
          if (saved.id && area && (area.value || temp.color !== 'yellow' || (temp.meta))) {
            authFetch('/api/notes/' + saved.id, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: area.value, color: temp.color, x: card.offsetLeft, y: card.offsetTop }) }).catch(function () {});
          }
        }).catch(function () { temp._err = 'Not saved yet'; var card = host.querySelector('[data-stick="' + temp.id + '"]'); if (card && !card.querySelector('.soft-err')) card.insertAdjacentHTML('beforeend', '<div class="soft-err">Not saved yet</div>'); });
      };
      function patchMeta(note) {
        if (!note || String(note.id).indexOf('tmp-') === 0) return;
        authFetch('/api/notes/' + note.id, { method: 'PATCH', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ meta: note.meta || {} }) }).catch(function () {});
      }
      board.querySelectorAll('[data-stick-task]').forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          var note = notes.filter(function (row) { return row.id === btn.getAttribute('data-stick-task'); })[0];
          if (note) saveItem(note.body || 'Note', 'today');
        };
      });

      function noteBy(attr, el) {
        return notes.filter(function (row) { return row.id === el.getAttribute(attr); })[0];
      }
      board.querySelectorAll('[data-stick-check]').forEach(function (box) {
        box.onchange = function (e) {
          e.stopPropagation();
          var note = noteBy('data-stick-check', box);
          var i = Number(box.getAttribute('data-i'));
          if (!note || !note.meta || !note.meta.checks || !note.meta.checks[i]) return;
          note.meta.checks[i].done = box.checked;
          var row = box.closest('.check');
          if (row) row.classList.toggle('done', box.checked);
          patchMeta(note);
        };
      });
      board.querySelectorAll('[data-stick-line]').forEach(function (box) {
        box.onchange = function () {
          var note = noteBy('data-stick-line', box);
          var i = Number(box.getAttribute('data-i'));
          if (!note || !note.meta || !note.meta.checks || !note.meta.checks[i]) return;
          note.meta.checks[i].t = box.value;
          patchMeta(note);
        };
      });
      board.querySelectorAll('[data-stick-addcheck]').forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          var note = noteBy('data-stick-addcheck', btn);
          if (!note) return;
          note.meta = note.meta || {};
          note.meta.checks = note.meta.checks || [];
          note.meta.checks.push({ t: '', done: false });
          if (!note.meta.kind) note.meta.kind = 'todo';
          patchMeta(note);
          paint(notes);
        };
      });
      board.querySelectorAll('[data-stick-link]').forEach(function (box) {
        box.onchange = function () {
          var note = noteBy('data-stick-link', box);
          if (!note) return;
          var q = box.value.trim().toLowerCase();
          note.meta = note.meta || {};
          var person = (STATE.contacts || []).filter(function (c) { return String(c.name || '').toLowerCase() === q; })[0];
          var space = (STATE.packages || []).filter(function (sp) { return String(sp.name || '').toLowerCase() === q; })[0];
          if (person) note.meta.link = { kind: 'person', id: person.id, name: person.name };
          else if (space) note.meta.link = { kind: 'space', id: space.id, name: space.name };
          else note.meta.link = q ? { kind: 'name', id: '', name: box.value.trim() } : null;
          patchMeta(note);
          paint(notes);
        };
      });
      board.querySelectorAll('[data-stick-jump]').forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          var note = noteBy('data-stick-jump', btn);
          var link = note && note.meta && note.meta.link;
          if (!link) return;
          if (link.kind === 'space' && typeof switchView === 'function') {
            switchView('work');
            var card = document.querySelector('[data-pkg="' + link.id + '"]');
            if (card) card.click();
          } else if (typeof switchView === 'function') switchView('people');
        };
      });
      board.querySelectorAll('[data-stick-content]').forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          var note = noteBy('data-stick-content', btn);
          if (note) saveItem('Draft post: ' + String(note.body || 'Note').slice(0, 80), 'today');
        };
      });
      board.querySelectorAll('[data-stick-space]').forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          var note = noteBy('data-stick-space', btn);
          if (!note) return;
          var name = (note.meta && note.meta.link && note.meta.link.name) || '';
          var space = (STATE.packages || []).filter(function (sp) { return String(sp.name || '').toLowerCase() === String(name).toLowerCase() || (note.meta && note.meta.link && note.meta.link.id === sp.id); })[0];
          if (!space) { note._err = 'Type a space name in the link line first.'; paint(notes); return; }
          var notesText = String(space.description || space.notes || '');
          var extra = String(note.body || '').trim();
          if (extra && notesText.indexOf(extra) < 0) notesText = (notesText + '\n' + extra).trim();
          space.description = notesText;
          note.meta = note.meta || {};
          note.meta.link = { kind: 'space', id: space.id, name: space.name };
          note._err = '';
          patchMeta(note);
          if (String(space.id).indexOf('tmp-') !== 0) authFetch('/api/spaces/' + space.id, { method: 'PATCH', quiet: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ notes: notesText }) }).catch(function () {});
          paint(notes);
        };
      });
      board.querySelectorAll('[data-stick-dash]').forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          var note = noteBy('data-stick-dash', btn);
          if (!note) return;
          note.meta = note.meta || {};
          note.meta.pin = true;
          patchMeta(note);
          var pins = [];
          try { pins = JSON.parse(localStorage.getItem('cr_dash_notes') || '[]'); } catch (err) { pins = []; }
          pins = pins.filter(function (row) { return row.id !== note.id; });
          pins.unshift({ id: note.id, text: String(note.body || 'Pinned note').slice(0, 80) });
          try { localStorage.setItem('cr_dash_notes', JSON.stringify(pins.slice(0, 5))); } catch (err) {}
          paint(notes);
        };
      });
      board.querySelectorAll('[data-stick-open]').forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          var note = noteBy('data-stick-open', btn);
          var link = note && note.meta && note.meta.link;
          if (!link || !link.id) { if (note) { note._err = 'Link a space first.'; paint(notes); } return; }
          if (typeof switchView === 'function') switchView('work');
          var card = document.querySelector('[data-pkg="' + link.id + '"]');
          if (card) card.click();
        };
      });
      board.querySelectorAll('[data-stick-remind]').forEach(function (box) {
        box.onchange = function () {
          var note = notes.filter(function (row) { return row.id === box.getAttribute('data-stick-remind'); })[0];
          if (!note) return;
          note.meta = note.meta || {};
          note.meta.remind = box.value;
          patchMeta(note);
        };
      });
      board.querySelectorAll('[data-stick-del]').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute('data-stick-del');
          var note = notes.filter(function (row) { return row.id === id; })[0];
          if (note && (STATE.stickKind === 'archive' || (note.meta && note.meta.archived))) {
            var left = notes.filter(function (row) { return row.id !== id; });
            notes.splice(0, notes.length);
            left.forEach(function (row) { notes.push(row); });
            paint(notes);
            if (String(id).indexOf('tmp-') === 0) return;
            authFetch('/api/notes/' + id, { method: 'DELETE', credentials: 'same-origin' }).catch(function () {});
            return;
          }
          if (note) { note.meta = note.meta || {}; note.meta.archived = true; patchMeta(note); }
          paint(notes);
        };
      });
      board.querySelectorAll('[data-stick-size]').forEach(function (handle) {
        handle.onpointerdown = function (e) {
          e.preventDefault();
          e.stopPropagation();
          var card = handle.closest('.sticky');
          if (!card) return;
          var sx = e.clientX;
          var sy = e.clientY;
          var sw = card.offsetWidth;
          var sh = card.offsetHeight;
          function move(ev) {
            card.style.width = Math.max(140, sw + ev.clientX - sx) + 'px';
            card.style.height = Math.max(100, sh + ev.clientY - sy) + 'px';
          }
          function up() {
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            var id = card.getAttribute('data-stick');
            if (String(id).indexOf('tmp-') === 0) return;
            authFetch('/api/notes/' + id, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ w: card.offsetWidth, h: card.offsetHeight }) }).catch(function () {});
          }
          document.addEventListener('pointermove', move);
          document.addEventListener('pointerup', up);
        };
      });
      board.querySelectorAll('.sticky').forEach(function (card) {
        var area = card.querySelector('textarea');
        area.oninput = function () {
          var note = notes.filter(function (row) { return row.id === card.getAttribute('data-stick'); })[0];
          if (note) note.body = area.value;
        };
        area.onchange = function () {
          var id = card.getAttribute('data-stick');
          if (String(id).indexOf('tmp-') === 0) return;
          authFetch('/api/notes/' + id, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: area.value }) }).catch(function () {});
        };
        card.querySelectorAll('.tag').forEach(function (tag) {
          tag.onclick = function (e) {
            e.stopPropagation();
            var note = notes.filter(function (row) { return row.id === card.getAttribute('data-stick'); })[0];
            if (!note) return;
            note.meta = note.meta || {};
            if (tag.hasAttribute('data-stick-pin')) note.meta.pin = !note.meta.pin;
            else {
              var order = ['idea', 'todo', 'person', 'decision', ''];
              note.meta.kind = order[(order.indexOf(note.meta.kind || '') + 1) % order.length];
            }
            patchMeta(note);
            paint(notes);
          };
        });
        card.querySelectorAll('[data-color]').forEach(function (dot) {
          dot.onclick = function (e) {
            e.stopPropagation();
            var color = dot.getAttribute('data-color');
            card.className = 'sticky ' + color;
            card.querySelectorAll('[data-color]').forEach(function (node) { node.classList.toggle('on', node === dot); });
            var note = notes.filter(function (row) { return row.id === card.getAttribute('data-stick'); })[0];
            if (note) note.color = color;
            var id = card.getAttribute('data-stick');
            if (String(id).indexOf('tmp-') === 0) return;
            authFetch('/api/notes/' + id, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ color: color }) }).catch(function () {});
          };
        });
        card.onpointerdown = function (e) {
          if (e.target.closest('textarea,button,select,input,label')) return;
          var sx = e.clientX - card.offsetLeft;
          var sy = e.clientY - card.offsetTop;
          function move(ev) { card.style.left = (ev.clientX - sx) + 'px'; card.style.top = (ev.clientY - sy) + 'px'; }
          function up() {
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            var id = card.getAttribute('data-stick');
            var note = notes.filter(function (row) { return row.id === id; })[0];
            if (note) { note.x = card.offsetLeft; note.y = card.offsetTop; }
            if (String(id).indexOf('tmp-') === 0) return;
            authFetch('/api/notes/' + id, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: card.offsetLeft, y: card.offsetTop }) }).catch(function () {});
          }
          document.addEventListener('pointermove', move);
          document.addEventListener('pointerup', up);
        };
      });
    }
    authFetch('/api/notes/sticky', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) { paint(data.notes || []); }).catch(function () { paint([]); var board = document.getElementById('stickBoard'); if (board) board.insertAdjacentHTML('afterbegin', '<div class="soft-err">Notes could not load. A new note still stays on this board.</div>'); });
  }
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[target="_blank"]');
    if (!link) return;
    e.preventDefault();
    openDocView(link.textContent || 'Link', link.getAttribute('href') || '', '');
  }, true);
  var integ = document.getElementById('v-int');
  if (integ && !document.getElementById('discGoogle')) {
    integ.insertAdjacentHTML('beforeend', '<div class="cap" style="margin-top:12px"><button class="btn sm" id="discGoogle" type="button">Disconnect Google</button><button class="btn sm" id="discGhl" type="button">Disconnect GoHighLevel</button></div>');
    document.getElementById('discGoogle').onclick = function () {
      if (!window.confirm('Disconnect Google on this desk?')) return;
      authFetch('/api/integrations/google/disconnect', { method: 'DELETE', credentials: 'same-origin' }).catch(function () {});
    };
    document.getElementById('discGhl').onclick = function () {
      if (!window.confirm('Disconnect GoHighLevel on this desk?')) return;
      authFetch('/api/integrations/gohighlevel/disconnect', { method: 'DELETE', credentials: 'same-origin' }).catch(function () {});
    };
  }
  setInterval(function () {
    document.querySelectorAll('[data-count]').forEach(function (node) {
      var span = node.querySelector('span');
      if (span) span.textContent = soon(Number(node.getAttribute('data-count')));
    });
  }, 30000);
  window.saveItem = saveItem;
  if (document.getElementById('opsDash')) renderOpsDash();
})();
