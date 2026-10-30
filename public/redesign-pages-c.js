/* Part C: playbook / calendar / zoom / completed.
   ONE render path: data = fixtureOn() ? REDESIGN_FIXTURE.page : live*State(). */
(function () {
  function P() { return window.__port || {}; }
  function fixtureOn() { return P().fixtureOn ? P().fixtureOn() : !!window.fixtureMockup; }
  function wrapOf(id) { return P().wrapOf ? P().wrapOf(id) : null; }
  function whenCss(fn) { if (P().whenCss) P().whenCss(fn); else fn(); }
  function markReady(id) { if (P().markReady) P().markReady(id); }
  function esc(s) { return P().esc ? P().esc(s) : String(s == null ? '' : s); }
  function asList(v) { return P().asList ? P().asList(v) : (Array.isArray(v) ? v : []); }
  function liveLog(page, extra) { if (P().liveLog) P().liveLog(page, extra); }
  function F() { return window.REDESIGN_FIXTURE || {}; }
  function FC() { return (fixtureOn() && window.REDESIGN_FIXTURE_C) || {}; }
  function auth(url, opts) {
    opts = opts || {};
    if (typeof window.authFetch === 'function') return window.authFetch(url, opts);
    return fetch(url, Object.assign({ credentials: 'include' }, opts));
  }

  var snip = {};
  function loadSnip(url, cb) {
    if (snip[url] != null) { cb(snip[url]); return; }
    fetch(url).then(function (r) { return r.text(); }).then(function (t) { snip[url] = t; cb(t); }).catch(function () { cb(''); });
  }

  var D = 'done', M = 'miss', O = 'off', U = 'due', N = 'next';
  /* [label, real route]. Rooms without a page of their own point at the page
     where that work happens. */
  var ROOMS = { war: ['Planner', '/planner'], studio: ['LinkedIn', '/messages?ch=linkedin'], li: ['LinkedIn', '/messages?ch=linkedin'], pipe: ['Pipeline', '/pipeline'], spaces: ['Spaces', '/spaces'], msg: ['Email', '/email'], news: ['News', '/news'], iq: ['4ormIQ', '/4ormiq'], done: ['Completed', '/completed'], contacts: ['Contacts', '/contacts'], team: ['Email', '/email'], dash: ['Completed', '/completed'], fin: ['Financials', '/financials'] };
  var ZC = ['#2E6BF2', '#0E8A5F', '#C9962B', '#6B4FD8', '#D6334E', '#0f9fb5', '#e2702b'];
  function ini(n) { return String(n || '').split(' ').map(function (x) { return x[0] || ''; }).join('').slice(0, 2).toUpperCase(); }
  function zcol(n) { return ZC[String(n || '').split('').reduce(function (a, c) { return a + c.charCodeAt(0); }, 0) % ZC.length]; }
  function isChad(name) { return /^chad(\s|$)/i.test(String(name || '').trim()); }

  function playbookData() {
    if (fixtureOn()) {
      var fp = F().playbook || { weekLabel: 'WEEK 43 · OCT 19 - 25', dates: [19, 20, 21, 22, 23, 24, 25], todayIdx: 0, pct: '0%' };
      return Object.assign({}, fp, { rows: fp.rows || FC().PB_ROWS || [] });
    }
    return livePlaybookState();
  }
  function roomOf(route) {
    var r = String(route || '');
    if (r === 'fin' || /financ/.test(r)) return 'fin';
    if (/war/.test(r)) return 'war';
    if (r === 'studio' || /studio|video/.test(r)) return 'studio';
    if (r === 'li' || /linkedin/.test(r)) return 'li';
    if (/pipe/.test(r)) return 'pipe';
    if (/space/.test(r)) return 'spaces';
    if (/mail|msg|inbox/.test(r)) return 'msg';
    if (/news/.test(r)) return 'news';
    if (/iq|4ormiq/.test(r)) return 'iq';
    if (/done|complete/.test(r)) return 'done';
    if (/contact|people/.test(r)) return 'contacts';
    if (/team/.test(r)) return 'team';
    if (r === 'dash') return 'dash';
    return 'dash';
  }
  /* Playbook pills, 28 Oct 2026: five colours only, the same as the cadence bars (green, blue, violet, red, amber), cycled down the plays so neighbours differ. */
  var PILL5 = ['#00dc86', '#4272f9', '#9771f9', '#ff4866', '#ffa946'];
  function pillCol(rows, r) {
    var plays = rows.filter(function (x) { return !x.s; });
    var k = plays.indexOf(r);
    return PILL5[(k < 0 ? 0 : k) % 5];
  }
  function colorVar(c) {
    var s = String(c || '');
    if (s.indexOf('--') === 0) return s;
    var map = { '#2e6bf2': '--blue', '#e0364f': '--red', '#ff6fb5': '--pink', '#47b8ff': '--sky', '#12a36a': '--green', '#f5c542': '--gold', '#6b4fd8': '--violet', '#ff8a3d': '--orange', '#b6f35a': '--lime', '#2fd6c6': '--teal', '#8a93a8': '--slate', '#c98408': '--amber' };
    return map[s.toLowerCase()] || '--blue';
  }
  function padClass(st) {
    var s = String(st || '');
    if (s === 'done' || s === 'before') return D;
    if (s === 'miss' || s === 'missed') return M;
    if (s === 'due') return U;
    if (s === 'next' || s === 'snoozed' || s === 'scheduled') return N;
    return O;
  }
  function padLabel(r, pad, i, todayIdx) {
    var s = padClass(pad && pad.state);
    if (s === M) return '';
    if (s === D) return i === todayIdx ? '✓' : ((pad && pad.value) || '');
    if (s === U) {
      if (r.target === '5' && /reach/i.test(r.n)) return ((pad && pad.value) || '2') + '/5';
      if (/engage/i.test(r.n)) return (pad && pad.value) || '0/5';
      if (/inbox/i.test(r.n)) return (pad && pad.value) || '5';
      if (/4ormiq/i.test(r.n)) return (pad && pad.value) || '7d';
      if (/clear/i.test(r.n)) return (pad && pad.value) || '3';
      return (pad && pad.value) || 'GO';
    }
    if (s === N) return (pad && pad.value) || '';
    return '';
  }
  /* Clock labels like "6pm" or "9:30 am" render as 24-hour ("18:00", "09:30"); anything else is left alone. */
  function t24label(v) {
    var m = String(v == null ? '' : v).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i);
    if (!m) return v;
    var h = Number(m[1]) % 12 + (/p/i.test(m[3]) ? 12 : 0);
    return String(h).padStart(2, '0') + ':' + (m[2] || '00');
  }
  function weekdayIso(day) {
    var m = String(day).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()];
  }
  function defaultSched(r) {
    var sched = asList(r.schedule).map(String);
    if (sched.length) return sched;
    var sub = String(r.sub || '').toLowerCase();
    var days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    var hit = days.filter(function (k) { return sub.indexOf(k) >= 0; });
    if ((r.grp || 'Daily') === 'Weekly') return hit.length ? hit : ['mon'];
    if (/inbox|news/.test(String(r.route || r.room || '') + ' ' + String(r.name || ''))) return hit.length ? hit : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return hit.length ? hit : ['mon', 'tue', 'wed', 'thu', 'fri'];
  }
  function fillPads(r, days, today) {
    var pads = asList(r.pads);
    var allOff = !pads.length || pads.every(function (p) { return padClass(p && p.state) === O; });
    if (!allOff && pads.length >= days.length) return pads.slice(0, 7);
    var sched = defaultSched(r);
    return days.map(function (day, i) {
      var prev = pads[i] || {};
      var due = sched.indexOf(weekdayIso(day)) >= 0;
      var st = prev.state;
      if (!st || padClass(st) === O) {
        if (!due) st = 'off';
        else if (day < today) st = 'miss';
        else if (day === today) st = 'due';
        else st = 'next';
      }
      return { day: day, due: due, state: st, value: prev.value || '' };
    });
  }
  function vancouverTodayIso() {
    if (typeof window.vancouverTodayIso === 'function' && window.vancouverTodayIso !== vancouverTodayIso) {
      try { return window.vancouverTodayIso(); } catch (e) {}
    }
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    function g(t) {
      for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value;
      return '';
    }
    return g('year') + '-' + g('month') + '-' + g('day');
  }
  function vancouverWeekDays() {
    var today = vancouverTodayIso();
    var p = today.split('-').map(Number);
    var utc = Date.UTC(p[0], p[1] - 1, p[2]);
    var dow = new Date(utc).getUTCDay();
    var monday = utc - ((dow + 6) % 7) * 86400000;
    var days = [];
    for (var i = 0; i < 7; i++) days.push(new Date(monday + i * 86400000).toISOString().slice(0, 10));
    return days;
  }
  function livePlaybookState() {
    var pb = (window.STATE || {}).playbook || {};
    /* Header + pink TODAY band share this one Vancouver date — never a stale pb.today alone. */
    var today = vancouverTodayIso();
    var days = asList(pb.days);
    if (!days.length || days.indexOf(today) < 0) days = vancouverWeekDays();
    var todayIdx = days.indexOf(today);
    if (todayIdx < 0) todayIdx = 0;
    var dates = days.map(function (d) {
      var m = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
      return m ? Number(m[3]) : Number(String(d).slice(8));
    });
    if (!dates.length) {
      dates = days.map(function (d) {
        var m = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
        return m ? Number(m[3]) : 0;
      });
    }
    while (dates.length < 7) dates.push((dates[dates.length - 1] || 1) + 1);
    var apiRows = asList(pb.rows);
    var rows = [];
    var weekly = false;
    apiRows.forEach(function (r) {
      if (r.s || (r.grp && !r.name)) { rows.push({ s: r.s || r.grp || r.name }); return; }
      if ((r.grp || 'Daily') === 'Weekly' && !weekly) { rows.push({ s: 'Weekly' }); weekly = true; }
      else if ((r.grp || 'Daily') === 'Daily' && !rows.length) rows.push({ s: 'Daily' });
      var pads = fillPads(r, days, today);
      var d = pads.map(function (p) { return padClass(p.state); });
      while (d.length < 7) d.push(O);
      var mapped = {
        id: r.id, n: r.name, room: roomOf(r.route || r.room), c: colorVar(r.color || r.c),
        d: d, pads: pads, lab: pads.map(function (p, i) { return padLabel({ n: r.name, target: r.target }, p, i, todayIdx); }),
        st: r.st || (Number(r.streak) > 0 ? '<b>' + Number(r.streak) + '</b> day' + (Number(r.streak) === 1 ? '' : 's') : (r.grp === 'Weekly' ? 'weekly' : '')), sub: r.sub, nw: r.nw, target: r.target || '', grp: r.grp
      };
      rows.push(mapped);
    });
    var left = 0;
    rows.forEach(function (r) { if (r.d && r.d[todayIdx] === U) left++; });
    return {
      rows: rows, weekLabel: pb.weekLabel || 'WEEK', dates: dates, todayIdx: todayIdx,
      pct: (pb.score == null ? 0 : pb.score) + '%', todayLit: left, live: true
    };
  }

  function mountPlaybook(root, wrap, data) {
    var srcRows = data.rows && data.rows.length ? data.rows : [];
    if (data.error) srcRows = [];
    var rows = srcRows.map(function (r) { return r.s ? r : Object.assign({}, r, { d: (r.d || []).slice(), lab: (r.lab || []).slice() }); });
    var dates = data.dates && data.dates.length ? data.dates : (data.live ? vancouverWeekDays().map(function (d) { return Number(String(d).slice(8)); }) : [19, 20, 21, 22, 23, 24, 25]);
    var todayIdx = data.todayIdx == null ? 0 : data.todayIdx;
    var document = root;
    function gid(id) { return root.getElementById(id); }
    var wk = wrap.querySelector('.wk');
    if (wk && data.weekLabel) wk.textContent = data.weekLabel;
    var pct = gid('pct');
    if (pct && data.pct) pct.textContent = data.pct;
    function colOf(r) { return pillCol(rows, r); }
    var g = gid('g');
    function todayCol() { return (Number(todayIdx) || 0) + 2; /* col 1 = labels; days start at 2 */ }
    function render() {
      /* Band sits in .seq (09g); place() lines it up with today's header column. */
      var h = '<div></div>';
      ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].forEach(function (x, i) {
        h += '<div class="dh' + (i === todayIdx ? ' today" id="fri' : '"') + '">' + x + '<small>' + dates[i] + '</small></div>';
      });
      h += '<div class="dh" style="text-align:right">STREAK</div>';
      rows.forEach(function (r, ri) {
        if (r.s) { h += '<div class="sect">' + r.s.toUpperCase() + '</div>'; return; }
        var c = colOf(r), rm = ROOMS[r.room] || ROOMS.dash;
        h += '<div class="track"><span class="swatch" style="background:' + c + '"></span><div><div class="t">' + r.n + (r.nw ? '<span class="new">NEW</span>' : '') + '</div><div class="r"><a href="' + rm[1] + '" data-action="play-go" data-view="' + (r.room || 'dash') + '">' + rm[0] + ' &rarr;</a>' + (r.sub ? ' &middot; ' + r.sub : '') + '</div></div></div>';
        r.d.forEach(function (s, i) {
          var l = fixtureOn() ? ((r.lab && r.lab[i]) || '') : t24label((r.lab && r.lab[i]) || '');
          var day = (r.pads && r.pads[i] && r.pads[i].day) || '';
          var ids = ' data-action="play-pad" data-r="' + ri + '" data-i="' + i + '" data-id="' + esc(r.id || '') + '" data-day="' + esc(day) + '"';
          if (s === D) h += '<div class="pad done" style="--c:' + c + ';color:#fff"' + ids + '>' + l + '</div>';
          else if (s === M) h += '<div class="pad miss" data-action="play-pad-off"></div>';
          else if (s === U) h += '<div class="pad due" style="--c:' + c + ';color:#160308"' + ids + '>' + l + '</div>';
          else if (s === N) h += '<div class="pad next" style="--c:' + c + '"' + ids + '>' + l + '</div>';
          else h += '<div class="pad off" data-action="play-pad-off"></div>';
        });
        h += '<div class="streak">' + (r.st || '') + '</div>';
      });
      h += '<div class="add" data-action="play-add">+ Add a rhythm</div>';
      if (g) { g.innerHTML = h; place(); count(); }
    }
    function place() {
      /* 09g place(): band is absolute in .seq, width locked to today's header
         so it stays in that column at every width (prompt 13 intent). */
      var f = gid('fri'); var ph = gid('ph');
      if (!f || !ph || !g) return;
      ph.style.left = (g.offsetLeft + f.offsetLeft - 4) + 'px';
      ph.style.width = (f.offsetWidth + 8) + 'px';
      ph.style.top = '8px';
      ph.style.bottom = '8px';
      ph.style.height = 'auto';
      ph.style.right = 'auto';
      ph.style.gridColumn = '';
      ph.style.gridRow = '';
    }
    function count() {
      var left = 0;
      rows.forEach(function (r) { if (r.d && r.d[todayIdx] === U) left++; });
      var run = gid('runTxt');
      if (!run) return;
      if (data.live) run.textContent = left ? (left + ' lights left today') : 'All lights off — day done';
      else run.textContent = left ? ("Run today's plays · " + left + ' lit') : 'All lights off — day done';
    }
    if (root.__pbResize) window.removeEventListener('resize', root.__pbResize);
    root.__pbResize = place;
    window.addEventListener('resize', place);
    var pop = gid('pop'); var cur = null;
    function openPop(p) {
      if (!p || !p.dataset.r || !pop) return;
      var r = rows[+p.dataset.r], i = +p.dataset.i, rm = ROOMS[r.room] || ROOMS.dash, st = r.d[i];
      cur = { r: r, i: i, el: p };
      var col = colOf(r);
      gid('popSw').style.background = col;
      gid('popT').textContent = r.n;
      gid('popS').textContent = rm[0] + ' · ' + (st === D ? 'done — light is off' : st === N ? 'later today' : 'due now');
      var goBtn = gid('popGo'); goBtn.textContent = 'Go to ' + rm[0] ; goBtn.style.background = col;
      goBtn.setAttribute('data-view', r.room || 'dash');
      gid('popDone').innerHTML = st === D ? 'Turn back on' : 'Mark done';
      var b = p.getBoundingClientRect();
      pop.style.left = Math.min(b.left, window.innerWidth - 260) + 'px';
      pop.style.top = (b.bottom + 8) + 'px';
      pop.classList.add('show');
    }
    if (!root.__pbClickBound) {
      root.__pbClickBound = true;
      root.addEventListener('click', function (e) {
        var Mp = window.__playMount;
        var pp = Mp && Mp.root === root ? Mp.pop : null;
        if (pp && !pp.contains(e.target) && !(e.target.closest && e.target.closest('.pad'))) pp.classList.remove('show');
      });
    }
    function toast(t) { var x = gid('toast'); if (!x) return; x.textContent = t; x.classList.add('show'); setTimeout(function () { x.classList.remove('show'); }, 1800); }
    window.__playMount = { rows: rows, render: render, place: place, count: count, toast: toast, root: root, todayIdx: todayIdx, pop: pop, openPop: openPop, get cur() { return cur; }, set cur(v) { cur = v; } };
    render();
    /* The TODAY band is measured from today's header; fonts and the side menu settle after the first paint,
       so measure again a few times and whenever the grid changes size. */
    [120, 400, 1000, 2500].forEach(function (t) { setTimeout(place, t); });
    if (window.ResizeObserver && g && !g.__bandRo) { g.__bandRo = new ResizeObserver(function () { place(); }); g.__bandRo.observe(g); }
    if (fixtureOn()) {
      mountMonths(root, rows);
      mountVoiceDemo(root, rows, render, count, toast);
    } else {
      /* live: month overlay (P11) and best streak (P14) come from playbook_log; milestone chips (P20) and
         longer beats (P13) come from the dated roadmap items. Anything without data stays hidden. */
      mountPlaybookExtrasLive(root, wrap);
      mountVoiceLive(root, rows, render, count, toast, todayIdx);
    }
    if (P().finishPaint) P().finishPaint(wrap);
  }

  function vanYmd(ms) {
    var n = typeof ms === 'number' ? ms : Date.parse(ms || '');
    if (!Number.isFinite(n)) return '';
    if (n < 1e12) n *= 1000;
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(n));
    function g(t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value; return ''; }
    return g('year') + '-' + g('month') + '-' + g('day');
  }
  /* Dated roadmap items (source 'roadmap', seeded from the meetings) are the real milestones. */
  function playMilestones() {
    return asList((window.STATE || {}).items).filter(function (it) {
      return it && it.due && String(it.source || '') === 'roadmap' && it.status !== 'dropped';
    }).map(function (it) {
      return { ymd: vanYmd(it.due), title: String(it.title || 'Milestone'), done: it.status === 'done', area: String(it.area || '') };
    }).filter(function (m) { return m.ymd; }).sort(function (a, b) { return a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0; });
  }
  function mountPlaybookExtrasLive(root, wrap) {
    var pb = (window.STATE || {}).playbook || {};
    var today = vancouverTodayIso();
    var api = asList(pb.rows).filter(function (r) { return r && r.id && !r.s; });
    var logs = {};
    asList(pb.monthLogs).forEach(function (l) { logs[l.rhythmId + '|' + l.day] = l.status; });
    var miles = playMilestones();
    var AREA_C = { investors: 'var(--gold)', outreach: 'var(--green)', legal: 'var(--amber)', dev: 'var(--lime)', send: 'var(--blue)', follow_up: 'var(--sky)' };
    function mcol(m) { return AREA_C[m.area] || 'var(--blue)'; }
    /* P14: best streak from the server (playbook_log). */
    var sc = wrap.querySelector('.score .s');
    var best = pb.bestStreak || {};
    if (sc) sc.innerHTML = 'week on beat' + (Number(best.days) > 0 ? '<br>best streak: ' + Number(best.days) + ' day' + (Number(best.days) === 1 ? '' : 's') + (best.name ? ' &middot; ' + esc(best.name) : '') : '');
    /* P13: longer beats = the next dated milestones, with real countdowns. */
    var beats = wrap.querySelector('.beats');
    var beatsHead = beats && beats.previousElementSibling && /LONGER BEATS/i.test(beats.previousElementSibling.textContent || '') ? beats.previousElementSibling : null;
    var ahead = miles.filter(function (m) { return !m.done && m.ymd >= today; }).slice(0, 6);
    /* Round 3 (P13): cadence beats with real countdowns, painted by redesign-pages-r3.js when it is loaded. */
    if (beats && window.__r3 && typeof window.__r3.paintBeats === 'function' && window.__r3.paintBeats(beats, beatsHead, pb, today, ahead)) beats = null;
    if (beats) {
      if (!ahead.length) {
        beats.style.display = 'none';
        if (beatsHead) beatsHead.style.display = 'none';
      } else {
        var t0 = Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
        beats.innerHTML = ahead.map(function (m) {
          var t1 = Date.UTC(Number(m.ymd.slice(0, 4)), Number(m.ymd.slice(5, 7)) - 1, Number(m.ymd.slice(8, 10)));
          var days = Math.max(0, Math.round((t1 - t0) / 86400000));
          var pct = Math.max(3, Math.min(100, Math.round(100 - (days / 60) * 100)));
          var label = new Date(t1).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });
          return '<div class="beat" data-action="play-beat"><div class="btop"><span class="n">' + esc(m.title) + '</span><span class="d">' + days + '<small>days left</small></span></div><div class="bar"><i style="width:' + pct + '%;background:' + mcol(m) + '"></i></div><div class="f"><span>due ' + esc(label) + '</span><span>' + esc(m.area || 'roadmap') + '</span></div></div>';
        }).join('');
        beats.style.display = '';
        if (beatsHead) beatsHead.style.display = '';
      }
    }
    /* P11 + P20: month overlay from playbook_log, milestone row from the roadmap. */
    var openCal = wrap.querySelector('#openCal');
    var monthsEl = root.getElementById('months');
    if (!api.length || !monthsEl) {
      ['#openCal', '#ov'].forEach(function (sel) { var n = wrap.querySelector(sel); if (n) n.style.display = 'none'; });
      return;
    }
    if (openCal) openCal.style.display = '';
    var names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var ty = Number(today.slice(0, 4)), tm = Number(today.slice(5, 7)) - 1;
    var H = '';
    var statCur = '';
    [-1, 0, 1].forEach(function (off, mi) {
      var first = new Date(Date.UTC(ty, tm + off, 1));
      var y = first.getUTCFullYear(), m = first.getUTCMonth();
      var nDays = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      var startDow = (first.getUTCDay() + 6) % 7;
      function ymd(d) { return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
      var due = 0, hit = 0;
      var body = '';
      api.forEach(function (r) {
        var col = 'var(' + colorVar(r.color) + ')';
        var sched = defaultSched(r);
        var created = String(r.created_at || '').slice(0, 10);
        body += '<div class="mlab"><i style="background:' + col + '"></i>' + esc(r.name) + '</div>';
        for (var d = 1; d <= nDays; d++) {
          var day = ymd(d);
          var on = sched.indexOf(weekdayIso(day)) >= 0 && !(created && day < created);
          var st = logs[r.id + '|' + day];
          var c = 'off';
          if (st === 'done') c = 'done';
          else if (!on) c = 'off';
          else if (day < today) c = 'miss';
          else if (day === today) c = 'due';
          else c = 'fut';
          if (on && day <= today) { due += 1; if (st === 'done') hit += 1; }
          body += '<div class="mp ' + c + (day === today ? ' td' : '') + '" style="--c:' + col + '" title="' + esc(r.name + ' ' + day) + '"></div>';
        }
      });
      var stat = off > 0 ? 'upcoming' : (due ? Math.round((hit / due) * 100) + '% on beat' : 'no plays yet');
      if (off === 0) statCur = stat;
      H += '<div class="month"><div class="mname">' + names[m] + ' ' + y + '<span>' + stat + '</span></div><div class="mg" style="grid-template-columns:190px repeat(' + nDays + ',1fr)">';
      H += '<div></div>';
      for (var d = 1; d <= nDays; d++) {
        var dow = (startDow + d - 1) % 7;
        H += '<div class="mdh' + (dow >= 5 ? ' we' : '') + (ymd(d) === today ? ' td' : '') + '">' + 'MTWTFSS'[dow] + '<b>' + d + '</b></div>';
      }
      var monthMiles = miles.filter(function (x) { return x.ymd.slice(0, 7) === ymd(1).slice(0, 7); });
      if (monthMiles.length) {
        H += '<div class="mlab" style="color:var(--mut);font-size:10px;letter-spacing:.1em">MILESTONES</div>';
        for (d = 1; d <= nDays; d++) {
          var ms = monthMiles.filter(function (x) { return x.ymd === ymd(d); });
          H += ms.length ? '<div class="ms" data-action="play-ms" style="background:' + mcol(ms[0]) + '" title="' + esc(ms.map(function (x) { return x.title; }).join(' / ')) + '">' + esc(ms[0].title) + '</div>' : '<div></div>';
        }
      }
      H += body + '</div></div>';
      if (mi < 2) H += '<div class="gap"></div>';
    });
    monthsEl.innerHTML = H;
    var stEl = wrap.querySelector('#ov .mtop .stat');
    if (stEl) stEl.innerHTML = '<b>' + esc(statCur) + '</b> this month' + (Number(best.days) > 0 ? ' &middot; best streak <b>' + Number(best.days) + '</b> days' : '');
    var ov = root.getElementById('ov');
    if (ov) { ov.style.display = ''; ov.onclick = function (e) { if (e.target.id === 'ov') e.target.classList.remove('open'); }; }
  }

  function mountMonths(root, rows) {
    var daily = rows.filter(function (r) { return r.d && rows.indexOf(r) < rows.findIndex(function (x) { return x.s === 'Weekly'; }); });
    var months = [
      { name: 'October 2026', days: 31, start: 3, stat: '81% on beat', ms: { 20: ['Mktg drop', 'var(--green)'], 23: ['4ormIQ live', 'var(--lime)'], 30: ['F&F close', 'var(--gold)'], 31: ['Newsletter', 'var(--blue)'] } },
      { name: 'November 2026', days: 30, start: 6, stat: 'upcoming', ms: { 3: ['Mktg drop', 'var(--green)'], 17: ['Mktg drop', 'var(--green)'], 30: ['Newsletter', 'var(--blue)'] } },
      { name: 'December 2026', days: 31, start: 1, stat: 'upcoming', ms: { 1: ['Mktg drop', 'var(--green)'], 15: ['Mktg drop', 'var(--green)'], 31: ['Q4 letter', 'var(--amber)'] } }
    ];
    function colOf(r) { return pillCol(rows, r); }
    function rnd(n) { return Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1; }
    var H = '';
    months.forEach(function (mo, mi) {
      H += '<div class="month"><div class="mname">' + mo.name + '<span>' + mo.stat + '</span></div><div class="mg" style="grid-template-columns:190px repeat(' + mo.days + ',1fr)">';
      H += '<div></div>';
      for (var d = 1; d <= mo.days; d++) {
        var dow = (mo.start + d - 1) % 7, we = dow >= 5, td = mi === 0 && d === 16;
        H += '<div class="mdh' + (we ? ' we' : '') + (td ? ' td' : '') + '">' + 'MTWTFSS'[dow] + '<b>' + d + '</b></div>';
      }
      H += '<div class="mlab" style="color:var(--mut);font-size:10px;letter-spacing:.1em">MILESTONES</div>';
      for (d = 1; d <= mo.days; d++) {
        var m = mo.ms[d];
        H += m ? '<div class="ms" data-action="play-ms" style="background:' + m[1] + '" title="' + m[0] + '">' + m[0] + '</div>' : '<div></div>';
      }
      daily.forEach(function (r, k) {
        var col = colOf(r);
        H += '<div class="mlab"><i style="background:' + col + '"></i>' + r.n + '</div>';
        for (d = 1; d <= mo.days; d++) {
          dow = (mo.start + d - 1) % 7; we = dow >= 5; td = mi === 0 && d === 16;
          var past = mi === 0 && d < 16;
          var inboxDaily = r.room === 'msg' || r.room === 'news';
          var c = 'fut';
          if (we && !inboxDaily) c = 'off';
          else if (past) c = rnd(d * 13 + k * 7) < 0.15 ? 'miss' : 'done';
          else if (td) c = (r.d[0] === D ? 'done' : 'due');
          H += '<div class="mp ' + c + (td ? ' td' : '') + '" style="--c:' + col + '"></div>';
        }
      });
      H += '</div></div>';
      if (mi < months.length - 1) H += '<div class="gap"></div>';
    });
    var monthsEl = root.getElementById('months');
    if (monthsEl) monthsEl.innerHTML = H;
    var ov = root.getElementById('ov');
    if (ov) ov.onclick = function (e) { if (e.target.id === 'ov') e.target.classList.remove('open'); };
  }

  function mountVoiceDemo(root, rows, render, count, toast) {
    var btn = root.getElementById('recBtn'), tm = root.getElementById('vTime'), wave = root.getElementById('wave'), tx = root.getElementById('vTx'), st = root.getElementById('vState'), heard = root.getElementById('heard'), cnt = root.getElementById('vCount'), sv = root.getElementById('vSave'), ds = root.getElementById('vDiscard'), hint = root.getElementById('vHint');
    if (!btn || !wave) return;
    for (var i = 0; i < 26; i++) wave.appendChild(document.createElement('b'));
    var SAY = "Posted today's clip on LinkedIn. Reached out to three brokers from the Century 21 list. Commented on four posts. I owe Kevin the GTM deck by Tuesday. Note for the newsletter: the RPAA review deadline angle is landing well.";
    var on = false, t0 = 0, iv = null, wv = null, ti = null;
    root.querySelectorAll('.dest em').forEach(function (e) { e.onclick = function () { root.querySelectorAll('.dest em').forEach(function (x) { x.classList.remove('on'); }); e.classList.add('on'); }; });
    function start() {
      on = true; btn.classList.add('on'); wave.classList.add('on'); hint.innerHTML = 'Listening&hellip;<br>Tap to stop.'; st.textContent = 'recording - transcribing live'; tx.innerHTML = ''; heard.innerHTML = '<div class="hempty">Listening&hellip;</div>'; cnt.textContent = '0 items'; sv.disabled = ds.disabled = true;
      t0 = Date.now(); iv = setInterval(function () { var s = Math.floor((Date.now() - t0) / 1000); tm.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 250);
      wv = setInterval(function () { wave.querySelectorAll('b').forEach(function (b) { b.style.height = (4 + Math.random() * 24) + 'px'; }); }, 110);
      var words = SAY.split(' '); var i2 = 0; ti = setInterval(function () { if (i2 >= words.length) { stop(); return; } tx.textContent += (i2 ? ' ' : '') + words[i2++]; }, 140);
    }
    function stop() { on = false; clearInterval(iv); clearInterval(wv); clearInterval(ti); btn.classList.remove('on'); wave.classList.remove('on'); wave.querySelectorAll('b').forEach(function (b) { b.style.height = '6px'; }); hint.innerHTML = 'Tap to record again.'; st.textContent = 'done - edit before saving'; tx.textContent = SAY; parse(); }
    function parse() {
      var items = [
        { c: 'var(--pink)', t: 'Post today’s clip', k: 'play done', cls: 'g', r: 2 },
        { c: 'var(--green)', t: 'Reach out to 5', k: '3 / 5', cls: 'g', r: 4, v: '3/5' },
        { c: 'var(--sky)', t: 'Engage 10 min', k: '4 / 5', cls: 'g', r: 3, v: '4/5' },
        { c: 'var(--blue)', t: 'Send Kevin the GTM deck', k: '+ Execution · Tue', cls: 'b' },
        { c: 'var(--amber)', t: 'Newsletter: RPAA deadline angle', k: 'note to Newsletter', cls: 'a' }
      ];
      heard.innerHTML = items.map(function (x, i3) { return '<label class="hi"><input type="checkbox" checked data-i="' + i3 + '"><span class="sw" style="background:' + x.c + '"></span>' + x.t + '<span class="k ' + x.cls + '">' + x.k + '</span></label>'; }).join('');
      heard._items = items; cnt.textContent = items.length + ' items'; sv.disabled = ds.disabled = false;
    }
    btn.onclick = function () { on ? stop() : start(); };
    ds.onclick = function () { tx.innerHTML = ''; heard.innerHTML = '<div class="hempty">Discarded.</div>'; cnt.textContent = '0 items'; sv.disabled = ds.disabled = true; tm.textContent = '0:00'; st.textContent = 'ready'; };
    sv.onclick = function () {
      var it = heard._items || []; var plays = 0, tasks = 0, notes = 0;
      heard.querySelectorAll('input').forEach(function (cb) {
        if (!cb.checked) return; var x = it[+cb.dataset.i];
        if (x.r != null && rows[x.r]) { if (x.v && x.v.split('/')[0] < x.v.split('/')[1]) { rows[x.r].lab[0] = x.v; } else { rows[x.r].d[0] = 'done'; } plays++; }
        else if (x.cls === 'b') tasks++; else notes++;
      });
      if (typeof render === 'function') render(); if (typeof count === 'function') count();
      var hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
      root.getElementById('vHist').insertAdjacentHTML('afterbegin', '<div class="vrow"><span class="pl">Play</span><span class="tm">' + hm + '</span><span>&ldquo;' + tx.textContent.slice(0, 90) + '&hellip;&rdquo;</span><span class="c">' + plays + ' plays &middot; ' + tasks + ' task &middot; ' + notes + ' note</span></div>');
      toast("Saved to today’s log - " + plays + ' plays updated'); ds.onclick();
    };
  }

  function voiceHistory(root) {
    var box = root.getElementById('vHist');
    if (!box) return;
    auth('/api/voice/logs', { credentials: 'include', quiet: true }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      var list = asList(d && (d.logs || d.items || d.rows || d));
      var today = vancouverTodayIso();
      var fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      box.innerHTML = list.filter(function (x) {
        var at = Date.parse(x.created_at || x.createdAt || x.at || '');
        return Number.isFinite(at) && new Date(at).toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' }) === today;
      }).map(function (x) {
        var at = Date.parse(x.created_at || x.createdAt || x.at || '');
        var t = String(x.transcript || '');
        var n = asList(x.items).length;
        return '<div class="vrow"><span class="pl">Play</span><span class="tm">' + fmt.format(new Date(at)) + '</span><span>&ldquo;' + esc(t.slice(0, 90)) + (t.length > 90 ? '&hellip;' : '') + '&rdquo;</span><span class="c">' + n + ' item' + (n === 1 ? '' : 's') + '</span></div>';
      }).join('');
    }).catch(function () {});
  }
  function mountVoiceLive(root, rows, render, count, toast, todayIdx) {
    todayIdx = todayIdx == null ? 0 : todayIdx;
    voiceHistory(root);
    var btn = root.getElementById('recBtn'), tm = root.getElementById('vTime'), wave = root.getElementById('wave'), tx = root.getElementById('vTx'), st = root.getElementById('vState'), heard = root.getElementById('heard'), cnt = root.getElementById('vCount'), sv = root.getElementById('vSave'), ds = root.getElementById('vDiscard'), hint = root.getElementById('vHint');
    if (!btn || !wave) return;
    for (var i = 0; i < 26; i++) wave.appendChild(document.createElement('b'));
    root.querySelectorAll('.dest em').forEach(function (e) { e.onclick = function () { root.querySelectorAll('.dest em').forEach(function (x) { x.classList.remove('on'); }); e.classList.add('on'); }; });
    var rec = null, chunks = [], t0 = 0, iv = null, wv = null, on = false, recText = '';
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var liveRec = null;
    function tick() { var s = Math.floor((Date.now() - t0) / 1000); tm.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
    function start() {
      on = true; btn.classList.add('on'); wave.classList.add('on'); hint.innerHTML = 'Listening&hellip;<br>Tap to stop.'; st.textContent = 'recording - transcribing live'; tx.innerHTML = ''; heard.innerHTML = '<div class="hempty">Listening&hellip;</div>'; cnt.textContent = '0 items'; sv.disabled = ds.disabled = true; recText = '';
      t0 = Date.now(); iv = setInterval(tick, 250);
      wv = setInterval(function () { wave.querySelectorAll('b').forEach(function (b) { b.style.height = (4 + Math.random() * 24) + 'px'; }); }, 110);
      chunks = [];
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
          rec = new MediaRecorder(stream); rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); }; rec.start();
        }).catch(function () {});
      }
      if (SR) {
        liveRec = new SR(); liveRec.continuous = true; liveRec.interimResults = true; liveRec.lang = 'en-US';
        liveRec.onresult = function (e) { var t = ''; for (var i2 = 0; i2 < e.results.length; i2++) t += e.results[i2][0].transcript; recText = t; tx.textContent = t; };
        try { liveRec.start(); } catch (e2) {}
      }
    }
    function stop() {
      on = false; clearInterval(iv); clearInterval(wv); btn.classList.remove('on'); wave.classList.remove('on'); wave.querySelectorAll('b').forEach(function (b) { b.style.height = '6px'; }); hint.innerHTML = 'Tap to record again.'; st.textContent = 'transcribing…';
      if (liveRec) try { liveRec.stop(); } catch (e3) {}
      var blobP = Promise.resolve(null);
      if (rec && rec.state !== 'inactive') {
        blobP = new Promise(function (res) { rec.onstop = function () { res(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); }; rec.stop(); rec.stream.getTracks().forEach(function (t) { t.stop(); }); });
      }
      blobP.then(function (blob) {
        if (!blob || !blob.size) { finish(recText); return; }
        var fd = new FormData(); fd.append('audio', blob, 'voice.webm');
        auth('/api/voice/transcribe', { method: 'POST', body: fd, credentials: 'include' }).then(function (r) { return r.json(); }).then(function (d) { finish(String((d && d.transcript) || recText || '')); }).catch(function () { finish(recText); });
      });
    }
    function finish(text) {
      tx.textContent = text; st.textContent = 'done - edit before saving';
      auth('/api/voice/parse', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transcript: text, rhythms: rows.filter(function (r) { return r.n; }).map(function (r) { return { name: r.n, color: r.c }; }) }) })
        .then(function (r) { return r.json(); }).then(function (d) { paintItems(asList(d && d.items)); }).catch(function () { paintItems([]); });
    }
    function paintItems(items) {
      if (!items.length) { heard.innerHTML = '<div class="hempty">Nothing matched. Edit the transcript and save a note.</div>'; cnt.textContent = '0 items'; sv.disabled = ds.disabled = false; return; }
      heard.innerHTML = items.map(function (x, i3) { return '<label class="hi"><input type="checkbox" checked data-i="' + i3 + '"><span class="sw" style="background:' + esc(x.c || 'var(--blue)') + '"></span>' + esc(x.t) + '<span class="k ' + esc(x.cls || 'g') + '">' + (x.k || '') + '</span></label>'; }).join('');
      heard._items = items; cnt.textContent = items.length + ' items'; sv.disabled = ds.disabled = false;
    }
    btn.onclick = function () { on ? stop() : start(); };
    ds.onclick = function () { tx.innerHTML = ''; heard.innerHTML = '<div class="hempty">Discarded.</div>'; cnt.textContent = '0 items'; sv.disabled = ds.disabled = true; tm.textContent = '0:00'; st.textContent = 'ready'; };
    sv.onclick = function () {
      var it = heard._items || []; var plays = 0, tasks = 0, notes = 0;
      /* x.r indexes the rhythm list sent to /api/voice/parse (named rows only),
         not rows[] (which also holds section headers) */
      var named = rows.filter(function (r) { return r.n; });
      var jobs = [];
      heard.querySelectorAll('input').forEach(function (cb) {
        if (!cb.checked) return; var x = it[+cb.dataset.i];
        if (!x) return;
        var row = x.r != null ? named[+x.r] : null;
        if (!row && x.t) row = named.filter(function (r) { return String(r.n).toLowerCase() === String(x.t).toLowerCase(); })[0] || null;
        if (row) {
          row.d[todayIdx] = 'done';
          if (row.pads && row.pads[todayIdx]) row.pads[todayIdx].state = 'done';
          var day = (row.pads && row.pads[todayIdx] && row.pads[todayIdx].day) || vancouverTodayIso();
          if (row.id) jobs.push(auth('/api/playbook', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rhythmId: row.id, day: day, status: 'done', value: x.v || '' }) }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d && d.rows && window.STATE) window.STATE.playbook = d; }));
          plays++;
        } else if (x.cls === 'b') {
          jobs.push(auth('/api/items', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: String(x.t || 'Voice task'), area: 'other', priority: 'normal', column: 'today' }) }).then(function (r) { return r.ok ? r.json() : null; }).then(function (row2) { if (row2 && row2.id && window.STATE) { window.STATE.items = window.STATE.items || []; window.STATE.items.unshift(row2); } }));
          tasks++;
        } else {
          jobs.push(auth('/api/notes/sticky', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: String(x.t || ''), color: 'yellow', meta: { title: String(x.t || '').slice(0, 80), kind: 'idea' } }) }).then(function (r) { return r.ok ? r.json() : null; }).then(function (n) { if (n && n.id && window.STATE) { window.STATE.stickies = window.STATE.stickies || []; window.STATE.stickies.unshift(n); } }));
          notes++;
        }
      });
      Promise.all(jobs.map(function (j) { return j.catch(function () { return 'fail'; }); })).then(function (res) {
        if (res.indexOf('fail') >= 0) toast('Some items did not save - check the log');
        if (typeof window.paintRedesignWar === 'function') window.paintRedesignWar();
      });
      render(); count();
      var dest = (root.querySelector('.dest em.on') || {}).textContent || "Today’s log";
      auth('/api/voice/logs', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transcript: tx.textContent, items: it, destination: dest, duration_s: Math.floor((Date.now() - t0) / 1000) }) }).catch(function () {});
      var hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
      root.getElementById('vHist').insertAdjacentHTML('afterbegin', '<div class="vrow"><span class="pl">Play</span><span class="tm">' + hm + '</span><span>&ldquo;' + esc(tx.textContent.slice(0, 90)) + '&hellip;&rdquo;</span><span class="c">' + plays + ' plays &middot; ' + tasks + ' task &middot; ' + notes + ' note</span></div>');
      toast("Saved to today’s log - " + plays + ' plays updated'); ds.onclick();
    };
  }

  function paintPlaybookLive() {
    var host = document.getElementById('playDesk');
    if (host) { host.hidden = false; host.style.display = 'block'; }
    var view = document.getElementById('v-playbook');
    if (view) view.hidden = false;
    var wrap = wrapOf('playDesk');
    if (!wrap) { markReady('playDesk'); return; }
    if (P().applyPageCss) P().applyPageCss(wrap, 'playbook');
    var ST = window.STATE || {};
    var stale = !!(ST.playbook && ST.playbook.today && ST.playbook.today !== vancouverTodayIso());
    if (!fixtureOn() && (!ST.playbook || stale) && !ST.playbookError) {
      if (!ST.playbookLoading) loadLive('playbook');
      /* never show "All lights off" from an empty or yesterday's desk */
      wrap.innerHTML = '<div class="bar"><h1>Playbook</h1></div><div class="card" style="padding:28px 24px"><p>Loading&hellip;</p></div>';
      if (P().finishPaint) P().finishPaint(wrap);
      markReady('playDesk');
      return;
    }
    var data = playbookData();
    if (!fixtureOn() && ((window.STATE || {}).playbookError || data.error)) {
      wrap.innerHTML = '<div class="bar"><h1>Playbook</h1></div><div class="card" style="padding:28px 24px"><p>Couldn\'t load &mdash; Retry</p><p><span class="lnk" data-action="play-retry">Retry</span></p></div>';
      if (P().finishPaint) P().finishPaint(wrap);
      markReady('playDesk');
      return;
    }
    loadSnip('/pbwrap-snippet.html?v=15', function (html) {
      try {
        wrap.innerHTML = html || '<div class="pbwrap"></div>';
        if (!fixtureOn()) {
          var hist = wrap.querySelector('#vHist');
          if (hist) hist.innerHTML = '';
        }
        var root = wrap.getRootNode();
        mountPlaybook(root, wrap, data);
        if (typeof window.bindPlaybookP8 === 'function') window.bindPlaybookP8(root);
        liveLog('playbook', { rows: (data.rows || []).length, todayIdx: data.todayIdx });
        if (P().finishPaint) P().finishPaint(wrap);
      } catch (err) {
        console.warn('playbook paint', err);
      }
      markReady('playDesk');
    });
  }

  /* Wall-clock time in America/Vancouver -> epoch ms, whatever the browser's zone. */
  function vanOffsetMin(utcMs) {
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Vancouver', timeZoneName: 'shortOffset' }).formatToParts(new Date(utcMs));
      var tz = '';
      for (var i = 0; i < parts.length; i++) if (parts[i].type === 'timeZoneName') tz = parts[i].value;
      var m = tz.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
      if (!m) return -480;
      return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
    } catch (e) { return -480; }
  }
  function hourToMs(day, hour) {
    var p = String(day).split('-').map(Number);
    var hh = Math.floor(hour);
    var mm = Math.round((hour - hh) * 60);
    var wall = Date.UTC(p[0], (p[1] || 1) - 1, p[2] || 1, hh, mm);
    var guess = wall - vanOffsetMin(wall) * 60000;
    return wall - vanOffsetMin(guess) * 60000;
  }
  function emailsOf(ppl) {
    return asList(ppl).map(function (x) {
      var s = typeof x === 'object' && x ? String(x.email || '') : String(x || '');
      var m = s.match(/<([^>]+)>/);
      return (m ? m[1] : s).trim();
    }).filter(function (e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }).slice(0, 20);
  }
  function docName(d) { return typeof d === 'object' && d ? String(d.name || d.title || '') : String(d || ''); }
  function docUrl(d) {
    if (!d || typeof d !== 'object') return '';
    if (d.driveFileId) return 'https://drive.google.com/open?id=' + encodeURIComponent(d.driveFileId);
    return String(d.url || '');
  }
  /* What each event held when it was loaded or last saved; used to decide which fields to send in clear:[...]. */
  var calOrig = {};
  function calWrite(payload) {
    if (fixtureOn() || !payload || !payload.event) return Promise.resolve();
    var ev = payload.event;
    var start = hourToMs(ev.d, ev.s);
    var dur = Math.max(15, Math.round((Number(ev.e) - Number(ev.s)) * 60));
    var title = String(ev.t || 'New event');
    var attendees = emailsOf(ev.ppl);
    var loc = asList(ev.loc).map(function (l) { return /^Zoom · /.test(String(l)) ? 'https://' + String(l).replace(/^Zoom · /, '') : String(l); }).join(', ');
    var notes = String(ev.notes || '');
    var links = asList(ev.links);
    var docs = asList(ev.docs);
    var desc = [notes, links.length ? 'Links:\n' + links.join('\n') : '', docs.length ? 'Files:\n' + docs.map(function (d) { var u = docUrl(d); return docName(d) + (u ? ' - ' + u : ''); }).join('\n') : ''].filter(Boolean).join('\n\n');
    if (loc && /zoom/i.test(loc) && desc.indexOf('Join Zoom') < 0) desc = (desc ? desc + '\n\n' : '') + 'Join Zoom: https://us06web.zoom.us/j/7783632424';
    var attachments = docs.filter(function (d) { return docUrl(d); }).map(function (d) {
      var a = { fileUrl: docUrl(d), title: docName(d) };
      if (d && typeof d === 'object' && d.driveFileId) a.fileId = String(d.driveFileId);
      return a;
    });
    /* Server contract (backend log section 9): start (ms) + dur (minutes) drive the end time; the server
       sets the time zone and decides whether guests are emailed, so end/timeZone/sendUpdates are not sent. */
    var extra = {
      title: title, start: start, dur: dur,
      attendees: attendees, location: loc, description: desc, attachments: attachments,
      extendedProperties: { private: { fourm: '1', play: String(ev.play || '') } }
    };
    /* C22: the Google calendar picked in the editor (redesign-pages-r3.js); '' keeps the default calendar. */
    var gcal = window.__r3 && typeof window.__r3.calendarFor === 'function' ? window.__r3.calendarFor(ev, payload.type) : '';
    if (gcal) extra.calendarId = gcal;
    /* Reminders: a new event defaults to a 10-minute pop-up. An existing event keeps Google's reminders
       unless the editor set one (alertMin is undefined for events on the calendar's default reminders). */
    if (ev.alertMin != null || payload.type === 'create') {
      var mins = ev.alertMin == null ? 10 : Number(ev.alertMin);
      extra.reminders = mins < 0 ? { useDefault: false, overrides: [] } : { useDefault: false, overrides: [{ method: 'popup', minutes: mins }] };
    }
    /* PATCH: the server ignores an empty attendees/location/description/attachments unless it is named in
       clear:[...]. Name a field only when it had a value on load and the user has now emptied it. */
    if (payload.type === 'patch' && ev.id) {
      var was = calOrig[ev.id] || {};
      var clear = [];
      if (was.attendees && !attendees.length) clear.push('attendees');
      if (was.location && !loc) clear.push('location');
      if (was.description && !desc) clear.push('description');
      if (was.attachments && !attachments.length) clear.push('attachments');
      if (clear.length) extra.clear = clear;
    }
    function remember(d) {
      if (ev.id && !(d && d.error)) calOrig[ev.id] = { attendees: attendees.length, location: !!loc, description: !!desc, attachments: attachments.length };
      return d;
    }
    function done(kind) { return function (d) { console.info('[live-map] /api/calendar ' + kind, d); if (d && d.error) calToast('Google Calendar did not save: ' + d.error); return d; }; }
    function fail() { calToast('Could not reach Google Calendar - not saved'); }
    if (payload.type === 'create') {
      return auth('/api/calendar', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(extra) })
        .then(function (r) { return r.json(); }).then(function (d) { if (d && d.id) ev.id = d.id; return d; }).then(remember).then(done('POST')).catch(fail);
    }
    if (payload.type === 'patch' && ev.id) {
      return auth('/api/calendar', { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ id: ev.id }, extra)) })
        .then(function (r) { return r.json(); }).then(remember).then(done('PATCH')).catch(fail);
    }
    if (payload.type === 'decline' && ev.id) {
      return auth('/api/calendar', { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: ev.id, action: 'decline' }) })
        .then(function (r) { return r.json(); }).then(done('PATCH decline')).catch(fail);
    }
    if (payload.type === 'delete' && ev.id) {
      return auth('/api/calendar', { method: 'DELETE', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: ev.id }) })
        .then(function (r) { return r.json(); }).then(done('DELETE')).catch(fail);
    }
    return Promise.resolve();
  }
  function calToast(t) {
    var root = (window.__redesignCal && window.__redesignCal.root) || null;
    var u = root && root.getElementById && root.getElementById('undo');
    var tt = root && root.getElementById && root.getElementById('undoT');
    if (!u || !tt) return;
    tt.textContent = t; u.classList.add('show'); clearTimeout(u._t); u._t = setTimeout(function () { u.classList.remove('show'); }, 6000);
  }
  function calUndo(info) {
    if (fixtureOn() || !info) return;
    var prev = asList(info.prev), now = asList(info.now);
    var prevIds = {};
    prev.forEach(function (e) { if (e.id) prevIds[e.id] = e; });
    now.forEach(function (e) {
      if (e.id && !prevIds[e.id]) calWrite({ type: 'delete', event: e });
    });
    prev.forEach(function (e) {
      if (!e.id) return;
      var was = now.filter(function (x) { return x.id === e.id; })[0];
      if (!was) calWrite({ type: 'create', event: e });
      else if (was.d !== e.d || was.s !== e.s || was.e !== e.e || was.t !== e.t) calWrite({ type: 'patch', event: e });
    });
  }
  /* Read back every field the editor writes. The description sections
     (notes / "Links:" / "Files:" / "Join Zoom") are split back into fields. */
  function splitDesc(desc) {
    var out = { notes: '', links: [], docs: [] };
    String(desc || '').split(/\n{2,}/).forEach(function (block) {
      var b = block.trim();
      if (!b) return;
      if (/^Links:\n/.test(b)) { out.links = out.links.concat(b.split('\n').slice(1).map(function (x) { return x.trim(); }).filter(Boolean)); return; }
      if (/^Files:\n/.test(b)) {
        b.split('\n').slice(1).forEach(function (x) {
          var m = x.trim().match(/^(.*?)(?: - (https?:\/\/\S+))?$/);
          if (m && m[1]) out.docs.push({ name: m[1], url: m[2] || '' });
        });
        return;
      }
      if (/^Join Zoom:/.test(b)) return;
      out.notes += (out.notes ? '\n\n' : '') + b;
    });
    return out;
  }
  function mapCalEvents(events) {
    return asList(events).map(function (e) {
      var start = Number(e.start);
      var d = new Date(start);
      var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
      function g(t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value; return ''; }
      var ymd = g('year') + '-' + g('month') + '-' + g('day');
      var s = (Number(g('hour')) % 24) + Number(g('minute')) / 60;
      var durH = (Number(e.dur) || 60) / 60;
      var all = durH >= 20 || !!e.allDay;
      var desc = splitDesc(e.description);
      var ppl = asList(e.attendees).filter(function (a) { return !(a && typeof a === 'object' && a.self); }).map(function (a) {
        if (a && typeof a === 'object') return a.email ? ((a.displayName || a.name) ? (a.displayName || a.name) + ' <' + a.email + '>' : a.email) : '';
        return String(a || '');
      }).filter(Boolean);
      var loc = String(e.location || '').trim();
      var att = asList(e.attachments).map(function (a) { return { name: a.title || a.name || 'File', url: a.fileUrl || a.url || '', driveFileId: a.fileId || '' }; });
      var rem = e.reminders && typeof e.reminders === 'object' ? e.reminders : null;
      /* useDefault (or no reminder data) maps to undefined, so a drag never replaces Google's default reminders. */
      var alertMin = rem && !rem.useDefault && Array.isArray(rem.overrides) ? (rem.overrides.length ? Number(rem.overrides[0].minutes) : -1) : undefined;
      if (e.id) calOrig[e.id] = { attendees: asList(e.attendees).length, location: !!loc, description: !!String(e.description || '').trim(), attachments: asList(e.attachments).length };
      var priv = (e.extendedProperties && e.extendedProperties.private) || {};
      var org = e.organizer && typeof e.organizer === 'object' ? e.organizer : null;
      return {
        id: e.id, d: ymd, s: s, e: Math.min(24, s + durH), t: e.title || e.t, c: /invest|cheque|raise/i.test(String(e.title || '')) ? 'inv' : (priv.play ? 'mile' : 'meet'), all: all ? 1 : 0,
        ppl: ppl, loc: loc ? loc.split(/,\s*(?=https?:|Zoom)/).map(function (l) { return /us06web\.zoom\.us\/j\/7783632424/.test(l) ? 'Zoom · us06web.zoom.us/j/7783632424' : l; }) : [],
        links: desc.links, docs: att.length ? att : desc.docs, notes: desc.notes, alertMin: alertMin, play: priv.play || '',
        organizer: org ? (org.email || '') : (e.organizer || ''), organizerSelf: org ? !!org.self : (e.organizerSelf != null ? !!e.organizerSelf : !e.organizer)
      };
    });
  }
  function calContacts() {
    var S = window.STATE || {};
    var seen = {};
    return asList(S.contacts).concat(asList(S.pipeline)).map(function (c) {
      return { name: String(c.name || c.fullName || '').trim(), email: String(c.email || '').trim().toLowerCase(), role: c.role || c.title || '', company: c.company || '' };
    }).filter(function (c) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) || seen[c.email]) return false;
      seen[c.email] = 1;
      return true;
    });
  }
  function calDocuments() {
    var S = window.STATE || {};
    var list = asList(S.staged).length ? S.staged : (asList(S.documents).length ? S.documents : asList(S.docs));
    return list.map(function (d) { return { name: d.name || d.title || '', url: d.url || d.webViewLink || '', driveFileId: d.driveFileId || d.drive_file_id || '' }; }).filter(function (d) { return d.name; });
  }
  function calUpload(file) {
    var fd = new FormData();
    fd.append('file', file); fd.append('name', file.name); fd.append('mime', file.type || '');
    return auth('/api/documents/upload', { method: 'POST', body: fd, credentials: 'include' }).then(function (r) {
      if (!r.ok) throw new Error('upload');
      return r.json();
    });
  }
  function calUpcoming() {
    return asList((window.STATE || {}).events).map(function (ev) {
      var raw = ev.start != null ? ev.start : ev.startMs;
      var n = typeof raw === 'number' ? raw : Date.parse(raw || '');
      if (n && n < 1e12) n *= 1000;
      return { id: ev.id || '', start: n || 0, title: ev.title || ev.summary || '', join: ev.join || '' };
    }).filter(function (x) { return x.start; });
  }

  var calRange = { from: 0, to: 0 };
  function paintCalendarLive(focusDate) {
    var wrap = wrapOf('calDesk');
    if (!wrap) { markReady('calDesk'); return; }
    if (P().applyPageCss) P().applyPageCss(wrap, 'calendar');
    var keepView = window.__redesignCal && window.__redesignCal.root === wrap.getRootNode() && window.__redesignCal.view ? window.__redesignCal.view() : '';
    /* Opening from the sidebar always lands on today unless a focusDate was passed. */
    var keepFocus = focusDate || null;
    if (!wrap.querySelector('.calwrap')) wrap.innerHTML = '<div class="card" style="padding:28px 24px">Loading&hellip;</div>';
    loadSnip('/calwrap-snippet.html?v=4', function (html) {
      var live = !fixtureOn();
      function go(events) {
        try {
          wrap.innerHTML = html || '<div class="calwrap"></div>';
          var calEl = wrap.querySelector('.calwrap');
          if (live && calEl) calEl.classList.add('live-align');
          var root = wrap.getRootNode();
          var today = live
            ? (typeof window.vancouverTodayDate === 'function' ? window.vancouverTodayDate() : new Date())
            : new Date(2026, 9, 19);
          if (typeof window.mountRedesignCalendar === 'function') {
            window.mountRedesignCalendar(root, {
              fixture: !live,
              live: live,
              today: today,
              focus: keepFocus || today,
              view: keepView || undefined,
              events: live ? events : null,
              write: calWrite,
              undo: calUndo,
              contacts: live ? calContacts() : [],
              documents: live ? calDocuments() : [],
              upload: live ? calUpload : null,
              upcoming: live ? calUpcoming() : [],
              onFocus: function (f) {
                if (!live) return;
                var t = f.getTime();
                if (t < calRange.from + 7 * 86400000 || t > calRange.to - 7 * 86400000) paintCalendarLive(f);
              },
              railClosed: (function () { try { return new URLSearchParams(location.search || '').get('rail') === '0'; } catch (e) { return false; } })()
            });
            var wantEvent = !live && (function () { try { return new URLSearchParams(location.search || '').get('event') === '1'; } catch (e) { return false; } })();
            if (wantEvent && FC().CAL_EVENT && window.__redesignCal && typeof window.__redesignCal.openPop === 'function') {
              window.__redesignCal.openPop(Object.assign({}, FC().CAL_EVENT), 620, 220);
              var pop = root.getElementById('pop');
              if (pop) { pop.style.left = '560px'; pop.style.top = '120px'; }
            }
          }
          liveLog('calendar', { events: (events || []).length, live: live });
          if (P().finishPaint) P().finishPaint(wrap);
        } catch (err) {
          console.warn('calendar paint', err);
        }
        markReady('calDesk');
      }
      if (!live) { go(null); return; }
      var center = keepFocus ? keepFocus.getTime() : Date.now();
      calRange.from = center - 70 * 86400000;
      calRange.to = center + 70 * 86400000;
      var from = new Date(calRange.from).toISOString();
      var to = new Date(calRange.to).toISOString();
      auth('/api/calendar?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to), { credentials: 'include' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var events = mapCalEvents(d && d.events);
          console.info('[live-map] /api/calendar', { count: events.length, keys: (d && d.events && d.events[0]) ? Object.keys(d.events[0]) : [] });
          go(events);
        })
        .catch(function () { go([]); });
    });
  }

  function zoomData() {
    var data = fixtureOn()
      ? { meetings: ((F().zoom && F().zoom.meetings) || FC().ZOOM_M || []).slice(), meta: '43 meetings · synced 2 min ago' }
      : liveZoomState();
    if ((window.STATE || {}).zoomSort === 'oldest') {
      data.meetings = (data.meetings || []).slice().reverse();
    }
    return data;
  }
  function weekOf(iso) {
    var d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    if (!Number.isFinite(d.getTime())) return 'Earlier';
    var start = new Date(d);
    start.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    var end = new Date(start);
    end.setDate(start.getDate() + 6);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[start.getMonth()] + ' ' + start.getDate() + ' – ' + months[end.getMonth()] + ' ' + end.getDate();
  }
  function ymdOf(raw) {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      var epoch = raw > 1e12 ? raw : (raw > 20000 ? raw * 86400000 : NaN);
      var dn = new Date(epoch);
      if (Number.isFinite(dn.getTime())) {
        return dn.getUTCFullYear() + '-' + String(dn.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dn.getUTCDate()).padStart(2, '0');
      }
    }
    var s = String(raw || '');
    var m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    if (/^\d+$/.test(s)) return ymdOf(Number(s));
    var d = new Date(s);
    if (!Number.isFinite(d.getTime())) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function actionMatches(a, n) {
    var mid = String(a.meetingId || a.meeting_id || '');
    var nid = String(n.id || '');
    var noteId = String(n.noteId || n.note_id || '');
    if (mid && (mid === nid || mid === noteId)) return true;
    var title = String(a.meetingTitle || a.meeting_title || '').toLowerCase().replace(/\s+/g, ' ').trim();
    var nt = String(n.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
    var ad = ymdOf(a.meetingDate || a.meeting_date);
    var nd = ymdOf(n.date || n.note_date);
    if (title && nt && title === nt) return true;
    if (title && nt && ad && nd && ad === nd && (title.indexOf(nt) >= 0 || nt.indexOf(title) >= 0)) return true;
    return false;
  }
  function stripLead(text, people) {
    var s = String(text || '').replace(/^Note to self:\s*/i, '').replace(/^["“]+|["”]+$/g, '').trim();
    asList(people).forEach(function (p) {
      var full = String(p || '').trim();
      if (!full) return;
      var first = full.split(/\s+/)[0];
      var esc = function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
      for (var i = 0; i < 3; i++) {
        s = s.replace(new RegExp('^' + esc(full) + '\\s*(?:\\([^)]{0,80}\\))?\\s*:\\s*', 'i'), '');
        s = s.replace(new RegExp('^' + esc(first) + '\\s*:\\s*', 'i'), '');
      }
    });
    return s.replace(/^["“]+|["”]+$/g, '').trim();
  }
  function liveZoomState() {
    var seenZoom = {};
    var notes = asList((window.STATE || {}).zoomNotes).filter(function (n) {
      if (/^\[archived\]/i.test(String(n.title || ''))) return false;
      var kid = String(n.id || n.noteId || n.meetingId || '');
      if (kid && seenZoom[kid]) return false;
      if (kid) seenZoom[kid] = 1;
      return true;
    });
    var gone = (window.STATE || {}).zoomDismissed || {};
    var actions = asList((window.STATE || {}).meetingActions).filter(function (a) {
      return !gone[String(a.id)] && a.status !== 'done' && a.status !== 'tasked' && a.status !== 'dismissed' && a.status !== 'handled';
    });
    var used = {};
    var meetings = notes.map(function (n) {
      var people = asList(n.attendees).filter(function (p) { return p && !isChad(p); });
      var id = String(n.id || n.noteId || '');
      var mine = actions.filter(function (a, i) {
        if (!actionMatches(a, n)) return false;
        used[i] = 1;
        return true;
      });
      var owe = mine.length || Number(n.owe) || 0;
      var quote = asList(n.others)[0] || (asList(n.intel)[0] && (n.intel[0].value || n.intel[0])) || '';
      var ymd = ymdOf(n.date || n.note_date);
      var dt = ymd.split('-');
      var mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][Number(dt[1] || 1) - 1] || 'OCT';
      var oweRows = mine.map(function (a) {
        return [a.kind === 'follow_up' ? 'fu' : 'you', a.text, a.id || ''];
      });
      var quotes = asList(n.quotes).map(function (q) {
        var who = Array.isArray(q) ? q[0] : (q.who || '');
        var text = Array.isArray(q) ? q[1] : (q.text || q);
        return [who, stripLead(text, [who].concat(people))];
      });
      return {
        id: id, noteId: n.noteId, ymd: ymd, y: Number(dt[0] || 0), wk: weekOf(ymd || n.date), m: mon, d: Number(dt[2] || 0), t: n.title, p: people,
        transcript: n.transcript || '', recordingUrl: n.recordingUrl || n.recording_url || '',
        solo: n.solo || !people.length ? 1 : 0, owe: owe, s: stripLead(quote, people),
        src: /riverside/i.test(String(n.origin || '')) ? 'Riverside' : /granola/i.test(String(n.origin || '') + JSON.stringify(n.sources || [])) ? 'Granola' : 'Zoom',
        improve: n.improve, aiSummary: n.aiSummary, quotes: quotes, decided: n.decided, said: n.said, roles: n.roles,
        actions: oweRows.length ? oweRows : n.actions
      };
    });
    meetings.sort(function (a, b) { return String(b.ymd || '').localeCompare(String(a.ymd || '')); });
    return { meetings: meetings, meta: notes.length + ' meetings' };
  }

  function fmtMeetingDay(ymd) {
    if (!ymd) return '';
    var d = new Date(ymd + 'T12:00:00');
    var mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    return d.getDate() + ' ' + mon + ' ' + d.getFullYear();
  }
  function agoChip(ymd) {
    if (!ymd) return '';
    var t = new Date(ymd + 'T12:00:00');
    var now = new Date();
    var a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    var b = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
    var days = Math.round((a - b) / 86400000);
    var text = days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 7 ? days + ' days ago' : days < 14 ? '1 week ago' : days < 28 ? Math.round(days / 7) + ' weeks ago' : (Math.max(1, Math.round(days / 30)) + (Math.round(days / 30) === 1 ? ' month ago' : ' months ago'));
    return '<span class="ago">' + text + '</span>';
  }
  function paintZoomLive() {
    var wrap = wrapOf('zoomDesk');
    if (!wrap) { markReady('zoomDesk'); return; }
    var data = zoomData();
    var meetings = data.meetings || [];
    var zf = (window.STATE || {}).zoomFilter || 'all';
    var zsrc = (window.STATE || {}).zoomSrc || 'all';
    if (zf === 'owed') meetings = meetings.filter(function (m) { return !m.solo && Number(m.owe) > 0; });
    else if (zf === 'solo') meetings = meetings.filter(function (m) { return m.solo; });
    else if (zf && zf !== 'all') meetings = meetings.filter(function (m) { return (String(m.t || '') + ' ' + asList(m.p).join(' ') + ' ' + String(m.s || '')).toLowerCase().indexOf(String(zf).toLowerCase()) >= 0; });
    if (zsrc && zsrc !== 'all') meetings = meetings.filter(function (m) { return String(m.src || '').toLowerCase() === String(zsrc).toLowerCase(); });
    loadSnip('/zwrap-snippet.html?v=2', function (html) {
      wrap.innerHTML = html || '<div class="zwrap"></div>';
      var root = wrap.getRootNode();
      var sortKey = (window.STATE || {}).zoomSort || 'newest';
      var filterKey = (window.STATE || {}).zoomFilter || 'all';
      root.querySelectorAll('[data-action="zoom-sort"]').forEach(function (c) {
        c.classList.toggle('on', (c.getAttribute('data-sort') || '') === sortKey);
      });
      root.querySelectorAll('[data-action="zoom-filter"]').forEach(function (c) {
        c.classList.toggle('on', (c.getAttribute('data-filter') || '') === filterKey);
      });
      var meta = wrap.querySelector('.ztop .meta');
      if (meta) meta.textContent = data.meta || (meetings.length + ' meetings');
      var box = root.getElementById('boxes');
      var h = '', w = '';
      meetings.forEach(function (x, i) {
        if (x.wk !== w) { if (w) h += '</div>'; w = x.wk; h += '<div class="wkh">' + esc(w) + '</div><div class="gridm">'; }
        var people = asList(x.p).filter(function (p) { return !isChad(p); });
        var who = people.length ? people.slice(0, 2).join(', ') + (people.length > 2 ? ' +' + (people.length - 2) : '') : 'Just you';
        var leadName = people[0] ? people[0].split(' ')[0] : '';
        h += '<div class="mc" data-action="zoom-open" data-i="' + i + '" data-id="' + esc(x.id || '') + '"><div class="d">' + esc(fmtMeetingDay(x.ymd)) + ' ' + agoChip(x.ymd) + '<span class="src">' + esc(x.src) + '</span></div><div class="t">' + esc(x.t) + '</div>'
          + '<div class="pp2">' + (people.map(function (n) { return '<span class="av" style="background:' + zcol(n) + '">' + esc(ini(n)) + '</span>'; }).join('') || '<span class="av" style="background:#8a96ad;margin:0">CJ</span>') + '<span class="n">' + esc(who) + '</span></div>'
          + '<div class="sn' + (x.solo ? ' self' : '') + '">' + (x.solo ? '<b style="color:#46556E">Note to self:</b> ' : (leadName ? '<b>' + esc(leadName) + ':</b> ' : '')) + esc(stripLead(x.s, x.p)) + '</div>'
          + '<div class="ft">' + (x.solo ? '<span class="tag solo">Solo</span>' : x.owe ? '<span class="tag owe">You owe ' + x.owe + '</span>' : '<span class="tag solo">Nothing owed</span>') + '<span class="op" data-action="zoom-open" data-i="' + i + '" data-id="' + esc(x.id || '') + '">Open</span><span class="ib" title="Edit" data-action="zoom-edit" data-id="' + esc(x.id || '') + '" data-title="' + esc(x.t || '') + '">Edit</span><span class="ib" title="Delete" data-action="zoom-archive" data-id="' + esc(x.id || '') + '" data-title="' + esc(x.t || '') + '">Delete</span></div></div>';
      });
      if (box) box.innerHTML = h + (w ? '</div>' : '');
      if (box && !fixtureOn() && (window.STATE || {}).zoomError) {
        if (meta) meta.textContent = 'Not loaded';
        box.innerHTML = '<div class="wkh">Couldn\'t load - <span class="lnk" data-action="zoom-retry" style="cursor:pointer;text-decoration:underline">Retry</span></div>';
      }
      var dr = root.getElementById('drawer'), sc = root.getElementById('scrim');
      function show(v) { dr.classList.toggle('open', v); sc.classList.toggle('open', v); }
      function toast(t) { var x = root.getElementById('toast'); x.textContent = t; x.classList.add('show'); setTimeout(function () { x.classList.remove('show'); }, 1600); }
      function genR(x) {
        var p = asList(x.p);
        var said = {};
        if (p.length && x.s) said[p[0]] = [x.s];
        var owe = asList(x.actions);
        var whenTxt = fmtMeetingDay(x.ymd);
        return { when: whenTxt, roles: x.roles || {}, said: x.said || (x.solo ? {} : said), summary: x.aiSummary || (x.solo ? String(x.s || '').replace(/^Note to self:\s*/i, '') : x.s), improve: asList(x.improve), owe: owe, quotes: asList(x.quotes), decided: asList(x.decided) };
      }
      function reader(i) {
        var x = meetings[i], r = (fixtureOn() && FC().ZREADER && FC().ZREADER[i]) ? FC().ZREADER[i] : genR(x);
        function av(n) { return '<span class="av" style="background:' + zcol(n) + '">' + esc(ini(n)) + '</span>'; }
        var people = asList(x.p);
        return '<div class="rh" style="margin-top:-6px"><h2>' + esc(x.t) + '</h2><div class="ic"><span class="ib" title="Edit" data-action="zoom-edit" data-id="' + esc(x.id || '') + '" data-title="' + esc(x.t || '') + '">Edit</span><span class="ib" title="Delete" data-action="zoom-archive" data-id="' + esc(x.id || '') + '" data-title="' + esc(x.t || '') + '">Delete</span></div></div>'
          + '<div class="when">' + esc(r.when) + ' ' + agoChip(x.ymd) + ' &middot; ' + esc(x.src) + ' notes' + (x.src === 'Zoom' ? ' + recording + transcript' : '') + '</div>'
          + '<div class="ppl">' + people.map(function (n) { return '<span class="pp">' + av(n) + esc(n) + (r.roles[n] ? ' <em>&middot; ' + esc(r.roles[n]) + '</em>' : '') + '</span>'; }).join('') + '<span class="pp"><span class="av" style="background:#8a96ad">CJ</span>You</span></div>'
          + '<div class="acts">' + (x.transcript ? '<button class="btn sm pri" data-action="zoom-transcript" data-i="' + i + '">Open transcript</button>' : '') + (x.recordingUrl ? '<button class="btn sm" data-action="zoom-play" data-url="' + esc(x.recordingUrl) + '">Play recording</button>' : '') + '<button class="btn sm" data-action="zoom-follow" data-name="' + esc(people[0] || '') + '">Draft follow-up email</button><button class="btn sm" data-action="zoom-space" data-i="' + i + '" data-id="' + esc(x.id || '') + '">Add to a Space</button>' + (people[0] ? '<button class="btn sm" data-action="zoom-contact" data-name="' + esc(people[0]) + '">Open ' + esc(people[0].split(' ')[0]) + ' in Contacts</button>' : '') + '</div>'
          + '<div class="ai"><div class="sh"><b>4orm Intelligence on this meeting</b><span>summary</span></div><p>' + esc(r.summary) + '</p><div class="ask"><input placeholder="Ask about this meeting" data-action="zoom-ask-input"><button class="btn sm pri" data-action="zoom-ask">Ask</button></div></div>'
          + '<div class="grid2"><div>'
          + (x.solo ? '' : '<div class="sec" style="margin-bottom:14px"><div class="sh"><b>What others said</b><span>intel first</span></div>' + Object.keys(r.said || {}).map(function (n) { return '<div class="said"><div class="who">' + av(n) + esc(n) + (r.roles[n] ? ' <em>' + esc(r.roles[n]) + '</em>' : '') + '</div><ul>' + asList(r.said[n]).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>'; }).join('') + '</div>')
          + (asList(r.improve).length ? '<div class="sec imp" style="margin-bottom:14px"><div class="sh"><b>Where you can improve</b><span>coaching</span></div>' + r.improve.map(function (t, k) { return '<div class="iv"><span>' + (k + 1) + '</span>' + esc(t) + '</div>'; }).join('') + '</div>' : '')
          + (asList(r.quotes).length ? '<div class="sec"><div class="sh"><b>Worth quoting</b><span>from the transcript</span></div>' + r.quotes.map(function (q) { return '<div class="q"><b>' + esc(q[0]) + ':</b> "' + esc(stripLead(q[1], [q[0]].concat(people))) + '"</div>'; }).join('') + '</div>' : '')
          + '</div><div>'
          + '<div class="sec" style="margin-bottom:14px"><div class="sh"><b>What you owe</b><span>' + asList(r.owe).length + ' open</span></div>' + (asList(r.owe).length ? r.owe.map(function (o) { return '<div class="owe"><span class="k ' + esc(o[0]) + '">' + (o[0] === 'you' ? 'You said' : 'Follow up') + '</span><span class="t">' + esc(o[1]) + '</span><span class="ad"><button data-action="zoom-task" data-aid="' + esc(o[2] || '') + '" data-title="' + esc(o[1]) + '" data-bucket="today">+ Today</button><button data-action="zoom-task" data-aid="' + esc(o[2] || '') + '" data-title="' + esc(o[1]) + '" data-bucket="week">+ Week</button></span></div>'; }).join('') : '<div class="emp">Nothing owed from this meeting.</div>') + '</div>'
          + '<div class="sec" style="margin-bottom:14px"><div class="sh"><b>Decided</b><span>' + asList(r.decided).length + '</span></div>' + (asList(r.decided).length ? r.decided.map(function (d) { return '<div class="dec"><i>&#10003;</i>' + esc(d) + '</div>'; }).join('') : '<div class="emp">No decisions captured.</div>') + '</div>'
          + '<div class="sec"><div class="sh"><b>Full notes</b><span>as captured</span></div><div class="raw">' + esc(x.s) + '</div></div>'
          + '</div></div><div class="zfoot">Summarised by 4orm Intelligence from the ' + esc(x.src) + ' ' + (x.src === 'Zoom' ? 'transcript' : 'notes') + ' &middot; check the transcript before quoting anyone.</div>';
      }
      function openM(i) {
        root.getElementById('rd').innerHTML = reader(i);
        show(true);
        if (P().finishPaint) P().finishPaint(wrap);
      }
      if (sc) sc.onclick = function () { show(false); };
      if (window.__zoomEsc) window.removeEventListener('keydown', window.__zoomEsc);
      window.__zoomEsc = function (e) { if (e.key === 'Escape') show(false); };
      window.addEventListener('keydown', window.__zoomEsc);
      window.__zoomMount = { open: openM, show: show, meetings: meetings, toast: toast };
      (function () {
        var g = root.getElementById('grab'); var on = false;
        if (!g) return;
        g.onmousedown = function () {
          on = true; document.body.style.userSelect = 'none';
          function mv(e) { if (on) dr.style.width = Math.min(Math.max(window.innerWidth - e.clientX, 480), window.innerWidth * 0.95) + 'px'; }
          function up() { on = false; document.body.style.userSelect = ''; window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); }
          window.addEventListener('mousemove', mv);
          window.addEventListener('mouseup', up);
        };
      })();
      liveLog('zoom', { meetings: meetings.length });
      if (P().finishPaint) P().finishPaint(wrap);
      if (typeof window.bindGridZoom === 'function') {
        wrap.querySelectorAll('.gridm').forEach(function (g) { window.bindGridZoom(wrap, g, 'zoom', 4); });
      }
      markReady('zoomDesk');
    });
  }

  function paintCompletedLive() {
    var wrap = wrapOf('doneDesk');
    if (!wrap) { markReady('doneDesk'); return; }
    if (P().applyPageCss) P().applyPageCss(wrap, 'completed');
    if (fixtureOn()) {
      loadSnip('/done-snippet.html?v=2', function (html) {
        wrap.innerHTML = html;
        if (P().finishPaint) P().finishPaint(wrap);
        markReady('doneDesk');
      });
      return;
    }
    var snaps = asList((window.STATE || {}).snaps).map(function (s) {
      var p = s.payload && typeof s.payload === 'object' ? s.payload : {};
      return Object.assign({}, s, { date: ymdOf(s.date), payload: p, counts: s.counts || p.counts || {} });
    });
    var openDate = ymdOf((window.STATE || {}).snapOpenDate || ((window.STATE || {}).snapOpen && (window.STATE || {}).snapOpen.date) || (snaps[0] && snaps[0].date));
    var open = (window.STATE || {}).snapOpen;
    if (open && ymdOf(open.date) === openDate) {
      snaps = snaps.map(function (s) { return s.date === openDate ? Object.assign({}, s, { payload: open.payload || s.payload, summary: open.summary || s.summary, counts: (open.payload && open.payload.counts) || s.counts }) : s; });
    }
    function chipsOf(s) {
      var c = s.counts || {};
      var bits = [];
      function add(n, one, many) { n = Number(n) || 0; if (n) bits.push(n + ' ' + (n === 1 ? one : many)); }
      add(c.meetings, 'meeting', 'meetings');
      add(c.replies, 'reply', 'replies');
      add(c.sent, 'sent', 'sent');
      add(c.tasks, 'task', 'tasks');
      add(c.news, 'news', 'news');
      add(c.commitments, 'owed', 'owed');
      add(c.pipeline, 'pipeline', 'pipeline');
      if (bits.length) return bits;
      return String(s.summary || '').split(/\s*·\s*/).filter(Boolean);
    }
    /* Week groups (Monday start, Vancouver today): "This week", "Last week", then "Week of Oct 5". */
    function mondayOf(ymd) {
      var m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return '';
      var d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    }
    var thisMon = mondayOf(vancouverTodayIso());
    var lastMon = (function () {
      if (!thisMon) return '';
      var d = new Date(thisMon + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - 7);
      return d.toISOString().slice(0, 10);
    })();
    function weekLabel(ymd) {
      var mon = mondayOf(ymd);
      if (!mon) return 'Earlier';
      if (mon === thisMon) return 'This week';
      if (mon === lastMon) return 'Last week';
      var MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return 'Week of ' + MO[Number(mon.slice(5, 7)) - 1] + ' ' + Number(mon.slice(8, 10));
    }
    var lastWk = '';
    var list = snaps.length ? snaps.map(function (s) {
      var wkName = weekLabel(s.date);
      var head = wkName !== lastWk ? '<div class="wk">' + esc(wkName) + '</div>' : '';
      lastWk = wkName;
      return head + dayRow(s);
    }).join('') : '<div class="today"><span class="pulse"></span>No snapshots yet</div>';
    if ((window.STATE || {}).snapsError) {
      list = '<div class="today">Couldn\'t load - <span class="lnk" data-action="done-retry" style="cursor:pointer;text-decoration:underline">Retry</span></div>';
    }
    function dayRow(s) {
      var parts = (s.date || '').split('-');
      var day = Number(parts[2] || 0);
      var dow = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date((s.date || '') + 'T12:00:00').getDay()] || '';
      var on = s.date === openDate;
      var chips = chipsOf(s);
      return '<div class="day' + (on ? ' on' : '') + '" data-action="done-day" data-date="' + esc(s.date) + '"><div class="dt"><b>' + day + '</b><small>' + dow + '</small></div><div style="min-width:0"><div class="sm">' + esc(s.summary || (s.payload && s.payload.headline) || 'Day saved') + '</div><div class="ct">' + chips.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div></div></div>';
    }
    var cur = snaps.filter(function (s) { return s.date === openDate; })[0] || snaps[0] || {};
    var det = cur.payload || {};
    var counts = cur.counts || det.counts || {};
    var headline = det.headline || cur.summary || 'Nothing captured yet.';
    var titleDate = cur.date ? new Date(cur.date + 'T12:00:00') : null;
    var title = titleDate && Number.isFinite(titleDate.getTime())
      ? titleDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
      : (cur.date || 'Today');
    function personName(raw) {
      var s = String(raw || '').trim();
      var m = s.match(/^"?([^"<]+?)"?\s*</);
      if (m) return m[1].trim();
      return s.replace(/<[^>]+>/g, '').trim() || s;
    }
    function lines(arr, tag) {
      return asList(arr).map(function (row) {
        var t = typeof row === 'string' ? row : (row.title || row.text || '');
        var extra = typeof row === 'string' ? '' : (row.extra || row.to || row.from || '');
        return '<div class="li">' + (tag ? '<span class="tag t1">' + esc(tag) + '</span>' : '<i>&#10003;</i>') + '<span>' + esc(t) + '</span>' + (extra ? '<em>' + esc(extra) + '</em>' : '') + '</div>';
      }).join('');
    }
    function mailLines(arr, tag) {
      return asList(arr).map(function (row) {
        var subj = typeof row === 'string' ? row : (row.title || row.text || row.subject || '');
        var who = typeof row === 'string' ? '' : personName(row.from || row.to || row.name || '');
        var label = who && subj ? who + ' — ' + subj : (who || subj);
        var time = typeof row === 'string' ? '' : (row.time || row.when || (tag === 'Out' ? 'sent' : 'in'));
        return '<div class="li"><span class="tag t4">' + esc(tag) + '</span><span>' + esc(label) + '</span>' + (time ? '<em>' + esc(time) + '</em>' : '') + '</div>';
      }).join('');
    }
    var Sdone = window.STATE || {};
    var itemsAll = asList(Sdone.items).concat(asList(Sdone.plannerItems), asList(Sdone.timeline));
    function toMs(v) { var n = typeof v === 'number' ? v : Date.parse(String(v || '')); return Number.isFinite(n) ? n : 0; }
    function isDone(it) {
      if (!it) return false;
      var st = String(it.status || it.st || '');
      return st === 'done' || it.done === true;
    }
    function dueMs(it) {
      if (!it) return 0;
      if (it.due) return toMs(it.due);
      if (typeof it.e === 'number' && it.e > 10000) return it.e * 86400000;
      return 0;
    }
    function doneMs(it) {
      var t = toMs(it.updatedAt || it.updated_at || it.doneAt || it.done_at);
      if (t) return t;
      return dueMs(it);
    }
    var now = Date.now();
    var d30 = now - 30 * 86400000;
    var d60 = now - 60 * 86400000;
    var doneItems = itemsAll.filter(function (it) { return isDone(it); });
    var done30 = doneItems.filter(function (it) { var t = doneMs(it); return t >= d30 && t <= now; });
    var datedDone = done30.filter(function (it) { return dueMs(it); });
    var onTime = datedDone.filter(function (it) { return doneMs(it) <= dueMs(it) + 86400000; });
    var prevDone = doneItems.filter(function (it) { var t = doneMs(it); return t >= d60 && t < d30; });
    var prevDated = prevDone.filter(function (it) { return dueMs(it); });
    var prevOn = prevDated.filter(function (it) { return doneMs(it) <= dueMs(it) + 86400000; });
    var daysWith = {};
    done30.forEach(function (it) { var d = ymdOf(doneMs(it)); if (d) daysWith[d] = 1; });
    var dayN = Object.keys(daysWith).length;
    var fall = itemsAll.filter(function (it) {
      if (isDone(it)) return String(it.status) === 'dropped';
      var due = dueMs(it);
      return due && due < d30 && due >= d60;
    });
    var thin = dayN < 7 && done30.length < 7;
    function pctN(a, b) { return b ? Math.round(100 * a / b) : 0; }
    var onPct = !datedDone.length ? '-' : (pctN(onTime.length, datedDone.length) + '%');
    var cons = (dayN || done30.length) ? (dayN + ' / 30') : '-';
    var fallTxt = fall.length + ' · ' + pctN(fall.length, itemsAll.length) + '%';
    var weeks = [];
    for (var w = 7; w >= 0; w--) {
      var from = now - (w + 1) * 7 * 86400000, to = now - w * 7 * 86400000;
      weeks.push(doneItems.filter(function (it) { var t = doneMs(it); return t >= from && t < to; }).length);
    }
    var thru = weeks.reduce(function (a, n) { return a + n; }, 0);
    window.__doneStats = {
      done30: done30.length, datedDone: datedDone.length, onTime: onTime.length,
      dayN: dayN, fall: fall.length, throughput: thru, items: itemsAll.length
    };
    var maxW = Math.max.apply(null, weeks.concat([1]));
    var bars = weeks.map(function (n) { return '<i style="height:' + Math.max(8, Math.round(36 * n / maxW)) + 'px"></i>'; }).join('');
    var byArea = {};
    itemsAll.filter(function (it) { return !isDone(it) && dueMs(it) && dueMs(it) < now; }).forEach(function (it) {
      var a = String(it.area || it.p || it.category || 'other');
      byArea[a] = (byArea[a] || 0) + 1;
    });
    var slip = Object.keys(byArea).map(function (k) { return [k, byArea[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 3);
    var onRate = datedDone.length ? (onTime.length / datedDone.length) : null;
    var tips = thin ? ['Need seven days of data before these lines fill in.'] : [
      slip[0] ? (slip[0][0] + ' items slip most: ' + slip[0][1] + ' overdue. Book those calls first thing Monday.') : 'Keep clearing the oldest overdue item first.',
      dayN < 20 ? 'Consistency is ' + dayN + ' of 30 days. Close one small item every weekday.' : 'Streak is holding. Protect the first 25 minutes.',
      onRate == null ? 'No due-dated items were finished in the last 30 days, so on-time has no rate yet.'
        : (onRate < 0.5 ? 'On-time rate is low. Pull due dates forward before the week starts.'
          : (onRate < 0.8 ? 'On-time rate has room to move. Finish due items on the day they land.'
            : 'On-time rate is holding. Keep the same Friday review.'))
    ];
    var statsHtml = '<div class="house"><div class="hx" data-action="done-stat" data-k="ontime"><b>' + onPct + '</b><span>On time</span><em>' + (thin || !prevDated.length ? '' : 'vs prior 30 days ' + pctN(prevOn.length, prevDated.length) + '%') + '</em></div>'
      + '<div class="hx" data-action="done-stat" data-k="cons"><b>' + cons + '</b><span>Consistency</span><em>' + (thin ? '' : 'days with at least one item done') + '</em></div>'
      + '<div class="hx" data-action="done-stat" data-k="fall"><b>' + fallTxt + '</b><span>Fall-off</span><em>overdue never done, or dropped</em></div>'
      + '<div class="hx" data-action="done-stat" data-k="thru"><b>' + thru + '</b><span>Throughput</span><div class="bars">' + bars + '</div></div>'
      + '<div class="hx wide" data-action="done-stat" data-k="slip"><b>Slipping by area</b><span>' + (slip.map(function (s) { return esc(s[0]) + ' ' + s[1]; }).join(' · ') || '-') + '</span></div>'
      + '<div class="hx wide" data-action="done-stat" data-k="tips"><b>What to improve</b>' + tips.slice(0, 3).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</div></div>';
    wrap.innerHTML = '<div class="bar"><h1>Completed</h1><span class="sub">A snapshot of every day, saved at 23:55 — what moved, who you met, what you owe</span><div class="r"><button class="btn" type="button" data-action="done-search">Search days</button><button class="btn pri" type="button" id="snapNowLive" data-action="done-snap">Snapshot now</button></div></div>'
      + '<div class="lay"><section class="card">' + statsHtml + '<div class="today"><span class="pulse"></span>Today is being recorded — snapshot at 23:55</div>' + list + '</section>'
      + '<section class="card det"><div class="dh"><div><h2>' + esc(title) + '</h2><div class="meta">' + (cur.date && cur.date >= vancouverTodayIso() ? 'Recording - not yet saved' : 'Snapshot saved · read-only') + '</div></div><div class="r2"><button class="btn" type="button" data-action="done-export">Export PDF</button><button class="btn" type="button" data-action="done-investor" data-date="' + esc(cur.date || '') + '" data-headline="' + esc(headline) + '">Add to investor update</button></div></div>'
      + '<div class="moved"><b>What moved today</b><p>' + esc(headline) + '</p></div>'
      + '<div class="tiles">'
      + '<div class="tl" data-action="done-tile" data-k="tasks"><b>' + (counts.tasks || 0) + '</b><span>tasks done</span></div>'
      + '<div class="tl" data-action="done-tile" data-k="meetings"><b>' + (counts.meetings || 0) + '</b><span>meeting</span></div>'
      + '<div class="tl" data-action="done-tile" data-k="sent"><b>' + (counts.sent || 0) + '</b><span>emails sent</span></div>'
      + '<div class="tl' + (counts.replies ? ' g' : '') + '" data-action="done-tile" data-k="replies"><b>' + (counts.replies || 0) + '</b><span>reply in</span></div>'
      + '<div class="tl" data-action="done-tile" data-k="pipeline"><b>' + (counts.pipeline || 0) + '</b><span>pipeline moves</span></div>'
      + '<div class="tl" data-action="done-tile" data-k="raised"><b>' + (counts.raised != null ? counts.raised : '$0') + '</b><span>raised today</span></div>'
      + '</div>'
      + '<div class="cols">'
      + '<div class="sec"><div class="sh"><b>Done</b><span>' + asList(det.tasks).length + ' tasks</span></div>' + (lines(det.tasks) || '<div class="emp">No tasks captured.</div>') + '</div>'
      + '<div class="sec"><div class="sh"><b>Meetings &amp; commitments</b><span>' + asList(det.meetings).length + ' meeting</span></div>' + (lines(det.meetings, 'Zoom') + lines(det.commitments, 'You said') || '<div class="emp">Nothing captured yet.</div>') + '</div>'
      + '<div class="sec"><div class="sh"><b>Email</b><span>' + (counts.replies || 0) + ' in &middot; ' + (counts.sent || 0) + ' out</span></div>' + (mailLines(det.replies, 'In') + mailLines(det.sent, 'Out') || '<div class="emp">No mail captured.</div>') + '</div>'
      + '<div class="sec"><div class="sh"><b>Playbook</b><span>' + asList(det.plays).length + ' of 6 lit</span></div>'
      + '<div class="pads">' + (asList(det.plays).length ? asList(det.plays).map(function (p) { return '<span data-action="done-pad">' + esc(typeof p === 'string' ? p : (p.title || p.name || 'play')) + '</span>'; }).join('') : '<span class="off" data-action="done-pad">-</span>') + '</div></div>'
      + '<div class="sec"><div class="sh"><b>Voice log</b><span>' + (det.voice ? '1 entry' : '0') + '</span></div>'
      + '<div class="quote" data-action="done-voice">' + esc(det.voice || det.quote || '-') + '</div></div>'
      + '<div class="sec"><div class="sh"><b>News saved</b><span>' + asList(det.news).length + '</span></div>' + (lines(det.news, 'News') || '<div class="emp">No news saved.</div>') + '</div>'
      + '</div></section></div>';
    liveLog('completed', { snaps: snaps.length, open: openDate });
    if (P().finishPaint) P().finishPaint(wrap);
    markReady('doneDesk');
  }

  window.paintRedesignPlaybook = function () { whenCss(paintPlaybookLive); };
  window.paintRedesignCalendar = function () { whenCss(function () { paintCalendarLive(); }); };
  window.paintRedesignZoom = function () { whenCss(paintZoomLive); };
  window.paintRedesignCompleted = function () { whenCss(paintCompletedLive); };

  function hook() {
    window.loadPlaybook = function () { window.paintRedesignPlaybook(); };
    window.loadCalendarPage = function () { window.paintRedesignCalendar(); };
    window.renderZNotes = function () { window.paintRedesignZoom(); };
    window.renderDone = function () { window.paintRedesignCompleted(); };
  }
  hook();
  setInterval(hook, 500);

  window.__portLoadC = loadLive;
  function onDesk(v) {
    var d = (window.STATE && window.STATE.desk) || '';
    if (d) return d === v || (v === 'war' && d === 'room');
    var path = String(location.pathname || '');
    if (v === 'playbook') return /\/playbook\/?$/.test(path) || /view=playbook/.test(String(location.search || ''));
    if (v === 'war') return /\/war-room\/?$/.test(path) || path === '/';
    return false;
  }
  /* Midnight (Vancouver): the cached desk is yesterday's, so fetch again. */
  setInterval(function () {
    var pb = (window.STATE || {}).playbook;
    if (fixtureOn() || !pb || !pb.today || (window.STATE || {}).playbookLoading) return;
    if (pb.today !== vancouverTodayIso()) loadLive('playbook');
  }, 60000);
  function loadLive(desk) {
    if (fixtureOn()) return;
    if (desk === 'playbook') {
      if (window.STATE && window.STATE.playbookLoading && window.STATE.playbookLoading > Date.now() - 15000) return;
      if (window.STATE) window.STATE.playbookLoading = Date.now();
      auth('/api/playbook', { credentials: 'include', quiet: true }).then(function (r) {
        if (!r || !r.ok) throw new Error('playbook');
        return r.json();
      }).then(function (d) {
        if (d && d.error) throw new Error(String(d.error));
        if (window.STATE) {
          window.STATE.playbook = d;
          window.STATE.playbookError = false;
          window.STATE.playbookLoading = false;
        }
        console.info('[live-map] /api/playbook', d && typeof d === 'object' ? Object.keys(d) : typeof d);
        if (onDesk('playbook')) paintPlaybookLive();
        if (onDesk('war') && typeof window.paintRedesignWar === 'function') window.paintRedesignWar();
      }).catch(function () {
        if (window.STATE) { window.STATE.playbookError = true; window.STATE.playbookLoading = false; }
        if (onDesk('playbook')) paintPlaybookLive();
      });
    }
    if (desk === 'znotes' || desk === 'zoom') {
      Promise.all([
        /* The notes load decides the page: a failed read paints "Couldn't load - Retry" (zoomError), never an empty list. */
        auth('/api/zoom-notes', { credentials: 'include', quiet: true }).then(function (r) {
          if (!r || !r.ok) throw new Error('zoom');
          return r.json();
        }).then(function (d) {
          if (!d || d.error) throw new Error('zoom');
          return d;
        }).catch(function () { return null; }),
        auth('/api/meeting-actions', { credentials: 'include', quiet: true }).then(function (r) { return r.json(); }).catch(function () { return {}; })
      ]).then(function (pair) {
        var notes = pair[0];
        var acts = pair[1];
        if (window.STATE) {
          window.STATE.zoomError = !notes;
          if (notes) window.STATE.zoomNotes = asList(notes.notes);
          window.STATE.meetingActions = (acts && acts.actions) || [];
        }
        console.info('[live-map] /api/zoom-notes', { count: asList((window.STATE || {}).zoomNotes).length });
        console.info('[live-map] /api/meeting-actions', { count: asList((window.STATE || {}).meetingActions).length });
        paintZoomLive();
      });
    }
    if (desk === 'done') {
      auth('/api/snapshots', { credentials: 'include', quiet: true }).then(function (r) {
        if (!r || !r.ok) throw new Error('snapshots');
        return r.json();
      }).then(function (d) {
        if (!d || d.error || !Array.isArray(d.snapshots)) throw new Error('snapshots');
        if (window.STATE) { window.STATE.snaps = d.snapshots; window.STATE.snapsError = false; }
        console.info('[live-map] /api/snapshots', { count: asList(window.STATE.snaps).length });
        paintCompletedLive();
      }).catch(function () {
        /* Visible failure: Completed paints "Couldn't load - Retry" rather than "No snapshots yet". */
        if (window.STATE) window.STATE.snapsError = true;
        paintCompletedLive();
      });
    }
  }

  whenCss(function () {
    var path = String(location.pathname || '');
    var q = String(location.search || '');
    var map = [
      [/\/playbook\/?$/.test(path) || /view=playbook/.test(q), 'playDesk', paintPlaybookLive, 'playbook'],
      [/\/calendar\/?$/.test(path) || /view=calendar/.test(q), 'calDesk', paintCalendarLive, 'calendar'],
      [/\/zoom\/?$/.test(path) || /view=znotes/.test(q), 'zoomDesk', paintZoomLive, 'znotes'],
      [/\/completed\/?$/.test(path) || /view=done/.test(q), 'doneDesk', paintCompletedLive, 'done']
    ];
    map.forEach(function (row) {
      if (!row[0]) return;
      var host = document.getElementById(row[1]);
      var view = host && host.closest && host.closest('.view');
      if (view) view.hidden = false;
      row[2]();
      loadLive(row[3]);
    });
  });
})();
