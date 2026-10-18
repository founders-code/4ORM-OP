(function () {
  var TODAY = new Date();
  var C = { meet: 'var(--meet)', inv: 'var(--inv)', pay: 'var(--pay)', mile: 'var(--mile)', hol: 'var(--hol)' };
  var ymd = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var add = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
  var same = function (a, b) { return ymd(a) === ymd(b); };
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var E = [];
  var S = [];
  var view = 'week';
  var focus = new Date();
  var H0 = 7, H1 = 20, PX = 46;
  var shown = { meet: true, inv: true, pay: true, mile: true, hol: true, sug: true };
  var notice = '';
  var bound = false;
  function calEl(id) { return (window.portEl && window.portEl('v-calendar', id)) || document.getElementById(id); }
  function calRoot() { return (window.portRoot && window.portRoot('v-calendar')) || document.getElementById('v-calendar') || document; }

  function laParts(ms) {
    var bag = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).forEach(function (p) { if (p.type !== 'literal') bag[p.type] = p.value; });
    return bag;
  }
  function laNow() {
    var p = laParts(Date.now());
    return new Date(+p.year, +p.month - 1, +p.day);
  }
  function laHour() {
    var p = laParts(Date.now());
    return Number(p.hour) + Number(p.minute) / 60;
  }
  function classify(title) {
    var t = String(title || '').toLowerCase();
    if (/invest|raise|cheque|vc |angel|f&f|zahar/.test(t)) return 'inv';
    if (/bill|pay|invoice|rent|zoom \$|canva|quick books|car payment/.test(t)) return 'pay';
    if (/launch|milestone|4ormiq|drop|newsletter|letter/.test(t)) return 'mile';
    if (/holiday|thanksgiving|christmas|halloween|remembrance|daylight/.test(t)) return 'hol';
    return 'meet';
  }
  function mapEvents(list) {
    return (list || []).map(function (ev) {
      var p = laParts(ev.start);
      var dur = Number(ev.dur) || 30;
      var all = dur >= 23 * 60;
      if (all) p = laParts(Number(ev.start) + 12 * 3600000);
      var d = p.year + '-' + p.month + '-' + p.day;
      var s = Number(p.hour) + Number(p.minute) / 60;
      if (String(ev.title || '').toLowerCase().indexOf('all day') >= 0) all = 1;
      return { d: d, s: s, e: s + dur / 60, t: ev.title || 'Busy', c: classify(ev.title), all: all ? 1 : 0, id: ev.id, join: ev.join || '' };
    });
  }
  var fmt = function (h) {
    var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    var ap = hh >= 12 ? 'p' : 'a';
    var h12 = hh % 12 || 12;
    return h12 + (mm ? ':' + String(mm).padStart(2, '0') : '') + ap;
  };
  var weekStart = function (d) { return add(d, -d.getDay()); };
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var n = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - n);
    var y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y) / 864e5 + 1) / 7);
  }
  function visible(x) { return shown[x.c] !== false; }
  function busy(k) { return E.filter(function (x) { return x.d === k && !x.all; }); }
  function planDay(k, w) {
    var b = busy(k);
    var free = function (s, e) { return !b.some(function (x) { return x.s < e && x.e > s; }); };
    var place = function (len, from, to, t, c) {
      for (var s = from; s + len <= to; s += 0.25) {
        if (free(s, s + len) && !S.some(function (x) { return x.d === k && x.s < s + len && x.e > s; })) {
          S.push({ d: k, s: s, e: s + len, t: t, c: c });
          return;
        }
      }
    };
    place(0.5, 8, 9, 'Video', 'var(--red)');
    place(0.5, 8, 10, 'Inbox zero', 'var(--violet)');
    place(1.25, 9, 13, 'Focus - one move', 'var(--blue2)');
    if (w === 2) place(0.5, 11, 14, 'Chase cold', 'var(--amber)');
    if (w === 3) place(0.5, 13, 15, 'Speer sync', 'var(--teal)');
    if (w === 4) place(0.5, 11, 14, 'Metrics snapshot', 'var(--sky)');
    if (w === 5) place(0.5, 13, 15, 'Check 4ormIQ - launch', 'var(--lime)');
    place(1, 15, 17, 'Outreach: reach 5 + raise touch', 'var(--green)');
    if (w === 5) place(0.5, 16, 17.5, 'Weekly review', '#ffffff');
    place(0.25, 16, 17.5, 'Post clip + engage', 'var(--pink)');
    place(0.25, 17.5, 18.5, 'Shutdown + snapshot', 'var(--slate)');
  }
  function rebuildPlays(first, last) {
    S = [];
    if (!shown.sug) return;
    for (var d = add(TODAY, 1); d <= last; d = add(d, 1)) {
      var w = d.getDay();
      if (w > 0 && w < 6) planDay(ymd(d), w);
    }
  }
  function mini() {
    var m = calEl('cal-mini');
    if (!m) return;
    var h = '';
    DOW.forEach(function (x, i) { h += '<div class="h' + (i === 6 ? ' sat' : '') + '">' + x + '</div>'; });
    var first = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
    var start = add(first, -first.getDay());
    var ws = weekStart(focus);
    for (var i = 0; i < 42; i++) {
      var d = add(start, i), k = ymd(d);
      var evs = E.filter(function (x) { return x.d === k && visible(x); });
      var cols = [];
      evs.forEach(function (x) { if (cols.indexOf(C[x.c]) < 0) cols.push(C[x.c]); });
      cols = cols.slice(0, 3);
      var wk = d >= ws && d < add(ws, 7);
      h += '<div class="d' + (d.getMonth() !== TODAY.getMonth() ? ' o' : '') + (wk ? ' wk' : '') + (same(d, TODAY) ? ' td' : '') + '" data-cal-day="' + k + '"><span>' + d.getDate() + '</span>' + (cols.length ? '<i>' + cols.map(function (c) { return '<b style="background:' + c + '"></b>'; }).join('') + '</i>' : '') + '</div>';
    }
    m.innerHTML = h;
    var title = calRoot().querySelector ? calRoot().querySelector('.mtitle h2') : document.querySelector('#v-calendar .mtitle h2');
    if (title) title.innerHTML = MON[TODAY.getMonth()] + ' <span>' + TODAY.getFullYear() + '</span>';
    var sec = calRoot().querySelector ? calRoot().querySelector('.rail .sec') : document.querySelector('#v-calendar .rail .sec');
    if (sec) sec.innerHTML = 'Today · ' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][TODAY.getDay()] + ' ' + MON[TODAY.getMonth()].slice(0, 3) + ' ' + TODAY.getDate();
  }
  function ribbon() {
    var r = calEl('cal-ribbon');
    if (!r) return;
    var k = ymd(TODAY);
    var span = 13;
    var h = '';
    E.filter(function (x) { return x.d === k && !x.all && visible(x); }).forEach(function (x) {
      h += '<div class="seg" style="left:' + ((x.s - 7) / span * 100) + '%;width:' + ((x.e - x.s) / span * 100) + '%;background:' + C[x.c] + '"></div>';
    });
    var now = Math.min(99, Math.max(0, (laHour() - 7) / span * 100));
    h += '<div class="now" style="left:' + now + '%"></div>';
    r.innerHTML = h;
  }
  function nextUp() {
    var card = calRoot().querySelector('.nextcard');
    if (!card) return;
    var nowH = laHour();
    var todayK = ymd(TODAY);
    var upcoming = E.filter(function (x) { return !x.all && visible(x) && (x.d > todayK || (x.d === todayK && x.s >= nowH)); }).sort(function (a, b) { return a.d === b.d ? a.s - b.s : (a.d < b.d ? -1 : 1); })[0];
    if (!upcoming) {
      card.innerHTML = '<div class="k">NEXT UP</div><div class="t">Nothing on the books</div><div class="s">A good stretch to batch next week\'s clips.</div><div class="row"><button class="b1" type="button" data-cal-go="playbook">Open Playbook</button><button class="b2" type="button" data-cal-go="war">Open War Room</button></div>';
      return;
    }
    var d = upcoming.d.split('-');
    var dt = new Date(+d[0], +d[1] - 1, +d[2]);
    var when = (same(dt, TODAY) ? 'TODAY' : (same(dt, add(TODAY, 1)) ? 'TOMORROW' : DOW[dt.getDay()])) + ' ' + fmt(upcoming.s).toUpperCase();
    card.innerHTML = '<div class="k">NEXT UP · ' + when + '</div><div class="t">' + upcoming.t + '</div><div class="s">' + (upcoming.join ? 'Zoom is on the invite.' : 'Tomorrow is clear - a good day to batch next week\'s clips.') + '</div><div class="row"><button class="b1" type="button" data-cal-go="notes">Prep notes</button><button class="b2" type="button" data-cal-go="war">Open War Room</button></div>';
  }
  function shapeWeek() {
    var ws = add(weekStart(TODAY), 7);
    var hours = { meet: 0, focus: 0, plays: 0 };
    for (var i = 1; i <= 5; i++) {
      var k = ymd(add(ws, i));
      busy(k).forEach(function (x) { hours.meet += (x.e - x.s); });
      S.filter(function (x) { return x.d === k; }).forEach(function (x) {
        if (/focus/i.test(x.t)) hours.focus += (x.e - x.s);
        else hours.plays += (x.e - x.s);
      });
    }
    var free = Math.max(0, 45 - hours.meet - hours.focus - hours.plays);
    var shape = calRoot().querySelector('.shape');
    if (shape) shape.innerHTML = '<i style="flex:' + hours.meet.toFixed(1) + ';background:var(--meet)"></i><i style="flex:' + hours.focus.toFixed(1) + ';background:var(--blue)"></i><i style="flex:' + hours.plays.toFixed(1) + ';background:var(--green)"></i><i style="flex:' + free.toFixed(1) + ';background:#26324f"></i>';
    var legend = calRoot().querySelector('.slegend');
    if (legend) legend.innerHTML = '<span><em style="background:var(--meet)"></em>Meetings <b>' + hours.meet.toFixed(1) + 'h</b></span><span><em style="background:var(--blue)"></em>Focus <b>' + hours.focus.toFixed(1) + 'h</b></span><span><em style="background:var(--green)"></em>Plays <b>' + hours.plays.toFixed(1) + 'h</b></span><span><em style="background:#26324f"></em>Free <b>' + free.toFixed(1) + 'h</b></span>';
  }
  function timeGrid(days, showSug) {
    var h = '<div class="whead" style="grid-template-columns:repeat(' + days.length + ',1fr)">';
    days.forEach(function (d) { h += '<div class="dh' + (same(d, TODAY) ? ' td' : '') + '"><div class="dn">' + DOW[d.getDay()] + '</div><div class="dd"><span>' + d.getDate() + '</span></div></div>'; });
    h += '</div><div class="allday" style="grid-template-columns:repeat(' + days.length + ',1fr)"><span class="lab">all-day</span>';
    days.forEach(function (d) {
      h += '<div class="c">' + E.filter(function (x) { return x.d === ymd(d) && x.all && visible(x); }).map(function (x) { return '<div class="pill" style="background:' + C[x.c] + '">' + x.t + '</div>'; }).join('') + '</div>';
    });
    h += '</div><div class="tgrid" style="grid-template-columns:52px repeat(' + days.length + ',1fr)"><div class="hours">';
    for (var i = H0; i < H1; i++) h += '<div class="hl">' + (i === H0 ? '' : fmt(i)) + '</div>';
    h += '</div>';
    days.forEach(function (d) {
      var k = ymd(d);
      h += '<div class="col' + (same(d, TODAY) ? ' today' : '') + '">';
      for (i = H0; i < H1; i++) h += '<div class="line"></div>';
      E.filter(function (x) { return x.d === k && !x.all && visible(x); }).forEach(function (x) {
        h += '<div class="ev real' + ((x.e - x.s) * PX - 3 < 26 ? ' short' : '') + '" style="top:' + ((x.s - H0) * PX + 1) + 'px;height:' + ((x.e - x.s) * PX - 3) + 'px;background:' + C[x.c] + '"><div class="tt">' + x.t + '</div><div class="tm">' + fmt(x.s) + ' - ' + fmt(x.e) + '</div></div>';
      });
      if (showSug) S.filter(function (x) { return x.d === k; }).forEach(function (x) {
        var ht = (x.e - x.s) * PX - 3;
        h += '<div class="ev sug' + (ht < 26 ? ' short' : '') + '" style="top:' + ((x.s - H0) * PX + 1) + 'px;height:' + ht + 'px;border-color:' + x.c + ';background:color-mix(in srgb,' + x.c + ' 14%,transparent)"><div class="tt" style="color:' + x.c + '">' + x.t + '</div>' + (ht > 22 ? '<div class="tm">' + fmt(x.s) + ' - ' + fmt(x.e) + '</div>' : '') + '<span class="ok"><b style="background:var(--green);color:#06210f">✓</b><b style="background:#2a3556;color:#cfd8f0">✕</b></span></div>';
      });
      if (same(d, TODAY) && laHour() >= H0 && laHour() <= H1) {
        h += '<div class="nowline" style="top:' + ((laHour() - H0) * PX) + 'px"></div>';
      }
      h += '</div>';
    });
    return h + '</div>';
  }
  function aiBanner(n, f) {
    return '<div class="ai"><span class="sp">✦</span><div><b>4orm Intelligence planned next week around your ' + n + ' meetings</b> - ' + S.length + ' plays placed in the gaps, ' + f + 'h of protected focus. Dashed = suggested. Hover a block to keep or drop it.</div><div class="acts"><button type="button" style="background:var(--blue);color:#fff" data-cal-accept>Accept all</button><button type="button" style="background:#1d2b55;color:#cfd8f0" data-cal-replan>Re-plan</button></div></div>';
  }
  function wkPill(ws, we, tws) {
    var n = Math.round((ws - tws) / 6048e5);
    var p = '';
    if (n === 0) p = '<em class="now">this week</em>';
    else if (n === 1) p = '<em>next week</em>';
    else if (n > 1) p = '<em>' + n + ' weeks out</em>';
    else if (n === -1) p = '<em class="past">last week</em>';
    else p = '<em class="past">' + (-n) + ' weeks ago</em>';
    for (var k = 1; k <= 3; k++) {
      var t = new Date(TODAY.getFullYear(), TODAY.getMonth() + k, TODAY.getDate());
      if (t >= ws && t <= we) p += '<em class="mo">' + k + ' month' + (k > 1 ? 's' : '') + ' out</em>';
    }
    return p;
  }
  function render() {
    var body = calEl('cal-body');
    var title = calEl('cal-title');
    if (!body || !title) return;
    var views = calEl('cal-views');
    if (views) views.querySelectorAll('span').forEach(function (s) { s.classList.toggle('on', s.dataset.v === view); });
    var first = add(weekStart(TODAY), -21);
    if (view === 'week') {
      var focusWs = ymd(weekStart(focus));
      var nextMeet = E.filter(function (x) { return !x.all && x.d >= ymd(add(weekStart(TODAY), 7)) && x.d <= ymd(add(weekStart(TODAY), 13)); }).length;
      var h = (notice ? '<div class="ai"><span class="sp">!</span><div>' + notice + '</div></div>' : '') + aiBanner(nextMeet, 9) + '<div class="wk">';
      var tws = weekStart(TODAY);
      for (var w = 0; w < 18; w++) {
        var ws = add(first, 7 * w), we = add(ws, 6), days = [0, 1, 2, 3, 4, 5, 6].map(function (_, i) { return add(ws, i); });
        var lab = MON[ws.getMonth()].slice(0, 3) + ' ' + ws.getDate() + ' - ' + (ws.getMonth() !== we.getMonth() ? MON[we.getMonth()].slice(0, 3) + ' ' : '') + we.getDate();
        h += '<section class="wkb" data-ws="' + ymd(ws) + '" data-cw="' + isoWeek(add(ws, 1)) + '" data-m="' + MON[add(ws, 3).getMonth()] + '"><div class="wklab"><span>CW ' + isoWeek(add(ws, 1)) + '</span>' + lab + wkPill(ws, we, tws) + '</div>' + timeGrid(days, true) + '</section>';
      }
      body.innerHTML = h + '</div>';
      var tgt = body.querySelector('.wkb[data-ws="' + focusWs + '"]');
      if (tgt) body.scrollTop = tgt.offsetTop - 70;
      var upd = function () {
        var bs = [].slice.call(body.querySelectorAll('.wkb'));
        var cur = bs[0];
        bs.forEach(function (b) { if (b.offsetTop - 90 <= body.scrollTop) cur = b; });
        if (cur) title.innerHTML = '<span class="cw">CW ' + cur.dataset.cw + '</span>' + cur.dataset.m + ' <span>' + TODAY.getFullYear() + '</span>';
      };
      body.onscroll = upd;
      upd();
    } else body.onscroll = null;
    if (view === 'day') {
      var d = focus;
      title.innerHTML = '<span class="cw">CW ' + isoWeek(d) + '</span><span style="color:var(--blue2)">' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()] + '</span> ' + MON[d.getMonth()] + ' ' + d.getDate() + ', <span>' + d.getFullYear() + '</span>';
      var k = ymd(d);
      var items = E.filter(function (x) { return x.d === k && !x.all && visible(x); }).map(function (x) { return Object.assign({}, x, { col: C[x.c], real: 1 }); }).concat(S.filter(function (x) { return x.d === k; }).map(function (x) { return Object.assign({}, x, { col: x.c }); })).sort(function (a, b) { return a.s - b.s; });
      body.innerHTML = '<div class="wk dayw"><div>' + timeGrid([d], true) + '</div><div class="side"><h3>Day plan</h3><div class="s">' + items.filter(function (i) { return i.real; }).length + ' meetings · ' + items.filter(function (i) { return !i.real; }).length + ' plays fitted around them</div>' + items.map(function (i) { return '<div class="gap"><span class="tm">' + fmt(i.s) + ' - ' + fmt(i.e) + '</span><em style="background:' + i.col + ';' + (i.real ? '' : 'outline:1.5px dashed ' + i.col + ';background:transparent') + '"></em><span style="' + (i.real ? 'font-weight:700' : '') + '">' + (i.real ? '' : '✦ ') + i.t + '</span></div>'; }).join('') + '</div></div>';
    }
    if (view === 'month' || view === 'quarter') {
      var q = view === 'quarter';
      var m0 = new Date(TODAY.getFullYear(), q ? Math.floor(TODAY.getMonth() / 3) * 3 : TODAY.getMonth(), 1);
      var end = q ? new Date(m0.getFullYear(), m0.getMonth() + 3, 0) : new Date(m0.getFullYear(), m0.getMonth() + 1, 0);
      title.innerHTML = q ? ('Q' + (Math.floor(m0.getMonth() / 3) + 1) + ' <span>' + m0.getFullYear() + '</span> &nbsp;<span style="color:var(--mut);font-size:15px;font-weight:600">' + MON[m0.getMonth()].slice(0, 3) + ' - ' + MON[end.getMonth()].slice(0, 3) + '</span>') : (MON[m0.getMonth()] + ' <span>' + m0.getFullYear() + '</span>');
      var s = add(m0, -m0.getDay());
      var h2 = '<div class="q"><div class="qhead"><div></div>' + DOW.map(function (x) { return '<div>' + x + '</div>'; }).join('') + '</div>';
      while (s <= end) {
        h2 += '<div class="qrow"><div class="cwl">CW ' + isoWeek(add(s, 1)) + '</div>';
        for (var i = 0; i < 7; i++) {
          var dd = add(s, i), kk = ymd(dd);
          var oth = q ? (dd < m0 || dd > end) : dd.getMonth() !== m0.getMonth();
          var firstDay = dd.getDate() === 1;
          var alls = E.filter(function (x) { return x.d === kk && x.all && visible(x); });
          var tim = E.filter(function (x) { return x.d === kk && !x.all && visible(x); }).sort(function (a, b) { return a.s - b.s; });
          var lbl = firstDay ? ('<span>' + MON[dd.getMonth()].slice(0, 3) + ' 1</span>') : (same(dd, TODAY) ? ('<span>' + MON[TODAY.getMonth()].slice(0, 3) + ' ' + TODAY.getDate() + '</span>') : dd.getDate());
          h2 += '<div class="qc' + (q ? '' : ' mc') + (oth ? ' oth' : '') + (firstDay ? ' first' : '') + (same(dd, TODAY) ? ' td' : '') + '" data-cal-day="' + kk + '"><div class="n">' + lbl + '</div>';
          if (q) {
            h2 += alls.map(function (x) { return '<div class="stripe" style="background:' + C[x.c] + '"></div>'; }).join('');
            h2 += '<div class="dots">' + tim.map(function (x) { return '<b style="background:' + C[x.c] + '"></b>'; }).join('') + '</div>';
            var wd = dd.getDay() > 0 && dd.getDay() < 6;
            if (wd && dd > TODAY) h2 += '<div class="play"><i style="background:var(--red)"></i><i style="background:var(--violet)"></i><i style="background:var(--blue2)"></i><i style="background:var(--green)"></i><i style="background:var(--pink)"></i></div>';
          } else {
            var items2 = alls.map(function (x) { return '<div class="mp ad" style="color:' + C[x.c] + '">' + x.t + '</div>'; }).concat(tim.map(function (x) { return '<div class="mp"><em style="background:' + C[x.c] + '"></em>' + x.t + '<span class="tm">' + fmt(x.s) + '</span></div>'; }));
            h2 += items2.slice(0, 4).join('') + (items2.length > 4 ? '<div class="more">' + (items2.length - 4) + ' more...</div>' : '');
          }
          h2 += '</div>';
        }
        h2 += '</div>';
        s = add(s, 7);
      }
      body.innerHTML = h2 + (q ? '<div style="padding:0 20px 20px;font-size:11px;color:var(--mut)">Stripes = all-day · dots = meetings · the thin rainbow bar on future weekdays = today\'s Playbook plays, already fitted in.</div>' : '') + '</div>';
    }
    if (view === 'year') {
      title.innerHTML = '<span>' + TODAY.getFullYear() + '</span>';
      var hy = '<div class="yr">';
      for (var mo = 0; mo < 12; mo++) {
        var f = new Date(TODAY.getFullYear(), mo, 1);
        var g = DOW.map(function (x) { return '<div class="h">' + x[0] + '</div>'; }).join('');
        for (i = 0; i < f.getDay(); i++) g += '<div></div>';
        var dim = new Date(TODAY.getFullYear(), mo + 1, 0).getDate();
        for (var dd2 = 1; dd2 <= dim; dd2++) {
          var d2 = new Date(TODAY.getFullYear(), mo, dd2), k2 = ymd(d2);
          var has = E.some(function (x) { return x.d === k2 && !x.all; });
          var mil = E.some(function (x) { return x.d === k2 && x.c === 'mile'; });
          g += '<div class="x' + (has ? ' e' : '') + (mil ? ' m' : '') + (same(d2, TODAY) ? ' t' : '') + (d2 < first ? ' p' : '') + '">' + dd2 + '</div>';
        }
        hy += '<div class="ym"><h4 class="' + (mo === TODAY.getMonth() ? 'cur' : '') + '">' + MON[mo] + '</h4><div class="g">' + g + '</div></div>';
      }
      body.innerHTML = hy + '</div>';
    }
  }
  function bind() {
    if (bound) return;
    bound = true;
    var host = document.getElementById('v-calendar');
    if (!host) return;
    var root = host.shadowRoot || host;
    root.addEventListener('click', function (e) {
      var t = e.target;
      var v = t.dataset && t.dataset.v;
      if (v && t.closest && t.closest('#cal-views')) { view = v; render(); return; }
      if (t.hasAttribute && t.hasAttribute('data-cal-accept')) { S = []; render(); return; }
      if (t.hasAttribute && t.hasAttribute('data-cal-replan')) {
        var first = add(weekStart(TODAY), -21);
        rebuildPlays(first, add(first, 7 * 18));
        render();
        return;
      }
      var go = t.closest && t.closest('[data-cal-go]');
      if (go) { switchView(go.getAttribute('data-cal-go')); return; }
      var day = t.closest && t.closest('[data-cal-day]');
      if (day) {
        var p = day.getAttribute('data-cal-day').split('-');
        focus = new Date(+p[0], +p[1] - 1, +p[2]);
        view = 'day';
        render();
        mini();
        return;
      }
      if (t.closest && t.closest('.nav span')) {
        var spans = [].slice.call(calRoot().querySelectorAll('.nav span'));
        var i = spans.indexOf(t.closest('span'));
        if (i === 1) { focus = TODAY; view = 'day'; }
        else if (i === 0) focus = add(focus, view === 'year' ? -365 : view === 'quarter' ? -90 : view === 'month' ? -30 : view === 'day' ? -1 : -7);
        else if (i === 2) focus = add(focus, view === 'year' ? 365 : view === 'quarter' ? 90 : view === 'month' ? 30 : view === 'day' ? 1 : 7);
        render();
        mini();
        return;
      }
      var lab = t.closest && t.closest('.cals label');
      if (lab) {
        var keys = ['meet', 'inv', 'pay', 'mile', 'sug'];
        var labels = [].slice.call(calRoot().querySelectorAll('.cals label'));
        var idx = labels.indexOf(lab);
        if (idx >= 0) {
          shown[keys[idx]] = !shown[keys[idx]];
          lab.querySelector('.bx').textContent = shown[keys[idx]] ? '✓' : '';
          if (keys[idx] === 'sug') {
            var first2 = add(weekStart(TODAY), -21);
            rebuildPlays(first2, add(first2, 7 * 18));
          }
          render();
          mini();
          ribbon();
        }
      }
      var ok = t.closest && t.closest('.ev.sug .ok b');
      if (ok) {
        var ev = ok.closest('.ev');
        if (ev) ev.remove();
      }
    });
    var nl = calRoot().querySelector('.nl');
    if (nl) {
      nl.style.cursor = 'text';
      nl.addEventListener('click', function () {
        var text = prompt('Type it', 'Coffee with Bruce Tue 3pm');
        if (!text) return;
        var hit = text.match(/\b(sun|mon|tue|wed|thu|fri|sat)/i);
        var tm = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
        var start = new Date();
        if (hit) {
          var want = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }[hit[1].slice(0, 3).toLowerCase()];
          var addD = (want - start.getDay() + 7) % 7; if (!addD) addD = 7;
          start.setDate(start.getDate() + addD);
        }
        if (tm) {
          var h = +tm[1] % 12; if (/pm/i.test(tm[3])) h += 12;
          start.setHours(h, +(tm[2] || 0), 0, 0);
        } else start.setHours(9, 0, 0, 0);
        var title = text.replace(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/ig, '').replace(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/ig, '').trim() || text;
        authFetch('/api/calendar', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: title, start: start.getTime(), dur: 30 }) })
          .then(function () { loadCalendarPage(); })
          .catch(function () {});
      });
    }
  }
  function loadCalendarPage() {
    bind();
    TODAY = window.fixtureMockup ? new Date(2026, 9, 17) : laNow();
    focus = window.fixtureMockup ? new Date(2026, 9, 19) : add(weekStart(TODAY), 7);
    var first = add(weekStart(TODAY), -21);
    var last = add(first, 7 * 18);
    var from = new Date(first.getFullYear(), first.getMonth(), first.getDate()).getTime();
    var to = new Date(last.getFullYear(), last.getMonth(), last.getDate(), 23, 59).getTime();
    if (window.fixtureMockup) {
      E = [];
      function ev(d, s, e, t, c) { E.push({ d: d, s: s, e: e, t: t, c: c || 'meet', all: false }); }
      function ad(d, t, c) { E.push({ d: d, s: 0, e: 24, t: t, c: c || 'hol', all: true }); }
      [['2026-10-02', 9, 10, 'Zed and Chad 1on1'], ['2026-10-02', 12, 13, 'Dean and Chad'], ['2026-10-02', 16, 17, "4orm's first investor call", 'inv'],
        ['2026-10-05', 9, 10, '4orm Dev'], ['2026-10-05', 14, 15, 'Bruce and Chad 1on1'], ['2026-10-06', 11, 12, 'Zed and Chad 1on1'], ['2026-10-06', 14.75, 15.5, 'Kevin and Chad'],
        ['2026-10-08', 15, 16, 'Speer and 4orm'], ['2026-10-09', 11.5, 12.5, 'Jeff intro | Bruce'], ['2026-10-13', 12, 13, 'Content Posting Run'], ['2026-10-14', 9, 10, 'Mike Stephens | Bruce'],
        ['2026-10-15', 10, 11, 'Development End to End'], ['2026-10-15', 11, 12, 'Dean and Chad 1on1'], ['2026-10-16', 9.5, 10.5, 'Call the Fraud Prevention Centre'],
        ['2026-10-16', 13, 14, 'Quinton and Chad'], ['2026-10-16', 14, 15, 'Kevin Zahar | 4orm', 'inv'], ['2026-10-17', 10.5, 12, 'Shawn and Chad | Meet at home'], ['2026-10-17', 14, 15, 'Bruce and Chad 1on1'],
        ['2026-10-19', 12, 13, 'Chad Fournier | 4orm Investment review', 'inv']].forEach(function (a) { ev(a[0], a[1], a[2], a[3], a[4] || 'meet'); });
      [['2026-10-09', 'Hack a thon', 'hol'], ['2026-10-12', 'Thanksgiving', 'hol'], ['2026-10-20', 'Marketing drop', 'mile'], ['2026-10-23', '4ormIQ launch', 'mile'],
        ['2026-10-30', 'F&F close - $250K', 'inv'], ['2026-10-31', 'Newsletter + paper + update', 'mile'], ['2026-10-31', 'Halloween', 'hol'], ['2026-11-01', 'Daylight Saving ends', 'hol'],
        ['2026-11-03', 'Marketing drop', 'mile'], ['2026-11-11', 'Remembrance Day', 'hol'], ['2026-11-17', 'Marketing drop', 'mile'], ['2026-11-30', 'Newsletter + paper + update', 'mile'],
        ['2026-12-01', 'Marketing drop', 'mile'], ['2026-12-15', 'Marketing drop', 'mile'], ['2026-12-25', 'Christmas', 'hol'], ['2026-12-29', 'Marketing drop', 'mile'], ['2026-12-31', 'Q4 investor letter', 'mile']].forEach(function (a) { ad(a[0], a[1], a[2]); });
      for (var d = new Date(2026, 8, 27); d <= new Date(2027, 0, 31); d = add(d, 1)) {
        var k = ymd(d), w = d.getDay(), m = d.getDate();
        if (w === 1) { ev(k, 9, 10, "Executive Advisor's | War Room", 'meet'); ev(k, 11, 12, 'Dean and Chad Weekly Call', 'meet'); }
        if (w === 3 && d >= new Date(2026, 9, 7)) ev(k, 10, 10.5, 'Kevin and Chad | 1on1 GTM', 'meet');
        if (w === 5 && d >= new Date(2026, 9, 23)) ev(k, 10, 11, 'Don and Chad 1on1', 'inv');
        if (m === 14 || m === 28) ad(k, 'Car Payment $285.21', 'pay');
        if (m === 7) ad(k, 'Zoom $22.56', 'pay');
        if (m === 8) ad(k, 'Canva $16', 'pay');
        if (m === 22) ad(k, 'Quick Books $53.76', 'pay');
        if (w === 0 && Math.round((d - new Date(2026, 8, 27)) / 864e5) % 14 === 0) ad(k, 'Delayed communication', 'hol');
      }
      rebuildPlays(first, last);
      mini(); ribbon(); nextUp(); shapeWeek(); render();
      return;
    }
    authFetch('/api/calendar?from=' + new Date(from).toISOString() + '&to=' + new Date(to).toISOString(), { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        notice = d.error ? String(d.error) : '';
        E = mapEvents(d.events || []);
        rebuildPlays(first, last);
        mini();
        ribbon();
        nextUp();
        shapeWeek();
        render();
      })
      .catch(function () {
        notice = 'Calendar could not be read.';
        E = [];
        rebuildPlays(first, last);
        mini();
        ribbon();
        nextUp();
        shapeWeek();
        render();
      });
  }
  window.loadCalendarPage = loadCalendarPage;
})();
