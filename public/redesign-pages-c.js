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
  var ROOMS = { war: ['War Room', '/war-room'], studio: ['Studio', '/studio'], li: ['LinkedIn', '/messages?ch=linkedin'], pipe: ['Pipeline', '/pipeline'], spaces: ['Spaces', '/spaces'], msg: ['Messages', '/messages'], news: ['News', '/news'], iq: ['4ormIQ', '/4ormiq'], done: ['Completed', '/completed'], contacts: ['Contacts', '/contacts'], team: ['Team', '/messages?col=team'], dash: ['Dashboard', '/control-room'] };
  var PB_ROWS = [
    { s: 'Daily' },
    { n: 'One move', room: 'war', c: '--blue', d: [U, N, N, N, N, O, O], lab: ['GO'], st: '<b>2</b> days' },
    { n: '30-min video', room: 'studio', sub: 'Mon-Fri', c: '--red', d: [U, N, N, N, N, O, O], lab: ['GO'], st: '<b>3</b> / 5' },
    { n: "Post today’s clip", room: 'li', c: '--pink', d: [U, N, N, N, N, O, O], lab: ['GO'], st: '<b>4</b> / 5', nw: 1 },
    { n: 'Engage 10 min', room: 'li', sub: 'comment on 5', c: '--sky', d: [U, N, N, N, N, O, O], lab: ['0/5'], st: '<b>3</b> / 5', nw: 1 },
    { n: 'Reach out 5', room: 'pipe', c: '--green', d: [U, N, N, N, N, O, O], lab: ['2/5'], st: '<b>21</b> sent' },
    { n: 'Raise touch', room: 'spaces', sub: 'one cheque closer', c: '--gold', d: [U, N, N, N, N, O, O], lab: ['GO'], st: '<b>$170K</b> to go', nw: 1 },
    { n: 'Inbox zero', room: 'msg', c: '--violet', d: [U, N, N, N, N, N, O], lab: ['5'], st: '<b>4</b> days' },
    { n: 'Clear commitments', room: 'war', sub: 'after calls', c: '--orange', d: [U, N, N, N, N, O, O], lab: ['3'], st: '<b>3</b> open', nw: 1 },
    { n: 'Check 4ormIQ', room: 'iq', sub: 'launch prep → users', c: '--lime', d: [U, N, N, N, N, O, O], lab: ['7d'], st: '<b>0</b> / 1,000', nw: 1 },
    { n: 'News sweep', room: 'news', c: '--teal', d: [U, N, N, N, N, O, O], lab: ['GO'], st: '<b>9</b> days' },
    { n: 'Shutdown + snapshot', room: 'done', sub: '5 min', c: '--slate', d: [U, N, N, N, N, O, O], lab: ['6pm'], st: '<b>4</b> days', nw: 1 },
    { s: 'Weekly' },
    { n: 'Schedule clips', room: 'studio', sub: 'Mon', c: '--pink', d: [U, O, O, O, O, O, O], lab: ['GO'], st: 'weekly' },
    { n: 'Chase cold', room: 'contacts', sub: 'Tue', c: '--amber', d: [O, N, O, O, O, O, O], lab: ['GO'], st: 'weekly' },
    { n: 'Speer sync', room: 'team', sub: 'Wed', c: '--teal', d: [O, O, N, O, O, O, O], lab: ['GO'], st: 'weekly', nw: 1 },
    { n: 'Metrics snapshot', room: 'dash', sub: 'Thu', c: '--sky', d: [O, O, O, N, O, O, O], lab: ['GO'], st: 'weekly', nw: 1 },
    { n: 'Weekly review', room: 'dash', sub: 'Fri', c: '--white', d: [O, O, O, O, N, O, O], lab: ['GO'], st: 'weekly' }
  ];
  var ZOOM_M = [
    { wk: 'This week', m: 'OCT', d: 10, t: 'Pitch-deck edits and the suitability thesis', p: [], solo: 1, s: 'Note to self: tighten slides 6-9 around suitability; move the RPAA timeline earlier.', src: 'Granola' },
    { wk: 'This week', m: 'OCT', d: 9, t: 'Investor feedback - Jeff Tindale walks the deck', p: ['Jeff Tindale', 'Bruce Fair'], owe: 3, s: 'Veteran of ~1,000 pitch calls. 34 slides is far too heavy - condense "Why now", move the ask up.', src: 'Zoom', on: 1 },
    { wk: 'This week', m: 'OCT', d: 8, t: 'Speer Technologies review - direction, MSA, AI specialist', p: ['Keegan Poulton', 'Mathew Mozaffari', 'Zed'], owe: 2, s: 'Keegan backed the pivot; wants a named design partner before build starts.', src: 'Zoom' },
    { wk: 'This week', m: 'OCT', d: 7, t: 'Consumer / institutional / partnership life cycles with Zed', p: ['Zed'], owe: 1, s: 'Chasing introductions to UBC, Vancity and WorkSafeBC legal; user stories to visuals is slow.', src: 'Zoom' },
    { wk: 'This week', m: 'OCT', d: 6, t: 'Don Hickling weekly catch-up - framing market and crypto macro', p: ['Don Hickling'], owe: 1, s: 'Framing slowed, lots of spec inventory; open to a second cheque once F&F closes.', src: 'Zoom' },
    { wk: 'This week', m: 'OCT', d: 6, t: 'File-based orchestration and Spear design spec with Zed', p: ['Zed'], s: 'Pull logic out of the agent into folders/files; each stage output feeds the next.', src: 'Granola' },
    { wk: 'Last week', m: 'OCT', d: 5, t: 'Internal working session - deck, marketing, architecture, IP', p: ['Bruce Fair', 'Kevin Wong', 'Zed'], owe: 4, s: 'Bruce: simplify like the US reference decks; Kevin wants the GTM deck before Tuesday.', src: 'Zoom' },
    { wk: 'Last week', m: 'OCT', d: 1, t: 'Dean Hesse - wallet setup and investor-intro offer', p: ['Dean Hesse'], owe: 1, s: 'Offered intro to "Neil", ex-advisor who knows investors looking to park money.', src: 'Zoom' },
    { wk: 'Sep 28 - Oct 4', m: 'SEP', d: 30, t: 'Dean Hesse beta-tests FormIQ on the Newton exchange', p: ['Dean Hesse'], s: 'Flagged a withdrawal-refusal pattern but noted it is an allegation, not a finding.', src: 'Zoom' },
    { wk: 'Sep 28 - Oct 4', m: 'SEP', d: 29, t: 'Carmen - FormIQ demo feedback and a referral idea', p: ['Carmen R'], owe: 1, s: '"Basically a credit check on the company you are dealing with." Has a BD referral.', src: 'Zoom' },
    { wk: 'Sep 28 - Oct 4', m: 'SEP', d: 28, t: 'Deck rework and investor-outreach planning with Bruce and Kevin', p: ['Bruce Fair', 'Kevin Wong'], owe: 2, s: 'Align page one with the prior deck; "major financial decisions" lands best.', src: 'Zoom' }
  ];
  var ZC = ['#2E6BF2', '#0E8A5F', '#C9962B', '#6B4FD8', '#D6334E', '#0f9fb5', '#e2702b'];
  function ini(n) { return String(n || '').split(' ').map(function (x) { return x[0] || ''; }).join('').slice(0, 2).toUpperCase(); }
  function zcol(n) { return ZC[String(n || '').split('').reduce(function (a, c) { return a + c.charCodeAt(0); }, 0) % ZC.length]; }
  function isChad(name) { return /^chad(\s|$)/i.test(String(name || '').trim()); }

  function playbookData() {
    if (fixtureOn()) {
      return F().playbook || { rows: PB_ROWS, weekLabel: 'WEEK 43 · OCT 19 - 25', dates: [19, 20, 21, 22, 23, 24, 25], todayIdx: 0, pct: '0%' };
    }
    return livePlaybookState();
  }
  function roomOf(route) {
    var r = String(route || '');
    if (/war/.test(r)) return 'war';
    if (/studio|clip|video/.test(r)) return 'studio';
    if (/link|li|linkedin/.test(r)) return 'li';
    if (/pipe/.test(r)) return 'pipe';
    if (/space/.test(r)) return 'spaces';
    if (/mail|msg|inbox/.test(r)) return 'msg';
    if (/news/.test(r)) return 'news';
    if (/iq|4ormiq/.test(r)) return 'iq';
    if (/done|complete|snap/.test(r)) return 'done';
    if (/contact|people/.test(r)) return 'contacts';
    if (/team/.test(r)) return 'team';
    return 'dash';
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
    if (s === M) return '×';
    if (s === D) return i === todayIdx ? '✓' : ((pad && pad.value) || '');
    if (s === U) {
      if (r.target === '5' && /reach/i.test(r.n)) return ((pad && pad.value) || '2') + '/5';
      if (/engage/i.test(r.n)) return (pad && pad.value) || '0/5';
      if (/inbox/i.test(r.n)) return (pad && pad.value) || '5';
      if (/4ormiq/i.test(r.n)) return (pad && pad.value) || '7d';
      if (/clear/i.test(r.n)) return (pad && pad.value) || '3';
      return (pad && pad.value) || 'GO';
    }
    if (s === N) return r.target === '6pm' ? '6pm' : ((pad && pad.value) || '');
    return '';
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
  function livePlaybookState() {
    var pb = (window.STATE || {}).playbook || {};
    var days = asList(pb.days);
    var today = String(pb.today || '');
    var todayIdx = days.indexOf(today);
    if (todayIdx < 0) todayIdx = 0;
    var dates = days.map(function (d) {
      var m = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
      return m ? Number(m[3]) : Number(String(d).slice(8));
    });
    while (dates.length < 7) dates.push(dates.length ? dates[dates.length - 1] + 1 : 19);
    if (!days.length) {
      days = dates.map(function (n, i) { return '2026-10-' + String(n).padStart(2, '0'); });
    }
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
        st: r.st || (r.grp === 'Weekly' ? 'weekly' : ''), sub: r.sub, nw: r.nw, target: r.target || '', grp: r.grp
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
    var srcRows = data.rows && data.rows.length ? data.rows : (data.live ? [] : PB_ROWS);
    var rows = srcRows.map(function (r) { return r.s ? r : Object.assign({}, r, { d: (r.d || []).slice(), lab: (r.lab || []).slice() }); });
    var dates = data.dates || [19, 20, 21, 22, 23, 24, 25];
    var todayIdx = data.todayIdx == null ? 0 : data.todayIdx;
    var document = root;
    function gid(id) { return root.getElementById(id); }
    var wk = wrap.querySelector('.wk');
    if (wk && data.weekLabel) wk.textContent = data.weekLabel;
    var pct = gid('pct');
    if (pct && data.pct) pct.textContent = data.pct;
    function colOf(r) { return r.c === '--white' ? '#ffffff' : 'var(' + r.c + ')'; }
    var g = gid('g');
    function render() {
      var h = '<div></div>';
      ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].forEach(function (x, i) {
        h += '<div class="dh' + (i === todayIdx ? ' today" id="fri' : '"') + '">' + x + '<small>' + dates[i] + '</small></div>';
      });
      h += '<div class="dh" style="text-align:right">STREAK</div>';
      rows.forEach(function (r, ri) {
        if (r.s) { h += '<div class="sect">' + r.s.toUpperCase() + '</div>'; return; }
        var col = colOf(r), rm = ROOMS[r.room] || ROOMS.dash;
        h += '<div class="track"><span class="swatch" style="background:' + col + '"></span><div><div class="t">' + r.n + (r.nw ? '<span class="new">NEW</span>' : '') + '</div><div class="r"><a href="' + rm[1] + '">' + rm[0] + ' &rarr;</a>' + (r.sub ? ' &middot; ' + r.sub : '') + '</div></div></div>';
        r.d.forEach(function (s, i) {
          var l = (r.lab && r.lab[i]) || '';
          if (s === D) h += '<div class="pad done" style="--c:' + col + ';color:#fff" data-r="' + ri + '" data-i="' + i + '">' + l + '</div>';
          else if (s === M) h += '<div class="pad miss">&times;</div>';
          else if (s === U) h += '<div class="pad due" style="--c:' + col + ';color:#0b0d12" data-r="' + ri + '" data-i="' + i + '">' + l + '</div>';
          else if (s === N) h += '<div class="pad next" style="--c:' + col + '" data-r="' + ri + '" data-i="' + i + '">' + l + '</div>';
          else h += '<div class="pad off"></div>';
        });
        h += '<div class="streak">' + (r.st || '') + '</div>';
      });
      h += '<div class="add">+ Add a rhythm</div>';
      if (g) { g.innerHTML = h; place(); count(); }
    }
    function place() {
      var f = gid('fri'); if (!f) return;
      var ph = gid('ph'); if (!ph || !g) return;
      ph.style.left = (g.offsetLeft + f.offsetLeft - 4) + 'px';
      ph.style.width = (f.offsetWidth + 8) + 'px';
    }
    function count() {
      var left = 0;
      rows.forEach(function (r) { if (r.d && r.d[todayIdx] === U) left++; });
      var run = gid('runTxt');
      if (!run) return;
      if (data.live) run.textContent = left ? (left + ' lights left today') : 'All lights off — day done';
      else run.textContent = left ? ("Run today's plays · " + left + ' lit') : 'All lights off — day done';
    }
    window.addEventListener('resize', place);
    var pop = gid('pop'); var cur = null;
    if (g) g.addEventListener('click', function (e) {
      var p = e.target.closest('.pad');
      if (!p || !p.dataset.r) { pop.classList.remove('show'); return; }
      var r = rows[+p.dataset.r], i = +p.dataset.i, rm = ROOMS[r.room] || ROOMS.dash, st = r.d[i];
      cur = { r: r, i: i, el: p };
      var col = colOf(r);
      gid('popSw').style.background = col;
      gid('popT').textContent = r.n;
      gid('popS').textContent = rm[0] + ' · ' + (st === D ? 'done — light is off' : st === N ? 'later today' : 'due now');
      var go = gid('popGo'); go.textContent = 'Go to ' + rm[0] + ' →'; go.style.background = col;
      gid('popDone').innerHTML = st === D ? '↺ Turn back on' : '✓ Mark done';
      var b = p.getBoundingClientRect();
      pop.style.left = Math.min(b.left, window.innerWidth - 260) + 'px';
      pop.style.top = (b.bottom + 8) + 'px';
      pop.classList.add('show');
      e.stopPropagation();
    });
    root.addEventListener('click', function (e) { if (!pop.contains(e.target) && !e.target.closest('.pad')) pop.classList.remove('show'); });
    function toast(t) { var x = gid('toast'); x.textContent = t; x.classList.add('show'); setTimeout(function () { x.classList.remove('show'); }, 1800); }
    if (gid('popGo')) gid('popGo').onclick = function () { var rm = ROOMS[cur.r.room] || ROOMS.dash; toast('Opening ' + rm[0] + '…  (' + rm[1] + ')'); pop.classList.remove('show'); if (rm[1]) location.href = rm[1]; };
    if (gid('popDone')) gid('popDone').onclick = function () {
      cur.r.d[cur.i] = cur.r.d[cur.i] === D ? U : D; pop.classList.remove('show'); render();
      var el = g.querySelector('.pad[data-r="' + rows.indexOf(cur.r) + '"][data-i="' + cur.i + '"]');
      if (el) el.classList.add('just');
      toast(cur.r.d[cur.i] === D ? '✓ Light off — ' + cur.r.n + ' done' : cur.r.n + ' turned back on');
    };
    if (gid('popLater')) gid('popLater').onclick = function () { pop.classList.remove('show'); toast(cur.r.n + ' snoozed 2 hours'); };
    render();
    mountMonths(root, rows);
    if (fixtureOn()) mountVoiceDemo(root, rows, render, count, toast);
    else mountVoiceLive(root, rows, render, count, toast);
  }

  function mountMonths(root, rows) {
    var daily = rows.filter(function (r) { return r.d && rows.indexOf(r) < rows.findIndex(function (x) { return x.s === 'Weekly'; }); });
    var months = [
      { name: 'October 2026', days: 31, start: 3, stat: '81% on beat', ms: { 20: ['Mktg drop', 'var(--green)'], 23: ['4ormIQ live', 'var(--lime)'], 30: ['F&F close', 'var(--gold)'], 31: ['Newsletter', 'var(--blue)'] } },
      { name: 'November 2026', days: 30, start: 6, stat: 'upcoming', ms: { 3: ['Mktg drop', 'var(--green)'], 17: ['Mktg drop', 'var(--green)'], 30: ['Newsletter', 'var(--blue)'] } },
      { name: 'December 2026', days: 31, start: 1, stat: 'upcoming', ms: { 1: ['Mktg drop', 'var(--green)'], 15: ['Mktg drop', 'var(--green)'], 31: ['Q4 letter', 'var(--amber)'] } }
    ];
    function colOf(r) { return r.c === '--white' ? '#ffffff' : 'var(' + r.c + ')'; }
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
        H += m ? '<div class="ms" style="background:' + m[1] + '" title="' + m[0] + '">' + m[0] + '</div>' : '<div></div>';
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
    var openCal = root.getElementById('openCal');
    var closeCal = root.getElementById('closeCal');
    var ov = root.getElementById('ov');
    if (openCal) openCal.onclick = function () { ov.classList.add('open'); };
    if (closeCal) closeCal.onclick = function () { ov.classList.remove('open'); };
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
        { c: 'var(--green)', t: 'Reach out 5', k: '3 / 5', cls: 'g', r: 4, v: '3/5' },
        { c: 'var(--sky)', t: 'Engage 10 min', k: '4 / 5', cls: 'g', r: 3, v: '4/5' },
        { c: 'var(--blue)', t: 'Send Kevin the GTM deck', k: '+ Execution · Tue', cls: 'b' },
        { c: 'var(--amber)', t: 'Newsletter: RPAA deadline angle', k: 'note → Newsletter', cls: 'a' }
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
      var now = new Date(), h = now.getHours(), m = String(now.getMinutes()).padStart(2, '0');
      root.getElementById('vHist').insertAdjacentHTML('afterbegin', '<div class="vrow"><span class="pl">&#9654;</span><span class="tm">' + ((h % 12) || 12) + ':' + m + ' ' + (h < 12 ? 'am' : 'pm') + '</span><span>&ldquo;' + tx.textContent.slice(0, 90) + '&hellip;&rdquo;</span><span class="c">' + plays + ' plays &middot; ' + tasks + ' task &middot; ' + notes + ' note</span></div>');
      toast("Saved to today’s log - " + plays + ' plays updated'); ds.onclick();
    };
  }

  function mountVoiceLive(root, rows, render, count, toast) {
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
      heard.querySelectorAll('input').forEach(function (cb) {
        if (!cb.checked) return; var x = it[+cb.dataset.i];
        if (x && x.r != null && rows[x.r]) { rows[x.r].d[0] = 'done'; plays++; }
        else if (x && x.cls === 'b') tasks++; else notes++;
      });
      render(); count();
      var dest = (root.querySelector('.dest em.on') || {}).textContent || "Today’s log";
      auth('/api/voice/logs', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transcript: tx.textContent, items: it, destination: dest, duration_s: Math.floor((Date.now() - t0) / 1000) }) }).catch(function () {});
      var now = new Date(), h = now.getHours(), m = String(now.getMinutes()).padStart(2, '0');
      root.getElementById('vHist').insertAdjacentHTML('afterbegin', '<div class="vrow"><span class="pl">&#9654;</span><span class="tm">' + ((h % 12) || 12) + ':' + m + ' ' + (h < 12 ? 'am' : 'pm') + '</span><span>&ldquo;' + esc(tx.textContent.slice(0, 90)) + '&hellip;&rdquo;</span><span class="c">' + plays + ' plays &middot; ' + tasks + ' task &middot; ' + notes + ' note</span></div>');
      toast("Saved to today’s log - " + plays + ' plays updated'); ds.onclick();
    };
  }

  function paintPlaybookLive() {
    var wrap = wrapOf('playDesk');
    if (!wrap) { markReady('playDesk'); return; }
    var data = playbookData();
    loadSnip('/pbwrap-snippet.html', function (html) {
      try {
        wrap.innerHTML = html || '<div class="pbwrap"></div>';
        var root = wrap.getRootNode();
        mountPlaybook(root, wrap, data);
        liveLog('playbook', { rows: (data.rows || []).length, todayIdx: data.todayIdx });
      } catch (err) {
        console.warn('playbook paint', err);
      }
      markReady('playDesk');
    });
  }

  function hourToMs(day, hour) {
    var p = String(day).split('-').map(Number);
    var hh = Math.floor(hour);
    var mm = Math.round((hour - hh) * 60);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1, hh, mm).getTime();
  }
  function emailsOf(ppl) {
    return asList(ppl).map(function (x) { return String(x || '').trim(); }).filter(function (e) { return /@/.test(e); }).slice(0, 8);
  }
  function calWrite(payload) {
    if (fixtureOn() || !payload || !payload.event) return Promise.resolve();
    var ev = payload.event;
    var start = hourToMs(ev.d, ev.s);
    var dur = Math.max(15, Math.round((Number(ev.e) - Number(ev.s)) * 60));
    var title = String(ev.t || 'New event');
    var attendees = emailsOf(ev.ppl);
    var loc = asList(ev.loc).join(', ');
    if (payload.type === 'create') {
      return auth('/api/calendar', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: title, start: start, dur: dur, attendees: attendees }) })
        .then(function (r) { return r.json(); }).then(function (d) { if (d && d.id) ev.id = d.id; console.info('[live-map] /api/calendar POST', d); return d; }).catch(function () {});
    }
    if (payload.type === 'patch' && ev.id) {
      return auth('/api/calendar', { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: ev.id, start: start, dur: dur, title: title, attendees: attendees, location: loc, description: ev.notes || '' }) })
        .then(function (r) { return r.json(); }).then(function (d) { console.info('[live-map] /api/calendar PATCH', d); return d; }).catch(function () {});
    }
    if (payload.type === 'delete' && ev.id) {
      return auth('/api/calendar', { method: 'DELETE', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: ev.id }) })
        .then(function (r) { return r.json(); }).then(function (d) { console.info('[live-map] /api/calendar DELETE', d); return d; }).catch(function () {});
    }
    return Promise.resolve();
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
  function mapCalEvents(events) {
    return asList(events).map(function (e) {
      var start = Number(e.start);
      var d = new Date(start);
      var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
      function g(t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value; return ''; }
      var ymd = g('year') + '-' + g('month') + '-' + g('day');
      var s = Number(g('hour')) + Number(g('minute')) / 60;
      var durH = (Number(e.dur) || 60) / 60;
      var all = durH >= 20;
      return { id: e.id, d: ymd, s: s, e: s + durH, t: e.title || e.t, c: /invest|cheque|raise/i.test(String(e.title || '')) ? 'inv' : 'meet', all: all ? 1 : 0 };
    });
  }

  function paintCalendarLive() {
    var wrap = wrapOf('calDesk');
    if (!wrap) { markReady('calDesk'); return; }
    loadSnip('/calwrap-snippet.html', function (html) {
      wrap.innerHTML = html || '<div class="calwrap"></div>';
      var root = wrap.getRootNode();
      var live = !fixtureOn();
      function go(events) {
        try {
          if (typeof window.mountRedesignCalendar === 'function') {
            window.mountRedesignCalendar(root, {
              fixture: !live,
              live: live,
              today: live ? new Date() : new Date(2026, 9, 19),
              events: live ? events : null,
              write: calWrite,
              undo: calUndo
            });
          }
          liveLog('calendar', { events: (events || []).length, live: live });
        } catch (err) {
          console.warn('calendar paint', err);
        }
        markReady('calDesk');
      }
      if (!live) { go(null); return; }
      var from = new Date(2026, 8, 1).toISOString();
      var to = new Date(2027, 0, 31).toISOString();
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
    if (fixtureOn()) return { meetings: (F().zoom && F().zoom.meetings) || ZOOM_M, meta: '43 meetings · synced 2 min ago' };
    return liveZoomState();
  }
  function weekOf(iso) {
    var d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    if (!Number.isFinite(d.getTime())) return 'Earlier';
    var today = new Date(2026, 9, 19);
    var startThis = new Date(today); startThis.setDate(today.getDate() - today.getDay());
    var startLast = new Date(startThis); startLast.setDate(startThis.getDate() - 7);
    if (d >= startThis) return 'This week';
    if (d >= startLast) return 'Last week';
    return 'Sep 28 - Oct 4';
  }
  function ymdOf(raw) {
    var s = String(raw || '');
    var m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
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
    var notes = asList((window.STATE || {}).zoomNotes);
    var actions = asList((window.STATE || {}).meetingActions).filter(function (a) {
      return a.status !== 'done' && a.status !== 'tasked';
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
        return [a.kind === 'follow_up' ? 'fu' : 'you', a.text];
      });
      var quotes = asList(n.quotes).map(function (q) {
        var who = Array.isArray(q) ? q[0] : (q.who || '');
        var text = Array.isArray(q) ? q[1] : (q.text || q);
        return [who, stripLead(text, [who].concat(people))];
      });
      return {
        id: id, noteId: n.noteId, wk: weekOf(ymd || n.date), m: mon, d: Number(dt[2] || 0), t: n.title, p: people,
        solo: n.solo || !people.length ? 1 : 0, owe: owe, s: stripLead(quote, people),
        src: /granola/i.test(String(n.origin || '') + JSON.stringify(n.sources || [])) ? 'Granola' : 'Zoom',
        improve: n.improve, aiSummary: n.aiSummary, quotes: quotes, decided: n.decided, said: n.said, roles: n.roles,
        actions: oweRows.length ? oweRows : n.actions
      };
    });
    return { meetings: meetings, meta: notes.length + ' meetings' };
  }

  var ZREADER = {
    1: { when: 'Thu, Oct 9, 2026 · 10:00 - 10:52 am · 52 min', roles: { 'Jeff Tindale': 'angel, ex-founder', 'Bruce Fair': 'advisor' },
      said: { 'Jeff Tindale': ['34 slides is far too heavy. Condense "Why now" to one slide and move the ask to slide 3.', 'Built a software company in Brazil replacing the broker/notary arrangement with blockchain deeds - not deep in fintech himself.', 'Would look again after the F&F close; wants to see one paying design partner.'], 'Bruce Fair': ['Agrees on length; keep the suitability thesis but lead with the person and the decision.', 'Offered to dry-run the new version Friday.'] },
      summary: 'Jeff liked the thesis but lost the thread in a 34-slide deck. The fix is length and order, not substance: 15 slides, the ask on slide 3, one "Why now" slide tied to the RPAA review. He will look again after the F&F close if there is one paying design partner.',
      improve: ['You spent 9 minutes on architecture before the ask came up. Lead with the person, the decision and the ask; keep architecture for questions.', 'When Jeff pushed on traction you answered with the regulation. Answer with the pilot (Century 21 / Remax desks) first, then the rule.', 'You did not ask for a next step. Close with a dated one: "Can I send the 15-slide version Monday and get 20 minutes Thursday?"'],
      owe: [['you', 'Send Jeff the 15-slide version by Monday'], ['you', 'Book the Friday dry-run with Bruce'], ['fu', 'Ask Jeff for two angel intros once the deck is tight']],
      quotes: [['Jeff', "Nobody reads slide 20. If the ask isn't on three, it doesn't exist."], ['Bruce', 'Lead with the person and the decision, the regulation is the proof.']],
      decided: ['Cut the deck to 15 slides; ask moves to slide 3.', '"Why now" becomes one slide on the RPAA review timeline.'] }
  };

  function paintZoomLive() {
    var wrap = wrapOf('zoomDesk');
    if (!wrap) { markReady('zoomDesk'); return; }
    var data = zoomData();
    var meetings = data.meetings || [];
    loadSnip('/zwrap-snippet.html', function (html) {
      wrap.innerHTML = html || '<div class="zwrap"></div>';
      var root = wrap.getRootNode();
      var meta = wrap.querySelector('.ztop .meta');
      if (meta) meta.textContent = data.meta || (meetings.length + ' meetings');
      var box = root.getElementById('boxes');
      var h = '', w = '';
      meetings.forEach(function (x, i) {
        if (x.wk !== w) { if (w) h += '</div>'; w = x.wk; h += '<div class="wkh">' + esc(w) + '</div><div class="gridm">'; }
        var people = asList(x.p).filter(function (p) { return !isChad(p); });
        var who = people.length ? people.slice(0, 2).join(', ') + (people.length > 2 ? ' +' + (people.length - 2) : '') : 'Just you';
        var leadName = people[0] ? people[0].split(' ')[0] : '';
        h += '<div class="mc" data-i="' + i + '"><div class="d">' + esc(x.m) + ' ' + x.d + ', 2026<span class="src">' + esc(x.src) + '</span></div><div class="t">' + esc(x.t) + '</div>'
          + '<div class="pp2">' + (people.map(function (n) { return '<span class="av" style="background:' + zcol(n) + '">' + esc(ini(n)) + '</span>'; }).join('') || '<span class="av" style="background:#8a96ad;margin:0">CJ</span>') + '<span class="n">' + esc(who) + '</span></div>'
          + '<div class="sn' + (x.solo ? ' self' : '') + '">' + (x.solo ? '<b style="color:#46556E">Note to self:</b> ' : (leadName ? '<b>' + esc(leadName) + ':</b> ' : '')) + esc(stripLead(x.s, x.p)) + '</div>'
          + '<div class="ft">' + (x.solo ? '<span class="tag solo">Solo</span>' : x.owe ? '<span class="tag owe">You owe ' + x.owe + '</span>' : '<span class="tag solo">Nothing owed</span>') + '<span class="op">Open &rarr;</span><span class="ib" title="Edit">&#9998;</span><span class="ib" title="Delete">&#128465;</span></div></div>';
      });
      if (box) box.innerHTML = h + (w ? '</div>' : '');
      var dr = root.getElementById('drawer'), sc = root.getElementById('scrim');
      function show(v) { dr.classList.toggle('open', v); sc.classList.toggle('open', v); }
      function toast(t) { var x = root.getElementById('toast'); x.textContent = t; x.classList.add('show'); setTimeout(function () { x.classList.remove('show'); }, 1600); }
      function genR(x) {
        var p = asList(x.p);
        var said = {};
        p.forEach(function (n, i2) { said[n] = i2 === 0 ? [x.s] : ['(Summary for ' + n.split(' ')[0] + ' appears here from the transcript.)']; });
        var owe = asList(x.actions);
        if (!owe.length) owe = Array.from({ length: x.owe || 0 }, function (_, i3) { return ['you', 'Commitment ' + (i3 + 1) + ' from this meeting']; });
        return { when: (x.m === 'OCT' ? 'Oct' : 'Sep') + ' ' + x.d + ', 2026 · ' + x.src, roles: x.roles || {}, said: x.said || (x.solo ? {} : said), summary: x.aiSummary || (x.solo ? String(x.s || '').replace(/^Note to self:\s*/i, '') : x.s), improve: asList(x.improve), owe: owe, quotes: asList(x.quotes), decided: asList(x.decided) };
      }
      function reader(i) {
        var x = meetings[i], r = (fixtureOn() && ZREADER[i]) ? ZREADER[i] : genR(x);
        function av(n) { return '<span class="av" style="background:' + zcol(n) + '">' + esc(ini(n)) + '</span>'; }
        var people = asList(x.p);
        return '<div class="rh" style="margin-top:-6px"><h2>' + esc(x.t) + '</h2><div class="ic"><span class="ib" title="Edit">&#9998;</span><span class="ib" title="Delete">&#128465;</span></div></div>'
          + '<div class="when">' + esc(r.when) + ' &middot; ' + esc(x.src) + ' notes' + (x.src === 'Zoom' ? ' + recording + transcript' : '') + '</div>'
          + '<div class="ppl">' + people.map(function (n) { return '<span class="pp">' + av(n) + esc(n) + (r.roles[n] ? ' <em>&middot; ' + esc(r.roles[n]) + '</em>' : '') + '</span>'; }).join('') + '<span class="pp"><span class="av" style="background:#8a96ad">CJ</span>You</span></div>'
          + '<div class="acts"><button class="btn sm pri">Open transcript</button>' + (x.src === 'Zoom' ? '<button class="btn sm">Play recording</button>' : '') + '<button class="btn sm">Draft follow-up email</button><button class="btn sm">Add to a Space</button>' + (people[0] ? '<button class="btn sm">Open ' + esc(people[0].split(' ')[0]) + ' in Contacts</button>' : '') + '</div>'
          + '<div class="ai"><div class="sh"><b>&#10022; 4orm Intelligence on this meeting</b><span>summary</span></div><p>' + esc(r.summary) + '</p><div class="ask"><input placeholder="Ask about this meeting"><button class="btn sm pri">Ask</button></div></div>'
          + '<div class="grid2"><div>'
          + (x.solo ? '' : '<div class="sec" style="margin-bottom:14px"><div class="sh"><b>What others said</b><span>intel first</span></div>' + Object.keys(r.said || {}).map(function (n) { return '<div class="said"><div class="who">' + av(n) + esc(n) + (r.roles[n] ? ' <em>' + esc(r.roles[n]) + '</em>' : '') + '</div><ul>' + asList(r.said[n]).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>'; }).join('') + '</div>')
          + (asList(r.improve).length ? '<div class="sec imp" style="margin-bottom:14px"><div class="sh"><b>Where you can improve</b><span>coaching</span></div>' + r.improve.map(function (t, k) { return '<div class="iv"><span>' + (k + 1) + '</span>' + esc(t) + '</div>'; }).join('') + '</div>' : '')
          + (asList(r.quotes).length ? '<div class="sec"><div class="sh"><b>Worth quoting</b><span>from the transcript</span></div>' + r.quotes.map(function (q) { return '<div class="q"><b>' + esc(q[0]) + ':</b> "' + esc(stripLead(q[1], [q[0]].concat(people))) + '"</div>'; }).join('') + '</div>' : '')
          + '</div><div>'
          + '<div class="sec" style="margin-bottom:14px"><div class="sh"><b>What you owe</b><span>' + asList(r.owe).length + ' open</span></div>' + (asList(r.owe).length ? r.owe.map(function (o) { return '<div class="owe"><span class="k ' + esc(o[0]) + '">' + (o[0] === 'you' ? 'You said' : 'Follow up') + '</span><span class="t">' + esc(o[1]) + '</span><span class="ad"><button>+ Today</button><button>+ Week</button></span></div>'; }).join('') : '<div class="emp">Nothing owed from this meeting.</div>') + '</div>'
          + '<div class="sec" style="margin-bottom:14px"><div class="sh"><b>Decided</b><span>' + asList(r.decided).length + '</span></div>' + (asList(r.decided).length ? r.decided.map(function (d) { return '<div class="dec"><i>&#10003;</i>' + esc(d) + '</div>'; }).join('') : '<div class="emp">No decisions captured.</div>') + '</div>'
          + '<div class="sec"><div class="sh"><b>Full notes</b><span>as captured</span></div><div class="raw">' + esc(x.s) + '</div></div>'
          + '</div></div><div class="zfoot">Summarised by 4orm Intelligence from the ' + esc(x.src) + ' ' + (x.src === 'Zoom' ? 'transcript' : 'notes') + ' &middot; check the transcript before quoting anyone.</div>';
      }
      function openM(i) {
        root.getElementById('rd').innerHTML = reader(i);
        root.querySelectorAll('.owe .ad button').forEach(function (b) { b.onclick = function () { b.closest('.owe').classList.add('added'); toast('Task added to War Room Execution'); }; });
        show(true);
      }
      if (box) box.onclick = function (e) {
        if (e.target.closest('.ib')) { toast(e.target.closest('.ib').title + ' meeting'); return; }
        var c = e.target.closest('.mc'); if (c) openM(+c.dataset.i);
      };
      if (sc) sc.onclick = function () { show(false); };
      var close = root.getElementById('close'); if (close) close.onclick = function () { show(false); };
      window.addEventListener('keydown', function (e) { if (e.key === 'Escape') show(false); });
      (function () {
        var g = root.getElementById('grab'); var on = false;
        if (!g) return;
        g.onmousedown = function () { on = true; document.body.style.userSelect = 'none'; };
        window.addEventListener('mousemove', function (e) { if (on) dr.style.width = Math.min(Math.max(window.innerWidth - e.clientX, 480), window.innerWidth * 0.95) + 'px'; });
        window.addEventListener('mouseup', function () { on = false; document.body.style.userSelect = ''; });
      })();
      liveLog('zoom', { meetings: meetings.length });
      markReady('zoomDesk');
    });
  }

  function paintCompletedLive() {
    var wrap = wrapOf('doneDesk');
    if (!wrap) { markReady('doneDesk'); return; }
    if (fixtureOn()) {
      loadSnip('/done-snippet.html', function (html) {
        wrap.innerHTML = html;
        wrap.querySelectorAll('.day').forEach(function (d) {
          d.onclick = function () { wrap.querySelectorAll('.day').forEach(function (x) { x.classList.remove('on'); }); d.classList.add('on'); };
        });
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
    var list = snaps.length ? snaps.map(function (s) {
      var parts = (s.date || '').split('-');
      var day = Number(parts[2] || 0);
      var dow = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date((s.date || '') + 'T12:00:00').getDay()] || '';
      var on = s.date === openDate;
      var chips = chipsOf(s);
      return '<div class="day' + (on ? ' on' : '') + '" data-date="' + esc(s.date) + '"><div class="dt"><b>' + day + '</b><small>' + dow + '</small></div><div style="min-width:0"><div class="sm">' + esc(s.summary || (s.payload && s.payload.headline) || 'Day saved') + '</div><div class="ct">' + chips.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div></div></div>';
    }).join('') : '<div class="today"><span class="pulse"></span>No snapshots yet</div>';
    var cur = snaps.filter(function (s) { return s.date === openDate; })[0] || snaps[0] || {};
    var det = cur.payload || {};
    var counts = cur.counts || det.counts || {};
    var headline = det.headline || cur.summary || 'Nothing captured yet.';
    var titleDate = cur.date ? new Date(cur.date + 'T12:00:00') : null;
    var title = titleDate && Number.isFinite(titleDate.getTime())
      ? titleDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
      : (cur.date || 'Today');
    function lines(arr, tag) {
      return asList(arr).map(function (row) {
        var t = typeof row === 'string' ? row : (row.title || row.text || '');
        var extra = typeof row === 'string' ? '' : (row.extra || row.to || row.from || '');
        return '<div class="li">' + (tag ? '<span class="tag t1">' + esc(tag) + '</span>' : '<i>&#10003;</i>') + '<span>' + esc(t) + '</span>' + (extra ? '<em>' + esc(extra) + '</em>' : '') + '</div>';
      }).join('');
    }
    wrap.innerHTML = '<div class="bar"><h1>Completed</h1><span class="sub">A snapshot of every day, saved at 11:55 pm — what moved, who you met, what you owe</span><div class="r"><button class="btn" type="button">Search days</button><button class="btn pri" type="button" id="snapNowLive">Snapshot now</button></div></div>'
      + '<div class="lay"><section class="card"><div class="today"><span class="pulse"></span>Today is being recorded — snapshot at 11:55 pm</div>' + list + '</section>'
      + '<section class="card det"><div class="dh"><div><h2>' + esc(title) + '</h2><div class="meta">Snapshot saved · read-only</div></div><div class="r2"><button class="btn" type="button">Export PDF</button><button class="btn" type="button">Add to investor update</button></div></div>'
      + '<div class="moved"><b>&#10022; What moved today</b><p>' + esc(headline) + '</p></div>'
      + '<div class="tiles">'
      + '<div class="tl"><b>' + (counts.tasks || 0) + '</b><span>tasks done</span></div>'
      + '<div class="tl"><b>' + (counts.meetings || 0) + '</b><span>meeting</span></div>'
      + '<div class="tl"><b>' + (counts.sent || 0) + '</b><span>emails sent</span></div>'
      + '<div class="tl' + (counts.replies ? ' g' : '') + '"><b>' + (counts.replies || 0) + '</b><span>reply in</span></div>'
      + '<div class="tl"><b>' + (counts.pipeline || 0) + '</b><span>pipeline moves</span></div>'
      + '<div class="tl"><b>$0</b><span>raised today</span></div>'
      + '</div>'
      + '<div class="cols">'
      + '<div class="sec"><div class="sh"><b>Done</b><span>' + asList(det.tasks).length + ' tasks</span></div>' + (lines(det.tasks) || '<div class="emp">No tasks captured.</div>') + '</div>'
      + '<div class="sec"><div class="sh"><b>Meetings &amp; commitments</b><span>' + asList(det.meetings).length + ' meeting</span></div>' + (lines(det.meetings, 'Zoom') + lines(det.commitments, 'You said') || '<div class="emp">Nothing captured yet.</div>') + '</div>'
      + '<div class="sec"><div class="sh"><b>Email</b><span>' + (counts.replies || 0) + ' in &middot; ' + (counts.sent || 0) + ' out</span></div>' + (lines(det.replies, 'In') + lines(det.sent, 'Out') || '<div class="emp">No mail captured.</div>') + '</div>'
      + '<div class="sec"><div class="sh"><b>News saved</b><span>' + asList(det.news).length + '</span></div>' + (lines(det.news, 'News') || '<div class="emp">No news saved.</div>') + '</div>'
      + '</div></section></div>';
    wrap.querySelectorAll('.day').forEach(function (d) {
      d.onclick = function () {
        var date = d.getAttribute('data-date');
        if (window.STATE) window.STATE.snapOpenDate = date;
        auth('/api/snapshots?date=' + encodeURIComponent(date), { credentials: 'include', quiet: true }).then(function (r) { return r.json(); }).then(function (one) {
          if (window.STATE) {
            window.STATE.snapOpen = one;
            window.STATE.snaps = asList(window.STATE.snaps).map(function (s) {
              return ymdOf(s.date) === date ? Object.assign({}, s, { payload: one.payload || s.payload, summary: one.summary || s.summary, counts: (one.payload && one.payload.counts) || s.counts }) : s;
            });
          }
          paintCompletedLive();
        }).catch(function () { paintCompletedLive(); });
      };
    });
    var snapBtn = wrap.querySelector('#snapNowLive');
    if (snapBtn) snapBtn.onclick = function () { var b = document.getElementById('snapNow'); if (b) b.click(); };
    liveLog('completed', { snaps: snaps.length, open: openDate });
    markReady('doneDesk');
  }

  window.paintRedesignPlaybook = function () { whenCss(paintPlaybookLive); };
  window.paintRedesignCalendar = function () { whenCss(paintCalendarLive); };
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

  function loadLive(desk) {
    if (fixtureOn()) return;
    if (desk === 'playbook') {
      auth('/api/playbook', { credentials: 'include', quiet: true }).then(function (r) { return r.json(); }).then(function (d) {
        if (window.STATE) window.STATE.playbook = d;
        console.info('[live-map] /api/playbook', d && typeof d === 'object' ? Object.keys(d) : typeof d);
        paintPlaybookLive();
      }).catch(function () {});
    }
    if (desk === 'znotes' || desk === 'zoom') {
      Promise.all([
        auth('/api/zoom-notes', { credentials: 'include', quiet: true }).then(function (r) { return r.json(); }).catch(function () { return {}; }),
        auth('/api/meeting-actions', { credentials: 'include', quiet: true }).then(function (r) { return r.json(); }).catch(function () { return {}; })
      ]).then(function (pair) {
        var notes = pair[0];
        var acts = pair[1];
        if (window.STATE) {
          if (notes && asList(notes.notes).length) window.STATE.zoomNotes = notes.notes;
          window.STATE.meetingActions = (acts && acts.actions) || [];
        }
        console.info('[live-map] /api/zoom-notes', { count: asList((window.STATE || {}).zoomNotes).length });
        console.info('[live-map] /api/meeting-actions', { count: asList((window.STATE || {}).meetingActions).length });
        paintZoomLive();
      });
    }
    if (desk === 'done') {
      auth('/api/snapshots', { credentials: 'include', quiet: true }).then(function (r) { return r.json(); }).then(function (d) {
        if (window.STATE) window.STATE.snaps = (d && d.snapshots) || [];
        console.info('[live-map] /api/snapshots', { count: asList(window.STATE.snaps).length });
        paintCompletedLive();
      }).catch(function () {});
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
