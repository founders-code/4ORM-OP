(function () {
  var ROOMS = {
    war: ['War Room', 'war'],
    studio: ['Studio', 'war'],
    li: ['LinkedIn', 'mail'],
    pipe: ['Pipeline', 'contacts'],
    spaces: ['Spaces', 'work'],
    msg: ['Messages', 'mail'],
    news: ['News', 'news'],
    iq: ['4ormIQ', 'room'],
    done: ['Completed', 'done'],
    contacts: ['Contacts', 'people'],
    team: ['Team', 'mail'],
    dash: ['Dashboard', 'room']
  };
  var D = 'done', M = 'miss', O = 'off', U = 'due', N = 'next';
  var DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  var rows = [];
  var desk = { today: '', days: [], score: 0, weekLabel: '', monthLogs: [] };
  var cur = null;
  var bound = false;

  function $(id) { return document.getElementById(id); }
  function colOf(r) { return r.c === '--white' ? '#ffffff' : 'var(' + r.c + ')'; }
  function padClass(s) {
    if (s === 'done' || s === 'before') return D;
    if (s === 'miss' || s === 'missed') return M;
    if (s === 'due') return U;
    if (s === 'next' || s === 'snoozed' || s === 'scheduled') return N;
    return O;
  }
  function padLabel(r, pad, i, todayIdx) {
    var s = padClass(pad.state);
    if (s === M) return '×';
    if (s === D) return i === todayIdx ? '✓' : (pad.value || '');
    if (s === U) {
      if (r.target === '5' && /reach/i.test(r.n)) return (pad.value || '2') + '/5';
      if (/engage/i.test(r.n)) return pad.value || '0/5';
      if (/inbox/i.test(r.n)) return pad.value || '5';
      if (/4ormiq/i.test(r.n)) return pad.value || '7d';
      if (/clear/i.test(r.n)) return pad.value || '3';
      return pad.value || 'GO';
    }
    if (s === N) return r.target === '6pm' ? '6pm' : (pad.value || '');
    return '';
  }
  function streakHtml(r) {
    var pads = r.d || [];
    var n = 0;
    for (var i = pads.length - 1; i >= 0; i--) {
      if (pads[i] === D) n += 1;
      else if (pads[i] === O) continue;
      else break;
    }
    if (r.grp === 'Weekly') return 'weekly';
    if (/reach/i.test(r.n)) return '<b>' + (r.pads || []).reduce(function (a, p) { return a + (Number(p.value) || (p.state === 'done' ? 5 : 0)); }, 0) + '</b> sent';
    if (/4ormiq/i.test(r.n)) return '<b>0</b> / 1,000';
    if (/raise/i.test(r.n)) return '<b>$170K</b> to go';
    if (/clear/i.test(r.n)) return '<b>3</b> open';
    if (/video/i.test(r.n) || /clip/i.test(r.n) || /engage/i.test(r.n)) return '<b>' + n + '</b> / 5';
    return '<b>' + n + '</b> days';
  }
  function fromApi(d) {
    desk = d || desk;
    var today = desk.today || '';
    var apiRows = desk.rows || [];
    var out = [{ s: 'Daily' }];
    var weekly = false;
    apiRows.forEach(function (r) {
      if ((r.grp || 'Daily') === 'Weekly' && !weekly) { out.push({ s: 'Weekly' }); weekly = true; }
      out.push({
        id: r.id,
        n: r.name,
        room: r.route,
        sub: r.sub || '',
        c: r.color && r.color.indexOf('--') === 0 ? r.color : '--blue',
        d: (r.pads || []).map(function (p) { return padClass(p.state); }),
        pads: r.pads || [],
        lab: (r.pads || []).map(function (p, i) { return padLabel({ n: r.name, target: r.target }, p, i, (desk.days || []).indexOf(today)); }),
        st: '',
        nw: r.nw,
        grp: r.grp || 'Daily',
        target: r.target || '',
        created_at: r.created_at
      });
    });
    out.forEach(function (r) { if (r.n) r.st = streakHtml(r); });
    rows = out;
    return out;
  }
  function todayIdx() {
    var days = desk.days || [];
    var i = days.indexOf(desk.today);
    return i < 0 ? 0 : i;
  }
  function render() {
    var g = $('pb-g');
    if (!g) return;
    var idx = todayIdx();
    var days = desk.days || [];
    var h = '<div></div>';
    DAYS.forEach(function (x, i) {
      var num = days[i] ? Number(days[i].slice(8)) : '';
      h += '<div class="dh' + (i === idx ? ' today" id="pb-fri' : '') + '">' + x + '<small>' + num + '</small></div>';
    });
    h += '<div class="dh" style="text-align:right">STREAK</div>';
    rows.forEach(function (r, ri) {
      if (r.s) { h += '<div class="sect">' + r.s.toUpperCase() + '</div>'; return; }
      var col = colOf(r);
      var rm = ROOMS[r.room] || ['Room', 'room'];
      h += '<div class="track"><span class="swatch" style="background:' + col + '"></span><div><div class="t">' + r.n + (r.nw ? '<span class="new">NEW</span>' : '') + '</div><div class="r"><a href="#" data-pb-go="' + rm[1] + '">' + rm[0] + ' →</a>' + (r.sub ? ' · ' + r.sub : '') + '</div></div></div>';
      r.d.forEach(function (s, i) {
        var l = (r.lab && r.lab[i]) || '';
        var day = (r.pads && r.pads[i] && r.pads[i].day) || '';
        if (s === D) h += '<div class="pad done" style="--c:' + col + ';color:#fff" data-r="' + ri + '" data-i="' + i + '" data-day="' + day + '">' + (i === idx ? '✓' : l) + '</div>';
        else if (s === M) h += '<div class="pad miss">×</div>';
        else if (s === U) h += '<div class="pad due" style="--c:' + col + ';color:#0b0d12" data-r="' + ri + '" data-i="' + i + '" data-day="' + day + '">' + l + '</div>';
        else if (s === N) h += '<div class="pad next" style="--c:' + col + '" data-r="' + ri + '" data-i="' + i + '" data-day="' + day + '">' + l + '</div>';
        else h += '<div class="pad off"></div>';
      });
      h += '<div class="streak">' + r.st + '</div>';
    });
    h += '<div class="add" id="pb-add">+ Add a rhythm</div>';
    g.innerHTML = h;
    place();
    count();
    var pct = $('pb-pct');
    if (pct) pct.textContent = (desk.score || 0) + '%';
    var wk = document.querySelector('#v-playbook .wk');
    if (wk) wk.innerHTML = desk.weekLabel || wk.innerHTML;
    var iq = daysTo('2026-10-23');
    var beat = document.querySelector('#v-playbook .beat.goal .d');
    if (beat) beat.innerHTML = iq + '<small>d to launch</small>';
  }
  function daysTo(iso) {
    var a = Date.parse((desk.today || '') + 'T12:00:00Z');
    var b = Date.parse(iso + 'T12:00:00Z');
    if (!a || !b) return 0;
    return Math.max(0, Math.round((b - a) / 86400000));
  }
  function place() {
    var f = $('pb-fri');
    if (!f) return;
    var ph = $('pb-ph'), s = f.closest('.seq');
    if (!ph || !s) return;
    var box = s.getBoundingClientRect(), r = f.getBoundingClientRect();
    ph.style.left = (r.left - box.left - 4) + 'px';
    ph.style.width = (r.width + 8) + 'px';
  }
  function count() {
    var left = 0;
    var idx = todayIdx();
    rows.forEach(function (r) { if (r.d && (r.d[idx] === U || r.d[idx] === N)) left++; });
    var el = $('pb-runTxt');
    if (el) el.textContent = left ? "Run today's plays · " + left + ' lit' : "All lights off — day done";
  }
  function toast(t) {
    var x = $('pb-toast');
    if (!x) return;
    x.textContent = t;
    x.classList.add('show');
    setTimeout(function () { x.classList.remove('show'); }, 1800);
  }
  function setPad(id, day, status) {
    authFetch('/api/playbook', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rhythmId: id, day: day, status: status }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { fromApi(d); render(); })
      .catch(function () {});
  }
  function bind() {
    if (bound) return;
    bound = true;
    window.addEventListener('resize', place);
    var g = $('pb-g');
    var pop = $('pb-pop');
    document.addEventListener('click', function (e) {
      if (!$('v-playbook') || $('v-playbook').hidden) return;
      if (e.target.id === 'pb-openCal') { $('pb-ov').classList.add('open'); return; }
      if (e.target.id === 'pb-closeCal') { $('pb-ov').classList.remove('open'); return; }
      if (e.target.id === 'pb-ov') { e.target.classList.remove('open'); return; }
      if (e.target.id === 'pb-runBtn' || e.target.closest && e.target.closest('#pb-runBtn')) {
        var idx = todayIdx();
        var due = rows.filter(function (r) { return r.d && (r.d[idx] === U || r.d[idx] === N); })[0];
        if (due) switchView((ROOMS[due.room] || ['', 'war'])[1]);
        return;
      }
      var go = e.target.closest && e.target.closest('[data-pb-go]');
      if (go) { e.preventDefault(); switchView(go.getAttribute('data-pb-go')); return; }
      if (e.target.id === 'pb-add' || (e.target.classList && e.target.classList.contains('add'))) {
        var name = prompt('Rhythm name');
        if (!name) return;
        authFetch('/api/playbook', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: name }) })
          .then(function (r) { return r.json(); }).then(function (d) { fromApi(d); render(); }).catch(function () {});
        return;
      }
      if (e.target.id === 'pb-popGo' && cur) {
        var rm = ROOMS[cur.r.room] || ['Room', 'war'];
        toast('Opening ' + rm[0] + '…');
        pop.classList.remove('show');
        switchView(rm[1]);
        return;
      }
      if (e.target.id === 'pb-popDone' && cur) {
        var pad = cur.r.pads[cur.i];
        var next = cur.r.d[cur.i] === D ? 'open' : 'done';
        pop.classList.remove('show');
        setPad(cur.r.id, pad.day, next);
        toast(next === 'done' ? '✓ Light off — ' + cur.r.n + ' done' : cur.r.n + ' turned back on');
        return;
      }
      if (e.target.id === 'pb-popLater' && cur) {
        var p = cur.r.pads[cur.i];
        pop.classList.remove('show');
        setPad(cur.r.id, p.day, 'snoozed');
        toast(cur.r.n + ' snoozed 2 hours');
        return;
      }
      var p = e.target.closest && e.target.closest('#pb-g .pad');
      if (p && p.dataset.r) {
        var r = rows[+p.dataset.r], i = +p.dataset.i, rm2 = ROOMS[r.room] || ['Room', 'war'], st = r.d[i];
        cur = { r: r, i: i, el: p };
        var col = colOf(r);
        $('pb-popSw').style.background = col;
        $('pb-popT').textContent = r.n;
        $('pb-popS').textContent = rm2[0] + ' · ' + (st === D ? 'done — light is off' : st === N ? 'later today' : 'due now');
        var goBtn = $('pb-popGo');
        goBtn.textContent = 'Go to ' + rm2[0] + ' →';
        goBtn.style.background = col;
        $('pb-popDone').innerHTML = st === D ? '↺ Turn back on' : '✓ Mark done';
        var b = p.getBoundingClientRect();
        pop.style.left = Math.min(b.left, innerWidth - 260) + 'px';
        pop.style.top = (b.bottom + 8) + 'px';
        pop.classList.add('show');
        e.stopPropagation();
        return;
      }
      if (pop && !pop.contains(e.target)) pop.classList.remove('show');
    });
  }
  function monthStack() {
    var host = $('pb-months');
    if (!host) return;
    var today = desk.today || '';
    var parts = (today || '2026-10-18').split('-').map(Number);
    var ty = parts[0], tm = parts[1], td = parts[2];
    var daily = rows.filter(function (r) { return r.d && r.grp !== 'Weekly' && !r.s; });
    var months = [];
    for (var m = 0; m < 3; m++) {
      var dt = new Date(Date.UTC(ty, tm - 1 + m, 1));
      var name = dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      var days = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
      var start = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1)).getUTCDay();
      start = (start + 6) % 7;
      months.push({ name: name, days: days, start: start, stat: m === 0 ? (desk.score || 0) + '% on beat' : 'upcoming', y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1 });
    }
    function rnd(n) { return Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1; }
    var logs = {};
    (desk.monthLogs || []).forEach(function (row) { logs[row.rhythmId + '|' + row.day] = row.status; });
    var H = '';
    months.forEach(function (mo, mi) {
      H += '<div class="month"><div class="mname">' + mo.name + '<span>' + mo.stat + '</span></div><div class="mg" style="grid-template-columns:190px repeat(' + mo.days + ',1fr)">';
      H += '<div></div>';
      for (var d = 1; d <= mo.days; d++) {
        var dow = (mo.start + d - 1) % 7, we = dow >= 5, isTd = mi === 0 && d === td;
        H += '<div class="mdh' + (we ? ' we' : '') + (isTd ? ' td' : '') + '">' + 'MTWTFSS'[dow] + '<b>' + d + '</b></div>';
      }
      var ms = { 20: ['Mktg drop', 'var(--green)'], 23: ['4ormIQ live', 'var(--lime)'], 30: ['F&amp;F close', 'var(--gold)'], 31: ['Newsletter', 'var(--blue)'] };
      if (mo.mo === 11) ms = { 3: ['Mktg drop', 'var(--green)'], 17: ['Mktg drop', 'var(--green)'], 30: ['Newsletter', 'var(--blue)'] };
      if (mo.mo === 12) ms = { 1: ['Mktg drop', 'var(--green)'], 15: ['Mktg drop', 'var(--green)'], 31: ['Q4 letter', 'var(--amber)'] };
      H += '<div class="mlab" style="color:var(--mut);font-size:10px;letter-spacing:.1em">MILESTONES</div>';
      for (d = 1; d <= mo.days; d++) {
        var mile = mo.mo === tm || (mi === 0) ? ms[d] : (mo.mo === 11 || mo.mo === 12 ? ms[d] : null);
        H += mile ? '<div class="ms" style="background:' + mile[1] + '" title="' + mile[0] + '">' + mile[0] + '</div>' : '<div></div>';
      }
      daily.forEach(function (r, k) {
        var col = colOf(r);
        H += '<div class="mlab"><i style="background:' + col + '"></i>' + r.n + '</div>';
        for (d = 1; d <= mo.days; d++) {
          var dow2 = (mo.start + d - 1) % 7, we2 = dow2 >= 5, isToday = mi === 0 && d === td;
          var past = mi === 0 && d < td;
          var inboxDaily = r.room === 'msg' || r.room === 'news';
          var iso = mo.y + '-' + String(mo.mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
          var hit = logs[r.id + '|' + iso];
          var c = 'fut';
          if (we2 && !inboxDaily) c = 'off';
          else if (hit === 'done') c = 'done';
          else if (hit === 'missed') c = 'miss';
          else if (past) c = rnd(d * 13 + k * 7) < 0.15 ? 'miss' : 'done';
          else if (isToday) c = (r.d[todayIdx()] === D ? 'done' : 'due');
          H += '<div class="mp ' + c + (isToday ? ' td' : '') + '" style="--c:' + col + '"></div>';
        }
      });
      H += '</div></div>';
      if (mi < months.length - 1) H += '<div class="gap"></div>';
    });
    host.innerHTML = H;
  }
  function loadPlaybook() {
    bind();
    authFetch('/api/playbook', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) { fromApi(d); render(); monthStack(); })
      .catch(function () { fromApi(desk); render(); });
  }
  window.loadPlaybook = loadPlaybook;
})();
